(function () {
  "use strict";

  const API_BASE = "/api/v1";
  const AUTH_TOKEN_KEY = "englishPracticeToken";
  const LLM_MODEL_KEY = "englishPracticeLlmModel";
  const APPEARANCE_KEY = "englishPracticeAppearance";
  const ALPHA = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const VALID_VIEWS = new Set(["dashboard", "practice", "recite", "review", "reading", "select", "settings"]);
  const systemThemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  const state = {
    phrases: [],
    notesCache: {},
    marksCache: {},
    reviewItems: [],
    reviewSummary: {},
    llmSettings: { default_model: "", model_options: [] },
    readingWords: new Set(),
    readingResult: null,
    plans: [],
    activePlan: null,
    currentPhrase: null,
    view: "practice",
    selectFilter: "all",
    reviewFilter: "due",
    reviewMode: localStorage.getItem("reviewMode") || "balanced",
    reviewMinutes: Number(localStorage.getItem("reviewMinutes") || 0),
    currentReviewKey: null,
    selectedSet: new Set(),
    collapsed: {},
    revealed: false,
    reviewRevealed: false,
    practiceFeedback: "",
    reciteFeedback: "",
    modal: { mode: "add", note: null },
  };

  const refs = {};
  let toastTimer = 0;

  applyAppearance();
  if (systemThemeQuery) {
    const handleSystemThemeChange = () => {
      if (selectedAppearanceMode() === "system") applyAppearance("system");
    };
    if (systemThemeQuery.addEventListener) systemThemeQuery.addEventListener("change", handleSystemThemeChange);
    else systemThemeQuery.addListener(handleSystemThemeChange);
  }

  const api = {
    login: (username, password) =>
      fetchJson(`${API_BASE}/auth/login`, {
        method: "POST",
        auth: false,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      }),
    getSettings: () => fetchJson(`${API_BASE}/settings`),
    listPhrases: () => fetchJson(`${API_BASE}/list`),
    listNotes: () => fetchJson(`${API_BASE}/notes`),
    listPlans: () => fetchJson(`${API_BASE}/plans`),
    listMarks: () => fetchJson(`${API_BASE}/marks`),
    listReview: () => fetchJson(`${API_BASE}/review?${reviewQuery()}`),
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
    generateReading: (phrases, topic) =>
      fetchJson(`${API_BASE}/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrases, topic }),
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
    refs.defaultView.value = localStorage.getItem("defaultView") || "dashboard";
    refs.reviewMode.value = state.reviewMode;
    refs.reviewMinutes.value = String(state.reviewMinutes);

    if (!authToken()) {
      setView(normalizeView(location.hash.slice(1) || refs.defaultView.value), { updateHash: !location.hash });
      renderAll();
      showLogin();
      return;
    }

    try {
      await bootAuthenticated();
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
    refs.logoutButton = $("#logoutButton");
    refs.menuTriggers = $all("[data-menu-trigger]");
    refs.menuPanels = $all("[data-menu-panel]");
    refs.mainShell = $("#mainShell");
    refs.sidebarHead = $("#sidebarHead");
    refs.pages = {
      dashboard: $("#page-dashboard"),
      practice: $("#page-practice"),
      recite: $("#page-recite"),
      review: $("#page-review"),
      reading: $("#page-reading"),
      select: $("#page-select"),
      settings: $("#page-settings"),
    };
    refs.dashboardSubline = $("#dashboardSubline");
    refs.dashboardSession = $("#dashboardSession");
    refs.dashboardTotalWords = $("#dashboardTotalWords");
    refs.dashboardDue = $("#dashboardDue");
    refs.dashboardWeak = $("#dashboardWeak");
    refs.dashboardNew = $("#dashboardNew");
    refs.dashboardMarked = $("#dashboardMarked");
    refs.dashboardMarkedBar = $("#dashboardMarkedBar");
    refs.dashboardKnownRate = $("#dashboardKnownRate");
    refs.dashboardKnownBar = $("#dashboardKnownBar");
    refs.dashboardPlan = $("#dashboardPlan");
    refs.dashboardQueueList = $("#dashboardQueueList");
    refs.dashboardWeakList = $("#dashboardWeakList");
    refs.dashboardStartReview = $("#dashboardStartReview");
    refs.dashboardStartPractice = $("#dashboardStartPractice");
    refs.dashboardManagePlans = $("#dashboardManagePlans");
    refs.dashboardRefresh = $("#dashboardRefresh");
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
    refs.reviewPosition = $("#reviewPosition");
    refs.reviewDueCount = $("#reviewDueCount");
    refs.reviewWeakCount = $("#reviewWeakCount");
    refs.reviewNewCount = $("#reviewNewCount");
    refs.reviewLaterCount = $("#reviewLaterCount");
    refs.reviewMode = $("#reviewMode");
    refs.reviewMinutes = $("#reviewMinutes");
    refs.reviewSessionText = $("#reviewSessionText");
    refs.reviewRefresh = $("#reviewRefresh");
    refs.reviewEmpty = $("#reviewEmpty");
    refs.reviewBody = $("#reviewBody");
    refs.reviewBucket = $("#reviewBucket");
    refs.reviewMeta = $("#reviewMeta");
    refs.reviewPhrase = $("#reviewPhrase");
    refs.reviewMeaning = $("#reviewMeaning");
    refs.reviewMeaningIndex = $("#reviewMeaningIndex");
    refs.reviewMeaningText = $("#reviewMeaningText");
    refs.reviewExample = $("#reviewExample");
    refs.reviewPrev = $("#reviewPrev");
    refs.reviewReveal = $("#reviewReveal");
    refs.reviewKnown = $("#reviewKnown");
    refs.reviewUnknown = $("#reviewUnknown");
    refs.reviewNext = $("#reviewNext");
    refs.readingCount = $("#readingCount");
    refs.readingSelected = $("#readingSelected");
    refs.readingWordPicker = $("#readingWordPicker");
    refs.readingAddPicked = $("#readingAddPicked");
    refs.readingAddCurrent = $("#readingAddCurrent");
    refs.readingAddSelected = $("#readingAddSelected");
    refs.readingAddPlan = $("#readingAddPlan");
    refs.readingRandom = $("#readingRandom");
    refs.readingClear = $("#readingClear");
    refs.readingTopic = $("#readingTopic");
    refs.readingGenerate = $("#readingGenerate");
    refs.readingEmpty = $("#readingEmpty");
    refs.readingResult = $("#readingResult");
    refs.readingResultTitle = $("#readingResultTitle");
    refs.readingArticle = $("#readingArticle");
    refs.readingVocabularyBlock = $("#readingVocabularyBlock");
    refs.readingVocabulary = $("#readingVocabulary");
    refs.readingQuestionBlock = $("#readingQuestionBlock");
    refs.readingQuestion = $("#readingQuestion");
    refs.readingAnswer = $("#readingAnswer");
    refs.notesPanel = $("#notesPanel");
    refs.notesTitle = $("#notesTitle");
    refs.addNote = $("#addNote");
    refs.notesList = $("#notesList");
    refs.appearanceMode = $("#appearanceMode");
    refs.defaultView = $("#defaultView");
    refs.settingsReviewMode = $("#settingsReviewMode");
    refs.settingsReviewMinutes = $("#settingsReviewMinutes");
    refs.llmModel = $("#llmModel");
    refs.llmModelStatus = $("#llmModelStatus");
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
    refs.loginOverlay = $("#loginOverlay");
    refs.loginForm = $("#loginForm");
    refs.loginUsername = $("#loginUsername");
    refs.loginPassword = $("#loginPassword");
    refs.loginButton = $("#loginButton");
    refs.loginError = $("#loginError");
    refs.toast = $("#toast");
  }

  function bindEvents() {
    $all("[data-view-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        setView(button.dataset.viewTab);
        closeMenus();
      });
    });
    refs.menuTriggers.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu(button.dataset.menuTrigger);
      });
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".nav-menu")) closeMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenus();
    });
    refs.loginForm.addEventListener("submit", handleLogin);
    refs.logoutButton.addEventListener("click", logout);

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
    refs.dashboardStartReview.addEventListener("click", () => setView("review"));
    refs.dashboardStartPractice.addEventListener("click", () => setView("practice"));
    refs.dashboardManagePlans.addEventListener("click", () => setView("select"));
    refs.dashboardRefresh.addEventListener("click", () => refreshReview(refs.dashboardRefresh));
    refs.dashboardQueueList.addEventListener("click", handleDashboardItemClick);
    refs.dashboardWeakList.addEventListener("click", handleDashboardItemClick);
    refs.practiceCheck.addEventListener("click", checkPractice);
    refs.reciteCheck.addEventListener("click", checkRecite);
    refs.reviewPrev.addEventListener("click", () => moveReview(-1));
    refs.reviewNext.addEventListener("click", () => moveReview(1));
    refs.reviewReveal.addEventListener("click", () => {
      state.reviewRevealed = !state.reviewRevealed;
      renderReview();
    });
    refs.reviewKnown.addEventListener("click", () => markReview("known", refs.reviewKnown));
    refs.reviewUnknown.addEventListener("click", () => markReview("unknown", refs.reviewUnknown));
    refs.reviewRefresh.addEventListener("click", () => refreshReview(refs.reviewRefresh));
    refs.reviewMode.addEventListener("change", () => changeReviewSettings());
    refs.reviewMinutes.addEventListener("change", () => changeReviewSettings());
    refs.readingAddPicked.addEventListener("click", () => addReadingWords([refs.readingWordPicker.value]));
    refs.readingAddCurrent.addEventListener("click", () => addReadingWords(state.currentPhrase ? [state.currentPhrase.phrase] : []));
    refs.readingAddSelected.addEventListener("click", () => addReadingWords([...state.selectedSet]));
    refs.readingAddPlan.addEventListener("click", () => addReadingWords(state.activePlan ? state.activePlan.words || [] : navList().map((item) => item.phrase)));
    refs.readingRandom.addEventListener("click", () => {
      const pool = navList().map((item) => item.phrase);
      state.readingWords = new Set(shuffle(pool).slice(0, Math.min(5, pool.length)));
      renderReading();
    });
    refs.readingClear.addEventListener("click", () => {
      state.readingWords.clear();
      state.readingResult = null;
      renderReading();
    });
    refs.readingSelected.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reading-remove]");
      if (!button) return;
      state.readingWords.delete(button.dataset.readingRemove);
      renderReading();
    });
    refs.readingGenerate.addEventListener("click", () => generateReading(refs.readingGenerate));
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

    refs.appearanceMode.addEventListener("change", saveAppearanceMode);
    refs.defaultView.addEventListener("change", () => {
      localStorage.setItem("defaultView", refs.defaultView.value);
      showToast("Default view saved.");
    });
    refs.settingsReviewMode.addEventListener("change", () => changeReviewSettingsFromSettings());
    refs.settingsReviewMinutes.addEventListener("change", () => changeReviewSettingsFromSettings());
    refs.llmModel.addEventListener("change", () => saveLlmModel());

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

    $all("[data-review-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.reviewFilter = button.dataset.reviewFilter;
        state.currentReviewKey = null;
        state.reviewRevealed = false;
        ensureReviewItem();
        renderReview();
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

  async function bootAuthenticated() {
    hideLogin();
    await loadData();
    const initialView = normalizeView(location.hash.slice(1) || refs.defaultView.value);
    setView(initialView, { updateHash: !location.hash });
    renderAll();
  }

  async function handleLogin(event) {
    event.preventDefault();
    const username = refs.loginUsername.value.trim();
    const password = refs.loginPassword.value;
    setLoginError("");
    refs.loginButton.disabled = true;
    refs.loginButton.textContent = "Signing in...";
    try {
      const data = await api.login(username, password);
      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      await bootAuthenticated();
      showToast(`Signed in as ${data.user.username}.`);
    } catch (err) {
      showLogin(err.message || "Sign in failed.");
    } finally {
      refs.loginButton.disabled = false;
      refs.loginButton.textContent = "Sign in";
    }
  }

  function logout() {
    clearAuthToken();
    state.phrases = [];
    state.notesCache = {};
    state.marksCache = {};
    state.reviewItems = [];
    state.reviewSummary = {};
    state.readingWords.clear();
    state.readingResult = null;
    state.plans = [];
    state.activePlan = null;
    state.currentPhrase = null;
    state.currentReviewKey = null;
    state.selectedSet.clear();
    setStatus("Locked");
    renderAll();
    showLogin("Signed out.");
  }

  async function loadData() {
    setStatus("Loading");
    const [settings, phrases, notes, plans, marks, review] = await Promise.all([
      api.getSettings(),
      api.listPhrases(),
      api.listNotes(),
      api.listPlans(),
      api.listMarks(),
      api.listReview(),
    ]);
    applySettingsData(settings);
    state.phrases = Array.isArray(phrases) ? phrases : [];
    state.notesCache = notes && typeof notes === "object" ? notes : {};
    state.plans = Array.isArray(plans) ? plans : [];
    state.marksCache = marks && typeof marks === "object" ? marks : {};
    applyReviewData(review);
    restoreActivePlan();
    ensureCurrentPhrase();
    ensureReviewItem();
  }

  function renderAll() {
    renderStatus();
    renderAlphaBar();
    renderSidebar();
    renderDashboard();
    renderPractice();
    renderRecite();
    renderReview();
    renderReading();
    renderNotes();
    renderSelect();
    renderSettings();
  }

  function renderStatus() {
    const visible = navList().length;
    const total = state.phrases.length;
    const plan = state.activePlan ? ` | ${state.activePlan.name}` : "";
    const due = state.reviewSummary && state.reviewSummary.due ? ` | ${state.reviewSummary.due} due` : "";
    setStatus(`${visible} / ${total} words${plan}${due}`);
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
      refs.sidebarHead.hidden = false;
      refs.activePlanBadge.hidden = false;
      refs.activePlanBadge.textContent = state.activePlan.name;
    } else {
      refs.sidebarHead.hidden = true;
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

  function renderDashboard() {
    const summary = state.reviewSummary || {};
    const totalItems = Number(summary.total || state.reviewItems.length || 0);
    const markedCount = Object.keys(state.marksCache || {}).length;
    const knownCount = Object.values(state.marksCache || {}).filter((mark) => mark && mark.latest === "known").length;
    const markedPct = percent(markedCount, totalItems);
    const knownPct = percent(knownCount, Math.max(markedCount, 1));
    const dueCount = Number(summary.due || 0);
    const weakCount = Number(summary.weak || 0);
    const newCount = Number(summary.new || 0);

    refs.dashboardTotalWords.textContent = String(state.phrases.length);
    refs.dashboardDue.textContent = String(dueCount);
    refs.dashboardWeak.textContent = String(weakCount);
    refs.dashboardNew.textContent = String(newCount);
    refs.dashboardMarked.textContent = `${markedPct}%`;
    refs.dashboardKnownRate.textContent = `${knownPct}%`;
    refs.dashboardMarkedBar.style.width = `${markedPct}%`;
    refs.dashboardKnownBar.style.width = `${knownPct}%`;
    refs.dashboardPlan.textContent = state.activePlan
      ? `${state.activePlan.name} active | ${(state.activePlan.words || []).length} words`
      : "All words active";
    refs.dashboardSession.textContent = reviewSessionText(summary, dashboardQueueItems().length);
    refs.dashboardSubline.textContent = dashboardSubline(dueCount, weakCount, newCount);

    renderDashboardList(refs.dashboardQueueList, dashboardQueueItems(), "No review items queued.");
    renderDashboardList(refs.dashboardWeakList, dashboardWeakItems(), "No weak items right now.");
  }

  function renderDashboardList(container, items, emptyText) {
    clear(container);
    if (!items.length) {
      container.appendChild(el("div", { class: "dashboard-empty", text: emptyText }));
      return;
    }

    items.forEach((item) => {
      container.appendChild(
        el("button", {
          type: "button",
          class: "dashboard-list-item",
          dataset: { dashboardReviewKey: item.key },
        }, [
          el("span", { class: `review-bucket ${item.bucket}`, text: bucketLabel(item) }),
          el("span", { class: "dashboard-item-main" }, [
            el("strong", { text: item.phrase }),
            el("small", { text: reviewMetaText(item) }),
          ]),
        ]),
      );
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

  function renderReview() {
    renderReviewStats();
    renderReviewFilterButtons();
    ensureReviewItem();

    const items = filteredReviewItems();
    const item = currentReviewItem();
    const index = item ? items.findIndex((entry) => entry.key === item.key) : -1;

    refs.reviewPosition.textContent = item ? `${index + 1} / ${items.length}` : `0 / ${items.length}`;
    refs.reviewEmpty.hidden = !!item;
    refs.reviewBody.hidden = !item;
    refs.reviewPrev.disabled = index <= 0;
    refs.reviewNext.disabled = index < 0 || index >= items.length - 1;
    refs.reviewKnown.disabled = !item;
    refs.reviewUnknown.disabled = !item;

    if (!item) {
      refs.reviewEmpty.textContent = reviewEmptyText();
      return;
    }

    const phrase = findPhrase(item.phrase);
    if (phrase && (!state.currentPhrase || state.currentPhrase.phrase !== phrase.phrase)) {
      state.currentPhrase = phrase;
    }

    refs.reviewBucket.textContent = bucketLabel(item);
    refs.reviewBucket.className = `review-bucket ${item.bucket}`;
    refs.reviewMeta.textContent = reviewMetaText(item);
    refs.reviewPhrase.textContent = item.phrase;
    refs.reviewMeaning.hidden = !state.reviewRevealed;
    refs.reviewMeaningIndex.textContent = `#${Number(item.meaning_index) + 1}`;
    refs.reviewMeaningText.textContent = item.meaning;
    refs.reviewExample.textContent = item.example || "";
    refs.reviewReveal.textContent = state.reviewRevealed ? "Hide Meaning" : "Show Meaning";
  }

  function renderReading() {
    renderReadingPicker();
    renderReadingSelected();

    const result = state.readingResult;
    refs.readingEmpty.hidden = !!result;
    refs.readingResult.hidden = !result;
    if (!result) return;

    refs.readingResultTitle.textContent = result.title || "Generated Reading";
    refs.readingArticle.textContent = result.article || result.passage || "";
    refs.readingVocabularyBlock.hidden = !result.vocabulary;
    refs.readingVocabulary.textContent = result.vocabulary || "";
    refs.readingQuestionBlock.hidden = !(result.question || result.answer);
    refs.readingQuestion.textContent = result.question || "";
    refs.readingAnswer.textContent = result.answer ? `Answer: ${result.answer}` : "";
  }

  function renderReadingPicker() {
    const selectedValue = refs.readingWordPicker.value;
    clear(refs.readingWordPicker);
    state.phrases.forEach((phrase) => {
      refs.readingWordPicker.appendChild(el("option", { value: phrase.phrase, text: phrase.phrase }));
    });
    if (selectedValue && findPhrase(selectedValue)) refs.readingWordPicker.value = selectedValue;
    else if (state.currentPhrase) refs.readingWordPicker.value = state.currentPhrase.phrase;
  }

  function renderReadingSelected() {
    const words = [...state.readingWords];
    refs.readingCount.textContent = `${words.length} chosen`;
    clear(refs.readingSelected);

    if (!words.length) {
      refs.readingSelected.appendChild(el("div", { class: "dashboard-empty", text: "No phrasal verbs chosen." }));
      return;
    }

    words.forEach((word) => {
      refs.readingSelected.appendChild(
        el("button", {
          type: "button",
          class: "reading-chip",
          title: "Remove",
          dataset: { readingRemove: word },
        }, [el("span", { text: word }), el("b", { text: "x" })]),
      );
    });
  }

  function renderReviewStats() {
    const summary = state.reviewSummary || {};
    refs.reviewDueCount.textContent = String(summary.due || 0);
    refs.reviewWeakCount.textContent = String(summary.weak || 0);
    refs.reviewNewCount.textContent = String(summary.new || 0);
    refs.reviewLaterCount.textContent = String(summary.later || 0);
    refs.reviewMode.value = state.reviewMode;
    refs.reviewMinutes.value = String(state.reviewMinutes);
    refs.reviewSessionText.textContent = reviewSessionText(summary, filteredReviewItems().length);
  }

  function renderReviewFilterButtons() {
    $all("[data-review-filter]").forEach((button) => {
      button.classList.toggle("active", button.dataset.reviewFilter === state.reviewFilter);
    });
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
    renderPlanSelect();
    renderSelectFilterButtons();
    renderSelectedCount();
    renderSelectGrid();
  }

  function renderSettings() {
    refs.appearanceMode.value = selectedAppearanceMode();
    refs.defaultView.value = localStorage.getItem("defaultView") || "dashboard";
    refs.settingsReviewMode.value = state.reviewMode;
    refs.settingsReviewMinutes.value = String(state.reviewMinutes);
    renderLlmOptions();
  }

  function saveAppearanceMode() {
    const mode = normalizeAppearanceMode(refs.appearanceMode.value);
    if (mode === "system") localStorage.removeItem(APPEARANCE_KEY);
    else localStorage.setItem(APPEARANCE_KEY, mode);
    applyAppearance(mode);
    showToast(`Theme set to ${mode}.`);
  }

  function selectedAppearanceMode() {
    return normalizeAppearanceMode(localStorage.getItem(APPEARANCE_KEY) || "system");
  }

  function normalizeAppearanceMode(mode) {
    return ["light", "dark", "system"].includes(mode) ? mode : "system";
  }

  function applyAppearance(mode = selectedAppearanceMode()) {
    const normalized = normalizeAppearanceMode(mode);
    const resolved = normalized === "system"
      ? (systemThemeQuery && systemThemeQuery.matches ? "dark" : "light")
      : normalized;
    document.documentElement.dataset.appearance = normalized;
    document.documentElement.dataset.theme = resolved;
  }

  function renderLlmOptions() {
    const settings = state.llmSettings || {};
    const options = Array.isArray(settings.model_options) ? settings.model_options : [];
    const defaultModel = settings.default_model || options[0] || "";
    const savedModel = localStorage.getItem(LLM_MODEL_KEY) || defaultModel;
    clear(refs.llmModel);

    options.forEach((model) => {
      refs.llmModel.appendChild(
        el("option", {
          value: model,
          text: model === defaultModel ? `${model} (default)` : model,
        }),
      );
    });

    if (savedModel && !options.includes(savedModel)) {
      refs.llmModel.appendChild(el("option", { value: savedModel, text: `${savedModel} (unavailable)` }));
    }
    refs.llmModel.value = savedModel || "";
    refs.llmModel.disabled = !refs.llmModel.options.length;
    refs.llmModelStatus.textContent = selectedLlmModel()
      ? `AI requests will use ${selectedLlmModel()}.`
      : "Using default model.";
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

  function toggleMenu(menuName) {
    const panel = [...refs.menuPanels].find((item) => item.dataset.menuPanel === menuName);
    const trigger = [...refs.menuTriggers].find((item) => item.dataset.menuTrigger === menuName);
    if (!panel || !trigger) return;
    const willOpen = panel.hidden;
    closeMenus(menuName);
    panel.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
  }

  function closeMenus(except = "") {
    refs.menuPanels.forEach((panel) => {
      if (panel.dataset.menuPanel !== except) panel.hidden = true;
    });
    refs.menuTriggers.forEach((trigger) => {
      if (trigger.dataset.menuTrigger !== except) trigger.setAttribute("aria-expanded", "false");
    });
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
    $all("[data-nav-root]").forEach((button) => {
      button.classList.toggle("active", navRootForView(next) === button.dataset.navRoot);
    });
    refs.mainShell.classList.toggle("select-mode", next === "select");
    refs.mainShell.classList.toggle("full-mode", next === "select" || next === "dashboard" || next === "reading" || next === "settings");

    if (next === "review") ensureReviewItem();
    else if (next !== "select" && next !== "dashboard" && next !== "reading" && next !== "settings") ensureCurrentPhrase();
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

  function addReadingWords(words) {
    const cleanWords = words.filter((word) => word && findPhrase(word));
    if (!cleanWords.length) {
      showToast("No phrasal verbs to add.");
      return;
    }

    const before = state.readingWords.size;
    cleanWords.forEach((word) => {
      if (state.readingWords.size < 8) state.readingWords.add(word);
    });
    if (before + cleanWords.length > 8) showToast("Reading uses up to 8 phrasal verbs.");
    renderReading();
  }

  async function generateReading(button) {
    const phrases = [...state.readingWords];
    if (!phrases.length) {
      showToast("Choose at least one phrasal verb.");
      return;
    }

    await withBusy(button, "Generating...", async () => {
      state.readingResult = null;
      renderReading();
      state.readingResult = await api.generateReading(phrases, refs.readingTopic.value.trim());
      renderReading();
    });
  }

  async function saveMark(meaning, status, button) {
    await withBusy(button, "...", async () => {
      const result = await api.saveMark(markKey(meaning), status);
      state.marksCache[markKey(meaning)] = result;
      await refreshReviewData();
      renderDashboard();
      renderRecite();
      renderReview();
      renderSidebar();
    });
  }

  async function markReview(status, button) {
    const item = currentReviewItem();
    if (!item) return;
    const oldIndex = filteredReviewItems().findIndex((entry) => entry.key === item.key);

    await withBusy(button, "...", async () => {
      const oldKey = item.key;
      const result = await api.saveMark(oldKey, status);
      state.marksCache[oldKey] = result;
      await refreshReviewData();
      keepReviewMoving(oldKey, oldIndex);
      renderAll();
    });
  }

  async function refreshReview(button) {
    await withBusy(button, "Refreshing...", async () => {
      await refreshReviewData();
      ensureReviewItem();
      renderAll();
      showToast("Review queue refreshed.");
    });
  }

  async function changeReviewSettings() {
    state.reviewMode = refs.reviewMode.value === "aggressive" ? "aggressive" : "balanced";
    state.reviewMinutes = Number(refs.reviewMinutes.value || 0);
    localStorage.setItem("reviewMode", state.reviewMode);
    localStorage.setItem("reviewMinutes", String(state.reviewMinutes));
    refs.settingsReviewMode.value = state.reviewMode;
    refs.settingsReviewMinutes.value = String(state.reviewMinutes);
    state.currentReviewKey = null;
    state.reviewRevealed = false;
    await refreshReviewData();
    ensureReviewItem();
    renderAll();
  }

  async function changeReviewSettingsFromSettings() {
    refs.reviewMode.value = refs.settingsReviewMode.value;
    refs.reviewMinutes.value = refs.settingsReviewMinutes.value;
    await changeReviewSettings();
    showToast("Review settings saved.");
  }

  function saveLlmModel() {
    const selected = refs.llmModel.value;
    const defaultModel = state.llmSettings.default_model || "";
    if (!selected || selected === defaultModel) localStorage.removeItem(LLM_MODEL_KEY);
    else localStorage.setItem(LLM_MODEL_KEY, selected);
    renderLlmOptions();
    showToast("LLM model saved.");
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

  function handleDashboardItemClick(event) {
    const button = event.target.closest("[data-dashboard-review-key]");
    if (!button) return;
    state.reviewFilter = "all";
    state.currentReviewKey = button.dataset.dashboardReviewKey;
    state.reviewRevealed = false;
    setView("review");
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
    state.reviewItems = [];
    state.reviewSummary = {};
    state.currentReviewKey = null;
    state.plans = [];
    setActivePlan(null);
    await refreshReviewData();
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

  async function refreshReviewData() {
    applyReviewData(await api.listReview());
  }

  function applyReviewData(data) {
    state.reviewItems = Array.isArray(data && data.items) ? data.items : [];
    state.reviewSummary = data && typeof data.summary === "object" ? data.summary : {};
  }

  function applySettingsData(data) {
    const llm = data && typeof data.llm === "object" ? data.llm : {};
    const options = Array.isArray(llm.model_options) ? llm.model_options : [];
    state.llmSettings = {
      default_model: typeof llm.default_model === "string" ? llm.default_model : options[0] || "",
      model_options: options,
    };
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

  function ensureReviewItem() {
    const items = filteredReviewItems();
    if (!items.length) {
      state.currentReviewKey = null;
      return;
    }

    const current = items.find((item) => item.key === state.currentReviewKey);
    const item = current || items[0];
    state.currentReviewKey = item.key;
    const phrase = findPhrase(item.phrase);
    if (phrase) state.currentPhrase = phrase;
  }

  function currentReviewItem() {
    return filteredReviewItems().find((item) => item.key === state.currentReviewKey) || null;
  }

  function filteredReviewItems() {
    return state.reviewItems.filter((item) => {
      if (state.reviewFilter === "due") return item.bucket === "due" || item.bucket === "again" || item.bucket === "soon";
      if (state.reviewFilter === "weak") return item.bucket === "again" || Number(item.forget_count || 0) > 0;
      if (state.reviewFilter === "new") return item.bucket === "new";
      return true;
    });
  }

  function moveReview(direction) {
    const items = filteredReviewItems();
    const index = items.findIndex((item) => item.key === state.currentReviewKey);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= items.length) return;
    state.currentReviewKey = items[nextIndex].key;
    state.reviewRevealed = false;
    ensureReviewItem();
    renderAll();
  }

  function keepReviewMoving(oldKey, oldIndex) {
    const items = filteredReviewItems();
    const same = items.find((item) => item.key === oldKey);
    const fallback = items[Math.min(Math.max(oldIndex, 0), Math.max(items.length - 1, 0))];
    state.currentReviewKey = same ? same.key : (fallback && fallback.key) || null;
    state.reviewRevealed = false;
    ensureReviewItem();
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

  function bucketLabel(item) {
    if (item.bucket === "again") return "Retry";
    if (item.bucket === "due") return item.overdue_days > 0 ? `Overdue ${item.overdue_days}d` : "Due";
    if (item.bucket === "soon") return "Soon";
    if (item.bucket === "new") return "New";
    return "Later";
  }

  function reviewMetaText(item) {
    const parts = [];
    if (item.review_count) parts.push(`${item.review_count} reviews`);
    if (item.known_streak) parts.push(`${item.known_streak} streak`);
    if (item.forget_count) parts.push(`${item.forget_count} forgotten`);
    if (item.bucket === "later" && item.due_at) parts.push(`next ${formatDate(item.due_at)}`);
    if (!parts.length) parts.push("first review");
    return parts.join(" | ");
  }

  function reviewEmptyText() {
    if (state.reviewFilter === "due") return "Nothing due right now. Nice.";
    if (state.reviewFilter === "weak") return "No weak items found.";
    if (state.reviewFilter === "new") return "No new items left.";
    return "No review items yet.";
  }

  function dashboardQueueItems() {
    const dueItems = state.reviewItems.filter((item) => ["again", "due", "soon"].includes(item.bucket));
    const queue = dueItems.length ? dueItems : state.reviewItems.filter((item) => item.bucket === "new");
    return (queue.length ? queue : state.reviewItems).slice(0, 5);
  }

  function dashboardWeakItems() {
    return state.reviewItems
      .filter((item) => item.bucket === "again" || Number(item.forget_count || 0) > 0)
      .slice(0, 5);
  }

  function dashboardSubline(dueCount, weakCount, newCount) {
    if (dueCount > 0) return `${dueCount} items are ready for review. ${weakCount} weak spots need extra attention.`;
    if (newCount > 0) return "No due reviews right now. This is a good window to learn new items.";
    return "Everything is quiet. You can practice current words or manage plans.";
  }

  function reviewSessionText(summary, activeCount) {
    const shown = Number(activeCount || summary.shown || 0);
    if (!state.reviewMinutes) return `${shown} cards | open session`;
    return `${shown} cards | ${state.reviewMinutes} min ${state.reviewMode}`;
  }

  function reviewQuery() {
    const params = new URLSearchParams({
      limit: "1000",
      include_new: "true",
      include_later: "true",
      mode: state.reviewMode,
      minutes: String(state.reviewMinutes),
    });
    return params.toString();
  }

  function percent(value, total) {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
  }

  async function fetchJson(url, options = {}) {
    const { auth = true, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers || {});
    const token = authToken();
    if (auth && token) headers.set("Authorization", `Bearer ${token}`);
    const model = selectedLlmModel();
    if (auth && model) headers.set("X-LLM-Model", model);
    fetchOptions.headers = headers;

    const response = await fetch(url, fetchOptions);
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const detail = typeof data === "object" ? data.detail || data.message : data;
      if (response.status === 401 && auth) {
        clearAuthToken();
        showLogin("Session expired. Sign in again.");
      }
      throw new Error(detail || `API ${response.status}`);
    }
    return data;
  }

  function authToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  function selectedLlmModel() {
    const selected = localStorage.getItem(LLM_MODEL_KEY);
    const defaultModel = state.llmSettings.default_model || "";
    if (!selected || selected === defaultModel) return "";
    return selected;
  }

  function showLogin(message = "") {
    refs.loginOverlay.hidden = false;
    document.body.classList.add("auth-open");
    refs.logoutButton.hidden = true;
    refs.loginUsername.value = refs.loginUsername.value || "admin";
    setLoginError(message);
    setTimeout(() => refs.loginPassword.focus(), 0);
  }

  function hideLogin() {
    refs.loginOverlay.hidden = true;
    document.body.classList.remove("auth-open");
    refs.logoutButton.hidden = false;
    setLoginError("");
  }

  function setLoginError(message) {
    refs.loginError.textContent = message;
    refs.loginError.hidden = !message;
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
    return VALID_VIEWS.has(view) ? view : "dashboard";
  }

  function navRootForView(view) {
    if (["practice", "recite", "review"].includes(view)) return "learning";
    if (["select", "settings"].includes(view)) return "settings";
    return view;
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
