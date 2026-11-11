// src/statistics/statisticsTable.js — renderowanie tabel statystyk (DOM).
import { scoreOf } from "./statisticsQuery.js";
import { t, localeTag } from "../i18n/index.js";

export function formatNumber(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

function fmtDelta(v) {
  if (v === null || v === undefined) return "—";
  return (v > 0 ? "+" : "") + formatNumber(v);
}

function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(localeTag(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makeCell(text, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

export function renderKpis(container, items) {
  container.innerHTML = "";
  (items || []).forEach((item) => {
    const card = document.createElement("div");
    card.className = "stats-kpi" + (item.tone ? ` is-${item.tone}` : "");

    const label = document.createElement("span");
    label.className = "stats-kpi-label";
    label.textContent = item.label;
    card.appendChild(label);

    const value = document.createElement("span");
    value.className = "stats-kpi-value";
    value.textContent = item.value;
    card.appendChild(value);

    if (item.hint) {
      const hint = document.createElement("span");
      hint.className = "stats-kpi-hint";
      hint.textContent = item.hint;
      card.appendChild(hint);
    }

    container.appendChild(card);
  });
}

export function renderRunsTable(tbody, runs, selectedIds, onToggle) {
  tbody.innerHTML = "";
  runs.forEach((r) => {
    const tr = document.createElement("tr");
    if (selectedIds.has(r.id)) tr.classList.add("is-selected");

    const tdSel = document.createElement("td");
    tdSel.className = "stats-select";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "stats-checkbox";
    cb.checked = selectedIds.has(r.id);
    cb.setAttribute("aria-label", t("statistics.selectRunAria"));
    cb.addEventListener("change", () => onToggle(r.id, cb.checked));
    tdSel.appendChild(cb);
    tr.appendChild(tdSel);

    tr.appendChild(makeCell(formatDateTime(r.timestamp), "stats-date"));

    tr.appendChild(
      makeCell(
        scoreOf(r) !== null ? formatNumber(scoreOf(r)) : "—",
        "stats-num stats-score",
      ),
    );

    tbody.appendChild(tr);
  });
}

export function renderCompareTable(tbody, rows) {
  tbody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");

    tr.appendChild(makeCell(row.label, "stats-metric-name"));
    tr.appendChild(makeCell(formatNumber(row.valueA), "stats-num"));
    tr.appendChild(makeCell(formatNumber(row.valueB), "stats-num"));

    const tdDelta = document.createElement("td");
    tdDelta.className = "stats-num";
    const pill = document.createElement("span");
    pill.className = "stats-delta";
    if (row.delta === null) {
      pill.classList.add("delta-none");
      pill.textContent = "—";
    } else {
      const improved = row.lowerIsBetter ? row.delta < 0 : row.delta > 0;
      const worsened = row.lowerIsBetter ? row.delta > 0 : row.delta < 0;
      pill.classList.add(
        improved ? "delta-up" : worsened ? "delta-down" : "delta-neutral",
      );
      const arrow = row.delta > 0 ? "▲" : row.delta < 0 ? "▼" : "•";
      pill.textContent = `${arrow} ${fmtDelta(row.delta)}${
        row.deltaPercent !== null
          ? ` (${formatNumber(row.deltaPercent)}%)`
          : ""
      }`;
    }
    tdDelta.appendChild(pill);
    tr.appendChild(tdDelta);

    tbody.appendChild(tr);
  });
}

export function renderAggTable(tbody, rows) {
  tbody.innerHTML = "";
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.appendChild(makeCell(row.label, "stats-metric-name"));
    tr.appendChild(makeCell(formatNumber(row.avg), "stats-num stats-strong"));
    tr.appendChild(makeCell(formatNumber(row.min), "stats-num"));
    tr.appendChild(makeCell(formatNumber(row.max), "stats-num"));
    tbody.appendChild(tr);
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}

function formatDay(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(localeTag(), { day: "2-digit", month: "2-digit" });
}

/**
 * Wykres liniowy trendu (SVG, bez zależności).
 * points: [{ timestamp, value }]
 */
export function renderTrendChart(container, points, options = {}) {
  container.innerHTML = "";
  if (!points || points.length === 0) {
    const empty = document.createElement("p");
    empty.className = "stats-chart-empty";
    empty.textContent = t("statistics.chartEmpty");
    container.appendChild(empty);
    return;
  }

  const width = Math.max(320, Math.round(container.clientWidth || 760));
  const height = 280;
  const pad = { top: 20, right: 20, bottom: 38, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    // Wszystkie punkty równe: oprzyj skalę na zerze, zamiast sztucznego
    // zakresu -1…1, który sugerował zmienność, której nie ma.
    if (min >= 0) {
      min = 0;
      max = values[0] > 0 ? values[0] * 1.25 : 1;
    } else {
      max = 0;
      min = values[0] * 1.25;
    }
  } else {
    const span = max - min;
    min -= span * 0.12;
    max += span * 0.12;
  }

  const xOf = (i) =>
    points.length === 1
      ? pad.left + innerW / 2
      : pad.left + (i * innerW) / (points.length - 1);
  const yOf = (v) => pad.top + innerH - ((v - min) / (max - min)) * innerH;

  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    class: "stats-chart",
    role: "img",
  });
  svg.setAttribute(
    "aria-label",
    t("statistics.chartAria", {
      metric: options.metricLabel || t("statistics.metricFallback"),
    }),
  );

  // Siatka + oś Y
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const value = min + ((max - min) * i) / steps;
    const y = yOf(value);
    svg.appendChild(
      svgEl("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: y,
        y2: y,
        class: "stats-chart-grid",
      }),
    );
    const label = svgEl("text", {
      x: pad.left - 10,
      y: y + 4,
      class: "stats-chart-axis",
      "text-anchor": "end",
    });
    label.textContent = formatNumber(
      Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100,
    );
    svg.appendChild(label);
  }

  // Linia + wypełnienie
  let line = "";
  points.forEach((p, i) => {
    line += `${i === 0 ? "M" : "L"}${xOf(i).toFixed(2)},${yOf(p.value).toFixed(2)} `;
  });
  const baseY = pad.top + innerH;
  const area = `${line}L${xOf(points.length - 1).toFixed(2)},${baseY} L${xOf(0).toFixed(2)},${baseY} Z`;

  svg.appendChild(svgEl("path", { d: area, class: "stats-chart-area" }));
  svg.appendChild(svgEl("path", { d: line, class: "stats-chart-line" }));

  // Punkty + podpowiedzi
  const showDots = points.length <= 40;
  points.forEach((p, i) => {
    if (showDots) {
      const dot = svgEl("circle", {
        cx: xOf(i).toFixed(2),
        cy: yOf(p.value).toFixed(2),
        r: points.length > 20 ? 3 : 4.5,
        class: "stats-chart-dot",
      });
      const title = svgEl("title");
      title.textContent = `${formatDateTime(p.timestamp)} — ${formatNumber(p.value)}`;
      dot.appendChild(title);
      svg.appendChild(dot);
    }
  });

  // Etykiety osi X (max ~6, bez nachodzenia)
  const maxLabels = Math.min(points.length, Math.max(2, Math.floor(innerW / 90)));
  const indices = new Set();
  if (points.length === 1) {
    indices.add(0);
  } else {
    for (let k = 0; k < maxLabels; k++) {
      indices.add(Math.round((k * (points.length - 1)) / (maxLabels - 1)));
    }
  }
  indices.forEach((i) => {
    const text = svgEl("text", {
      x: xOf(i).toFixed(2),
      y: height - 14,
      class: "stats-chart-axis",
      "text-anchor": "middle",
    });
    text.textContent = formatDay(points[i].timestamp);
    svg.appendChild(text);
  });

  container.appendChild(svg);
}

export function renderMetricsPanel(container, metrics, selected, onToggle) {
  container.innerHTML = "";
  metrics.forEach((m) => {
    const label = document.createElement("label");
    label.className = "metric-chip";
    label.classList.toggle("is-selected", selected.has(m.key));

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selected.has(m.key);
    cb.addEventListener("change", () => onToggle(m.key, cb.checked));
    label.appendChild(cb);

    const span = document.createElement("span");
    span.textContent = m.label;
    label.appendChild(span);

    container.appendChild(label);
  });
}
