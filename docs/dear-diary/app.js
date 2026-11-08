"use strict";
const $ = (s) => document.querySelector(s);
const KEY = "dear-diary-v1";
const themes = {
  forest: ["#355d50", "#e7ede7"],
  ocean: ["#315a70", "#e5edf0"],
  plum: ["#694459", "#eee5eb"],
};
const prompts = [
  "What ordinary moment from today would you like to remember years from now?",
  "Write about someone who made you feel at home.",
  "Choose an old photograph. What happened just outside the frame?",
  "What is a place you carry with you, even when you are far away?",
  "What would you like a future family member to know about your life today?",
];
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const starter = () => ({
  version: 1,
  title: "Dear Diary.",
  subtitle:
    "A home for your stories, your photographs, and all the little things worth remembering.",
  owner: "A journal by you",
  theme: "forest",
  cover: "",
  pages: [],
});
function safeUrl(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
function validImage(value) {
  return (
    typeof value === "string" &&
    (value === "" ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))
  );
}
function validate(data) {
  if (
    !data ||
    data.version !== 1 ||
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 100 ||
    typeof data.subtitle !== "string" ||
    data.subtitle.length > 400 ||
    typeof data.owner !== "string" ||
    data.owner.length > 100 ||
    !Object.hasOwn(themes, data.theme) ||
    !validImage(data.cover) ||
    !Array.isArray(data.pages) ||
    data.pages.length > 2000
  )
    throw Error("This is not a supported Dear Diary backup.");
  const ids = new Set();
  const pages = data.pages.map((p) => {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.title !== "string" ||
      !p.title.trim() ||
      p.title.length > 150 ||
      typeof p.date !== "string" ||
      (p.date !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) ||
      !["body", "notes", "caption"].every((k) => typeof p[k] === "string") ||
      !validImage(p.image) ||
      typeof p.favorite !== "boolean" ||
      !Array.isArray(p.tags) ||
      !p.tags.every((t) => typeof t === "string") ||
      !Array.isArray(p.links) ||
      !p.links.every(
        (l) =>
          l &&
          typeof l.label === "string" &&
          typeof l.url === "string" &&
          safeUrl(l.url),
      )
    )
      throw Error("The backup contains an invalid page.");
    ids.add(p.id);
    return {
      id: p.id,
      title: p.title,
      date: p.date,
      body: p.body,
      notes: p.notes,
      caption: p.caption,
      image: p.image,
      favorite: p.favorite,
      tags: p.tags,
      links: p.links.map((l) => ({ label: l.label, url: safeUrl(l.url) })),
    };
  });
  return {
    version: 1,
    title: data.title,
    subtitle: data.subtitle,
    owner: data.owner,
    theme: data.theme,
    cover: data.cover,
    pages,
  };
}
let state = starter(),
  filter = "all",
  tag = "",
  readerId = "",
  toastTimer,
  savedSnapshot = null;
try {
  const stored = localStorage.getItem(KEY);
  savedSnapshot = stored;
  if (stored) state = validate(JSON.parse(stored));
} catch {
  setTimeout(
    () =>
      toast(
        "Saved data could not be read. Restore a backup if you have one; existing storage has not been changed.",
      ),
    100,
  );
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 6500);
}
function persist(next) {
  try {
    if (localStorage.getItem(KEY) !== savedSnapshot) {
      $("#saveStatus").textContent = "Changes not saved";
      toast(
        "This journal changed in another tab. Copy any unsaved text, then reload before saving.",
      );
      return false;
    }
    const serialized = JSON.stringify(next);
    localStorage.setItem(KEY, serialized);
    savedSnapshot = serialized;
    state = next;
    $("#saveStatus").textContent = "Saved on this browser";
    render();
    return true;
  } catch {
    $("#saveStatus").textContent = "Changes not saved";
    toast(
      "Could not save. Browser storage may be full or unavailable. Export a backup of saved pages, then try a smaller image.",
    );
    return false;
  }
}
function visiblePages() {
  let pages = state.pages.filter(
    (p) =>
      (filter !== "favorites" || p.favorite) && (!tag || p.tags.includes(tag)),
  );
  const q = $("#search").value.trim().toLowerCase();
  if (q)
    pages = pages.filter((p) =>
      [
        p.title,
        p.body,
        p.notes,
        p.caption,
        ...p.tags,
        ...p.links.map((l) => l.label + " " + l.url),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  const sort = $("#sort").value;
  if (sort !== "manual")
    pages = [...pages].sort((a, b) =>
      sort === "newest"
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date),
    );
  return pages;
}
function dateLabel(value) {
  if (!value) return "UNDATED";
  const d = new Date(value + "T12:00:00");
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}
function render() {
  const [accent, soft] = themes[state.theme];
  document.documentElement.style.setProperty("--accent", accent);
  document.documentElement.style.setProperty("--accent-soft", soft);
  $("#journalTitle").textContent = state.title;
  $("#journalSubtitle").textContent = state.subtitle;
  $("#journalOwner").textContent = state.owner || "A journal by you";
  $("#coverArt").style.backgroundImage = state.cover
    ? `url("${state.cover}")`
    : "";
  $("#coverArt").classList.toggle("has-photo", !!state.cover);
  $("#coverArt").setAttribute("role", "img");
  $("#coverArt").setAttribute(
    "aria-label",
    state.cover
      ? "Your journal cover photograph"
      : "Decorative journal cover: Every life holds a story.",
  );
  $("#allCount").textContent = state.pages.length;
  $("#favoriteCount").textContent = state.pages.filter(
    (p) => p.favorite,
  ).length;
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) => b.classList.toggle("active", b.dataset.filter === filter));
  const tags = [...new Set(state.pages.flatMap((p) => p.tags))].sort();
  if (tag && !tags.includes(tag)) tag = "";
  $("#tagList").innerHTML = tags.length
    ? tags
        .map(
          (t) =>
            `<button class="tag ${tag === t ? "active" : ""}" data-tag="${esc(t)}"># ${esc(t)}</button>`,
        )
        .join("")
    : '<p class="privacy">Add tags to your pages to find them here.</p>';
  $("#collectionTitle").textContent = tag
    ? `# ${tag}`
    : filter === "favorites"
      ? "Favorite pages"
      : "Your pages";
  const pages = visiblePages();
  const pageOrder = new Map(state.pages.map((page, index) => [page.id, index]));
  $("#empty").hidden = pages.length > 0;
  const narrowed = filter !== "all" || tag || $("#search").value.trim();
  $("#emptyTitle").textContent = narrowed
    ? "No pages found."
    : "Your story starts here.";
  $("#emptyCopy").textContent = narrowed
    ? "Try another search, tag, or collection."
    : "Add a written entry, a photograph, or a scanned journal page.";
  $("#pages").innerHTML = pages
    .map(
      (p) =>
        `<article class="card"><button class="card-preview" data-action="read" data-id="${esc(p.id)}" aria-label="Read ${esc(p.title)}">${p.image ? `<img src="${p.image}" alt="${esc(p.caption || p.title)}" loading="lazy" decoding="async">` : `<span class="quote">${esc(p.body || "A moment, kept forever.")}</span>`}</button><div class="card-copy"><div class="card-meta">${esc(dateLabel(p.date))}${p.image ? " · PHOTO / SCAN" : ""}</div><h3><button class="title-button" data-action="read" data-id="${esc(p.id)}">${esc(p.title)}</button></h3><p class="excerpt">${esc(p.body || p.notes || p.caption)}</p>${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div><div class="card-actions"><button class="star" data-action="favorite" data-id="${esc(p.id)}" aria-label="${p.favorite ? "Remove from" : "Add to"} favorites" aria-pressed="${p.favorite}">${p.favorite ? "★" : "☆"}</button><div><button data-action="up" data-id="${esc(p.id)}" aria-label="Move page earlier" ${pageOrder.get(p.id) === 0 ? "disabled" : ""}>↑</button><button data-action="down" data-id="${esc(p.id)}" aria-label="Move page later" ${pageOrder.get(p.id) === state.pages.length - 1 ? "disabled" : ""}>↓</button><button data-action="edit" data-id="${esc(p.id)}">Edit</button><button data-action="delete" data-id="${esc(p.id)}">Delete</button></div></div></article>`,
    )
    .join("");
}
function showSettings() {
  const f = $("#settingsForm");
  f.reset();
  for (const key of ["title", "subtitle", "owner", "theme"])
    f.elements[key].value = state[key];
  $("#settingsDialog").showModal();
}
function editPage(id = "", prompt = "") {
  const f = $("#pageForm");
  f.reset();
  const p = state.pages.find((p) => p.id === id);
  $("#editorTitle").textContent = p ? "Edit page" : "Add a page";
  f.elements.id.value = p?.id || "";
  for (const k of ["title", "date", "body", "notes", "caption"])
    f.elements[k].value =
      p?.[k] ?? (k === "date" ? today() : k === "body" ? prompt : "");
  f.elements.tags.value = p?.tags.join(", ") || "";
  f.elements.links.value =
    p?.links.map((l) => `${l.label} | ${l.url}`).join("\n") || "";
  f.elements.favorite.checked = p?.favorite || false;
  $("#pageDialog").showModal();
}
function showReader(id) {
  const p = state.pages.find((p) => p.id === id);
  if (!p) return;
  readerId = id;
  $("#readerContent").innerHTML =
    `<div class="card-meta">${esc(dateLabel(p.date))}</div><h2>${esc(p.title)}</h2><div class="reader-columns ${p.image ? "" : "no-image"}">${p.image ? `<figure><img src="${p.image}" alt="${esc(p.caption || p.title)}"><figcaption>${esc(p.caption)}</figcaption></figure>` : ""}<div><div class="prose">${esc(p.body)}</div>${p.notes ? `<section class="reader-notes"><h3>Notes</h3>${esc(p.notes)}</section>` : ""}${p.links.length ? `<h3>Related links</h3><ul class="reader-links">${p.links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a></li>`).join("")}</ul>` : ""}${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div></div>`;
  const pages = visiblePages(),
    i = pages.findIndex((p) => p.id === id);
  $("#readerPosition").textContent = `${i + 1} of ${pages.length}`;
  $("#prevPage").disabled = i <= 0;
  $("#nextPage").disabled = i >= pages.length - 1;
  if (!$("#readerDialog").open) $("#readerDialog").showModal();
  $("#readerDialog").scrollTop = 0;
}
function imageData(file) {
  return new Promise((resolve, reject) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return reject(Error("Choose a JPG, PNG, or WebP image."));
    if (file.size > 20 * 1024 * 1024)
      return reject(Error("Choose an image smaller than 20 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(Error("The image could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(Error("The image could not be opened."));
      img.onload = () => {
        try {
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch {
          reject(Error("The image could not be processed."));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
async function submitForm(event, work) {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.busy) return;
  form.dataset.busy = "true";
  form.setAttribute("aria-busy", "true");
  const controls = [...form.elements].map((control) => [
    control,
    control.disabled,
  ]);
  controls.forEach(([control]) => (control.disabled = true));
  try {
    await work();
  } catch (e) {
    toast(
      e.message || "Something went wrong. Your saved journal has not changed.",
    );
  } finally {
    controls.forEach(([control, disabled]) => (control.disabled = disabled));
    delete form.dataset.busy;
    form.removeAttribute("aria-busy");
  }
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("cancel", (event) => {
    if (dialog.querySelector("form[data-busy]")) event.preventDefault();
  });
}

$("#settingsForm").addEventListener("submit", (e) =>
  submitForm(e, async () => {
    const f = e.target;
    const next = {
      ...state,
      title: f.elements.title.value.trim(),
      subtitle: f.elements.subtitle.value.trim(),
      owner: f.elements.owner.value.trim(),
      theme: f.elements.theme.value,
      cover: f.elements.removeCover.checked ? "" : state.cover,
    };
    if (!next.title) throw Error("Enter a journal title.");
    const image = f.elements.cover.files[0];
    if (image) next.cover = await imageData(image);
    if (persist(next)) $("#settingsDialog").close();
  }),
);
$("#pageForm").addEventListener("submit", (e) =>
  submitForm(e, async () => {
    const f = e.target;
    const old = state.pages.find((p) => p.id === f.elements.id.value);
    const links = f.elements.links.value
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.split("|");
        const url = safeUrl(
          parts.length > 1 ? parts.slice(1).join("|").trim() : parts[0].trim(),
        );
        if (!url)
          throw Error("Each link must use a full http:// or https:// address.");
        return { label: parts.length > 1 ? parts[0].trim() || url : url, url };
      });
    const page = {
      id: old?.id || crypto.randomUUID(),
      title: f.elements.title.value.trim(),
      date: f.elements.date.value,
      body: f.elements.body.value,
      notes: f.elements.notes.value,
      caption: f.elements.caption.value,
      tags: [
        ...new Set(
          f.elements.tags.value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        ),
      ],
      favorite: f.elements.favorite.checked,
      links,
      image: f.elements.removeImage.checked ? "" : old?.image || "",
    };
    if (!page.title) throw Error("Enter a page title.");
    if (f.elements.image.files[0])
      page.image = await imageData(f.elements.image.files[0]);
    const pages = old
      ? state.pages.map((p) => (p.id === old.id ? page : p))
      : [...state.pages, page];
    if (persist({ ...state, pages })) $("#pageDialog").close();
  }),
);
$("#pages").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  const id = b.dataset.id,
    action = b.dataset.action,
    p = state.pages.find((p) => p.id === id);
  if (!p) return;
  if (action === "read") return showReader(id);
  if (action === "edit") return editPage(id);
  if (action === "delete") {
    if (
      confirm(
        `Delete “${p.title}”? Export a backup first if you want to keep it.`,
      )
    )
      persist({ ...state, pages: state.pages.filter((p) => p.id !== id) });
    return;
  }
  if (action === "favorite")
    persist({
      ...state,
      pages: state.pages.map((p) =>
        p.id === id ? { ...p, favorite: !p.favorite } : p,
      ),
    });
  if (action === "up" || action === "down") {
    const pages = [...state.pages],
      i = pages.findIndex((p) => p.id === id),
      j = i + (action === "up" ? -1 : 1);
    if (j < 0 || j >= pages.length) return;
    [pages[i], pages[j]] = [pages[j], pages[i]];
    $("#sort").value = "manual";
    persist({ ...state, pages });
  }
});
$("#tagList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tag]");
  if (b) {
    tag = tag === b.dataset.tag ? "" : b.dataset.tag;
    render();
  }
});
document.querySelectorAll("[data-filter]").forEach(
  (b) =>
    (b.onclick = () => {
      filter = b.dataset.filter;
      tag = "";
      render();
    }),
);
document
  .querySelectorAll("[data-close]")
  .forEach((b) => (b.onclick = () => b.closest("dialog").close()));
$("#settingsButton").onclick = showSettings;
$("#coverButton").onclick = showSettings;
$("#newPage").onclick = () => editPage();
$("#promptButton").onclick = () =>
  editPage("", prompts[Math.floor(Math.random() * prompts.length)]);
$("#search").oninput = render;
$("#sort").onchange = render;
for (const [selector, offset] of [
  ["#prevPage", -1],
  ["#nextPage", 1],
])
  $(selector).onclick = () => {
    const pages = visiblePages(),
      i = pages.findIndex((p) => p.id === readerId);
    if (pages[i + offset]) showReader(pages[i + offset].id);
  };
$("#backup").onclick = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `dear-diary-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(
    "Backup exported. Keep it somewhere safe; it includes your photos and writing.",
  );
};
$("#restore").onclick = () => $("#importFile").click();
$("#importFile").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 25 * 1024 * 1024)
      throw Error("This backup is larger than the 25 MB import limit.");
    const next = validate(JSON.parse(await file.text()));
    if (
      confirm(
        "Replace this browser’s journal with this backup? Export your current journal first if you want to keep it.",
      )
    ) {
      if (persist(next)) {
        filter = "all";
        tag = "";
        $("#search").value = "";
        render();
        toast("Your journal has been restored.");
      }
    }
  } catch (error) {
    toast(
      error instanceof SyntaxError
        ? "This file is not valid JSON. Choose a Dear Diary backup."
        : error.message,
    );
  } finally {
    e.target.value = "";
  }
};
render();
