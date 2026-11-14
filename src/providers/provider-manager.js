import * as Gemini from './gemini.js';
import * as Groq from './groq.js';
import * as OpenAI from './openai.js';
import * as OpenAICompatible from './openai-compatible.js';

const PROVIDERS = {
    gemini: Gemini,
    groq: Groq,
    openai: OpenAI,
    'openai-compatible': OpenAICompatible,
};

export const PROVIDER_LABELS = {
    gemini: 'Google Gemini',
    groq: 'Groq',
    openai: 'OpenAI',
    'openai-compatible': 'OpenAI Compatible',
};

export class ProviderManager {
    /**
     * @param {import('../services/storage.js').Storage} storage
     */
    constructor(storage) {
        this._storage = storage;
    }

    list({enabledOnly = false} = {}) {
        const profiles = this._storage.getProfiles();
        if (enabledOnly)
            return profiles.filter(p => p.enabled);
        return profiles;
    }

    getById(id) {
        return this._storage.getProfiles().find(p => p.id === id) ?? null;
    }

    getDefault() {
        const id = this._storage.getDefaultProfileId();
        const profiles = this.list({enabledOnly: true});
        return profiles.find(p => p.id === id) ?? profiles[0] ?? null;
    }

    create(fields) {
        const profiles = this._storage.getProfiles();
        const profile = {
            id: this._storage.generateId('profile'),
            name: fields.name?.trim() || 'Untitled Profile',
            provider: fields.provider || 'groq',
            apiKey: fields.apiKey || '',
            endpoint: fields.endpoint || '',
            model: fields.model || '',
            enabled: fields.enabled !== false,
        };
        profiles.push(profile);
        this._storage.setProfiles(profiles);

        if (!this._storage.getDefaultProfileId())
            this._storage.setDefaultProfileId(profile.id);

        return profile;
    }

    update(id, patch) {
        const profiles = this._storage.getProfiles();
        const index = profiles.findIndex(p => p.id === id);
        if (index < 0)
            return null;

        profiles[index] = {
            ...profiles[index],
            ...patch,
            id: profiles[index].id,
        };
        this._storage.setProfiles(profiles);
        return profiles[index];
    }

    remove(id) {
        const profiles = this._storage.getProfiles().filter(p => p.id !== id);
        this._storage.setProfiles(profiles);
        if (this._storage.getDefaultProfileId() === id) {
            const next = profiles.find(p => p.enabled) ?? profiles[0];
            this._storage.setDefaultProfileId(next?.id ?? '');
        }
    }

    setDefault(id) {
        if (!this.getById(id))
            return;
        this._storage.setDefaultProfileId(id);
    }

    /**
     * @param {object} profile
     * @param {string} prompt
     */
    async complete(profile, prompt) {
        const impl = PROVIDERS[profile.provider];
        if (!impl)
            throw new Error(`Unsupported provider: ${profile.provider}`);
        return impl.complete(profile, prompt);
    }

    async testConnection(profile) {
        const impl = PROVIDERS[profile.provider];
        if (!impl)
            throw new Error(`Unsupported provider: ${profile.provider}`);
        return impl.testConnection(profile);
    }
}
