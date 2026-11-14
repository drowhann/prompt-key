import GLib from 'gi://GLib';

export const DEFAULT_PROMPTS = [
    {
        id: 'default',
        name: 'Default',
        instruction: 'Help me with the following request.\n\n{{request}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'make-formal',
        name: 'Make Formal',
        instruction: 'Rewrite the following text in a formal tone.\n\n{{text}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'check-grammar',
        name: 'Check Grammar',
        instruction: 'Check the grammar and spelling of the following text and provide a corrected version.\n\n{{text}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'true-or-false',
        name: 'True or False',
        instruction: 'Determine whether the following statement is true or false. Explain briefly.\n\n{{statement}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'simplify',
        name: 'Simplify',
        instruction: 'Simplify the following text so it is easier to understand.\n\n{{text}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'summarize',
        name: 'Summarize',
        instruction: 'Summarize the following text concisely.\n\n{{text}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'translate',
        name: 'Translate',
        instruction: 'Translate the following text to {{language}}.\n\n{{text}}',
        enabled: true,
        responseFormat: 'text',
    },
    {
        id: 'explain',
        name: 'Explain',
        instruction: 'Explain {{concept}} clearly and simply.',
        enabled: true,
        responseFormat: 'text',
    },
];

/**
 * @param {string} raw
 * @param {*} fallback
 */
function parseJson(raw, fallback) {
    if (!raw)
        return fallback;
    try {
        const value = JSON.parse(raw);
        return value ?? fallback;
    } catch (_e) {
        return fallback;
    }
}

export class Storage {
    /**
     * @param {import('gi://Gio').Settings} settings
     */
    constructor(settings) {
        this._settings = settings;
        this.ensureDefaults();
    }

    ensureDefaults() {
        const raw = this._settings.get_string('prompts');
        if (!raw || raw.trim() === '') {
            this._settings.set_string('prompts', JSON.stringify(DEFAULT_PROMPTS));
        } else {
            // Adopt {{filler}} templates on built-in prompts that still lack placeholders.
            const prompts = parseJson(raw, null);
            if (Array.isArray(prompts) && prompts.length > 0) {
                const defaultsById = Object.fromEntries(DEFAULT_PROMPTS.map(p => [p.id, p]));
                let changed = false;
                const next = prompts.map(p => {
                    const def = defaultsById[p.id];
                    if (!def || /\{\{/.test(p.instruction ?? ''))
                        return p;
                    changed = true;
                    return {...p, instruction: def.instruction};
                });
                if (changed)
                    this.setPrompts(next);
            }
        }
        if (!this._settings.get_string('default-prompt-id'))
            this._settings.set_string('default-prompt-id', 'default');
    }

    getPrompts() {
        const prompts = parseJson(this._settings.get_string('prompts'), null);
        if (!Array.isArray(prompts) || prompts.length === 0)
            return DEFAULT_PROMPTS.map(p => ({...p}));
        return prompts;
    }

    setPrompts(prompts) {
        this._settings.set_string('prompts', JSON.stringify(prompts));
    }

    getProfiles() {
        return parseJson(this._settings.get_string('ai-profiles'), []);
    }

    setProfiles(profiles) {
        this._settings.set_string('ai-profiles', JSON.stringify(profiles));
    }

    getDefaultPromptId() {
        return this._settings.get_string('default-prompt-id');
    }

    setDefaultPromptId(id) {
        this._settings.set_string('default-prompt-id', id ?? '');
    }

    getLastPromptId() {
        return this._settings.get_string('last-prompt-id');
    }

    setLastPromptId(id) {
        this._settings.set_string('last-prompt-id', id ?? '');
    }

    getDefaultProfileId() {
        return this._settings.get_string('default-profile-id');
    }

    setDefaultProfileId(id) {
        this._settings.set_string('default-profile-id', id ?? '');
    }

    getCloseOnEscape() {
        return this._settings.get_boolean('close-on-escape');
    }

    getAutoCopyResponse() {
        return this._settings.get_boolean('auto-copy-response');
    }

    generateId(prefix = 'id') {
        return `${prefix}-${GLib.uuid_string_random()}`;
    }
}
