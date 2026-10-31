// src/cloud/firebase.js — jedyne miejsce w kodzie, które zna Firebase.
//
// Dlaczego tak: import tego modułu NIE pobiera gstatic.com. Cały Firebase
// wchodzi przez dynamiczny import() dopiero przy pierwszym realnym użyciu.
// Wersja Web chmury nie używa, więc nie płaci za nią ani bajtem na starcie
// (wcześniej ~184 KB blokowało pierwsze uruchomienie aplikacji).
//
// Warstwa powyżej woła intencje (`fetchRemoteTests`, `signIn`, …),
// nigdy SDK ani jego typów.

const SDK = "https://www.gstatic.com/firebasejs/12.8.0";

let loading = null;
let authRef = null;

/** Memoizowany import konfiguracji + SDK. Jedno miejsce z adresami gstatic. */
function load() {
  if (!loading) {
    loading = Promise.all([
      import("../firebaseConfig.js"),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]).then(([config, authSdk, firestoreSdk]) => {
      authRef = config.auth;
      return { auth: config.auth, db: config.db, ...authSdk, ...firestoreSdk };
    });
    // Nieudany start nie może zatruć kolejnych prób.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/** Czy chmura jest w ogóle dostępna w tym uruchomieniu (bez pobierania SDK). */
export function cloudLoaded() {
  return authRef !== null;
}

/** UID zalogowanego użytkownika — synchronicznie, null dopóki chmura nie wstała. */
export function currentUid() {
  return (authRef && authRef.currentUser && authRef.currentUser.uid) || null;
}

/** Obiekt użytkownika Firebase (null dopóki chmura nie wstała / w Web). */
export function currentUser() {
  return (authRef && authRef.currentUser) || null;
}

// ─── Uwierzytelnianie ────────────────────────────────────────────────────────

export async function onAuthStateChanged(callback) {
  const fb = await load();
  fb.auth.onAuthStateChanged(callback);
}

export async function signIn(email, password) {
  const fb = await load();
  await fb.signInWithEmailAndPassword(fb.auth, email, password);
}

export async function signUp(email, password) {
  const fb = await load();
  return fb.createUserWithEmailAndPassword(fb.auth, email, password);
}

export async function signOutRemote() {
  const fb = await load();
  await fb.signOut(fb.auth);
}

// ─── Dokumenty użytkownika ───────────────────────────────────────────────────

export async function fetchUserDoc(uid) {
  const fb = await load();
  const snap = await fb.getDoc(fb.doc(fb.db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserDoc(uid, payload) {
  const fb = await load();
  await fb.setDoc(fb.doc(fb.db, "users", uid), payload);
}

// ─── Katalog testów ──────────────────────────────────────────────────────────

export async function fetchRemoteTests() {
  const fb = await load();
  return fb.getDocs(fb.collection(fb.db, "tests"));
}

// ─── Wyniki ──────────────────────────────────────────────────────────────────

export async function saveRemoteResult(record) {
  const fb = await load();
  return fb.addDoc(fb.collection(fb.db, "results"), record);
}

export async function fetchResearcherResults(uid) {
  const fb = await load();
  const q = fb.query(
    fb.collection(fb.db, "results"),
    fb.where("researcher_uid", "==", uid),
    fb.orderBy("timestamp", "desc"),
  );
  return fb.getDocs(q);
}

// ─── Klucze szyfrowania (E2E) ────────────────────────────────────────────────

export async function fetchUserKeys(uid) {
  const fb = await load();
  const snap = await fb.getDoc(fb.doc(fb.db, "user_keys", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveUserKeys(uid, payload) {
  const fb = await load();
  await fb.setDoc(fb.doc(fb.db, "user_keys", uid), payload);
}
