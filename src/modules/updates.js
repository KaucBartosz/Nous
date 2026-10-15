// src/modules/updates.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";
import { elements } from './ui.js';
import { loadTestsList } from './library.js';
import { Notify } from '../notify/notify.js';
import { getLocalVersionsCached, updateUpdatesBadge } from './utils.js';
import { getPlatform } from '../platform/index.js';
import { loadCatalog, countUpdates, selectUpdatesView } from '../catalog/testCatalog.js';
import { setTestButtonState } from '../catalog/testCard.js';
import { bindSearchInput, bindCatalogProgress, buildUpdateStatusCell, buildUpdateActionCell } from '../catalog/catalogView.js';

let listenersRegistered = false; // Flaga zapobiegająca wielokrotnej rejestracji

/**
 * Inicjalizuje listenery platformy dla updates (wywołaj raz).
 * A4: delegacja do CatalogView — 1 reguła postępu zamiast kopii.
 */
export function initUpdatesListeners() {
    if (listenersRegistered) return;

    bindCatalogProgress(getPlatform(), {
        progressIdPrefix: 'force-update-',
        onInstalled: () => {
            console.log("Test installed (update), refreshing...");
            loadUpdatesData();
            loadTestsList(undefined, true);
        },
    });

    listenersRegistered = true;
}

export async function loadUpdatesData(filterText = '') {
    // A4: wspólne wiązanie wyszukiwarki (debounce-once w CatalogView)
    bindSearchInput('updates-search', (value) => loadUpdatesData(value));

    // Init listeners on first load
    initUpdatesListeners();

    elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Skanowanie...</td></tr>';
    try {
        // C5: rejestr + merge wersji z katalogu (bez backfillu/cache jak wcześniej);
        // na Web Firestore bezpośrednio (jak wcześniej — widok i tak zablokowany).
        const res = await loadCatalog({
            cloudEnabled: true,
            fetchRemote: () => getDocs(collection(db, "tests")),
            isOnline: () => true,
            getLocalVersions: getLocalVersionsCached,
            getSettings: () => ({}),
            backfill: false,
        });
        if (res.offline) throw new Error("Brak połączenia internetowego");

        elements.updatesTableBody.innerHTML = '';
        if (res.empty) {
            elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak testów.</td></tr>';
            return;
        }

        // 1-2. Filtr po nazwie + sort (F: czysty selektor w katalogu)
        let tests = selectUpdatesView(res.tests, filterText);

        // #12: Update badge count with number of tests needing update (C5: jedno źródło)
        updateUpdatesBadge(countUpdates(tests));

        if (tests.length === 0) {
            elements.updatesTableBody.innerHTML = '<tr><td colspan="5">Brak wyników wyszukiwania.</td></tr>';
            return;
        }

        tests.forEach(r => {
            // A4: komórki statusu/akcji z CatalogView (1 reguła statusOf).
            const row = document.createElement('tr');

            // Column 1: Test Name (SAFE - use textContent)
            const nameCell = document.createElement('td');
            nameCell.textContent = r.name || 'Brak nazwy';
            row.appendChild(nameCell);

            // Column 2: Local Version
            const localVerCell = document.createElement('td');
            localVerCell.textContent = r.local_ver || '-';
            row.appendChild(localVerCell);

            // Column 3: Remote Version
            const remoteVerCell = document.createElement('td');
            remoteVerCell.textContent = `v${r.remote_ver}`;
            row.appendChild(remoteVerCell);

            // Column 4: Status + Column 5: Actions
            row.appendChild(buildUpdateStatusCell(r));
            row.appendChild(buildUpdateActionCell(r, {
                onDownload: (t) => forceUpdate(t.download_url || t.downloadUrl, t.id, t.remote_ver, t.name, t.description),
                onDelete: (testId) => deleteLocalTest(testId),
            }));

            elements.updatesTableBody.appendChild(row);
        });
    } catch (e) {
        // Safe error rendering
        elements.updatesTableBody.innerHTML = '';
        const errorRow = document.createElement('tr');
        const errorCell = document.createElement('td');
        errorCell.colSpan = 5;
        errorCell.textContent = `Błąd: ${e.message}`;
        errorRow.appendChild(errorCell);
        elements.updatesTableBody.appendChild(errorRow);
    }
}

export async function forceUpdate(url, id, ver, name = "", description = "") {
  // A1: jawny komunikat zamiast silent no-op — użytkownik wie dlaczego nic się nie dzieje.
  if (!getPlatform().capabilities?.canDownload) {
    await Notify.info(
      "Pobieranie testów jest niedostępne w wersji Web. Użyj aplikacji Desktopowej.",
    );
    return;
  }
  const platform = getPlatform();
  {
    // Change button state (B: kanoniczny szablon)
    const btn = document.getElementById(`force-update-${id}`);
    if (btn) setTestButtonState(btn, { label: "..." });

    // Zakładka Aktualizacje to jedyne miejsce aktualizacji testów.
    await platform.tests.download({ url, id, ver, name, description });
  }
}

export async function deleteLocalTest(test_id) {
  // A1: jawny komunikat zamiast silent no-op.
  if (!getPlatform().capabilities?.canDelete) {
    await Notify.info(
      "Usuwanie testów jest niedostępne w wersji Web. Użyj aplikacji Desktopowej.",
    );
    return;
  }
  {
        const confirmed = await Notify.confirm("Czy na pewno chcesz usunąć ten test?");
        if (!confirmed) return;

        const res = await getPlatform().tests.deleteTest(test_id);
        if (res.success) {
            loadUpdatesData();
            loadTestsList();
        } else {
            await Notify.error("Błąd: " + res.error);
        }
    }
}
