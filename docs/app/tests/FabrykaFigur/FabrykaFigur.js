/*****************
 * FabrykaFigur *
 *****************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;

// ================= SESSION INFO =================
let expName = 'FabrykaFigur';
let expInfo = {
  'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  'session': '001',
};

// ================= PSYCHOJS INIT =================
const psychoJS = new PsychoJS({ debug: true });

psychoJS.openWindow({
  fullscr: true,
  color: new util.Color([0, 0, 0]),
  units: 'height',
  waitBlanking: true,
  backgroundImage: '',
  backgroundFit: 'none',
});

psychoJS.schedule(psychoJS.gui.DlgFromDict({
  dictionary: expInfo,
  title: expName
}));

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(function () { return (psychoJS.gui.dialogComponent.button === 'OK'); }, flowScheduler, dialogCancelScheduler);

// ================= FLOW =================
flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(welcomeRoutineBegin());
flowScheduler.add(welcomeRoutineEachFrame());
flowScheduler.add(welcomeRoutineEnd());
flowScheduler.add(difficultyRoutineBegin());
flowScheduler.add(difficultyRoutineEachFrame());
flowScheduler.add(difficultyRoutineEnd());
flowScheduler.add(durationRoutineBegin());
flowScheduler.add(durationRoutineEachFrame());
flowScheduler.add(durationRoutineEnd());
flowScheduler.add(trialsRoutineBegin());
flowScheduler.add(trialsRoutineEachFrame());
flowScheduler.add(trialsRoutineEnd());
flowScheduler.add(quitPsychoJS, 'Thank you for your patience.', true);

dialogCancelScheduler.add(quitPsychoJS, 'Thank you for your patience.', false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: [
    { 'name': 'resources/gwBLA.png', 'path': 'resources/gwBLA.png' },
    { 'name': 'resources/gwBLU.png', 'path': 'resources/gwBLU.png' },
    { 'name': 'resources/gwGRE.png', 'path': 'resources/gwGRE.png' },
    { 'name': 'resources/gwRED.png', 'path': 'resources/gwRED.png' },
    { 'name': 'resources/gwYEL.png', 'path': 'resources/gwYEL.png' },
    { 'name': 'resources/koBLA.png', 'path': 'resources/koBLA.png' },
    { 'name': 'resources/koBLU.png', 'path': 'resources/koBLU.png' },
    { 'name': 'resources/koGRE.png', 'path': 'resources/koGRE.png' },
    { 'name': 'resources/koRED.png', 'path': 'resources/koRED.png' },
    { 'name': 'resources/koYEL.png', 'path': 'resources/koYEL.png' },
    { 'name': 'resources/kwBLA.png', 'path': 'resources/kwBLA.png' },
    { 'name': 'resources/kwBLU.png', 'path': 'resources/kwBLU.png' },
    { 'name': 'resources/kwGRE.png', 'path': 'resources/kwGRE.png' },
    { 'name': 'resources/kwRED.png', 'path': 'resources/kwRED.png' },
    { 'name': 'resources/kwYEL.png', 'path': 'resources/kwYEL.png' },
    { 'name': 'resources/pkBLA.png', 'path': 'resources/pkBLA.png' },
    { 'name': 'resources/pkBLU.png', 'path': 'resources/pkBLU.png' },
    { 'name': 'resources/pkGRE.png', 'path': 'resources/pkGRE.png' },
    { 'name': 'resources/pkRED.png', 'path': 'resources/pkRED.png' },
    { 'name': 'resources/pkYEL.png', 'path': 'resources/pkYEL.png' },
    { 'name': 'resources/trBLA.png', 'path': 'resources/trBLA.png' },
    { 'name': 'resources/trBLU.png', 'path': 'resources/trBLU.png' },
    { 'name': 'resources/trGRE.png', 'path': 'resources/trGRE.png' },
    { 'name': 'resources/trRED.png', 'path': 'resources/trRED.png' },
    { 'name': 'resources/trYEL.png', 'path': 'resources/trYEL.png' },
  ]
});

psychoJS.experimentLogger.setLevel(core.Logger.ServerLevel.INFO);

// ================= CONSTANTS & CONFIG =================
const IMAGE_PATH = 'resources/';
const ALL_SHAPES = ['kw', 'ko', 'tr', 'gw', 'pk'];
const ALL_COLORS = ['RED', 'BLU', 'GRE', 'YEL', 'BLA'];
const BASE_SPEED = 0.25;

const DIFFICULTY_CONFIG = {
  easy: { label: 'Łatwy', shapes: 3, colors: 3, speedMult: 1.0 },
  medium: { label: 'Średni', shapes: 4, colors: 4, speedMult: 1.2 },
  hard: { label: 'Trudny', shapes: 5, colors: 5, speedMult: 1.35 },
};

const DURATION_OPTIONS = [40, 180, 300];
const TARGET_CHANGE_INTERVAL = 20; // seconds
const TARGET_RATIO = 0.4; // 40% minimum good figures
const N_TARGETS = 2;

// Layout
const N_PER_ROW = 6;
const SIZE_TOP = 0.22;
const SIZE_BOTTOM = 0.14;
const TOP_Y = 0.32;
const ROW1_Y = -0.10;
const ROW2_Y = -0.30;
const GAP = 0.07;

// ================= HELPERS =================
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function safeSample(arr, n) {
  let a = arr.slice();
  let out = [];
  while (out.length < n && a.length) {
    let idx = Math.floor(Math.random() * a.length);
    out.push(a.splice(idx, 1)[0]);
  }
  return out;
}

function buildPool(nShapes, nColors) {
  let pool = [];
  for (let s = 0; s < nShapes; s++) {
    for (let c = 0; c < nColors; c++) {
      pool.push(ALL_SHAPES[s] + ALL_COLORS[c] + '.png');
    }
  }
  return pool;
}

/** Build a sequence of `n` items with at least TARGET_RATIO of them being targets */
function makeSequenceWithTargetRatio(pool, targets, n) {
  let seq = [];
  let batchSize = 10;
  while (seq.length < n) {
    let batch = [];
    let targetCount = Math.ceil(batchSize * TARGET_RATIO); // 4 out of 10
    let randomCount = batchSize - targetCount;
    for (let i = 0; i < targetCount; i++) {
      batch.push(targets[Math.floor(Math.random() * targets.length)]);
    }
    for (let i = 0; i < randomCount; i++) {
      batch.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    shuffle(batch);
    seq = seq.concat(batch);
  }
  return seq.slice(0, n);
}

function getStimImageName(stim) {
  try {
    let img = stim.image;
    if (typeof img === 'string') return img.split('/').pop().split('\\').pop();
    if (img && typeof img.name === 'string') return img.name;
    return String(img).split('/').pop().split('\\').pop();
  } catch (e) {
    return '';
  }
}

// ================= GLOBAL STATE =================
var currentLoop;
var frameDur;
var t, frameN, continueRoutine, routineForceEnded;

// Chosen settings
var chosenDifficulty = null;  // 'easy', 'medium', 'hard'
var chosenDuration = null;    // 40, 120, 300
var activePool = [];
var activeSpeed = BASE_SPEED;

// Game state
var targets = [];
var bottom_sequence = [];
var top_stims = [];
var bottom_stims = [];
var prev_x = [];
var total_presses = 0;
var target_presses = 0;
var missed_targets = 0;
var target_appearances = 0;
var clicked_records = [];
var last_change_time = 0;
var target_change_flash_time = -1; // for visual flash on target change
var gamePhase = 'RUNNING'; // 'RUNNING' | 'DRAINING'
var drainedCount = 0;
var drainMode = 'CHANGE'; // 'CHANGE' | 'END'

// Clocks / components
var trialsClock, trialClock, frameClock;
var mouse, globalClock, routineTimer;
var correctCounter;
var highlightRect = null; // flash rectangle for target change
var welcomeClock, difficultyClock, durationClock;

// ================= UPDATE INFO =================
async function updateInfo() {
  currentLoop = psychoJS.experiment;
  expInfo['date'] = util.MonotonicClock.getDateStr();
  expInfo['expName'] = expName;
  expInfo['psychopyVersion'] = '2025.1.1';
  expInfo['OS'] = window.navigator.platform;

  expInfo['frameRate'] = psychoJS.window.getActualFrameRate();
  if (typeof expInfo['frameRate'] !== 'undefined')
    frameDur = 1.0 / Math.round(expInfo['frameRate']);
  else
    frameDur = 1.0 / 60.0;

  util.addInfoFromUrl(expInfo);

  psychoJS.experiment.dataFileName = (("." + "/") + `data/${expInfo["participant"]}_${expName}_${expInfo["date"]}`);
  psychoJS.experiment.field_separator = '\t';

  return Scheduler.Event.NEXT;
}

// ================= EXPERIMENT INIT =================
async function experimentInit() {
  // Nous integration
  if (typeof window.electronTest !== 'undefined') {
    console.log("Nous Launcher wykryty. Blokowanie zapisu CSV.");
    psychoJS.experiment.save = function () { return Promise.resolve(); };
  }

  welcomeClock = new util.Clock();
  difficultyClock = new util.Clock();
  durationClock = new util.Clock();
  trialsClock = new util.Clock();

  mouse = new core.Mouse({ win: psychoJS.window });
  mouse.mouseClock = new util.Clock();

  globalClock = new util.Clock();
  routineTimer = new util.CountdownTimer();

  // --- TOUCH SUPPORT ---
  window._touchJustStarted = false;
  window._touchPsychoX = null;
  window._touchPsychoY = null;
  window._touchCanvas = null;
  let canvas = (psychoJS.window._renderer && psychoJS.window._renderer.view) || document.querySelector('canvas');
  if (canvas) {
    window._touchCanvas = canvas;
    function touchToPsycho(clientX, clientY) {
      let r = canvas.getBoundingClientRect();
      let aspect = r.width / r.height;
      return {
        x: (2 * (clientX - r.left) / r.width - 1) * aspect,
        y: 1 - 2 * (clientY - r.top) / r.height
      };
    }
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (e.touches.length > 0) {
        let p = touchToPsycho(e.touches[0].clientX, e.touches[0].clientY);
        window._touchJustStarted = true;
        window._touchPsychoX = p.x;
        window._touchPsychoY = p.y;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  return Scheduler.Event.NEXT;
}

// ================= WELCOME ROUTINE =================
var welcomeText, welcomeKeys;

function welcomeRoutineBegin() {
  return async function () {
    t = 0; frameN = -1; continueRoutine = true;
    routineForceEnded = false;
    welcomeClock.reset();

    welcomeText = new visual.TextStim({
      win: psychoJS.window,
      text: 'Za chwilę na ekranie zobaczysz serię różnych figur. Za pomocą MYSZY, klikaj na te figury, których kształt i kolor odpowiada wzorcowi przedstawionemu u góry ekranu. Wzorzec, co jakiś czas będzie się zmieniał. Zawsze należy klikać na te figury, których kształt i kolor odpowiada aktualnemu wzorcowi. Staraj się reagować najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
      font: 'Arial',
      pos: [0, 0], height: 0.045, wrapWidth: 1.6,
      color: new util.Color('white'),
    });
    welcomeText.setAutoDraw(true);

    welcomeKeys = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    return Scheduler.Event.NEXT;
  };
}

function welcomeRoutineEachFrame() {
  return async function () {
    t = welcomeClock.getTime();
    frameN++;

    if (t >= 0.0 && welcomeKeys.status === PsychoJS.Status.NOT_STARTED) {
      welcomeKeys.start();
      welcomeKeys.clearEvents();
    }

    if (welcomeKeys.status === PsychoJS.Status.STARTED) {
      let keys = welcomeKeys.getKeys({ keyList: ['space'], waitRelease: false });
      if (keys.length > 0) {
        continueRoutine = false;
      }
    }

    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    return Scheduler.Event.FLIP_REPEAT;
  };
}

function welcomeRoutineEnd() {
  return async function () {
    welcomeKeys.stop();
    welcomeText.setAutoDraw(false);
    return Scheduler.Event.NEXT;
  };
}

// ================= DIFFICULTY SELECTION ROUTINE =================
var difficultyText, difficultyKeys;

function difficultyRoutineBegin() {
  return async function () {
    t = 0; frameN = -1; continueRoutine = true;
    routineForceEnded = false;
    difficultyClock.reset();

    difficultyText = new visual.TextStim({
      win: psychoJS.window,
      text: 'Wybierz poziom trudności:\n\n'
        + '1 – Łatwy (3 figury, 3 kolory)\n'
        + '2 – Średni (4 figury, 4 kolory, +20% prędkości)\n'
        + '3 – Trudny (5 figur, 5 kolorów, +35% prędkości)\n\n'
        + 'Naciśnij 1, 2 lub 3.',
      font: 'Arial',
      pos: [0, 0], height: 0.045, wrapWidth: 1.6,
      color: new util.Color('white'),
    });
    difficultyText.setAutoDraw(true);

    difficultyKeys = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    return Scheduler.Event.NEXT;
  };
}

function difficultyRoutineEachFrame() {
  return async function () {
    t = difficultyClock.getTime();
    frameN++;

    if (t >= 0.0 && difficultyKeys.status === PsychoJS.Status.NOT_STARTED) {
      difficultyKeys.start();
      difficultyKeys.clearEvents();
    }

    if (difficultyKeys.status === PsychoJS.Status.STARTED) {
      let keys = difficultyKeys.getKeys({ keyList: ['1', '2', '3', 'num_1', 'num_2', 'num_3'], waitRelease: false });
      if (keys.length > 0) {
        let k = keys[keys.length - 1].name;
        if (k === '1' || k === 'num_1') chosenDifficulty = 'easy';
        else if (k === '2' || k === 'num_2') chosenDifficulty = 'medium';
        else if (k === '3' || k === 'num_3') chosenDifficulty = 'hard';
        continueRoutine = false;
      }
    }

    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    return Scheduler.Event.FLIP_REPEAT;
  };
}

function difficultyRoutineEnd() {
  return async function () {
    difficultyKeys.stop();
    difficultyText.setAutoDraw(false);

    // Apply difficulty config
    let cfg = DIFFICULTY_CONFIG[chosenDifficulty];
    activePool = buildPool(cfg.shapes, cfg.colors);
    activeSpeed = BASE_SPEED * cfg.speedMult;

    psychoJS.experiment.addData('difficulty', chosenDifficulty);
    psychoJS.experiment.addData('difficulty_label', cfg.label);

    return Scheduler.Event.NEXT;
  };
}

// ================= DURATION SELECTION ROUTINE =================
var durationText, durationKeys;

function durationRoutineBegin() {
  return async function () {
    t = 0; frameN = -1; continueRoutine = true;
    routineForceEnded = false;
    durationClock.reset();

    durationText = new visual.TextStim({
      win: psychoJS.window,
      text: 'Wybierz czas trwania testu:\n\n'
        + '1 – 40 sekund\n'
        + '2 – 180 sekund\n'
        + '3 – 300 sekund\n\n'
        + 'Naciśnij 1, 2 lub 3.',
      font: 'Arial',
      pos: [0, 0], height: 0.045, wrapWidth: 1.6,
      color: new util.Color('white'),
    });
    durationText.setAutoDraw(true);

    durationKeys = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    return Scheduler.Event.NEXT;
  };
}

function durationRoutineEachFrame() {
  return async function () {
    t = durationClock.getTime();
    frameN++;

    if (t >= 0.0 && durationKeys.status === PsychoJS.Status.NOT_STARTED) {
      durationKeys.start();
      durationKeys.clearEvents();
    }

    if (durationKeys.status === PsychoJS.Status.STARTED) {
      let keys = durationKeys.getKeys({ keyList: ['1', '2', '3', 'num_1', 'num_2', 'num_3'], waitRelease: false });
      if (keys.length > 0) {
        let k = keys[keys.length - 1].name;
        if (k === '1' || k === 'num_1') chosenDuration = DURATION_OPTIONS[0];
        else if (k === '2' || k === 'num_2') chosenDuration = DURATION_OPTIONS[1];
        else if (k === '3' || k === 'num_3') chosenDuration = DURATION_OPTIONS[2];
        continueRoutine = false;
      }
    }

    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    return Scheduler.Event.FLIP_REPEAT;
  };
}

function durationRoutineEnd() {
  return async function () {
    durationKeys.stop();
    durationText.setAutoDraw(false);
    psychoJS.experiment.addData('chosen_duration', chosenDuration);
    return Scheduler.Event.NEXT;
  };
}

// ================= TRIAL ROUTINE =================
var _prevMouseButtons;
var trialsComponents;

function trialsRoutineBegin() {
  return async function () {
    t = 0; frameN = -1; continueRoutine = true;
    routineForceEnded = false;
    trialsClock.reset();
    routineTimer.reset();

    // Clocks
    trialClock = new util.Clock();
    frameClock = new util.Clock();

    // Reset counters
    total_presses = 0;
    target_presses = 0;
    target_appearances = 0;
    missed_targets = 0;
    clicked_records = [];
    last_change_time = 0;
    target_change_flash_time = -1;
    gamePhase = 'RUNNING';
    drainedCount = 0;
    drainMode = 'CHANGE';
    _prevMouseButtons = [false, false, false];

    // Layout calculations
    let X_STEP = SIZE_BOTTOM + GAP;
    let X_START = -((N_PER_ROW - 1) / 2) * X_STEP;
    let WRAP_DISTANCE = N_PER_ROW * X_STEP;

    // Store layout for use in EachFrame
    window._X_STEP = X_STEP;
    window._X_START = X_START;
    window._WRAP_DISTANCE = WRAP_DISTANCE;
    window._APPEAR_X = -0.7; // count appearance when figure enters visible area

    // Pick initial targets from active pool
    targets = safeSample(activePool, N_TARGETS);

    // Top stims (targets display)
    top_stims = [];
    for (let i = 0; i < N_TARGETS; i++) {
      let xPos = (i === 0) ? -0.25 : 0.25;
      let stim = new visual.ImageStim({
        win: psychoJS.window,
        image: IMAGE_PATH + targets[i],
        pos: [xPos, TOP_Y],
        size: [SIZE_TOP, SIZE_TOP],
        units: 'height'
      });
      stim.imgName = targets[i];
      top_stims.push(stim);
    }

    // Build initial sequence with 40% target guarantee
    let items_per_sec = activeSpeed / X_STEP;
    let items_needed = Math.ceil(items_per_sec * (chosenDuration + 10)) + (N_PER_ROW * 2);
    bottom_sequence = makeSequenceWithTargetRatio(activePool, targets, items_needed);

    // Bottom stims (scrolling figures)
    bottom_stims = [];
    prev_x = [];
    for (let idx = 0; idx < N_PER_ROW * 2; idx++) {
      let col = idx % N_PER_ROW;
      let row = Math.floor(idx / N_PER_ROW);
      let standardX = X_START + (col * X_STEP);
      let x = standardX - 1.8; // start off-screen left
      let y = (row === 0) ? ROW1_Y : ROW2_Y;

      let imgFile = bottom_sequence.shift();
      let cleanName = imgFile.split('/').pop().split('\\').pop();

      let stim = new visual.ImageStim({
        win: psychoJS.window,
        image: IMAGE_PATH + imgFile,
        pos: [x, y],
        size: [SIZE_BOTTOM, SIZE_BOTTOM],
        units: 'height'
      });
      stim.imgName = cleanName;
      stim.clicked = false;
      stim.counted = false;
      stim.drained = false;
      stim.setOpacity(1.0);

      bottom_stims.push(stim);
      prev_x.push(x);
    }

    // Counter text
    correctCounter = new visual.TextStim({
      win: psychoJS.window,
      text: 'Poprawne: 0',
      pos: [0.6, 0.45],
      height: 0.035,
      color: new util.Color('white'),
      units: 'height'
    });

    // Highlight rectangle for target change flash
    highlightRect = new visual.Rect({
      win: psychoJS.window,
      width: 1.2, height: SIZE_TOP + 0.08,
      pos: [0, TOP_Y],
      lineColor: new util.Color('yellow'),
      lineWidth: 4,
      fillColor: null,
      opacity: 0.0,
      units: 'height'
    });

    // Mouse setup
    mouse.x = [];
    mouse.y = [];
    mouse.leftButton = [];
    mouse.midButton = [];
    mouse.rightButton = [];
    mouse.time = [];

    psychoJS.experiment.addData('trials.started', globalClock.getTime());

    trialsComponents = [mouse];
    for (const thisComponent of trialsComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;

    return Scheduler.Event.NEXT;
  };
}

function pointInStim(px, py, stim) {
  let pos = stim.pos || stim._pos;
  let size = stim.size || stim._size || [SIZE_BOTTOM, SIZE_BOTTOM];
  if (!pos || (typeof pos[0] !== 'number') || (typeof pos[1] !== 'number')) return false;
  let hx = (Array.isArray(size) ? size[0] : size) / 2;
  let hy = (Array.isArray(size) ? size[1] : size) / 2;
  return Math.abs(px - pos[0]) <= hx && Math.abs(py - pos[1]) <= hy;
}

function trialsRoutineEachFrame() {
  return async function () {
    t = trialsClock.getTime();
    frameN++;

    let dt = 1.0 / 60.0;
    if (frameClock) {
      dt = frameClock.getTime();
      frameClock.reset();
    }
    if (dt <= 0 || dt > 0.5) dt = 1.0 / 60.0;

    let elapsed = trialClock.getTime();

    // --- HANDLE CLICKS (mouse) ---
    let buttons = mouse.getPressed();
    let isNewClick = buttons[0] && !_prevMouseButtons[0];
    _prevMouseButtons = [buttons[0], buttons[1], buttons[2]];

    if (isNewClick) {
      _handleClick(mouse.getPos(), elapsed);
    }

    // --- HANDLE TOUCH ---
    if (window._touchJustStarted && window._touchPsychoX != null && window._touchCanvas) {
      _handleClick([window._touchPsychoX, window._touchPsychoY], elapsed);
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    } else if (window._touchJustStarted) {
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    }

    // --- MOVE BOTTOM FIGURES ---
    for (let i = 0; i < bottom_stims.length; i++) {
      let stim = bottom_stims[i];
      let newX = stim.pos[0] + (activeSpeed * dt);

      if (prev_x[i] < window._APPEAR_X && newX >= window._APPEAR_X && !stim.counted) {
        if (targets.includes(stim.imgName)) {
          target_appearances++;
        }
        stim.counted = true;
      }

      if (newX > (window._X_START + window._WRAP_DISTANCE)) {
        // Track missed targets (only if not already drained)
        if (!stim.drained && !stim.clicked && stim.counted && targets.includes(stim.imgName)) {
          missed_targets++;
        }

        if (gamePhase === 'DRAINING') {
          if (!stim.drained) {
            stim.setOpacity(0.0);
            stim.imgName = '__blank__';
            stim.clicked = true;
            stim.counted = true;
            stim.drained = true;
            drainedCount++;
          }
          // Park far off-screen so it won't re-wrap during drain
          newX = -10.0;
        } else {
          newX -= window._WRAP_DISTANCE;

          let nextImg = bottom_sequence.length > 0
            ? bottom_sequence.shift()
            : activePool[Math.floor(Math.random() * activePool.length)];

          let cleanName = nextImg.split('/').pop().split('\\').pop();

          stim.setImage(IMAGE_PATH + nextImg);
          stim.imgName = cleanName;
          stim.clicked = false;
          stim.counted = false;
          stim.drained = false;
          stim.setOpacity(1.0);
        }
      }

      stim.setPos([newX, stim.pos[1]]);
      prev_x[i] = newX;

      if (stim.opacity > 0) {
        stim.draw();
      }
    }

    // --- CHECK DRAIN COMPLETION ---
    if (gamePhase === 'DRAINING' && drainedCount >= bottom_stims.length) {
      if (drainMode === 'END') {
        // Test ends cleanly after screen is empty
        continueRoutine = false;
      } else {
        // All figures drained – now change targets
        targets = safeSample(activePool, N_TARGETS);
        for (let j = 0; j < top_stims.length; j++) {
          top_stims[j].setImage(IMAGE_PATH + targets[j]);
          top_stims[j].imgName = targets[j];
        }
        target_change_flash_time = elapsed;
        last_change_time = elapsed;

        // Rebuild sequence for remaining duration
        let remaining = Math.max(chosenDuration - elapsed + 10, 60);
        bottom_sequence = makeSequenceWithTargetRatio(
          activePool, targets,
          Math.ceil(activeSpeed / window._X_STEP * remaining) + N_PER_ROW * 2
        );

        // Re-spawn all stims from off-screen left
        for (let i = 0; i < bottom_stims.length; i++) {
          let col = i % N_PER_ROW;
          let row = Math.floor(i / N_PER_ROW);
          let standardX = window._X_START + (col * window._X_STEP);
          let spawnX = standardX - 1.8;
          let y = (row === 0) ? ROW1_Y : ROW2_Y;
          let nextImg = bottom_sequence.shift();
          let cleanName = nextImg.split('/').pop().split('\\').pop();
          bottom_stims[i].setImage(IMAGE_PATH + nextImg);
          bottom_stims[i].imgName = cleanName;
          bottom_stims[i].clicked = false;
          bottom_stims[i].counted = false;
          bottom_stims[i].drained = false;
          bottom_stims[i].setOpacity(1.0);
          bottom_stims[i].setPos([spawnX, y]);
          prev_x[i] = spawnX;
        }

        drainedCount = 0;
        gamePhase = 'RUNNING';
      }
    }

    // Draw top stims and counter
    for (let topStim of top_stims) topStim.draw();
    correctCounter.draw();

    // Draw target change flash (yellow border around targets for 1.5s)
    if (target_change_flash_time >= 0 && (elapsed - target_change_flash_time) < 1.5) {
      let flashOpacity = 1.0 - ((elapsed - target_change_flash_time) / 1.5);
      highlightRect.setOpacity(Math.max(0, flashOpacity));
      highlightRect.draw();
    } else if (highlightRect) {
      highlightRect.setOpacity(0.0);
    }

    // --- ENTER DRAINING when target change time arrives ---
    if (gamePhase === 'RUNNING' && elapsed - last_change_time >= TARGET_CHANGE_INTERVAL && elapsed > 1) {
      gamePhase = 'DRAINING';
      drainMode = 'CHANGE';
      drainedCount = 0;
      for (let stim of bottom_stims) {
        stim.drained = false;
      }
      bottom_sequence = []; // clear – nothing new spawns during drain
    }

    // Replenish sequence if running low (only during RUNNING phase)
    if (gamePhase === 'RUNNING' && bottom_sequence.length < 30) {
      bottom_sequence = bottom_sequence.concat(
        makeSequenceWithTargetRatio(activePool, targets, 40)
      );
    }

    // --- END TRIAL after chosen duration – drain first ---
    if (elapsed >= chosenDuration && gamePhase === 'RUNNING') {
      gamePhase = 'DRAINING';
      drainMode = 'END';
      drainedCount = 0;
      for (let stim of bottom_stims) {
        stim.drained = false;
      }
      bottom_sequence = [];
    }

    // *mouse* updates (PsychoJS boilerplate)
    if (t >= 0.0 && mouse.status === PsychoJS.Status.NOT_STARTED) {
      mouse.tStart = t;
      mouse.frameNStart = frameN;
      mouse.status = PsychoJS.Status.STARTED;
      mouse.mouseClock.reset();
    }

    // ESC check
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;
    for (const thisComponent of trialsComponents)
      if ('status' in thisComponent && thisComponent.status !== PsychoJS.Status.FINISHED) {
        continueRoutine = true;
        break;
      }

    if (continueRoutine) {
      return Scheduler.Event.FLIP_REPEAT;
    } else {
      return Scheduler.Event.NEXT;
    }
  };
}

/** Handle a click/touch at given position */
function _handleClick(clickPos, elapsed) {
  total_presses++;
  let hitBoxSize = SIZE_BOTTOM * 1.3;
  let candidates = [];

  for (let stim of bottom_stims) {
    if (stim.clicked) continue;
    let dx = Math.abs(clickPos[0] - stim.pos[0]);
    let dy = Math.abs(clickPos[1] - stim.pos[1]);
    if (dx < (hitBoxSize / 2) && dy < (hitBoxSize / 2)) {
      let distSq = dx * dx + dy * dy;
      candidates.push({ stim: stim, dist: distSq });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.dist - b.dist);
    let selectedStim = candidates[0].stim;
    let isCorrect = targets.includes(selectedStim.imgName) ? 1 : 0;

    if (isCorrect) {
      target_presses++;
      selectedStim.clicked = true;
      selectedStim.setOpacity(0.0);
    } else {
      selectedStim.clicked = true;
      selectedStim.setOpacity(0.2);
    }

    clicked_records.push({
      time: elapsed,
      stim_image: selectedStim.imgName,
      is_correct: isCorrect,
      x: clickPos[0],
      y: clickPos[1]
    });

    correctCounter.setText('Poprawne: ' + target_presses);
  }
}

function trialsRoutineEnd() {
  return async function () {
    for (const thisComponent of trialsComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }

    psychoJS.experiment.addData('trials.stopped', globalClock.getTime());
    psychoJS.experiment.addData('Total_Clicks', total_presses);
    psychoJS.experiment.addData('Correct_Clicks', target_presses);
    psychoJS.experiment.addData('Target_Appearances', target_appearances);

    for (let idx = 0; idx < clicked_records.length; idx++) {
      let rec = clicked_records[idx];
      psychoJS.experiment.addData('click_' + idx + '_time', rec.time !== undefined ? rec.time : -1);
      psychoJS.experiment.addData('click_' + idx + '_image', rec.stim_image !== undefined ? rec.stim_image : 'none');
      psychoJS.experiment.addData('click_' + idx + '_is_correct', rec.is_correct !== undefined ? rec.is_correct : 0);
      psychoJS.experiment.addData('click_' + idx + '_x', rec.x !== undefined ? rec.x : null);
      psychoJS.experiment.addData('click_' + idx + '_y', rec.y !== undefined ? rec.y : null);
    }

    routineTimer.reset();

    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry();
    }
    return Scheduler.Event.NEXT;
  };
}

// ================= IMPORT CONDITIONS =================
function importConditions(currentLoop) {
  return async function () {
    psychoJS.importAttributes(currentLoop.getCurrentTrial());
    return Scheduler.Event.NEXT;
  };
}

// ================= QUIT =================
async function quitPsychoJS(message, isCompleted) {
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }
  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted) {
      let poprawneTrafienia = target_presses || 0;
      let wszystkieKliki = total_presses || 0;
      let obiektyDoKlikniecia = target_appearances || 0;
      let pominiete = missed_targets || 0;
      let bledneTrafienia = Math.max(0, wszystkieKliki - poprawneTrafienia);

      let accuracy = wszystkieKliki > 0 ? Math.round((poprawneTrafienia / wszystkieKliki) * 100) : 0;
      let detectionRate = obiektyDoKlikniecia > 0 ? Math.round((poprawneTrafienia / obiektyDoKlikniecia) * 100) : 0;

      let diffLabel = chosenDifficulty ? DIFFICULTY_CONFIG[chosenDifficulty].label : 'nieznany';

      window.electronTest.sendResults({
        testId: expInfo['expName'] || 'FabrykaFigur',
        subjectId: expInfo['participant'],
        timestamp: new Date().toISOString(),

        ilosc_poprawnych_nacisniec: poprawneTrafienia,
        ilosc_blednych_nacisniec: bledneTrafienia,
        ogolna_ilosc_nacisniec: wszystkieKliki,
        ilosc_obiektow_do_klikniecia: obiektyDoKlikniecia,
        pominiete_cele: pominiete,

        poziom_trudnosci: diffLabel,
        czas_trwania: chosenDuration || 0,

        score: `Poziom: ${diffLabel} | Czas: ${chosenDuration || 0}s | Poprawne: ${poprawneTrafienia} | Błędne: ${bledneTrafienia} | Pominięte: ${pominiete} | Obiektów: ${obiektyDoKlikniecia} | Skuteczność: ${accuracy}%`,

        statystyki: {
          poprawne: poprawneTrafienia,
          bledne: bledneTrafienia,
          wszystkie_kliki: wszystkieKliki,
          obiekty_do_klikniecia: obiektyDoKlikniecia,
          pominiete_cele: pominiete,
          skutecznosc_klikniec: accuracy,
          skutecznosc_wykrywania: detectionRate,
          poziom_trudnosci: diffLabel,
          czas_trwania_sek: chosenDuration || 0,
        },

        wyniki_szczegolowe: clicked_records
      });
    } else {
      window.electronTest.close();
    }
  }
  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });
  return Scheduler.Event.QUIT;
}
