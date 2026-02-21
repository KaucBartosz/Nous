import { saveTemplate, getAllTemplates, deleteTemplate, getTemplate } from './database.js';
import { elements } from './ui.js';
import { refreshTemplatesDropdown } from './demographics.js';
import { Dialog } from './dialog.js';

let editingTemplateId = null;

export function initDemoCreator() {
    const btnAddField = document.getElementById('btn-add-field');
    const btnSaveTemplate = document.getElementById('btn-save-template');

    if (btnAddField) {
        btnAddField.addEventListener('click', () => addFieldUI());
    }

    if (btnSaveTemplate) {
        btnSaveTemplate.addEventListener('click', saveCurrentTemplate);
    }

    const btnImportTemplate = document.getElementById('btn-import-template');
    if (btnImportTemplate) {
        btnImportTemplate.addEventListener('click', importTemplateFromFile);
    }

    refreshTemplatesList();
}

/**
 * Helper function to escape HTML to prevent XSS attacks
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addFieldUI(initialData = null) {
    const container = document.getElementById('creator-fields-container');

    // Create a safe ID string for DOM elements
    const rawId = Date.now() + Math.random();
    const fieldId = rawId.toString().replace('.', '-');

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-row';
    fieldDiv.style.alignItems = 'flex-start';
    fieldDiv.style.marginBottom = '15px';
    fieldDiv.style.borderBottom = '1px solid #333';
    fieldDiv.style.paddingBottom = '10px';
    fieldDiv.dataset.id = fieldId;

    const labelVal = initialData ? initialData.label : '';
    const typeVal = initialData ? initialData.type : 'text';
    const optionsVal = initialData ? (initialData.options || '') : '';

    // IDs for inputs
    const labelId = `field-label-${fieldId}`;
    const typeId = `field-type-${fieldId}`;
    const optionsId = `field-options-${fieldId}`;

    // Create structure with CSS classes instead of inline styles
    // Using textContent/value instead of innerHTML for user data prevents XSS
    fieldDiv.innerHTML = `
        <div class="field-creator-container">
            <div class="field-creator-row">
                <div class="form-group field-creator-label-group">
                    <label for="${labelId}">Etykieta Pola</label>
                    <input type="text" id="${labelId}" class="field-label" placeholder="np. Wiek">
                </div>
                <div class="form-group field-creator-type-group">
                    <label for="${typeId}">Typ</label>
                    <select id="${typeId}" class="field-type">
                        <option value="text">Tekst (String)</option>
                        <option value="number">Liczba (Int)</option>
                        <option value="float">Liczba (Float)</option>
                        <option value="select">Lista rozwijana (Select)</option>
                        <option value="checkbox">Pola wielokrotnego wyboru (Checkboxy)</option>
                        <option value="radio">Pola pojedynczego wyboru (Radio)</option>
                        <option value="date">Data</option>
                    </select>
                </div>
            </div>
            
            <div class="field-options-container">
                <label for="${optionsId}">Opcje (oddzielone przecinkami)</label>
                <input type="text" id="${optionsId}" class="field-options" placeholder="np. Kobieta, Mężczyzna, Inna">
            </div>
        </div>

        <button class="btn danger small btn-remove-field field-remove-btn">
            <span class="material-icons">delete</span>
        </button>
    `;

    // Now safely set values using .value (not vulnerable to XSS)
    const labelInput = fieldDiv.querySelector('.field-label');
    const typeSelect = fieldDiv.querySelector('.field-type');
    const optionsInput = fieldDiv.querySelector('.field-options');
    const optionsContainer = fieldDiv.querySelector('.field-options-container');

    if (labelVal) labelInput.value = labelVal;
    if (typeVal) typeSelect.value = typeVal;
    if (optionsVal) optionsInput.value = optionsVal;

    // Toggle Options Visibility based on type
    const updateOptionsVisibility = () => {
        // Show options for 'select', 'checkbox' OR 'radio'
        if (['select', 'checkbox', 'radio'].includes(typeSelect.value)) {
            optionsContainer.classList.add('visible');

            // Helpful placeholder change
            if (typeSelect.value === 'checkbox') {
                optionsInput.placeholder = "Opcje (np. Opcja A, Opcja B) - będzie można zaznaczyć kilka";
            } else if (typeSelect.value === 'radio') {
                optionsInput.placeholder = "Opcje (np. Tak, Nie, Nie wiem) - będzie można wybrać jedną";
            } else {
                optionsInput.placeholder = "np. Kobieta, Mężczyzna, Inna";
            }
        } else {
            optionsContainer.classList.remove('visible');
        }
    };

    updateOptionsVisibility(); // Initial state
    typeSelect.addEventListener('change', updateOptionsVisibility);

    // Remove field button
    fieldDiv.querySelector('.btn-remove-field').addEventListener('click', async () => {
        if (await Dialog.confirm("Usunąć to pole?")) {
            fieldDiv.remove();
        }
    });

    container.appendChild(fieldDiv);

    // Auto-focus if it's a new field (not loading from template)
    // Use requestAnimationFrame for better reliability
    if (!initialData) {
        requestAnimationFrame(() => {
            labelInput.focus();
        });
    }
}

async function saveCurrentTemplate() {
    const nameInput = document.getElementById('creator-template-name');
    const name = nameInput.value.trim();

    if (!name) {
        await Dialog.alert("Podaj nazwę szablonu!", 'warning');
        return;
    }

    const rows = document.querySelectorAll('#creator-fields-container .form-row');
    const fields = [];

    rows.forEach(row => {
        const label = row.querySelector('.field-label').value.trim();
        const type = row.querySelector('.field-type').value;
        const optionsInput = row.querySelector('.field-options');

        if (label) {
            const fieldObj = { label, type };
            if (['select', 'checkbox', 'radio'].includes(type)) {
                fieldObj.options = optionsInput.value.trim();
            }
            fields.push(fieldObj);
        }
    });

    if (fields.length === 0) {
        await Dialog.alert("Dodaj przynajmniej jedno pole!", 'warning');
        return;
    }

    const template = {
        name,
        fields,
        createdAt: new Date().toISOString()
    };

    if (editingTemplateId) {
        template.id = editingTemplateId;
    }

    try {
        await saveTemplate(template);

        // Refresh external dropdown
        await refreshTemplatesDropdown();

        // Success UI
        const status = document.getElementById('creator-status');
        status.style.display = 'block';
        status.textContent = editingTemplateId ? "Zaktualizowano szablon!" : "Zapisano szablon!";
        setTimeout(() => status.style.display = 'none', 3000);

        // Reset form
        resetCreatorForm();
        refreshTemplatesList();

    } catch (e) {
        await Dialog.alert("Błąd zapisu: " + e.message, 'error');
    }
}

function resetCreatorForm() {
    document.getElementById('creator-template-name').value = '';
    document.getElementById('creator-fields-container').innerHTML = '';
    editingTemplateId = null;
    const btnSave = document.getElementById('btn-save-template');
    if (btnSave) btnSave.innerHTML = '<span class="material-icons">save</span> Zapisz Szablon';
}

async function loadTemplateIntoCreator(id) {
    try {
        const template = await getTemplate(id);
        if (!template) return;

        resetCreatorForm();
        editingTemplateId = template.id;

        document.getElementById('creator-template-name').value = template.name;

        // Change button text
        const btnSave = document.getElementById('btn-save-template');
        if (btnSave) btnSave.innerHTML = '<span class="material-icons">save</span> Zaktualizuj Szablon';

        // Add fields
        template.fields.forEach(field => {
            addFieldUI(field);
        });

        // Scroll to top
        document.getElementById('demo-creator-view').scrollIntoView({ behavior: 'smooth' });

    } catch (e) {
        console.error("Error editing template:", e);
    }
}

async function exportCurrentTemplate(template) {
    try {
        const result = await window.electronAPI.exportTemplate(template);
        if (result.success) {
            await Dialog.alert(`Szablon "${template.name}" został wyeksportowany pomyślnie.`, 'info');
        } else if (!result.cancelled) {
            await Dialog.alert("Błąd eksportu: " + result.error, 'error');
        }
    } catch (e) {
        console.error("Export error:", e);
        await Dialog.alert("Błąd eksportu: " + e.message, 'error');
    }
}

async function importTemplateFromFile() {
    try {
        const result = await window.electronAPI.importTemplate();
        if (result.success && result.data) {
            const imported = result.data;

            // Check if name is taken? 
            // We can just load it into the creator and let the user decide to save (maybe rename).

            resetCreatorForm();

            document.getElementById('creator-template-name').value = imported.name + " (Import)";

            if (imported.fields && Array.isArray(imported.fields)) {
                imported.fields.forEach(field => addFieldUI(field));
            }

            await Dialog.alert("Szablon został zaimportowany do kreatora. Możesz go teraz zapisać.", 'info');

            // Scroll to top
            document.getElementById('demo-creator-view').scrollIntoView({ behavior: 'smooth' });

        } else if (!result.cancelled) {
            await Dialog.alert("Błąd importu: " + result.error, 'error');
        }
    } catch (e) {
        console.error("Import error:", e);
        await Dialog.alert("Błąd importu: " + e.message, 'error');
    }
}

export async function refreshTemplatesList() {
    const list = document.getElementById('existing-templates-list');
    if (!list) return;

    list.innerHTML = 'Ładowanie...';

    try {
        const templates = await getAllTemplates();
        list.innerHTML = '';

        if (templates.length === 0) {
            list.innerHTML = '<p style="color:#888;">Brak zapisanych szablonów.</p>';
            return;
        }

        templates.forEach(t => {
            const card = document.createElement('div');
            card.className = 'test-card'; // Reuse style
            card.style.cursor = 'default';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';

            card.innerHTML = `
                <div>
                    <h4>${escapeHtml(t.name)}</h4>
                    <p>${t.fields.length} pól</p>
                </div>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <button class="btn secondary small btn-edit-template" style="flex:1;" title="Edytuj">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn secondary small btn-export-template" style="flex:1;" title="Eksportuj">
                        <span class="material-icons">download</span>
                    </button>
                    <button class="btn danger small btn-delete-template" style="flex:1;" title="Usuń">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            `;

            card.querySelector('.btn-export-template').addEventListener('click', () => {
                exportCurrentTemplate(t);
            });

            card.querySelector('.btn-edit-template').addEventListener('click', () => {
                loadTemplateIntoCreator(t.id);
            });

            card.querySelector('.btn-delete-template').addEventListener('click', async () => {
                const confirmed = await Dialog.confirm(`Usunąć szablon "${t.name}"?`);
                if (confirmed) {
                    await deleteTemplate(t.id);
                    await refreshTemplatesDropdown(); // Sync dropdown

                    if (editingTemplateId === t.id) {
                        resetCreatorForm();
                    }

                    refreshTemplatesList();
                }
            });

            list.appendChild(card);
        });

    } catch (e) {
        list.innerHTML = 'Błąd: ' + e.message;
    }
}
