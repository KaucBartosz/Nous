// src/modules/history.js
import { getAllResults } from './database.js';
import { getCurrentUser } from './auth.js';
import { elements } from './ui.js';

export async function loadHistoryData() {
    elements.historyTableBody.innerHTML = '<tr><td colspan="6">Ładowanie...</td></tr>';
    const user = getCurrentUser();

    // Allow GUEST access too - they only see their own local data
    const uid = user ? user.uid : "GUEST";

    try {
        const allResults = await getAllResults();

        // Filter by user locally
        const myResults = allResults
            .filter(r => r.researcher_uid === uid)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Descending

        elements.historyTableBody.innerHTML = '';

        if (myResults.length === 0) {
            elements.historyTableBody.innerHTML = '<tr><td colspan="6">Brak wyników.</td></tr>';
            return;
        }

        // --- SAFE DOM CREATION (No innerHTML) ---
        myResults.forEach((r, index) => {
            const resultData = r.wyniki || r.data || {};
            const score = resultData.czas_reakcji ? `${resultData.czas_reakcji} ms` : (resultData.score || "JSON");
            const patient_id = r.subject_id || resultData.subject_id || resultData.subjectId || "-";

            const row = document.createElement('tr');

            // 1. Date
            const tdDate = document.createElement('td');
            tdDate.textContent = new Date(r.timestamp).toLocaleString();
            row.appendChild(tdDate);

            // 2. Test ID
            const tdTestId = document.createElement('td');
            tdTestId.textContent = r.test_id || r.testId;
            row.appendChild(tdTestId);

            // 3. Patient ID
            const tdPatient = document.createElement('td');
            tdPatient.textContent = patient_id;
            row.appendChild(tdPatient);

            // 4. Score
            const tdScore = document.createElement('td');
            const strongScore = document.createElement('strong');
            strongScore.textContent = score;
            tdScore.appendChild(strongScore);
            row.appendChild(tdScore);

            // 5. Sync Status
            const tdSync = document.createElement('td');
            tdSync.style.textAlign = 'center';
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.style.fontSize = '18px';

            const sync_status = r.sync_status || r.syncStatus;

            if (r.researcher_uid === 'GUEST') {
                icon.textContent = 'dns';
                icon.style.color = '#888';
                icon.title = 'Lokalne (Tryb Gościa)';
            } else if (sync_status === 'SYNCED') {
                icon.textContent = 'cloud_done';
                icon.style.color = '#4caf50';
                icon.title = 'Zsynchronizowano';
            } else if (sync_status === 'PENDING') {
                icon.textContent = 'cloud_off';
                icon.style.color = '#aaa';
                icon.title = 'Czeka na wysyłkę';
            } else {
                icon.textContent = 'error';
                icon.style.color = 'red';
                icon.title = `Status nieznany: ${sync_status}`;
            }
            tdSync.appendChild(icon);
            row.appendChild(tdSync);

            // 6. Action (Download)
            const tdAction = document.createElement('td');
            tdAction.style.textAlign = 'center';

            const btn = document.createElement('button');
            btn.className = 'btn-download-result icon-btn';
            btn.title = 'Pobierz JSON';

            const btnIcon = document.createElement('span');
            btnIcon.className = 'material-icons';
            btnIcon.style.fontSize = '18px';
            btnIcon.textContent = 'download';

            btn.appendChild(btnIcon);

            // Bind click directly
            btn.addEventListener('click', () => {
                downloadSingleResult(r);
            });

            tdAction.appendChild(btn);
            row.appendChild(tdAction);

            elements.historyTableBody.appendChild(row);
        });

    } catch (e) {
        elements.historyTableBody.textContent = `Błąd: ${e.message}`;
    }
}

function downloadSingleResult(result) {
    const format = document.querySelector('input[name="dl-format"]:checked').value;

    if (format === 'csv') {
        downloadSingleResultAsCSV(result);
    } else {
        const test_id = result.test_id || result.testId;
        const filename = `wynik_${test_id}_${new Date(result.timestamp).getTime()}.json`;
        const jsonStr = JSON.stringify(result, null, 2);
        downloadFile(filename, jsonStr, 'application/json');
    }
}

function downloadSingleResultAsCSV(result) {
    // Flatten logic
    const flat = {};

    // Core fields
    flat['Data'] = new Date(result.timestamp).toLocaleString();
    flat['Test ID'] = result.test_id || result.testId;
    flat['ID Badanego'] = result.subject_id || "-";
    flat['Badacz UID'] = result.researcher_uid;

    // Demographics data (if any)
    const demo = result.demographics || {};
    if (demo.data) {
        Object.keys(demo.data).forEach(k => {
            flat[`Metryczka - ${k}`] = demo.data[k];
        });
    }

    // Result data (wyniki or data)
    const resData = result.wyniki || result.data || {};
    flattenObject(resData, flat, 'Wynik');

    // Create Vertical CSV (Table view)
    // Column 1: Parametr
    // Column 2: Wartość

    const bom = "\uFEFF";
    let csvContent = bom + "Parametr;Wartość\r\n";

    for (const [key, value] of Object.entries(flat)) {
        let valStr = String(value);
        // Escape semicolons and newlines in text
        if (valStr.includes(';') || valStr.includes('\n')) {
            valStr = `"${valStr.replace(/"/g, '""')}"`;
        }
        csvContent += `${key};${valStr}\r\n`;
    }

    const test_id = result.test_id || result.testId;
    const filename = `wynik_${test_id}_${new Date(result.timestamp).getTime()}.csv`;
    downloadFile(filename, csvContent, 'text/csv;charset=utf-8;');
}

function flattenObject(obj, target, prefix) {
    for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            flattenObject(obj[key], target, `${prefix} - ${key}`);
        } else {
            target[`${prefix} - ${key}`] = Array.isArray(obj[key]) ? JSON.stringify(obj[key]) : obj[key];
        }
    }
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Opóźnione zwolnienie URL aby przeglądarka zdążyła pobrać plik
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportHistoryToCSV() {
    const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    let csv = bom;

    document.querySelectorAll('#history-table tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        const rowData = cells.map(cell => {
            // Remove icon content, only get actual text
            const clone = cell.cloneNode(true);
            // Remove all Material Icons spans
            clone.querySelectorAll('.material-icons').forEach(icon => icon.remove());
            // Remove button elements
            clone.querySelectorAll('button').forEach(btn => btn.remove());

            let text = clone.textContent.trim();

            // Escape commas and quotes for CSV
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                text = `"${text.replace(/"/g, '""')}"`;
            }

            return text;
        });

        csv += rowData.join(',') + "\r\n";
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historia_wynikow.csv";
    link.click();

    // Opóźnione zwolnienie URL
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
