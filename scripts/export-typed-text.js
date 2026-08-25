#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const dataPath = path.join(repoRoot, 'docs', 'data.js');
const outputPath = path.join(repoRoot, 'Poppies_Navy_Journal_Typed_Text_Editable.md');

function loadJournalPages() {
  const source = fs.readFileSync(dataPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: dataPath });
  if (!Array.isArray(sandbox.window.JOURNAL_PAGES)) {
    throw new Error('docs/data.js did not define window.JOURNAL_PAGES as an array.');
  }
  return sandbox.window.JOURNAL_PAGES;
}

function blankLineJoin(parts) {
  return parts.map(part => String(part || '').trim()).filter(Boolean).join('\n\n');
}

function looksLikeEntryStart(paragraph) {
  return /^(?:(?:Mon|Tue|Tues|Wed|Thur|Thurs|Fri|Sat|Sun)\.?\s+)?(?:Jan|Feb|March)\.?\s+\d|\d{1,2}:\d{2}\s*(?:A|P)\.M\.|Angelo Pignataro/i.test(paragraph.trim());
}

function normalizeEntry(page) {
  if (page.type === 'cover') {
    return {
      label: 'Cover',
      transcript: [page.kicker, page.title, page.subtitle, page.body].filter(Boolean)
    };
  }
  if (page.type === 'intro') {
    return {
      label: 'USS Pegasus',
      transcript: [page.title, ...(page.paragraphs || [])].filter(Boolean)
    };
  }
  return {
    label: page.label,
    transcript: [...(page.paragraphs || [])]
  };
}

function flowNumberedPageContinuations(entries) {
  for (let i = 1; i < entries.length; i += 1) {
    const previous = entries[i - 1];
    const current = entries[i];
    if (!/^Page \d{2}$/.test(previous.label) || !/^Page \d{2}$/.test(current.label)) continue;
    if (!current.transcript.length || looksLikeEntryStart(current.transcript[0])) continue;
    if (!previous.transcript.length) continue;
    const continuation = current.transcript.shift();
    const lastIndex = previous.transcript.length - 1;
    const bridge = /\bTrip$/.test(previous.transcript[lastIndex]) && /^very boring\b/.test(continuation) ? ' is ' : ' ';
    previous.transcript[lastIndex] = `${previous.transcript[lastIndex]}${bridge}${continuation}`.replace(/\s+/g, ' ').trim();
  }
}

function validate(entries) {
  const expectedLabels = [
    'Cover',
    'USS Pegasus',
    ...Array.from({ length: 51 }, (_, index) => `Page ${String(index + 1).padStart(2, '0')}`)
  ];
  const actualLabels = entries.map(entry => entry.label);
  if (actualLabels.length !== expectedLabels.length) {
    throw new Error(`Expected ${expectedLabels.length} entries; found ${actualLabels.length}.`);
  }
  for (let i = 0; i < expectedLabels.length; i += 1) {
    if (actualLabels[i] !== expectedLabels[i]) {
      throw new Error(`Entry ${i + 1} should be "${expectedLabels[i]}" but was "${actualLabels[i]}".`);
    }
  }
}

function renderEntry(entry) {
  return `# ${entry.label}\n\n${blankLineJoin(entry.transcript)}`.trimEnd();
}

function main() {
  const entries = loadJournalPages().map(normalizeEntry);
  flowNumberedPageContinuations(entries);
  validate(entries);
  fs.writeFileSync(outputPath, `${entries.map(renderEntry).join('\n\n')}\n`, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${entries.length} entries.`);
}

main();
