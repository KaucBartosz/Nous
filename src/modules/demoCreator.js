import { saveTemplate, getAllTemplates, deleteTemplate, getTemplate } from './database.js';
import { elements } from './ui.js';
import { refreshTemplatesDropdown } from './demographics.js';

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

    refreshTemplatesList();
}

function addFieldUI(initialData = null) {
    const container = document.getElementById('creator-fields-container');
    const fieldId = Date.now() + Math.random(); // ensure uniqueness

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-row';
    fieldDiv.style.alignItems = 'flex-start'; // Changed to flex-start for multi-line inputs
    fieldDiv.style.marginBottom = '15px';
    fieldDiv.style.borderBottom = '1px solid #333';
    fieldDiv.style.paddingBottom = '10px';
    fieldDiv.dataset.id = fieldId;

    const labelVal = initialData ? initialData.label : '';
    const typeVal = initialData ? initialData.type : 'text';
    const optionsVal = initialData ? (initialData.options || '') : '';

    fieldDiv.innerHTML = `
        <div style="flex:3; display:flex; flex-direction:column; gap:10px; margin-right:10px;">
            <div style="display:flex; gap:10px;">
                <div class="form-group" style="flex:2;">
                    <label>Etykieta Pola</label>
                    <input type="text" class="field-label" placeholder="np. Wiek" value="${labelVal}">
                </div>
                <div class="form-group" style="flex:1;">
                    <label>Typ</label>
                    <select class="field-type">
                        <option value="text" ${typeVal === 'text' ? 'selected' : ''}>Tekst (String)</option>
                        <option value="number" ${typeVal === 'number' ? 'selected' : ''}>Liczba (Int)</option>
                        <option value="float" ${typeVal === 'float' ? 'selected' : ''}>Liczba (Float)</option>
                        <option value="select" ${typeVal === 'select' ? 'selected' : ''}>Lista (Select)</option>
                        <option value="checkbox" ${typeVal === 'checkbox' ? 'selected' : ''}>Przełącznik (Tak/Nie)</option>
                        <option value="date" ${typeVal === 'date' ? 'selected' : ''}>Data</option>
                    </select>
                </div>
            </div>
            
            <div class="field-options-container" style="display: ${typeVal === 'select' ? 'block' : 'none'};">
                <label>Opcje (oddzielone przecinkami)</label>
                <input type="text" class="field-options" placeholder="np. Kobieta, Mężczyzna, Inna" value="${optionsVal}">
            </div>
        </div>

        <button class="btn danger small btn-remove-field" style="margin-top: 28px;">
            <span class="material-icons">delete</span>
        </button>
    `;

    // Toggle Options Visibility
    const typeSelect = fieldDiv.querySelector('.field-type');
    const optionsContainer = fieldDiv.querySelector('.field-options-container');

    typeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'select') {
            optionsContainer.style.display = 'block';
        } else {
            optionsContainer.style.display = 'none';
        }
    });

    fieldDiv.querySelector('.btn-remove-field').addEventListener('click', () => {
        fieldDiv.remove();
    });

    container.appendChild(fieldDiv);
}

async function saveCurrentTemplate() {
    const nameInput = document.getElementById('creator-template-name');
    const name = nameInput.value.trim();

    if (!name) {
        alert("Podaj nazwę szablonu!");
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
            if (type === 'select') {
                fieldObj.options = optionsInput.value.trim(); // Save raw string or array? String is easier for editing.
            }
            fields.push(fieldObj);
        }
    });

    if (fields.length === 0) {
        alert("Dodaj przynajmniej jedno pole!");
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
        status.innerText = editingTemplateId ? "Zaktualizowano szablon!" : "Zapisano szablon!";
        setTimeout(() => status.style.display = 'none', 3000);

        // Reset form
        resetCreatorForm();
        refreshTemplatesList();

    } catch (e) {
        alert("Błąd zapisu: " + e.message);
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
                    <h4>${t.name}</h4>
                    <p>${t.fields.length} pól</p>
                </div>
                <div style="margin-top:10px; display:flex; gap:10px;">
                    <button class="btn secondary small btn-edit-template" style="flex:1;">Edytuj</button>
                    <button class="btn danger small btn-delete-template" style="flex:1;">Usuń</button>
                </div>
            `;

            card.querySelector('.btn-edit-template').addEventListener('click', () => {
                loadTemplateIntoCreator(t.id);
            });

            card.querySelector('.btn-delete-template').addEventListener('click', async () => {
                if (confirm(`Usunąć szablon "${t.name}"?`)) {
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
