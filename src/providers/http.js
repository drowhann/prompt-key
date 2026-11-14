import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');

let _session = null;

function getSession() {
    if (!_session)
        _session = new Soup.Session({timeout: 60});
    return _session;
}

/**
 * @param {object} options
 * @param {string} options.method
 * @param {string} options.url
 * @param {Record<string, string>} [options.headers]
 * @param {object|string} [options.body]
 * @returns {Promise<{status: number, text: string, json: *}>}
 */
export async function request({method, url, headers = {}, body = null}) {
    const message = Soup.Message.new(method, url);
    if (!message)
        throw new Error(`Invalid URL: ${url}`);

    for (const [key, value] of Object.entries(headers))
        message.request_headers.append(key, value);

    if (body !== null) {
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        const bytes = GLib.Bytes.new(encoder.encode(payload));
        message.set_request_body_from_bytes('application/json', bytes);
    }

    const session = getSession();
    const responseBytes = await session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null
    );

    const status = message.get_status();
    const data = responseBytes?.get_data() ?? null;
    const text = data ? decoder.decode(data) : '';

    let json = null;
    if (text) {
        try {
            json = JSON.parse(text);
        } catch (_e) {
            json = null;
        }
    }

    return {status, text, json};
}

/**
 * Extract a readable error message from a provider response.
 */
export function formatHttpError(status, json, text) {
    const detail =
        json?.error?.message ||
        json?.error?.status ||
        json?.message ||
        text?.slice(0, 300) ||
        'Unknown error';
    return `HTTP ${status}: ${detail}`;
}
