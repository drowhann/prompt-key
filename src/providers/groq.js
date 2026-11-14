import * as OpenAI from './openai.js';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

/**
 * Groq uses an OpenAI-compatible Chat Completions API.
 */
export async function complete(profile, prompt) {
    return OpenAI.complete({
        ...profile,
        endpoint: profile.endpoint || GROQ_ENDPOINT,
        model: profile.model || DEFAULT_MODEL,
    }, prompt);
}

export async function testConnection(profile) {
    return complete(profile, 'Reply with exactly: ok');
}
