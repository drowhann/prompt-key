#!/usr/bin/env gjs -m
import GLib from 'gi://GLib';
import {request} from '../src/providers/http.js';

const apiKey = GLib.getenv('GROQ_API_KEY');
if (!apiKey) {
    printerr('Set GROQ_API_KEY');
    imports.system.exit(1);
}

const loop = new GLib.MainLoop(null, false);

(async () => {
    try {
        const {status, json, text} = await request({
            method: 'GET',
            url: 'https://api.groq.com/openai/v1/models',
            headers: {Authorization: `Bearer ${apiKey}`},
        });
        if (status < 200 || status >= 300) {
            printerr(`HTTP ${status}: ${text}`);
            imports.system.exit(1);
        }
        for (const m of json.data ?? [])
            print(m.id);
        loop.quit();
    } catch (e) {
        printerr(e);
        imports.system.exit(1);
    }
})();

loop.run();
