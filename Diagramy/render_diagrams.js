const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Uruchamianie przeglądarki Playwright w trybie headless...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Listen for console logs inside the page
  page.on('console', msg => {
    console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`);
  });

  // Ustawienie dużego viewportu, aby uniknąć zawijania i zniekształceń
  await page.setViewportSize({ width: 2400, height: 3500 });
  
  const htmlPath = path.resolve(__dirname, 'diagrams.html');
  const fileUrl = `file://${htmlPath}`;
  console.log(`Ładowanie pliku HTML: ${fileUrl}`);
  
  await page.goto(fileUrl);
  
  console.log('Oczekiwanie na wyrenderowanie diagramów przez bibliotekę Mermaid...');
  // Czekamy, aż we wszystkich kontenerach wyrenderuje się tag SVG
  await page.waitForSelector('#diagram-arch-ogolna svg');
  await page.waitForSelector('#diagram-arch-ipc svg');
  await page.waitForSelector('#diagram-arch-moduly svg');
  await page.waitForSelector('#diagram-rbac svg');
  await page.waitForSelector('#diagram-przeplyw-zapis svg');
  await page.waitForSelector('#diagram-przeplyw-synch svg');
  
  // Dodatkowa chwila na stabilizację czcionek z Google Fonts
  await page.waitForTimeout(1500);

  const diagrams = [
    { 
      containerId: 'container-arch-ogolna', 
      mermaidId: 'diagram-arch-ogolna', 
      baseName: 'architektura_ogolna' 
    },
    { 
      containerId: 'container-arch-ipc', 
      mermaidId: 'diagram-arch-ipc', 
      baseName: 'architektura_ipc' 
    },
    { 
      containerId: 'container-arch-moduly', 
      mermaidId: 'diagram-arch-moduly', 
      baseName: 'architektura_moduly' 
    },
    { 
      containerId: 'container-rbac', 
      mermaidId: 'diagram-rbac', 
      baseName: 'rbac' 
    },
    { 
      containerId: 'container-przeplyw-zapis', 
      mermaidId: 'diagram-przeplyw-zapis', 
      baseName: 'przeplyw_zapis' 
    },
    { 
      containerId: 'container-przeplyw-synch', 
      mermaidId: 'diagram-przeplyw-synch', 
      baseName: 'przeplyw_synch' 
    }
  ];

  for (const diag of diagrams) {
    const container = await page.$(`#${diag.containerId}`);
    if (container) {
      // 1. Zrzut ekranu do PNG o wysokiej rozdzielczości
      const pngPath = path.resolve(__dirname, `${diag.baseName}.png`);
      await container.screenshot({
        path: pngPath,
        omitBackground: false,
        type: 'png',
        animations: 'disabled'
      });
      console.log(`Pomyślnie zapisano PNG: ${pngPath}`);

      // 2. Eksport do wektorowego formatu SVG
      const svgContent = await page.evaluate((id) => {
        const el = document.querySelector(`#${id} svg`);
        if (!el) return null;
        
        if (!el.getAttribute('xmlns')) {
          el.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        if (!el.getAttribute('xmlns:xlink')) {
          el.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        }
        
        return el.outerHTML;
      }, diag.mermaidId);

      if (svgContent) {
        const svgPath = path.resolve(__dirname, `${diag.baseName}.svg`);
        fs.writeFileSync(svgPath, `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${svgContent}`);
        console.log(`Pomyślnie zapisano SVG: ${svgPath}`);
      } else {
        console.error(`Błąd: Nie udało się pobrać kodu SVG dla ${diag.mermaidId}`);
      }
    } else {
      console.error(`Błąd: Nie znaleziono kontenera #${diag.containerId}`);
    }
  }

  await browser.close();
  console.log('Wszystkie diagramy zostały wyrenderowane i zapisane w folderze "Diagramy"!');
})().catch(err => {
  console.error('Wystąpił krytyczny błąd podczas renderowania:', err);
  process.exit(1);
});
