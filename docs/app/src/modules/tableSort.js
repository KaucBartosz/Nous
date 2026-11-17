// src/modules/tableSort.js — wspólne sortowanie tabel i wskaźniki aria-sort.
import { localeTag } from "../i18n/index.js";

/** Czyste sortowanie kopii wierszy: liczby numerycznie, reszta po polsku. */
export function sortRows(rows, key, dir, valueOf) {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = valueOf(a, key);
    const bv = valueOf(b, key);
    const an = Number(av);
    const bn = Number(bv);
    const numeric =
      av !== "" && av !== null && bv !== "" && bv !== null &&
      !Number.isNaN(an) && !Number.isNaN(bn);
    if (numeric && an !== bn) return (an - bn) * sign;
    return String(av ?? "").localeCompare(String(bv ?? ""), localeTag()) * sign;
  });
}

/** Podpina klikanie nagłówków z data-sort. Filtry wewnątrz th nie sortują. */
export function bindSortableHeaders(root, getState, onChange) {
  if (!root) return;
  root.querySelectorAll("th[data-sort]").forEach((th) => {
    if (th.dataset.sortBound) return;
    th.dataset.sortBound = "1";
    th.classList.add("sortable");
    th.setAttribute("aria-sort", "none");
    th.addEventListener("click", (event) => {
      if (event.target.closest(".filter-btn")) return;
      const key = th.dataset.sort;
      const state = getState();
      const dir = state.key === key && state.dir === "asc" ? "desc" : "asc";
      onChange(key, dir);
    });
  });
}

/** Synchronizuje strzałki i aria-sort po zmianie stanu. */
export function syncSortIndicators(root, state) {
  if (!root) return;
  root.querySelectorAll("th[data-sort]").forEach((th) => {
    const active = th.dataset.sort === state.key;
    th.setAttribute(
      "aria-sort",
      active ? (state.dir === "asc" ? "ascending" : "descending") : "none",
    );
    th.classList.toggle("is-sorted", active);
    th.dataset.sortDir = active ? state.dir : "";
  });
}
