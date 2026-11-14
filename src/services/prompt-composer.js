const FILLER_RE = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

/**
 * Unique filler names in appearance order from `{{name}}` placeholders.
 * @param {string} instruction
 * @returns {string[]}
 */
export function extractFillers(instruction) {
    const names = [];
    const seen = new Set();
    const text = instruction ?? '';
    FILLER_RE.lastIndex = 0;
    let match;
    while ((match = FILLER_RE.exec(text)) !== null) {
        const name = match[1];
        if (seen.has(name))
            continue;
        seen.add(name);
        names.push(name);
    }
    return names;
}

/**
 * Split an instruction into text and filler segments for inline UI.
 * @param {string} instruction
 * @returns {Array<{type: 'text', value: string} | {type: 'filler', name: string}>}
 */
export function parseTemplate(instruction) {
    const parts = [];
    const text = instruction ?? '';
    FILLER_RE.lastIndex = 0;
    let last = 0;
    let match;
    while ((match = FILLER_RE.exec(text)) !== null) {
        if (match.index > last)
            parts.push({type: 'text', value: text.slice(last, match.index)});
        parts.push({type: 'filler', name: match[1]});
        last = match.index + match[0].length;
    }
    if (last < text.length)
        parts.push({type: 'text', value: text.slice(last)});
    return parts;
}

/**
 * Replace `{{name}}` placeholders with provided values.
 * @param {string} instruction
 * @param {Record<string, string>} values
 * @returns {string}
 */
export function fillPrompt(instruction, values = {}) {
    const text = instruction ?? '';
    return text
        .replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_m, name) => values[name] ?? '')
        .trim();
}

/**
 * @param {string} instruction
 * @param {Record<string, string>} values
 * @returns {string[]} Filler names that are missing or blank
 */
export function missingFillers(instruction, values = {}) {
    return extractFillers(instruction).filter(name => !(values[name] ?? '').trim());
}

/**
 * Wrap the filled user prompt with format requirements and quality guidance.
 * @param {string} userPrompt
 * @param {'text'|'html'} format
 * @returns {string}
 */
export function enhancePrompt(userPrompt, format = 'text') {
    const body = (userPrompt ?? '').trim();
    const formatBlock = format === 'html'
        ? [
            'Required output format: HTML.',
            'Return an HTML fragment only. No markdown, no code fences, no commentary outside tags.',
            'Use semantic tags as needed: <p>, <ul>, <ol>, <li>, <strong>, <em>, <code>, <pre>, <h2>, <h3>, <br>.',
            'Do not wrap the answer in <html>, <head>, or <body>.',
        ].join('\n')
        : [
            'Required output format: plain text.',
            'Return plain text only. Do not use HTML tags or markdown code fences.',
        ].join('\n');

    return [
        'You are a careful assistant. Follow the user request exactly and produce a clear, high-quality answer.',
        '',
        'User request:',
        body,
        '',
        formatBlock,
    ].join('\n');
}

function decodeEntities(s) {
    return s
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&mdash;/gi, '--')
        .replace(/&ndash;/gi, '-')
        .replace(/&hellip;/gi, '...')
        .replace(/&#(\d+);/g, (_m, n) => {
            try {
                return String.fromCodePoint(Number(n));
            } catch (_e) {
                return '';
            }
        })
        .replace(/&#x([0-9a-f]+);/gi, (_m, h) => {
            try {
                return String.fromCodePoint(parseInt(h, 16));
            } catch (_e) {
                return '';
            }
        });
}

function escapePango(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Drop unpaired inline markers so set_markup does not fail.
 * @param {string} s
 */
function balanceInlineMarkers(s) {
    const pairs = [
        ['[[B]]', '[[/B]]'],
        ['[[I]]', '[[/I]]'],
        ['[[TT]]', '[[/TT]]'],
    ];
    let out = s;
    for (const [open, close] of pairs) {
        let depth = 0;
        let result = '';
        let i = 0;
        while (i < out.length) {
            if (out.startsWith(open, i)) {
                depth += 1;
                result += open;
                i += open.length;
            } else if (out.startsWith(close, i)) {
                if (depth > 0) {
                    depth -= 1;
                    result += close;
                }
                i += close.length;
            } else {
                result += out[i];
                i += 1;
            }
        }
        // Close any still-open markers
        while (depth-- > 0)
            result += close;
        out = result;
    }
    return out;
}

/**
 * Convert a modest HTML fragment to Pango markup for St.Label display.
 * @param {string} html
 * @returns {string}
 */
export function htmlToPango(html) {
    let s = (html ?? '').trim();

    // Models often wrap HTML in fences
    s = s.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');

    s = s.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    s = s.replace(/<!--[\s\S]*?-->/g, '');
    s = s.replace(/<\s*\/?\s*(html|head|body|meta|link)(\s[^>]*)?>/gi, '');

    s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
    s = s.replace(/<\s*hr\s*\/?\s*>/gi, '\n---\n');

    s = s.replace(/<\s*h[1-6](\s[^>]*)?>/gi, '\n[[B]]');
    s = s.replace(/<\s*\/\s*h[1-6]\s*>/gi, '[[/B]]\n\n');

    s = s.replace(/<\s*\/\s*p\s*>/gi, '\n\n');
    s = s.replace(/<\s*p(\s[^>]*)?>/gi, '');

    s = s.replace(/<\s*\/\s*div\s*>/gi, '\n');
    s = s.replace(/<\s*div(\s[^>]*)?>/gi, '');

    s = s.replace(/<\s*(ul|ol)(\s[^>]*)?>/gi, '\n');
    s = s.replace(/<\s*\/\s*(ul|ol)\s*>/gi, '\n');
    s = s.replace(/<\s*li(\s[^>]*)?>/gi, '• ');
    s = s.replace(/<\s*\/\s*li\s*>/gi, '\n');

    s = s.replace(/<\s*\/\s*tr\s*>/gi, '\n');
    s = s.replace(/<\s*t[dh](\s[^>]*)?>/gi, ' ');
    s = s.replace(/<\s*\/\s*t[dh]\s*>/gi, ' ');
    s = s.replace(/<\s*\/?\s*t(?:able|head|body|r)(\s[^>]*)?>/gi, '');

    // Allow attributes on inline tags (e.g. <strong class="x">)
    s = s.replace(/<\s*(strong|b)(\s[^>]*)?>/gi, '[[B]]');
    s = s.replace(/<\s*\/\s*(strong|b)\s*>/gi, '[[/B]]');
    s = s.replace(/<\s*(em|i)(\s[^>]*)?>/gi, '[[I]]');
    s = s.replace(/<\s*\/\s*(em|i)\s*>/gi, '[[/I]]');
    s = s.replace(/<\s*code(\s[^>]*)?>/gi, '[[TT]]');
    s = s.replace(/<\s*\/\s*code\s*>/gi, '[[/TT]]');
    s = s.replace(/<\s*pre(\s[^>]*)?>/gi, '\n[[TT]]');
    s = s.replace(/<\s*\/\s*pre\s*>/gi, '[[/TT]]\n');

    // Keep link text, drop the tag
    s = s.replace(/<\s*a(\s[^>]*)?>/gi, '');
    s = s.replace(/<\s*\/\s*a\s*>/gi, '');

    // Drop anything else tagged
    s = s.replace(/<[^>]+>/g, '');

    s = decodeEntities(s);
    s = balanceInlineMarkers(s);
    s = escapePango(s);

    s = s
        .replace(/\[\[B\]\]/g, '<b>')
        .replace(/\[\[\/B\]\]/g, '</b>')
        .replace(/\[\[I\]\]/g, '<i>')
        .replace(/\[\[\/I\]\]/g, '</i>')
        .replace(/\[\[TT\]\]/g, '<tt>')
        .replace(/\[\[\/TT\]\]/g, '</tt>');

    return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * @param {string} composed
 * @returns {boolean}
 */
export function isExecutable(composed) {
    return Boolean(composed && composed.trim());
}
