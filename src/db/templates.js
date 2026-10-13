// src/db/templates.js — TemplatesStore (C2): Szablony metryczek.
// Jawnie NIESZYFROWANE (config, nie dane wrażliwe).
import { initDB } from "./index.js";

export async function saveTemplate(template) {
  try {
    const db = await initDB();
    const id = template.id || crypto.randomUUID();
    await db.put("demographicsTemplates", { ...template, id });
    return id;
  } catch (error) {
    console.error("Error saving template:", error);
    throw new Error(`Nie udało się zapisać szablonu: ${error.message}`);
  }
}

export async function getAllTemplates() {
  try {
    const db = await initDB();
    return db.getAll("demographicsTemplates");
  } catch (error) {
    console.error("Error getting all templates:", error);
    // Return empty array instead of throwing to prevent UI crash
    return [];
  }
}

export async function getTemplate(id) {
  try {
    const db = await initDB();
    return db.get("demographicsTemplates", id);
  } catch (error) {
    console.error("Error getting template:", error);
    throw new Error(`Nie udało się pobrać szablonu: ${error.message}`);
  }
}

export async function deleteTemplate(id) {
  try {
    const db = await initDB();
    await db.delete("demographicsTemplates", id);
  } catch (error) {
    console.error("Error deleting template:", error);
    throw new Error(`Nie udało się usunąć szablonu: ${error.message}`);
  }
}
