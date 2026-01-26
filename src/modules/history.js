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

        myResults.forEach(r => {
            const score = r.data.czas_reakcji ? `${r.data.czas_reakcji} ms` : (r.data.score || "JSON");

            const patientId = r.subject_id || r.data.subjectId || "-";

            // Sync Status Icon
            let syncIcon = '';
            if (r.syncStatus === 'SYNCED') {
                syncIcon = `<span class="material-icons" style="color:#4caf50; font-size:18px;" title="Zsynchronizowano">cloud_done</span>`;
            } else if (r.syncStatus === 'PENDING') {
                syncIcon = `<span class="material-icons" style="color:#aaa; font-size:18px;" title="Czeka na wysyłkę">cloud_off</span>`;
            } else {
                syncIcon = `<span class="material-icons" style="color:red; font-size:18px;" title="Błąd">error</span>`;
            }

            elements.historyTableBody.innerHTML += `<tr>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
                <td>${r.testId}</td>
                <td>${patientId}</td>
                <td><strong>${score}</strong></td>
                <td style="text-align:center;">${syncIcon}</td>
            </tr>`;
        });
    } catch (e) {
        elements.historyTableBody.innerHTML = `<tr><td colspan="5">Błąd: ${e.message}</td></tr>`;
    }
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
