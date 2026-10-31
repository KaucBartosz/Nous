// src/history/historyTable.js — tabela Historii (split 3/3).
// Własność: wiersze wyników, paginacja, selekcja, etykiety przycisków.
// Czyste reguły (score/patient/empty/labels) osobno od DOM; orkiestrator
// (modules/history.js) dostarcza stan i callbacki domenowe (claim/sync).

/** Tekst wyniku w wierszu (czas_reakcji → score → JSON). */
export function scoreTextOf(r) {
  const resultData = r.wyniki || r.data || {};
  return resultData.czas_reakcji
    ? `${resultData.czas_reakcji} ms`
    : resultData.score || "JSON";
}

/** Identyfikator badanego w wierszu (4 źródła jak wcześniej). */
export function patientIdOf(r) {
  const resultData = r.wyniki || r.data || {};
  return (
    r.subject_id || resultData.subject_id || resultData.subjectId || "-"
  );
}

/** Komunikat pustej tabeli (filtry wygrywają z trybem gościa jak wcześniej). */
export function emptyMessage({ guestView, hasFilters }) {
  if (hasFilters) return "Brak wyników pasujących do aktywnych filtrów.";
  if (guestView) return "Brak wyników w trybie Gościa.";
  return "Brak wyników.";
}

/** Etykieta przycisku ZIP per widok (cloud ignoruje filtry jak wcześniej). */
export function downloadButtonLabel(
  variant,
  { count, hasFilters, filteredCount },
) {
  const icon = `<span class="material-icons">download</span>`;
  if (count > 0) return `${icon} Pobierz zaznaczone (${count})`;
  if (hasFilters && variant !== "cloud")
    return `${icon} Pobierz przefiltrowane (${filteredCount})`;
  if (variant === "local") return `${icon} Pobierz wszystkie wyniki`;
  return `${icon} Pobierz wszystkie`;
}

/**
 * Odświeża teksty przycisków ZIP i widoczność koszy.
 * @param {object} sel — { count, hasFilters, filteredCount, guestView, cloudView }
 */
export function refreshDownloadButtons(sel) {
  const { count, guestView, cloudView } = sel;
  const btnTextLocal = document.getElementById("btn-local-download-text");
  const btnTextGuest = document.getElementById("btn-guest-download-text");
  const btnTextCloud = document.getElementById("btn-cloud-download-text");

  if (btnTextLocal)
    btnTextLocal.innerHTML = downloadButtonLabel("local", sel);
  if (btnTextGuest)
    btnTextGuest.innerHTML = downloadButtonLabel("guest", sel);
  if (btnTextCloud)
    btnTextCloud.innerHTML = downloadButtonLabel("cloud", sel);

  const btnLocalDelete = document.getElementById("btn-local-delete-selected");
  const btnGuestDelete = document.getElementById("btn-guest-delete-selected");

  if (btnLocalDelete) {
    if (count > 0 && !cloudView && !guestView)
      btnLocalDelete.classList.remove("hidden");
    else btnLocalDelete.classList.add("hidden");
  }

  if (btnGuestDelete) {
    if (count > 0 && guestView) btnGuestDelete.classList.remove("hidden");
    else btnGuestDelete.classList.add("hidden");
  }
}

function checkboxCell(r, selectedIds, onCheck) {
  const td = document.createElement("td");
  td.style.textAlign = "center";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "result-checkbox";
  cb.dataset.id = r.id || r.firestore_id;
  cb.checked = selectedIds.has(cb.dataset.id);
  cb.addEventListener("change", onCheck);
  td.appendChild(cb);
  return td;
}

function claimCell(r, claim) {
  const td = document.createElement("td");
  td.style.textAlign = "center";
  const btnClaim = document.createElement("button");
  btnClaim.className = "btn small primary";
  btnClaim.style.padding = "2px 8px";
  btnClaim.style.fontSize = "12px";
  btnClaim.innerHTML =
    '<span class="material-icons" style="font-size:14px; vertical-align:middle; margin-right:4px;">input</span> Przejmij';
  btnClaim.title = "Przypisz ten wynik do swojego konta";
  btnClaim.onclick = async (e) => {
    e.stopPropagation();
    await claim.onClaim(r, claim.userUid);
  };
  td.appendChild(btnClaim);
  return td;
}

function syncStatusCell(r, { canUpload, syncRecord, onSyncError }) {
  const td = document.createElement("td");
  td.style.textAlign = "center";
  const icon = document.createElement("span");
  icon.className = "material-icons";
  icon.style.fontSize = "18px";

  const sync_status = r.sync_status || r.syncStatus;

  if (r.researcher_uid && r.researcher_uid.startsWith("LOCAL::")) {
    icon.textContent = "computer";
    icon.style.color = "#64b5f6";
    icon.title = "Konto lokalne";
  } else if (sync_status === "LOCAL") {
    icon.textContent = "computer";
    icon.style.color = "#64b5f6";
    icon.title = "Konto lokalne";
  } else if (r.researcher_uid === "GUEST") {
    icon.textContent = "dns";
    icon.style.color = "#888";
    icon.title = "Lokalne (Tryb Gościa)";
  } else if (sync_status === "SYNCED") {
    icon.textContent = "cloud_done";
    icon.style.color = "#4caf50";
    icon.title = "Zsynchronizowano";
  } else if (sync_status === "PENDING") {
    if (canUpload) {
      icon.textContent = "cloud_upload";
      icon.style.color = "#ff9800";
      icon.style.cursor = "pointer";
      icon.title = "Kliknij, aby wysłać do chmury";

      icon.onclick = async (e) => {
        e.stopPropagation();
        icon.textContent = "sync";
        icon.classList.add("spin");
        icon.style.color = "#2196f3";
        icon.onclick = null;

        try {
          await syncRecord(r);
        } catch (err) {
          icon.classList.remove("spin");
          icon.textContent = "error";
          icon.style.color = "red";
          await onSyncError(err);
        }
      };
    } else {
      icon.textContent = "cloud_off";
      icon.style.color = "#aaa";
      icon.title = "Czeka na wysyłkę (Wymagany status APPROVED)";
    }
  } else {
    icon.textContent = "error";
    icon.style.color = "red";
    icon.title = `Status nieznany: ${sync_status}`;
  }
  td.appendChild(icon);
  return td;
}

function downloadCell(r, onDownload) {
  const td = document.createElement("td");
  td.style.textAlign = "center";
  const btn = document.createElement("button");
  btn.className = "btn-download-result icon-btn";
  btn.title = "Pobierz JSON";
  const btnIcon = document.createElement("span");
  btnIcon.className = "material-icons";
  btnIcon.style.fontSize = "18px";
  btnIcon.textContent = "download";
  btn.appendChild(btnIcon);
  btn.addEventListener("click", () => onDownload(r));
  td.appendChild(btn);
  return td;
}

/**
 * Renderuje wiersze do tbody.
 * @param {object} ctx — { selectedIds, claim: {userUid,onClaim}|null,
 *   canUpload, onCheck, syncRecord, onSyncError, onDownload }
 */
export function renderHistoryRows(tbody, items, ctx) {
  items.forEach((r) => {
    const row = document.createElement("tr");
    row.appendChild(checkboxCell(r, ctx.selectedIds, ctx.onCheck));

    const tdDate = document.createElement("td");
    tdDate.textContent = new Date(r.timestamp).toLocaleString();
    row.appendChild(tdDate);

    const tdTestId = document.createElement("td");
    tdTestId.textContent = r.test_id || r.testId;
    row.appendChild(tdTestId);

    const tdPatient = document.createElement("td");
    tdPatient.textContent = patientIdOf(r);
    row.appendChild(tdPatient);

    const tdScore = document.createElement("td");
    const strongScore = document.createElement("strong");
    strongScore.textContent = scoreTextOf(r);
    tdScore.appendChild(strongScore);
    row.appendChild(tdScore);

    row.appendChild(
      ctx.claim
        ? claimCell(r, ctx.claim)
        : syncStatusCell(r, ctx),
    );
    row.appendChild(downloadCell(r, ctx.onDownload));
    tbody.appendChild(row);
  });
}

/**
 * Paginacja: tworzy kontener raz, renderuje Prev/Info/Next.
 * @returns {boolean} false gdy 1 strona (kontener ukryty).
 */
export function renderPagination({ page, totalPages, totalItems, onPage }) {
  let container = document.getElementById("history-pagination");
  if (!container) {
    container = document.createElement("div");
    container.id = "history-pagination";
    container.className = "history-pagination";
    const tableContainer = document.querySelector(
      "#history-view .table-container",
    );
    if (tableContainer) {
      tableContainer.insertAdjacentElement("afterend", container);
    }
  }

  if (totalPages <= 1) {
    container.style.display = "none";
    return false;
  }

  container.style.display = "flex";
  container.innerHTML = "";

  const btnPrev = document.createElement("button");
  btnPrev.className = "btn outline small";
  btnPrev.textContent = "← Poprzednia";
  btnPrev.disabled = page <= 1;
  btnPrev.addEventListener("click", () => {
    if (page > 1) onPage(page - 1);
  });

  const pageInfo = document.createElement("span");
  pageInfo.className = "pagination-info";
  pageInfo.textContent = `Strona ${page} z ${totalPages} (${totalItems} wyników)`;

  const btnNext = document.createElement("button");
  btnNext.className = "btn outline small";
  btnNext.textContent = "Następna →";
  btnNext.disabled = page >= totalPages;
  btnNext.addEventListener("click", () => {
    if (page < totalPages) onPage(page + 1);
  });

  container.appendChild(btnPrev);
  container.appendChild(pageInfo);
  container.appendChild(btnNext);
  return true;
}
