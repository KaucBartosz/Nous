// src/catalog/tagsStore.js — TagsStore (F): głęboki moduł tagów Biblioteki testów.
// Własność: klucz storage per użytkownik + CRUD tagów + parser @tagów (AND>OR) + matcher.
// Czysty (storage i tożsamość użytkownika wstrzyknięte) — testowalny bez auth/DOM.
// Adapter DOM/auth zostaje w `src/modules/tags.js`, który deleguje tutaj.
import { storageKeySuffix } from "../session/session.js";

export const MAX_TAG_LENGTH = 25;

/**
 * Klucz localStorage per użytkownik — czysta funkcja (bez importu auth).
 * Zachowuje 1:1 reguły ze starego `getStorageKey` (w tym `::` → `__`).
 * @param {object} identity — { uid: string|null, status: string, researcherUid: string }
 */
export function storageKeyFor({ uid, status, researcherUid } = {}) {
  if (uid) {
    // Konto Firebase — klucz po UID
    return `test_tags_${uid}`;
  }
  if (status === "LOCAL") {
    // Konto lokalne — klucz po researcher UID (LOCAL::username)
    return `test_tags_${storageKeySuffix(researcherUid)}`;
  }
  if (status === "GUEST") {
    return "test_tags_guest";
  }
  return "test_tags_anonymous";
}

/**
 * Normalizuje wejście „tagi po przecinku”: trim + lowercase + limit długości.
 * @param {string} tagsInput
 * @returns {string[]}
 */
export function normalizeTagInput(tagsInput) {
  if (!tagsInput) return [];
  return String(tagsInput)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= MAX_TAG_LENGTH);
}

/**
 * Parsuje zapytanie tekstowe na strukturę filtrów tagów i tekstu.
 * Obsługuje precedencję: AND ma wyższy priorytet niż OR.
 * @param {string} filterText
 * @returns {{ textFilters: string[], tagGroups: string[][] }}
 */
export function parseTagSearchQuery(filterText) {
  const lower = String(filterText || "").toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 0);

  const textFilters = [];
  const tagFilters = []; // Elementy: { tag, op }

  let currentOp = "AND";
  for (const word of words) {
    if (word === "and") {
      currentOp = "AND";
    } else if (word === "or") {
      currentOp = "OR";
    } else if (word.startsWith("@")) {
      tagFilters.push({ tag: word.substring(1), op: currentOp });
      currentOp = "AND"; // Domyślnie AND dla kolejnego
    } else {
      textFilters.push(word);
    }
  }

  if (tagFilters.length === 0) return { textFilters, tagGroups: [] };

  // Implementacja precedencji: AND > OR
  // Grupowanie tagów połączonych za pomocą AND.
  // Wynikowe grupy są połączone operatorem OR.
  // Przykład: @a OR @b @c OR @d -> [[@a], [@b, @c], [@d]]
  const tagGroups = [];
  let currentGroup = [tagFilters[0].tag];

  for (let i = 1; i < tagFilters.length; i++) {
    const item = tagFilters[i];
    if (item.op === "OR") {
      tagGroups.push(currentGroup);
      currentGroup = [item.tag];
    } else {
      currentGroup.push(item.tag);
    }
  }
  tagGroups.push(currentGroup);

  return { textFilters, tagGroups };
}

/**
 * Sprawdza czy dany test (jego tagi) pasuje do sparsowanych grup tagów.
 * OR między grupami, AND wewnątrz grupy.
 * @param {string[]} testTags
 * @param {string[][]} tagGroups
 * @returns {boolean}
 */
export function matchesTagGroups(testTags, tagGroups) {
  if (!tagGroups || tagGroups.length === 0) return true;

  const lowerTestTags = (testTags || []).map((t) => String(t).toLowerCase());

  // OR między grupami
  return tagGroups.some((group) => {
    // AND wewnątrz grupy
    return group.every((tag) => lowerTestTags.includes(tag));
  });
}

/**
 * Fabryka store'a tagów nad wstrzykniętym storage (localStorage lub fejk).
 * @param {object} deps — { storage: {getItem,setItem}, key: string }
 */
export function createTagsStore({ storage, key } = {}) {
  if (!storage || !key) throw new Error("createTagsStore wymaga { storage, key }");

  function getAll() {
    const data = storage.getItem(key);
    try {
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error("Error parsing tags from localStorage", e);
      return {};
    }
  }

  function saveAll(allTags) {
    storage.setItem(key, JSON.stringify(allTags));
  }

  function getTagsForTest(testId) {
    return getAll()[testId] || [];
  }

  function addTagsToTest(testId, tagsInput) {
    const newTags = normalizeTagInput(tagsInput);
    if (newTags.length === 0) return;

    const all = getAll();
    const currentTags = all[testId] || [];

    // Unikalne dodawanie
    const updatedTags = [...new Set([...currentTags, ...newTags])];
    all[testId] = updatedTags;

    saveAll(all);
    return updatedTags;
  }

  function removeTagFromTest(testId, tagToRemove) {
    const all = getAll();
    const currentTags = all[testId] || [];

    const updatedTags = currentTags.filter(
      (t) => t !== String(tagToRemove).toLowerCase(),
    );

    if (updatedTags.length === 0) {
      delete all[testId];
    } else {
      all[testId] = updatedTags;
    }

    saveAll(all);
    return updatedTags;
  }

  function getAllUsedTags() {
    const all = getAll();
    const tagsSet = new Set();

    Object.values(all).forEach((tags) => {
      tags.forEach((t) => tagsSet.add(t));
    });

    return Array.from(tagsSet).sort();
  }

  return {
    getAll,
    saveAll,
    getTagsForTest,
    addTagsToTest,
    removeTagFromTest,
    getAllUsedTags,
  };
}
