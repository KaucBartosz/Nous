// src/modules/history.js
import { getAllResults } from './database.js';
import { getCurrentUser } from './auth.js';
import { elements } from './ui.js';

export async function loadHistoryData() {
    elements.historyTableBody.innerHTML = '<tr><td colspan="5">Ładowanie...</td></tr>';
    const user = getCurrentUser();

    // Allow GUEST access too? For now, yes, but they only see their own local data
    const uid = user ? user.uid : "GUEST";

    try {
        const allResults = await getAllResults();

        // Filter by user locally
        const myResults = allResults
            .filter(r => r.researcher_uid === uid)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Descending

        elements.historyTableBody.innerHTML = '';

        if (myResults.length === 0) {
            elements.historyTableBody.innerHTML = '<tr><td colspan="5">Brak wyników.</td></tr>';
            return;
        }

        let rowsHTML = '';
        myResults.forEach((r, index) => {
            const resultData = r.wyniki || r.data || {};
            const score = resultData.czas_reakcji ? `${resultData.czas_reakcji} ms` : (resultData.score || "JSON");

            const patientId = r.subject_id || resultData.subjectId || "-";

            // Sync Status Icon
            let syncIcon = '';
            if (r.syncStatus === 'SYNCED') {
                syncIcon = `<span class="material-icons" style="color:#4caf50; font-size:18px;" title="Zsynchronizowano">cloud_done</span>`;
            } else if (r.syncStatus === 'PENDING') {
                syncIcon = `<span class="material-icons" style="color:#aaa; font-size:18px;" title="Czeka na wysyłkę">cloud_off</span>`;
            } else {
                syncIcon = `<span class="material-icons" style="color:red; font-size:18px;" title="Błąd">error</span>`;
            }

            rowsHTML += `<tr>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
                <td>${r.testId}</td>
                <td>${patientId}</td>
                <td><strong>${score}</strong></td>
                <td style="text-align:center;">${syncIcon}</td>
                <td style="text-align:center;">
                    <button class="btn-download-result icon-btn" data-index="${index}" title="Pobierz JSON">
                        <span class="material-icons" style="font-size:18px;">download</span>
                    </button>
                </td>
            </tr>`;
        });

        elements.historyTableBody.innerHTML = rowsHTML;

        // Attach event listeners
        document.querySelectorAll('.btn-download-result').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.dataset.index;
                const result = myResults[index];
                downloadSingleResult(result);
            });
        });

    } catch (e) {
        elements.historyTableBody.innerHTML = `<tr><td colspan="6">Błąd: ${e.message}</td></tr>`;
    }
}

function downloadSingleResult(result) {
    const format = document.querySelector('input[name="dl-format"]:checked').value;

    if (format === 'csv') {
        downloadSingleResultAsCSV(result);
    } else {
        const filename = `wynik_${result.testId}_${new Date(result.timestamp).getTime()}.json`;
        const jsonStr = JSON.stringify(result, null, 2);
        downloadFile(filename, jsonStr, 'application/json');
    }
}

function downloadSingleResultAsCSV(result) {
    // Flatten logic
    const flat = {};

    // Core fields
    flat['Data'] = new Date(result.timestamp).toLocaleString();
    flat['Test ID'] = result.testId;
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

    // Create CSV content (Vertical Key-Value or Horizontal?)
    // User requested "Single result CSV", usually horizontal is better for many, but single file?
    // Let's do a simple Key,Value list for single file, or one row with headers?
    // One row is standard for CSV.

    const bom = "\uFEFF"; // UTF-8 BOM for Excel
    const keys = Object.keys(flat);
    const header = keys.join(';');
    // Escape values that contain semicolons or newlines
    const values = keys.map(k => {
        let val = String(flat[k]);
        if (val.includes(';') || val.includes('\n')) {
            val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    }).join(';');

    const csvContent = bom + header + "\r\n" + values;
    const filename = `wynik_${result.testId}_${new Date(result.timestamp).getTime()}.csv`;

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
    URL.revokeObjectURL(url);
}

export function exportHistoryToCSV() {
    let csv = "";
    document.querySelectorAll('#history-table tr').forEach(row => {
        csv += Array.from(row.querySelectorAll('th, td')).map(c => c.innerText).join(",") + "\r\n";
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = "historia_wynikow.csv";
    link.click();
}
