// src/modules/database.js — SHIM C2 (kompatybilność wsteczna).
// Kanoniczne Store'y mieszkają w src/db/*; ten plik tylko re-eksportuje,
// więc 8 wołających modułów nie wymaga żadnych zmian.
export { initDB } from "../db/index.js";
export { setCryptoWarningHandler, isCryptoReady } from "../db/cryptoPolicy.js";
export * from "../db/results.js";
export * from "../db/templates.js";
export * from "../db/participants.js";
export * from "../db/localAccounts.js";
