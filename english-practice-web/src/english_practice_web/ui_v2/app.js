(function () {
  "use strict";

  const API_BASE = "/api/v1";
  const ALPHA = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const VALID_VIEWS = new Set(["practice", "recite", "select"]);

  const state = {
    phrases: [],
    notesCache: {},
    marksCache: {},
    plans: [],
    activePlan: null,
    currentPhrase: null,
    view: "practice",
    selectFilter: "all",
    selectedSet: new Set(),
    collapsed: {},
    revealed: false,
    practiceFeedback: "",
    reciteFeedback: "",
    modal: { mode: "add", note: null },
  };

  const refs = {};
  let toastTimer = 0;

  const api = {
    listPhrases: () => fetchJson(`${API_BASE}/list`),
    listNotes: () => fetchJson(`${API_BASE}/notes`),
    listPlans: () => fetchJson(`${API_BASE}/plans`),
    listMarks: () => fetchJson(`${API_BASE}/marks`),
    createNote: (phrase, note) =>
      fetchJson(`${API_BASE}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, note }),
      }),
    updateNote: (id, note) =>
      fetchJson(`${API_BASE}/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      }),
    deleteNote: (id) => fetchJson(`${API_BASE}/notes/${id}`, { method: "DELETE" }),
    checkSentence: (phrase, sentence) =>
      fetchJson(`${API_BASE}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, sentence }),
      }),
    checkRecite: (phrase, chineseInput) =>
      fetchJson(`${API_BASE}/check-recite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, chinese_input: chineseInput }),
      }),
    savePlan: (name, words) =>
      fetchJson(`${API_BASE}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, words }),
      }),
    deletePlan: (name) => fetchJson(`${API_BASE}/plans/${encodeURIComponent(name)}`, { method: "DELETE" }),
    saveMark: (phrase, status) =>
      fetchJson(`${API_BASE}/marks/${encodeURIComponent(phrase)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    resetSystem: () => fetchJson(`${API_BASE}/admin/reset`, { method: "POST" }),
  };

  window.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheRefs();
    bindEvents();
    refs.defaultView.value = localStorage.getItem("defaultView") || "practice";

    try {
      await loadData();
      const initialView = normalizeView(location.hash.slice(1) || refs.defaultView.value);
      setView(initialView, { updateHash: !location.hash });
      renderAll();
    } catch (err) {
      showToast(`Failed to load UI data: ${err.message}`);
      renderAll();
    }
  }

  function cacheRefs() {
    refs.alphaBar = $("#alphaBar");
    refs.wordList = $("#wordList");
    refs.activePlanBadge = $("#activePlanBadge");
    refs.statusText = $("#statusText");
    refs.mainShell = $("#mainShell");
    refs.pages = {
      practice: $("#page-practice"),
      recite: $("#page-recite"),
      select: $("#page-select"),
    };
    refs.practicePrev = $("#practicePrev");
    refs.practiceNext = $("#practiceNext");
    refs.practicePosition = $("#practicePosition");
    refs.practiceEmpty = $("#practiceEmpty");
    refs.practiceBody = $("#practiceBody");
    refs.practiceTitle = $("#practiceTitle");
    refs.practiceMeanings = $("#practiceMeanings");
    refs.practiceExample = $("#practiceExample");
    refs.practiceSentence = $("#practiceSentence");
    refs.practiceCheck = $("#practiceCheck");
    refs.practiceFeedback = $("#practiceFeedback");
    refs.recitePrev = $("#recitePrev");
    refs.reciteNext = $("#reciteNext");
    refs.recitePosition = $("#recitePosition");
    refs.reciteEmpty = $("#reciteEmpty");
    refs.reciteBody = $("#reciteBody");
    refs.reciteTitle = $("#reciteTitle");
    refs.reciteExample = $("#reciteExample");
    refs.reciteMeanings = $("#reciteMeanings");
    refs.reciteHint = $("#reciteHint");
    refs.reciteInput = $("#reciteInput");
    refs.revealMeaning = $("#revealMeaning");
    refs.reciteCheck = $("#reciteCheck");
    refs.reciteFeedback = $("#reciteFeedback");
    refs.notesPanel = $("#notesPanel");
    refs.notesTitle = $("#notesTitle");
    refs.addNote = $("#addNote");
    refs.notesList = $("#notesList");
    refs.defaultView = $("#defaultView");
    refs.planSelect = $("#planSelect");
    refs.planName = $("#planName");
    refs.planDays = $("#planDays");
    refs.autoCreatePlan = $("#autoCreatePlan");
    refs.randomSelect = $("#randomSelect");
    refs.savePlan = $("#savePlan");
    refs.deletePlan = $("#deletePlan");
    refs.deleteAllPlans = $("#deleteAllPlans");
    refs.resetSystem = $("#resetSystem");
    refs.selectedCount = $("#selectedCount");
    refs.selectGrid = $("#selectGrid");
    refs.modalOverlay = $("#modalOverlay");
    refs.modalTitle = $("#modalTitle");
    refs.modalText = $("#modalText");
    refs.modalMeta = $("#modalMeta");
    refs.modalDelete = $("#modalDelete");
    refs.modalCancel = $("#modalCancel");
    refs.modalClose = $("#modalClose");
    refs.modalSave = $("#modalSave");
    refs.toast = $("#toast");
  }

  function bindEvents() {
    $all("[data-view-tab]").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.viewTab));
    });

    refs.alphaBar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-alpha]");
      if (!button || button.disabled) return;
      const head = refs.wordList.querySelector(`[data-letter-head="${button.dataset.alpha}"]`);
      if (head) head.scrollIntoView({ block: "start", behavior: "smooth" });
    });

    refs.wordList.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-letter-toggle]");
      if (toggle) {
        const letter = toggle.dataset.letterToggle;
        state.collapsed[letter] = !state.collapsed[letter];
        renderSidebar();
        return;
      }

      const word = event.target.closest("[data-word]");
      if (word) selectPhraseByName(word.dataset.word);
    });

    refs.practicePrev.addEventListener("click", () => navigate(-1));
    refs.practiceNext.addEventListener("click", () => navigate(1));
    refs.recitePrev.addEventListener("click", () => navigate(-1));
    refs.reciteNext.addEventListener("click", () => navigate(1));
    refs.practiceCheck.addEventListener("click", checkPractice);
    refs.reciteCheck.addEventListener("click", checkRecite);
    refs.revealMeaning.addEventListener("click", () => {
      state.revealed = !state.revealed;
      renderRecite();
    });

    refs.reciteMeanings.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mark-status]");
      if (!button) return;
      const meaning = currentMeanings().find((m) => String(m.meaning_index) === button.dataset.meaningIndex);
      if (meaning) saveMark(meaning, button.dataset.markStatus, button);
    });

    refs.addNote.addEventListener("click", () => openNoteModal("add"));
    refs.notesList.addEventListener("click", handleNoteClick);
    refs.modalCancel.addEventListener("click", closeNoteModal);
    refs.modalClose.addEventListener("click", closeNoteModal);
    refs.modalOverlay.addEventListener("click", (event) => {
      if (event.target === refs.modalOverlay) closeNoteModal();
    });
    refs.modalSave.addEventListener("click", saveModalNote);
    refs.modalDelete.addEventListener("click", deleteModalNote);

    refs.defaultView.addEventListener("change", () => {
      localStorage.setItem("defaultView", refs.defaultView.value);
      showToast("Default view saved.");
    });

    refs.planSelect.addEventListener("change", () => {
      const plan = state.plans.find((item) => item.name === refs.planSelect.value) || null;
      setActivePlan(plan);
      renderAll();
    });

    refs.autoCreatePlan.addEventListener("click", () => autoCreatePlans(refs.autoCreatePlan));
    refs.randomSelect.addEventListener("click", randomSelect20);
    refs.savePlan.addEventListener("click", () => saveManualPlan(refs.savePlan));
    refs.deletePlan.addEventListener("click", () => deleteCurrentPlan(refs.deletePlan));
    refs.deleteAllPlans.addEventListener("click", () => deleteAllPlans(refs.deleteAllPlans));
    refs.resetSystem.addEventListener("click", resetSystem);

    $all("[data-select-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectFilter = button.dataset.selectFilter;
        renderSelect();
      });
    });

    refs.selectGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-select-word]");
      if (!button) return;
      toggleSelectedWord(button.dataset.selectWord);
    });

    window.addEventListener("hashchange", () => {
      setView(normalizeView(location.hash.slice(1)), { updateHash: false });
    });
  }

  async function loadData() {
    setStatus("Loading");
    const [phrases, notes, plans, marks] = await Promise.all([
      api.listPhrases(),
      api.listNotes(),
      api.listPlans(),
      api.listMarks(),
    ]);
    state.phrases = Array.isArray(phrases) ? phrases : [];
    state.notesCache = notes && typeof notes === "object" ? notes : {};
    state.plans = Array.isArray(plans) ? plans : [];
    state.marksCache = marks && typeof marks === "object" ? marks : {};
    restoreActivePlan();
    ensureCurrentPhrase();
  }

  function renderAll() {
    renderStatus();
    renderAlphaBar();
    renderSidebar();
    renderPractice();
    renderRecite();
    renderNotes();
    renderSelect();
  }

  function renderStatus() {
    const visible = navList().length;
    const total = state.phrases.length;
    const plan = state.activePlan ? ` | ${state.activePlan.name}` : "";
    setStatus(`${visible} / ${total} words${plan}`);
  }

  function renderAlphaBar() {
    const groups = groupsFor(navList());
    const activeLetter = state.currentPhrase ? state.currentPhrase.phrase.charAt(0).toUpperCase() : "";
    clear(refs.alphaBar);
    ALPHA.forEach((letter) => {
      const hasWords = !!groups[letter];
      refs.alphaBar.appendChild(
        el("button", {
          type: "button",
          class: `alpha-chip${hasWords ? " available" : " empty"}${letter === activeLetter ? " active" : ""}`,
          text: letter,
          dataset: { alpha: letter },
          disabled: !hasWords,
        }),
      );
    });
  }

  function renderSidebar() {
    const groups = groupsFor(navList());
    const letters = Object.keys(groups).sort();

    if (state.activePlan) {
      refs.activePlanBadge.hidden = false;
      refs.activePlanBadge.textContent = state.activePlan.name;
    } else {
      refs.activePlanBadge.hidden = true;
      refs.activePlanBadge.textContent = "";
    }

    clear(refs.wordList);
    if (!letters.length) {
      refs.wordList.appendChild(el("div", { class: "empty-state", text: "No words" }));
      return;
    }

    letters.forEach((letter) => {
      const group = el("section", { class: "letter-group" });
      const collapsed = !!state.collapsed[letter];
      group.appendChild(
        el("button", {
          type: "button",
          class: "letter-head",
          dataset: { letterToggle: letter, letterHead: letter },
        }, [
          el("span", { text: letter }),
          el("span", { class: "letter-count", text: String(groups[letter].length) }),
          el("span", { class: "letter-arrow", text: collapsed ? ">" : "v" }),
        ]),
      );

      const items = el("div", { class: `word-items${collapsed ? " collapsed" : ""}` });
      groups[letter].forEach((phrase) => {
        const isActive = state.currentPhrase && state.currentPhrase.phrase === phrase.phrase;
        const dots = el("span", { class: "dot-row" });
        if (hasNotes(phrase)) dots.appendChild(el("span", { class: "dot note", title: "Has notes" }));
        const mark = getPhraseMarkStatus(phrase);
        if (mark) dots.appendChild(el("span", { class: `dot ${mark}`, title: getPhraseMarkTitle(phrase) }));

        items.appendChild(
          el("button", {
            type: "button",
            class: `word-item${isActive ? " active" : ""}`,
            dataset: { word: phrase.phrase },
          }, [
            el("span", { class: "word-name", text: phrase.phrase }),
            dots,
          ]),
        );
      });
      group.appendChild(items);
      refs.wordList.appendChild(group);
    });
  }

  function renderPractice() {
    const phrase = state.currentPhrase;
    updateNav(refs.practicePosition, refs.practicePrev, refs.practiceNext);
    refs.practiceEmpty.hidden = !!phrase;
    refs.practiceBody.hidden = !phrase;
    if (!phrase) return;

    refs.practiceTitle.textContent = phrase.phrase;
    refs.practiceExample.textContent = phrase.example || "";
    renderMeaningList(refs.practiceMeanings, currentMeanings());
    renderFeedback(refs.practiceFeedback, state.practiceFeedback);
  }

  function renderRecite() {
    const phrase = state.currentPhrase;
    updateNav(refs.recitePosition, refs.recitePrev, refs.reciteNext);
    refs.reciteEmpty.hidden = !!phrase;
    refs.reciteBody.hidden = !phrase;
    if (!phrase) return;

    refs.reciteTitle.textContent = phrase.phrase;
    refs.reciteExample.textContent = phrase.example || "";
    refs.revealMeaning.textContent = state.revealed ? "Hide Meaning" : "Show Meaning";
    refs.reciteHint.classList.toggle("revealed", state.revealed);
    refs.reciteHint.textContent = state.revealed
      ? `Meaning: ${currentMeanings().map((item) => item.meaning).join(" / ")}`
      : "Type the Chinese meaning from memory";
    renderReciteMeanings();
    renderFeedback(refs.reciteFeedback, state.reciteFeedback);
  }

  function renderMeaningList(container, meanings) {
    clear(container);
    meanings.forEach((meaning, index) => {
      container.appendChild(
        el("div", { class: "meaning-item" }, [
          el("span", { class: "meaning-index", text: `#${index + 1}` }),
          el("span", { class: "meaning-text", text: meaning.meaning }),
        ]),
      );
    });
  }

  function renderReciteMeanings() {
    clear(refs.reciteMeanings);
    currentMeanings().forEach((meaning, index) => {
      const mark = getMarkData(meaning);
      const row = el("div", { class: "recite-meaning" }, [
        el("div", { class: "recite-text" }, [
          el("span", { class: "meaning-index", text: `#${index + 1}` }),
          el("span", { class: "meaning-text", text: meaning.meaning }),
        ]),
        el("div", { class: "mark-actions" }, [
          el("button", {
            type: "button",
            class: "small-btn known",
            text: "Known",
            dataset: { markStatus: "known", meaningIndex: String(meaning.meaning_index) },
          }),
          el("button", {
            type: "button",
            class: "small-btn unknown",
            text: "Unknown",
            dataset: { markStatus: "unknown", meaningIndex: String(meaning.meaning_index) },
          }),
        ]),
      ]);

      if (mark) {
        const grid = el("div", { class: "mark-grid" });
        (mark.history || []).forEach((item) => {
          grid.appendChild(
            el("span", {
              class: `mark-cell ${item.status === "known" ? "known" : "unknown"}`,
              title: `${item.status} ${formatDate(item.created_at)}`,
            }),
          );
        });
        row.appendChild(
          el("div", { class: "mark-row" }, [
            el("span", { text: `Forgotten ${mark.forget_count || 0} / ${(mark.history || []).length}x` }),
            grid,
          ]),
        );
      }

      refs.reciteMeanings.appendChild(row);
    });
  }

  function renderNotes() {
    const phrase = state.currentPhrase;
    refs.notesTitle.textContent = phrase ? phrase.phrase : "No word";
    refs.addNote.disabled = !phrase;
    clear(refs.notesList);

    if (!phrase) {
      refs.notesList.appendChild(el("div", { class: "empty-state", text: "No word selected" }));
      return;
    }

    const notes = currentNotes();
    if (!notes.length) {
      refs.notesList.appendChild(el("div", { class: "empty-state", text: "No notes yet" }));
      return;
    }

    notes.forEach((note) => {
      refs.notesList.appendChild(
        el("div", { class: "note-item" }, [
          el("button", {
            type: "button",
            class: "note-body",
            dataset: { noteAction: "view", noteId: String(note.id) },
          }, [
            el("p", { class: "note-text", text: note.content }),
            el("span", { class: "note-time", text: formatTime(note.created_at) }),
          ]),
          el("div", { class: "note-actions" }, [
            el("button", {
              type: "button",
              class: "icon-btn note-icon",
              text: "e",
              title: "Edit",
              dataset: { noteAction: "edit", noteId: String(note.id) },
            }),
            el("button", {
              type: "button",
              class: "icon-btn note-icon",
              text: "x",
              title: "Delete",
              dataset: { noteAction: "delete", noteId: String(note.id) },
            }),
          ]),
        ]),
      );
    });
  }

  function renderSelect() {
    refs.defaultView.value = localStorage.getItem("defaultView") || "practice";
    renderPlanSelect();
    renderSelectFilterButtons();
    renderSelectedCount();
    renderSelectGrid();
  }

  function renderPlanSelect() {
    const value = state.activePlan ? state.activePlan.name : "";
    clear(refs.planSelect);
    refs.planSelect.appendChild(el("option", { value: "", text: "-- All words --" }));
    state.plans.forEach((plan) => {
      refs.planSelect.appendChild(
        el("option", {
          value: plan.name,
          text: `${plan.name} (${(plan.words || []).length})`,
        }),
      );
    });
    refs.planSelect.value = value;
  }

  function renderSelectFilterButtons() {
    $all("[data-select-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.selectFilter === state.selectFilter);
    });
  }

  function renderSelectedCount() {
    refs.selectedCount.textContent = `${state.phrases.filter((phrase) => isSelected(phrase)).length} selected`;
  }

  function renderSelectGrid() {
    clear(refs.selectGrid);
    const filtered = state.phrases.filter((phrase) => {
      if (state.selectFilter === "selected") return isSelected(phrase);
      if (state.selectFilter === "unselected") return !isSelected(phrase);
      return true;
    });
    const groups = groupsFor(filtered);
    const letters = Object.keys(groups).sort();

    if (!letters.length) {
      refs.selectGrid.appendChild(el("div", { class: "empty-state", text: "No words match this filter" }));
      return;
    }

    letters.forEach((letter) => {
      const words = groups[letter];
      const lockedCount = words.filter((phrase) => isLocked(phrase)).length;
      const section = el("section", { class: "select-letter" }, [
        el("div", { class: "select-letter-head" }, [
          el("span", { text: letter }),
          el("span", { class: "letter-count", text: `${lockedCount}/${words.length}` }),
        ]),
      ]);
      const wordWrap = el("div", { class: "select-words" });
      words.forEach((phrase) => {
        const selected = isSelected(phrase);
        const locked = isLocked(phrase);
        const chip = el("button", {
          type: "button",
          class: `select-word${selected ? " selected" : ""}${locked ? " locked" : ""}`,
          dataset: { selectWord: phrase.phrase },
          disabled: locked,
        }, [
          el("span", { class: "select-word-mark" }),
          el("span", { text: phrase.phrase }),
        ]);
        if (hasNotes(phrase)) chip.appendChild(el("span", { class: "dot note", title: "Has notes" }));
        wordWrap.appendChild(chip);
      });
      section.appendChild(wordWrap);
      refs.selectGrid.appendChild(section);
    });
  }

  function renderFeedback(container, text) {
    container.hidden = !text;
    container.textContent = text || "";
  }

  function setView(view, options = {}) {
    const next = normalizeView(view);
    state.view = next;

    Object.entries(refs.pages).forEach(([name, page]) => {
      page.classList.toggle("active", name === next);
    });
    $all("[data-view-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.viewTab === next);
    });
    refs.mainShell.classList.toggle("select-mode", next === "select");

    if (next !== "select") ensureCurrentPhrase();
    if (options.updateHash !== false && location.hash.slice(1) !== next) {
      history.replaceState(null, "", `#${next}`);
    }
    renderAll();
  }

  function selectPhraseByName(name) {
    const phrase = findPhrase(name);
    if (!phrase) return;
    state.currentPhrase = phrase;
    state.revealed = false;
    state.practiceFeedback = "";
    state.reciteFeedback = "";
    refs.practiceSentence.value = "";
    refs.reciteInput.value = "";
    renderAll();
  }

  function navigate(direction) {
    const list = navList();
    const index = currentIndex();
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= list.length) return;
    selectPhraseByName(list[nextIndex].phrase);
  }

  function updateNav(position, prev, next) {
    const total = navList().length;
    const index = currentIndex();
    position.textContent = total && index >= 0 ? `${index + 1} / ${total}` : "0 / 0";
    prev.disabled = index <= 0;
    next.disabled = index < 0 || index >= total - 1;
  }

  async function checkPractice() {
    if (!state.currentPhrase) return;
    const sentence = refs.practiceSentence.value.trim();
    if (!sentence) {
      showToast("Write a sentence first.");
      return;
    }

    await withBusy(refs.practiceCheck, "Checking...", async () => {
      state.practiceFeedback = "";
      renderPractice();
      const data = await api.checkSentence(state.currentPhrase.phrase, sentence);
      state.practiceFeedback = data.feedback || "No feedback returned.";
      renderPractice();
    });
  }

  async function checkRecite() {
    if (!state.currentPhrase) return;
    const input = refs.reciteInput.value.trim();
    if (!input) {
      showToast("Enter your Chinese translation first.");
      return;
    }

    await withBusy(refs.reciteCheck, "Checking...", async () => {
      state.reciteFeedback = "";
      renderRecite();
      const data = await api.checkRecite(state.currentPhrase.phrase, input);
      state.reciteFeedback = data.feedback || "No feedback returned.";
      renderRecite();
    });
  }

  async function saveMark(meaning, status, button) {
    await withBusy(button, "...", async () => {
      const result = await api.saveMark(markKey(meaning), status);
      state.marksCache[markKey(meaning)] = result;
      renderRecite();
      renderSidebar();
    });
  }

  function handleNoteClick(event) {
    const button = event.target.closest("[data-note-action]");
    if (!button) return;
    const note = findCurrentNote(Number(button.dataset.noteId));
    if (!note && button.dataset.noteAction !== "add") return;

    if (button.dataset.noteAction === "view") openNoteModal("view", note);
    if (button.dataset.noteAction === "edit") openNoteModal("edit", note);
    if (button.dataset.noteAction === "delete") deleteNote(note);
  }

  function openNoteModal(mode, note = null) {
    if (!state.currentPhrase) return;
    state.modal = { mode, note };
    refs.modalOverlay.hidden = false;
    refs.modalTitle.textContent = mode === "add" ? "New Note" : mode === "edit" ? "Edit Note" : "Note";
    refs.modalText.value = note ? note.content : "";
    refs.modalText.readOnly = mode === "view";
    refs.modalMeta.textContent = note ? formatTime(note.created_at) : state.currentPhrase.phrase;
    refs.modalDelete.hidden = mode === "add";
    refs.modalSave.hidden = mode === "view";
    refs.modalCancel.textContent = mode === "view" ? "Close" : "Cancel";
    setTimeout(() => refs.modalText.focus(), 0);
  }

  function closeNoteModal() {
    refs.modalOverlay.hidden = true;
    state.modal = { mode: "add", note: null };
  }

  async function saveModalNote() {
    const content = refs.modalText.value.trim();
    if (!content) {
      showToast("Note content is empty.");
      return;
    }

    await withBusy(refs.modalSave, "Saving...", async () => {
      if (state.modal.mode === "add") {
        const note = await api.createNote(state.currentPhrase.phrase, content);
        const notes = state.notesCache[state.currentPhrase.phrase] || [];
        state.notesCache[state.currentPhrase.phrase] = [...notes, note];
      } else if (state.modal.note) {
        const note = await api.updateNote(state.modal.note.id, content);
        replaceNote(note);
      }
      closeNoteModal();
      renderNotes();
      renderSidebar();
      renderSelectGrid();
    });
  }

  async function deleteModalNote() {
    if (state.modal.note) await deleteNote(state.modal.note);
  }

  async function deleteNote(note) {
    if (!note || !confirm("Delete this note?")) return;
    await api.deleteNote(note.id);
    const notes = state.notesCache[note.phrase] || [];
    state.notesCache[note.phrase] = notes.filter((item) => item.id !== note.id);
    closeNoteModal();
    renderNotes();
    renderSidebar();
    renderSelectGrid();
  }

  function replaceNote(note) {
    const notes = state.notesCache[note.phrase] || [];
    state.notesCache[note.phrase] = notes.map((item) => (item.id === note.id ? note : item));
  }

  function toggleSelectedWord(name) {
    const phrase = findPhrase(name);
    if (!phrase || isLocked(phrase)) return;
    if (state.selectedSet.has(name)) state.selectedSet.delete(name);
    else state.selectedSet.add(name);
    renderSelectedCount();
    renderSelectGrid();
  }

  async function autoCreatePlans(button) {
    const baseName = sanitizePlanName(refs.planName.value.trim() || `Plan ${new Date().toISOString().slice(0, 10)}`);
    const days = clamp(Number(refs.planDays.value) || 30, 1, 365);
    const perDay = Math.max(1, Math.floor(state.phrases.length / days));
    const total = Math.min(state.phrases.length, days * perDay);
    const picked = shuffle([...state.phrases]).slice(0, total).map((item) => item.phrase);

    await withBusy(button, "Creating...", async () => {
      for (let i = 0; i < days; i += 1) {
        const words = picked.slice(i * perDay, (i + 1) * perDay);
        if (words.length) await api.savePlan(`${baseName} - Day ${i + 1}`, words);
      }
      await refreshPlans();
      const first = state.plans.find((plan) => plan.name === `${baseName} - Day 1`);
      setActivePlan(first || null);
      refs.planName.value = "";
      renderAll();
      showToast("Plans created.");
    });
  }

  async function saveManualPlan(button) {
    const name = sanitizePlanName(refs.planName.value.trim());
    if (!name) {
      showToast("Plan name is required.");
      return;
    }

    const locked = new Set((state.activePlan && state.activePlan.words) || []);
    const words = [...new Set([...locked, ...state.selectedSet])];
    if (!words.length) {
      showToast("Select at least one word.");
      return;
    }

    await withBusy(button, "Saving...", async () => {
      const plan = await api.savePlan(name, words);
      await refreshPlans();
      setActivePlan(plan);
      refs.planName.value = "";
      state.selectedSet.clear();
      renderAll();
      showToast("Plan saved.");
    });
  }

  async function deleteCurrentPlan(button) {
    if (!state.activePlan) {
      showToast("No active plan selected.");
      return;
    }
    if (!confirm(`Delete plan "${state.activePlan.name}"?`)) return;

    await withBusy(button, "Deleting...", async () => {
      await api.deletePlan(state.activePlan.name);
      await refreshPlans();
      setActivePlan(null);
      renderAll();
      showToast("Plan deleted.");
    });
  }

  async function deleteAllPlans(button) {
    if (!state.plans.length) {
      showToast("No plans to delete.");
      return;
    }
    if (!confirm("Delete all plans?")) return;

    await withBusy(button, "Deleting...", async () => {
      for (const plan of state.plans) await api.deletePlan(plan.name);
      await refreshPlans();
      setActivePlan(null);
      renderAll();
      showToast("All plans deleted.");
    });
  }

  function randomSelect20() {
    const locked = new Set((state.activePlan && state.activePlan.words) || []);
    const pool = state.phrases.filter((phrase) => !locked.has(phrase.phrase));
    state.selectedSet = new Set(shuffle(pool).slice(0, Math.min(20, pool.length)).map((item) => item.phrase));
    renderSelectedCount();
    renderSelectGrid();
  }

  async function resetSystem() {
    if (!confirm("Delete all notes, marks, and plans?")) return;
    await api.resetSystem();
    state.notesCache = {};
    state.marksCache = {};
    state.plans = [];
    setActivePlan(null);
    renderAll();
    showToast("Data reset.");
  }

  async function refreshPlans() {
    state.plans = await api.listPlans();
    if (state.activePlan) {
      const updated = state.plans.find((plan) => plan.name === state.activePlan.name);
      state.activePlan = updated || null;
    }
  }

  function setActivePlan(plan) {
    state.activePlan = plan;
    state.selectedSet.clear();
    if (plan) localStorage.setItem("activePlan", plan.name);
    else localStorage.removeItem("activePlan");
    ensureCurrentPhrase();
  }

  function restoreActivePlan() {
    const stored = localStorage.getItem("activePlan");
    state.activePlan = state.plans.find((plan) => plan.name === stored) || null;
  }

  function ensureCurrentPhrase() {
    const list = navList();
    if (!list.length) {
      state.currentPhrase = null;
      return;
    }
    if (!state.currentPhrase) {
      state.currentPhrase = list[0];
      return;
    }
    state.currentPhrase = list.find((item) => item.phrase === state.currentPhrase.phrase) || list[0];
  }

  function navList() {
    const planWords = activePlanWords();
    return planWords.length ? planWords : state.phrases;
  }

  function activePlanWords() {
    if (!state.activePlan) return state.phrases;
    const set = new Set(state.activePlan.words || []);
    return state.phrases.filter((phrase) => set.has(phrase.phrase));
  }

  function currentMeanings() {
    return (state.currentPhrase && state.currentPhrase.meanings) || [];
  }

  function currentNotes() {
    if (!state.currentPhrase) return [];
    return state.notesCache[state.currentPhrase.phrase] || [];
  }

  function currentIndex() {
    if (!state.currentPhrase) return -1;
    return navList().findIndex((phrase) => phrase.phrase === state.currentPhrase.phrase);
  }

  function findPhrase(name) {
    return state.phrases.find((phrase) => phrase.phrase === name) || null;
  }

  function findCurrentNote(id) {
    return currentNotes().find((note) => note.id === id) || null;
  }

  function groupsFor(list) {
    return list.reduce((groups, phrase) => {
      const letter = (phrase.phrase || "#").charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(phrase);
      return groups;
    }, {});
  }

  function isLocked(phrase) {
    return !!state.activePlan && (state.activePlan.words || []).includes(phrase.phrase);
  }

  function isSelected(phrase) {
    return isLocked(phrase) || state.selectedSet.has(phrase.phrase);
  }

  function hasNotes(phrase) {
    return !!(state.notesCache[phrase.phrase] || []).some((note) => (note.content || "").trim());
  }

  function markKey(meaning) {
    const phrase = meaning.phrase || (state.currentPhrase && state.currentPhrase.phrase) || "";
    return Number(meaning.total_meanings || 1) > 1 ? `${phrase}::${meaning.meaning_index}` : phrase;
  }

  function getMarkData(meaning) {
    return state.marksCache[markKey(meaning)] || null;
  }

  function getPhraseMarkStatus(phrase) {
    const meanings = phrase.meanings || [];
    if (!meanings.length) return null;

    let anyMarked = false;
    let allKnown = true;
    meanings.forEach((meaning) => {
      const mark = state.marksCache[markKeyForPhrase(phrase, meaning)];
      if (mark && mark.latest) {
        anyMarked = true;
        if (mark.latest !== "known") allKnown = false;
      } else {
        allKnown = false;
      }
    });

    if (!anyMarked) return null;
    return allKnown ? "known" : "unknown";
  }

  function getPhraseMarkTitle(phrase) {
    let total = 0;
    let forgotten = 0;
    (phrase.meanings || []).forEach((meaning) => {
      const mark = state.marksCache[markKeyForPhrase(phrase, meaning)];
      if (mark) {
        total += (mark.history || []).length;
        forgotten += mark.forget_count || 0;
      }
    });
    return `Forgotten ${forgotten} / ${total}x`;
  }

  function markKeyForPhrase(phrase, meaning) {
    return Number(meaning.total_meanings || 1) > 1 ? `${phrase.phrase}::${meaning.meaning_index}` : phrase.phrase;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = typeof data === "object" ? data.detail || data.message : data;
      throw new Error(detail || `API ${response.status}`);
    }
    return data;
  }

  async function withBusy(button, label, task) {
    const oldLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await task();
    } catch (err) {
      showToast(err.message || String(err));
    } finally {
      button.disabled = false;
      button.textContent = oldLabel;
    }
  }

  function setStatus(text) {
    refs.statusText.textContent = text;
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      refs.toast.hidden = true;
    }, 3200);
  }

  function normalizeView(view) {
    if (view === "settings") return "select";
    return VALID_VIEWS.has(view) ? view : "practice";
  }

  function sanitizePlanName(name) {
    return name.replace(/[\\/]+/g, "-").trim();
  }

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatTime(value) {
    return value ? String(value).slice(0, 16).replace("T", " ") : "";
  }

  function formatDate(value) {
    return value ? String(value).slice(0, 10) : "";
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === false || value === null || value === undefined) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "disabled") node.disabled = !!value;
      else node.setAttribute(key, value);
    });
    appendChildren(node, children);
    return node;
  }

  function appendChildren(parent, children) {
    if (!Array.isArray(children)) {
      appendChild(parent, children);
      return;
    }
    children.forEach((child) => appendChild(parent, child));
  }

  function appendChild(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      appendChildren(parent, child);
      return;
    }
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function $all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }
})();
