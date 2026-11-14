#!/usr/bin/env gjs -m
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const apiKey = GLib.getenv('GROQ_API_KEY');
if (!apiKey) {
    printerr('Set GROQ_API_KEY');
    imports.system.exit(1);
}

const schemaDir = GLib.getenv('GSETTINGS_SCHEMA_DIR');
if (schemaDir) {
    // Ensure compiled schemas are visible when running before session reload
}

const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.promptkey'});

const profile = {
    id: 'groq-default',
    name: 'Groq',
    provider: 'groq',
    apiKey,
    endpoint: '',
    model: GLib.getenv('GROQ_MODEL') || 'openai/gpt-oss-20b',
    enabled: true,
};

settings.set_string('ai-profiles', JSON.stringify([profile]));
settings.set_string('default-profile-id', profile.id);
print('Seeded Groq profile as default');
