#!/usr/bin/env gjs -m
import GLib from 'gi://GLib';
import * as Groq from '../src/providers/groq.js';

const apiKey = GLib.getenv('GROQ_API_KEY');
if (!apiKey) {
    printerr('Set GROQ_API_KEY to run this test');
    imports.system.exit(1);
}

const profile = {
    id: 'test',
    name: 'Groq Test',
    provider: 'groq',
    apiKey,
    endpoint: '',
    model: GLib.getenv('GROQ_MODEL') || 'openai/gpt-oss-20b',
    enabled: true,
};

const loop = new GLib.MainLoop(null, false);

(async () => {
    try {
        const reply = await Groq.complete(
            profile,
            'Reply with exactly the single word: pong'
        );
        print(`Groq reply: ${reply}`);
        if (!reply.toLowerCase().includes('pong'))
            throw new Error('Unexpected reply content');
        print('groq test passed');
        loop.quit();
    } catch (e) {
        printerr(e);
        imports.system.exit(1);
    }
})();

loop.run();
