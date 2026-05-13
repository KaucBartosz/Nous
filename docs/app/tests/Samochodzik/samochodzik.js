/***********************
 * Samochodzik - Test *
 ***********************/

import {
  core,
  visual,
  util,
  data,
  sound,
  hardware,
} from "./lib/psychojs-2025.1.1.js";
const { PsychoJS } = core;
const { Scheduler } = util;

// 1. Inicjalizacja
const psychoJS = new PsychoJS({ debug: false });

psychoJS.openWindow({
  fullscr: false,
  color: new util.Color([0, 0, 0]),
  units: "height",
  waitBlanking: true,
});

// --- STAN GRY ---
let expName = "samochodzik";
let expInfo = {
  participant: util.pad(Math.floor(Math.random() * 1000000).toString(), 6),
  session: "001",
};

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);

psychoJS.schedule(
  psychoJS.gui.DlgFromDict({ dictionary: expInfo, title: expName }),
);

let trackImage, carSprite, welcomeText, difficultyText;
let carX,
  carY,
  carRotation = 0,
  freezeTimer = 0;
let startX_saved, startY_saved;
let collisionCount = 0,
  startTime = null,
  finished = false;
let trackPixels = null;
let trackPixelsW, trackPixelsH;
let currentAspect = 0.555;
let selectedTrackPath = "resources/trasa.png";

const activeKeys = new Set();
let lastSelectionKey = null;

document.addEventListener("keydown", (e) => {
  activeKeys.add(e.key);
  lastSelectionKey = e.key;
});
document.addEventListener("keyup", (e) => activeKeys.delete(e.key));

/**
 * Inicjalizacja
 */
async function updateInfo() {
  expInfo["date"] = util.MonotonicClock.getDateStr();
  psychoJS.experiment.dataFileName = `./data/${expInfo.participant}_${expName}_${expInfo.date}`;
  if (typeof window.electronTest !== "undefined") {
    psychoJS.experiment.save = () => Promise.resolve();
  }
  return Scheduler.Event.NEXT;
}

async function experimentInit() {
  welcomeText = new visual.TextStim({
    win: psychoJS.window,
    text: "Twoim zadaniem będzie przejechanie labiryntu. Za pomocą strzałek na klawiaturze, pokieruj samochodem do mety. Staraj się dokładnie kierować samochodem, aby nie wyjechać poza krawędź labiryntu. Wyjechanie poza krawędź spowoduje powrót samochodu na start. Naciśnij SPACJĘ aby wybrać trasę.",
    color: new util.Color("white"),
    height: 0.04,
  });

  difficultyText = new visual.TextStim({
    win: psychoJS.window,
    text: "WYBIERZ TRASĘ:\n\n1 - Klasyczna (Łatwa)\n2 - Labirynt (Trudna)\n\nNaciśnij 1 lub 2",
    color: new util.Color("white"),
    height: 0.05,
  });

  const carImg = new Image();
  carImg.src = "resources/sam.png";
  await new Promise((resolve) => (carImg.onload = resolve));

  carSprite = new visual.ImageStim({
    win: psychoJS.window,
    name: "car",
    image: carImg,
    pos: [0, 0],
    size: [0.03, 0.05],
    depth: -10,
  });

  return Scheduler.Event.NEXT;
}

function welcomeRoutine() {
  return async function () {
    if (welcomeText.status === PsychoJS.Status.NOT_STARTED) {
      welcomeText.setAutoDraw(true);
      welcomeText.status = PsychoJS.Status.STARTED;
      lastSelectionKey = null;
    }
    if (
      activeKeys.has(" ") ||
      activeKeys.has("Spacebar") ||
      lastSelectionKey === " "
    ) {
      welcomeText.setAutoDraw(false);
      lastSelectionKey = null;
      return Scheduler.Event.NEXT;
    }
    if (activeKeys.has("Escape") || activeKeys.has("escape"))
      return quitPsychoJS("Wyjście", true);
    return Scheduler.Event.FLIP_REPEAT;
  };
}

function difficultyRoutine() {
  return async function () {
    if (difficultyText.status === PsychoJS.Status.NOT_STARTED) {
      difficultyText.setAutoDraw(true);
      difficultyText.status = PsychoJS.Status.STARTED;
      lastSelectionKey = null;
    }

    let choice = null;
    if (lastSelectionKey === "1" || lastSelectionKey === "Numpad1")
      choice = "1";
    if (lastSelectionKey === "2" || lastSelectionKey === "Numpad2")
      choice = "2";

    if (choice) {
      expInfo["difficulty"] = choice;
      selectedTrackPath =
        choice === "1" ? "resources/trasa.png" : "resources/trasa2.png";
      difficultyText.setAutoDraw(false);
      lastSelectionKey = null;

      await loadTrackResources(selectedTrackPath);
      return Scheduler.Event.NEXT;
    }

    if (activeKeys.has("Escape") || activeKeys.has("escape"))
      return quitPsychoJS("Wyjście", true);
    return Scheduler.Event.FLIP_REPEAT;
  };
}

/**
 * Optymalizacja Krytyczna: Skalowanie gigantycznych grafik do rozmiaru bezpiecznego dla GPU/CPU
 */
async function loadTrackResources(path) {
  const img = new Image();
  img.src = path;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // Przeskalowanie grafiki (np. z 6000px do 1600px) aby nie zawiesić GPU
  const maxW = 1600;
  const scale = Math.min(1.0, maxW / img.width);
  trackPixelsW = Math.round(img.width * scale);
  trackPixelsH = Math.round(img.height * scale);
  currentAspect = img.height / img.width;

  const cv = document.createElement("canvas");
  cv.width = trackPixelsW;
  cv.height = trackPixelsH;
  const ctx = cv.getContext("2d");
  ctx.drawImage(img, 0, 0, trackPixelsW, trackPixelsH);

  // Pobieranie danych z mniejszego bufora (ImageData)
  trackPixels = ctx.getImageData(0, 0, trackPixelsW, trackPixelsH).data;

  // Skanowanie celu (start)
  let sumX = 0,
    sumY = 0,
    count = 0;
  for (let i = 0; i < trackPixels.length; i += 4) {
    if (
      trackPixels[i] < 75 &&
      trackPixels[i + 1] > 180 &&
      trackPixels[i + 2] < 75
    ) {
      const idx = i / 4;
      sumX += idx % trackPixelsW;
      sumY += Math.floor(idx / trackPixelsW);
      count++;
    }
  }

  let startPX = trackPixelsW * 0.3,
    startPY = trackPixelsH * 0.8;
  if (count > 0) {
    startPX = sumX / count;
    startPY = sumY / count;
  }

  startX_saved = (startPX / trackPixelsW - 0.5) * 1.6;
  startY_saved = (currentAspect / 2 - startPY / trackPixelsW) * 1.6;

  carX = startX_saved;
  carY = startY_saved;

  // Ważne: PsychoJS nie przyjmuje surowego Canvas, musimy zamienić go na obraz (DataURL)
  const finalImg = new Image();
  finalImg.src = cv.toDataURL("image/png");
  await new Promise((r) => (finalImg.onload = r));

  trackImage = new visual.ImageStim({
    win: psychoJS.window,
    name: "track",
    image: finalImg,
    pos: [0, 0],
    size: [1.6, 1.6 * currentAspect],
    depth: 10,
  });

  startTime = Date.now();
  finished = false;
}

function gameRoutine() {
  return async function () {
    if (!trackImage || trackImage.status === PsychoJS.Status.NOT_STARTED) {
      if (trackImage) {
        trackImage.setAutoDraw(true);
        carSprite.setAutoDraw(true);
        trackImage.status = PsychoJS.Status.STARTED;
      }
    }

    if (finished) {
      if (trackImage) trackImage.setAutoDraw(false);
      if (carSprite) carSprite.setAutoDraw(false);
      return Scheduler.Event.NEXT;
    }

    if (activeKeys.has("Escape") || activeKeys.has("escape"))
      return quitPsychoJS("Przerwano", true);

    // System mrożenia po kolizji
    if (freezeTimer > 0) {
      freezeTimer -= 1 / 60; // Zakładamy 60 klatek, PsychoJS sam to wygładzi
      carSprite.setOpacity(0.5);
    } else {
      carSprite.setOpacity(1.0);
      let dx = 0,
        dy = 0;
      if (activeKeys.has("ArrowLeft")) dx -= 1;
      if (activeKeys.has("ArrowRight")) dx += 1;
      if (activeKeys.has("ArrowUp")) dy += 1;
      if (activeKeys.has("ArrowDown")) dy -= 1;

      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        carX += (dx / len) * 0.007;
        carY += (dy / len) * 0.007;
        carRotation = Math.atan2(dx, dy);
      }
    }

    // Kolizja na przeskalowanym buforze
    if (trackPixels) {
      const px = Math.floor((carX / 1.6 + 0.5) * trackPixelsW);
      const py = Math.floor((currentAspect / 2 - carY / 1.6) * trackPixelsW);

      const idx =
        (Math.max(0, Math.min(trackPixelsH - 1, py)) * trackPixelsW +
          Math.max(0, Math.min(trackPixelsW - 1, px))) *
        4;
      const r = trackPixels[idx],
        g = trackPixels[idx + 1],
        b = trackPixels[idx + 2];

      if (r > 150 && g < 100 && b < 100) {
        // Meta
        finished = true;
        return Scheduler.Event.NEXT;
      }
      if (r < 80 && g < 80 && b < 80) {
        // Ściana
        carX = startX_saved;
        carY = startY_saved;
        carRotation = 0;
        collisionCount++;
        freezeTimer = 0.5; // Zapobiegaj seryjnym kolizjom (0.5 sekundy)
      }
    }

    if (carSprite) {
      carSprite.setPos([carX, carY]);
      carSprite.setOri(carRotation * (180 / Math.PI));
    }
    return Scheduler.Event.FLIP_REPEAT;
  };
}

function finishRoutine() {
  let finishClock = null;
  let finishText = null;

  return async function () {
    if (finishClock === null) {
      finishClock = new util.Clock();
      finishText = new visual.TextStim({
        win: psychoJS.window,
        text: "META!\n\nZamykanie...",
        color: new util.Color("green"),
        height: 0.1,
      });
      finishText.setAutoDraw(true);
    }

    if (finishClock.getTime() > 2.0) {
      finishText.setAutoDraw(false);
      return quitPsychoJS("Koniec", true);
    }
    return Scheduler.Event.FLIP_REPEAT;
  };
}

async function quitPsychoJS(message, isCompleted) {
  if (typeof window.electronTest !== "undefined") {
    if (isCompleted) {
      window.electronTest.sendResults({
        testId: "samochodzik",
        subjectId: expInfo["participant"],
        session: expInfo["session"],
        timestamp: new Date().toISOString(),
        difficulty: expInfo["difficulty"],
        ilosc_poprawnych_nacisniec: 1,
        ilosc_blednych_nacisniec: collisionCount,
        ogolna_ilosc_nacisniec: 1 + collisionCount,
        czas_pokonania_trasy_sek: Math.round((Date.now() - startTime) / 1000),
        score: `Trasa ${expInfo["difficulty"]} | Kolizje: ${collisionCount} | Czas: ${Math.round((Date.now() - startTime) / 1000)}s`,
        statystyki: {
          trasa: expInfo["difficulty"],
          kolizje: collisionCount,
          czas_ms: Date.now() - startTime,
        },
      });
    } else {
      window.electronTest.close();
    }
  }
  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });
  return Scheduler.Event.QUIT;
}

psychoJS.scheduleCondition(
  () => psychoJS.gui.dialogComponent.button === "OK",
  flowScheduler,
  dialogCancelScheduler,
);
flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(welcomeRoutine());
flowScheduler.add(difficultyRoutine());
flowScheduler.add(gameRoutine());
flowScheduler.add(finishRoutine());
dialogCancelScheduler.add(quitPsychoJS, "Anulowano", false);

psychoJS.start({ expName: expName, expInfo: expInfo, resources: [] });
