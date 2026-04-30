// src/modules/settings.js

const SETTINGS_KEY = 'nous-app-settings';
const CUSTOM_CACHE_KEY = 'nous-app-settings-custom-cache';
const SAVED_THEMES_KEY = 'nous-app-saved-themes';

// Default settings for DARK theme
const DEFAULT_DARK_SETTINGS = {
    theme: 'dark',
    showLocalTests: false,
    // Interactive Elements
    primaryColor: '#4f8cf2',
    primaryHover: '#6ea1f7',
    // Text Colors
    textMain: '#f0f0f0',
    textMuted: '#94a3b8',
    textInactiveTab: '#94a3b8',
    textTestDescription: '#94a3b8',
    textTestName: '#f0f0f0',
    buttonText: '#ffffff',
    // Icons
    iconColor: '#94a3b8',
    iconActive: '#4f8cf2',
    // Backgrounds
    bgDark: '#0f111a',
    bgCard: 'rgba(30, 30, 30, 0.6)',
    bgSidebar: '#1a1c26',
    // Borders
    borderColor: 'rgba(255, 255, 255, 0.1)'
};

// Default settings for LIGHT theme
const DEFAULT_LIGHT_SETTINGS = {
    theme: 'light',
    showLocalTests: false,
    // Interactive Elements
    primaryColor: '#1d4ed8',
    primaryHover: '#1e40af',
    // Text Colors
    textMain: '#000000',
    textMuted: '#334155',
    textInactiveTab: '#475569',
    textTestDescription: '#334155',
    textTestName: '#000000',
    buttonText: '#ffffff',
    // Icons
    iconColor: '#1e293b',
    iconActive: '#1d4ed8',
    // Backgrounds
    bgDark: '#f1f5f9',
    bgCard: '#ffffff',
    bgSidebar: '#ffffff',
    // Borders
    borderColor: '#94a3b8'
};

// Current settings (in memory)
let currentSettings = { ...DEFAULT_DARK_SETTINGS };
let cachedCustomSettings = null;

/**
 * Get default settings for a theme
 */
function getDefaultsForTheme(theme) {
    if (theme === 'light') return { ...DEFAULT_LIGHT_SETTINGS };
    if (theme === 'custom') return { ...DEFAULT_DARK_SETTINGS, theme: 'custom' };
    return { ...DEFAULT_DARK_SETTINGS };
}

/**
 * Load settings from localStorage
 */
export function loadSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            const defaults = getDefaultsForTheme(parsed.theme || 'dark');
            currentSettings = { ...defaults, ...parsed };
        }

        // Load cached custom settings
        const cached = localStorage.getItem(CUSTOM_CACHE_KEY);
        if (cached) {
            cachedCustomSettings = JSON.parse(cached);
        } else if (currentSettings.theme === 'custom') {
            cachedCustomSettings = { ...currentSettings };
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        currentSettings = { ...DEFAULT_DARK_SETTINGS };
    }
    return currentSettings;
}

/**
 * Save settings to localStorage
 */
export function saveSettings(settings) {
    try {
        currentSettings = { ...settings };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
}

/**
 * Apply settings to the document
 */
export function applySettings(settings = currentSettings) {
    const root = document.documentElement;

    // Apply theme
    if (settings.theme) {
        root.setAttribute('data-theme', settings.theme);
    }

    // Apply all CSS variables
    root.style.setProperty('--primary', settings.primaryColor);
    root.style.setProperty('--primary-hover', settings.primaryHover || adjustColor(settings.primaryColor, 20));
    root.style.setProperty('--primary-glow', `${settings.primaryColor}66`);

    root.style.setProperty('--text-main', settings.textMain);
    root.style.setProperty('--text-muted', settings.textMuted);
    root.style.setProperty('--text-inactive-tab', settings.textInactiveTab || settings.textMuted);
    root.style.setProperty('--text-test-description', settings.textTestDescription || settings.textMuted);
    root.style.setProperty('--text-test-name', settings.textTestName || settings.textMain);
    root.style.setProperty('--text-button', settings.buttonText || '#ffffff');

    root.style.setProperty('--icon-color', settings.iconColor);
    root.style.setProperty('--icon-active', settings.iconActive);

    root.style.setProperty('--bg-dark', settings.bgDark);
    root.style.setProperty('--bg-card', settings.bgCard);
    root.style.setProperty('--bg-sidebar', settings.bgSidebar);

    root.style.setProperty('--border', settings.borderColor);
}

/**
 * Adjust color brightness (for hover states)
 */
function adjustColor(color, amount) {
    // Handle rgba colors
    if (color.startsWith('rgba') || color.startsWith('rgb')) {
        return color;
    }

    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Adjust brightness
    const newR = Math.min(255, r + amount);
    const newG = Math.min(255, g + amount);
    const newB = Math.min(255, b + amount);

    // Convert back to hex
    return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

/**
 * Get current settings
 */
export function getSettings() {
    return { ...currentSettings };
}

/**
 * Save custom cache
 */
function saveCustomCache(settings) {
    try {
        cachedCustomSettings = { ...settings };
        localStorage.setItem(CUSTOM_CACHE_KEY, JSON.stringify(cachedCustomSettings));
    } catch (error) {
        console.error('Error saving custom cache:', error);
    }
}

/**
 * Switch to a specific theme with caching logic for Custom theme
 */
export function switchToTheme(theme) {
    // If we are currently in Custom mode, save the state before switching away
    if (currentSettings.theme === 'custom') {
        saveCustomCache(currentSettings);
    }

    let newSettings;
    if (theme === 'custom') {
        // Try to restore cached custom settings
        if (cachedCustomSettings) {
            newSettings = { ...cachedCustomSettings, theme: 'custom' };
        } else {
            newSettings = getDefaultsForTheme('custom');
        }
    } else {
        newSettings = getDefaultsForTheme(theme);
    }

    currentSettings = newSettings;
    applySettings(currentSettings);
    saveSettings(currentSettings);
    return currentSettings;
}

/**
 * Reset to default settings for current theme
 */
export function resetToDefaultsForTheme(theme) {
    const defaults = getDefaultsForTheme(theme);
    currentSettings = { ...defaults };
    applySettings(currentSettings);
    saveSettings(currentSettings);
    return currentSettings;
}



/**
 * XSS Protection - Sanitize string
 */
function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Load all saved custom themes
 */
function getSavedThemes() {
    try {
        const stored = localStorage.getItem(SAVED_THEMES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Save a new custom theme
 */
function saveCustomTheme(name, settings) {
    const themes = getSavedThemes();
    const cleanName = sanitize(name.trim());
    if (!cleanName) return { success: false, error: 'Nazwa nie może być pusta!' };

    // Update if exists or add new
    const existingIndex = themes.findIndex(t => t.name === cleanName);
    const themeObj = { name: cleanName, settings: { ...settings, theme: 'custom' } };

    if (existingIndex >= 0) {
        themes[existingIndex] = themeObj;
    } else {
        themes.push(themeObj);
    }

    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(themes));
    return { success: true };
}

/**
 * Delete a saved theme
 */
function deleteCustomTheme(name) {
    const themes = getSavedThemes();
    const updated = themes.filter(t => t.name !== name);
    localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(updated));
}

/**
 * Initialize settings module
 */
export function initSettings() {
    // Load and apply saved settings
    const settings = loadSettings();
    applySettings(settings);

    // Setup UI elements
    const elements = {
        // Interactive Elements
        primaryColorPicker: document.getElementById('primary-color-picker'),
        primaryColorValue: document.getElementById('primary-color-value'),
        primaryHoverPicker: document.getElementById('primary-hover-picker'),
        primaryHoverValue: document.getElementById('primary-hover-value'),

        // Text Colors
        textMainPicker: document.getElementById('text-main-picker'),
        textMainValue: document.getElementById('text-main-value'),
        textMutedPicker: document.getElementById('text-muted-picker'),
        textMutedValue: document.getElementById('text-muted-value'),
        textInactiveTabPicker: document.getElementById('text-inactive-tab-picker'),
        textInactiveTabValue: document.getElementById('text-inactive-tab-value'),
        textTestDescriptionPicker: document.getElementById('text-test-description-picker'),
        textTestDescriptionValue: document.getElementById('text-test-description-value'),
        textTestNamePicker: document.getElementById('text-test-name-picker'),
        textTestNameValue: document.getElementById('text-test-name-value'),
        buttonTextPicker: document.getElementById('button-text-picker'),
        buttonTextValue: document.getElementById('button-text-value'),

        // Local Tests Filter
        showLocalTestsToggle: document.getElementById('show-local-tests-toggle'),
        localTestsPathStr: document.getElementById('local-tests-path'),

        // Icons
        iconColorPicker: document.getElementById('icon-color-picker'),
        iconColorValue: document.getElementById('icon-color-value'),
        iconActivePicker: document.getElementById('icon-active-picker'),
        iconActiveValue: document.getElementById('icon-active-value'),

        // Backgrounds
        bgDarkPicker: document.getElementById('bg-dark-picker'),
        bgDarkValue: document.getElementById('bg-dark-value'),
        bgSidebarPicker: document.getElementById('bg-sidebar-picker'),
        bgSidebarValue: document.getElementById('bg-sidebar-value'),

        // Borders
        borderColorPicker: document.getElementById('border-color-picker'),
        borderColorValue: document.getElementById('border-color-value'),

        themeRadios: document.querySelectorAll('input[name="theme"]'),
        btnSave: document.getElementById('btn-save-settings'),
        btnReset: document.getElementById('btn-reset-settings'),
        status: document.getElementById('settings-status'),

        // Theme management elements
        savedThemesSelect: document.getElementById('saved-themes-select'),
        newThemeNameInput: document.getElementById('new-theme-name'),
        btnSaveCustomTheme: document.getElementById('btn-save-custom-theme'),
        btnDeleteTheme: document.getElementById('btn-delete-theme')
    };

    // Populate saved themes dropdown
    function refreshThemesDropdown() {
        if (!elements.savedThemesSelect) return;
        const themes = getSavedThemes();
        const currentVal = elements.savedThemesSelect.value;

        elements.savedThemesSelect.innerHTML = '<option value="">-- Domyślny Własny --</option>';
        themes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.textContent = t.name;
            elements.savedThemesSelect.appendChild(opt);
        });

        if (currentVal) elements.savedThemesSelect.value = currentVal;
    }

    refreshThemesDropdown();

    // Initialize form values
    function updateFormValues(settings) {
        if (elements.primaryColorPicker) {
            elements.primaryColorPicker.value = settings.primaryColor;
            elements.primaryColorValue.value = settings.primaryColor;
        }
        if (elements.primaryHoverPicker) {
            elements.primaryHoverPicker.value = settings.primaryHover;
            elements.primaryHoverValue.value = settings.primaryHover;
        }
        if (elements.textMainPicker) {
            elements.textMainPicker.value = settings.textMain;
            elements.textMainValue.value = settings.textMain;
        }
        if (elements.textMutedPicker) {
            elements.textMutedPicker.value = settings.textMuted;
            elements.textMutedValue.value = settings.textMuted;
        }
        if (elements.textInactiveTabPicker) {
            const val = settings.textInactiveTab || settings.textMuted;
            elements.textInactiveTabPicker.value = val;
            elements.textInactiveTabValue.value = val;
        }
        if (elements.textTestDescriptionPicker) {
            const val = settings.textTestDescription || settings.textMuted;
            elements.textTestDescriptionPicker.value = val;
            elements.textTestDescriptionValue.value = val;
        }
        if (elements.textTestNamePicker) {
            const val = settings.textTestName || settings.textMain;
            elements.textTestNamePicker.value = val;
            elements.textTestNameValue.value = val;
        }
        if (elements.buttonTextPicker) {
            elements.buttonTextPicker.value = settings.buttonText || '#ffffff';
            elements.buttonTextValue.value = settings.buttonText || '#ffffff';
        }
        if (elements.showLocalTestsToggle) {
            elements.showLocalTestsToggle.checked = settings.showLocalTests === true;
        }
        if (elements.iconColorPicker) {
            elements.iconColorPicker.value = settings.iconColor;
            elements.iconColorValue.value = settings.iconColor;
        }
        if (elements.iconActivePicker) {
            elements.iconActivePicker.value = settings.iconActive;
            elements.iconActiveValue.value = settings.iconActive;
        }
        if (elements.bgDarkPicker) {
          const bgDark = typeof settings.bgDark === 'string' ? settings.bgDark : '#0f111a';
          elements.bgDarkPicker.value = bgDark.startsWith('#') ? bgDark : '#0f111a';
          elements.bgDarkValue.value = bgDark;
        }
        if (elements.bgSidebarPicker) {
          const bgSidebar = typeof settings.bgSidebar === 'string' ? settings.bgSidebar : '#1a1c26';
          elements.bgSidebarPicker.value = bgSidebar.startsWith('#') ? bgSidebar : '#1a1c26';
          elements.bgSidebarValue.value = bgSidebar;
        }
        if (elements.borderColorPicker) {
          const borderHex = typeof settings.borderColor === 'string' ? settings.borderColor : '#ffffff';
          elements.borderColorPicker.value = borderHex.startsWith('#') ? borderHex : '#ffffff';
          elements.borderColorValue.value = borderHex;
        }

        elements.themeRadios.forEach(radio => {
            radio.checked = radio.value === settings.theme;
        });
    }

    updateFormValues(settings);

    // Setup color picker listeners
    function setupColorPicker(picker, valueDisplay, settingKey) {
        if (!picker) return;

        picker.addEventListener('input', (e) => {
            const color = e.target.value;
            valueDisplay.value = color;
            currentSettings[settingKey] = color;

            // Automatically switch to Custom theme
            if (currentSettings.theme !== 'custom') {
                currentSettings.theme = 'custom';
                const customRadio = document.querySelector('input[name="theme"][value="custom"]');
                if (customRadio) customRadio.checked = true;
            }

            applySettings(currentSettings);
        });
    }

    setupColorPicker(elements.primaryColorPicker, elements.primaryColorValue, 'primaryColor');
    setupColorPicker(elements.primaryHoverPicker, elements.primaryHoverValue, 'primaryHover');
    setupColorPicker(elements.textMainPicker, elements.textMainValue, 'textMain');
    setupColorPicker(elements.textMutedPicker, elements.textMutedValue, 'textMuted');
    setupColorPicker(elements.textInactiveTabPicker, elements.textInactiveTabValue, 'textInactiveTab');
    setupColorPicker(elements.textTestDescriptionPicker, elements.textTestDescriptionValue, 'textTestDescription');
    setupColorPicker(elements.textTestNamePicker, elements.textTestNameValue, 'textTestName');
    setupColorPicker(elements.buttonTextPicker, elements.buttonTextValue, 'buttonText');
    setupColorPicker(elements.iconColorPicker, elements.iconColorValue, 'iconColor');
    setupColorPicker(elements.iconActivePicker, elements.iconActiveValue, 'iconActive');
    setupColorPicker(elements.bgDarkPicker, elements.bgDarkValue, 'bgDark');
    setupColorPicker(elements.bgSidebarPicker, elements.bgSidebarValue, 'bgSidebar');
    setupColorPicker(elements.borderColorPicker, elements.borderColorValue, 'borderColor');

    // Theme change - reset to defaults for selected theme
    elements.themeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            const settings = switchToTheme(newTheme);
            updateFormValues(settings);
            if (newTheme !== 'custom' && elements.savedThemesSelect) {
                elements.savedThemesSelect.value = "";
            }
        });
    });

    // Saved theme selection
    if (elements.savedThemesSelect) {
        elements.savedThemesSelect.addEventListener('change', (e) => {
            const themeName = e.target.value;
            if (!themeName) {
                // Return to default custom if nothing selected but mode is custom
                if (currentSettings.theme === 'custom') {
                    const defaults = getDefaultsForTheme('custom');
                    currentSettings = { ...defaults };
                    applySettings(currentSettings);
                    updateFormValues(currentSettings);
                }
                return;
            }

            const themes = getSavedThemes();
            const theme = themes.find(t => t.name === themeName);
            if (theme) {
                currentSettings = { ...theme.settings };
                applySettings(currentSettings);
                updateFormValues(currentSettings);

                // Ensure custom radio is checked
                const customRadio = document.querySelector('input[name="theme"][value="custom"]');
                if (customRadio) customRadio.checked = true;
            }
        });
    }

    // Save as new custom theme
    if (elements.btnSaveCustomTheme) {
        elements.btnSaveCustomTheme.addEventListener('click', async () => {
            const name = elements.newThemeNameInput.value;
            if (!name) {
                const { Dialog } = await import('./dialog.js');
                await Dialog.alert("Podaj nazwę dla nowego motywu!", 'warning');
                return;
            }

            const result = saveCustomTheme(name, currentSettings);
            if (result.success) {
                elements.newThemeNameInput.value = "";
                refreshThemesDropdown();
                elements.savedThemesSelect.value = sanitize(name.trim());

                const { Dialog } = await import('./dialog.js');
                await Dialog.alert(`Motyw "${name}" został zapisany!`, 'success');
            } else {
                const { Dialog } = await import('./dialog.js');
                await Dialog.alert(result.error, 'error');
            }
        });
    }

    // Delete saved theme
    if (elements.btnDeleteTheme) {
        elements.btnDeleteTheme.addEventListener('click', async () => {
            const name = elements.savedThemesSelect.value;
            if (!name) return;

            const { Dialog } = await import('./dialog.js');
            const confirm = await Dialog.confirm(`Czy na pewno chcesz usunąć motyw "${name}"?`, 'warning');
            if (confirm) {
                deleteCustomTheme(name);
                refreshThemesDropdown();
                elements.savedThemesSelect.value = "";
            }
        });
    }


    // Save button
    if (elements.btnSave) {
        elements.btnSave.addEventListener('click', () => {
            if (saveSettings(currentSettings)) {
                applySettings(currentSettings);

                // Show success message
                elements.status.style.display = 'block';
                setTimeout(() => {
                    elements.status.style.display = 'none';
                }, 3000);
            }
        });
    }

    // Reset button
    if (elements.btnReset) {
        elements.btnReset.addEventListener('click', () => {
            const currentTheme = currentSettings.theme;
            const defaults = resetToDefaultsForTheme(currentTheme);
            updateFormValues(defaults);

            // Show success message
            elements.status.textContent = 'Przywrócono ustawienia domyślne!';
            elements.status.style.display = 'block';
            setTimeout(() => {
                elements.status.style.display = 'none';
                elements.status.textContent = 'Ustawienia zapisane!';
            }, 3000);
        });
    }

    if (elements.showLocalTestsToggle) {
        elements.showLocalTestsToggle.addEventListener('change', (e) => {
            currentSettings.showLocalTests = e.target.checked;
        });
    }

    if (window.electronAPI && elements.localTestsPathStr) {
        window.electronAPI.getLocalVersions().then(localVersions => {
            elements.localTestsPathStr.textContent = localVersions.__scannedDir || 'Nieznana lokalizacja';
        }).catch(err => {
            console.error("Błąd pobierania ścieżki:", err);
            elements.localTestsPathStr.textContent = 'Błąd pobierania ścieżki';
        });
    }

    console.log('Settings module initialized with:', settings);
}
