// src/modules/history.js
import { db } from '../firebaseConfig.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getCurrentUser } from './auth.js';
import { elements } from './ui.js';

export async function loadHistoryData() {
    elements.historyTableBody.innerHTML = '<tr><td colspan="4">Ładowanie...</td></tr>';
    const user = getCurrentUser();

    if (!user) {
        elements.historyTableBody.innerHTML = '<tr><td colspan="4">Musisz być zalogowany.</td></tr>';
        return;
    }

    try {
        const q = query(collection(db, "results"), where("researcher_id", "==", user.uid), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        elements.historyTableBody.innerHTML = '';

        if (snap.empty) {
            elements.historyTableBody.innerHTML = '<tr><td colspan="4">Brak wyników.</td></tr>';
            return;
        }

        snap.forEach(doc => {
            const r = doc.data();
            const score = r.data.czas_reakcji ? `${r.data.czas_reakcji} ms` : (r.data.score || "JSON");

            // Jeśli mamy ID pacjenta w metryczce, wyświetl je
            const patientId = r.subject_id || r.data.subjectId || "-";

            elements.historyTableBody.innerHTML += `<tr>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
                <td>${r.test_id}</td>
                <td>${patientId}</td>
                <td><strong>${score}</strong></td>
            </tr>`;
        });
    } catch (e) {
        elements.historyTableBody.innerHTML = `<tr><td colspan="4">Błąd: ${e.message}</td></tr>`;
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
