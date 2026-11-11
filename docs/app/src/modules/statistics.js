// src/modules/statistics.js — orkiestrator zakładki Statystyka.
import { getAllResults, getAllParticipants } from "./database.js";
import { getResearcherUid } from "./auth.js";
import {
  distinctTestIds,
  distinctSubjectIds,
  filterStatisticsResults,
  extractMetrics,
  compareRuns,
  aggregateMetrics,
  trendForMetric,
  scoreOf,
} from "../statistics/statisticsQuery.js";
import {
  formatNumber,
  renderKpis,
  renderRunsTable,
  renderCompareTable,
  renderAggTable,
  renderTrendChart,
  renderMetricsPanel,
} from "../statistics/statisticsTable.js";
import { Notify } from "../notify/notify.js";
import { t, localeTag } from "../i18n/index.js";

const state = {
  allResults: [],
  participants: [],
  mode: "personal",
  testId: null,
  selectedRunIds: new Set(),
  selectedOrder: [],
  selectedMetrics: new Set(),
  trendMetric: null,
  scope: "all",
  subjectId: null,
  participantKey: null,
  personalSubjectId: null,
};

const LAST_TEST_KEY = "nous-stats-last-test";

function el(id) {
  return document.getElementById(id);
}

function dateShort(timestamp) {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(localeTag());
}

function dateRelative(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((startToday - startDay) / 86400000);
  if (days <= 0) return t("statistics.today");
  if (days === 1) return t("statistics.yesterday");
  if (days < 7) return t("statistics.daysAgo", { count: days });
  if (days < 14) return t("statistics.weekAgo");
  if (days < 31) return t("statistics.weeksAgo", { count: Math.floor(days / 7) });
  return d.toLocaleDateString(localeTag());
}

function readLastTest() {
  try {
    return localStorage.getItem(LAST_TEST_KEY);
  } catch {
    return null;
  }
}

function writeLastTest(testId) {
  try {
    if (testId) localStorage.setItem(LAST_TEST_KEY, testId);
    else localStorage.removeItem(LAST_TEST_KEY);
  } catch {
    // localStorage może być niedostępny — wybór testu zostaje w pamięci.
  }
}

function preferredMetric(metrics) {
  const byKey = (key) => metrics.find((m) => m.key === key);
  return (
    byKey("score") ||
    metrics.find((m) => /(^| - )score$/i.test(m.key)) ||
    metrics.find((m) => /poprawne|punkty|wynik/i.test(m.label)) ||
    byKey("skutecznosc") ||
    metrics[0] ||
    null
  );
}

function heroContent(runs) {
  const latest = scoreOf(runs[0]);
  const previous = runs.length > 1 ? scoreOf(runs[1]) : null;
  const scores = runs
    .map((r) => scoreOf(r))
    .filter((v) => v !== null && Number.isFinite(v));
  const best = scores.length > 0 ? Math.max(...scores) : null;

  if (runs.length === 1) {
    return {
      title: t("statistics.heroFirstTitle"),
      text: t("statistics.heroFirstText"),
    };
  }

  if (
    latest !== null &&
    best !== null &&
    latest === best &&
    (previous === null || best > previous)
  ) {
    return {
      title: t("statistics.heroRecordTitle"),
      text: t("statistics.heroRecordText", { value: formatNumber(best) }),
    };
  }

  if (latest !== null && previous !== null) {
    if (latest > previous) {
      return {
        title: t("statistics.heroUpTitle"),
        text: t("statistics.heroUpText", {
          latest: formatNumber(latest),
          previous: formatNumber(previous),
        }),
      };
    }
    if (latest < previous) {
      return {
        title: t("statistics.heroDownTitle"),
        text: t("statistics.heroDownText", {
          latest: formatNumber(latest),
          previous: formatNumber(previous),
        }),
      };
    }
    return {
      title: t("statistics.heroSameTitle"),
      text: t("statistics.heroSameText", { latest: formatNumber(latest) }),
    };
  }

  return {
    title: t("statistics.heroDefaultTitle"),
    text: t("statistics.heroDefaultText"),
  };
}

function currentFilteredRuns() {
  if (!state.testId) return [];
  const subjectIds = [];
  if (state.mode === "research") {
    if (state.scope === "subject" && state.subjectId) {
      subjectIds.push(state.subjectId);
    } else if (state.scope === "participant" && state.participantKey) {
      const p = state.participants.find(
        (x) => (x.id || x.display_name) === state.participantKey,
      );
      const key = p?.participant_id || p?.display_name;
      if (key) subjectIds.push(key);
    }
  } else if (state.personalSubjectId) {
    subjectIds.push(state.personalSubjectId);
  } else if (distinctSubjectIds(state.allResults, state.testId).length > 1) {
    // Kilka osób w tym teście — najpierw wybierz jedną, żeby statystyki
    // dotyczyły konkretnego postępu, a nie mieszanki wyników.
    return [];
  }
  return filterStatisticsResults(state.allResults, {
    testId: state.testId,
    subjectIds,
  });
}

function availableMetrics(runs) {
  const map = new Map();
  (runs || []).forEach((r) => {
    extractMetrics(r).forEach((m) => {
      if (!map.has(m.key)) map.set(m.key, m);
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    a.label.localeCompare(b.label, localeTag()),
  );
}

function defaultMetricSelection(metrics) {
  const preferred = /wynik|punkt|błęd|błąd|wszystkie|skuteczność|czas/i;
  const chosen = metrics.filter((m) => preferred.test(m.label)).map((m) => m.key);
  if (chosen.length === 0 && metrics.length > 0) chosen.push(metrics[0].key);
  return chosen;
}

function computeKpis(runs) {
  const scores = runs
    .map((r) => scoreOf(r))
    .filter((v) => v !== null && Number.isFinite(v));
  const hasScores = scores.length > 0;
  const items = [
    {
      label: t("statistics.kpiRuns"),
      value: String(runs.length),
      hint:
        state.mode === "personal"
          ? t("statistics.kpiInTest")
          : t("statistics.kpiInScope"),
    },
  ];

  if (state.mode === "personal") {
    const latest = runs.length > 0 ? scoreOf(runs[0]) : null;
    const previous = runs.length > 1 ? scoreOf(runs[1]) : null;

    const best = hasScores ? Math.max(...scores) : null;
    const isNewRecord =
      latest !== null && best !== null && latest === best && runs.length > 1;

    items.push({
      label: t("statistics.kpiLastResult"),
      value: latest !== null ? formatNumber(latest) : "—",
      hint: runs[0] ? dateRelative(runs[0].timestamp) : t("statistics.kpiNoData"),
    });
    items.push({
      label: t("statistics.kpiBestResult"),
      value: best !== null ? formatNumber(best) : "—",
      hint: isNewRecord
        ? t("statistics.kpiNewRecord")
        : hasScores
          ? t("statistics.kpiMaxOfRuns")
          : t("statistics.kpiNoScoreMetric"),
    });

    let tone = null;
    let value = "—";
    let hint = t("statistics.kpiNeedsTwoRuns");
    if (latest !== null && previous !== null) {
      const delta = latest - previous;
      tone = delta > 0 ? "up" : delta < 0 ? "down" : null;
      value = (delta > 0 ? "+" : "") + formatNumber(delta);
      hint =
        delta > 0
          ? t("statistics.kpiImprovement")
          : delta < 0
            ? t("statistics.kpiDecline")
            : t("statistics.kpiNoChange");
    }
    items.push({ label: t("statistics.kpiChange"), value, hint, tone });
  } else {
    const subjects = distinctSubjectIds(runs, state.testId).length;
    items.push({
      label: t("statistics.kpiSubjects"),
      value: String(subjects),
      hint: t("statistics.kpiUniquePeople"),
    });

    const avg = hasScores
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;
    items.push({
      label: t("statistics.kpiAverageResult"),
      value: avg !== null ? formatNumber(avg) : "—",
      hint: hasScores
        ? t("statistics.kpiOfRuns", { count: scores.length })
        : t("statistics.kpiNoScoreMetric"),
    });
    items.push({
      label: t("statistics.kpiHighestResult"),
      value: hasScores ? formatNumber(Math.max(...scores)) : "—",
      hint: t("statistics.kpiMaxInScope"),
    });
  }

  return items;
}

function populateTests() {
  const select = el("stats-test");
  if (!select) return [];
  const tests = distinctTestIds(state.allResults);
  const prev = state.testId;
  select.innerHTML = `<option value="">${t("statistics.chooseTestPlaceholder")}</option>`;
  tests.forEach((testId) => {
    const opt = document.createElement("option");
    opt.value = testId;
    opt.textContent =
      testId === "Nieznany" ? t("statistics.unknownTest") : testId;
    select.appendChild(opt);
  });
  if (prev && tests.includes(prev)) select.value = prev;
  else state.testId = select.value || null;
  return tests;
}

function populateParticipants() {
  const select = el("stats-participant-select");
  if (!select) return;
  const prev = state.participantKey;
  select.innerHTML = `<option value="">${t("statistics.chooseParticipantPlaceholder")}</option>`;
  state.participants.forEach((p) => {
    const opt = document.createElement("option");
    const key = p.id || p.display_name;
    opt.value = key;
    opt.textContent = p.display_name || key;
    select.appendChild(opt);
  });
  if (prev) select.value = prev;
}

function personalSubjects() {
  if (!state.testId) return [];
  return distinctSubjectIds(state.allResults, state.testId).map((id) => {
    const participant = state.participants.find(
      (p) => p.participant_id === id || p.id === id,
    );
    return {
      id,
      label: id === "GUEST" ? t("statistics.guest") : participant?.display_name || id,
    };
  });
}

function syncPersonalField() {
  const field = el("stats-personal-subject-field");
  const select = el("stats-personal-subject");
  if (!field || !select) return;
  const hasSubjects =
    state.mode === "personal" &&
    (select.options.length > 1 || select.value !== "");
  field.classList.toggle("hidden", !hasSubjects);
}

function populatePersonalSubjects() {
  const select = el("stats-personal-subject");
  if (!select) return;

  const subjects = personalSubjects();
  const prev = state.personalSubjectId;
  select.innerHTML = "";

  if (subjects.length !== 1) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent =
      subjects.length > 1
        ? t("statistics.choosePersonPlaceholder")
        : t("statistics.noResultsPlaceholder");
    select.appendChild(placeholder);
  }

  subjects.forEach((subject) => {
    const option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.label;
    select.appendChild(option);
  });

  if (prev && subjects.some((s) => s.id === prev)) select.value = prev;
  else if (subjects.length === 1) select.value = subjects[0].id;
  state.personalSubjectId = select.value || null;
  syncPersonalField();
}

function populateSubjectSuggestions() {
  const datalist = el("stats-subject-datalist");
  if (!datalist) return;
  let ids = distinctSubjectIds(state.allResults, state.testId);
  if (ids.length === 0 && state.allResults.length > 0) {
    ids = distinctSubjectIds(state.allResults, null);
  }
  datalist.innerHTML = "";
  ids.forEach((id) => {
    const opt = document.createElement("option");
    opt.value = id;
    datalist.appendChild(opt);
  });
}

function updateScopeVisibility() {
  const scopeWrap = el("stats-research-scope");
  const subjectField = el("stats-subject-field");
  const participantField = el("stats-participant-field");
  if (state.mode !== "research") {
    scopeWrap?.classList.add("hidden");
    return;
  }
  scopeWrap?.classList.remove("hidden");
  if (subjectField) {
    subjectField.classList.toggle("hidden", state.scope !== "subject");
  }
  if (participantField) {
    participantField.classList.toggle("hidden", state.scope !== "participant");
  }
}

function updateModeButtons() {
  document.querySelectorAll(".stats-segmented-btn").forEach((btn) => {
    const active = btn.dataset.mode === state.mode;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function setEmpty({ title, text, cta, action } = {}) {
  const empty = el("stats-empty");
  const titleEl = el("stats-empty-title");
  const textEl = el("stats-empty-text");
  const ctaEl = el("stats-empty-cta");
  if (!empty || !textEl) return;

  if (!text) {
    empty.classList.add("hidden");
    return;
  }

  if (titleEl) titleEl.textContent = title || "";
  textEl.textContent = text;
  if (ctaEl) {
    ctaEl.textContent = cta || "";
    ctaEl.dataset.action = action || "";
    ctaEl.classList.toggle("hidden", !cta);
  }
  empty.classList.remove("hidden");
}

function renderHero(runs) {
  const hero = el("stats-hero");
  if (!hero) return;
  if (state.mode !== "personal" || runs.length === 0) {
    hero.classList.add("hidden");
    return;
  }

  const content = heroContent(runs);
  const title = el("stats-hero-title");
  const text = el("stats-hero-text");
  const cta = el("stats-hero-cta");
  if (title) title.textContent = content.title;
  if (text) text.textContent = content.text;
  if (cta) cta.dataset.action = "library";
  hero.classList.remove("hidden");
}

function handleEmptyAction(action) {
  if (action === "library") {
    document.getElementById("nav-library")?.click();
  } else if (action === "test") {
    el("stats-test")?.focus();
  } else if (action === "subject") {
    el("stats-personal-subject")?.focus();
  }
}

function hideAllSections() {
  ["stats-personal-runs", "stats-compare", "stats-trend", "stats-research"].forEach(
    (id) => el(id)?.classList.add("hidden"),
  );
}

function render() {
  updateModeButtons();
  syncPersonalField();

  const personalRuns = el("stats-personal-runs");
  const compare = el("stats-compare");
  const trend = el("stats-trend");
  const research = el("stats-research");
  const kpis = el("stats-kpis");

  const runs = currentFilteredRuns();

  // Metryki
  const metrics = availableMetrics(runs);
  if (state.selectedMetrics.size === 0) {
    defaultMetricSelection(metrics).forEach((k) => state.selectedMetrics.add(k));
  }
  // usuń zaznaczenia nieistniejących
  const metricKeys = new Set(metrics.map((m) => m.key));
  Array.from(state.selectedMetrics).forEach((k) => {
    if (!metricKeys.has(k)) state.selectedMetrics.delete(k);
  });

  const metricsList = el("stats-metrics-list");
  if (metricsList) {
    renderMetricsPanel(metricsList, metrics, state.selectedMetrics, (key, checked) => {
      if (checked) state.selectedMetrics.add(key);
      else state.selectedMetrics.delete(key);
      render();
    });
  }

  if (!state.testId) {
    hideAllSections();
    kpis?.classList.add("hidden");
    el("stats-hero")?.classList.add("hidden");
    if (state.allResults.length === 0) {
      setEmpty({
        title: t("statistics.emptyJournalTitle"),
        text: t("statistics.emptyJournalText"),
        cta: t("statistics.emptyJournalCta"),
        action: "library",
      });
    } else {
      setEmpty({
        title: t("statistics.emptyChooseTestTitle"),
        text: t("statistics.emptyChooseTestText", {
          count: state.allResults.length,
        }),
        cta: t("statistics.emptyChooseTestCta"),
        action: "test",
      });
    }
    return;
  }

  if (runs.length === 0) {
    hideAllSections();
    kpis?.classList.add("hidden");
    el("stats-hero")?.classList.add("hidden");
    const subjects = personalSubjects();
    if (
      state.mode === "personal" &&
      subjects.length > 1 &&
      !state.personalSubjectId
    ) {
      setEmpty({
        title: t("statistics.emptyChoosePersonTitle"),
        text: t("statistics.emptyChoosePersonText"),
        cta: t("statistics.emptyChoosePersonCta"),
        action: "subject",
      });
    } else {
      setEmpty({
        title: t("statistics.emptyNoResultsTitle"),
        text:
          state.mode === "personal"
            ? t("statistics.emptyNoResultsTextPersonal")
            : t("statistics.emptyNoResultsTextResearch"),
        cta: t("statistics.emptyRunTestCta"),
        action: "library",
      });
    }
    return;
  }

  setEmpty();
  if (kpis) {
    renderKpis(kpis, computeKpis(runs));
    kpis.classList.remove("hidden");
  }

  const selectedMetricKeys = Array.from(state.selectedMetrics);

  if (state.mode === "personal") {
    research?.classList.add("hidden");
    personalRuns?.classList.remove("hidden");
    renderHero(runs);

    const tbody = document.querySelector("#stats-runs-table tbody");
    if (tbody) {
      renderRunsTable(tbody, runs, state.selectedRunIds, (id, checked) => {
        if (checked) {
          if (state.selectedOrder.length >= 2) {
            const oldest = state.selectedOrder.shift();
            state.selectedRunIds.delete(oldest);
          }
          state.selectedOrder.push(id);
          state.selectedRunIds.add(id);
        } else {
          state.selectedRunIds.delete(id);
          state.selectedOrder = state.selectedOrder.filter((x) => x !== id);
        }
        render();
      });
    }

    // porównanie — zawsze od starszego (A) do nowszego (B), niezależnie od kolejności zaznaczenia
    if (state.selectedRunIds.size === 2) {
      const selected = runs
        .filter((r) => state.selectedRunIds.has(r.id))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const runA = selected[0];
      const runB = selected[1];
      if (runA && runB) {
        const rows = compareRuns(runA, runB, selectedMetricKeys);
        const ctbody = document.querySelector("#stats-compare-table tbody");
        if (ctbody) renderCompareTable(ctbody, rows);
        const info = el("stats-compare-info");
        if (info) {
          info.textContent = t("statistics.compareInfo", {
            a: dateShort(runA.timestamp),
            b: dateShort(runB.timestamp),
          });
        }
        compare?.classList.remove("hidden");
      }
    } else {
      compare?.classList.add("hidden");
    }

    // trend — metryka wybierana z listy, wykres liniowy
    const trendSelect = el("stats-trend-metric");
    const allKeys = metrics.map((m) => m.key);
    if (!state.trendMetric || !allKeys.includes(state.trendMetric)) {
      state.trendMetric = preferredMetric(metrics)?.key || null;
    }
    if (trendSelect) {
      trendSelect.innerHTML = "";
      metrics.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.key;
        opt.textContent = m.label;
        trendSelect.appendChild(opt);
      });
      if (state.trendMetric) trendSelect.value = state.trendMetric;
      state.trendMetric = trendSelect.value || state.trendMetric;
    }

    if (state.trendMetric) {
      trend?.classList.remove("hidden");
      const points = trendForMetric(runs, state.trendMetric);
      const chart = el("stats-trend-chart");
      const metric = metrics.find((m) => m.key === state.trendMetric);
      if (chart) {
        renderTrendChart(chart, points, { metricLabel: metric?.label });
      }
      const info = el("stats-trend-info");
      if (info) {
        info.textContent =
          points.length === 1
            ? t("statistics.runCount", { count: 1 })
            : t("statistics.runCount", { count: points.length });
      }
    } else {
      trend?.classList.add("hidden");
    }
  } else {
    personalRuns?.classList.add("hidden");
    compare?.classList.add("hidden");
    trend?.classList.add("hidden");
    el("stats-hero")?.classList.add("hidden");
    research?.classList.remove("hidden");

    const rows = aggregateMetrics(runs, selectedMetricKeys);
    const atbody = document.querySelector("#stats-agg-table tbody");
    if (atbody) renderAggTable(atbody, rows);

    const count = el("stats-research-count");
    if (count) {
      count.textContent = t("statistics.researchCount", { count: runs.length });
    }
  }
}

export function initStatisticsView() {
  document.querySelectorAll(".stats-segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (!mode || mode === state.mode) return;
      state.mode = mode;
      state.scope = "all";
      state.subjectId = null;
      state.participantKey = null;
      state.selectedRunIds.clear();
      state.selectedOrder = [];
      const scopeSelect = el("stats-scope");
      if (scopeSelect) scopeSelect.value = "all";
      const subjectInput = el("stats-subject-input");
      if (subjectInput) subjectInput.value = "";
      updateScopeVisibility();
      populateSubjectSuggestions();
      populatePersonalSubjects();
      render();
    });
  });

  const testSelect = el("stats-test");
  testSelect?.addEventListener("change", (e) => {
    state.testId = e.target.value || null;
    state.selectedRunIds.clear();
    state.selectedOrder = [];
    state.selectedMetrics.clear();
    state.trendMetric = null;
    state.personalSubjectId = null;
    writeLastTest(state.testId);
    populateSubjectSuggestions();
    populatePersonalSubjects();
    render();
  });

  const scopeSelect = el("stats-scope");
  scopeSelect?.addEventListener("change", (e) => {
    state.scope = e.target.value;
    state.subjectId = null;
    state.participantKey = null;
    const subjectInput = el("stats-subject-input");
    if (subjectInput) subjectInput.value = "";
    populateSubjectSuggestions();
    updateScopeVisibility();
    render();
  });

  const subjectInput = el("stats-subject-input");
  const handleSubjectChange = (e) => {
    state.subjectId = e.target.value.trim() || null;
    render();
  };
  subjectInput?.addEventListener("input", handleSubjectChange);
  subjectInput?.addEventListener("change", handleSubjectChange);
  subjectInput?.addEventListener("click", () => {
    if (typeof subjectInput.showPicker === "function") {
      try {
        subjectInput.showPicker();
      } catch {
        // Ignoruj błąd jeśli kontekst nie zezwala na showPicker
      }
    }
  });

  const participantSelect = el("stats-participant-select");
  participantSelect?.addEventListener("change", (e) => {
    state.participantKey = e.target.value || null;
    render();
  });

  const personalSubjectSelect = el("stats-personal-subject");
  personalSubjectSelect?.addEventListener("change", (e) => {
    state.personalSubjectId = e.target.value || null;
    state.selectedRunIds.clear();
    state.selectedOrder = [];
    render();
  });

  el("stats-hero-cta")?.addEventListener("click", (e) => {
    handleEmptyAction(e.currentTarget.dataset.action);
  });

  el("stats-empty-cta")?.addEventListener("click", (e) => {
    handleEmptyAction(e.currentTarget.dataset.action);
  });

  const trendSelect = el("stats-trend-metric");
  trendSelect?.addEventListener("change", (e) => {
    state.trendMetric = e.target.value || null;
    render();
  });

  const metricsToggle = el("stats-metrics-toggle");
  metricsToggle?.addEventListener("click", () => {
    const panel = el("stats-metrics-panel");
    if (!panel) return;
    const isHidden = panel.classList.toggle("hidden");
    metricsToggle.classList.toggle("is-open", !isHidden);
    metricsToggle.setAttribute("aria-expanded", isHidden ? "false" : "true");
  });

  updateScopeVisibility();
  updateModeButtons();
  populatePersonalSubjects();

  // Wykres trendu jest rysowany w pikselach — przerysuj po zmianie rozmiaru.
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    const section = el("stats-trend");
    if (!section || section.classList.contains("hidden")) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(), 150);
  });
}

export async function loadStatisticsData() {
  try {
    const uid = getResearcherUid();
    state.allResults = await getAllResults();
    // ogranicz do wyników bieżącego badacza (spójność z Historią)
    state.allResults = state.allResults.filter((r) => r.researcher_uid === uid);

    state.participants = await getAllParticipants(uid);

    const tests = populateTests();
    populateParticipants();
    if (state.testId === null) {
      const select = el("stats-test");
      const lastTest = readLastTest();
      if (select && lastTest && tests.includes(lastTest)) {
        select.value = lastTest;
        state.testId = lastTest;
      } else if (select && tests.length === 1) {
        select.value = tests[0];
        state.testId = tests[0];
      }
    }
    populateSubjectSuggestions();
    populatePersonalSubjects();
    render();
  } catch (e) {
    console.error("Error loading statistics:", e);
    Notify.error(t("statistics.loadError") + " " + e.message);
  }
}
