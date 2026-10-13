// src/session/e2ePolicy.js — E2EPolicy (C4): orkiestracja klucza chmurowego bez DOM.
// Modale/PIN-copy w modules/e2e.js; tu decyzje + kryptografia. Wszystko testowalne na fejkach.
export function isValidPin(pin) {
  return !!pin && pin.length === 6 && /^\d+$/.test(pin);
}

/** Sól KDF z uid (rdzeń dawnego getUserSalt — bez zależności od auth). */
export function saltForUid(uid) {
  return Array.from(uid)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

/** Pierwsza konfiguracja: losowy master → chmura → RAM. Zwraca master hex. */
export async function setupNewMaster({ uid, pin, salt }, cloudVault, { setRamKey }) {
  const master = await cloudVault.setupNewMaster({ uid, pin, salt });
  await setRamKey(master);
  return master;
}

/** Odblokowanie: unwrap PIN-em → RAM. Błędny PIN rzuca (unwrap: "Invalid PIN"). */
export async function unlockWithPin({ uid, pin, salt }, cloudVault, { setRamKey }) {
  const master = await cloudVault.unlockWithPin({ uid, pin, salt });
  await setRamKey(master);
  return master;
}

/** Odzyskiwanie: kod (już oczyszczony) nowym PIN-em → chmura + RAM. */
export async function recoverWithCode({ uid, cleanCode, newPin, salt }, cloudVault, { setRamKey }) {
  await cloudVault.rotateMaster({ uid, master: cleanCode, pin: newPin, salt });
  await setRamKey(cleanCode);
  return cleanCode;
}

/** Stan zdalnego klucza: 'present' | 'missing' | 'error'. */
export async function describeRemoteKey(uid, fetchMeta) {
  try {
    const meta = await fetchMeta(uid);
    return meta && meta.encryptedMasterKey ? "present" : "missing";
  } catch (e) {
    return "error";
  }
}
