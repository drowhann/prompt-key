import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {PromptManager} from './src/prompts/prompt-manager.js';
import {PROVIDER_LABELS, ProviderManager} from './src/providers/provider-manager.js';
import {Storage} from './src/services/storage.js';

function providerChoices() {
    return Object.entries(PROVIDER_LABELS);
}

const PromptEditDialog = GObject.registerClass(
class PromptEditDialog extends Adw.Dialog {
    _init(parent, prompt, onSave) {
        super._init({
            title: prompt ? _('Edit Prompt') : _('New Prompt'),
            content_width: 480,
        });

        this._onSave = onSave;

        const page = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        page.add_top_bar(header);

        const cancel = new Gtk.Button({label: _('Cancel')});
        cancel.connect('clicked', () => this.close());
        header.pack_start(cancel);

        const save = new Gtk.Button({label: _('Save'), css_classes: ['suggested-action']});
        save.connect('clicked', () => {
            this._onSave({
                name: this._nameRow.get_text(),
                instruction: this._instructionView.buffer.text,
                enabled: this._enabledRow.active,
                responseFormat: this._formatSelected(),
            });
            this.close();
        });
        header.pack_end(save);

        const list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        this._nameRow = new Adw.EntryRow({title: _('Name')});
        this._nameRow.set_text(prompt?.name ?? '');
        list.append(this._nameRow);

        this._enabledRow = new Adw.SwitchRow({
            title: _('Enabled'),
            active: prompt?.enabled !== false,
        });
        list.append(this._enabledRow);

        this._formatRow = new Adw.ComboRow({title: _('Response format')});
        const formatModel = new Gtk.StringList();
        formatModel.append(_('Text'));
        formatModel.append(_('HTML'));
        this._formatRow.model = formatModel;
        this._formatRow.selected = prompt?.responseFormat === 'html' ? 1 : 0;
        list.append(this._formatRow);

        const instructionGroup = new Adw.PreferencesGroup({
            title: _('Instruction'),
            description: _('Use {{name}} placeholders for fill-in fields. No placeholders means Run only.'),
            margin_start: 12,
            margin_end: 12,
            margin_bottom: 12,
        });
        const scrolled = new Gtk.ScrolledWindow({
            min_content_height: 140,
            max_content_height: 220,
            hexpand: true,
            vexpand: true,
        });
        this._instructionView = new Gtk.TextView({
            wrap_mode: Gtk.WrapMode.WORD_CHAR,
            accepts_tab: false,
        });
        this._instructionView.buffer.text = prompt?.instruction ?? '';
        scrolled.set_child(this._instructionView);
        instructionGroup.add(scrolled);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        box.append(list);
        box.append(instructionGroup);
        page.set_content(box);

        this.set_child(page);
        this.present(parent);
    }

    _formatSelected() {
        return this._formatRow.selected === 1 ? 'html' : 'text';
    }
});

const ProfileEditDialog = GObject.registerClass(
class ProfileEditDialog extends Adw.Dialog {
    _init(parent, profile, onSave) {
        super._init({
            title: profile ? _('Edit AI Profile') : _('New AI Profile'),
            content_width: 480,
        });

        this._onSave = onSave;
        this._provider = profile?.provider || 'groq';

        const page = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        page.add_top_bar(header);

        const cancel = new Gtk.Button({label: _('Cancel')});
        cancel.connect('clicked', () => this.close());
        header.pack_start(cancel);

        const save = new Gtk.Button({label: _('Save'), css_classes: ['suggested-action']});
        save.connect('clicked', () => {
            this._onSave({
                name: this._nameRow.get_text(),
                provider: this._provider,
                apiKey: this._apiKeyRow.get_text(),
                endpoint: this._endpointRow.get_text().trim(),
                model: this._modelRow.get_text().trim(),
                enabled: this._enabledRow.active,
            });
            this.close();
        });
        header.pack_end(save);

        const list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list'],
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        this._nameRow = new Adw.EntryRow({title: _('Name')});
        this._nameRow.set_text(profile?.name ?? '');
        list.append(this._nameRow);

        const providerRow = new Adw.ComboRow({title: _('Provider')});
        const model = new Gtk.StringList();
        const choices = providerChoices();
        choices.forEach(([, label]) => model.append(label));
        providerRow.model = model;
        providerRow.selected = Math.max(0, choices.findIndex(([id]) => id === this._provider));
        providerRow.connect('notify::selected', () => {
            this._provider = choices[providerRow.selected]?.[0] ?? 'groq';
        });
        list.append(providerRow);

        this._apiKeyRow = new Adw.PasswordEntryRow({title: _('API key')});
        this._apiKeyRow.set_text(profile?.apiKey ?? '');
        list.append(this._apiKeyRow);

        this._endpointRow = new Adw.EntryRow({title: _('Endpoint (optional)')});
        this._endpointRow.set_text(profile?.endpoint ?? '');
        list.append(this._endpointRow);

        this._modelRow = new Adw.EntryRow({title: _('Model (optional)')});
        this._modelRow.set_text(profile?.model ?? '');
        list.append(this._modelRow);

        this._enabledRow = new Adw.SwitchRow({
            title: _('Enabled'),
            active: profile?.enabled !== false,
        });
        list.append(this._enabledRow);

        page.set_content(list);
        this.set_child(page);
        this.present(parent);
    }
});

export default class PromptKeyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._storage = new Storage(this._settings);
        this._promptManager = new PromptManager(this._storage);
        this._providerManager = new ProviderManager(this._storage);
        this._window = window;

        window.default_width = 700;
        window.default_height = 560;

        window.add(this._buildPromptsPage());
        window.add(this._buildProvidersPage());
        window.add(this._buildGeneralPage());
    }

    _buildPromptsPage() {
        const page = new Adw.PreferencesPage({
            title: _('Prompts'),
            icon_name: 'document-edit-symbolic',
        });

        const actions = new Adw.PreferencesGroup();
        const addBtn = new Gtk.Button({
            label: _('Add Prompt'),
            css_classes: ['suggested-action'],
            halign: Gtk.Align.START,
            margin_bottom: 6,
        });
        addBtn.connect('clicked', () => {
            new PromptEditDialog(this._window, null, fields => {
                this._promptManager.create(fields);
                this._reloadPrompts();
            });
        });
        actions.add(addBtn);
        page.add(actions);

        this._promptsGroup = new Adw.PreferencesGroup({
            title: _('Saved prompts'),
            description: _('Click a row to edit. The global open shortcut is on the General page.'),
        });
        this._promptRows = [];
        page.add(this._promptsGroup);
        this._reloadPrompts();
        return page;
    }

    _reloadPrompts() {
        for (const row of this._promptRows)
            this._promptsGroup.remove(row);
        this._promptRows = [];

        const defaultId = this._storage.getDefaultPromptId();
        for (const prompt of this._promptManager.list()) {
            const row = new Adw.ActionRow({
                title: prompt.name,
                subtitle: [
                    prompt.enabled ? _('Enabled') : _('Disabled'),
                    prompt.responseFormat === 'html' ? _('HTML') : _('Text'),
                    prompt.id === defaultId ? _('Default') : null,
                ].filter(Boolean).join(' · '),
                activatable: true,
            });

            row.connect('activated', () => {
                new PromptEditDialog(this._window, prompt, fields => {
                    this._promptManager.update(prompt.id, fields);
                    this._reloadPrompts();
                });
            });

            const defaultBtn = new Gtk.Button({
                icon_name: prompt.id === defaultId
                    ? 'starred-symbolic'
                    : 'non-starred-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Set as default'),
            });
            defaultBtn.connect('clicked', () => {
                this._promptManager.setDefault(prompt.id);
                this._reloadPrompts();
            });
            row.add_suffix(defaultBtn);

            const dupBtn = new Gtk.Button({
                icon_name: 'edit-copy-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Duplicate'),
            });
            dupBtn.connect('clicked', () => {
                this._promptManager.duplicate(prompt.id);
                this._reloadPrompts();
            });
            row.add_suffix(dupBtn);

            const deleteBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Delete'),
                css_classes: ['destructive-action'],
            });
            deleteBtn.connect('clicked', () => {
                this._promptManager.remove(prompt.id);
                this._reloadPrompts();
            });
            row.add_suffix(deleteBtn);

            this._promptsGroup.add(row);
            this._promptRows.push(row);
        }
    }

    _buildProvidersPage() {
        const page = new Adw.PreferencesPage({
            title: _('AI Providers'),
            icon_name: 'network-server-symbolic',
        });

        const actions = new Adw.PreferencesGroup();
        const addBtn = new Gtk.Button({
            label: _('Add Profile'),
            css_classes: ['suggested-action'],
            halign: Gtk.Align.START,
            margin_bottom: 6,
        });
        addBtn.connect('clicked', () => {
            new ProfileEditDialog(this._window, null, fields => {
                this._providerManager.create(fields);
                this._reloadProfiles();
            });
        });
        actions.add(addBtn);
        page.add(actions);

        this._profilesGroup = new Adw.PreferencesGroup({
            title: _('Profiles'),
            description: _('API keys are stored locally in GSettings and only sent to the configured provider.'),
        });
        this._profileRows = [];
        page.add(this._profilesGroup);
        this._reloadProfiles();
        return page;
    }

    _reloadProfiles() {
        for (const row of this._profileRows)
            this._profilesGroup.remove(row);
        this._profileRows = [];

        const defaultId = this._storage.getDefaultProfileId();
        for (const profile of this._providerManager.list()) {
            const label = PROVIDER_LABELS[profile.provider] ?? profile.provider;
            const row = new Adw.ActionRow({
                title: profile.name,
                subtitle: [
                    label,
                    profile.model || _('Default model'),
                    profile.enabled ? _('Enabled') : _('Disabled'),
                    profile.id === defaultId ? _('Default') : null,
                ].filter(Boolean).join(' · '),
                activatable: true,
            });

            row.connect('activated', () => {
                new ProfileEditDialog(this._window, profile, fields => {
                    this._providerManager.update(profile.id, fields);
                    this._reloadProfiles();
                });
            });

            const testBtn = new Gtk.Button({
                label: _('Test'),
                valign: Gtk.Align.CENTER,
            });
            testBtn.connect('clicked', async () => {
                testBtn.sensitive = false;
                testBtn.label = _('…');
                try {
                    await this._providerManager.testConnection(profile);
                    this._toast(_('Connection successful'));
                } catch (e) {
                    const message = e?.message ? String(e.message) : String(e);
                    const safe = profile.apiKey
                        ? message.split(profile.apiKey).join('[redacted]')
                        : message;
                    this._toast(_('Connection failed: %s').format(safe));
                } finally {
                    testBtn.sensitive = true;
                    testBtn.label = _('Test');
                }
            });
            row.add_suffix(testBtn);

            const defaultBtn = new Gtk.Button({
                icon_name: profile.id === defaultId
                    ? 'starred-symbolic'
                    : 'non-starred-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Set as default'),
            });
            defaultBtn.connect('clicked', () => {
                this._providerManager.setDefault(profile.id);
                this._reloadProfiles();
            });
            row.add_suffix(defaultBtn);

            const deleteBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                tooltip_text: _('Delete'),
                css_classes: ['destructive-action'],
            });
            deleteBtn.connect('clicked', () => {
                this._providerManager.remove(profile.id);
                this._reloadProfiles();
            });
            row.add_suffix(deleteBtn);

            this._profilesGroup.add(row);
            this._profileRows.push(row);
        }
    }

    _buildGeneralPage() {
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'preferences-system-symbolic',
        });

        const shortcutGroup = new Adw.PreferencesGroup({
            title: _('Shortcut'),
            description: _(
                'One global shortcut opens PromptKey. First open uses the first enabled prompt; later opens restore the last prompt you selected.'
            ),
        });
        this._shortcutRow = new Adw.EntryRow({
            title: _('Open shortcut (GTK accel syntax)'),
        });
        const current = this._settings.get_strv('open-hotkey');
        this._shortcutRow.set_text(current[0] ?? '');
        this._shortcutRow.connect('changed', () => {
            const accel = this._shortcutRow.get_text().trim();
            this._settings.set_strv('open-hotkey', accel ? [accel] : []);
        });
        shortcutGroup.add(this._shortcutRow);

        const group = new Adw.PreferencesGroup({
            title: _('Prompt window'),
        });

        const escapeRow = new Adw.SwitchRow({
            title: _('Close on Escape'),
            subtitle: _('Dismiss the prompt window when Escape is pressed'),
        });
        this._settings.bind(
            'close-on-escape',
            escapeRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        group.add(escapeRow);

        const autoCopyRow = new Adw.SwitchRow({
            title: _('Auto-copy response'),
            subtitle: _('Copy the AI response to the clipboard when it arrives'),
            active: true,
        });
        this._settings.bind(
            'auto-copy-response',
            autoCopyRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        group.add(autoCopyRow);

        const help = new Adw.PreferencesGroup({
            title: _('Tips'),
            description: _(
                'Example shortcut: &lt;Super&gt;&lt;Alt&gt;a. Fill {{placeholders}} then Ctrl+Enter to run. Escape closes the window.'
            ),
        });

        page.add(shortcutGroup);
        page.add(group);
        page.add(help);
        return page;
    }

    _toast(title) {
        if (this._window?.add_toast) {
            this._window.add_toast(new Adw.Toast({title, timeout: 4}));
        }
    }
}
