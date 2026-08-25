#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const dataPath = path.join(repoRoot, 'docs', 'data.js');

const args = process.argv.slice(2);
const flowContinuations = args.includes('--flow');
const outputArgIndex = args.indexOf('--output');
const outputName = outputArgIndex >= 0 ? args[outputArgIndex + 1] : 'Poppies_Navy_Journal_Master.md';
if (outputArgIndex >= 0 && !outputName) {
  throw new Error('--output requires a file name.');
}
const outputPath = path.resolve(repoRoot, outputName);

function loadJournalPages() {
  const source = fs.readFileSync(dataPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: dataPath });
  if (!Array.isArray(sandbox.window.JOURNAL_PAGES)) {
    throw new Error('docs/data.js did not define window.JOURNAL_PAGES as an array.');
  }
  return sandbox.window.JOURNAL_PAGES;
}

function repoRelativeAsset(assetPath) {
  if (!assetPath) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(assetPath)) return assetPath;
  return path.posix.join('docs', assetPath);
}

function markdownDestination(destination) {
  return /[\s()]/.test(destination) ? `<${destination}>` : destination;
}

function blankLineJoin(parts) {
  return parts.map(part => String(part || '').trim()).filter(Boolean).join('\n\n');
}

function imageMarkdown(label, src) {
  if (!src) return '';
  return `![${label}](${markdownDestination(repoRelativeAsset(src))})`;
}

function coverTranscript(page) {
  return blankLineJoin([
    page.kicker,
    page.title,
    page.subtitle,
    page.body
  ]);
}

function coverNotes(page) {
  return blankLineJoin([
    page.caption,
    page.imageAlt ? `Image alt text: ${page.imageAlt}` : ''
  ]);
}

function introTranscript(page) {
  return blankLineJoin([
    page.title,
    ...(page.paragraphs || [])
  ]);
}

function introNotes(page) {
  const parts = [];
  if (page.shipCaption) parts.push(page.shipCaption);
  if (page.specs && page.specs.length) {
    parts.push([
      '**Specifications**',
      ...page.specs.map(([label, value]) => `- ${label}: ${value}`)
    ].join('\n'));
  }
  if (page.photos && page.photos.length) {
    parts.push(page.photos.map(photo => formatPhoto(photo)).join('\n\n'));
  }
  return blankLineJoin(parts);
}

function pageTranscript(page) {
  return blankLineJoin(page.paragraphs || []);
}

function pageNotes(page) {
  if (!page.details || !page.details.length) return '';
  return blankLineJoin(page.details.map(formatDetail));
}

function formatDetail(detail) {
  const parts = [];
  if (detail.title) parts.push(`**${detail.title}**`);
  if (detail.body) parts.push(detail.body);
  if (detail.media && detail.media.length) {
    parts.push(detail.media.map(formatMedia).join('\n\n'));
  }
  if (detail.photos && detail.photos.length) {
    parts.push(detail.photos.map(formatPhoto).join('\n\n'));
  }
  if (detail.links && detail.links.length) {
    parts.push(detail.links.map(link => `- [${link.label}](${markdownDestination(link.url)})`).join('\n'));
  }
  if (detail.visual) {
    parts.push(formatVisual(detail));
  }
  return blankLineJoin(parts);
}

function formatMedia(item) {
  const parts = [];
  if (item.title) parts.push(`**${item.title}**`);
  if (item.subtitle) parts.push(item.subtitle);
  if (item.image) parts.push(imageMarkdown(item.alt || item.title || 'Media image', item.image));
  if (item.alt) parts.push(`Image alt text: ${item.alt}`);
  if (item.url) parts.push(`[More info](${markdownDestination(item.url)})`);
  return blankLineJoin(parts);
}

function formatPhoto(photo) {
  const parts = [];
  if (photo.title) parts.push(`**${photo.title}**`);
  if (photo.caption) parts.push(photo.caption);
  if (photo.image) parts.push(imageMarkdown(photo.alt || photo.title || 'Detail image', photo.image));
  if (photo.alt) parts.push(`Image alt text: ${photo.alt}`);
  if (photo.url) parts.push(`[${photo.linkLabel || 'View source'}](${markdownDestination(photo.url)})`);
  return blankLineJoin(parts);
}

function formatVisual(detail) {
  if (detail.visual === 'leyte') {
    return [
      '**Leyte map**',
      imageMarkdown('Map of Samar and Leyte', 'assets/details/samar-leyte-map.jpg'),
      'Map of Samar and Leyte, from *Building the Navy\'s Bases in World War II*, Volume II.'
    ].join('\n\n');
  }
  if (detail.visual === 'route' || detail.visual === 'routeTable') {
    const routeParts = [];
    if (detail.visual === 'route') {
      routeParts.push(imageMarkdown('Approximate Pacific Route, Jan. 4-Mar. 4, 1946', 'assets/details/route-map.png'));
    }
    routeParts.push([
      '**Dates and approximate leg distances**',
      '- Leyte -> Guam: 1,172 nmi / 1,349 mi; Departed Jan. 6; arrived Jan. 15',
      '- Guam -> Enewetak: 1,036 nmi / 1,192 mi; At Guam Jan. 15-19; at Enewetak Jan. 27-29',
      '- Enewetak -> Pearl Harbor: 2,359 nmi / 2,714 mi; Departed Jan. 29; arrived/anchored Feb. 11',
      '- Pearl Harbor -> San Francisco: 2,083 nmi / 2,397 mi; At Pearl Feb. 11-21; arrived San Francisco Mar. 4'
    ].join('\n'));
    if (detail.visual === 'route' && detail.routeMode !== 'mapOnly') {
      routeParts.push('Distances are approximate great-circle distances between locations, not Pegasus\'s exact track. Total shown route: about 6,650 nautical miles.');
    }
    if (detail.routeTotalArc) {
      routeParts.push('Leyte -> San Francisco: about 6,650 nmi');
    }
    return blankLineJoin(routeParts);
  }
  return `Visual reference: ${detail.visual}`;
}

function normalizeEntry(page) {
  if (page.type === 'cover') {
    return {
      label: 'Cover',
      imageLabel: 'Cover',
      image: page.image,
      transcript: coverTranscript(page),
      notes: coverNotes(page)
    };
  }
  if (page.type === 'intro') {
    return {
      label: 'USS Pegasus',
      imageLabel: 'USS Pegasus',
      image: page.shipImage,
      transcript: introTranscript(page),
      notes: introNotes(page)
    };
  }
  return {
    label: page.label,
    imageLabel: page.label,
    image: page.image,
    transcript: pageTranscript(page),
    notes: pageNotes(page)
  };
}

function looksLikeEntryStart(paragraph) {
  return /^(?:(?:Mon|Tue|Tues|Wed|Thur|Thurs|Fri|Sat|Sun)\.?\s+)?(?:Jan|Feb|March)\.?\s+\d|\d{1,2}:\d{2}\s*(?:A|P)\.M\.|Angelo Pignataro/i.test(paragraph.trim());
}

function flowNumberedPageContinuations(entries) {
  for (let i = 1; i < entries.length; i += 1) {
    const previous = entries[i - 1];
    const current = entries[i];
    if (!/^Page \d{2}$/.test(previous.label) || !/^Page \d{2}$/.test(current.label)) continue;
    const currentParts = current.transcript.split(/\n{2,}/).filter(part => part.length);
    if (!currentParts.length || looksLikeEntryStart(currentParts[0])) continue;
    const previousParts = previous.transcript.split(/\n{2,}/).filter(part => part.length);
    if (!previousParts.length) continue;
    const continuation = currentParts.shift();
    const bridge = /\bTrip$/.test(previousParts[previousParts.length - 1]) && /^very boring\b/.test(continuation) ? ' is ' : ' ';
    previousParts[previousParts.length - 1] = `${previousParts[previousParts.length - 1]}${bridge}${continuation}`.replace(/\s+/g, ' ').trim();
    previous.transcript = blankLineJoin(previousParts);
    current.transcript = blankLineJoin(currentParts);
  }
}

function renderEntry(entry) {
  return [
    `# ${entry.label}`,
    '',
    '## Handwritten',
    '',
    imageMarkdown(entry.imageLabel, entry.image),
    '',
    '---',
    '',
    '## Typed Transcript',
    '',
    entry.transcript,
    '',
    '---',
    '',
    '## Notes & Details',
    '',
    entry.notes
  ].join('\n').replace(/[ \t]+\n/g, '\n').trimEnd();
}

function validateEntries(entries) {
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

function main() {
  const pages = loadJournalPages();
  const entries = pages.map(normalizeEntry);
  if (flowContinuations) flowNumberedPageContinuations(entries);
  validateEntries(entries);
  const markdown = `${entries.map(renderEntry).join('\n\n')}\n`;
  fs.writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${entries.length} entries.`);
}

main();
