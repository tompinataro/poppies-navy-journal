const pages = window.JOURNAL_PAGES;
let pageIndex = 0;
const viewer = document.getElementById('viewer');
const pageSelect = document.getElementById('pageSelect');
const pageMeta = document.getElementById('pageMeta');

function lineSplit(text, max = 22) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}
function lineSplitForPage(page, paragraph, paragraphIndex, max = baseLineMax(page)) {
  if (page.num === 1 && paragraphIndex === 1) {
    return ['Account of my travels', 'back home from the', 'Philippines.'];
  }
  if (page.num === 1 && paragraphIndex === 2) {
    return ['Written in diary form', 'to Mom & Dad.'];
  }
  return lineSplit(paragraph, max);
}
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function baseLineMax(page) {
  if (page.num === 1) return 25;
  if (page.num === 51) return 32;
  return 24;
}
function renderHandText(page, max = baseLineMax(page)) {
  return `<div class="handText">${page.paragraphs.map((p, i) => `<p>${lineSplitForPage(page, p, i, max).map(line => `<span class="line">${escapeHtml(line)}</span>`).join('')}</p>`).join('')}</div>`;
}
function renderTypedText(page, max = baseLineMax(page)) {
  return `<div class="typedText">${page.paragraphs.map((p, i) => `<p>${lineSplitForPage(page, p, i, max).map(line => `<span class="line">${escapeHtml(line)}</span>`).join('')}</p>`).join('')}</div>`;
}
function renderCoverPage(page) {
  return `<section class="frontPage coverPage">
    <div class="coverCopy">
      <p class="kicker">${escapeHtml(page.kicker)}</p>
      <h1>${escapeHtml(page.title)}</h1>
      <p class="subtitle">${escapeHtml(page.subtitle)}</p>
      <p>${escapeHtml(page.body)}</p>
    </div>
    <figure class="coverPortrait">
      <img src="${page.image}" alt="${escapeHtml(page.imageAlt)}">
      <figcaption>${escapeHtml(page.caption)}</figcaption>
    </figure>
  </section>`;
}
function renderIntroPage(page) {
  const specs = page.specs.map(([label, value]) => `<div class="specItem"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
  const photos = page.photos.map(photo => `<figure><img src="${photo.src}" alt="${escapeHtml(photo.alt)}"><figcaption>${escapeHtml(photo.caption)}</figcaption></figure>`).join('');
  return `<section class="frontPage introPage">
    <div class="introLead">
      <div>
        <p class="kicker">${escapeHtml(page.kicker)}</p>
        <h1>${escapeHtml(page.title)}</h1>
        ${page.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}
      </div>
      <figure class="shipFigure">
        <img src="${page.shipImage}" alt="${escapeHtml(page.shipAlt)}">
        <figcaption>${escapeHtml(page.shipCaption)}</figcaption>
      </figure>
    </div>
    <dl class="specGrid">${specs}</dl>
    <div class="photoStrip">${photos}</div>
  </section>`;
}
function leyteMap() {
  return `<figure class="leyteRealMap">
    <img src="assets/details/samar-leyte-map.jpg" alt="1947 map showing the real coastlines of Samar, Leyte, Leyte Gulf, San Pedro Bay, Biliran, Dinagat, and nearby islands">
    <figcaption>Map of Samar and Leyte, from <em>Building the Navy's Bases in World War II</em>, Volume II.</figcaption>
  </figure>`;
}
function routeTable() {
  return `<div class="routeTable" aria-label="Approximate route distances and diary dates">
    <h4>Dates and approximate leg distances</h4>
    <div><strong>Leyte -> Guam</strong><span>1,172 nmi / 1,349 mi</span><em>Departed Jan. 6; arrived Jan. 15</em></div>
    <div><strong>Guam -> Enewetak</strong><span>1,036 nmi / 1,192 mi</span><em>At Guam Jan. 15-19; at Enewetak Jan. 27-29</em></div>
    <div><strong>Enewetak -> Pearl Harbor</strong><span>2,359 nmi / 2,714 mi</span><em>Departed Jan. 29; arrived/anchored Feb. 11</em></div>
    <div><strong>Pearl Harbor -> San Francisco</strong><span>2,083 nmi / 2,397 mi</span><em>At Pearl Feb. 11-21; arrived San Francisco Mar. 4</em></div>
  </div>`;
}
function routeMap(detail = {}) {
  const showTable = detail.routeMode !== 'mapOnly';
  return `<figure class="routeMap">
    <div class="routeMapFrame">
      <img src="assets/details/route-map.png" alt="Approximate Pacific route map from Leyte to Guam, Enewetak, Pearl Harbor, and San Francisco">
      ${detail.routeTotalArc ? `<svg class="routeTotalArc" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 14 56 C 30 12, 69 5, 91 31"></path>
      </svg>` : ''}
      <span class="routeTitleOverlay">Approximate Pacific Route, Jan. 4-Mar. 4, 1946</span>
      ${detail.routeTotalArc ? '<span class="routeTotalLabel">Leyte -> San Francisco: about 6,650 nmi</span>' : ''}
      <span class="routeLeg routeLegLeyteGuam">1,172 nmi</span>
      <span class="routeLeg routeLegGuamEnewetak">1,036 nmi</span>
      <span class="routeLeg routeLegEnewetakPearl">2,359 nmi</span>
      <span class="routeLeg routeLegPearlSf">2,083 nmi</span>
    </div>
    ${showTable ? routeTable() : ''}
    ${showTable ? `<figcaption>Distances are approximate great-circle distances between locations, not Pegasus's exact track. Total shown route: about 6,650 nautical miles.</figcaption>` : ''}
  </figure>`;
}
function renderDetailLinks(detail) {
  if (!detail.links || !detail.links.length) return '';
  return `<div class="detailLinks">${detail.links.map(link => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.label)}</a>`).join('')}</div>`;
}
function renderMediaCards(detail) {
  if (!detail.media || !detail.media.length) return '';
  return `<div class="mediaGrid">${detail.media.map(item => {
    const image = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || item.title)}" loading="lazy">`
      : `<div class="mediaCoverPlaceholder" aria-label="${escapeHtml(item.alt || item.title)}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.subtitle || '')}</span></div>`;
    return `<article class="mediaCard"><a class="mediaImageLink" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${image}</a><div><h4>${escapeHtml(item.title)}</h4>${item.subtitle ? `<p>${escapeHtml(item.subtitle)}</p>` : ''}<a class="mediaMore" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.moreLabel || 'More info')}</a></div></article>`;
  }).join('')}</div>`;
}
function renderDetailPhotos(detail) {
  if (!detail.photos || !detail.photos.length) return '';
  return `<div class="photoGrid">${detail.photos.map(photo => `<figure class="detailPhoto"><a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(photo.image)}" alt="${escapeHtml(photo.alt)}" loading="lazy"></a><figcaption><strong>${escapeHtml(photo.title)}</strong><span>${escapeHtml(photo.caption)}</span><a href="${escapeHtml(photo.url)}" target="_blank" rel="noopener">${escapeHtml(photo.linkLabel || 'View source')}</a></figcaption></figure>`).join('')}</div>`;
}
function renderDetails(page) {
  if (!page.details.length) return '';
  return `<div class="detailsGrid">${page.details.map(d => `<article class="detailCard"><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.body)}</p>${renderMediaCards(d)}${renderDetailPhotos(d)}${renderDetailLinks(d)}${d.visual === 'leyte' ? leyteMap() : ''}${d.visual === 'route' ? routeMap(d) : ''}${d.visual === 'routeTable' ? routeTable() : ''}</article>`).join('')}</div>`;
}
async function fitHandTextToManuscript(page) {
  const img = viewer.querySelector('.manuscriptPanel img');
  const textPanel = viewer.querySelector('.transcriptionPanel');
  if (!img || !textPanel) return;
  try {
    if (!img.complete) await img.decode();
  } catch {}
  const maxHeight = img.getBoundingClientRect().height;
  let max = baseLineMax(page);
  while (max <= 48) {
    const currentText = textPanel.querySelector('.handText');
    if (currentText) currentText.outerHTML = renderHandText(page, max);
    const text = textPanel.querySelector('.handText');
    if (!text || text.getBoundingClientRect().height <= maxHeight + 4) break;
    max += 2;
  }
  const text = textPanel.querySelector('.handText');
  if (!text) return;
  let fontSize = parseFloat(getComputedStyle(text).fontSize);
  while (fontSize > 18 && text.getBoundingClientRect().height > maxHeight + 4) {
    fontSize -= 1;
    text.style.fontSize = `${fontSize}px`;
  }
  const lineCount = text.querySelectorAll('.line').length;
  const paragraphCount = text.querySelectorAll('p').length;
  const currentHeight = text.getBoundingClientRect().height;
  if (lineCount > 1 && currentHeight < maxHeight - 12) {
    const baseLineHeight = fontSize * 1.12;
    const baseParagraphGap = fontSize * .18;
    const paragraphGaps = Math.max(0, paragraphCount - 1);
    const extra = Math.min(maxHeight - currentHeight, fontSize * lineCount * .34);
    const lineExtra = extra * .78 / Math.max(1, lineCount - 1);
    const paragraphExtra = paragraphGaps ? extra * .22 / paragraphGaps : 0;
    text.style.setProperty('--hand-line-height', `${baseLineHeight + lineExtra}px`);
    text.style.setProperty('--hand-paragraph-gap', `${baseParagraphGap + paragraphExtra}px`);
  }
}
function render() {
  const page = pages[pageIndex];
  pageMeta.textContent = `${page.label} of ${pages.length}`;
  pageSelect.value = String(pageIndex);
  if (page.type === 'cover') {
    viewer.innerHTML = renderCoverPage(page);
    return;
  }
  if (page.type === 'intro') {
    viewer.innerHTML = renderIntroPage(page);
    return;
  }
  const hasDetails = page.details.length > 0;
  viewer.innerHTML = `<div class="triSpread">
    <section class="panel manuscriptPanel"><img src="${page.image}" alt="Handwritten diary ${page.label}" /></section>
    <section class="panel textPanel transcriptionPanel">
      ${renderHandText(page)}
      ${hasDetails ? '<button class="detailsArrow" type="button" aria-label="Show details column">›</button>' : ''}
    </section>
    <section class="panel textPanel detailsPanel">${renderDetails(page)}</section>
  </div>`;
  fitHandTextToManuscript(page);
}
pages.forEach((page, idx) => {
  const opt = document.createElement('option'); opt.value = String(idx); opt.textContent = page.label; pageSelect.appendChild(opt);
});
document.getElementById('prevPage').addEventListener('click', () => { pageIndex = Math.max(0, pageIndex - 1); render(); });
document.getElementById('nextPage').addEventListener('click', () => { pageIndex = Math.min(pages.length - 1, pageIndex + 1); render(); });
pageSelect.addEventListener('change', e => { pageIndex = Number(e.target.value); render(); });
viewer.addEventListener('click', e => {
  const arrow = e.target.closest('.detailsArrow');
  if (!arrow) return;
  const details = viewer.querySelector('.detailsPanel');
  if (details) details.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
});
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { pageIndex = Math.max(0, pageIndex - 1); render(); }
  if (e.key === 'ArrowRight') { pageIndex = Math.min(pages.length - 1, pageIndex + 1); render(); }
});
render();
