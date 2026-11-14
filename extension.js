import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {PromptManager} from './src/prompts/prompt-manager.js';
import {ProviderManager} from './src/providers/provider-manager.js';
import {Storage} from './src/services/storage.js';
import {PromptWindow} from './src/ui/prompt-window.js';

export default class PromptKeyExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._storage = new Storage(this._settings);
        this._promptManager = new PromptManager(this._storage);
        this._providerManager = new ProviderManager(this._storage);
        this._window = null;
        this._windowClosedId = 0;
        this._hotkeyBound = false;

        this._registerKeybinding();
        this._hotkeyChangedId = this._settings.connect('changed::open-hotkey', () => {
            this._unregisterKeybinding();
            this._registerKeybinding();
        });
    }

    disable() {
        if (this._hotkeyChangedId) {
            this._settings.disconnect(this._hotkeyChangedId);
            this._hotkeyChangedId = 0;
        }

        this._unregisterKeybinding();
        this._destroyWindow();

        this._promptManager = null;
        this._providerManager = null;
        this._storage = null;
        this._settings = null;
    }

    _destroyWindow() {
        if (!this._window)
            return;

        if (this._windowClosedId) {
            this._window.disconnect(this._windowClosedId);
            this._windowClosedId = 0;
        }

        this._window.destroy();
        this._window = null;
    }

    _unregisterKeybinding() {
        if (!this._hotkeyBound)
            return;
        try {
            Main.wm.removeKeybinding('open-hotkey');
        } catch (_e) {
            // already removed
        }
        this._hotkeyBound = false;
    }

    _registerKeybinding() {
        const accel = this._settings.get_strv('open-hotkey');
        if (!accel?.length)
            return;

        try {
            Main.wm.addKeybinding(
                'open-hotkey',
                this._settings,
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                () => this._openPromptWindow()
            );
            this._hotkeyBound = true;
        } catch (e) {
            console.warn(`PromptKey: failed to bind open shortcut: ${e}`);
            Main.notify(
                'PromptKey',
                'Could not register the open shortcut. It may conflict with another binding.'
            );
        }
    }

    _resolvePromptId() {
        const enabled = this._promptManager.list({enabledOnly: true});
        if (enabled.length === 0)
            return null;

        const lastId = this._storage.getLastPromptId();
        if (lastId && enabled.some(p => p.id === lastId))
            return lastId;

        return enabled[0].id;
    }

    _openPromptWindow() {
        this._destroyWindow();

        const promptId = this._resolvePromptId();

        this._window = new PromptWindow({
            promptManager: this._promptManager,
            providerManager: this._providerManager,
            initialPromptId: promptId,
            closeOnEscape: this._storage.getCloseOnEscape(),
            autoCopyResponse: this._storage.getAutoCopyResponse(),
            onPromptSelected: id => this._storage.setLastPromptId(id),
            openPreferences: () => this.openPreferences(),
        });

        this._windowClosedId = this._window.connect('closed', () => {
            this._windowClosedId = 0;
            this._window = null;
        });

        this._window.open();
    }
}
