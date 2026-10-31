// src/db/participants.js — ParticipantsStore (C2): Kartoteka Badanych.
// Jawnie NIESZYFROWANE (profile/metadata, nie dane wrażliwe).
import { initDB } from "./index.js";

export async function saveParticipant(participant, researcherUid) {
  try {
    const db = await initDB();
    const id = participant.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      ...participant,
      id,
      researcher_uid: researcherUid,
      created_at: participant.created_at || now,
      updated_at: now,
    };
    await db.put("participants", record);
    return id;
  } catch (error) {
    console.error("Error saving participant:", error);
    throw new Error(`Nie udało się zapisać badanego: ${error.message}`);
  }
}

export async function getAllParticipants(researcherUid) {
  try {
    const db = await initDB();
    const allParticipants = await db.getAllFromIndex(
      "participants",
      "researcher_uid",
      researcherUid,
    );
    return allParticipants.sort((a, b) =>
      (a.display_name || "").localeCompare(b.display_name || "", "pl"),
    );
  } catch (error) {
    console.error("Error getting participants:", error);
    return [];
  }
}

export async function getParticipant(id) {
  try {
    const db = await initDB();
    return db.get("participants", id);
  } catch (error) {
    console.error("Error getting participant:", error);
    throw new Error(`Nie udało się pobrać badanego: ${error.message}`);
  }
}

export async function deleteParticipant(id) {
  try {
    const db = await initDB();
    await db.delete("participants", id);
  } catch (error) {
    console.error("Error deleting participant:", error);
    throw new Error(`Nie udało się usunąć badanego: ${error.message}`);
  }
}
