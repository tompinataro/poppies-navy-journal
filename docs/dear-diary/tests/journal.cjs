const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("node:assert/strict");
const root = require("node:path").resolve(__dirname, "..") + "/";
const html = fs.readFileSync(root + "index.html", "utf8");
const source = fs.readFileSync(root + "app.js", "utf8");
function boot(storage) {
  const dom = new JSDOM(html, {
    url: "http://localhost:8765/docs/dear-diary/",
    runScripts: "outside-only",
  });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.confirm = () => true;
  if (storage) w.localStorage.setItem("dear-diary-v1", storage);
  w.eval(source + "\nwindow.__test = { validate, submitForm };");
  return dom;
}
(async () => {
  const dom = boot(),
    w = dom.window,
    d = w.document;
  const q = (s) => d.querySelector(s);
  assert.equal(d.title, "Dear Diary.");
  assert.equal(q("#journalTitle").textContent, "Dear Diary.");
  assert.equal(q("#empty").hidden, false);
  q("#newPage").click();
  const form = q("#pageForm");
  form.elements.title.value = "A day by the lake";
  form.elements.body.value = "Blue water and a handwritten memory.";
  form.elements.notes.value = "Bring the family next time.";
  form.elements.tags.value = "Travel, Family, Travel";
  form.elements.links.value = "Lake map | https://example.com/map";
  form.elements.favorite.checked = true;
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q("#allCount").textContent, "1");
  assert.equal(q("#favoriteCount").textContent, "1");
  assert.equal(q("#pageDialog").open, false);
  assert.equal(d.querySelectorAll(".chip").length, 2);
  let saved = w.localStorage.getItem("dear-diary-v1");
  assert.equal(
    JSON.parse(saved).pages[0].links[0].url,
    "https://example.com/map",
  );
  q("[data-action=read]").click();
  assert.match(q("#readerContent").textContent, /Bring the family/);
  assert.equal(q("#readerContent a").rel, "noopener noreferrer");
  q("#readerDialog").close();
  q("#search").value = "nonexistent";
  q("#search").dispatchEvent(new w.Event("input"));
  assert.equal(q("#empty").hidden, false);
  q("#search").value = "family";
  q("#search").dispatchEvent(new w.Event("input"));
  assert.equal(d.querySelectorAll(".card").length, 1);
  q("#search").value = "";
  q("#search").dispatchEvent(new w.Event("input"));
  q("[data-action=edit]").click();
  form.elements.links.value = "bad | javascript:alert(1)";
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q("#pageDialog").open, true);
  assert.equal(w.localStorage.getItem("dear-diary-v1"), saved);
  form.elements.links.value = "";
  form.elements.title.value = "<img src=x onerror=alert(1)>";
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q(".card h3 img"), null);
  assert.match(q(".card h3").textContent, /<img/);
  const restored = boot(w.localStorage.getItem("dear-diary-v1"));
  assert.equal(
    restored.window.document.querySelector("#allCount").textContent,
    "1",
  );
  restored.window.close();
  q("#settingsButton").click();
  const settings = q("#settingsForm");
  settings.elements.title.value = "My Family Stories";
  settings.elements.theme.value = "ocean";
  settings.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q("#journalTitle").textContent, "My Family Stories");
  assert.equal(q("#settingsDialog").open, false);
  const valid = JSON.parse(w.localStorage.getItem("dear-diary-v1"));
  for (const mutate of [
    (s) => s.pages.push(s.pages[0]),
    (s) => (s.pages[0].links = [{ label: "x", url: "javascript:alert(1)" }]),
    (s) => (s.cover = "https://remote.test/image.jpg"),
    (s) => (s.theme = "__proto__"),
  ]) {
    const invalid = structuredClone(valid);
    mutate(invalid);
    assert.throws(() => w.__test.validate(invalid), /backup|page/);
  }
  // Storage errors must preserve both existing data and the open editor.
  q("[data-action=edit]").click();
  const before = w.localStorage.getItem("dear-diary-v1");
  form.elements.title.value = "Unsaved";
  const original = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => {
    throw Error("quota");
  };
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q("#pageDialog").open, true);
  assert.equal(w.localStorage.getItem("dear-diary-v1"), before);
  w.Storage.prototype.setItem = original;
  q("#pageDialog").close();
  q("#newPage").click();
  form.elements.title.value = "An earlier memory";
  form.elements.date.value = "";
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q("#allCount").textContent, "2");
  d.querySelectorAll("[data-action=edit]")[1].click();
  assert.equal(form.elements.date.value, "");
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(
    JSON.parse(w.localStorage.getItem("dear-diary-v1")).pages[1].date,
    "",
  );
  q("[data-action=down]").click();
  assert.equal(q(".card h3").textContent, "An earlier memory");
  q("#sort").value = "oldest";
  q("#sort").dispatchEvent(new w.Event("change"));
  assert.equal(q(".card h3").textContent, "An earlier memory");
  q('[data-filter="favorites"]').click();
  assert.equal(d.querySelectorAll(".card").length, 1);
  q('[data-filter="all"]').click();
  q('[data-tag="Family"]').click();
  assert.equal(d.querySelectorAll(".card").length, 1);
  q('[data-tag="Family"]').click();
  q("[data-action=read]").click();
  assert.equal(q("#readerPosition").textContent, "1 of 2");
  q("#nextPage").click();
  assert.equal(q("#readerPosition").textContent, "2 of 2");
  q("#readerDialog").close();
  w.confirm = () => false;
  q("[data-action=delete]").click();
  assert.equal(q("#allCount").textContent, "2");
  w.confirm = () => true;
  q("[data-action=delete]").click();
  assert.equal(q("#allCount").textContent, "1");
  let exportedBlob;
  let downloadName;
  w.Blob = Blob;
  w.URL.createObjectURL = (blob) => {
    exportedBlob = blob;
    return "blob:test-backup";
  };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    downloadName = this.download;
  };
  q("#backup").click();
  const backup = await exportedBlob.text();
  assert.deepEqual(
    JSON.parse(backup),
    JSON.parse(w.localStorage.getItem("dear-diary-v1")),
  );
  assert.match(downloadName, /^dear-diary-backup-.*\.json$/);
  const currentBeforeRestore = w.localStorage.getItem("dear-diary-v1");

  Object.defineProperty(q("#importFile"), "files", {
    configurable: true,
    value: [{ size: backup.length, text: async () => backup }],
  });
  w.confirm = () => false;
  await q("#importFile").onchange({ target: q("#importFile") });
  assert.equal(w.localStorage.getItem("dear-diary-v1"), currentBeforeRestore);
  w.confirm = () => true;
  await q("#importFile").onchange({ target: q("#importFile") });
  assert.deepEqual(
    JSON.parse(w.localStorage.getItem("dear-diary-v1")),
    JSON.parse(backup),
  );
  Object.defineProperty(q("#importFile"), "files", {
    configurable: true,
    value: [{ size: 8, text: async () => "bad json" }],
  });
  await q("#importFile").onchange({ target: q("#importFile") });
  assert.deepEqual(
    JSON.parse(w.localStorage.getItem("dear-diary-v1")),
    JSON.parse(backup),
  );
  assert.match(q("#toast").textContent, /not valid JSON/);
  q("[data-action=edit]").click();
  let resolvePending;
  const pending = w.__test.submitForm(
    { preventDefault() {}, target: form },
    () =>
      new Promise((resolve) => {
        resolvePending = resolve;
      }),
  );
  assert.equal(form.elements.title.disabled, true);
  assert.equal(form.querySelector("[data-close]").disabled, true);
  const cancel = new w.Event("cancel", { cancelable: true });
  q("#pageDialog").dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  resolvePending();
  await pending;
  assert.equal(form.elements.title.disabled, false);
  // Simulate the shared storage value written by another browser tab.
  const external = JSON.parse(w.localStorage.getItem("dear-diary-v1"));
  external.pages.push({
    ...external.pages[0],
    id: "other-tab-page",
    title: "Saved in another tab",
  });
  const externalSnapshot = JSON.stringify(external);
  w.localStorage.setItem("dear-diary-v1", externalSnapshot);
  form.elements.title.value = "Stale tab edit";
  form.dispatchEvent(new w.Event("submit", { cancelable: true }));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(w.localStorage.getItem("dear-diary-v1"), externalSnapshot);
  assert.equal(q("#pageDialog").open, true);
  assert.match(q("#toast").textContent, /changed in another tab/);
  console.log(
    "PASS: blank start, create/read/edit, tags, favorites, search, persistence/reload, customization, XSS escaping, unsafe links, malformed backups, storage failure, reorder, date sort, tag/favorite filters, reader navigation, confirmed deletion, and restore.",
  );
  dom.window.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
