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
  return `<div class="handText">${page.paragraphs.map(p => `<p>${lineSplit(p, page.num === 51 ? 32 : 21).map(line => `<span class="line">${escapeHtml(line)}</span>`).join('')}</p>`).join('')}</div>`;
}
function renderTypedText(page) {
  return `<div class="typedText">${page.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>`;
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
  if (detailsMode) {
    viewer.innerHTML = `<div class="spread"><section class="panel">${renderTypedText(page)}</section><section class="panel">${renderDetails(page)}</section></div>`;
  } else {
    viewer.innerHTML = `<div class="spread"><section class="panel manuscriptPanel"><img src="${page.image}" alt="Handwritten diary ${page.label}" /></section><section class="panel">${renderHandText(page)}</section></div>`;
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
