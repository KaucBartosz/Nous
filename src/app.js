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
let activeDemographics = null; // Tu trzymamy dane pacjenta z formularza

// UI Elements
const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const emailInput = document.getElementById('email');
const passInput = document.getElementById('password');
const errorMsg = document.getElementById('error-msg');

const navLibrary = document.getElementById('nav-library');
const navHistory = document.getElementById('nav-history');
const navUpdates = document.getElementById('nav-updates');
const navDemographics = document.getElementById('nav-demographics'); // <---

const viewLibrary = document.getElementById('tests-grid');
const viewHistory = document.getElementById('history-view');
const viewUpdates = document.getElementById('updates-view');
const viewDemographics = document.getElementById('demographics-view'); // <---

const historyTableBody = document.querySelector('#history-table tbody');
const updatesTableBody = document.querySelector('#updates-table tbody');

const modalOverlay = document.getElementById('results-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnDiscard = document.getElementById('btn-discard');
const btnSaveDisk = document.getElementById('btn-save-disk');
const btnUploadCloud = document.getElementById('btn-upload-cloud');
const modalUploadInfo = document.getElementById('modal-upload-info');

const navAbout = document.getElementById('nav-about');
const aboutModal = document.getElementById('about-modal');
const btnCloseAbout = document.getElementById('btn-close-about');


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
navDemographics.addEventListener('click', () => switchView('demographics')); // <---

function switchView(viewName) {
    viewLibrary.classList.add('hidden');
    viewHistory.classList.add('hidden');
    viewUpdates.classList.add('hidden');
    viewDemographics.classList.add('hidden'); // <---
    
    navLibrary.classList.remove('active');
    navHistory.classList.remove('active');
    navUpdates.classList.remove('active');
    navDemographics.classList.remove('active'); // <---

    if (viewName === 'library') {
        viewLibrary.classList.remove('hidden'); navLibrary.classList.add('active');
        loadTestsList(); 
    } else if (viewName === 'history') {
        viewHistory.classList.remove('hidden'); navHistory.classList.add('active');
    } else if (viewName === 'updates') {
        viewUpdates.classList.remove('hidden'); navUpdates.classList.add('active');
    } else if (viewName === 'demographics') {
        viewDemographics.classList.remove('hidden'); navDemographics.classList.add('active');
    }
}

if (navAbout) {
    navAbout.addEventListener('click', () => {
        aboutModal.classList.remove('hidden');
    });
}

if (btnCloseAbout) {
    btnCloseAbout.addEventListener('click', () => {
        aboutModal.classList.add('hidden');
    });
}


// =========================================================
// CZĘŚĆ 3: LOGIKA DANYCH
// =========================================================

// --- A. BIBLIOTEKA ---
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

            let iconBadge = '';
            let btnText = 'Uruchom';
            let btnClass = 'primary';
            
            let versionParam = localVer > 0 ? localVer : remoteVer;

            if (localVer === 0) {
                iconBadge = `<span class="material-icons" style="color:#888; font-size:24px;" title="Nie pobrano">cloud_download</span>`;
                btnText = 'Pobierz';
                versionParam = remoteVer;
            } else if (localVer < remoteVer) {
                iconBadge = `<span class="material-icons" style="color:#ff9800; font-size:24px;" title="Dostępna aktualizacja w zakładce Aktualizacje">system_update</span>`;
                btnText = 'Uruchom'; 
                btnClass = 'outline';
                versionParam = localVer;
            } else {
                iconBadge = `<span class="material-icons" style="color:#4caf50; font-size:24px;" title="Zainstalowano">check_circle</span>`;
                btnText = 'Uruchom';
                versionParam = localVer;
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
                
                <button class="btn ${btnClass} small" style="margin-top:auto;" onclick="startTestProcess('${t.downloadUrl}', '${testId}', ${versionParam})">
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
            
            // Jeśli mamy ID pacjenta w metryczce, wyświetl je
            const patientId = r.data.subject_id || r.data.subjectId || "-";

            historyTableBody.innerHTML += `<tr>
                <td>${new Date(r.timestamp).toLocaleString()}</td>
                <td>${r.test_id}</td>
                <td>${patientId}</td>
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
        window.electronAPI.downloadAndRun(url, id, ver, false);
        setTimeout(() => loadTestsList(), 3000); 
    } else alert("Brak Electrona");
};

window.forceUpdate = (url, id, ver) => {
    if (window.electronAPI) {
        window.electronAPI.downloadAndRun(url, id, ver, true);
        alert("Pobieranie w tle...");
        setTimeout(() => {
            loadUpdatesData();
            loadTestsList();
        }, 2000);
    }
};

window.deleteLocalTest = async (testId) => {
    if(!confirm("Usunąć ten test z dysku?")) return;
    if (window.electronAPI) {
        const res = await window.electronAPI.deleteTest(testId);
        if(res.success) {
            loadUpdatesData();
            loadTestsList();
        } else {
            alert("Błąd: " + res.error);
        }
    }
};

// --- ODBIÓR WYNIKÓW I DOŁĄCZANIE METRYCZKI ---
// --- ODBIÓR WYNIKÓW I DOŁĄCZANIE METRYCZKI ---
if (window.electronAPI) {
    window.electronAPI.onTestResults((raw) => {
        console.log("Odebrano wyniki z testu. Przetwarzanie...");

        const u = auth.currentUser;
        
        // 1. PANCERNE SPRAWDZANIE METRYCZKI
        // Najpierw patrzymy do zmiennej w RAM
        let currentDemo = activeDemographics;

        // Jeśli w RAM jest pusto, sprawdzamy "dysk" (localStorage) - TO JEST NOWA CZĘŚĆ
        if (!currentDemo) {
            const saved = localStorage.getItem('activeDemographics');
            if (saved) {
                try {
                    currentDemo = JSON.parse(saved);
                    console.log("Pobrano metryczkę z LocalStorage (fallback):", currentDemo);
                } catch (e) {
                    console.error("Błąd parsowania metryczki:", e);
                }
            }
        }

        // 2. Ustalanie ID pacjenta
        let participantId = "GUEST";
        
        if (currentDemo && currentDemo.participant_id) {
            // Mamy dane z metryczki!
            participantId = currentDemo.participant_id;
        } else if (raw.subjectId && raw.subjectId !== "participant") {
            // Fallback: PsychoPy default
            participantId = raw.subjectId;
        }

        console.log("Finalne ID pacjenta:", participantId);
        console.log("Dołączana metryczka:", currentDemo);

        // 3. Budujemy pełny pakiet
        currentResultPackage = {
            testId: raw.testId || "test",
            timestamp: new Date().toISOString(),
            researcher_uid: u ? u.uid : "GUEST",
            
            // Nowe pola:
            subject_id: participantId,
            demographics: currentDemo,    // Tutaj wstawiamy znaleziony obiekt (lub null)
            
            wyniki: raw // Oryginalne dane z testu
        };
        
        openModal(currentResultPackage);
    });
}
// =========================================================
// CZĘŚĆ 5: OBSŁUGA METRYCZKI (ZAPIS)
// =========================================================

// Funkcja ładowania przy starcie
function loadSavedDemographics() {
    const saved = localStorage.getItem('activeDemographics');
    if (saved) {
        try {
            activeDemographics = JSON.parse(saved);
            
            // Wypełnij formularz jeśli elementy istnieją
            if(document.getElementById('demo-id')) {
                document.getElementById('demo-id').value = activeDemographics.participant_id || '';
                document.getElementById('demo-age').value = activeDemographics.age || '';
                document.getElementById('demo-gender').value = activeDemographics.gender || '';
                // NOWE POLA:
                document.getElementById('demo-DLcategory').value = activeDemographics.dl_category || '';
                document.getElementById('demo-DLexperience').value = activeDemographics.dl_experience || '';
                
                document.getElementById('demo-notes').value = activeDemographics.notes || '';
            }
        } catch (e) {
            console.error(e);
        }
    }
}

// Wywołaj przy starcie
loadSavedDemographics();

// Przycisk Zapisz
const btnSaveDemo = document.getElementById('btn-save-demo');
if (btnSaveDemo) {
    btnSaveDemo.addEventListener('click', () => {
        const id = document.getElementById('demo-id').value.trim();
        const age = document.getElementById('demo-age').value;
        const gender = document.getElementById('demo-gender').value;
        // NOWE POLA:
        const dlCat = document.getElementById('demo-DLcategory').value;
        const dlExp = document.getElementById('demo-DLexperience').value;
        
        const notes = document.getElementById('demo-notes').value;

        if (!id) {
            alert("Proszę podać przynajmniej Identyfikator (Kod)!");
            return;
        }

        activeDemographics = {
            participant_id: id,
            age: age,
            gender: gender,
            dl_category: dlCat,    // Prawo jazdy
            dl_experience: dlExp,  // Staż
            notes: notes,
            filled_at: new Date().toISOString()
        };

        // Zapis do pamięci
        localStorage.setItem('activeDemographics', JSON.stringify(activeDemographics));

        const statusSpan = document.getElementById('demo-status');
        statusSpan.style.display = 'inline';
        statusSpan.innerText = "Zapisano!";
        setTimeout(() => { statusSpan.style.display = 'none'; }, 3000);
        
        console.log("Zapisano:", activeDemographics);
    });
}
// =========================================================
// CZĘŚĆ 6: MODAL WYNIKÓW
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
            
            // Zapisujemy nowe pola też do bazy
            subject_id: currentResultPackage.subject_id,
            demographics: currentResultPackage.demographics,
            
            data: currentResultPackage.wyniki,
            timestamp: currentResultPackage.timestamp
        });
        alert("Wysłano pomyślnie!");
        modalOverlay.classList.add('hidden');
    } catch (e) { alert("Błąd: " + e.message); } 
    finally { btnUploadCloud.innerText = "Wyślij do Chmury"; }
});

function getFriendlyError(c) { return c; }