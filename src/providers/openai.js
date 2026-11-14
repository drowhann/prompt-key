import {formatHttpError, request} from './http.js';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * OpenAI Chat Completions API.
 * @param {object} profile
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function complete(profile, prompt) {
    const endpoint = (profile.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');
    const url = endpoint.endsWith('/chat/completions')
        ? endpoint
        : `${endpoint}/chat/completions`;
    const model = profile.model || DEFAULT_MODEL;

    if (!profile.apiKey)
        throw new Error('API key is missing for this profile.');

    const {status, json, text} = await request({
        method: 'POST',
        url,
        headers: {
            'Authorization': `Bearer ${profile.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: {
            model,
            messages: [{role: 'user', content: prompt}],
            temperature: 0.7,
        },
    });

    if (status < 200 || status >= 300)
        throw new Error(formatHttpError(status, json, text));

    const content = json?.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('Provider returned an empty response.');

    return String(content).trim();
}

export async function testConnection(profile) {
    return complete(profile, 'Reply with exactly: ok');
}
