const pages = window.JOURNAL_PAGES;
let pageIndex = 0;
let detailsMode = false;
const viewer = document.getElementById('viewer');
const pageSelect = document.getElementById('pageSelect');
const pageMeta = document.getElementById('pageMeta');
const modeSwitch = document.getElementById('modeSwitch');

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
function escapeHtml(s) {
  return s.replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function renderHandText(page) {
  const max = page.num === 1 ? 25 : page.num === 51 ? 32 : 21;
  return `<div class="handText">${page.paragraphs.map(p => `<p>${lineSplit(p, max).map(line => `<span class="line">${escapeHtml(line)}</span>`).join('')}</p>`).join('')}</div>`;
}
function renderTypedText(page) {
  return `<div class="typedText">${page.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
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
  return `<div class="mapBox" aria-label="Schematic map of Leyte in the central Philippines">
    <div class="island luzon"><span>Luzon</span></div><div class="island mindoro"><span>Mindoro</span></div>
    <div class="island panay"><span>Panay</span></div><div class="island cebu"><span>Cebu</span></div>
    <div class="island leyte"><span>Leyte</span></div><div class="island mindanao"><span>Mindanao</span></div>
  </div>`;
}
function routeMap() {
  return `<figure class="routeMap"><img src="assets/details/route-map.png" alt="Approximate Pacific route map from Leyte to Guam, Enewetak, Pearl Harbor, and San Francisco"><figcaption>Approximate geography only; not the ship's exact track.</figcaption></figure>`;
}
function renderDetails(page) {
  if (!page.details.length) return '<div class="detailEmpty">No added details for this page yet.</div>';
  return `<div class="detailsGrid">${page.details.map(d => `<article class="detailCard"><h3>${escapeHtml(d.title)}</h3><p>${escapeHtml(d.body)}</p>${d.visual === 'leyte' ? leyteMap() : ''}${d.visual === 'route' ? routeMap() : ''}</article>`).join('')}</div>`;
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
  if (detailsMode) {
    viewer.innerHTML = `<div class="spread"><section class="panel textPanel">${renderTypedText(page)}</section><section class="panel textPanel">${renderDetails(page)}</section></div>`;
  } else {
    viewer.innerHTML = `<div class="spread"><section class="panel manuscriptPanel"><img src="${page.image}" alt="Handwritten diary ${page.label}" /></section><section class="panel textPanel">${renderHandText(page)}</section></div>`;
  }
}
pages.forEach((page, idx) => {
  const opt = document.createElement('option'); opt.value = String(idx); opt.textContent = page.label; pageSelect.appendChild(opt);
});
document.getElementById('prevPage').addEventListener('click', () => { pageIndex = Math.max(0, pageIndex - 1); render(); });
document.getElementById('nextPage').addEventListener('click', () => { pageIndex = Math.min(pages.length - 1, pageIndex + 1); render(); });
pageSelect.addEventListener('change', e => { pageIndex = Number(e.target.value); render(); });
modeSwitch.addEventListener('change', e => { detailsMode = e.target.checked; render(); });
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { pageIndex = Math.max(0, pageIndex - 1); render(); }
  if (e.key === 'ArrowRight') { pageIndex = Math.min(pages.length - 1, pageIndex + 1); render(); }
});
render();
