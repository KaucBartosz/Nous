// src/session/passwordHash.js — haszowanie haseł kont lokalnych (C4).
// Przeniesione 1:1 z modules/auth.js (SHA-256 salt+password) — jedyne miejsce solenia.
export function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(salt, password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPassword(salt, password, expectedHash) {
  return (await hashPassword(salt, password)) === expectedHash;
}
