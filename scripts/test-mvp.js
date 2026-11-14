#!/usr/bin/env gjs -m
/**
 * Headless MVP checks: composition, storage defaults, Groq execute path.
 */
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {fillPrompt, isExecutable} from '../src/services/prompt-composer.js';
import {DEFAULT_PROMPTS, Storage} from '../src/services/storage.js';
import {PromptManager} from '../src/prompts/prompt-manager.js';
import {ProviderManager} from '../src/providers/provider-manager.js';

function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}

const schemaDir = GLib.getenv('GSETTINGS_SCHEMA_DIR');
assert(schemaDir, 'GSETTINGS_SCHEMA_DIR required');

const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.promptkey'});
const storage = new Storage(settings);
const prompts = new PromptManager(storage);
const providers = new ProviderManager(storage);

assert(storage.getPrompts().length >= 8, 'default prompts seeded');
assert(prompts.getById('make-formal')?.name === 'Make Formal', 'formal prompt');
assert(fillPrompt('Say {{x}}', {x: 'hi'}) === 'Say hi', 'composer');
assert(!isExecutable(''), 'empty guard');

const created = prompts.create({
    name: 'Custom',
    instruction: 'Say hi',
    enabled: true,
});
assert(prompts.getById(created.id)?.name === 'Custom', 'create prompt');
const dup = prompts.duplicate(created.id);
assert(dup?.name.includes('copy'), 'duplicate prompt');
prompts.remove(dup.id);
prompts.remove(created.id);

const profile = providers.getDefault();
assert(profile?.provider === 'groq', 'default groq profile');
assert(profile?.apiKey, 'api key present locally');

const loop = new GLib.MainLoop(null, false);
(async () => {
    try {
        const composed = fillPrompt(
            DEFAULT_PROMPTS.find(p => p.id === 'simplify').instruction,
            {text: 'The quick brown fox jumps over the lazy dog repeatedly in a very verbose manner.'}
        );
        const reply = await providers.complete(profile, composed);
        assert(reply && reply.length > 0, 'non-empty AI response');
        print(`AI response preview: ${reply.slice(0, 120).replace(/\n/g, ' ')}…`);
        print('mvp tests passed');
        loop.quit();
    } catch (e) {
        printerr(e);
        imports.system.exit(1);
    }
})();
loop.run();
