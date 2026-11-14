#!/usr/bin/env gjs -m
import {
    enhancePrompt,
    extractFillers,
    fillPrompt,
    htmlToPango,
    isExecutable,
    missingFillers,
    parseTemplate,
} from '../src/services/prompt-composer.js';

function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}

assert(JSON.stringify(extractFillers('Add {{this}} and {{that}}.')) === JSON.stringify(['this', 'that']), 'extract order');
assert(JSON.stringify(extractFillers('{{a}} then {{a}} again')) === JSON.stringify(['a']), 'unique');
assert(extractFillers('no fillers').length === 0, 'none');

const parts = parseTemplate('Add {{this}} and {{that}}.');
assert(parts.length === 5, 'template parts count');
assert(parts[0].type === 'text' && parts[0].value === 'Add ', 'text before');
assert(parts[1].type === 'filler' && parts[1].name === 'this', 'filler this');
assert(parts[2].type === 'text' && parts[2].value === ' and ', 'text mid');
assert(parts[3].type === 'filler' && parts[3].name === 'that', 'filler that');
assert(parts[4].type === 'text' && parts[4].value === '.', 'text after');

assert(fillPrompt('Add {{this}} and {{that}}.', {this: 'A', that: 'B'}) === 'Add A and B.', 'fill');
assert(fillPrompt('  Hello  ', {}) === 'Hello', 'no fillers trim');
assert(fillPrompt('Say {{x}}', {}) === 'Say', 'missing becomes empty');

assert(JSON.stringify(missingFillers('{{a}} {{b}}', {a: '1'})) === JSON.stringify(['b']), 'missing');
assert(missingFillers('plain', {}).length === 0, 'no missing when none');

const enhancedText = enhancePrompt('Say hi', 'text');
assert(enhancedText.includes('User request:\nSay hi'), 'enhance body');
assert(enhancedText.includes('plain text'), 'enhance text format');
assert(enhancePrompt('x', 'html').includes('HTML'), 'enhance html format');

const pango = htmlToPango('<p>Hello <strong class="x">world</strong></p><ul><li>One</li></ul>');
assert(pango.includes('<b>world</b>'), 'html bold');
assert(pango.includes('• One'), 'html list');
assert(!pango.includes('<p>'), 'html p stripped');

const fenced = htmlToPango('```html\n<h2>Title</h2><p>Body <em>here</em></p>\n```');
assert(fenced.includes('<b>Title</b>'), 'html heading');
assert(fenced.includes('<i>here</i>'), 'html em');

const unclosed = htmlToPango('<p>Hi <strong>there');
assert(unclosed.includes('<b>there</b>'), 'html auto-close');
assert(!unclosed.includes('[['), 'no leftover markers');

assert(!isExecutable(''), 'not executable empty');
assert(isExecutable('A'), 'executable');

print('compose tests passed');
