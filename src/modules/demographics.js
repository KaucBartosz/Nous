import { getAllTemplates, getTemplate } from './database.js';
import { elements } from './ui.js';

let activeDemographics = null;
let currentTemplateId = null;

export async function initDemographics() {
    await refreshTemplatesDropdown();

    const savedTemplateId = localStorage.getItem('activeTemplateId');
    if (savedTemplateId) {
        elements.demoTemplateSelect.value = savedTemplateId;
        await renderDynamicForm(savedTemplateId);
    } else {
        await renderDynamicForm(null); // Render default empty or nothing
    }

    elements.demoTemplateSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        localStorage.setItem('activeTemplateId', val);
        await renderDynamicForm(val);
    });

    // Populate data if exists
    loadSavedDemographics();

    // Bind Save Button (It was bound in HTML onclick maybe? No, let's bind it here if not already)
    // Actually ui.js might not bind it. Let's bind it safely.
    if (elements.btnSaveDemo) {
        // Remove old listeners? Hard to do without reference. 
        // We assume initDemographics is called once.
        elements.btnSaveDemo.addEventListener('click', saveDemographicsFromForm);
    }
}

export async function refreshTemplatesDropdown() {
    const templates = await getAllTemplates();
    elements.demoTemplateSelect.innerHTML = '<option value="">-- Domyślna (Brak) --</option>';
    templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.innerText = t.name;
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

        // Special info for checkbox?

        const label = document.createElement('label');
        label.innerText = field.label;

        let input;

        if (field.type === 'select') {
            input = document.createElement('select');
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.innerText = "-- Wybierz --";
            input.appendChild(defaultOpt);

            if (field.options) {
                const opts = field.options.split(',').map(s => s.trim());
                opts.forEach(optVal => {
                    const opt = document.createElement('option');
                    opt.value = optVal;
                    opt.innerText = optVal;
                    input.appendChild(opt);
                });
            }
        } else if (field.type === 'checkbox') {
            // Checkbox logic: wrap in a label for better UI
            // Actually, let's make a wrapper row
            div.style.flexDirection = 'row';
            div.style.alignItems = 'center';
            div.innerHTML = ''; // Reset standard label

            input = document.createElement('input');
            input.type = 'checkbox';
            input.style.width = 'auto';
            input.style.marginRight = '10px';

            div.appendChild(input);
            div.appendChild(label); // Label after checkbox

        } else if (field.type === 'date') {
            input = document.createElement('input');
            input.type = 'date';
        } else if (field.type === 'text') {
            input = document.createElement('input');
            input.type = 'text';
        } else if (field.type === 'number') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '1';
        } else if (field.type === 'float') {
            input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
        }

        input.dataset.label = field.label;
        input.dataset.type = field.type; // Store type for parsing later
        input.dataset.index = index;
        input.className = 'demo-dynamic-field';

        // If not checkbox, append standard order
        if (field.type !== 'checkbox') {
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
                    if (activeDemographics.data && activeDemographics.data[label] !== undefined) {
                        if (input.dataset.type === 'checkbox') {
                            input.checked = activeDemographics.data[label];
                        } else {
                            input.value = activeDemographics.data[label];
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Error loading demographics:", e);
        }
    }
}

export function saveDemographicsFromForm() {
    if (!currentTemplateId) {
        alert("Wybierz szablon przed zapisaniem!");
        return;
    }

    const inputs = document.querySelectorAll('.demo-dynamic-field');
    const data = {};
    let isEmpty = true; // Tracks if all non-checkbox fields are empty

    inputs.forEach(input => {
        const type = input.dataset.type;

        if (type === 'checkbox') {
            data[input.dataset.label] = input.checked; // Boolean
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
    // If there are NO text fields (only checkboxes), then it's valid.
    const hasTextFields = Array.from(inputs).some(i => i.dataset.type !== 'checkbox');

    if (hasTextFields && isEmpty) {
        alert("Wypełnij przynajmniej jedno pole!");
        return;
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
        statusSpan.innerText = "Zapisano!";
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
