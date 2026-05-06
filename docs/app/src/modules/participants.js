// src/modules/participants.js
import {
  saveParticipant,
  getAllParticipants,
  deleteParticipant,
} from "./database.js";
import { getResearcherUid } from "./auth.js";
import { Dialog } from "./dialog.js";

// Callback to fill the demographics form — set by demographics.js
let _fillFormCallback = null;

/**
 * Called by demographics.js to register the "fill form" callback.
 * @param {Function} cb - (participant) => void
 */
export function registerFillFormCallback(cb) {
  _fillFormCallback = cb;
}

/**
 * Initializes the participants panel inside the Demographics view.
 * Binds the search input and the refresh function.
 */
export function initParticipantsPanel() {
  const searchInput = document.getElementById("participants-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderParticipantsList(searchInput.value.trim().toLowerCase());
    });
  }
  renderParticipantsList();
}

/**
 * Renders the list of participants for the current researcher.
 * @param {string} [filter=''] - Optional text filter applied to display_name.
 */
export async function renderParticipantsList(filter = "") {
  const container = document.getElementById("participants-list");
  if (!container) return;

  const uid = getResearcherUid();
  const all = await getAllParticipants(uid);

  const filtered = filter
    ? all.filter((p) => (p.display_name || "").toLowerCase().includes(filter))
    : all;

  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML =
      '<p class="participants-empty">Brak zapisanych badanych. Wypełnij metryczkę i kliknij <strong>Zapisz do Kartoteki</strong>.</p>';
    return;
  }

  // We need template names — fetch templates lazily (cheap, just IDs)
  // Map templateId -> templateName from the select options (already rendered)
  const templateSelect = document.getElementById("demo-template-select");
  const templateNameMap = {};
  if (templateSelect) {
    Array.from(templateSelect.options).forEach((opt) => {
      if (opt.value) templateNameMap[opt.value] = opt.textContent;
    });
  }

  filtered.forEach((participant) => {
    const templateName =
      templateNameMap[participant.templateId] || "Nieznany szablon";

    const card = document.createElement("div");
    card.className = "participant-card";
    card.dataset.id = participant.id;

    card.innerHTML = `
            <div class="participant-card-info">
                <span class="material-icons participant-icon">person</span>
                <div class="participant-card-text">
                    <span class="participant-name">${escapeHtml(participant.display_name)}</span>
                    <span class="participant-template">${escapeHtml(templateName)}</span>
                </div>
            </div>
            <div class="participant-card-actions">
                <button class="btn small primary btn-load-participant" title="Wczytaj dane do formularza">
                    <span class="material-icons" style="font-size:15px; vertical-align:middle; margin-right:3px;">input</span>Wczytaj
                </button>
                <button class="btn small danger icon-btn btn-delete-participant" title="Usuń z kartoteki" style="padding:4px 8px;">
                    <span class="material-icons" style="font-size:16px;">delete</span>
                </button>
            </div>
        `;

    card
      .querySelector(".btn-load-participant")
      .addEventListener("click", () => {
        loadParticipantToForm(participant);
      });

    card
      .querySelector(".btn-delete-participant")
      .addEventListener("click", async () => {
        await handleDeleteParticipant(participant);
      });

    container.appendChild(card);
  });
}

/**
 * Loads a participant's data back into the demographics form.
 * @param {Object} participant
 */
function loadParticipantToForm(participant) {
  if (!_fillFormCallback) {
    console.warn("[Participants] fillFormCallback not registered.");
    return;
  }
  _fillFormCallback(participant);
}

/**
 * Saves the current demographics form data as a new participant profile.
 * Prompts the user to enter a display name first.
 * @param {Object} demographicsData - { templateId, participant_id, data }
 */
export async function saveCurrentAsParticipant(demographicsData) {
  if (!demographicsData || !demographicsData.templateId) {
    await Dialog.alert(
      "Wybierz szablon i wypełnij metryczkę przed zapisem do kartoteki.",
      "warning",
    );
    return;
  }

  // Ask user for a display name
  const displayName = await Dialog.prompt(
    "Podaj nazwę profilu badanego (np. imię i nazwisko lub kod):",
    "",
  );

  if (!displayName || !displayName.trim()) return; // User cancelled or empty

  const uid = getResearcherUid();

  const participant = {
    display_name: displayName.trim(),
    templateId: demographicsData.templateId,
    participant_id: demographicsData.participant_id,
    data: demographicsData.data,
  };

  try {
    await saveParticipant(participant, uid);
    await Dialog.alert(
      `Profil "${displayName.trim()}" został zapisany do kartoteki.`,
      "success",
    );
    await renderParticipantsList();
  } catch (e) {
    await Dialog.alert("Błąd zapisu do kartoteki: " + e.message, "error");
  }
}

/**
 * Handles deletion of a participant with confirmation dialog.
 * @param {Object} participant
 */
async function handleDeleteParticipant(participant) {
  const confirmed = await Dialog.confirm(
    `Czy na pewno chcesz usunąć profil "${participant.display_name}" z kartoteki?\n\nStare wyniki badań NIE zostaną usunięte.`,
  );
  if (!confirmed) return;

  try {
    await deleteParticipant(participant.id);
    await renderParticipantsList();
  } catch (e) {
    await Dialog.alert("Błąd usuwania: " + e.message, "error");
  }
}

/**
 * Minimal HTML escape helper (avoids importing entire utils.js for this).
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
