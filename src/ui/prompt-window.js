import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {
    enhancePrompt,
    fillPrompt,
    htmlToPango,
    isExecutable,
    missingFillers,
    parseTemplate,
} from '../services/prompt-composer.js';

function makeIconButton(iconName, styleExtra = '', iconSize = 16) {
    const button = new St.Button({
        style_class: `promptkey-icon-button ${styleExtra}`.trim(),
        can_focus: true,
        reactive: true,
        track_hover: true,
    });
    button.child = new St.Icon({
        icon_name: iconName,
        style_class: 'promptkey-icon',
        icon_size: iconSize,
    });
    return button;
}

function selectLabel(name) {
    return `${name} ▾`;
}

function makeTemplateText(text) {
    const label = new St.Label({
        text,
        style_class: 'promptkey-template-text',
        y_align: Clutter.ActorAlign.CENTER,
    });
    label.clutter_text.line_wrap = true;
    label.clutter_text.ellipsize = 0; // Pango.EllipsizeMode.NONE
    return label;
}

// ponytail: char budget approximates wrap for ~440px dialog; upgrade to Pango measure if needed
const TEMPLATE_ROW_CHARS = 48;

export const PromptWindow = GObject.registerClass(
class PromptWindow extends ModalDialog.ModalDialog {
    /**
     * @param {object} params
     * @param {import('../prompts/prompt-manager.js').PromptManager} params.promptManager
     * @param {import('../providers/provider-manager.js').ProviderManager} params.providerManager
     * @param {string|null} params.initialPromptId
     * @param {boolean} params.closeOnEscape
     * @param {boolean} params.autoCopyResponse
     * @param {(id: string) => void} [params.onPromptSelected]
     * @param {() => void} [params.openPreferences]
     */
    _init({
        promptManager,
        providerManager,
        initialPromptId = null,
        closeOnEscape = true,
        autoCopyResponse = true,
        onPromptSelected = null,
        openPreferences = null,
    }) {
        super._init({
            styleClass: 'promptkey-dialog',
            destroyOnClose: true,
        });

        this._promptManager = promptManager;
        this._providerManager = providerManager;
        this._closeOnEscape = closeOnEscape;
        this._autoCopyResponse = autoCopyResponse;
        this._onPromptSelected = onPromptSelected;
        this._openPreferences = openPreferences;
        this._busy = false;
        this._selectedPromptId = null;
        this._selectedProfileId = null;
        this._responseText = '';
        this._copyResetId = 0;
        this._focusIdleId = 0;
        this._fillerEntries = [];
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        const bar = new St.BoxLayout({
            style_class: 'promptkey-bar',
            x_expand: true,
        });

        this._promptSelect = new St.Button({
            style_class: 'promptkey-select',
            label: 'Prompt ▾',
            can_focus: true,
            reactive: true,
            track_hover: true,
            x_expand: true,
        });
        this._promptSelect.connect('clicked', () => this._toggleSelectMenu('prompt'));
        bar.add_child(this._promptSelect);

        this._providerSelect = new St.Button({
            style_class: 'promptkey-select promptkey-select-sm',
            label: 'Provider ▾',
            can_focus: true,
            reactive: true,
            track_hover: true,
        });
        this._providerSelect.connect('clicked', () => this._toggleSelectMenu('provider'));
        bar.add_child(this._providerSelect);

        if (this._openPreferences) {
            const manage = makeIconButton('emblem-system-symbolic', 'promptkey-manage');
            manage.tooltip_text = 'Manage prompts & providers';
            manage.connect('clicked', () => {
                this._closeMenus();
                this.close();
                this._openPreferences();
            });
            bar.add_child(manage);
        }

        this.contentLayout.add_child(bar);

        this._promptMenu = this._createSelectMenu(this._promptSelect);
        this._providerMenu = this._createSelectMenu(this._providerSelect);

        this._templateBox = new St.BoxLayout({
            vertical: true,
            style_class: 'promptkey-template',
            x_expand: true,
        });
        this.contentLayout.add_child(this._templateBox);

        this._executeButton = new St.Button({
            style_class: 'promptkey-button promptkey-button-primary',
            label: 'Run',
            can_focus: true,
            reactive: true,
            track_hover: true,
            x_expand: true,
        });
        this._executeButton.connect('clicked', () => this._execute());
        this.contentLayout.add_child(this._executeButton);

        this._responseBox = new St.BoxLayout({
            vertical: true,
            style_class: 'promptkey-response-box',
            x_expand: true,
            visible: false,
        });

        const responseHeader = new St.BoxLayout({
            style_class: 'promptkey-response-header',
            x_expand: true,
        });
        responseHeader.add_child(new St.Widget({x_expand: true}));
        this._copyButton = makeIconButton('edit-copy-symbolic', 'promptkey-copy', 22);
        this._copyButton.connect('clicked', () => this._copyResponse());
        this._copyButton.visible = false;
        responseHeader.add_child(this._copyButton);
        this._responseBox.add_child(responseHeader);

        // CSS height is ignored by St.ScrollView; set allocation in JS.
        const RESPONSE_HEIGHT = 200;
        this._responseScroll = new St.ScrollView({
            style_class: 'promptkey-response-scroll',
            x_expand: true,
            overlay_scrollbars: false,
        });
        this._responseScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this._responseScroll.set_height(RESPONSE_HEIGHT);

        this._responseLabel = new St.Label({
            text: '',
            style_class: 'promptkey-response',
            x_expand: true,
        });
        this._responseLabel.clutter_text.line_wrap = true;
        this._responseLabel.clutter_text.ellipsize = 0;
        this._responseLabel.clutter_text.selectable = true;

        // Bin expands with label height so ScrollView can actually scroll
        this._responseBin = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            style_class: 'promptkey-response-bin',
        });
        this._responseBin.add_child(this._responseLabel);
        this._responseScroll.add_child(this._responseBin);
        this._responseBox.add_child(this._responseScroll);
        this.contentLayout.add_child(this._responseBox);

        this.setButtons([]);
        this._dialogKeys = this.connect('key-press-event', (_a, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape && this._closeOnEscape) {
                if (this._promptMenu.isOpen || this._providerMenu.isOpen) {
                    this._closeMenus();
                    return Clutter.EVENT_STOP;
                }
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        this.connect('closed', () => this._closeMenus());
        this.connect('destroy', () => {
            this._cancelCopyReset();
            this._cancelFocusIdle();
            this._destroyMenus();
            if (this._dialogKeys) {
                this.disconnect(this._dialogKeys);
                this._dialogKeys = 0;
            }
        });

        this._initSelection(initialPromptId);
        this.connect('opened', () => this._focusPrimary());
    }

    _initSelection(initialPromptId) {
        const prompts = this._promptManager.list({enabledOnly: true});
        let prompt = null;
        if (initialPromptId)
            prompt = prompts.find(p => p.id === initialPromptId) ?? null;
        if (!prompt)
            prompt = this._promptManager.getDefault();

        this._selectedPromptId = prompt?.id ?? null;
        this._selectedProfileId = this._providerManager.getDefault()?.id ?? null;
        if (this._selectedPromptId)
            this._rememberPrompt(this._selectedPromptId);
        this._refreshSelectLabels();
        this._rebuildTemplate();
        this._updateRunEnabled();
    }

    _rememberPrompt(id) {
        if (id && this._onPromptSelected)
            this._onPromptSelected(id);
    }

    _refreshSelectLabels() {
        const prompt = this._promptManager.getById(this._selectedPromptId);
        const profile = this._providerManager.getById(this._selectedProfileId);
        this._promptSelect.label = selectLabel(prompt?.name ?? 'No prompts');
        this._providerSelect.label = selectLabel(profile?.name ?? 'No provider');
    }

    _responseFormat() {
        const prompt = this._promptManager.getById(this._selectedPromptId);
        return prompt?.responseFormat === 'html' ? 'html' : 'text';
    }

    _createSelectMenu(source) {
        const menu = new PopupMenu.PopupMenu(source, 0, St.Side.TOP);
        menu.actor.add_style_class_name('promptkey-dropdown');
        // Keep the list from stretching the dialog; overlay in the shell UI group
        Main.uiGroup.add_child(menu.actor);
        menu.actor.hide();
        this._menuManager.addMenu(menu);
        menu.connect('open-state-changed', (_m, open) => {
            if (open)
                source.add_style_class_name('promptkey-select-open');
            else
                source.remove_style_class_name('promptkey-select-open');
        });
        return menu;
    }

    _destroyMenus() {
        for (const menu of [this._promptMenu, this._providerMenu]) {
            if (!menu)
                continue;
            try {
                menu.close();
            } catch (_e) {
                // already closed
            }
            try {
                this._menuManager.removeMenu(menu);
            } catch (_e) {
                // already removed
            }
            menu.destroy();
        }
        this._promptMenu = null;
        this._providerMenu = null;
    }

    _closeMenus() {
        this._promptMenu?.close();
        this._providerMenu?.close();
    }

    _toggleSelectMenu(kind) {
        if (this._busy)
            return;

        const menu = kind === 'prompt' ? this._promptMenu : this._providerMenu;
        const other = kind === 'prompt' ? this._providerMenu : this._promptMenu;
        other.close();

        if (menu.isOpen) {
            menu.close();
            return;
        }

        menu.removeAll();
        if (kind === 'prompt')
            this._fillPromptMenu(menu);
        else
            this._fillProviderMenu(menu);
        menu.open();
    }

    _fillPromptMenu(menu) {
        const prompts = this._promptManager.list({enabledOnly: true});
        if (prompts.length === 0) {
            menu.addMenuItem(new PopupMenu.PopupMenuItem('No prompts enabled', {
                reactive: false,
            }));
            return;
        }

        for (const prompt of prompts) {
            const item = new PopupMenu.PopupMenuItem(prompt.name);
            if (prompt.id === this._selectedPromptId)
                item.setOrnament(PopupMenu.Ornament.DOT);
            item.connect('activate', () => {
                this._selectedPromptId = prompt.id;
                this._rememberPrompt(prompt.id);
                this._refreshSelectLabels();
                this._rebuildTemplate();
                this._clearResponse();
                this._updateRunEnabled();
                // Menu restore-focus runs after activate; defer past it
                this._scheduleFocusPrimary();
            });
            menu.addMenuItem(item);
        }
    }

    _fillProviderMenu(menu) {
        const profiles = this._providerManager.list({enabledOnly: true});
        if (profiles.length === 0) {
            menu.addMenuItem(new PopupMenu.PopupMenuItem('No provider - open Manage', {
                reactive: false,
            }));
            return;
        }

        for (const profile of profiles) {
            const item = new PopupMenu.PopupMenuItem(profile.name);
            if (profile.id === this._selectedProfileId)
                item.setOrnament(PopupMenu.Ornament.DOT);
            item.connect('activate', () => {
                this._selectedProfileId = profile.id;
                this._refreshSelectLabels();
            });
            menu.addMenuItem(item);
        }
    }

    _newTemplateRow() {
        return new St.BoxLayout({
            style_class: 'promptkey-template-row',
            x_expand: true,
        });
    }

    _rebuildTemplate() {
        this._templateBox.destroy_all_children();
        this._fillerEntries = [];

        const prompt = this._promptManager.getById(this._selectedPromptId);
        const instruction = prompt?.instruction ?? '';
        const parts = parseTemplate(instruction);

        if (parts.length === 0) {
            this._templateBox.visible = false;
            return;
        }

        this._templateBox.visible = true;
        let row = this._newTemplateRow();
        let rowChars = 0;

        const flushRow = () => {
            if (row.get_n_children() > 0)
                this._templateBox.add_child(row);
            row = this._newTemplateRow();
            rowChars = 0;
        };

        const appendTextChunk = chunk => {
            if (!chunk)
                return;
            const words = chunk.split(/(\s+)/);
            let buffer = '';
            const flushBuffer = () => {
                if (!buffer)
                    return;
                row.add_child(makeTemplateText(buffer));
                rowChars += buffer.length;
                buffer = '';
            };
            for (const word of words) {
                if (!word)
                    continue;
                if (rowChars > 0 && rowChars + buffer.length + word.length > TEMPLATE_ROW_CHARS) {
                    flushBuffer();
                    flushRow();
                }
                if (word.length > TEMPLATE_ROW_CHARS && !buffer && rowChars === 0) {
                    // long token: own wrapping label
                    const label = makeTemplateText(word);
                    label.x_expand = true;
                    row.add_child(label);
                    flushRow();
                    continue;
                }
                buffer += word;
            }
            flushBuffer();
        };

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part.type === 'text') {
                const lines = part.value.split('\n');
                for (let c = 0; c < lines.length; c++) {
                    if (c > 0)
                        flushRow();
                    appendTextChunk(lines[c]);
                }
                continue;
            }

            const prev = parts[i - 1];
            const next = parts[i + 1];
            const block =
                (!prev || (prev.type === 'text' && /\n\s*$/.test(prev.value))) &&
                (!next || (next.type === 'text' && /^\s*\n/.test(next.value)) || !next);

            if (block && row.get_n_children() > 0)
                flushRow();
            else if (!block && rowChars > 0 && rowChars + Math.max(part.name.length, 8) > TEMPLATE_ROW_CHARS)
                flushRow();

            const entry = new St.Entry({
                style_class: block
                    ? 'promptkey-blank promptkey-blank-block'
                    : 'promptkey-blank',
                can_focus: true,
                hint_text: part.name,
                x_expand: block,
            });
            if (block) {
                entry.clutter_text.single_line_mode = false;
                entry.clutter_text.line_wrap = true;
                entry.clutter_text.activatable = false;
            } else {
                entry.clutter_text.single_line_mode = true;
                entry.clutter_text.activatable = false;
            }
            entry.clutter_text.connect('text-changed', () => this._updateRunEnabled());
            entry.clutter_text.connect('key-press-event', (_actor, event) =>
                this._onBlankKeyPress(event));
            row.add_child(entry);
            this._fillerEntries.push({name: part.name, entry});
            rowChars += Math.max(part.name.length, 8);

            if (block)
                flushRow();
        }

        if (row.get_n_children() > 0)
            this._templateBox.add_child(row);
    }

    _onBlankKeyPress(event) {
        const symbol = event.get_key_symbol();
        const state = event.get_state();
        const ctrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;
        if (ctrl && (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter)) {
            if (this._canRun())
                this._execute();
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_Escape && this._closeOnEscape) {
            if (this._promptMenu?.isOpen || this._providerMenu?.isOpen) {
                this._closeMenus();
                return Clutter.EVENT_STOP;
            }
            this.close();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _cancelFocusIdle() {
        if (this._focusIdleId) {
            GLib.source_remove(this._focusIdleId);
            this._focusIdleId = 0;
        }
    }

    _scheduleFocusPrimary() {
        this._cancelFocusIdle();
        this._focusIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._focusIdleId = 0;
            this._focusPrimary();
            return GLib.SOURCE_REMOVE;
        });
    }

    _focusPrimary() {
        const first = this._fillerEntries[0]?.entry;
        if (first) {
            // Re-assert after busy/menu focus churn; stale focus leaves Entry uneditable
            first.clutter_text.editable = true;
            first.clutter_text.reactive = true;
            global.stage.set_key_focus(first.clutter_text);
        } else if (this._canRun()) {
            global.stage.set_key_focus(this._executeButton);
        }
    }

    _fillerValues() {
        const values = {};
        for (const {name, entry} of this._fillerEntries)
            values[name] = entry.get_text();
        return values;
    }

    _canRun() {
        if (this._busy)
            return false;
        const prompt = this._promptManager.getById(this._selectedPromptId);
        const instruction = prompt?.instruction ?? '';
        if (!instruction.trim() && this._fillerEntries.length === 0)
            return false;
        return missingFillers(instruction, this._fillerValues()).length === 0 &&
            isExecutable(fillPrompt(instruction, this._fillerValues()));
    }

    _updateRunEnabled() {
        const ok = this._canRun();
        this._executeButton.reactive = ok;
        if (ok)
            this._executeButton.remove_style_class_name('promptkey-button-disabled');
        else
            this._executeButton.add_style_class_name('promptkey-button-disabled');
    }

    _cancelCopyReset() {
        if (this._copyResetId) {
            GLib.source_remove(this._copyResetId);
            this._copyResetId = 0;
        }
    }

    _clearResponse() {
        this._cancelCopyReset();
        this._responseText = '';
        this._responseLabel.clutter_text.use_markup = false;
        this._responseLabel.text = '';
        this._responseLabel.remove_style_class_name('promptkey-response-muted');
        this._responseLabel.remove_style_class_name('promptkey-response-error');
        this._copyButton.visible = false;
        this._responseBox.visible = false;
    }

    _setResponse(text, {error = false, muted = false, copyable = false, html = false} = {}) {
        this._responseBox.visible = true;
        this._responseLabel.remove_style_class_name('promptkey-response-error');
        this._responseLabel.remove_style_class_name('promptkey-response-muted');

        if (error)
            this._responseLabel.add_style_class_name('promptkey-response-error');
        if (muted)
            this._responseLabel.add_style_class_name('promptkey-response-muted');

        if (html && !error && !muted) {
            const markup = htmlToPango(text ?? '');
            this._responseLabel.clutter_text.use_markup = true;
            try {
                this._responseLabel.clutter_text.set_markup(markup || ' ');
            } catch (_e) {
                // Invalid markup edge case: show readable plain text
                this._responseLabel.clutter_text.use_markup = false;
                this._responseLabel.text = markup
                    .replace(/<\/?[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>') || (text ?? '');
            }
        } else {
            this._responseLabel.clutter_text.use_markup = false;
            this._responseLabel.text = text ?? '';
        }

        this._copyButton.visible = Boolean(copyable && this._responseText);
    }

    _setBusy(busy) {
        this._busy = busy;
        this._executeButton.label = busy ? '…' : 'Run';
        this._promptSelect.reactive = !busy;
        this._providerSelect.reactive = !busy;
        // Do not toggle entry.reactive: disabling while ClutterText is focused
        // leaves the blank stuck uneditable after re-enable.
        this._updateRunEnabled();
        if (!busy)
            this._scheduleFocusPrimary();
    }

    async _execute() {
        if (this._busy || !this._canRun())
            return;

        this._closeMenus();

        const prompt = this._promptManager.getById(this._selectedPromptId);
        const profile = this._providerManager.getById(this._selectedProfileId);
        const instruction = prompt?.instruction ?? '';
        const values = this._fillerValues();
        const format = this._responseFormat();
        const filled = fillPrompt(instruction, values);
        const composed = enhancePrompt(filled, format);

        if (!profile) {
            this._responseText = '';
            this._setResponse('Set up a provider via Manage.', {error: true});
            return;
        }

        if (!profile.enabled) {
            this._responseText = '';
            this._setResponse('Selected provider is disabled.', {error: true});
            return;
        }

        this._setBusy(true);
        this._cancelCopyReset();
        this._responseText = '';
        this._setResponse('Running…', {muted: true});

        try {
            const response = await this._providerManager.complete(profile, composed);
            this._responseText = response;
            this._setResponse(response, {
                copyable: true,
                html: format === 'html',
            });
            if (this._autoCopyResponse && response)
                this._writeClipboard(response);
        } catch (e) {
            const message = e?.message ? String(e.message) : String(e);
            const safe = profile.apiKey
                ? message.split(profile.apiKey).join('[redacted]')
                : message;
            this._responseText = '';
            this._setResponse(safe, {error: true});
        } finally {
            this._setBusy(false);
        }
    }

    // Write-only clipboard use for Copy / optional auto-copy. Declared in metadata.json.
    // Never reads the clipboard; never sends clipboard contents to any network endpoint.
    _writeClipboard(text) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, text);
    }

    _copyResponse() {
        if (!this._responseText)
            return;

        const text = this._responseText;
        const asHtml = this._responseFormat() === 'html';
        this._writeClipboard(text);
        this._setResponse('Copied', {muted: true, copyable: true});

        this._cancelCopyReset();
        this._copyResetId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 900, () => {
            this._copyResetId = 0;
            if (this._responseText === text)
                this._setResponse(text, {copyable: true, html: asHtml});
            return GLib.SOURCE_REMOVE;
        });
    }
});
