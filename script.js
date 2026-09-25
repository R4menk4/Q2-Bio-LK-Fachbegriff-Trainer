const TERMS_PATH = "data/terms.json";
const STORAGE_KEY = "populationsdynamik-card-progress-v1";
const MODE_STORAGE_KEY = "populationsdynamik-card-query-mode-v1";
const BACKUP_FORMAT_VERSION = 1;

const TOPIC_ORDER = [
  "Grundbegriffe",
  "Wachstumsmodelle",
  "Umweltfaktoren",
  "Fortpflanzungsstrategien",
];

const STATUS_LABELS = {
  easy: "Einfach",
  medium: "Mittel",
  hard: "Schwer",
  unrated: "Noch nicht eingeordnet",
};

const QUERY_MODES = {
  termFirst: {
    frontLabel: "Fachbegriff",
    backLabel: "Definition",
  },
  definitionFirst: {
    frontLabel: "Definition",
    backLabel: "Fachbegriff",
  },
  spelling: {
    frontLabel: "Definition",
    backLabel: "Fachbegriff",
  },
};

const state = {
  terms: [],
  topics: [],
  progress: {},
  queryMode: "termFirst",
  currentCards: [],
  currentIndex: 0,
  activeSelection: null,
  isFlipped: false,
};

const elements = {
  views: document.querySelectorAll(".view"),
  menuView: document.querySelector("#menuView"),
  studyView: document.querySelector("#studyView"),
  progressView: document.querySelector("#progressView"),
  errorView: document.querySelector("#errorView"),
  topicButtons: document.querySelector("#topicButtons"),
  allTermsButton: document.querySelector("#allTermsButton"),
  statusButtons: document.querySelector("#statusButtons"),
  showProgressButton: document.querySelector("#showProgressButton"),
  progressBackButton: document.querySelector("#progressBackButton"),
  backToMenuButton: document.querySelector("#backToMenuButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  studyTitle: document.querySelector("#studyTitle"),
  selectionType: document.querySelector("#selectionType"),
  cardCounter: document.querySelector("#cardCounter"),
  emptyState: document.querySelector("#emptyState"),
  studyArea: document.querySelector("#studyArea"),
  flashcard: document.querySelector("#flashcard"),
  spellingTask: document.querySelector("#spellingTask"),
  spellingTaskTitle: document.querySelector("#spellingTaskTitle"),
  spellingInput: document.querySelector("#spellingInput"),
  checkAnswerButton: document.querySelector("#checkAnswerButton"),
  answerFeedback: document.querySelector("#answerFeedback"),
  spellingRating: document.querySelector("#spellingRating"),
  frontLabel: document.querySelector("#frontLabel"),
  frontContent: document.querySelector("#frontContent"),
  backLabel: document.querySelector("#backLabel"),
  backContent: document.querySelector("#backContent"),
  overallProgress: document.querySelector("#overallProgress"),
  overallDistribution: document.querySelector("#overallDistribution"),
  topicProgress: document.querySelector("#topicProgress"),
  recommendation: document.querySelector("#recommendation"),
  exportProgressButton: document.querySelector("#exportProgressButton"),
  importProgressButton: document.querySelector("#importProgressButton"),
  importProgressInput: document.querySelector("#importProgressInput"),
  transferFeedback: document.querySelector("#transferFeedback"),
  resetProgressButton: document.querySelector("#resetProgressButton"),
};

async function init() {
  bindEvents();

  try {
    state.terms = await loadTerms();
    state.progress = readProgress();
    state.queryMode = readQueryMode();
    state.topics = getOrderedTopics(state.terms);
    renderTopicButtons();
    renderModeButtons();
    renderProgress();
    showView("menu");
  } catch (error) {
    console.error(error);
    showView("error");
  }
}

async function loadTerms() {
  const response = await fetch(TERMS_PATH);

  if (!response.ok) {
    throw new Error(`Could not load ${TERMS_PATH}`);
  }

  const terms = await response.json();

  if (!Array.isArray(terms)) {
    throw new Error("The terms file must contain an array.");
  }

  return uniqueById(terms.filter(isValidTerm));
}

function isValidTerm(term) {
  return (
    term &&
    typeof term.id === "string" &&
    typeof term.term === "string" &&
    typeof term.definition === "string" &&
    Array.isArray(term.topics)
  );
}

function bindEvents() {
  elements.allTermsButton.addEventListener("click", startAllTermsSelection);

  elements.statusButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (button) {
      startStatusSelection(button.dataset.status);
    }
  });

  elements.flashcard.addEventListener("click", (event) => {
    if (state.queryMode === "spelling") {
      return;
    }

    const ratingButton = event.target.closest("[data-rate]");

    if (ratingButton) {
      rateCurrentCard(ratingButton.dataset.rate);
      return;
    }

    flipCard();
  });

  elements.flashcard.addEventListener("keydown", (event) => {
    if (state.queryMode === "spelling") {
      return;
    }

    if (event.target.closest("[data-rate]")) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    flipCard();
  });

  elements.showProgressButton.addEventListener("click", () => {
    renderProgress();
    showView("progress");
  });

  elements.progressBackButton.addEventListener("click", () => showView("menu"));
  elements.backToMenuButton.addEventListener("click", () => showView("menu"));

  elements.shuffleButton.addEventListener("click", () => {
    state.currentCards = shuffle(uniqueById(state.currentCards));
    state.currentIndex = 0;
    renderCurrentCard();
  });

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => switchQueryMode(button.dataset.mode));
  });

  elements.checkAnswerButton.addEventListener("click", checkSpellingAnswer);
  elements.spellingInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkSpellingAnswer();
    }
  });

  elements.spellingRating.addEventListener("click", (event) => {
    const ratingButton = event.target.closest("[data-rate]");
    if (ratingButton) {
      rateCurrentCard(ratingButton.dataset.rate);
    }
  });

  elements.exportProgressButton.addEventListener("click", exportProgress);
  elements.importProgressButton.addEventListener("click", () => {
    elements.importProgressInput.value = "";
    elements.importProgressInput.click();
  });
  elements.importProgressInput.addEventListener("change", importProgress);
  elements.resetProgressButton.addEventListener("click", resetProgress);
  window.addEventListener("resize", fitCardTerm);
}

function startAllTermsSelection() {
  startStudySession({
    label: "Gesamt Fachwörter",
    type: "Gesamtpool",
    cards: uniqueById(state.terms),
  });
}

function renderTopicButtons() {
  elements.topicButtons.innerHTML = "";

  state.topics.forEach((topic) => {
    const button = document.createElement("button");
    button.className = "selection-button";
    button.type = "button";
    button.textContent = topic;
    button.addEventListener("click", () => startTopicSelection(topic));
    elements.topicButtons.append(button);
  });
}

function startTopicSelection(topic) {
  const cards = uniqueById(state.terms.filter((term) => term.topics.includes(topic)));
  startStudySession({
    label: topic,
    type: "Fachliches Thema",
    cards,
  });
}

function startStatusSelection(status) {
  const cards = uniqueById(state.terms.filter((term) => getTermStatus(term.id) === status));
  startStudySession({
    label: STATUS_LABELS[status],
    type: "Persönlicher Lernstand",
    cards,
  });
}

function startStudySession(selection) {
  state.activeSelection = selection;
  state.currentCards = [];
  // The order is randomized only after the learner chooses a topic or status.
  state.currentCards = shuffle(uniqueById(selection.cards));
  state.currentIndex = 0;
  clearExerciseDisplay();
  elements.studyTitle.textContent = selection.label;
  elements.selectionType.textContent = selection.type;
  showView("study");
  renderCurrentCard();
}

function renderCurrentCard() {
  state.currentCards = uniqueById(state.currentCards);
  const hasCards = state.currentCards.length > 0;
  elements.emptyState.hidden = hasCards;
  elements.studyArea.hidden = !hasCards;

  if (!hasCards) {
    elements.cardCounter.textContent = "Karte 0 von 0";
    return;
  }

  const card = state.currentCards[state.currentIndex];
  state.isFlipped = false;
  elements.flashcard.classList.remove("is-flipped");
  elements.flashcard.setAttribute("aria-pressed", "false");
  resetSpellingTask();
  renderExerciseMode(card);
  elements.cardCounter.textContent = `Karte ${state.currentIndex + 1} von ${state.currentCards.length}`;
  requestAnimationFrame(fitCardTerm);
}

function renderExerciseMode(card) {
  const isSpellingMode = state.queryMode === "spelling";
  elements.flashcard.hidden = isSpellingMode;
  elements.spellingTask.hidden = !isSpellingMode;

  if (isSpellingMode) {
    renderSpellingTask(card);
    return;
  }

  renderCardContent(card);
}

function clearExerciseDisplay() {
  elements.frontContent.textContent = "";
  elements.backContent.textContent = "";
  elements.spellingTaskTitle.textContent = "";
  resetSpellingTask();
}

function renderCardContent(card) {
  const isDefinitionFirst = state.queryMode === "definitionFirst";
  const frontText = isDefinitionFirst ? card.definition : card.term;
  const backText = isDefinitionFirst ? card.term : card.definition;

  elements.frontLabel.textContent = QUERY_MODES[state.queryMode].frontLabel;
  elements.backLabel.textContent = QUERY_MODES[state.queryMode].backLabel;
  setCardContent(elements.frontContent, frontText, isDefinitionFirst ? "definition" : "term");
  setCardContent(elements.backContent, backText, isDefinitionFirst ? "term" : "definition");
}

function renderSpellingTask(card) {
  elements.spellingTaskTitle.textContent = card.definition;
  elements.spellingInput.value = "";
  elements.spellingInput.disabled = false;
  elements.checkAnswerButton.disabled = false;
  elements.spellingInput.focus({ preventScroll: true });
}

function resetSpellingTask() {
  elements.answerFeedback.textContent = "";
  elements.answerFeedback.className = "answer-feedback";
  elements.spellingRating.hidden = true;
  elements.spellingInput.value = "";
  elements.spellingInput.disabled = false;
  elements.checkAnswerButton.disabled = false;
}

function setCardContent(element, text, contentType) {
  element.textContent = text;
  element.style.fontSize = "";
  element.classList.toggle("card-term", contentType === "term");
  element.classList.toggle("card-definition", contentType === "definition");
}

function fitCardTerm() {
  if (elements.studyArea.hidden || state.queryMode === "spelling") {
    return;
  }

  document.querySelectorAll(".card-term").forEach((term) => {
    const cardFace = term.closest(".flashcard-face");

    if (!cardFace) {
      return;
    }

    const styles = window.getComputedStyle(cardFace);
    const availableWidth =
      cardFace.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const maxSize = getResponsiveTermSize();
    const minSize = 12;

    term.style.fontSize = `${maxSize}px`;

    while (term.scrollWidth > availableWidth && parseFloat(term.style.fontSize) > minSize) {
      const currentSize = parseFloat(term.style.fontSize);
      term.style.fontSize = `${Math.max(minSize, currentSize - 2)}px`;
    }
  });
}

function getResponsiveTermSize() {
  const width = window.innerWidth;

  if (width < 420) {
    return 54;
  }

  if (width < 720) {
    return 70;
  }

  return 90;
}

function flipCard() {
  if (state.currentCards.length === 0) {
    return;
  }

  state.isFlipped = !state.isFlipped;
  elements.flashcard.classList.toggle("is-flipped", state.isFlipped);
  elements.flashcard.setAttribute("aria-pressed", String(state.isFlipped));
}

function rateCurrentCard(status) {
  const card = state.currentCards[state.currentIndex];
  if (!card || !STATUS_LABELS[status] || status === "unrated") {
    return;
  }

  state.progress[card.id] = status;
  writeProgress();
  // Learners continue immediately after their own self-assessment.
  moveToNextCard();
}

function checkSpellingAnswer() {
  const card = state.currentCards[state.currentIndex];
  const answer = elements.spellingInput.value;

  if (!card) {
    return;
  }

  const isCorrect = isAcceptedAnswer(answer, card);
  const correctAnswer = getPrimaryAcceptedAnswer(card);

  if (isCorrect) {
    elements.answerFeedback.textContent = "Richtig!";
    elements.answerFeedback.className = "answer-feedback is-correct";
  } else {
    elements.answerFeedback.textContent = `Noch nicht ganz. Die richtige Antwort lautet: ${correctAnswer}.`;
    elements.answerFeedback.className = "answer-feedback is-wrong";
  }

  elements.spellingInput.disabled = true;
  elements.checkAnswerButton.disabled = true;
  elements.spellingRating.hidden = false;
}

function isAcceptedAnswer(answer, card) {
  const acceptedAnswers = getAcceptedAnswers(card);
  const normalizedAnswer = normalizeAnswer(answer);
  const compactAnswer = compactAnswerKey(normalizedAnswer);

  if (!normalizedAnswer) {
    return false;
  }

  return acceptedAnswers.some((acceptedAnswer) => {
    const normalizedAccepted = normalizeAnswer(acceptedAnswer);
    return (
      normalizedAnswer === normalizedAccepted ||
      compactAnswer === compactAnswerKey(normalizedAccepted)
    );
  });
}

function getAcceptedAnswers(card) {
  if (Array.isArray(card.acceptedAnswers) && card.acceptedAnswers.length > 0) {
    return card.acceptedAnswers;
  }

  return [card.term];
}

function getPrimaryAcceptedAnswer(card) {
  return card.term;
}

function normalizeAnswer(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[→➝➜⟶]/g, " nach ")
    .replace(/[–—−]/g, "-")
    .replace(/['"]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/[.,;:(){}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactAnswerKey(value) {
  return value.replace(/\s+/g, "");
}

function switchQueryMode(mode) {
  if (!QUERY_MODES[mode] || state.queryMode === mode) {
    return;
  }

  state.queryMode = mode;
  localStorage.setItem(MODE_STORAGE_KEY, mode);
  state.isFlipped = false;
  elements.flashcard.classList.remove("is-flipped");
  elements.flashcard.setAttribute("aria-pressed", "false");
  resetSpellingTask();
  renderModeButtons();
  renderCurrentCard();
}

function renderModeButtons() {
  elements.modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === state.queryMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function moveToNextCard() {
  if (state.currentCards.length === 0) {
    return;
  }

  state.currentIndex = (state.currentIndex + 1) % state.currentCards.length;
  renderCurrentCard();
}

function renderProgress() {
  const totals = countTerms(uniqueById(state.terms));
  elements.overallProgress.innerHTML = "";
  elements.overallDistribution.innerHTML = "";
  elements.topicProgress.innerHTML = "";
  elements.recommendation.textContent = getRecommendation(totals);

  [
    ["Fachbegriffe insgesamt", totals.total],
    ["Bereits bearbeitet", totals.handled],
    ["Noch nicht bearbeitet", totals.unrated],
  ].forEach(([label, value]) => {
    elements.overallProgress.append(createSummaryCard(label, value));
  });

  elements.overallDistribution.append(createDistributionBlock(totals));

  state.topics.forEach((topic) => {
    const termsForTopic = uniqueById(state.terms.filter((term) => term.topics.includes(topic)));
    elements.topicProgress.append(createTopicStatisticCard(topic, countTerms(termsForTopic)));
  });
}

function createSummaryCard(label, value) {
  const card = document.createElement("article");
  card.className = "summary-card";
  card.innerHTML = `<strong>${value}</strong><span>${label}</span>`;
  return card;
}

function createTopicStatisticCard(topic, totals) {
  const card = document.createElement("article");
  card.className = "topic-progress-card";
  card.innerHTML = `
    <h4>${escapeHtml(topic)}</h4>
    <dl>
      <dt>Begriffe insgesamt</dt><dd>${totals.total}</dd>
      <dt>Bereits bearbeitet</dt><dd>${totals.handled}</dd>
      <dt>Noch nicht bearbeitet</dt><dd>${totals.unrated}</dd>
    </dl>
  `;
  card.append(createDistributionBlock(totals));
  return card;
}

function createDistributionBlock(totals) {
  const block = document.createElement("div");
  block.className = "distribution-block";

  if (totals.handled === 0) {
    const message = document.createElement("p");
    message.className = "muted empty-distribution";
    message.textContent =
      "Du hast noch keine Begriffe eingeordnet. Starte eine Übung und markiere Begriffe als Einfach, Mittel oder Schwer.";
    block.append(message);
    return block;
  }

  const percentages = getPercentages([totals.easy, totals.medium, totals.hard], totals.handled);
  const rows = [
    ["Einfach", totals.easy, percentages[0], "easy"],
    ["Mittel", totals.medium, percentages[1], "medium"],
    ["Schwer", totals.hard, percentages[2], "hard"],
  ];

  rows.forEach(([label, count, percent, status]) => {
    const row = document.createElement("div");
    row.className = "distribution-row";
    row.innerHTML = `
      <div class="distribution-label">
        <strong>${label}</strong>
        <span>${count} ${count === 1 ? "Begriff" : "Begriffe"} · ${percent} %</span>
      </div>
      <div class="bar-track" aria-hidden="true">
        <span class="bar-fill bar-${status}" style="width: ${percent}%"></span>
      </div>
    `;
    block.append(row);
  });

  return block;
}

function getPercentages(values, total) {
  const raw = values.map((value) => (value / total) * 100);
  const roundedDown = raw.map(Math.floor);
  let remainder = 100 - roundedDown.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    roundedDown[order[index].index] += 1;
    remainder -= 1;
  }

  return roundedDown;
}

function getRecommendation(totals) {
  if (totals.hard > 0) {
    return "Wiederhole zuerst deine schweren Begriffe.";
  }

  if (totals.medium > 0) {
    return "Wiederhole als Nächstes deine mittleren Begriffe.";
  }

  if (totals.easy === totals.total && totals.total > 0) {
    return "Sehr gut, du hast alle Begriffe sicher eingeordnet.";
  }

  if (totals.easy > 0 && totals.unrated > 0) {
    return "Bearbeite als Nächstes noch nicht eingeordnete Begriffe.";
  }

  return "Starte eine Übung und ordne deine ersten Begriffe ein.";
}

function countTerms(terms) {
  return uniqueById(terms).reduce(
    (totals, term) => {
      totals.total += 1;
      totals[getTermStatus(term.id)] += 1;
      totals.handled = totals.easy + totals.medium + totals.hard;
      return totals;
    },
    { total: 0, handled: 0, easy: 0, medium: 0, hard: 0, unrated: 0 }
  );
}

function getTermStatus(id) {
  return STATUS_LABELS[state.progress[id]] && state.progress[id] !== "unrated"
    ? state.progress[id]
    : "unrated";
}

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function readQueryMode() {
  const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
  return QUERY_MODES[savedMode] ? savedMode : "termFirst";
}

function writeProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function exportProgress() {
  const backup = {
    formatVersion: BACKUP_FORMAT_VERSION,
    trainer: "Populationsdynamik",
    exportedAt: new Date().toISOString(),
    progress: state.progress,
    queryMode: state.queryMode,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `Populationsdynamik-Lernstand-${getLocalDateStamp()}.json`;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
  showTransferFeedback("Der Lernstand wurde als Sicherungsdatei exportiert.", "success");
}

async function importProgress(event) {
  const [file] = event.target.files;

  if (!file) {
    return;
  }

  try {
    const backup = JSON.parse(await file.text());
    const importedProgress = validateBackup(backup);
    state.progress = importedProgress;
    writeProgress();

    if (QUERY_MODES[backup.queryMode]) {
      state.queryMode = backup.queryMode;
      localStorage.setItem(MODE_STORAGE_KEY, backup.queryMode);
      renderModeButtons();
    }

    renderProgress();
    showTransferFeedback(
      `${Object.keys(importedProgress).length} Bewertungen wurden importiert.`,
      "success"
    );
  } catch (error) {
    console.error(error);
    showTransferFeedback(
      "Die Datei konnte nicht importiert werden. Bitte wähle eine Sicherungsdatei dieses Trainers.",
      "error"
    );
  }
}

function validateBackup(backup) {
  if (
    !backup ||
    backup.formatVersion !== BACKUP_FORMAT_VERSION ||
    backup.trainer !== "Populationsdynamik" ||
    !backup.progress ||
    typeof backup.progress !== "object" ||
    Array.isArray(backup.progress)
  ) {
    throw new Error("Invalid backup format");
  }

  const knownIds = new Set(state.terms.map((term) => term.id));
  const validStatuses = new Set(["easy", "medium", "hard"]);
  const importedProgress = {};

  Object.entries(backup.progress).forEach(([id, status]) => {
    if (knownIds.has(id) && validStatuses.has(status)) {
      importedProgress[id] = status;
    }
  });

  return importedProgress;
}

function getLocalDateStamp() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showTransferFeedback(message, type) {
  elements.transferFeedback.textContent = message;
  elements.transferFeedback.className = `transfer-feedback is-${type}`;
}

function resetProgress() {
  const confirmed = window.confirm("Möchtest du deinen gespeicherten Lernstand wirklich löschen?");

  if (!confirmed) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  state.progress = {};
  renderProgress();
  showTransferFeedback("Der gespeicherte Lernstand wurde zurückgesetzt.", "success");

  if (state.activeSelection && elements.studyView.classList.contains("is-active")) {
    refreshCurrentSelection();
  }
}

function refreshCurrentSelection() {
  if (state.activeSelection.type === "Fachliches Thema") {
    startTopicSelection(state.activeSelection.label);
    return;
  }

  const status = Object.keys(STATUS_LABELS).find(
    (key) => STATUS_LABELS[key] === state.activeSelection.label
  );

  if (status) {
    startStatusSelection(status);
  }
}

function getOrderedTopics(terms) {
  const topics = [...new Set(uniqueById(terms).flatMap((term) => term.topics))];
  return topics.sort((a, b) => {
    const aIndex = TOPIC_ORDER.indexOf(a);
    const bIndex = TOPIC_ORDER.indexOf(b);
    const aOrder = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const bOrder = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return aOrder - bOrder || a.localeCompare(b, "de");
  });
}

function shuffle(items) {
  const shuffled = uniqueById(items);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
}

function uniqueById(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const seen = new Set();

  return items.filter((item) => {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function showView(viewName) {
  elements.views.forEach((view) => view.classList.remove("is-active"));
  elements[`${viewName}View`].classList.add("is-active");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
