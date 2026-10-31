// src/db/localAccounts.js — LocalAccountsStore (C2): konta lokalne.
// UWAGA: getLocalAccount zwraca pełny rekord z passwordHash (używać tylko w auth.js).
// getAllLocalAccounts zwraca rekordy BEZ passwordHash (bezpieczne dla UI).
import { initDB } from "./index.js";

export async function getLocalAccount(username) {
  try {
    const db = await initDB();
    return db.get("localAccounts", username);
  } catch (error) {
    console.error("Error getting local account:", error);
    throw new Error(`Nie udało się pobrać konta: ${error.message}`);
  }
}

export async function createLocalAccount(username, passwordHash, salt) {
  try {
    const db = await initDB();
    const now = new Date().toISOString();
    await db.put("localAccounts", {
      username,
      passwordHash,
      salt,
      createdAt: now,
      lastLogin: now,
    });
  } catch (error) {
    console.error("Error creating local account:", error);
    throw new Error(`Nie udało się utworzyć konta: ${error.message}`);
  }
}

export async function getAllLocalAccounts() {
  try {
    const db = await initDB();
    const accounts = await db.getAll("localAccounts");
    // Nie zwracamy passwordHash ani salt - tylko metadane
    return accounts.map(({ username, createdAt, lastLogin }) => ({
      username,
      createdAt,
      lastLogin,
    }));
  } catch (error) {
    console.error("Error getting local accounts:", error);
    return [];
  }
}

export async function updateLocalAccountLastLogin(username) {
  try {
    const db = await initDB();
    const account = await db.get("localAccounts", username);
    if (account) {
      account.lastLogin = new Date().toISOString();
      await db.put("localAccounts", account);
    }
  } catch (error) {
    console.error("Error updating last login:", error);
    // Non-critical, don't throw
  }
}

export async function deleteLocalAccount(username) {
  try {
    const db = await initDB();
    await db.delete("localAccounts", username);
  } catch (error) {
    console.error("Error deleting local account:", error);
    throw new Error(`Nie udało się usunąć konta: ${error.message}`);
  }
}
