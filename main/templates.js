// main/templates.js — Templates (E4): eksport/import szablonów metryczki.
// Przeniesione 1:1 z main.js. Logika (nazwa/payload/walidacja) czysta i testowana;
// dialog/fs/okno wstrzyknięte.

function safeTemplateName(name) {
  return (name || "szablon").replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

function buildExportPayload(templateData) {
  return {
    meta: {
      app: "Nous",
      type: "demographics_template",
      version: "1.0",
      exportedAt: new Date().toISOString(),
    },
    template: templateData,
  };
}

/**
 * Walidacja importu (rzuca jak wcześniej: SyntaxError albo błąd formatu).
 * @returns {{ success: true, data }}
 */
function parseImportContent(content) {
  const json = JSON.parse(content);

  // Validation basics
  if (!json.template || !json.template.fields) {
    // Try direct template object fallback (if user saved raw JSON manually)
    if (json.name && json.fields) {
      return { success: true, data: json };
    }
    throw new Error("Nieprawidłowy format pliku (brak pola template lub fields).");
  }

  return { success: true, data: json.template };
}

function createTemplates({ dialog, fs }) {
  async function exportTemplate(getMainWindow, templateData) {
    // Sanity check name
    const safeName = safeTemplateName(templateData.name);

    const { filePath } = await dialog.showSaveDialog(getMainWindow(), {
      title: "Eksportuj Szablon Metryczki",
      defaultPath: `szablon_${safeName}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (filePath) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(buildExportPayload(templateData), null, 2));
        return { success: true };
      } catch (e) {
        console.error("Export template error:", e);
        return { success: false, error: e.message };
      }
    }
    return { success: false, cancelled: true };
  }

  async function importTemplate(getMainWindow) {
    const { filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: "Importuj Szablon Metryczki",
      properties: ["openFile"],
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (filePaths && filePaths.length > 0) {
      try {
        const content = fs.readFileSync(filePaths[0], "utf8");
        return parseImportContent(content);
      } catch (e) {
        console.error("Import template error:", e);
        return { success: false, error: e.message };
      }
    }
    return { success: false, cancelled: true };
  }

  function registerIpc(ipcMain, getMainWindow) {
    ipcMain.handle("export-template", async (event, templateData) =>
      exportTemplate(getMainWindow, templateData),
    );
    ipcMain.handle("import-template", async () => importTemplate(getMainWindow));
  }

  return { safeTemplateName, buildExportPayload, parseImportContent, exportTemplate, importTemplate, registerIpc };
}

module.exports = { createTemplates, safeTemplateName, buildExportPayload, parseImportContent };
