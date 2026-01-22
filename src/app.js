// src/app.js

import { auth, db } from './firebaseConfig.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, setDoc, getDoc, addDoc, collection, getDocs, query, where, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- ZMIENNE GLOBALNE ---
let currentResultPackage = null;

// UI Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');

const navLibrary = document.getElementById('nav-library');
const navHistory = document.getElementById('nav-history');
const navUpdates = document.getElementById('nav-updates');

const viewLibrary = document.getElementById('tests-grid');
const viewHistory = document.getElementById('history-view');
const viewUpdates = document.getElementById('updates-view');

const historyTableBody = document.querySelector('#history-table tbody');
const updatesTableBody = document.querySelector('#updates-table tbody');

const modalOverlay = document.getElementById('results-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnDiscard = document.getElementById('btn-discard');
const btnSaveDisk = document.getElementById('btn-save-disk');
const btnUploadCloud = document.getElementById('btn-upload-cloud');
const modalUploadInfo = document.getElementById('modal-upload-info');


// =========================================================
// CZĘŚĆ 1: UWIERZYTELNIANIE
// =========================================================

document.getElementById('btn-login').addEventListener('click', async () => {
    try {
        errorMsg.innerText = "Logowanie...";
        await signInWithEmailAndPassword(auth, emailInput.value, passInput.value);
    } catch (error) { errorMsg.innerText = getFriendlyError(error.code); }
});

document.getElementById('btn-register').addEventListener('click', async () => {
    if(passInput.value.length < 6) { errorMsg.innerText = "Hasło min. 6 znaków."; return; }
    try {
        errorMsg.innerText = "Tworzenie konta...";
        const userCred = await createUserWithEmailAndPassword(auth, emailInput.value, passInput.value);
        await setDoc(doc(db, "users", userCred.user.uid), {
            email: userCred.user.email, status: "PENDING", createdAt: new Date().toISOString()
        });
        errorMsg.innerText = "Konto utworzone!";
    } catch (error) { errorMsg.innerText = getFriendlyError(error.code); }
});

document.getElementById('btn-guest').addEventListener('click', () => setupDashboardView(null, "GUEST"));
document.getElementById('btn-logout').addEventListener('click', () => { signOut(auth); location.reload(); });

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setupDashboardView(user.email, userDoc.exists() ? userDoc.data().status : "ERROR");
    } else {
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    }
});

function setupDashboardView(email, status) {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    
    document.getElementById('user-email-display').innerText = email || "Gość";
    const statusDisp = document.getElementById('user-status-display');
    statusDisp.innerText = status;
    
    if (status === 'APPROVED') statusDisp.style.color = '#4caf50';
    else if (status === 'PENDING') statusDisp.style.color = '#ff9800';
    else statusDisp.style.color = '#aaa';

    loadTestsList();
}


// =========================================================
// CZĘŚĆ 2: NAWIGACJA
// =========================================================

navLibrary.addEventListener('click', () => switchView('library'));
navHistory.addEventListener('click', () => { switchView('history'); loadHistoryData(); });
navUpdates.addEventListener('click', () => { switchView('updates'); loadUpdatesData(); });

function switchView(viewName) {
    viewLibrary.classList.add('hidden');
    viewHistory.classList.add('hidden');
    viewUpdates.classList.add('hidden');
    
    navLibrary.classList.remove('active');
    navHistory.classList.remove('active');
    navUpdates.classList.remove('active');

    if (viewName === 'library') {
        viewLibrary.classList.remove('hidden'); navLibrary.classList.add('active');
    } else if (viewName === 'history') {
        viewHistory.classList.remove('hidden'); navHistory.classList.add('active');
    } else if (viewName === 'updates') {
        viewUpdates.classList.remove('hidden'); navUpdates.classList.add('active');
    }
}


// =========================================================
// CZĘŚĆ 3: LOGIKA DANYCH
// =========================================================

// --- A. BIBLIOTEKA (Z ikonami statusu) ---
window.loadTestsList = async function() {
    viewLibrary.innerHTML = '<p style="color:#888;">Ładowanie biblioteki...</p>';
    try {
        const snap = await getDocs(collection(db, "tests"));
        
        let localVersions = {};
        if (window.electronAPI) {
            localVersions = await window.electronAPI.getLocalVersions();
        }

        viewLibrary.innerHTML = '';
        
        if (snap.empty) { viewLibrary.innerHTML = '<p>Brak testów.</p>'; return; }

        snap.forEach(doc => {
            const t = doc.data();
            const testId = doc.id;
            
            const localVer = localVersions[testId] ? Number(localVersions[testId]) : 0;
            const remoteVer = Number(t.version);

            // Logika ikon
            let iconBadge = '';
            let btnText = 'Uruchom';
            let btnClass = 'primary';

            if (localVer === 0) {
                // Nie pobrano
                iconBadge = `<span class="material-icons" style="color:#888; font-size:24px;" title="Nie pobrano">cloud_download</span>`;
                btnText = 'Pobierz';
            } else if (localVer < remoteVer) {
                // Aktualizacja
                iconBadge = `<span class="material-icons" style="color:#ff9800; font-size:24px;" title="Dostępna aktualizacja">system_update</span>`;
                btnText = 'Aktualizuj';
            } else {
                // Zainstalowano
                iconBadge = `<span class="material-icons" style="color:#4caf50; font-size:24px;" title="Zainstalowano">check_circle</span>`;
            }

            const card = document.createElement('div');
            card.className = 'test-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="material-icons" style="font-size:40px; color:#444;">assignment</span>
                        ${iconBadge} 
                    </div>
                    <span class="meta" style="color:#666;">v${t.version}</span>
                </div>
                
                <h4 style="margin-top:10px;">${t.name}</h4>
                <p>${t.description}</p>
                
                <button class="btn ${btnClass} small" style="margin-top:auto;" onclick="startTestProcess('${t.downloadUrl}', '${testId}', ${t.version})">
                    <span class="material-icons">play_arrow</span> ${btnText}
                </button>
            `;
            viewLibrary.appendChild(card);
        });
    } catch (e) { 
        console.error(e); 
        viewLibrary.innerHTML = '<p>Błąd ładowania.</p>'; 
    }
};


// --- B. HISTORIA ---
async function loadHistoryData() {
    historyTableBody.innerHTML = '<tr><td colspan="4">Ładowanie...</td></tr>';
    if (!auth.currentUser) { historyTableBody.innerHTML = '<tr><td colspan="4">Musisz być zalogowany.</td></tr>'; return; }
    
    try {
        const q = query(collection(db, "results"), where("researcher_id", "==", auth.currentUser.uid), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        historyTableBody.innerHTML = '';
        
        if (snap.empty) { historyTableBody.innerHTML = '<tr><td colspan="4">Brak wyników.</td></tr>'; return; }

        snap.forEach(doc => {
            const r = doc.data();
            const score = r.data.czas_reakcji ? `${r.data.czas_reakcji} ms` : (r.data.score || "JSON");
            historyTableBody.innerHTML += `<tr>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
                <td>${r.test_id}</td>
                <td>${r.data.subject_id || "-"}</td>
                <td><strong>${score}</strong></td>
            </tr>`;
        });
    } catch (e) { historyTableBody.innerHTML = `<tr><td colspan="4">Błąd: ${e.message}</td></tr>`; }
}

document.getElementById('btn-export-csv').addEventListener('click', () => {
    let csv = "";
    document.querySelectorAll('#history-table tr').forEach(row => {
        csv += Array.from(row.querySelectorAll('th, td')).map(c => c.innerText).join(",") + "\r\n";
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    link.download = "historia_wynikow.csv";
    link.click();
});


// --- C. MENEDŻER AKTUALIZACJI ---
async function loadUpdatesData() {
    updatesTableBody.innerHTML = '<tr><td colspan="5">Skanowanie...</td></tr>';
    try {
        const remoteSnap = await getDocs(collection(db, "tests"));
        let localVersions = {};
        if (window.electronAPI) localVersions = await window.electronAPI.getLocalVersions();

        updatesTableBody.innerHTML = '';
        if (remoteSnap.empty) { updatesTableBody.innerHTML = '<tr><td colspan="5">Brak testów.</td></tr>'; return; }

        remoteSnap.forEach(doc => {
            const r = doc.data();
            const id = doc.id;
            const remoteVer = Number(r.version);
            const localVer = localVersions[id] ? Number(localVersions[id]) : 0;

            let status = '';
            let buttons = '';

            if (localVer === 0) {
                status = '<span style="color:#888">Nie zainstalowano</span>';
                buttons = `<button class="btn primary small" onclick="forceUpdate('${r.downloadUrl}', '${id}', ${remoteVer})">
                    <span class="material-icons" style="font-size:16px;">download</span> Pobierz
                </button>`;
            } else {
                if (localVer < remoteVer) {
                    status = `<span style="color:#ff9800;font-weight:bold">Aktualizacja! (v${localVer} &#8594; v${remoteVer})</span>`;
                    buttons = `<button class="btn primary small" onclick="forceUpdate('${r.downloadUrl}', '${id}', ${remoteVer})">
                        <span class="material-icons" style="font-size:16px;">system_update_alt</span> Aktualizuj
                    </button>`;
                } else {
                    status = '<span style="color:#4caf50">Aktualne</span>';
                    buttons = `<button class="btn outline small" disabled>Aktualne</button>`;
                }
                buttons += `<button class="btn danger small" style="margin-left:5px;" onclick="deleteLocalTest('${id}')">
                    <span class="material-icons" style="font-size:16px;">delete</span> Usuń
                </button>`;
            }

            updatesTableBody.innerHTML += `<tr>
                <td>${r.name}</td><td>${localVer || '-'}</td><td>v${remoteVer}</td><td>${status}</td><td>${buttons}</td>
            </tr>`;
        });
    } catch (e) { updatesTableBody.innerHTML = `<tr><td colspan="5">Błąd: ${e.message}</td></tr>`; }
}


// =========================================================
// CZĘŚĆ 4: KOMUNIKACJA Z ELECTRONEM
// =========================================================

window.startTestProcess = (url, id, ver) => {
    if (window.electronAPI) {
        // Run mode
        window.electronAPI.downloadAndRun(url, id, ver, false);
    } else alert("Brak Electrona");
};

window.forceUpdate = (url, id, ver) => {
    if (window.electronAPI) {
        // Download only mode
        window.electronAPI.downloadAndRun(url, id, ver, true);
        alert("Pobieranie w tle...");
        setTimeout(loadUpdatesData, 2000);
    }
};

window.deleteLocalTest = async (testId) => {
    if(!confirm("Usunąć ten test z dysku?")) return;
    if (window.electronAPI) {
        const res = await window.electronAPI.deleteTest(testId);
        if(res.success) {
            loadUpdatesData(); 
            // Jeśli byliśmy w bibliotece, to odświeżmy też bibliotekę
            if(!viewLibrary.classList.contains('hidden')) loadTestsList();
        } else {
            alert("Błąd: " + res.error);
        }
    }
};

if (window.electronAPI) {
    window.electronAPI.onTestResults((raw) => {
        const u = auth.currentUser;
        currentResultPackage = {
            testId: raw.testId || "test",
            timestamp: new Date().toISOString(),
            researcher_uid: u ? u.uid : "GUEST",
            wyniki: raw
        };
        openModal(currentResultPackage);
    });
}


// =========================================================
// CZĘŚĆ 5: MODAL WYNIKÓW
// =========================================================

function openModal(data) {
    const s = data.wyniki.czas_reakcji ? `${data.wyniki.czas_reakcji} ms` : (data.wyniki.score || "Koniec");
    document.getElementById('modal-score').innerText = s;
    document.getElementById('modal-json-preview').innerText = JSON.stringify(data.wyniki, null, 2);
    checkPermissions();
    modalOverlay.classList.remove('hidden');
}

function checkPermissions() {
    const isAppr = document.getElementById('user-status-display').innerText === 'APPROVED';
    const isOnline = navigator.onLine;
    const isLog = auth.currentUser !== null;
    
    if (isAppr && isOnline && isLog) {
        btnUploadCloud.disabled = false;
        modalUploadInfo.innerHTML = '<span class="material-icons" style="color:#4caf50">check</span> Gotowy';
    } else {
        btnUploadCloud.disabled = true;
        modalUploadInfo.innerHTML = '<span class="material-icons" style="color:orange">block</span> Brak uprawnień/sieci';
    }
}

btnCloseModal.addEventListener('click', () => modalOverlay.classList.add('hidden'));
btnDiscard.addEventListener('click', () => { if(confirm("Odrzucić?")) modalOverlay.classList.add('hidden'); });

btnSaveDisk.addEventListener('click', () => { 
    if (currentResultPackage) window.electronAPI.saveResultToDisk(currentResultPackage); 
});

btnUploadCloud.addEventListener('click', async () => {
    if (!currentResultPackage) return;
    try {
        btnUploadCloud.innerText = "Wysyłanie...";
        await addDoc(collection(db, "results"), {
            researcher_id: auth.currentUser.uid,
            test_id: currentResultPackage.testId,
            data: currentResultPackage.wyniki,
            timestamp: currentResultPackage.timestamp
        });
        alert("Wysłano pomyślnie!");
        modalOverlay.classList.add('hidden');
    } catch (e) { alert("Błąd: " + e.message); } 
    finally { btnUploadCloud.innerText = "Wyślij do Chmury"; }
});

function getFriendlyError(c) { return c; }