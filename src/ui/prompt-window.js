import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Animation from 'resource:///org/gnome/shell/ui/animation.js';
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

const RESPONSE_MAX_HEIGHT = 320;
// ponytail: char budget approximates wrap for the 496px composer at 15px; upgrade to Pango measure if needed
const TEMPLATE_ROW_CHARS = 68;
const BLANK_CHARS = 15;
const MAX_QUICK_SWITCH = 9;

function makeIcon(iconName, size = 16, styleClass = 'promptkey-icon') {
    return new St.Icon({
        icon_name: iconName,
        style_class: styleClass,
        icon_size: size,
        y_align: Clutter.ActorAlign.CENTER,
    });
}

function makeIconButton(iconName, styleExtra = '', iconSize = 16) {
    const button = new St.Button({
        style_class: `promptkey-icon-button ${styleExtra}`.trim(),
        can_focus: true,
        reactive: true,
        track_hover: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    button.child = makeIcon(iconName, iconSize);
    return button;
}

function makeLabel(text, styleClass) {
    return new St.Label({
        text,
        style_class: styleClass,
        y_align: Clutter.ActorAlign.CENTER,
    });
}

/** Button with a [label][trailing actor] row. Returns {button, label}. */
function makeRowButton(styleClass, text, trailing = null, leading = null) {
    const box = new St.BoxLayout({style_class: 'promptkey-button-box'});
    if (leading)
        box.add_child(leading);
    const label = makeLabel(text, 'promptkey-button-label');
    box.add_child(label);
    if (trailing)
        box.add_child(trailing);
    const button = new St.Button({
        style_class: styleClass,
        child: box,
        can_focus: true,
        reactive: true,
        track_hover: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    return {button, label};
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

/** ScrollView that sizes to its content up to a maximum height. */
const FitScrollView = GObject.registerClass(
class FitScrollView extends St.ScrollView {
    vfunc_get_preferred_height(forWidth) {
        const [, natural] = this.get_child()?.get_preferred_height(forWidth) ?? [0, 0];
        const height = Math.min(natural, RESPONSE_MAX_HEIGHT);
        return [height, height];
    }
});

function isEnter(symbol) {
    return symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter;
}

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
        this._runSerial = 0;
        this._selectedPromptId = null;
        this._selectedProfileId = null;
        this._responseText = '';
        this._copyResetId = 0;
        this._focusIdleId = 0;
        this._fillerEntries = [];
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        this.buttonLayout.hide();
        this.setButtons([]);

        this._buildHeader();
        this._buildComposer();
        this._buildResponse();
        this._buildFooter();

        this._promptMenu = this._createSelectMenu(this._promptSelect);
        this._providerMenu = this._createSelectMenu(this._providerSelect);

        this._dialogKeys = this.connect('key-press-event', (_a, event) =>
            this._handleKey(event, null));

        this.connect('closed', () => this._closeMenus());
        this.connect('destroy', () => {
            this._runSerial++;
            this._cancelCopyTimer();
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

    open(...args) {
        // St re-applies CSS margins on restyle, so set the offset as a style.
        const monitor = Main.layoutManager.currentMonitor ?? Main.layoutManager.primaryMonitor;
        if (monitor)
            this.dialogLayout.style = `margin-top: ${Math.round(monitor.height * 0.16)}px;`;
        // Spotlight-style: anchor near the top so the input stays put while
        // the response grows downward.
        // BinLayout only honours actor alignment for children that expand.
        this.dialogLayout.set({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });
        return super.open(...args);
    }

    // ---- layout -----------------------------------------------------------

    _makeSelect(styleExtra) {
        const arrow = makeIcon('pan-down-symbolic', 12, 'promptkey-select-arrow');
        const {button, label} = makeRowButton(`promptkey-select ${styleExtra}`, '', arrow);
        button._pkLabel = label;
        return button;
    }

    _buildHeader() {
        const header = new St.BoxLayout({
            style_class: 'promptkey-header',
            x_expand: true,
        });

        this._promptSelect = this._makeSelect('promptkey-select-prompt');
        this._promptSelect.connect('clicked', () => this._toggleSelectMenu('prompt'));
        header.add_child(this._promptSelect);

        header.add_child(new St.Widget({x_expand: true}));

        this._providerSelect = this._makeSelect('promptkey-select-provider');
        this._providerSelect.connect('clicked', () => this._toggleSelectMenu('provider'));
        header.add_child(this._providerSelect);

        if (this._openPreferences) {
            const manage = makeIconButton('emblem-system-symbolic', 'promptkey-manage', 16);
            manage.accessible_name = 'Manage prompts and providers';
            manage.connect('clicked', () => this._showPreferences());
            header.add_child(manage);
        }

        this.contentLayout.add_child(header);
    }

    _buildComposer() {
        this._templateBox = new St.BoxLayout({
            vertical: true,
            style_class: 'promptkey-composer',
            x_expand: true,
        });
        this.contentLayout.add_child(this._templateBox);
    }

    _buildResponse() {
        this._responseBox = new St.BoxLayout({
            vertical: true,
            style_class: 'promptkey-response-box',
            x_expand: true,
            visible: false,
        });

        this._responseScroll = new FitScrollView({
            style_class: 'promptkey-response-scroll',
            x_expand: true,
            overlay_scrollbars: true,
        });
        this._responseScroll.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

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
    }

    _buildFooter() {
        const footer = new St.BoxLayout({
            style_class: 'promptkey-footer',
            x_expand: true,
        });

        this._spinner = null;
        try {
            this._spinner = new Animation.Spinner(14, {hideOnStop: true});
            this._spinner.add_style_class_name('promptkey-spinner');
            this._spinner.y_align = Clutter.ActorAlign.CENTER;
            footer.add_child(this._spinner);
        } catch (_e) {
            this._spinner = null;
        }

        this._statusIcon = makeIcon('object-select-symbolic', 14, 'promptkey-status-icon');
        this._statusIcon.visible = false;
        footer.add_child(this._statusIcon);

        this._statusLabel = makeLabel('', 'promptkey-status');
        this._statusLabel.x_expand = true;
        this._statusLabel.clutter_text.ellipsize = 3; // Pango.EllipsizeMode.END
        footer.add_child(this._statusLabel);

        this._copyIcon = makeIcon('edit-copy-symbolic', 14, 'promptkey-button-icon');
        const copy = makeRowButton('promptkey-button promptkey-button-ghost', 'Copy', null, this._copyIcon);
        this._copyButton = copy.button;
        this._copyLabel = copy.label;
        this._copyButton.visible = false;
        this._copyButton.connect('clicked', () => this._copyResponse());
        footer.add_child(this._copyButton);

        const kbd = makeLabel('Ctrl ↵', 'promptkey-kbd');
        const run = makeRowButton('promptkey-button promptkey-button-primary', 'Run', kbd);
        this._executeButton = run.button;
        this._executeLabel = run.label;
        this._executeButton.connect('clicked', () => this._execute());
        footer.add_child(this._executeButton);

        this.contentLayout.add_child(footer);
        this._showHint();
    }

    // ---- selection --------------------------------------------------------

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

    _selectPrompt(id) {
        if (this._busy || !id)
            return;
        if (id === this._selectedPromptId) {
            this._scheduleFocusPrimary();
            return;
        }
        this._selectedPromptId = id;
        this._rememberPrompt(id);
        this._refreshSelectLabels();
        this._rebuildTemplate();
        this._clearResponse();
        this._updateRunEnabled();
        // Menu restore-focus runs after activate; defer past it
        this._scheduleFocusPrimary();
    }

    _selectPromptByIndex(index) {
        const prompt = this._promptManager.list({enabledOnly: true})[index];
        if (prompt) {
            this._closeMenus();
            this._selectPrompt(prompt.id);
        }
    }

    _refreshSelectLabels() {
        const prompt = this._promptManager.getById(this._selectedPromptId);
        const profile = this._providerManager.getById(this._selectedProfileId);
        this._promptSelect._pkLabel.text = prompt?.name ?? 'No prompts';
        this._providerSelect._pkLabel.text = profile?.name ?? 'No provider';
    }

    _responseFormat() {
        const prompt = this._promptManager.getById(this._selectedPromptId);
        return prompt?.responseFormat === 'html' ? 'html' : 'text';
    }

    _showPreferences() {
        if (!this._openPreferences)
            return;
        this._closeMenus();
        this.close();
        this._openPreferences();
    }

    // ---- menus ------------------------------------------------------------

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

    _menusOpen() {
        return Boolean(this._promptMenu?.isOpen || this._providerMenu?.isOpen);
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

    _addMenuItem(menu, text, {selected = false, accel = null, onActivate = null} = {}) {
        const item = new PopupMenu.PopupMenuItem(text, {reactive: Boolean(onActivate)});
        item.add_style_class_name('promptkey-menu-item');
        item.setOrnament(selected ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        if (accel) {
            const accelLabel = makeLabel(accel, 'promptkey-menu-accel');
            accelLabel.x_expand = true;
            accelLabel.x_align = Clutter.ActorAlign.END;
            item.add_child(accelLabel);
        }
        if (onActivate)
            item.connect('activate', onActivate);
        menu.addMenuItem(item);
    }

    _fillPromptMenu(menu) {
        const prompts = this._promptManager.list({enabledOnly: true});
        if (prompts.length === 0) {
            this._addMenuItem(menu, 'No prompts enabled');
            return;
        }

        prompts.forEach((prompt, index) => {
            this._addMenuItem(menu, prompt.name, {
                selected: prompt.id === this._selectedPromptId,
                accel: index < MAX_QUICK_SWITCH ? `Ctrl ${index + 1}` : null,
                onActivate: () => this._selectPrompt(prompt.id),
            });
        });
    }

    _fillProviderMenu(menu) {
        const profiles = this._providerManager.list({enabledOnly: true});
        if (profiles.length === 0) {
            this._addMenuItem(menu, 'No provider - open settings');
            return;
        }

        for (const profile of profiles) {
            this._addMenuItem(menu, profile.name, {
                selected: profile.id === this._selectedProfileId,
                onActivate: () => {
                    this._selectedProfileId = profile.id;
                    this._refreshSelectLabels();
                    this._scheduleFocusPrimary();
                },
            });
        }
    }

    // ---- composer ---------------------------------------------------------

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
            const empty = makeTemplateText(prompt
                ? 'This prompt is empty. Edit it in settings.'
                : 'No prompts yet. Add one in settings.');
            empty.add_style_class_name('promptkey-template-empty');
            this._templateBox.add_child(empty);
            return;
        }

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
                (!next || (next.type === 'text' && /^\s*\n/.test(next.value)));

            if (block && row.get_n_children() > 0)
                flushRow();
            else if (!block && rowChars > 0 && rowChars + Math.max(part.name.length + 4, BLANK_CHARS) > TEMPLATE_ROW_CHARS)
                flushRow();

            const entry = new St.Entry({
                style_class: block
                    ? 'promptkey-blank promptkey-blank-block'
                    : 'promptkey-blank',
                can_focus: true,
                hint_text: part.name,
                x_expand: block,
                y_align: Clutter.ActorAlign.CENTER,
            });
            entry.clutter_text.activatable = false;
            if (block) {
                entry.clutter_text.single_line_mode = false;
                entry.clutter_text.line_wrap = true;
            } else {
                entry.clutter_text.single_line_mode = true;
            }
            entry.clutter_text.connect('text-changed', () => this._updateRunEnabled());
            entry.clutter_text.connect('key-press-event', (_actor, event) =>
                this._handleKey(event, {entry, block}));
            row.add_child(entry);
            this._fillerEntries.push({name: part.name, entry});
            rowChars += Math.max(part.name.length + 4, BLANK_CHARS);

            if (block)
                flushRow();
        }

        if (row.get_n_children() > 0)
            this._templateBox.add_child(row);
    }

    // ---- keyboard ---------------------------------------------------------

    _handleKey(event, field) {
        const symbol = event.get_key_symbol();
        const ctrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) !== 0;

        if (symbol === Clutter.KEY_Escape) {
            if (this._menusOpen()) {
                this._closeMenus();
                return Clutter.EVENT_STOP;
            }
            if (this._closeOnEscape) {
                this.close();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        if (ctrl && isEnter(symbol)) {
            this._execute();
            return Clutter.EVENT_STOP;
        }

        if (ctrl && symbol >= Clutter.KEY_1 && symbol <= Clutter.KEY_9) {
            this._selectPromptByIndex(symbol - Clutter.KEY_1);
            return Clutter.EVENT_STOP;
        }

        if (ctrl && symbol === Clutter.KEY_comma) {
            this._showPreferences();
            return Clutter.EVENT_STOP;
        }

        // Enter in an inline blank: jump to the next blank, or run from the last one.
        if (field && !field.block && !ctrl && isEnter(symbol)) {
            const index = this._fillerEntries.findIndex(f => f.entry === field.entry);
            const next = this._fillerEntries[index + 1]?.entry;
            if (next)
                global.stage.set_key_focus(next.clutter_text);
            else
                this._execute();
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

    // ---- run --------------------------------------------------------------

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
        if (ok || this._busy)
            this._executeButton.remove_style_class_name('promptkey-button-disabled');
        else
            this._executeButton.add_style_class_name('promptkey-button-disabled');
    }

    _setStatus(text, kind = 'hint') {
        this._statusLabel.text = text;
        for (const k of ['success', 'error'])
            this._statusLabel.remove_style_class_name(`promptkey-status-${k}`);
        for (const k of ['success', 'error'])
            this._statusIcon.remove_style_class_name(`promptkey-status-icon-${k}`);

        if (kind === 'success' || kind === 'error') {
            this._statusLabel.add_style_class_name(`promptkey-status-${kind}`);
            this._statusIcon.icon_name = kind === 'success'
                ? 'object-select-symbolic'
                : 'dialog-warning-symbolic';
            this._statusIcon.add_style_class_name(`promptkey-status-icon-${kind}`);
            this._statusIcon.visible = true;
        } else {
            this._statusIcon.visible = false;
        }
    }

    _showHint() {
        const hints = ['Ctrl 1–9 switch prompt'];
        if (this._closeOnEscape)
            hints.push('Esc close');
        this._setStatus(hints.join('  ·  '));
    }

    _cancelCopyTimer() {
        if (this._copyResetId) {
            GLib.source_remove(this._copyResetId);
            this._copyResetId = 0;
        }
    }

    _cancelCopyReset() {
        this._cancelCopyTimer();
        this._copyIcon.icon_name = 'edit-copy-symbolic';
        this._copyLabel.text = 'Copy';
        this._copyButton.remove_style_class_name('promptkey-button-done');
    }

    _clearResponse() {
        this._cancelCopyReset();
        this._responseText = '';
        this._responseLabel.clutter_text.use_markup = false;
        this._responseLabel.text = '';
        this._responseLabel.remove_style_class_name('promptkey-response-error');
        this._responseBox.opacity = 255;
        this._responseBox.visible = false;
        this._copyButton.visible = false;
        this._showHint();
    }

    _scrollResponseToTop() {
        const adjustment = this._responseScroll.vadjustment ??
            this._responseScroll.vscroll?.adjustment;
        if (adjustment)
            adjustment.value = 0;
    }

    _setResponse(text, {error = false, html = false} = {}) {
        const wasVisible = this._responseBox.visible;
        this._responseLabel.remove_style_class_name('promptkey-response-error');
        if (error)
            this._responseLabel.add_style_class_name('promptkey-response-error');

        if (html && !error) {
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

        this._scrollResponseToTop();
        this._responseBox.visible = true;
        this._responseBox.remove_all_transitions();
        if (!wasVisible)
            this._responseBox.opacity = 0;
        this._responseBox.ease({
            opacity: 255,
            duration: 160,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        this._copyButton.visible = Boolean(!error && this._responseText);
    }

    _setBusy(busy) {
        this._busy = busy;
        this._executeLabel.text = busy ? 'Running' : 'Run';
        this._promptSelect.reactive = !busy;
        this._providerSelect.reactive = !busy;
        if (busy)
            this._executeButton.add_style_class_name('promptkey-button-busy');
        else
            this._executeButton.remove_style_class_name('promptkey-button-busy');

        if (this._spinner) {
            if (busy)
                this._spinner.play();
            else
                this._spinner.stop();
        }
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
        const format = this._responseFormat();
        const composed = enhancePrompt(fillPrompt(instruction, this._fillerValues()), format);

        if (!profile || !profile.enabled) {
            this._responseText = '';
            this._copyButton.visible = false;
            this._responseBox.visible = false;
            this._setStatus(profile
                ? 'Selected provider is disabled'
                : 'Add an AI provider in settings (Ctrl ,)', 'error');
            return;
        }

        const serial = ++this._runSerial;
        const started = GLib.get_monotonic_time();
        this._cancelCopyReset();
        this._setBusy(true);
        this._setStatus(`Asking ${profile.name}…`);
        if (this._responseBox.visible)
            this._responseBox.ease({opacity: 110, duration: 120});

        let response = null;
        let failure = null;
        try {
            response = await this._providerManager.complete(profile, composed);
        } catch (e) {
            failure = e;
        }

        // Window closed or a newer run started while waiting
        if (serial !== this._runSerial)
            return;

        this._setBusy(false);
        const elapsed = `${((GLib.get_monotonic_time() - started) / 1e6).toFixed(1)}s`;

        if (failure) {
            const message = failure?.message ? String(failure.message) : String(failure);
            const safe = profile.apiKey
                ? message.split(profile.apiKey).join('[redacted]')
                : message;
            this._responseText = '';
            this._setResponse(safe, {error: true});
            this._setStatus('Request failed', 'error');
            return;
        }

        this._responseText = response ?? '';
        this._setResponse(this._responseText, {html: format === 'html'});
        if (this._autoCopyResponse && this._responseText) {
            this._writeClipboard(this._responseText);
            this._setStatus(`Copied to clipboard  ·  ${elapsed}`, 'success');
        } else {
            this._setStatus(`Done  ·  ${elapsed}`, 'success');
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

        this._writeClipboard(this._responseText);
        this._cancelCopyReset();
        this._copyIcon.icon_name = 'object-select-symbolic';
        this._copyLabel.text = 'Copied';
        this._copyButton.add_style_class_name('promptkey-button-done');
        this._copyResetId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1400, () => {
            this._copyResetId = 0;
            this._cancelCopyReset();
            return GLib.SOURCE_REMOVE;
        });
    }
});
