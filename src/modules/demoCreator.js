import { saveTemplate, getAllTemplates, deleteTemplate, getTemplate } from './database.js';
import { elements } from './ui.js';
import { refreshTemplatesDropdown } from './demographics.js';
import { Notify } from '../notify/notify.js';
import { getPlatform } from '../platform/index.js';
import { escapeHtml } from './utils.js';
import { t } from '../i18n/index.js';

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

function addFieldUI(initialData = null) {
    const container = document.getElementById('creator-fields-container');

    // Create a safe ID string for DOM elements
    const rawId = Date.now() + Math.random();
    const fieldId = rawId.toString().replace('.', '-');

    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-row';
    fieldDiv.style.alignItems = 'flex-start';
    fieldDiv.style.marginBottom = '16px';
    fieldDiv.style.borderBottom = '1px solid var(--border)';
    fieldDiv.style.paddingBottom = '12px';
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
                    <label for="${labelId}">${t('creator.fieldLabel')}</label>
                    <input type="text" id="${labelId}" class="field-label" placeholder="${t('creator.fieldLabelPlaceholder')}">
                </div>
                <div class="form-group field-creator-type-group">
                    <label for="${typeId}">${t('creator.typeLabel')}</label>
                    <select id="${typeId}" class="field-type">
                        <option value="text">${t('creator.typeText')}</option>
                        <option value="number">${t('creator.typeNumber')}</option>
                        <option value="float">${t('creator.typeFloat')}</option>
                        <option value="select">${t('creator.typeSelect')}</option>
                        <option value="checkbox">${t('creator.typeCheckbox')}</option>
                        <option value="radio">${t('creator.typeRadio')}</option>
                        <option value="date">${t('creator.typeDate')}</option>
                    </select>
                </div>
            </div>
            
            <div class="field-options-container">
                <label for="${optionsId}">${t('creator.optionsLabel')}</label>
                <input type="text" id="${optionsId}" class="field-options" placeholder="${t('creator.optionsPlaceholderDefault')}">
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
                optionsInput.placeholder = t('creator.optionsPlaceholderMulti');
            } else if (typeSelect.value === 'radio') {
                optionsInput.placeholder = t('creator.optionsPlaceholderSingle');
            } else {
                optionsInput.placeholder = t('creator.optionsPlaceholderDefault');
            }
        } else {
            optionsContainer.classList.remove('visible');
        }
    };

    updateOptionsVisibility(); // Initial state
    typeSelect.addEventListener('change', updateOptionsVisibility);

    // Remove field button
    fieldDiv.querySelector('.btn-remove-field').addEventListener('click', async () => {
        if (await Notify.confirm(t('creator.deleteFieldConfirm'))) {
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
        await Notify.alert(t('creator.nameRequired'), 'warning');
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
        await Notify.alert(t('creator.addAtLeastOneField'), 'warning');
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
        status.textContent = editingTemplateId ? t('creator.updatedStatus') : t('creator.savedStatus');
        setTimeout(() => status.style.display = 'none', 3000);

        // Reset form
        resetCreatorForm();
        refreshTemplatesList();

    } catch (e) {
        await Notify.alert(t('creator.saveFailed', { message: e.message }), 'error');
    }
}

function resetCreatorForm() {
    document.getElementById('creator-template-name').value = '';
    document.getElementById('creator-fields-container').innerHTML = '';
    editingTemplateId = null;
    const btnSave = document.getElementById('btn-save-template');
    if (btnSave) btnSave.innerHTML = `<span class="material-icons">save</span> ${t('creator.saveTemplateBtn')}`;
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
        if (btnSave) btnSave.innerHTML = `<span class="material-icons">save</span> ${t('creator.updateTemplate')}`;

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
        // C1: eksport przez seam (Electron: dialog systemowy, Web: Blob w adapterze)
        const result = await getPlatform().files.exportTemplate(template);
        if (result.success) {
            await Notify.alert(t('creator.exported', { name: template.name }), 'info');
        } else if (!result.cancelled) {
            await Notify.alert(t('creator.exportFailed', { message: result.error }), 'error');
        }
    } catch (e) {
        console.error("Export error:", e);
        await Notify.alert(t('creator.exportFailed', { message: e.message }), 'error');
    }
}

async function importTemplateFromFile() {
    try {
        // C1: import przez seam (Electron: dialog systemowy, Web: file-picker w adapterze)
        const result = await getPlatform().files.importTemplate();
        if (result.success && result.data) {
            const imported = result.data;

            resetCreatorForm();

            document.getElementById('creator-template-name').value =
                t('creator.importedNameSuffix', {
                    name: imported.name || t('creator.defaultTemplateName'),
                });

            if (imported.fields && Array.isArray(imported.fields)) {
                imported.fields.forEach(field => addFieldUI(field));
            }

            await Notify.alert(t('creator.imported'), 'info');

            document.getElementById('demo-creator-view').scrollIntoView({ behavior: 'smooth' });

        } else if (!result.cancelled) {
            await Notify.alert(t('creator.importFailed', { message: result.error }), 'error');
        }
    } catch (e) {
        console.error("Import error:", e);
        await Notify.alert(t('creator.importFailed', { message: e.message }), 'error');
    }
}

export async function refreshTemplatesList() {
    const list = document.getElementById('existing-templates-list');
    if (!list) return;

    list.innerHTML = t('creator.loading');

    try {
        const templates = await getAllTemplates();
        list.innerHTML = '';

        if (templates.length === 0) {
            list.innerHTML = `<p style="color:#888;">${t('creator.noSavedTemplates')}</p>`;
            return;
        }

        templates.forEach(template => {
            const card = document.createElement('div');
            card.className = 'test-card'; // Reuse style
            card.style.cursor = 'default';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';

            card.innerHTML = `
                <div>
                    <h4>${escapeHtml(template.name)}</h4>
                    <p>${t('creator.fieldsCount', { count: template.fields.length })}</p>
                </div>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <button class="btn secondary small btn-edit-template" style="flex:1;" title="${t('creator.editTitle')}">
                        <span class="material-icons">edit</span>
                    </button>
                    <button class="btn secondary small btn-export-template" style="flex:1;" title="${t('creator.exportTitle')}">
                        <span class="material-icons">download</span>
                    </button>
                    <button class="btn danger small btn-delete-template" style="flex:1;" title="${t('creator.delete')}">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            `;

            card.querySelector('.btn-export-template').addEventListener('click', () => {
                exportCurrentTemplate(template);
            });

            card.querySelector('.btn-edit-template').addEventListener('click', () => {
                loadTemplateIntoCreator(template.id);
            });

            card.querySelector('.btn-delete-template').addEventListener('click', async () => {
                const confirmed = await Notify.confirm(
                    t('creator.deleteTemplateConfirm', { name: template.name }),
                );
                if (confirmed) {
                    await deleteTemplate(template.id);
                    await refreshTemplatesDropdown(); // Sync dropdown

                    if (editingTemplateId === template.id) {
                        resetCreatorForm();
                    }

                    refreshTemplatesList();
                }
            });

            list.appendChild(card);
        });

    } catch (e) {
        list.innerHTML = t('creator.error', { message: e.message });
    }
}
