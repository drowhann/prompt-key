export class PromptManager {
    /**
     * @param {import('../services/storage.js').Storage} storage
     */
    constructor(storage) {
        this._storage = storage;
    }

    list({enabledOnly = false} = {}) {
        const prompts = this._storage.getPrompts();
        if (enabledOnly)
            return prompts.filter(p => p.enabled);
        return prompts;
    }

    getById(id) {
        return this._storage.getPrompts().find(p => p.id === id) ?? null;
    }

    getDefault() {
        const id = this._storage.getDefaultPromptId();
        const prompts = this.list({enabledOnly: true});
        return prompts.find(p => p.id === id) ?? prompts[0] ?? null;
    }

    create({name, instruction, enabled = true, responseFormat = 'text'}) {
        const prompts = this._storage.getPrompts();
        const prompt = {
            id: this._storage.generateId('prompt'),
            name: name?.trim() || 'Untitled',
            instruction: instruction ?? '',
            enabled: Boolean(enabled),
            responseFormat: responseFormat === 'html' ? 'html' : 'text',
        };
        prompts.push(prompt);
        this._storage.setPrompts(prompts);
        return prompt;
    }

    update(id, patch) {
        const prompts = this._storage.getPrompts();
        const index = prompts.findIndex(p => p.id === id);
        if (index < 0)
            return null;

        const next = {
            ...prompts[index],
            ...patch,
            id: prompts[index].id,
        };
        delete next.shortcut;
        prompts[index] = next;
        this._storage.setPrompts(prompts);
        return prompts[index];
    }

    remove(id) {
        const prompts = this._storage.getPrompts().filter(p => p.id !== id);
        this._storage.setPrompts(prompts);
        if (this._storage.getDefaultPromptId() === id) {
            const next = prompts.find(p => p.enabled) ?? prompts[0];
            this._storage.setDefaultPromptId(next?.id ?? '');
        }
        if (this._storage.getLastPromptId() === id) {
            const next = prompts.find(p => p.enabled) ?? prompts[0];
            this._storage.setLastPromptId(next?.id ?? '');
        }
    }

    duplicate(id) {
        const source = this.getById(id);
        if (!source)
            return null;

        return this.create({
            name: `${source.name} (copy)`,
            instruction: source.instruction,
            enabled: source.enabled,
            responseFormat: source.responseFormat === 'html' ? 'html' : 'text',
        });
    }

    setDefault(id) {
        if (!this.getById(id))
            return;
        this._storage.setDefaultPromptId(id);
    }
}
