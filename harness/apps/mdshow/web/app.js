(() => {
  const ACTIVATION_CLICK_MS = 500;
  const data = window.__MDSHOW__;
  const documents = data.documents;
  const comments = [];
  // The reader's own record of which files they finished, sent with the feedback.
  const reviewed = new Set();
  let editor = null;
  let activeDocId = documents[0]?.id ?? null;

  const docEl = document.getElementById("doc");
  const filesEl = document.getElementById("files");
  const reviewedEl = document.getElementById("reviewed");
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const progressEl = document.getElementById("progress");
  const overallEl = document.getElementById("overall");

  // One key per comment target, because block ids restart at b0 in every file.
  const key = (docId, blockId) => `${docId}/${blockId}`;
  const blockEls = new Map();
  const docViews = new Map();
  const optionEls = new Map();
  const docsById = new Map(documents.map((entry) => [entry.id, entry]));

  function label(block) {
    return block.endLine !== block.startLine ? `${block.startLine}-${block.endLine}` : `${block.startLine}`;
  }

  function shortName(path) {
    return path.split("/").pop();
  }

  for (const entry of documents) {
    const view = document.createElement("div");
    view.className = "docview";
    view.dataset.docId = entry.id;

    for (const block of entry.blocks) {
      const el = document.createElement("div");
      el.className = "block";
      el.dataset.id = block.id;
      const gutter = document.createElement("span");
      gutter.className = "gutter";
      gutter.textContent = block.startLine;
      el.appendChild(gutter);
      const content = document.createElement("div");
      content.innerHTML = block.html;
      el.appendChild(content);
      el.addEventListener("click", (event) => {
        if (event.target.closest("a") != null) return;
        // macOS hands the window-activating click to the page, which would open an
        // editor on whatever block sat under the cursor. Ignore that first click.
        if (performance.now() < ACTIVATION_CLICK_MS) return;
        openEditor(entry, block, el);
      });
      view.appendChild(el);
      blockEls.set(key(entry.id, block.id), el);
    }

    docEl.appendChild(view);
    docViews.set(entry.id, view);
  }

  for (const entry of documents) {
    const option = document.createElement("option");
    option.value = entry.id;
    filesEl.appendChild(option);
    optionEls.set(entry.id, option);
  }

  filesEl.disabled = documents.length < 2;
  filesEl.addEventListener("change", () => activate(filesEl.value));

  /** Each option carries the file's state, because only one is visible at a time. */
  function renderOptions() {
    for (const entry of documents) {
      const count = comments.filter((comment) => comment.docId === entry.id).length;
      const mark = reviewed.has(entry.id) ? "✓ " : "";
      const tail = count === 0 ? "" : ` · ${count} comment${count === 1 ? "" : "s"}`;
      optionEls.get(entry.id).textContent = `${mark}${entry.path}${tail}`;
    }

    const marked = reviewed.size;
    progressEl.textContent =
      documents.length < 2
        ? marked === 1
          ? "reviewed"
          : ""
        : `${marked}/${documents.length} reviewed`;

    const isReviewed = reviewed.has(activeDocId);
    reviewedEl.setAttribute("aria-pressed", String(isReviewed));
    reviewedEl.innerHTML = isReviewed
      ? 'Reviewed <kbd>⌘⇧R</kbd>'
      : 'Mark reviewed <kbd>⌘⇧R</kbd>';
  }

  function activate(docId) {
    if (docsById.get(docId) == null) return;
    closeEditor();
    activeDocId = docId;
    for (const [id, view] of docViews) view.hidden = id !== docId;
    filesEl.value = docId;
    docEl.scrollTop = docViews.get(docId).dataset.scrollTop ?? 0;
    renderOptions();
  }

  function toggleReviewed() {
    if (activeDocId == null) return;
    if (reviewed.has(activeDocId)) reviewed.delete(activeDocId);
    else reviewed.add(activeDocId);
    renderOptions();
  }

  reviewedEl.addEventListener("click", toggleReviewed);

  function closeEditor() {
    if (editor == null) return;
    editor.host.classList.remove("active");
    editor.el.remove();
    editor = null;
  }

  function openEditor(entry, block, host) {
    if (editor != null && editor.key === key(entry.id, block.id)) {
      editor.textarea.focus();
      return;
    }
    closeEditor();

    const el = document.createElement("div");
    el.className = "editor";
    el.innerHTML = `
      <div class="kinds">
        <button type="button" data-kind="fix" aria-pressed="true">FIX — change this</button>
        <button type="button" data-kind="discuss" aria-pressed="false">DISCUSS — explain this</button>
      </div>
      <textarea rows="3" placeholder="Comment on line ${label(block)}"></textarea>
      <div class="row">
        <span class="hint"></span>
        <button type="button" data-act="cancel">Cancel</button>
        <button type="button" class="primary" data-act="add">Add comment</button>
      </div>`;
    el.querySelector(".row .hint").textContent = `${entry.path}:${label(block)}`;

    const textarea = el.querySelector("textarea");
    let kind = "fix";

    el.querySelectorAll("[data-kind]").forEach((button) => {
      button.addEventListener("click", () => {
        kind = button.dataset.kind;
        el.querySelectorAll("[data-kind]").forEach((other) => {
          other.setAttribute("aria-pressed", String(other.dataset.kind === kind));
        });
        textarea.focus();
      });
    });

    const add = () => {
      const body = textarea.value.trim();
      if (body === "") {
        closeEditor();
        return;
      }
      comments.push({ docId: entry.id, blockId: block.id, kind, body });
      closeEditor();
      renderList();
    };

    el.querySelector('[data-act="add"]').addEventListener("click", add);
    el.querySelector('[data-act="cancel"]').addEventListener("click", closeEditor);
    el.addEventListener("click", (event) => event.stopPropagation());
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        event.stopPropagation();
        add();
      }
    });

    host.classList.add("active");
    host.insertAdjacentElement("afterend", el);
    editor = { el, key: key(entry.id, block.id), docId: entry.id, blockId: block.id, host, textarea, getKind: () => kind };
    textarea.focus();
  }

  function findBlock(comment) {
    return docsById.get(comment.docId)?.blocks.find((candidate) => candidate.id === comment.blockId);
  }

  function renderList() {
    listEl.textContent = "";
    for (const [index, comment] of comments.entries()) {
      const block = findBlock(comment);
      const path = docsById.get(comment.docId)?.path ?? "";
      const li = document.createElement("li");
      const loc = document.createElement("div");
      loc.className = "loc";
      const tag = document.createElement("span");
      tag.className = `tag ${comment.kind}`;
      tag.textContent = comment.kind.toUpperCase();
      const where = document.createElement("span");
      where.className = "where";
      where.textContent = block == null ? path : `${shortName(path)}:${label(block)}`;
      where.title = block == null ? path : `${path}:${label(block)}`;
      const drop = document.createElement("button");
      drop.className = "drop";
      drop.textContent = "✕";
      drop.title = "Remove comment";
      drop.addEventListener("click", (event) => {
        event.stopPropagation();
        comments.splice(index, 1);
        renderList();
      });
      loc.append(tag, where, drop);
      const body = document.createElement("div");
      body.className = "body";
      body.textContent = comment.body;
      li.append(loc, body);
      li.addEventListener("click", () => {
        // Jump across files too: the comment list is the whole review, not one tab.
        if (comment.docId !== activeDocId) activate(comment.docId);
        blockEls.get(key(comment.docId, comment.blockId))?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      listEl.appendChild(li);
    }

    for (const [id, el] of blockEls) {
      el.classList.toggle(
        "commented",
        comments.some((comment) => key(comment.docId, comment.blockId) === id),
      );
    }

    renderOptions();

    countEl.textContent =
      comments.length === 0 ? "no comments" : `${comments.length} comment${comments.length === 1 ? "" : "s"}`;
  }

  const submit = () => {
    if (editor != null) {
      const body = editor.textarea.value.trim();
      if (body !== "") {
        comments.push({ docId: editor.docId, blockId: editor.blockId, kind: editor.getKind(), body });
      }
      closeEditor();
    }
    window.glimpse.send({ type: "submit", overall: overallEl.value, comments, reviewed: [...reviewed] });
  };

  const cancel = () => window.glimpse.send({ type: "cancel" });

  document.getElementById("submit").addEventListener("click", submit);
  document.getElementById("cancel").addEventListener("click", cancel);

  function step(offset) {
    const index = documents.findIndex((entry) => entry.id === activeDocId);
    const next = documents[(index + offset + documents.length) % documents.length];
    if (next != null) activate(next.id);
  }

  // Remember where the reader was in each file, so switching back does not lose
  // their place in a long document.
  docEl.addEventListener("scroll", () => {
    const view = docViews.get(activeDocId);
    if (view != null) view.dataset.scrollTop = String(docEl.scrollTop);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (editor != null) closeEditor();
      else cancel();
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === "r" || event.key === "R")) {
      event.preventDefault();
      toggleReviewed();
      return;
    }
    if (documents.length < 2) return;
    if ((event.metaKey || event.ctrlKey) && event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    }
  });

  activate(activeDocId);
  renderList();
})();
