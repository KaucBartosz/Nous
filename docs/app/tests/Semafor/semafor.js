/****************
 * Semafor *
 ****************/

import {
  core,
  data,
  sound,
  util,
  visual,
  hardware,
} from "./lib/psychojs-2025.1.1.js";
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
//some handy aliases as in the psychopy scripts;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;

// store info about the experiment session:
let expName = "semafor"; // from the Builder filename that created this script
let expInfo = {
  participant: `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  session: "001",
};
let PILOTING = util.getUrlParameters().has("__pilotToken");

// Start code blocks for 'Before Experiment'
// init psychoJS:
const psychoJS = new PsychoJS({
  debug: true,
});

// open window:
psychoJS.openWindow({
  fullscr: true,
  color: new util.Color([0, 0, 0]),
  units: "height",
  waitBlanking: true,
  backgroundImage: "",
  backgroundFit: "none",
});
// schedule the experiment:
psychoJS.schedule(
  psychoJS.gui.DlgFromDict({
    dictionary: expInfo,
    title: expName,
  }),
);

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(
  function () {
    return psychoJS.gui.dialogComponent.button === "OK";
  },
  flowScheduler,
  dialogCancelScheduler,
);

// flowScheduler gets run if the participants presses OK
flowScheduler.add(updateInfo); // add timeStamp
flowScheduler.add(experimentInit);
flowScheduler.add(menuRoutineBegin());
flowScheduler.add(menuRoutineEachFrame());
flowScheduler.add(menuRoutineEnd());
flowScheduler.add(welcomeRoutineBegin());
flowScheduler.add(welcomeRoutineEachFrame());
flowScheduler.add(welcomeRoutineEnd());
const n_trialsLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(n_trialsLoopBegin(n_trialsLoopScheduler));
flowScheduler.add(n_trialsLoopScheduler);
flowScheduler.add(n_trialsLoopEnd);

flowScheduler.add(quitPsychoJS, "Thank you for your patience.", true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, "Thank you for your patience.", false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: [
    // resources:
    {
      name: "resources/lampkaZielOFF.png",
      path: "resources/lampkaZielOFF.png",
    },
    { name: "resources/lampkaZielON.png", path: "resources/lampkaZielON.png" },
    { name: "resources/lampkaOFF.png", path: "resources/lampkaOFF.png" },
    { name: "resources/lampkaON.png", path: "resources/lampkaON.png" },
  ],
});

psychoJS.experimentLogger.setLevel(core.Logger.ServerLevel.INFO);

var currentLoop;
var frameDur;
async function updateInfo() {
  currentLoop = psychoJS.experiment; // right now there are no loops
  expInfo["date"] = util.MonotonicClock.getDateStr(); // add a simple timestamp
  expInfo["expName"] = expName;
  expInfo["psychopyVersion"] = "2025.1.1";
  expInfo["OS"] = window.navigator.platform;

  // store frame rate of monitor if we can measure it successfully
  expInfo["frameRate"] = psychoJS.window.getActualFrameRate();
  if (typeof expInfo["frameRate"] !== "undefined")
    frameDur = 1.0 / Math.round(expInfo["frameRate"]);
  else frameDur = 1.0 / 60.0; // couldn't get a reliable measure so guess

  // add info from the URL:
  util.addInfoFromUrl(expInfo);

  psychoJS.experiment.dataFileName =
    "." + "/" + `data/${expInfo["participant"]}_${expName}_${expInfo["date"]}`;
  psychoJS.experiment.field_separator = "\t";

  return Scheduler.Event.NEXT;
}

var welcomeClock;
var welcomeText;
var key_resp;
var trialClock;
var lamp_grid;
var mouse;
var globalClock;
var routineTimer;
// Menu
var menuClock;
var menuState;
var menuMouseReleased;
var menuComponents;
var menuTitle;
var menuHint;
var menuBtn1Text;
var menuBtn2Text;
// Prezentacja
var prezAnimClock;
var prezLoopCount;
var prezLampOn;
var prezHLine;
var prezVLine;
var prezCircle;
var prezCursor;
var prezInfoText;
var prezTitleText;
var prezBackText;
var prezDemoTargetX;
var prezDemoTargetY;
async function experimentInit() {
  // Initialize components for Routine "welcome"
  welcomeClock = new util.Clock();
  welcomeText = new visual.TextStim({
    win: psychoJS.window,
    name: "welcomeText",
    text: "Za chwilę zobaczysz planszę z lampkami. Twoim zadaniem będzie, za pomocą MYSZY, wskazać tę lampkę, która znajduje się na przecięciu prostych dwóch lampek zapalonych na zielono. Staraj się klikać najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.",
    font: "Arial",
    units: undefined,
    pos: [0, 0],
    draggable: false,
    height: 0.05,
    wrapWidth: 1.2,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color("white"),
    opacity: undefined,
    depth: 0.0,
  });

  key_resp = new core.Keyboard({
    psychoJS: psychoJS,
    clock: new util.Clock(),
    waitForStart: true,
  });

  // Initialize components for Routine "trial"
  trialClock = new util.Clock();
  // Run 'Begin Experiment' code from code
  // --- INTEGRACJA Z LAUNCHEREM (INIT) ---
  if (typeof window.electronTest !== "undefined") {
    console.log("Wykryto PsychoLauncher. Blokowanie zapisu CSV.");

    // Nadpisujemy funkcję zapisu pustą obietnicą
    psychoJS.experiment.save = function () {
      return Promise.resolve();
    };
  }

  let N = 8;

  let coords = [];
  for (let i = 0; i < N; i++) {
    coords.push((i - (N - 1) / 2) * 0.08);
  }

  lamp_grid = [];
  for (let ix = 0; ix < N; ix++) {
    let row = [];
    for (let iy = 0; iy < N; iy++) {
      let stim = new visual.ImageStim({
        win: psychoJS.window,
        image: "resources/lampkaOFF.png",
        size: [0.08, 0.08],
        pos: [coords[ix], coords[iy]],
        opacity: 1.0,
      });
      row.push(stim);
    }
    lamp_grid.push(row);
  }

  // zielona ramka + ukryte rogi
  let cornerCoords = [
    [0, 0],
    [0, N - 1],
    [N - 1, 0],
    [N - 1, N - 1],
  ];

  for (let ix = 0; ix < N; ix++) {
    for (let iy = 0; iy < N; iy++) {
      let is_outer = ix === 0 || ix === N - 1 || iy === 0 || iy === N - 1;

      // sprawdź, czy to róg
      let is_corner = false;
      for (let c = 0; c < cornerCoords.length; c++) {
        if (cornerCoords[c][0] === ix && cornerCoords[c][1] === iy) {
          is_corner = true;
          break;
        }
      }

      if (is_corner) {
        lamp_grid[ix][iy].setOpacity(0.0);
      } else if (is_outer) {
        lamp_grid[ix][iy].setImage("resources/lampkaZielOFF.png");
      } else {
        lamp_grid[ix][iy].setImage("resources/lampkaOFF.png");
      }
    }
  }
  mouse = new core.Mouse({
    win: psychoJS.window,
  });
  mouse.mouseClock = new util.Clock();
  // Create some handy timers
  globalClock = new util.Clock(); // to track the time since experiment started
  routineTimer = new util.CountdownTimer(); // to track time remaining of each (non-slip) routine

  // --- EKRAN DOTYKOWY ---
  window._touchJustStarted = false;
  window._touchPsychoX = null;
  window._touchPsychoY = null;
  window._touchCanvas = null;
  let canvas =
    (psychoJS.window._renderer && psychoJS.window._renderer.view) ||
    document.querySelector("canvas");
  if (canvas) {
    window._touchCanvas = canvas;
    function touchToPsycho(clientX, clientY) {
      let r = canvas.getBoundingClientRect();
      let aspect = r.width / r.height;
      return {
        x: ((2 * (clientX - r.left)) / r.width - 1) * aspect,
        y: 1 - (2 * (clientY - r.top)) / r.height,
      };
    }
    canvas.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        if (e.touches.length > 0) {
          let p = touchToPsycho(e.touches[0].clientX, e.touches[0].clientY);
          window._touchJustStarted = true;
          window._touchPsychoX = p.x;
          window._touchPsychoY = p.y;
        }
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchend",
      function (e) {
        e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener(
      "touchmove",
      function (e) {
        e.preventDefault();
      },
      { passive: false },
    );
  }

  // =========================================================
  // MENU & PREZENTACJA — tworzenie obiektów wizualnych
  // =========================================================
  menuClock = new util.Clock();
  prezAnimClock = new util.Clock();

  // Prekalkulacja współrzędnych demo (siatka 8×8, krok 0.08)
  {
    let dN = 8;
    let dc = [];
    for (let i = 0; i < dN; i++) dc.push((i - (dN - 1) / 2) * 0.08);
    prezDemoTargetX = dc[3]; // -0.04
    prezDemoTargetY = dc[5]; //  0.12
  }

  // --- Tytuł menu ---
  menuTitle = new visual.TextStim({
    win: psychoJS.window,
    name: "menuTitle",
    text: "Semafor",
    font: "Arial",
    pos: [0, 0.28],
    height: 0.09,
    wrapWidth: 2.0,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color("white"),
    opacity: 1.0,
  });

  // --- Podpowiedź klawiszowa ---
  menuHint = new visual.TextStim({
    win: psychoJS.window,
    name: "menuHint",
    text: "[ klawisze:  1  lub  2 ]",
    font: "Arial",
    pos: [0, -0.28],
    height: 0.032,
    wrapWidth: 2.0,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color([0.5, 0.5, 0.5]),
    opacity: 1.0,
  });

  // --- Opcja 1: Test ---
  menuBtn1Text = new visual.TextStim({
    win: psychoJS.window,
    name: "menuBtn1Text",
    text: "1.Test",
    font: "Arial",
    pos: [0, 0.06],
    height: 0.055,
    wrapWidth: 2.0,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color("white"),
    opacity: 1.0,
  });

  // --- Opcja 2: Prezentacja ---
  menuBtn2Text = new visual.TextStim({
    win: psychoJS.window,
    name: "menuBtn2Text",
    text: "2.Prezentacja",
    font: "Arial",
    pos: [0, -0.1],
    height: 0.055,
    wrapWidth: 2.0,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color("white"),
    opacity: 1.0,
  });

  // --- Prezentacja: nagłówek ---
  prezTitleText = new visual.TextStim({
    win: psychoJS.window,
    name: "prezTitle",
    text: "\u2014 Prezentacja \u2014",
    font: "Arial",
    pos: [0, 0.44],
    height: 0.04,
    wrapWidth: 2.0,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color([0.65, 0.65, 0.65]),
    opacity: 1.0,
  });

  // --- Prezentacja: pozioma linia przecięcia ---
  prezHLine = new visual.Rect({
    win: psychoJS.window,
    name: "prezHLine",
    pos: [0.0, prezDemoTargetY],
    size: [0.68, 0.006],
    ori: 0.0,
    fillColor: new util.Color([0.15, 0.95, 0.15]),
    lineColor: new util.Color([0.15, 0.95, 0.15]),
    lineWidth: 1,
    opacity: 0.0,
  });

  // --- Prezentacja: pionowa linia przecięcia ---
  prezVLine = new visual.Rect({
    win: psychoJS.window,
    name: "prezVLine",
    pos: [prezDemoTargetX, 0.0],
    size: [0.006, 0.68],
    ori: 0.0,
    fillColor: new util.Color([0.15, 0.95, 0.15]),
    lineColor: new util.Color([0.15, 0.95, 0.15]),
    lineWidth: 1,
    opacity: 0.0,
  });

  // --- Prezentacja: pulsujące kółko na przecięciu ---
  prezCircle = new visual.Polygon({
    win: psychoJS.window,
    name: "prezCircle",
    edges: 32,
    radius: 0.048,
    pos: [prezDemoTargetX, prezDemoTargetY],
    ori: 0.0,
    fillColor: new util.Color([1.0, 0.88, 0.0]),
    lineColor: new util.Color([1.0, 0.65, 0.0]),
    lineWidth: 2,
    opacity: 0.0,
  });

  // --- Prezentacja: kursor (animowany) ---
  prezCursor = new visual.Polygon({
    win: psychoJS.window,
    name: "prezCursor",
    edges: 32,
    radius: 0.026,
    pos: [0.38, 0.36],
    ori: 0.0,
    fillColor: new util.Color([0.95, 0.95, 0.95]),
    lineColor: new util.Color([0.25, 0.25, 0.25]),
    lineWidth: 1.5,
    opacity: 0.0,
  });

  // --- Prezentacja: tekst informacyjny ---
  prezInfoText = new visual.TextStim({
    win: psychoJS.window,
    name: "prezInfo",
    text: "",
    font: "Arial",
    pos: [0, -0.4],
    height: 0.038,
    wrapWidth: 1.2,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color([1.0, 1.0, 0.45]),
    opacity: 1.0,
  });

  // --- Prezentacja: link powrotu ---
  prezBackText = new visual.TextStim({
    win: psychoJS.window,
    name: "prezBackLabel",
    text: "\u2190 Wr\u00f3\u0107 do menu",
    font: "Arial",
    pos: [0, -0.462],
    height: 0.031,
    wrapWidth: 2.0,
    ori: 0.0,
    languageStyle: "LTR",
    color: new util.Color([0.85, 0.85, 0.85]),
    opacity: 1.0,
  });

  return Scheduler.Event.NEXT;
}

var t;
var frameN;
var continueRoutine;
var routineForceEnded;
var welcomeMaxDurationReached;
var _key_resp_allKeys;
var welcomeMaxDuration;
var welcomeComponents;

// =========================================================
// HELPER: ustawia siatkę w stan demo i zapala dwie lampki
// =========================================================
function _setupDemoLamps() {
  let N = lamp_grid.length;
  let cornerCoords = [
    [0, 0],
    [0, N - 1],
    [N - 1, 0],
    [N - 1, N - 1],
  ];
  for (let ix = 0; ix < N; ix++) {
    for (let iy = 0; iy < N; iy++) {
      let isCorner = cornerCoords.some((c) => c[0] === ix && c[1] === iy);
      let isOuter = ix === 0 || ix === N - 1 || iy === 0 || iy === N - 1;
      if (isCorner) {
        lamp_grid[ix][iy].setOpacity(0.0);
      } else if (isOuter) {
        lamp_grid[ix][iy].setOpacity(1.0);
        lamp_grid[ix][iy].setImage("resources/lampkaZielOFF.png");
      } else {
        lamp_grid[ix][iy].setOpacity(1.0);
        lamp_grid[ix][iy].setImage("resources/lampkaOFF.png");
      }
    }
  }
  // Zapalamy dwie demo-lampki
  lamp_grid[3][0].setImage("resources/lampkaZielON.png"); // x-lampka (górna krawędź)
  lamp_grid[0][5].setImage("resources/lampkaZielON.png"); // y-lampka (lewa krawędź)
  prezLampOn = false;
}

// =========================================================
// MENU ROUTINE
// =========================================================
function menuRoutineBegin() {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    menuClock.reset();
    menuState = "choice";
    menuMouseReleased = false;
    menuComponents = [];
    // Przywróć domyślne kolory tekstu
    menuBtn1Text.setColor(new util.Color("white"));
    menuBtn2Text.setColor(new util.Color("white"));
    return Scheduler.Event.NEXT;
  };
}

function menuRoutineEachFrame() {
  return async function () {
    t = menuClock.getTime();
    frameN = frameN + 1;

    let btns = mouse.getPressed();
    // Rejestrujemy puszczenie przycisku (wymagane do akceptacji klików)
    if (!btns[0] && !btns[1] && !btns[2]) menuMouseReleased = true;

    // -------------------------------------------------------
    // STAN: WYBÓR (Test / Prezentacja)
    // -------------------------------------------------------
    if (menuState === "choice") {
      let mp = mouse.getPos();
      let overBtn1 = Math.abs(mp[0]) <= 0.3 && Math.abs(mp[1] - 0.06) <= 0.05;
      let overBtn2 = Math.abs(mp[0]) <= 0.3 && Math.abs(mp[1] + 0.1) <= 0.05;

      // Kolor tekstu zmienia się przy hover (zielony / niebieski)
      menuBtn1Text.setColor(
        new util.Color(overBtn1 ? [0.35, 1.0, 0.45] : "white"),
      );
      menuBtn2Text.setColor(
        new util.Color(overBtn2 ? [0.45, 0.75, 1.0] : "white"),
      );

      menuTitle.draw();
      menuBtn1Text.draw();
      menuBtn2Text.draw();
      menuHint.draw();

      // Obsługa kliknięcia myszą
      if (menuMouseReleased && btns[0]) {
        if (overBtn1) {
          continueRoutine = false;
        } else if (overBtn2) {
          // Ukryj elementy menu
          menuTitle.setAutoDraw(false);
          menuBtn1Text.setAutoDraw(false);
          menuBtn2Text.setAutoDraw(false);
          menuHint.setAutoDraw(false);
          menuState = "prezentacja";
          prezAnimClock.reset();
          prezLoopCount = 0;
          _setupDemoLamps();
          prezHLine.setOpacity(0.0);
          prezVLine.setOpacity(0.0);
          prezCircle.setOpacity(0.0);
          prezCursor.setOpacity(0.0);
          prezInfoText.setText("");
          menuMouseReleased = false; // konsumujemy klik
        }
      }

      // Obsługa klawiatury: 1 / spacja → Test, 2 → Prezentacja
      let choiceKeys = psychoJS.eventManager.getKeys({
        keyList: ["1", "2", "space"],
      });
      if (choiceKeys.includes("1") || choiceKeys.includes("space")) {
        continueRoutine = false;
      }
      if (choiceKeys.includes("2")) {
        // Ukryj elementy menu
        menuTitle.setAutoDraw(false);
        menuBtn1Text.setAutoDraw(false);
        menuBtn2Text.setAutoDraw(false);
        menuHint.setAutoDraw(false);
        menuState = "prezentacja";
        prezAnimClock.reset();
        prezLoopCount = 0;
        _setupDemoLamps();
        prezHLine.setOpacity(0.0);
        prezVLine.setOpacity(0.0);
        prezCircle.setOpacity(0.0);
        prezCursor.setOpacity(0.0);
        prezInfoText.setText("");
      }
    }

    // -------------------------------------------------------
    // STAN: PREZENTACJA (animacja pętlowa)
    // -------------------------------------------------------
    else if (menuState === "prezentacja") {
      const ANIM_T = 7.5; // długość jednej pętli w sekundach

      let rawAt = prezAnimClock.getTime();
      let at = rawAt % ANIM_T;

      // Wykryj początek nowej pętli → reset stanu demo
      let loopN = Math.floor(rawAt / ANIM_T);
      if (loopN > prezLoopCount) {
        prezLoopCount = loopN;
        _setupDemoLamps();
        prezHLine.setOpacity(0.0);
        prezVLine.setOpacity(0.0);
        prezCircle.setOpacity(0.0);
        prezCursor.setOpacity(0.0);
      }

      // Funkcje pomocnicze
      const clamp01 = (x) => Math.max(0, Math.min(1, x));
      const smoothStep = (x) => {
        let s = clamp01(x);
        return s * s * (3 - 2 * s);
      };

      // ---- Linie zielone (1.0−2.5 s fade-in, 7.0−7.5 s fade-out) ----
      let lineAlpha =
        clamp01((at - 1.0) / 1.5) * 0.85 * clamp01(1.0 - (at - 7.0) / 0.5);
      prezHLine.setOpacity(lineAlpha);
      prezVLine.setOpacity(lineAlpha);

      // ---- Pulsujące kółko na przecięciu (2.5−4.6 s) ----
      if (at >= 2.5 && at < 4.6) {
        let pulseAlpha = 0.6 + 0.4 * Math.sin(at * Math.PI * 3.0);
        prezCircle.setOpacity(Math.max(0, pulseAlpha));
      } else {
        prezCircle.setOpacity(0.0);
      }

      // ---- Kursor poruszający się do celu (4.5−6.2 s) ----
      if (at >= 4.5 && at < 6.2) {
        let moveT = smoothStep(clamp01((at - 4.5) / 1.3));
        let cx = 0.38 + (prezDemoTargetX - 0.38) * moveT;
        let cy = 0.36 + (prezDemoTargetY - 0.36) * moveT;
        prezCursor.setPos([cx, cy]);
        // Efekt kliknięcia: kursor znika i powraca (5.8−6.1 s)
        let clickFade = clamp01((at - 5.8) / 0.15);
        let clickReturn = clamp01((at - 5.95) / 0.15);
        let cursorAlpha = 1.0 - clickFade * 0.85 + clickReturn * 0.85;
        prezCursor.setOpacity(cursorAlpha);
      } else {
        prezCursor.setOpacity(0.0);
      }

      // ---- Zapalenie lampki docelowej przy kliknięciu (5.9 s) ----
      if (at >= 5.9 && !prezLampOn) {
        lamp_grid[3][5].setImage("resources/lampkaON.png");
        prezLampOn = true;
      }

      // ---- Tekst opisu fazy ----
      let infoMsg;
      if (at < 1.0) {
        infoMsg = "Dwie lampki zapalają się na zielono...";
      } else if (at < 2.5) {
        infoMsg = "Każda wyznacza linię przez całą siatkę...";
      } else if (at < 4.5) {
        infoMsg = "Wskaż lampkę na przecięciu tych linii!";
      } else if (at < 5.9) {
        infoMsg = "Kliknij myszką w to miejsce!";
      } else {
        infoMsg = "\u2713  To jest prawidłowa odpowiedź!";
      }
      prezInfoText.setText(infoMsg);

      // ---- Rysowanie ----
      prezTitleText.draw();
      for (let ix = 0; ix < lamp_grid.length; ix++)
        for (let iy = 0; iy < lamp_grid[ix].length; iy++)
          lamp_grid[ix][iy].draw();
      prezHLine.draw();
      prezVLine.draw();
      prezCircle.draw();
      prezCursor.draw();
      prezInfoText.draw();

      // ---- Link "Wróć do menu" z efektem hover ----
      let mp = mouse.getPos();
      let overBack =
        Math.abs(mp[0]) <= 0.22 && Math.abs(mp[1] + 0.462) <= 0.025;
      prezBackText.setColor(
        new util.Color(overBack ? [1.0, 0.75, 0.2] : [0.55, 0.55, 0.55]),
      );
      prezBackText.draw();

      // Kliknięcie linku powrotu lub klawisz Backspace
      let backKeys = psychoJS.eventManager.getKeys({
        keyList: ["backspace", "escape"],
      });
      if ((menuMouseReleased && btns[0] && overBack) || backKeys.length > 0) {
        // Ukryj wszystkie elementy prezentacji (siatkę lampek i overlaye)
        prezTitleText.setAutoDraw(false);
        prezHLine.setAutoDraw(false);
        prezVLine.setAutoDraw(false);
        prezCircle.setAutoDraw(false);
        prezCursor.setAutoDraw(false);
        prezInfoText.setAutoDraw(false);
        prezBackText.setAutoDraw(false);
        for (let ix = 0; ix < lamp_grid.length; ix++)
          for (let iy = 0; iy < lamp_grid[ix].length; iy++)
            lamp_grid[ix][iy].setAutoDraw(false);
        menuState = "choice";
        menuMouseReleased = false;
        menuBtn1Text.setColor(new util.Color("white"));
        menuBtn2Text.setColor(new util.Color("white"));
      }
    }

    // Wyjście z aplikacji (ESC w trybie choice; w prezentacji ESC wróć do menu)
    if (
      psychoJS.experiment.experimentEnded ||
      psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0
    ) {
      return quitPsychoJS("The [Escape] key was pressed. Goodbye!", true);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    return Scheduler.Event.FLIP_REPEAT;
  };
}

function menuRoutineEnd() {
  return async function () {
    // Usuń WSZYSTKIE elementy menu i prezentacji ze stage PIXI
    menuTitle.setAutoDraw(false);
    menuHint.setAutoDraw(false);
    menuBtn1Text.setAutoDraw(false);
    menuBtn2Text.setAutoDraw(false);
    prezTitleText.setAutoDraw(false);
    prezHLine.setAutoDraw(false);
    prezVLine.setAutoDraw(false);
    prezCircle.setAutoDraw(false);
    prezCursor.setAutoDraw(false);
    prezInfoText.setAutoDraw(false);
    prezBackText.setAutoDraw(false);
    return Scheduler.Event.NEXT;
  };
}

function welcomeRoutineBegin(snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // ensure that .thisN vals are up to date

    //--- Prepare to start Routine 'welcome' ---
    t = 0;
    frameN = -1;
    continueRoutine = true; // until we're told otherwise
    // keep track of whether this Routine was forcibly ended
    routineForceEnded = false;
    welcomeClock.reset();
    routineTimer.reset();
    welcomeMaxDurationReached = false;
    // update component parameters for each repeat
    key_resp.keys = undefined;
    key_resp.rt = undefined;
    _key_resp_allKeys = [];
    psychoJS.experiment.addData("welcome.started", globalClock.getTime());
    welcomeMaxDuration = null;
    // keep track of which components have finished
    welcomeComponents = [];
    welcomeComponents.push(welcomeText);
    welcomeComponents.push(key_resp);

    for (const thisComponent of welcomeComponents)
      if ("status" in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  };
}

function welcomeRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'welcome' ---
    // get current time
    t = welcomeClock.getTime();
    frameN = frameN + 1; // number of completed frames (so 0 is the first frame)
    // update/draw components on each frame

    // *welcomeText* updates
    if (t >= 0.0 && welcomeText.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      welcomeText.tStart = t; // (not accounting for frame time here)
      welcomeText.frameNStart = frameN; // exact frame index

      welcomeText.setAutoDraw(true);
    }

    // if welcomeText is active this frame...
    if (welcomeText.status === PsychoJS.Status.STARTED) {
    }

    // *key_resp* updates
    if (t >= 0.0 && key_resp.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      key_resp.tStart = t; // (not accounting for frame time here)
      key_resp.frameNStart = frameN; // exact frame index

      // keyboard checking is just starting
      psychoJS.window.callOnFlip(function () {
        key_resp.clock.reset();
      }); // t=0 on next screen flip
      psychoJS.window.callOnFlip(function () {
        key_resp.start();
      }); // start on screen flip
      psychoJS.window.callOnFlip(function () {
        key_resp.clearEvents();
      });
    }

    // if key_resp is active this frame...
    if (key_resp.status === PsychoJS.Status.STARTED) {
      let theseKeys = key_resp.getKeys({
        keyList: ["y", "n", "left", "right", "space"],
        waitRelease: false,
      });
      _key_resp_allKeys = _key_resp_allKeys.concat(theseKeys);
      if (_key_resp_allKeys.length > 0) {
        key_resp.keys = _key_resp_allKeys[_key_resp_allKeys.length - 1].name; // just the last key pressed
        key_resp.rt = _key_resp_allKeys[_key_resp_allKeys.length - 1].rt;
        key_resp.duration =
          _key_resp_allKeys[_key_resp_allKeys.length - 1].duration;
        // a response ends the routine
        continueRoutine = false;
      }
    }

    // check for quit (typically the Esc key)
    if (
      psychoJS.experiment.experimentEnded ||
      psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0
    ) {
      return quitPsychoJS("The [Escape] key was pressed. Goodbye!", true);
    }

    // check if the Routine should terminate
    if (!continueRoutine) {
      // a component has requested a forced-end of Routine
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false; // reverts to True if at least one component still running
    for (const thisComponent of welcomeComponents)
      if (
        "status" in thisComponent &&
        thisComponent.status !== PsychoJS.Status.FINISHED
      ) {
        continueRoutine = true;
        break;
      }

    // refresh the screen if continuing
    if (continueRoutine) {
      return Scheduler.Event.FLIP_REPEAT;
    } else {
      return Scheduler.Event.NEXT;
    }
  };
}

function welcomeRoutineEnd(snapshot) {
  return async function () {
    //--- Ending Routine 'welcome' ---
    for (const thisComponent of welcomeComponents) {
      if (typeof thisComponent.setAutoDraw === "function") {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData("welcome.stopped", globalClock.getTime());
    // update the trial handler
    if (currentLoop instanceof MultiStairHandler) {
      currentLoop.addResponse(key_resp.corr, level);
    }
    psychoJS.experiment.addData("key_resp.keys", key_resp.keys);
    if (typeof key_resp.keys !== "undefined") {
      // we had a response
      psychoJS.experiment.addData("key_resp.rt", key_resp.rt);
      psychoJS.experiment.addData("key_resp.duration", key_resp.duration);
      routineTimer.reset();
    }

    key_resp.stop();
    // the Routine "welcome" was not non-slip safe, so reset the non-slip timer
    routineTimer.reset();

    // Routines running outside a loop should always advance the datafile row
    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  };
}

var n_trials;
function n_trialsLoopBegin(n_trialsLoopScheduler, snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // update internal variables (.thisN etc) of the loop

    // set up handler to look after randomisation of conditions etc
    n_trials = new TrialHandler({
      psychoJS: psychoJS,
      nReps: 20,
      method: TrialHandler.Method.RANDOM,
      extraInfo: expInfo,
      originPath: undefined,
      trialList: undefined,
      seed: undefined,
      name: "n_trials",
    });
    psychoJS.experiment.addLoop(n_trials); // add the loop to the experiment
    currentLoop = n_trials; // we're now the current loop

    // Schedule all the trials in the trialList:
    for (const thisN_trial of n_trials) {
      snapshot = n_trials.getSnapshot();
      n_trialsLoopScheduler.add(importConditions(snapshot));
      n_trialsLoopScheduler.add(trialRoutineBegin(snapshot));
      n_trialsLoopScheduler.add(trialRoutineEachFrame());
      n_trialsLoopScheduler.add(trialRoutineEnd(snapshot));
      n_trialsLoopScheduler.add(
        n_trialsLoopEndIteration(n_trialsLoopScheduler, snapshot),
      );
    }

    return Scheduler.Event.NEXT;
  };
}

async function n_trialsLoopEnd() {
  // terminate loop
  psychoJS.experiment.removeLoop(n_trials);
  // update the current loop from the ExperimentHandler
  if (psychoJS.experiment._unfinishedLoops.length > 0)
    currentLoop = psychoJS.experiment._unfinishedLoops.at(-1);
  else currentLoop = psychoJS.experiment; // so we use addData from the experiment
  return Scheduler.Event.NEXT;
}

function n_trialsLoopEndIteration(scheduler, snapshot) {
  // ------Prepare for next entry------
  return async function () {
    if (typeof snapshot !== "undefined") {
      // ------Check if user ended loop early------
      if (snapshot.finished) {
        // Check for and save orphaned data
        if (psychoJS.experiment.isEntryEmpty()) {
          psychoJS.experiment.nextEntry(snapshot);
        }
        scheduler.stop();
      } else {
        psychoJS.experiment.nextEntry(snapshot);
      }
      return Scheduler.Event.NEXT;
    }
  };
}

var trialMaxDurationReached;
var x_edge;
var y_edge;
var y_edge_row;
var x_edge_col;
var x_index;
var y_index;
var target_x;
var target_y;
var clicked_x;
var clicked_y;
var rt;
var correct;
var feedbackClock;
var show_feedback;
var mouseWasReleased;
var gotValidClick;
var trialMaxDuration;
var trialComponents;
function trialRoutineBegin(snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // ensure that .thisN vals are up to date

    //--- Prepare to start Routine 'trial' ---
    t = 0;
    frameN = -1;
    continueRoutine = true; // until we're told otherwise
    // keep track of whether this Routine was forcibly ended
    routineForceEnded = false;
    trialClock.reset();
    routineTimer.reset();
    trialMaxDurationReached = false;
    // update component parameters for each repeat
    // Run 'Begin Routine' code from code
    // --- BEGIN ROUTINE (JS) dla Semafor ---

    let N = lamp_grid.length;

    let cornerCoords = [
      [0, 0],
      [0, N - 1],
      [N - 1, 0],
      [N - 1, N - 1],
    ];

    // zmienne globalne tej próby
    x_edge = null;
    y_edge = null;
    y_edge_row = null;
    x_edge_col = null;
    x_index = null;
    y_index = null;
    target_x = null;
    target_y = null;

    // odtworzenie ramki: zielone OFF, środek czerwone OFF, rogi ukryte
    for (let ix = 0; ix < N; ix++) {
      for (let iy = 0; iy < N; iy++) {
        let is_outer = ix === 0 || ix === N - 1 || iy === 0 || iy === N - 1;

        let is_corner = false;
        for (let c = 0; c < cornerCoords.length; c++) {
          if (cornerCoords[c][0] === ix && cornerCoords[c][1] === iy) {
            is_corner = true;
            break;
          }
        }

        if (is_corner) {
          lamp_grid[ix][iy].setOpacity(0.0);
        } else if (is_outer) {
          lamp_grid[ix][iy].setOpacity(1.0);
          lamp_grid[ix][iy].setImage("resources/lampkaZielOFF.png");
        } else {
          lamp_grid[ix][iy].setOpacity(1.0);
          lamp_grid[ix][iy].setImage("resources/lampkaOFF.png");
        }
      }
    }

    // los krawędzi
    x_edge = Math.random() < 0.5 ? "top" : "bottom";
    y_edge = Math.random() < 0.5 ? "left" : "right";

    // wiersz dla X, kolumna dla Y
    y_edge_row = x_edge === "top" ? 0 : N - 1;
    x_edge_col = y_edge === "left" ? 0 : N - 1;

    // losowanie indeksów z wykluczeniem rogów
    while (true) {
      // X: kolumna różna od kolumny Y-edge
      x_index = Math.floor(Math.random() * N);
      while (x_index === x_edge_col) {
        x_index = Math.floor(Math.random() * N);
      }

      // Y: wiersz różny od wiersza X-edge
      y_index = Math.floor(Math.random() * N);
      while (y_index === y_edge_row) {
        y_index = Math.floor(Math.random() * N);
      }

      let x_lamp = [x_index, y_edge_row];
      let y_lamp = [x_edge_col, y_index];

      let bad = false;
      for (let c = 0; c < cornerCoords.length; c++) {
        let cx = cornerCoords[c][0];
        let cy = cornerCoords[c][1];
        if (
          (x_lamp[0] === cx && x_lamp[1] === cy) ||
          (y_lamp[0] === cx && y_lamp[1] === cy)
        ) {
          bad = true;
          break;
        }
      }

      if (!bad) {
        break;
      }
    }

    // zapalamy X
    lamp_grid[x_index][y_edge_row].setImage("resources/lampkaZielON.png");
    // zapalamy Y
    lamp_grid[x_edge_col][y_index].setImage("resources/lampkaZielON.png");

    // cel
    target_x = x_index;
    target_y = y_index;

    // zmienne odpowiedzi
    clicked_x = null;
    clicked_y = null;
    rt = null;
    correct = 0;
    feedbackClock = new util.Clock();
    show_feedback = false;
    mouseWasReleased = false; // musi nastąpić puszczenie przycisku przed akceptacją kliku
    trialClock.reset();

    // setup some python lists for storing info about the mouse
    // current position of the mouse:
    mouse.x = [];
    mouse.y = [];
    mouse.leftButton = [];
    mouse.midButton = [];
    mouse.rightButton = [];
    mouse.time = [];
    gotValidClick = false; // until a click is received
    psychoJS.experiment.addData("trial.started", globalClock.getTime());
    trialMaxDuration = null;
    // keep track of which components have finished
    trialComponents = [];
    trialComponents.push(mouse);

    for (const thisComponent of trialComponents)
      if ("status" in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  };
}

var prevButtonState;
var _mouseButtons;
var _mouseXYs;
function trialRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'trial' ---
    // get current time
    t = trialClock.getTime();
    frameN = frameN + 1; // number of completed frames (so 0 is the first frame)
    // update/draw components on each frame
    // Run 'Each Frame' code from code
    // 1) rysujemy całą siatkę
    for (let ix = 0; ix < lamp_grid.length; ix++) {
      for (let iy = 0; iy < lamp_grid[ix].length; iy++) {
        lamp_grid[ix][iy].draw();
      }
    }

    function pointInStim(px, py, stim) {
      let pos = stim.pos || stim._pos;
      let size = stim.size || stim._size || [0.08, 0.08];
      if (!pos || typeof pos[0] !== "number" || typeof pos[1] !== "number")
        return false;
      let hx = (Array.isArray(size) ? size[0] : size) / 2;
      let hy = (Array.isArray(size) ? size[1] : size) / 2;
      return Math.abs(px - pos[0]) <= hx && Math.abs(py - pos[1]) <= hy;
    }

    // 2) obsługa kliku (mysz) – pomijamy niewidoczne rogi (opacity 0)
    let buttons = mouse.getPressed();
    // Aktualizacja flagi: przycisk musi zostać puszczony przed akceptacją nowego kliku
    if (!buttons[0] && !buttons[1] && !buttons[2]) {
      mouseWasReleased = true;
    }
    if (
      mouseWasReleased &&
      (buttons[0] || buttons[1] || buttons[2]) &&
      show_feedback === false
    ) {
      for (let ix = 0; ix < lamp_grid.length; ix++) {
        for (let iy = 0; iy < lamp_grid[ix].length; iy++) {
          if (lamp_grid[ix][iy].opacity === 0) continue;
          if (mouse.isPressedIn(lamp_grid[ix][iy])) {
            clicked_x = ix;
            clicked_y = iy;
            rt = trialClock.getTime();
            correct = clicked_x === target_x && clicked_y === target_y ? 1 : 0;
            if (correct === 1) {
              lamp_grid[clicked_x][clicked_y].setImage(
                "resources/lampkaON.png",
              );
            }
            show_feedback = true;
            feedbackClock.reset();
            break;
          }
        }
        if (show_feedback === true) break;
      }
    }

    // 2b) obsługa dotyku (ekran dotykowy) – pomijamy niewidoczne rogi
    if (
      show_feedback === false &&
      window._touchJustStarted &&
      window._touchPsychoX != null &&
      window._touchCanvas
    ) {
      for (let ix = 0; ix < lamp_grid.length; ix++) {
        for (let iy = 0; iy < lamp_grid[ix].length; iy++) {
          if (lamp_grid[ix][iy].opacity === 0) continue;
          if (
            pointInStim(
              window._touchPsychoX,
              window._touchPsychoY,
              lamp_grid[ix][iy],
            )
          ) {
            clicked_x = ix;
            clicked_y = iy;
            rt = trialClock.getTime();
            correct = clicked_x === target_x && clicked_y === target_y ? 1 : 0;
            if (correct === 1) {
              lamp_grid[clicked_x][clicked_y].setImage(
                "resources/lampkaON.png",
              );
            }
            show_feedback = true;
            feedbackClock.reset();
            break;
          }
        }
        if (show_feedback === true) break;
      }
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    } else if (window._touchJustStarted) {
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    }

    // kończymy próbę po 0.5 s feedbacku
    if (show_feedback === true && feedbackClock.getTime() >= 0.5) {
      continueRoutine = false;
    }

    // limit 15s bez reakcji
    if (trialClock.getTime() >= 15.0 && clicked_x === null) {
      continueRoutine = false;
    }

    // *mouse* updates
    if (t >= 0.0 && mouse.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      mouse.tStart = t; // (not accounting for frame time here)
      mouse.frameNStart = frameN; // exact frame index

      mouse.status = PsychoJS.Status.STARTED;
      mouse.mouseClock.reset();
      prevButtonState = mouse.getPressed(); // if button is down already this ISN'T a new click
    }

    // if mouse is active this frame...
    if (mouse.status === PsychoJS.Status.STARTED) {
      _mouseButtons = mouse.getPressed();
      if (!_mouseButtons.every((e, i) => e == prevButtonState[i])) {
        // button state changed?
        prevButtonState = _mouseButtons;
        if (_mouseButtons.reduce((e, acc) => e + acc) > 0) {
          // state changed to a new click
          _mouseXYs = mouse.getPos();
          mouse.x.push(_mouseXYs[0]);
          mouse.y.push(_mouseXYs[1]);
          mouse.leftButton.push(_mouseButtons[0]);
          mouse.midButton.push(_mouseButtons[1]);
          mouse.rightButton.push(_mouseButtons[2]);
          mouse.time.push(mouse.mouseClock.getTime());
          if (gotValidClick === true) {
            // end routine on response
            continueRoutine = false;
          }
        }
      }
    }
    // check for quit (typically the Esc key)
    if (
      psychoJS.experiment.experimentEnded ||
      psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0
    ) {
      return quitPsychoJS("The [Escape] key was pressed. Goodbye!", true);
    }

    // check if the Routine should terminate
    if (!continueRoutine) {
      // a component has requested a forced-end of Routine
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false; // reverts to True if at least one component still running
    for (const thisComponent of trialComponents)
      if (
        "status" in thisComponent &&
        thisComponent.status !== PsychoJS.Status.FINISHED
      ) {
        continueRoutine = true;
        break;
      }

    // refresh the screen if continuing
    if (continueRoutine) {
      return Scheduler.Event.FLIP_REPEAT;
    } else {
      return Scheduler.Event.NEXT;
    }
  };
}

function trialRoutineEnd(snapshot) {
  return async function () {
    //--- Ending Routine 'trial' ---
    for (const thisComponent of trialComponents) {
      if (typeof thisComponent.setAutoDraw === "function") {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData("trial.stopped", globalClock.getTime());
    // Run 'End Routine' code from code
    psychoJS.experiment.addData("x_edge", x_edge);
    psychoJS.experiment.addData("y_edge", y_edge);
    psychoJS.experiment.addData("x_index", x_index);
    psychoJS.experiment.addData("y_index", y_index);
    psychoJS.experiment.addData("target_x", target_x);
    psychoJS.experiment.addData("target_y", target_y);
    psychoJS.experiment.addData("clicked_x", clicked_x);
    psychoJS.experiment.addData("clicked_y", clicked_y);
    psychoJS.experiment.addData("rt", rt);
    psychoJS.experiment.addData("correct", correct);

    // store data for psychoJS.experiment (ExperimentHandler)
    psychoJS.experiment.addData("mouse.x", mouse.x);
    psychoJS.experiment.addData("mouse.y", mouse.y);
    psychoJS.experiment.addData("mouse.leftButton", mouse.leftButton);
    psychoJS.experiment.addData("mouse.midButton", mouse.midButton);
    psychoJS.experiment.addData("mouse.rightButton", mouse.rightButton);
    psychoJS.experiment.addData("mouse.time", mouse.time);

    // the Routine "trial" was not non-slip safe, so reset the non-slip timer
    routineTimer.reset();

    // Routines running outside a loop should always advance the datafile row
    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  };
}

function importConditions(currentLoop) {
  return async function () {
    psychoJS.importAttributes(currentLoop.getCurrentTrial());
    return Scheduler.Event.NEXT;
  };
}

async function quitPsychoJS(message, isCompleted) {
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }
  if (typeof window.electronTest !== "undefined") {
    if (isCompleted) {
      let allData = (psychoJS.experiment._trialsData || []).filter(
        function (t) {
          return typeof t.correct !== "undefined";
        },
      );
      let poprawneTrafienia = 0;
      let iloscKlikniecOgolem = 0;
      let noAnserw = 0;

      let sumRT = 0;
      let validRTCount = 0;
      for (let trial of allData) {
        if (trial.clicked_x != null && trial.clicked_y != null) {
          iloscKlikniecOgolem++;
          if (trial.correct === 1) poprawneTrafienia++;
          if (typeof trial.rt === "number" && trial.rt >= 0) {
            sumRT += trial.rt;
            validRTCount++;
          }
        } else {
          noAnserw++;
        }
      }
      let sredniCzasReakcji =
        validRTCount > 0 ? Math.round((sumRT / validRTCount) * 1000) : 0;
      let bledneKlikniecia = Math.max(
        0,
        iloscKlikniecOgolem - poprawneTrafienia,
      ); // błędne kliknięcia (bez braków)
      let bledneTrafienia = bledneKlikniecia + noAnserw; // suma: błędne + braki
      let totalTrials = iloscKlikniecOgolem + noAnserw;
      let accuracy =
        totalTrials > 0
          ? Math.round((poprawneTrafienia / totalTrials) * 100)
          : 0;

      // Konwertuj rt w surowych danych z sekund na milisekundy
      let wyniki = allData.map((trial) => ({
        ...trial,
        rt: typeof trial.rt === "number" ? Math.round(trial.rt * 1000) : null,
      }));

      window.electronTest.sendResults({
        testId: expInfo["expName"] || "semafor",
        subjectId: expInfo["participant"],
        timestamp: new Date().toISOString(),
        ilosc_poprawnych_nacisniec: poprawneTrafienia,
        ilosc_blednych_nacisniec: bledneTrafienia, // suma: błędne kliknięcia + braki
        ilosc_blednych_klikniec: bledneKlikniecia, // tylko błędne kliknięcia
        ogolna_ilosc_nacisniec: iloscKlikniecOgolem,
        ilosc_brakow_nacisniec: noAnserw, // tylko braki odpowiedzi
        sredni_czas_reakcji: sredniCzasReakcji,
        score: `Kliknięć: ${iloscKlikniecOgolem} | Poprawne: ${poprawneTrafienia} | Błędne (w tym brak odp.): ${bledneTrafienia} | Brak odp.: ${noAnserw} | Skuteczność: ${accuracy}% | Śr. RT: ${sredniCzasReakcji} ms`,
        statystyki: {
          poprawne: poprawneTrafienia,
          bledne_lacznie: bledneTrafienia,
          bledne_klikniecia: bledneKlikniecia,
          brak_odpowiedzi: noAnserw,
          wszystkie_kliki: iloscKlikniecOgolem,
          proby: allData.length,
          skutecznosc_proc: accuracy,
        },
        wyniki: wyniki,
      });
    } else {
      window.electronTest.close();
    }
  }
  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });
  return Scheduler.Event.QUIT;
}
