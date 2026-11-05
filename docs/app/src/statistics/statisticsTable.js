// src/statistics/statisticsTable.js — renderowanie tabel statystyk (DOM).
import { extractMetrics } from "./statisticsQuery.js";

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
  return d.toLocaleString("pl-PL", {
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
    cb.setAttribute("aria-label", "Wybierz wykonanie do porównania");
    cb.addEventListener("change", () => onToggle(r.id, cb.checked));
    tdSel.appendChild(cb);
    tr.appendChild(tdSel);

    tr.appendChild(makeCell(formatDateTime(r.timestamp), "stats-date"));

    const subject = document.createElement("td");
    const chip = document.createElement("span");
    chip.className = "stats-subject";
    chip.textContent = r.subject_id || "—";
    subject.appendChild(chip);
    tr.appendChild(subject);

    const metrics = extractMetrics(r);
    const scoreMetric = metrics.find(
      (m) => m.key === "score" || m.key.toLowerCase().endsWith("score"),
    );
    tr.appendChild(
      makeCell(
        scoreMetric ? formatNumber(scoreMetric.value) : "—",
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
      pill.classList.add(
        row.delta > 0 ? "delta-up" : row.delta < 0 ? "delta-down" : "delta-neutral",
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
    tr.appendChild(makeCell(String(row.count), "stats-num"));
    tr.appendChild(makeCell(formatNumber(row.avg), "stats-num stats-strong"));
    tr.appendChild(makeCell(formatNumber(row.min), "stats-num"));
    tr.appendChild(makeCell(formatNumber(row.max), "stats-num"));
    tbody.appendChild(tr);
  });
}

export function renderTrendTable(tbody, points) {
  tbody.innerHTML = "";
  const max = points.reduce(
    (acc, p) => Math.max(acc, Math.abs(p.value) || 0),
    0,
  );
  points.forEach((p) => {
    const tr = document.createElement("tr");
    tr.appendChild(makeCell(formatDateTime(p.timestamp), "stats-date"));

    const subject = document.createElement("td");
    const chip = document.createElement("span");
    chip.className = "stats-subject";
    chip.textContent = p.subjectId || "—";
    subject.appendChild(chip);
    tr.appendChild(subject);

    const tdValue = document.createElement("td");
    tdValue.className = "stats-num";

    const inner = document.createElement("div");
    inner.className = "stats-trend-inner";

    const wrap = document.createElement("span");
    wrap.className = "stats-bar-wrap";
    const bar = document.createElement("span");
    bar.className = "stats-bar";
    const pct = max > 0 ? Math.max(3, Math.round((Math.abs(p.value) / max) * 100)) : 0;
    bar.style.width = `${pct}%`;
    wrap.appendChild(bar);
    inner.appendChild(wrap);

    const value = document.createElement("span");
    value.className = "stats-trend-value";
    value.textContent = formatNumber(p.value);
    inner.appendChild(value);

    tdValue.appendChild(inner);
    tr.appendChild(tdValue);
    tbody.appendChild(tr);
  });
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
