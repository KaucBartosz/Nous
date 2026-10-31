// src/history/historyFilters.js — UI filtrów Historii (split 2/3).
// Własność: liczenie wartości, dropdowny (płaskie + hierarchia dat),
// badge'e i pasek czyszczenia. Orkiestrator (modules/history.js) dostarcza
// dane przez getResults/getFilters i decyzje przez applyFilters;
// fabryka trzyma tylko uchwyt otwartego dropdownu.
import { testIdOf, subjectIdOf } from "../results/resultPackage.js";
import {
  resolveStatusLabel,
  hasActiveFilters,
} from "../results/historyQuery.js";

/** Jedna funkcja licząca zamiast 3 kopii pętli (klucz wstrzyknięty). */
export function countBy(results, keyFn) {
  const counts = {};
  results.forEach((r) => {
    const val = keyFn(r);
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], "pl"));
}

/** Wartości filtra z danych widoku (daty jako drzewo rok→miesiąc→dzień). */
export function buildFilterValues(results, type) {
  if (type === "date") {
    const tree = {};
    results.forEach((r) => {
      const d = new Date(r.timestamp);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();
      const dateStr = `${String(day).padStart(2, "0")}.${String(month + 1).padStart(2, "0")}.${year}`;
      const monthName = d.toLocaleString("pl-PL", { month: "long" });
      if (!tree[year]) tree[year] = {};
      if (!tree[year][month]) tree[year][month] = { name: monthName, days: {} };
      if (!tree[year][month].days[day])
        tree[year][month].days[day] = { label: dateStr, count: 0 };
      tree[year][month].days[day].count++;
    });
    return tree;
  }
  if (type === "test_id") return countBy(results, testIdOf);
  if (type === "subject_id") return countBy(results, subjectIdOf);
  if (type === "status") return countBy(results, resolveStatusLabel);
  return [];
}

export function updateClearFiltersBar(filters) {
  const bar = document.getElementById("active-filters-bar");
  if (bar) {
    bar.classList.toggle("hidden", !hasActiveFilters(filters));
  }
}

/** Badge'e na nagłówkach kolumn (mapowanie kolumna → zestaw filtrów). */
export function updateFilterBadges(filters) {
  const total =
    filters.date.size +
    filters.test_id.size +
    filters.subject_id.size +
    filters.status.size;
  updateClearFiltersBar(filters);
  document.querySelectorAll(".filterable-header").forEach((th) => {
    const col = th.dataset.filterColumn;
    const badge = th.querySelector(".filter-badge");
    if (!badge) return;
    const key =
      col === "date"
        ? "date"
        : col === "test"
          ? "test_id"
          : col === "subject"
            ? "subject_id"
            : col === "status"
              ? "status"
              : null;
    if (!key) return;
    const count = filters[key].size;
    // Jawny String: happy-dom gubi liczbę w textContent (realny DOM rzutuje sam).
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count === 0);
    th.querySelector(".filter-btn").classList.toggle("active", count > 0);
  });
}

function dateButton() {
  return document.querySelector('.filter-btn[data-filter-type="date"]');
}

/**
 * @param {object} deps — { getResults(): array, getFilters(): filtry,
 *   applyFilters(): void, refreshBadges(): void }
 */
export function createFilterUi({ getResults, getFilters, applyFilters }) {
  let openDropdown = null;

  function close() {
    if (openDropdown) {
      openDropdown.remove();
      openDropdown = null;
    }
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
  }

  function renderOptions(body, type, values) {
    const filters = getFilters();
    body.innerHTML = "";
    if (type === "date") {
      renderDateOptions(body, values, filters);
    } else {
      const activeSet = filters[type];
      values.forEach(([value, count]) => {
        const opt = document.createElement("div");
        opt.className = "filter-option";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = value;
        cb.checked = activeSet.has(value);
        opt.appendChild(cb);
        const label = document.createElement("span");
        label.textContent = value;
        label.style.flex = "1";
        label.style.overflow = "hidden";
        label.style.textOverflow = "ellipsis";
        opt.appendChild(label);
        const countSpan = document.createElement("span");
        countSpan.className = "filter-count";
        countSpan.textContent = count;
        opt.appendChild(countSpan);
        cb.addEventListener("change", () => {
          if (cb.checked) {
            activeSet.add(value);
          } else {
            activeSet.delete(value);
          }
          applyFilters();
          api.refreshBadges();
        });
        body.appendChild(opt);
      });
    }
  }

  function renderDateOptions(body, values, filters) {
    const activeDates = filters.date;
    const reopen = () => {
      close();
      openFor("date", dateButton());
    };
    const years = Object.keys(values).sort((a, b) => b - a);
    years.forEach((year) => {
      const yearDiv = document.createElement("div");
      yearDiv.className = "filter-option filter-date-year";
      const yearCb = document.createElement("input");
      yearCb.type = "checkbox";
      yearCb.value = `year:${year}`;
      yearCb.checked = Object.keys(values[year]).every((m) =>
        Object.keys(values[year][m].days).every((d) =>
          activeDates.has(`day:${year}:${m}:${d}`),
        ),
      );
      yearDiv.appendChild(yearCb);
      yearDiv.appendChild(document.createTextNode(year));
      yearCb.addEventListener("change", () => {
        const allDaysForYear = [];
        Object.keys(values[year]).forEach((m) => {
          Object.keys(values[year][m].days).forEach((d) => {
            allDaysForYear.push(`day:${year}:${m}:${d}`);
          });
        });
        if (yearCb.checked) {
          allDaysForYear.forEach((k) => filters.date.add(k));
        } else {
          allDaysForYear.forEach((k) => filters.date.delete(k));
        }
        applyFilters();
        reopen();
      });
      body.appendChild(yearDiv);

      const months = Object.keys(values[year]).sort((a, b) => b - a);
      months.forEach((month) => {
        const monthData = values[year][month];
        const monthDiv = document.createElement("div");
        monthDiv.className = "filter-option filter-date-month";
        const monthCb = document.createElement("input");
        monthCb.type = "checkbox";
        monthCb.value = `month:${year}:${month}`;
        monthCb.checked = Object.keys(monthData.days).every((d) =>
          activeDates.has(`day:${year}:${month}:${d}`),
        );
        monthDiv.appendChild(monthCb);
        monthDiv.appendChild(document.createTextNode(monthData.name));
        monthCb.addEventListener("change", () => {
          const allDaysForMonth = Object.keys(monthData.days).map(
            (d) => `day:${year}:${month}:${d}`,
          );
          if (monthCb.checked) {
            allDaysForMonth.forEach((k) => filters.date.add(k));
          } else {
            allDaysForMonth.forEach((k) => filters.date.delete(k));
          }
          applyFilters();
          reopen();
        });
        body.appendChild(monthDiv);

        const days = Object.keys(monthData.days).sort((a, b) => b - a);
        days.forEach((day) => {
          const dayData = monthData.days[day];
          const dayDiv = document.createElement("div");
          dayDiv.className = "filter-option filter-date-day";
          const dayCb = document.createElement("input");
          dayCb.type = "checkbox";
          dayCb.value = `day:${year}:${month}:${day}`;
          dayCb.checked = activeDates.has(dayCb.value);
          dayDiv.appendChild(dayCb);
          dayDiv.appendChild(document.createTextNode(dayData.label));
          const countSpan = document.createElement("span");
          countSpan.className = "filter-count";
          countSpan.textContent = dayData.count;
          dayDiv.appendChild(countSpan);
          dayCb.addEventListener("change", () => {
            if (dayCb.checked) {
              filters.date.add(dayCb.value);
            } else {
              filters.date.delete(dayCb.value);
            }
            applyFilters();
            reopen();
          });
          body.appendChild(dayDiv);
        });
      });
    });
  }

  function openFor(type, btn) {
    if (!btn) return;
    close();
    btn.classList.add("active");

    const dropdown = document.createElement("div");
    dropdown.className = "filter-dropdown";
    dropdown.dataset.filterType = type;

    const label = btn.closest("th").querySelector("span").textContent;
    dropdown.innerHTML = `
    <div class="filter-dropdown-header">
      <span>${label}</span>
      <div class="filter-dropdown-actions">
        <button class="filter-select-all">Zaznacz wszystko</button>
        <button class="filter-deselect-all">Wyczyść</button>
      </div>
    </div>
    <div class="filter-dropdown-body"></div>
  `;

    const body = dropdown.querySelector(".filter-dropdown-body");
    renderOptions(body, type, buildFilterValues(getResults(), type));

    document.body.appendChild(dropdown);

    const rect = btn.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 6}px`;
    dropdown.style.left = `${rect.left}px`;

    const dropdownWidth = 220;
    if (rect.left + dropdownWidth > window.innerWidth) {
      dropdown.style.left = `${window.innerWidth - dropdownWidth - 10}px`;
    }

    openDropdown = dropdown;

    dropdown
      .querySelector(".filter-select-all")
      .addEventListener("click", () => {
        const cbAll = dropdown.querySelectorAll(
          '.filter-option input[type="checkbox"]',
        );
        cbAll.forEach((cb) => {
          if (!cb.disabled) cb.checked = true;
        });
        applyFilters();
      });

    dropdown
      .querySelector(".filter-deselect-all")
      .addEventListener("click", () => {
        const cbAll = dropdown.querySelectorAll(
          '.filter-option input[type="checkbox"]',
        );
        cbAll.forEach((cb) => {
          if (!cb.disabled) cb.checked = false;
        });
        applyFilters();
      });
  }

  function refreshBadges() {
    updateFilterBadges(getFilters());
  }

  function bind({ onClear }) {
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const type = btn.dataset.filterType;
        if (
          openDropdown &&
          openDropdown.dataset.filterType === type
        ) {
          close();
        } else {
          openFor(type, btn);
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (
        openDropdown &&
        !e.target.closest(".filter-dropdown") &&
        !e.target.closest(".filter-btn")
      ) {
        close();
      }
    });

    document.addEventListener(
      "scroll",
      () => {
        close();
      },
      { capture: true },
    );

    const btnClear = document.getElementById("btn-clear-all-filters");
    if (btnClear) btnClear.addEventListener("click", onClear);
  }

  const api = { openFor, close, refreshBadges, bind };
  return api;
}
