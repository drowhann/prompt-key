import * as OpenAI from './openai.js';

/**
 * OpenAI-compatible endpoints (custom base URL / full chat completions URL).
 */
export async function complete(profile, prompt) {
    if (!profile.endpoint)
        throw new Error('Endpoint is required for OpenAI-compatible profiles.');

    return OpenAI.complete(profile, prompt);
}

export async function testConnection(profile) {
    return complete(profile, 'Reply with exactly: ok');
}
