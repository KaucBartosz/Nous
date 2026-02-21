import { getAllTemplates, getTemplate } from './database.js';
import { elements } from './ui.js';
import { Dialog } from './dialog.js';

let activeDemographics = null;
let currentTemplateId = null;

export async function initDemographics() {
    await refreshTemplatesDropdown();

    const savedTemplateId = localStorage.getItem('activeTemplateId');
    if (savedTemplateId) {
        elements.demoTemplateSelect.value = savedTemplateId;
        await renderDynamicForm(savedTemplateId);
    } else {
        await renderDynamicForm(null);
    }

    elements.demoTemplateSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        localStorage.setItem('activeTemplateId', val);
        await renderDynamicForm(val);
    });

    // Populate data if exists
    loadSavedDemographics();

    // Bind Save Button
    if (elements.btnSaveDemo) {
        elements.btnSaveDemo.addEventListener('click', saveDemographicsFromForm);
    }

    // Bind Clear Button
    const btnClear = document.getElementById('btn-clear-demo');
    if (btnClear) {
        btnClear.addEventListener('click', clearDemographics);
    }
}

export async function refreshTemplatesDropdown() {
    const templates = await getAllTemplates();
    elements.demoTemplateSelect.innerHTML = '<option value="">-- Domyślna (Brak) --</option>';
    templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        elements.demoTemplateSelect.appendChild(opt);
    });
}

async function renderDynamicForm(templateId) {
    currentTemplateId = templateId;
    const container = elements.dynamicDemoForm;
    container.innerHTML = '';

    if (!templateId) {
        container.innerHTML = '<p style="color:#888;">Wybierz szablon, aby wypełnić metryczkę.</p>';
        return;
    }

    const template = await getTemplate(templateId);
    if (!template) {
        container.innerHTML = '<p style="color:red;">Błąd: Szablon nie istnieje.</p>';
        return;
    }

    template.fields.forEach((field, index) => {
        const div = document.createElement('div');
        div.className = 'form-group';

        // Create unique ID for each input
        const inputId = `demo-field-${templateId}-${index}`;

        const label = document.createElement('label');
        label.textContent = field.label;
        label.setAttribute('for', inputId);

        let input;

        if (field.type === 'select') {
            input = document.createElement('select');
            input.id = inputId;

            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Wybierz --";
            input.appendChild(defaultOpt);

            if (field.options) {
                const opts = field.options.split(',').map(s => s.trim());
                opts.forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.textContent = optVal;
                    input.appendChild(opt);
                });
            }
        } else if (field.type === 'checkbox') {
            if (field.options) {
                // Checkbox Group Mode (Multiple selection)
                input = document.createElement('div');
                input.className = 'checkbox-group-container demo-dynamic-field';
                input.dataset.checkboxGroup = 'true';
                input.id = inputId;

                const opts = field.options.split(',').map(s => s.trim());
                opts.forEach(optVal => {
                    const cbWrapper = document.createElement('div');
                    cbWrapper.style.display = 'flex';
                    cbWrapper.style.alignItems = 'center';
                    cbWrapper.style.marginBottom = '8px';

                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.value = optVal;
                    cb.style.width = 'auto';
                    cb.style.margin = '0 10px 0 0';

                    const cbLabel = document.createElement('label');
                    cbLabel.textContent = optVal;
                    cbLabel.style.fontWeight = 'normal';
                    cbLabel.style.margin = '0';
                    cbLabel.style.cursor = 'pointer';
                    cbLabel.style.display = 'inline-block';
                    cbLabel.addEventListener('click', () => cb.checked = !cb.checked);

                    cbWrapper.appendChild(cb);
                    cbWrapper.appendChild(cbLabel);
                    input.appendChild(cbWrapper);
                });
            } else {
                // Classic Checkbox Mode (Tak/Nie)
                div.style.display = 'flex';
                div.style.flexDirection = 'row';
                div.style.alignItems = 'center';
                div.innerHTML = '';

                input = document.createElement('input');
                input.type = 'checkbox';
                input.id = inputId;
                input.style.width = 'auto';
                input.style.margin = '0 10px 0 0';

                label.style.display = 'inline-block';
                label.style.margin = '0';
                label.style.cursor = 'pointer';
                label.addEventListener('click', () => input.checked = !input.checked);

                div.appendChild(input);
                div.appendChild(label);
            }

        } else if (field.type === 'radio') {
            // Radio Group Mode (Single selection)
            input = document.createElement('div');
            input.className = 'radio-group-container demo-dynamic-field';
            input.dataset.radioGroup = 'true';
            input.id = inputId;

            if (field.options) {
                const opts = field.options.split(',').map(s => s.trim());
                opts.forEach(optVal => {
                    const radioWrapper = document.createElement('div');
                    radioWrapper.style.display = 'flex';
                    radioWrapper.style.alignItems = 'center';
                    radioWrapper.style.marginBottom = '8px';

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = `radio-${inputId}`; // Group name
                    radio.value = optVal;
                    radio.style.width = 'auto';
                    radio.style.margin = '0 10px 0 0';

                    const radioLabel = document.createElement('label');
                    radioLabel.textContent = optVal;
                    radioLabel.style.fontWeight = 'normal';
                    radioLabel.style.margin = '0';
                    radioLabel.style.cursor = 'pointer';
                    radioLabel.style.display = 'inline-block';
                    radioLabel.addEventListener('click', () => radio.checked = true);

                    radioWrapper.appendChild(radio);
                    radioWrapper.appendChild(radioLabel);
                    input.appendChild(radioWrapper);
                });
            }

        } else if (field.type === 'date') {
            input = document.createElement('input');
            input.type = 'date';
            input.id = inputId;
        } else if (field.type === 'text') {
            input = document.createElement('input');
            input.type = 'text';
            input.id = inputId;
        } else if (field.type === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '1';
            input.id = inputId;

            // Validation: Int (Integers only)
            // Block ., +, e, - (if unsigned, but let's allow - for negative integers just in case, unless "Liczba" usually implies natural)
            // User request: "Int nie powinien przyjmować znaków innych niż liczby a przyjmuje przecinki i plusy"
            input.addEventListener('keydown', (e) => {
                // Allow: backspace, delete, tab, escape, enter, arrows
                if ([46, 8, 9, 27, 13, 110].indexOf(e.keyCode) !== -1 ||
                    // Allow: Ctrl+A, Command+A
                    (e.keyCode === 65 && (e.ctrlKey === true || e.metaKey === true)) ||
                    // Allow: home, end, left, right, down, up
                    (e.keyCode >= 35 && e.keyCode <= 40)) {
                    return; // let it happen
                }

                // Block signs +
                if (e.key === '+' || e.key === 'e' || e.key === ',' || e.key === '.') {
                    e.preventDefault();
                }
                // Ensure it is a number
                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                    // check for minus if we want to allow negative integers
                    if (e.key === '-') return; // Allow negative
                    e.preventDefault();
                }
            });

        } else if (field.type === 'float') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.id = inputId;

            // Validation: Float
            // User request: "Float, nie powinien przyjmować plusów"
            input.addEventListener('keydown', (e) => {
                // Allow ., +, -, e? "nie powinien przyjmować plusów"
                if (e.key === '+') {
                    e.preventDefault();
                }
            });
        }

        input.dataset.label = field.label;
        input.dataset.type = field.type; // Store type for parsing later
        input.dataset.index = index;

        // Add class if it's not the radio container which already has it
        if (!input.classList.contains('demo-dynamic-field')) {
            input.classList.add('demo-dynamic-field');
        }

        if (field.type === 'checkbox' && !field.options) {
            // Already appended in the 'else' block
        } else {
            div.appendChild(label);
            div.appendChild(input);
        }

        container.appendChild(div);
    });
}

export function loadSavedDemographics() {
    const saved = localStorage.getItem('activeDemographics');
    if (saved) {
        try {
            activeDemographics = JSON.parse(saved);

            // Only populate if we have a form rendered that matches? 
            // For now, try to populate fields by label matching if possible, or just ignore if structure changed.
            // Actually, we should probably check if saved data belongs to current template.

            if (activeDemographics && activeDemographics.templateId === currentTemplateId) {
                const inputs = document.querySelectorAll('.demo-dynamic-field');
                inputs.forEach(input => {
                    const label = input.dataset.label;
                    const val = activeDemographics.data[label];

                    if (val !== undefined) {
                        if (input.dataset.type === 'checkbox') {
                            if (input.dataset.checkboxGroup === 'true') {
                                // Checkbox Group (Multiple selection)
                                const selectedOpts = Array.isArray(val) ? val : (typeof val === 'string' ? val.split(',').map(s => s.trim()) : []);
                                const checkboxes = input.querySelectorAll('input[type="checkbox"]');
                                checkboxes.forEach(cb => {
                                    if (selectedOpts.includes(cb.value)) cb.checked = true;
                                });
                            } else {
                                // Classic Checkbox
                                input.checked = !!val;
                            }
                        } else if (input.dataset.type === 'radio') {
                            // Radio Group (Single selection)
                            const radios = input.querySelectorAll('input[type="radio"]');
                            radios.forEach(r => {
                                if (r.value === val) r.checked = true;
                            });
                        } else {
                            input.value = val;
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Error loading demographics:", e);
        }
    }
}

export async function saveDemographicsFromForm() {
    if (!currentTemplateId) {
        await Dialog.alert("Wybierz szablon przed zapisaniem!", 'warning');
        return;
    }

    const inputs = document.querySelectorAll('.demo-dynamic-field');
    const data = {};
    let isEmpty = true; // Tracks if all non-checkbox fields are empty

    inputs.forEach(input => {
        const type = input.dataset.type;

        if (type === 'checkbox') {
            if (input.dataset.checkboxGroup === 'true') {
                // Checkbox Group - Collect all checked values
                const checked = Array.from(input.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
                const val = checked.join(', ');
                data[input.dataset.label] = val;
                if (checked.length > 0) isEmpty = false;
            } else {
                data[input.dataset.label] = input.checked; // Boolean
                // Checkbox (bool) usually doesn't count towards "isEmpty" being false for submission validation
                // unless we want it to. Usually it's an optional toggle.
            }
        } else if (type === 'radio') {
            // Radio Group - Find checked
            const checkedRadio = input.querySelector('input[type="radio"]:checked');
            const val = checkedRadio ? checkedRadio.value : "";
            data[input.dataset.label] = val;
            if (val) isEmpty = false;
        } else {
            const val = input.value.trim();
            if (val) isEmpty = false;

            if (type === 'number') {
                data[input.dataset.label] = parseInt(val, 10) || 0;
            } else if (type === 'float') {
                data[input.dataset.label] = parseFloat(val) || 0.0;
            } else {
                data[input.dataset.label] = val;
            }
        }
    });

    // If only checkboxes exist, isEmpty might be true, but that's fine if user filled them.
    // Logic: If there are text fields, at least one must be filled.
    // If there are NO text fields (only checkboxes/radios), then it's valid?
    // Modified logic includes RadioGroups as "text-like" fields that contribute to "isEmpty = false" if selected.

    const hasInputs = Array.from(inputs).some(i => {
        // Exclude classic boolean checkboxes from "required at least one" check
        if (i.dataset.type === 'checkbox' && i.dataset.checkboxGroup !== 'true') return false;
        return true;
    });

    if (hasInputs && isEmpty) {
        await Dialog.alert("Wypełnij przynajmniej jedno pole!", 'warning');
        return;
    }

    // Check for overwrite if data exists for this template
    if (activeDemographics && activeDemographics.templateId === currentTemplateId) {
        const confirmOverwrite = await Dialog.confirm("Masz już zapisane dane dla tego szablonu. Czy chcesz je nadpisać?");
        if (!confirmOverwrite) return;
    }

    activeDemographics = {
        templateId: currentTemplateId,
        participant_id: data['Identyfikator'] || data['Kod'] || "ID_" + Date.now(), // Fallback
        data: data,
        filled_at: new Date().toISOString()
    };

    // Try to find a logical ID for the system
    const keys = Object.keys(data).map(k => k.toLowerCase());
    const idKey = keys.find(k => k.includes('id') || k.includes('kod') || k.includes('ident'));
    if (idKey) {
        const realKey = Object.keys(data).find(k => k.toLowerCase() === idKey);
        activeDemographics.participant_id = data[realKey];
    }

    localStorage.setItem('activeDemographics', JSON.stringify(activeDemographics));

    const statusSpan = document.getElementById('demo-status');
    if (statusSpan) {
        statusSpan.style.display = 'inline';
        statusSpan.textContent = "Zapisano!";
        setTimeout(() => { statusSpan.style.display = 'none'; }, 3000);
    }
}

export function getActiveDemographics() {
    if (!activeDemographics) {
        const saved = localStorage.getItem('activeDemographics');
        if (saved) {
            try {
                activeDemographics = JSON.parse(saved);
            } catch (e) { }
        }
    }
    return activeDemographics;
}

export async function clearDemographics() {
    if (!activeDemographics) {
        await Dialog.alert("Brak zapisanych danych do usunięcia.", 'info');
        // Still clear the form visually just in case
        await renderDynamicForm(currentTemplateId);
        return;
    }

    const confirmed = await Dialog.confirm("Czy na pewno chcesz usunąć zapisane dane uczestnika?");
    if (confirmed) {
        activeDemographics = null;
        localStorage.removeItem('activeDemographics');

        // Reload form to clear values
        await renderDynamicForm(currentTemplateId);

        await Dialog.alert("Dane zostały wyczyszczone.", 'info');
    }
}
