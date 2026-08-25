#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const dataPath = path.join(repoRoot, 'docs', 'data.js');
const defaultTypedSourcePath = path.join(repoRoot, 'Poppies_Navy_Journal_Typed_Text_Editable.md');
const args = process.argv.slice(2);
const outputArgIndex = args.indexOf('--output');
const typedArgIndex = args.indexOf('--typed-source');
const canonicalArgIndex = args.indexOf('--canonical-url');
const outputName = outputArgIndex >= 0 ? args[outputArgIndex + 1] : 'docs/index.html';
const typedSourceName = typedArgIndex >= 0 ? args[typedArgIndex + 1] : defaultTypedSourcePath;
const canonicalUrl = canonicalArgIndex >= 0
  ? args[canonicalArgIndex + 1]
  : 'https://tompinataro.github.io/poppies-navy-journal/';

if (outputArgIndex >= 0 && !outputName) throw new Error('--output requires a file name.');
if (typedArgIndex >= 0 && !typedSourceName) throw new Error('--typed-source requires a file name.');
if (canonicalArgIndex >= 0 && !canonicalUrl) throw new Error('--canonical-url requires a URL.');

const outputPath = path.resolve(repoRoot, outputName);
const outputDir = path.dirname(outputPath);
const typedSourcePath = path.resolve(repoRoot, typedSourceName);

function loadJournalPages() {
  const source = fs.readFileSync(dataPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: dataPath });
  if (!Array.isArray(sandbox.window.JOURNAL_PAGES)) {
    throw new Error('docs/data.js did not define window.JOURNAL_PAGES as an array.');
  }
  return sandbox.window.JOURNAL_PAGES;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[ch]));
}

function repoRelativeAsset(assetPath) {
  if (!assetPath) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(assetPath)) return assetPath;
  const absoluteAssetPath = path.join(repoRoot, 'docs', assetPath);
  return path.relative(outputDir, absoluteAssetPath).split(path.sep).join('/');
}

function imageSizeAttrs(assetPath) {
  if (!assetPath || /^[a-z][a-z0-9+.-]*:/i.test(assetPath)) return '';
  const absoluteAssetPath = path.join(repoRoot, 'docs', assetPath);
  if (!fs.existsSync(absoluteAssetPath)) return '';
  const buffer = fs.readFileSync(absoluteAssetPath);
  const size = imageSize(buffer);
  return size ? ` width="${size.width}" height="${size.height}"` : '';
}

function imageSize(buffer) {
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function imgTag(assetPath, alt, className = '') {
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  return `<img${classAttr} src="${escapeHtml(repoRelativeAsset(assetPath))}" alt="${escapeHtml(alt)}"${imageSizeAttrs(assetPath)} loading="lazy">`;
}

function paragraphsHtml(paragraphs) {
  return (paragraphs || []).filter(Boolean).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('\n');
}

function coverTranscript(page) {
  return [];
}

function introTranscript(page) {
  return [page.title, ...(page.paragraphs || [])].filter(Boolean);
}

function pageTranscript(page) {
  return [...(page.paragraphs || [])];
}

function parseTypedSource(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const headingMatches = [...text.matchAll(/^# (.+)$/gm)];
  const entriesByLabel = new Map();
  for (let i = 0; i < headingMatches.length; i += 1) {
    const label = headingMatches[i][1].trim();
    const start = headingMatches[i].index + headingMatches[i][0].length;
    const end = i + 1 < headingMatches.length ? headingMatches[i + 1].index : text.length;
    const body = text.slice(start, end).trim();
    const transcript = body ? body.split(/\n{2,}/).map(part => part.trim()).filter(Boolean) : [];
    entriesByLabel.set(label, transcript);
  }
  return entriesByLabel;
}

function applyTypedSource(entries, typedEntries) {
  if (!typedEntries) return false;
  for (const entry of entries) {
    if (entry.label === 'Cover' || entry.type === 'photoPage' || entry.type === 'birthdayPage') continue;
    if (!typedEntries.has(entry.label)) {
      throw new Error(`Typed source is missing "${entry.label}".`);
    }
    entry.transcript = typedEntries.get(entry.label);
  }
  return true;
}

function looksLikeEntryStart(paragraph) {
  return /^(?:(?:Mon|Tue|Tues|Wed|Thur|Thurs|Fri|Sat|Sun)\.?\s+)?(?:Jan|Feb|March)\.?\s+\d|\d{1,2}:\d{2}\s*(?:A|P)\.M\.|Angelo Pignataro/i.test(paragraph.trim());
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

function normalizeEntry(page) {
  if (page.type === 'cover') {
    return {
      label: 'Cover',
      imageLabel: 'Cover',
      image: page.image,
      caption: page.caption,
      alt: page.imageAlt,
      transcript: coverTranscript(page),
      notesHtml: ''
    };
  }
  if (page.type === 'intro') {
    return {
      label: 'USS Pegasus',
      imageLabel: 'USS Pegasus',
      image: page.shipImage,
      caption: page.shipCaption,
      alt: page.shipAlt,
      transcript: introTranscript(page),
      notesHtml: introNotesHtml(page)
    };
  }
  return {
    label: page.label,
    imageLabel: page.label,
    image: page.image,
    caption: '',
    alt: `Handwritten diary ${page.label}`,
    transcript: pageTranscript(page),
    notesHtml: pageNotesHtml(page)
  };
}

function introNotesHtml(page) {
  const parts = [];
  if (page.shipCaption) parts.push(`<p>${escapeHtml(page.shipCaption)}</p>`);
  if (page.specs && page.specs.length) {
    parts.push(`<section class="noteBlock"><h3>Specifications</h3><dl class="specList">${page.specs.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></section>`);
  }
  return parts.join('\n');
}

function pageNotesHtml(page) {
  if (!page.details || !page.details.length) return '';
  return page.details.map(formatDetail).join('\n');
}

function formatDetail(detail) {
  const parts = [];
  const hasMoviePosterMedia = Boolean(detail.media && detail.media.some(isMoviePosterMedia));
  if (detail.title) parts.push(`<h3>${escapeHtml(detail.title)}</h3>`);
  if (detail.body) parts.push(`<p>${escapeHtml(detail.body)}</p>`);
  if (detail.media && detail.media.length) parts.push(detail.media.map(formatMedia).join(''));
  if (detail.photos && detail.photos.length) parts.push(detail.photos.map(formatPhoto).join(''));
  if (!hasMoviePosterMedia && detail.links && detail.links.length) {
    parts.push(`<ul class="linkList">${detail.links.map(link => `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></li>`).join('')}</ul>`);
  }
  if (detail.visual) parts.push(formatVisual(detail));
  return `<section class="noteBlock">${parts.join('\n')}</section>`;
}

function isMoviePosterMedia(item) {
  return /(?:film|theatrical)\s+poster|promotional image/i.test(`${item.subtitle || ''} ${item.alt || ''}`);
}

function formatMedia(item) {
  const image = item.image ? imgTag(item.image, item.alt || item.title) : '';
  const subtitle = item.subtitle && !isMoviePosterMedia(item) ? `<span>${escapeHtml(item.subtitle)}</span>` : '';
  const caption = item.caption ? `<span>${escapeHtml(item.caption)}</span>` : subtitle;
  return `<figure class="mediaFigure">${image}<figcaption><strong>${escapeHtml(item.title)}</strong>${caption}${item.url ? `<a href="${escapeHtml(item.url)}">More info</a>` : ''}</figcaption></figure>`;
}

function formatPhoto(photo) {
  const image = photo.image || photo.src;
  const title = photo.title || '';
  return `<figure class="mediaFigure">${imgTag(image, photo.alt || title)}<figcaption>${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${photo.caption ? `<span>${escapeHtml(photo.caption)}</span>` : ''}${photo.url ? `<a href="${escapeHtml(photo.url)}">${escapeHtml(photo.linkLabel || 'View source')}</a>` : ''}</figcaption></figure>`;
}

function formatVisual(detail) {
  if (detail.visual === 'leyte') {
    return `<figure class="mediaFigure">${imgTag('assets/details/leyte-eastern-visayas-map.png', 'Map showing Leyte, Eastern Visayas, Philippines in Southeast Asia')}<figcaption><strong>Leyte map</strong><span>Leyte, Eastern Visayas, Philippines.</span></figcaption></figure>`;
  }
  if (detail.visual === 'route' || detail.visual === 'routeTable') {
    const map = detail.visual === 'route'
      ? imgTag('assets/details/route-map.png', 'Approximate Pacific route map from Leyte to Guam, Enewetak, Pearl Harbor, and San Francisco')
      : '';
    return `<figure class="mediaFigure">${map}<figcaption><strong>Dates and approximate leg distances</strong><span>Leyte -> Guam: 1,172 nmi / 1,349 mi. Guam -> Enewetak: 1,036 nmi / 1,192 mi. Enewetak -> Pearl Harbor: 2,359 nmi / 2,714 mi. Pearl Harbor -> San Francisco: 2,083 nmi / 2,397 mi.</span>${detail.routeTotalArc ? '<span>Leyte -> San Francisco: about 6,650 nmi.</span>' : ''}</figcaption></figure>`;
  }
  return `<p>Visual reference: ${escapeHtml(detail.visual)}</p>`;
}

function renderEntry(entry) {
  if (entry.type === 'photoPage') return renderPhotoPage(entry);
  if (entry.type === 'birthdayPage') return renderBirthdayPage(entry);
  const hasNotes = Boolean(entry.notesHtml);
  const showEntryHeader = entry.label !== 'Cover';
  const coverTitle = entry.label === 'Cover'
    ? '<h1 class="scriptTitle coverTitle">Poppie&apos;s U.S. Navy Journal</h1>'
    : '';
  const captionHtml = entry.label === 'Cover'
    ? ''
    : (entry.caption ? `<figcaption>${escapeHtml(entry.caption)}</figcaption>` : '');
  return `<article class="entry" id="${escapeHtml(entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}">
  ${showEntryHeader ? `<header class="entryHeader">
    <h2>${escapeHtml(entry.label)}</h2>
  </header>` : ''}
  <div class="threeColumns">
    <section class="column handwrittenColumn${entry.label === 'Cover' ? ' coverColumn' : ''}" aria-label="${escapeHtml(entry.label)} handwritten page">
      ${coverTitle}
      <figure>
        ${imgTag(entry.image, entry.alt || entry.imageLabel)}
        ${captionHtml}
      </figure>
    </section>
    <section class="column transcriptColumn" aria-label="${escapeHtml(entry.label)} typed transcript">
      <div class="transcriptText">
        ${paragraphsHtml(entry.transcript)}
      </div>
    </section>
    <section class="column notesColumn${hasNotes ? '' : ' emptyNotesColumn'}" aria-label="${escapeHtml(entry.label)} notes and details">
      ${hasNotes ? '<h3>Notes &amp; Details</h3>' : ''}
      <div class="notesText">
        ${entry.notesHtml}
      </div>
    </section>
  </div>
</article>`;
}

function renderPhotoPage(entry) {
  return `<article class="entry photoPageEntry" id="${escapeHtml(entry.id)}">
  <header class="entryHeader">
    <h2>${escapeHtml(entry.label)}</h2>
  </header>
  <div class="familyPhotoGrid">
    ${entry.photos.map(formatPhoto).join('\n')}
  </div>
</article>`;
}

function renderBirthdayPage(entry) {
  return `<article class="entry birthdayPageEntry" id="${escapeHtml(entry.id)}">
  <div class="birthdayPage">
    <div class="birthdayMessage">
      <h2 class="scriptTitle"><span>... with Love,</span><span>Commemorating</span><span>the 100th Anniversary</span><span>of my father&apos;s birth...</span></h2>
    </div>
    <p class="birthdayFooter"><span>Please let me know of any edits or improvements:</span><a href="mailto:tom@pinataro.com">tom@pinataro.com</a><span>Thank you.</span></p>
  </div>
</article>`;
}

function renderHtml(entries) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <title>Poppie's Navy Journal - Three Column Review</title>
  <style>
    :root {
      --paper: #f7f4ed;
      --panel: #fffdf8;
      --ink: #101820;
      --muted: #667085;
      --line: #d7d0c3;
      --accent: #1f6f78;
      --accent-2: #b43f2e;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: ui-serif, Georgia, "Times New Roman", serif;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 248, .94);
      backdrop-filter: blur(12px);
    }
    .cover-active .brand {
      visibility: hidden;
    }
    .brand strong { display: block; font-size: 17px; }
    .brand span { color: var(--muted); font-size: 13px; }
    .jump {
      width: min(205px, 52vw);
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: white;
      color: var(--ink);
      font: inherit;
      padding: 0 10px;
    }
    main {
      max-width: 1720px;
      margin: 0 auto;
      padding: 18px;
    }
    .entry {
      margin: 0 0 22px;
      scroll-margin-top: 74px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      box-shadow: 0 10px 26px rgba(38, 31, 20, .08);
      overflow: clip;
    }
    .entryHeader {
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: #fbfaf7;
    }
    .entryHeader h2 {
      margin: 0;
      font-size: 24px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .threeColumns {
      display: grid;
      grid-template-columns: minmax(320px, 1.05fr) minmax(340px, .95fr) minmax(320px, .85fr);
      align-items: start;
    }
    .column {
      min-height: 420px;
      padding: 16px 18px 22px;
    }
    .column + .column {
      border-left: 1px solid var(--line);
    }
    .column > h3 {
      position: sticky;
      top: 61px;
      z-index: 2;
      margin: -16px -18px 16px;
      padding: 10px 18px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 248, .96);
      color: var(--accent);
      font: 700 13px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    figure { margin: 0; }
    .scriptTitle {
      margin: 0;
      text-align: center;
      font-family: "Monotype Corsiva", "Apple Chancery", "Brush Script MT", cursive;
      font-weight: 400;
      line-height: 1.05;
      color: var(--ink);
    }
    .coverTitle {
      margin: 6px 0 18px;
      font-size: clamp(42px, 5vw, 76px);
    }
    .coverColumn {
      display: grid;
      align-content: start;
      justify-items: center;
    }
    #cover .threeColumns {
      display: block;
    }
    #cover .transcriptColumn,
    #cover .notesColumn {
      display: none;
    }
    .handwrittenColumn img {
      display: block;
      width: 100%;
      max-height: 84vh;
      object-fit: contain;
      border: 1px solid #cfc7ba;
      background: #f5f1ea;
    }
    .coverColumn img {
      width: min(100%, 620px);
      max-height: 78vh;
    }
    figcaption {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.35;
    }
    .coverCaption {
      display: grid;
      justify-items: center;
      gap: 4px;
      color: var(--ink);
      text-align: center;
      font-size: 17px;
    }
    .coverCaption strong {
      font-size: 20px;
    }
    .birthdayPage {
      position: relative;
      display: grid;
      min-height: calc(100vh - 96px);
      padding: 56px 24px 34px;
      place-items: center;
      text-align: center;
    }
    .birthdayMessage {
      display: grid;
      gap: 18px;
      justify-items: center;
    }
    .birthdayMessage h2 {
      display: grid;
      gap: 8px;
      max-width: 980px;
      font-size: clamp(48px, 7vw, 104px);
    }
    .birthdayMessage p {
      display: grid;
      gap: 6px;
      margin: 0;
      font-size: clamp(24px, 3vw, 42px);
      line-height: 1.25;
    }
    .birthdayFooter {
      position: absolute;
      right: 24px;
      bottom: 18px;
      left: 24px;
      display: grid;
      gap: 3px;
      margin: 0;
      color: var(--muted);
      font: 13px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .transcriptText {
      max-width: 780px;
      font-size: clamp(18px, 1.2vw, 22px);
      line-height: 1.58;
    }
    .transcriptText p {
      margin: 0 0 1em;
    }
    .notesText {
      display: grid;
      gap: 16px;
      align-content: start;
      font-size: 16px;
      line-height: 1.46;
    }
    .notesText p { margin: 0; }
    .noteBlock {
      display: grid;
      gap: 10px;
    }
    .noteBlock h3 {
      margin: 0;
      font-size: 19px;
      line-height: 1.2;
      color: var(--ink);
    }
    .specList {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px 16px;
      margin: 0;
    }
    .specList div { min-width: 0; }
    .specList dt {
      color: var(--muted);
      font: 700 12px/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-transform: uppercase;
    }
    .specList dd {
      margin: 3px 0 0;
    }
    .mediaFigure {
      display: grid;
      gap: 8px;
    }
    .mediaFigure img {
      display: block;
      width: 100%;
      max-height: 300px;
      object-fit: contain;
      border: 1px solid #cfc7ba;
      background: #f5f1ea;
    }
    .mediaFigure figcaption {
      display: grid;
      gap: 5px;
      margin: 0;
    }
    .mediaFigure figcaption strong {
      color: var(--ink);
      font-size: 16px;
    }
    .familyPhotoGrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(260px, 1fr));
      gap: 18px;
      padding: 18px;
    }
    .familyPhotoGrid .mediaFigure img {
      max-height: 620px;
    }
    .familyPhotoGrid .mediaFigure figcaption {
      font-size: 16px;
      line-height: 1.42;
    }
    a {
      color: var(--accent);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
    .linkList {
      margin: 0;
      padding-left: 20px;
    }
    .emptyNote {
      min-height: 1em;
    }
    @media (max-width: 1100px) {
      .threeColumns { grid-template-columns: 1fr; }
      .familyPhotoGrid { grid-template-columns: 1fr; }
      .column + .column {
        border-left: 0;
        border-top: 1px solid var(--line);
      }
      .column { min-height: auto; }
      .column > h3 { top: 61px; }
    }
    @media print {
      body { background: white; }
      .topbar { display: none; }
      main { max-width: none; padding: 0; }
      .entry {
        break-inside: avoid;
        box-shadow: none;
        margin-bottom: 14px;
      }
      .column > h3 { position: static; }
      .handwrittenColumn img { max-height: 9in; }
    }
  </style>
</head>
<body class="cover-active">
  <header class="topbar">
    <div class="brand">
      <strong>Poppie's U.S. Navy Journal</strong>
    </div>
    <select class="jump" aria-label="Jump to entry" onchange="window.jumpToEntry && window.jumpToEntry(this.value)">
      <option value="" selected>Jump to</option>
      ${entries.map(entry => `<option value="${escapeHtml(entry.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}">${escapeHtml(entry.label)}</option>`).join('\n      ')}
    </select>
  </header>
  <main>
    ${entries.map(renderEntry).join('\n')}
  </main>
  <script>
    const coverEntry = document.getElementById('cover');
    const updateCoverState = () => {
      if (!coverEntry) return;
      const coverEnd = coverEntry.offsetTop + coverEntry.offsetHeight - 68;
      document.body.classList.toggle('cover-active', window.scrollY < coverEnd);
    };
    updateCoverState();
    window.addEventListener('scroll', updateCoverState, { passive: true });
    window.addEventListener('resize', updateCoverState);
    const jumpSelect = document.querySelector('.jump');
    const jumpToEntry = id => {
      const entry = document.getElementById(id);
      if (!entry) return;
      if (jumpSelect && Array.from(jumpSelect.options).some(option => option.value === id)) {
        jumpSelect.value = id;
      }
      history.replaceState(null, '', location.pathname + location.search + '#' + id);
      const alignEntry = () => {
        const top = Math.max(0, entry.getBoundingClientRect().top + window.scrollY - 74);
        window.scrollTo({ top, behavior: 'auto' });
        updateCoverState();
      };
      const watchedImages = Array.from(document.images).filter(image => !image.complete);
      watchedImages.forEach(image => {
        image.addEventListener('load', alignEntry, { once: true });
        image.addEventListener('error', alignEntry, { once: true });
      });
      alignEntry();
      let attempts = 0;
      const timer = window.setInterval(() => {
        alignEntry();
        const aligned = Math.abs(entry.getBoundingClientRect().top - 74) < 3;
        attempts += 1;
        if (aligned || attempts >= 40) window.clearInterval(timer);
      }, 125);
    };
    window.jumpToEntry = jumpToEntry;
    if (jumpSelect) {
      jumpSelect.addEventListener('change', event => jumpToEntry(event.target.value));
    }
    window.addEventListener('load', () => {
      if (location.hash) jumpToEntry(location.hash.slice(1));
    });
  </script>
</body>
</html>
`;
}

function validate(entries) {
  const expectedLabels = [
    'Cover',
    'USS Pegasus',
    'Pignataro Brothers',
    ...Array.from({ length: 51 }, (_, index) => `Page ${String(index + 1).padStart(2, '0')}`),
    'Happy 100th Birthday'
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
  const introPage = pages.find(page => page.type === 'intro');
  if (introPage && introPage.photos && introPage.photos.length) {
    entries.splice(2, 0, {
      type: 'photoPage',
      label: 'Pignataro Brothers',
      id: 'pignataro-brothers',
      photos: introPage.photos
    });
  }
  entries.push({
    type: 'birthdayPage',
    label: 'Happy 100th Birthday',
    id: 'happy-100th-birthday'
  });
  const usedTypedSource = applyTypedSource(entries, parseTypedSource(typedSourcePath));
  if (!usedTypedSource) flowNumberedPageContinuations(entries);
  validate(entries);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, renderHtml(entries), 'utf8');
  console.log(`Wrote ${path.relative(repoRoot, outputPath)} with ${entries.length} entries.`);
  console.log(usedTypedSource ? `Used typed source ${path.relative(repoRoot, typedSourcePath)}.` : 'Used docs/data.js transcript source.');
  console.log(`Canonical URL: ${canonicalUrl}`);
}

main();
