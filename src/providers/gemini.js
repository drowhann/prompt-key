import {formatHttpError, request} from './http.js';

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Google Gemini generateContent API.
 */
export async function complete(profile, prompt) {
    if (!profile.apiKey)
        throw new Error('API key is missing for this profile.');

    const base = (profile.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');
    const model = profile.model || DEFAULT_MODEL;
    const url =
        `${base}/models/${encodeURIComponent(model)}:generateContent` +
        `?key=${encodeURIComponent(profile.apiKey)}`;

    const {status, json, text} = await request({
        method: 'POST',
        url,
        headers: {'Content-Type': 'application/json'},
        body: {
            contents: [{parts: [{text: prompt}]}],
        },
    });

    if (status < 200 || status >= 300)
        throw new Error(formatHttpError(status, json, text));

    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const content = parts.map(p => p.text ?? '').join('').trim();
    if (!content)
        throw new Error('Provider returned an empty response.');

    return content;
}

export async function testConnection(profile) {
    return complete(profile, 'Reply with exactly: ok');
}
