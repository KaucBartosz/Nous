// src/session/passwordHash.js — haszowanie haseł kont lokalnych (C4).
// v1: SHA-256(salt + password) — jedna iteracja, bez work factora.
// v2 (plan 013): PBKDF2-HMAC-SHA256, 200 000 iteracji, 256-bitowy klucz.
// HASH_VERSION jest jedynym źródłem prawdy o algorytmie — starsze gałęzie
// w verifyPassword zostają, żeby stare konta nie straciły dostępu.
export const HASH_VERSION = 2;

const PBKDF2_ITERATIONS = 200000;

export function generateSalt() {
  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(salt, password) {
  const data = new TextEncoder().encode(salt + password);
  return bytesToHex(await window.crypto.subtle.digest("SHA-256", data));
}

async function pbkdf2Hex(salt, password) {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    256,
  );
  return bytesToHex(bits);
}

export async function hashPassword(salt, password) {
  return pbkdf2Hex(salt, password);
}

export async function verifyPassword(
  salt,
  password,
  expectedHash,
  version = HASH_VERSION,
) {
  // Stare konta (v1, albo bez pola wersji) auth.js podaje jawnie jako 1.
  if (version < 2) {
    return (await sha256Hex(salt, password)) === expectedHash;
  }
  return (await pbkdf2Hex(salt, password)) === expectedHash;
}

export function needsRehash(expectedVersion) {
  return expectedVersion !== HASH_VERSION;
}
