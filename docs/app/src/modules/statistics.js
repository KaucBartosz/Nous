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
};

function el(id) {
  return document.getElementById(id);
}

function dateShort(timestamp) {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pl-PL");
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
    a.label.localeCompare(b.label, "pl"),
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
      label: "Wykonania",
      value: String(runs.length),
      hint: state.mode === "personal" ? "w wybranym teście" : "w wybranym zakresie",
    },
  ];

  if (state.mode === "personal") {
    const latest = runs.length > 0 ? scoreOf(runs[0]) : null;
    const previous = runs.length > 1 ? scoreOf(runs[1]) : null;

    items.push({
      label: "Ostatni wynik",
      value: latest !== null ? formatNumber(latest) : "—",
      hint: runs[0] ? dateShort(runs[0].timestamp) : "brak danych",
    });
    items.push({
      label: "Najlepszy wynik",
      value: hasScores ? formatNumber(Math.max(...scores)) : "—",
      hint: hasScores ? "maksimum z wykonań" : "brak metryki wyniku",
    });

    let tone = null;
    let value = "—";
    let hint = "potrzebne dwa wykonania";
    if (latest !== null && previous !== null) {
      const delta = latest - previous;
      tone = delta > 0 ? "up" : delta < 0 ? "down" : null;
      value = (delta > 0 ? "+" : "") + formatNumber(delta);
      hint = "względem poprzedniego";
    }
    items.push({ label: "Zmiana", value, hint, tone });
  } else {
    const subjects = distinctSubjectIds(runs, state.testId).length;
    items.push({ label: "Badani", value: String(subjects), hint: "unikalnych osób" });

    const avg = hasScores
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null;
    items.push({
      label: "Średni wynik",
      value: avg !== null ? formatNumber(avg) : "—",
      hint: hasScores ? `z ${scores.length} wykonań` : "brak metryki wyniku",
    });
    items.push({
      label: "Najwyższy wynik",
      value: hasScores ? formatNumber(Math.max(...scores)) : "—",
      hint: "maksimum w zakresie",
    });
  }

  return items;
}

function populateTests() {
  const select = el("stats-test");
  if (!select) return;
  const tests = distinctTestIds(state.allResults);
  const prev = state.testId;
  select.innerHTML = '<option value="">-- wybierz test --</option>';
  tests.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    select.appendChild(opt);
  });
  if (prev && tests.includes(prev)) select.value = prev;
  else state.testId = select.value || null;
}

function populateParticipants() {
  const select = el("stats-participant-select");
  if (!select) return;
  const prev = state.participantKey;
  select.innerHTML = '<option value="">-- wybierz badanego --</option>';
  state.participants.forEach((p) => {
    const opt = document.createElement("option");
    const key = p.id || p.display_name;
    opt.value = key;
    opt.textContent = p.display_name || key;
    select.appendChild(opt);
  });
  if (prev) select.value = prev;
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

function setEmpty(message) {
  const empty = el("stats-empty");
  const text = el("stats-empty-text");
  if (!empty || !text) return;
  if (message) {
    text.textContent = message;
    empty.classList.remove("hidden");
  } else {
    text.textContent = "";
    empty.classList.add("hidden");
  }
}

function hideAllSections() {
  ["stats-personal-runs", "stats-compare", "stats-trend", "stats-research"].forEach(
    (id) => el(id)?.classList.add("hidden"),
  );
}

function render() {
  updateModeButtons();

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
    setEmpty(
      state.allResults.length === 0
        ? "Brak zapisanych wyników. Wykonaj test, aby zobaczyć statystyki."
        : "Wybierz test, aby zobaczyć statystyki.",
    );
    return;
  }

  if (runs.length === 0) {
    hideAllSections();
    kpis?.classList.add("hidden");
    setEmpty("Brak wyników dla wybranego testu i zakresu.");
    return;
  }

  setEmpty("");
  if (kpis) {
    renderKpis(kpis, computeKpis(runs));
    kpis.classList.remove("hidden");
  }

  const selectedMetricKeys = Array.from(state.selectedMetrics);

  if (state.mode === "personal") {
    research?.classList.add("hidden");
    personalRuns?.classList.remove("hidden");

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
          info.textContent = `A: ${dateShort(runA.timestamp)}  ·  B: ${dateShort(runB.timestamp)}`;
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
      state.trendMetric =
        selectedMetricKeys.find((k) => allKeys.includes(k)) ||
        allKeys[0] ||
        null;
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
          points.length === 1 ? "1 wykonanie" : `${points.length} wykonań`;
      }
    } else {
      trend?.classList.add("hidden");
    }
  } else {
    personalRuns?.classList.add("hidden");
    compare?.classList.add("hidden");
    trend?.classList.add("hidden");
    research?.classList.remove("hidden");

    const rows = aggregateMetrics(runs, selectedMetricKeys);
    const atbody = document.querySelector("#stats-agg-table tbody");
    if (atbody) renderAggTable(atbody, rows);

    const count = el("stats-research-count");
    if (count) {
      count.textContent = `Liczba wykonań: ${runs.length}`;
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
      render();
    });
  });

  const testSelect = el("stats-test");
  testSelect?.addEventListener("change", (e) => {
    state.testId = e.target.value || null;
    state.selectedRunIds.clear();
    state.selectedOrder = [];
    populateSubjectSuggestions();
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

    populateTests();
    populateParticipants();
    if (state.testId === null) {
      const select = el("stats-test");
      if (select && select.options.length > 1) {
        select.selectedIndex = 1;
        state.testId = select.value;
      }
    }
    populateSubjectSuggestions();
    render();
  } catch (e) {
    console.error("Error loading statistics:", e);
    Notify.error("Błąd ładowania statystyk: " + e.message);
  }
}
