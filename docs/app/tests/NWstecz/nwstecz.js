/***************
 * NWstecz  *
 * N-Back    *
 ***************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;

// store info about the experiment session:
let expName = 'NWstecz';
let expInfo = {
  'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  'session': '001',
};
let PILOTING = util.getUrlParameters().has('__pilotToken');

// init psychoJS:
const psychoJS = new PsychoJS({
  debug: true
});

// open window:
psychoJS.openWindow({
  fullscr: true,
  color: new util.Color([0, 0, 0]),
  units: 'height',
  waitBlanking: true,
  backgroundImage: '',
  backgroundFit: 'none',
});

// schedule the experiment:
psychoJS.schedule(psychoJS.gui.DlgFromDict({
  dictionary: expInfo,
  title: expName
}));

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(function () { return (psychoJS.gui.dialogComponent.button === 'OK'); }, flowScheduler, dialogCancelScheduler);

// flowScheduler gets run if the participant presses OK
flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(instructionsRoutineBegin());
flowScheduler.add(instructionsRoutineEachFrame());
flowScheduler.add(instructionsRoutineEnd());
flowScheduler.add(nbackLevelRoutineBegin());
flowScheduler.add(nbackLevelRoutineEachFrame());
flowScheduler.add(nbackLevelRoutineEnd());
flowScheduler.add(difficultyRoutineBegin());
flowScheduler.add(difficultyRoutineEachFrame());
flowScheduler.add(difficultyRoutineEnd());
flowScheduler.add(initialSequenceRoutineBegin());
flowScheduler.add(initialSequenceRoutineEachFrame());
flowScheduler.add(initialSequenceRoutineEnd());
const trialsLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(trialsLoopBegin(trialsLoopScheduler));
flowScheduler.add(trialsLoopScheduler);
flowScheduler.add(trialsLoopEnd);
flowScheduler.add(quitPsychoJS, 'Dziękujemy za udział w teście.', true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, 'Dziękujemy za udział w teście.', false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: []
});

psychoJS.experimentLogger.setLevel(core.Logger.ServerLevel.INFO);

var currentLoop;
var frameDur;
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

// Component declarations
var instructionsClock;
var instrText;
var instrKey;
var nbackLevelClock;
var nbackLevelText;
var nbackLevelKey;
var difficultyClock;
var difficultyText;
var difficultyKey;
var initialSequenceClock;
var seqNumberStim;
var seqProgressStim;
var trialClock;
var questionStim;
var numberStim;
var key_resp;
var feedbackClock;
var feedbackStim;
var globalClock;
var routineTimer;

async function experimentInit() {
  // Initialize components for Routine "instructions"
  instructionsClock = new util.Clock();
    instrText = new visual.TextStim({
      win: psychoJS.window,
      name: 'instrText',
      text: 'W tym teście będziesz widzieć kolejne cyfry.\n\nPo wyświetleniu pierwszych 5 cyfr, Twoim zadaniem będzie ocenić, czy aktualna cyfra jest TAKA SAMA jak cyfra zapisana N miejsc wcześniej.\n\nNaciśnij TAK (Y) jeśli cyfra jest taka sama, NIE (N) jeśli jest inna.\nBrak reakcji oznacza automatycznie odpowiedź "Nie".\n\nNaciśnij SPACJĘ, aby kontynuować.',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.05, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });
  instrKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "nbackLevel"
  nbackLevelClock = new util.Clock();
  nbackLevelText = new visual.TextStim({
    win: psychoJS.window,
    name: 'nbackLevelText',
    text: 'Wybierz ile miejsc wstecz chcesz zapamiętywać:\n\n1 - 1 miejsce wstecz\n2 - 2 miejsca wstecz\n3 - 3 miejsca wstecz\n4 - 4 miejsca wstecz\n5 - 5 miejsc wstecz\n\nNaciśnij 1, 2, 3, 4 lub 5.',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.05, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });
  nbackLevelKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "difficulty"
  difficultyClock = new util.Clock();
  difficultyText = new visual.TextStim({
    win: psychoJS.window,
    name: 'difficultyText',
    text: 'Wybierz czas na odpowiedź:\n\n1 - ŁATWY (5 sekund)\n2 - NORMALNY (2 sekundy)\n3 - TRUDNY (1 sekunda)\n\nNaciśnij 1, 2 lub 3.',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.05, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });
  difficultyKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "initialSequence"
  initialSequenceClock = new util.Clock();
  seqNumberStim = new visual.TextStim({
    win: psychoJS.window,
    name: 'seqNumberStim',
    text: '',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.15, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });
  seqProgressStim = new visual.TextStim({
    win: psychoJS.window,
    name: 'seqProgressStim',
    text: '',
    font: 'Arial',
    units: undefined,
    pos: [0, -0.25], draggable: false, height: 0.03, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('grey'), opacity: undefined,
    depth: -1.0
  });

  // --- NOUS INTEGRATION: INIT ---
  if (typeof window.electronTest !== 'undefined') {
    console.log("Nous Launcher wykryty. Blokowanie zapisu CSV.");
    psychoJS.experiment.save = () => Promise.resolve();
  }

  // Global variables
  window.nbackLevel = 1;
  window.nbackLevelName = "1 wstecz";
  window.decisionTime = 2.0;
  window.difficultyName = "Normalny (2s)";
  window.sequence = [];
  window.currentNumber = "";
  window.currentIndex = 0;
  window.isMatch = false;
  window.totalCorrect = 0;
  window.targetCorrect = 50;
  window.testEnded = false;
  window.feedbackColor = "white";
  window.feedbackText = "...";

  console.log("Eksperyment zainicjowany.");

  // Initialize components for Routine "trial"
  trialClock = new util.Clock();
  questionStim = new visual.TextStim({
    win: psychoJS.window,
    name: 'questionStim',
    text: '',
    font: 'Arial',
    units: undefined,
    pos: [0, 0.15], draggable: false, height: 0.05, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });
  numberStim = new visual.TextStim({
    win: psychoJS.window,
    name: 'numberStim',
    text: '',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.15, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: -1.0
  });
  key_resp = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "feedback"
  feedbackClock = new util.Clock();
  feedbackStim = new visual.TextStim({
    win: psychoJS.window,
    name: 'feedbackStim',
    text: '',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.1, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });

  // Create some handy timers
  globalClock = new util.Clock();
  routineTimer = new util.CountdownTimer();

  return Scheduler.Event.NEXT;
}

// ==========================================
// INSTRUCTIONS ROUTINE
// ==========================================
var t;
var frameN;
var continueRoutine;
var routineForceEnded;
var instructionsMaxDurationReached;
var _instrKey_allKeys;
var instructionsMaxDuration;
var instructionsComponents;

function instructionsRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    instructionsClock.reset();
    routineTimer.reset();
    instructionsMaxDurationReached = false;
    instrKey.keys = undefined;
    instrKey.rt = undefined;
    _instrKey_allKeys = [];
    psychoJS.experiment.addData('instructions.started', globalClock.getTime());
    instructionsMaxDuration = null;
    instructionsComponents = [];
    instructionsComponents.push(instrText);
    instructionsComponents.push(instrKey);

    for (const thisComponent of instructionsComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}

function instructionsRoutineEachFrame() {
  return async function () {
    t = instructionsClock.getTime();
    frameN = frameN + 1;

    if (t >= 0.0 && instrText.status === PsychoJS.Status.NOT_STARTED) {
      instrText.tStart = t;
      instrText.frameNStart = frameN;
      instrText.setAutoDraw(true);
    }

    if (instrText.status === PsychoJS.Status.STARTED) {
    }

    if (t >= 0.0 && instrKey.status === PsychoJS.Status.NOT_STARTED) {
      instrKey.tStart = t;
      instrKey.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () { instrKey.clock.reset(); });
      psychoJS.window.callOnFlip(function () { instrKey.start(); });
      psychoJS.window.callOnFlip(function () { instrKey.clearEvents(); });
    }

    if (instrKey.status === PsychoJS.Status.STARTED) {
      let theseKeys = instrKey.getKeys({ keyList: 'space', waitRelease: false });
      _instrKey_allKeys = _instrKey_allKeys.concat(theseKeys);
      if (_instrKey_allKeys.length > 0) {
        instrKey.keys = _instrKey_allKeys[_instrKey_allKeys.length - 1].name;
        instrKey.rt = _instrKey_allKeys[_instrKey_allKeys.length - 1].rt;
        instrKey.duration = _instrKey_allKeys[_instrKey_allKeys.length - 1].duration;
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

    continueRoutine = false;
    for (const thisComponent of instructionsComponents)
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

function instructionsRoutineEnd(snapshot) {
  return async function () {
    for (const thisComponent of instructionsComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('instructions.stopped', globalClock.getTime());
    psychoJS.experiment.addData('instrKey.keys', instrKey.keys);
    if (typeof instrKey.keys !== 'undefined') {
      psychoJS.experiment.addData('instrKey.rt', instrKey.rt);
      psychoJS.experiment.addData('instrKey.duration', instrKey.duration);
      routineTimer.reset();
    }
    instrKey.stop();
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  }
}

// ==========================================
// N-BACK LEVEL ROUTINE
// ==========================================
var nbackLevelMaxDurationReached;
var _nbackLevelKey_allKeys;
var nbackLevelMaxDuration;
var nbackLevelComponents;

function nbackLevelRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    nbackLevelClock.reset();
    routineTimer.reset();
    nbackLevelMaxDurationReached = false;
    nbackLevelKey.keys = undefined;
    nbackLevelKey.rt = undefined;
    _nbackLevelKey_allKeys = [];
    psychoJS.experiment.addData('nbackLevel.started', globalClock.getTime());
    nbackLevelMaxDuration = null;
    nbackLevelComponents = [];
    nbackLevelComponents.push(nbackLevelText);
    nbackLevelComponents.push(nbackLevelKey);

    for (const thisComponent of nbackLevelComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}

function nbackLevelRoutineEachFrame() {
  return async function () {
    t = nbackLevelClock.getTime();
    frameN = frameN + 1;

    if (t >= 0.0 && nbackLevelText.status === PsychoJS.Status.NOT_STARTED) {
      nbackLevelText.tStart = t;
      nbackLevelText.frameNStart = frameN;
      nbackLevelText.setAutoDraw(true);
    }

    if (t >= 0.0 && nbackLevelKey.status === PsychoJS.Status.NOT_STARTED) {
      nbackLevelKey.tStart = t;
      nbackLevelKey.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () { nbackLevelKey.clock.reset(); });
      psychoJS.window.callOnFlip(function () { nbackLevelKey.start(); });
      psychoJS.window.callOnFlip(function () { nbackLevelKey.clearEvents(); });
    }

    if (nbackLevelKey.status === PsychoJS.Status.STARTED) {
      let theseKeys = nbackLevelKey.getKeys({ keyList: ['1', '2', '3', '4', '5'], waitRelease: false });
      _nbackLevelKey_allKeys = _nbackLevelKey_allKeys.concat(theseKeys);
      if (_nbackLevelKey_allKeys.length > 0) {
        nbackLevelKey.keys = _nbackLevelKey_allKeys[_nbackLevelKey_allKeys.length - 1].name;
        nbackLevelKey.rt = _nbackLevelKey_allKeys[_nbackLevelKey_allKeys.length - 1].rt;
        nbackLevelKey.duration = _nbackLevelKey_allKeys[_nbackLevelKey_allKeys.length - 1].duration;
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

    continueRoutine = false;
    for (const thisComponent of nbackLevelComponents)
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

function nbackLevelRoutineEnd(snapshot) {
  return async function () {
    for (const thisComponent of nbackLevelComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('nbackLevel.stopped', globalClock.getTime());
    nbackLevelKey.stop();

    let choice = '1';
    if (typeof nbackLevelKey !== 'undefined' && nbackLevelKey.keys) {
      if (Array.isArray(nbackLevelKey.keys)) {
        choice = nbackLevelKey.keys[0];
      } else {
        choice = nbackLevelKey.keys;
      }
    }

    if (choice === '1') {
      window.nbackLevel = 1;
      window.nbackLevelName = "1 wstecz";
    } else if (choice === '2') {
      window.nbackLevel = 2;
      window.nbackLevelName = "2 wstecz";
    } else if (choice === '3') {
      window.nbackLevel = 3;
      window.nbackLevelName = "3 wstecz";
    } else if (choice === '4') {
      window.nbackLevel = 4;
      window.nbackLevelName = "4 wstecz";
    } else if (choice === '5') {
      window.nbackLevel = 5;
      window.nbackLevelName = "5 wstecz";
    } else {
      window.nbackLevel = 1;
      window.nbackLevelName = "1 wstecz";
    }

    console.log('Wybrano N-Back: ' + window.nbackLevelName);
    psychoJS.experiment.addData('nback_level', window.nbackLevel);
    psychoJS.experiment.addData('nback_level_name', window.nbackLevelName);
    routineTimer.reset();

    return Scheduler.Event.NEXT;
  }
}

// ==========================================
// DIFFICULTY ROUTINE
// ==========================================
var difficultyMaxDurationReached;
var _difficultyKey_allKeys;
var difficultyMaxDuration;
var difficultyComponents;

function difficultyRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    difficultyClock.reset();
    routineTimer.reset();
    difficultyMaxDurationReached = false;
    difficultyKey.keys = undefined;
    difficultyKey.rt = undefined;
    _difficultyKey_allKeys = [];
    psychoJS.experiment.addData('difficulty.started', globalClock.getTime());
    difficultyMaxDuration = null;
    difficultyComponents = [];
    difficultyComponents.push(difficultyText);
    difficultyComponents.push(difficultyKey);

    for (const thisComponent of difficultyComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}

function difficultyRoutineEachFrame() {
  return async function () {
    t = difficultyClock.getTime();
    frameN = frameN + 1;

    if (t >= 0.0 && difficultyText.status === PsychoJS.Status.NOT_STARTED) {
      difficultyText.tStart = t;
      difficultyText.frameNStart = frameN;
      difficultyText.setAutoDraw(true);
    }

    if (t >= 0.0 && difficultyKey.status === PsychoJS.Status.NOT_STARTED) {
      difficultyKey.tStart = t;
      difficultyKey.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () { difficultyKey.clock.reset(); });
      psychoJS.window.callOnFlip(function () { difficultyKey.start(); });
      psychoJS.window.callOnFlip(function () { difficultyKey.clearEvents(); });
    }

    if (difficultyKey.status === PsychoJS.Status.STARTED) {
      let theseKeys = difficultyKey.getKeys({ keyList: ['1', '2', '3'], waitRelease: false });
      _difficultyKey_allKeys = _difficultyKey_allKeys.concat(theseKeys);
      if (_difficultyKey_allKeys.length > 0) {
        difficultyKey.keys = _difficultyKey_allKeys[_difficultyKey_allKeys.length - 1].name;
        difficultyKey.rt = _difficultyKey_allKeys[_difficultyKey_allKeys.length - 1].rt;
        difficultyKey.duration = _difficultyKey_allKeys[_difficultyKey_allKeys.length - 1].duration;
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

    continueRoutine = false;
    for (const thisComponent of difficultyComponents)
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

function difficultyRoutineEnd(snapshot) {
  return async function () {
    for (const thisComponent of difficultyComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('difficulty.stopped', globalClock.getTime());
    difficultyKey.stop();

    let choice = '2';
    if (typeof difficultyKey !== 'undefined' && difficultyKey.keys) {
      if (Array.isArray(difficultyKey.keys)) {
        choice = difficultyKey.keys[0];
      } else {
        choice = difficultyKey.keys;
      }
    }

    if (choice === '1') {
      window.decisionTime = 5.0;
      window.difficultyName = "Łatwy (5s)";
    } else if (choice === '3') {
      window.decisionTime = 1.0;
      window.difficultyName = "Trudny (1s)";
    } else {
      window.decisionTime = 2.0;
      window.difficultyName = "Normalny (2s)";
    }

    console.log('Wybrano trudność: ' + window.difficultyName);
    psychoJS.experiment.addData('difficulty_level', window.difficultyName);
    psychoJS.experiment.addData('decision_time_setting', window.decisionTime);
    routineTimer.reset();

    return Scheduler.Event.NEXT;
  }
}

// ==========================================
// INITIAL SEQUENCE ROUTINE
// ==========================================
var initialSequenceMaxDurationReached;
var initialSequenceMaxDuration;
var initialSequenceComponents;
var initialSequenceEscKey;

function initialSequenceRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    initialSequenceClock.reset();
    routineTimer.reset();
    initialSequenceMaxDurationReached = false;
    psychoJS.experiment.addData('initialSequence.started', globalClock.getTime());
    initialSequenceMaxDuration = null;

    // Generate initial sequence of 5 numbers
    window.sequence = [];
    for (let i = 0; i < 5; i++) {
      window.sequence.push(Math.floor(Math.random() * 10));
    }
    window.currentIndex = 0;

    seqNumberStim.setText(window.sequence[0].toString());
    seqProgressStim.setText('5');

    initialSequenceEscKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    initialSequenceComponents = [];
    initialSequenceComponents.push(seqNumberStim);
    initialSequenceComponents.push(seqProgressStim);
    initialSequenceComponents.push(initialSequenceEscKey);

    for (const thisComponent of initialSequenceComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}

function initialSequenceRoutineEachFrame() {
  return async function () {
    t = initialSequenceClock.getTime();
    frameN = frameN + 1;

    // Check for ESC
    let escKeys = psychoJS.eventManager.getKeys({ keyList: ['escape'] });
    if (escKeys.length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    // Update number display every 2 seconds
    let expectedIndex = Math.floor(t / 2.0);
    if (expectedIndex >= 5) {
      continueRoutine = false;
    } else if (expectedIndex !== window.currentIndex) {
      window.currentIndex = expectedIndex;
      seqNumberStim.setText(window.sequence[window.currentIndex].toString());
      // Countdown in top-left corner: 5, 4, 3, 2, 1
      seqProgressStim.setText((5 - window.currentIndex).toString());
    }

    if (t >= 0.0 && seqNumberStim.status === PsychoJS.Status.NOT_STARTED) {
      seqNumberStim.tStart = t;
      seqNumberStim.frameNStart = frameN;
      seqNumberStim.setAutoDraw(true);
    }

    if (t >= 0.0 && seqProgressStim.status === PsychoJS.Status.NOT_STARTED) {
      seqProgressStim.tStart = t;
      seqProgressStim.frameNStart = frameN;
      seqProgressStim.setAutoDraw(true);
    }

    if (psychoJS.experiment.experimentEnded) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;
    for (const thisComponent of initialSequenceComponents)
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

function initialSequenceRoutineEnd(snapshot) {
  return async function () {
    for (const thisComponent of initialSequenceComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('initialSequence.stopped', globalClock.getTime());
    psychoJS.experiment.addData('initial_sequence', JSON.stringify(window.sequence));
    console.log('Początkowa sekwencja: ' + window.sequence.join(', '));
    routineTimer.reset();

    return Scheduler.Event.NEXT;
  }
}

// ==========================================
// TRIALS LOOP
// ==========================================
var trials;
function trialsLoopBegin(trialsLoopScheduler, snapshot) {
  return async function () {
    trials = new TrialHandler({
      psychoJS: psychoJS,
      nReps: 999, // Max trials - will be stopped by end conditions
      method: TrialHandler.Method.RANDOM,
      extraInfo: expInfo, originPath: undefined,
      trialList: undefined,
      seed: undefined, name: 'trials'
    });
    psychoJS.experiment.addLoop(trials);
    currentLoop = trials;

    for (const thisTrial of trials) {
      snapshot = trials.getSnapshot();
      trialsLoopScheduler.add(importConditions(snapshot));
      trialsLoopScheduler.add(trialRoutineBegin(snapshot));
      trialsLoopScheduler.add(trialRoutineEachFrame());
      trialsLoopScheduler.add(trialRoutineEnd(snapshot));
      trialsLoopScheduler.add(feedbackRoutineBegin(snapshot));
      trialsLoopScheduler.add(feedbackRoutineEachFrame());
      trialsLoopScheduler.add(feedbackRoutineEnd(snapshot));
      trialsLoopScheduler.add(trialsLoopEndIteration(trialsLoopScheduler, snapshot));
    }

    return Scheduler.Event.NEXT;
  }
}

async function trialsLoopEnd() {
  psychoJS.experiment.removeLoop(trials);
  if (psychoJS.experiment._unfinishedLoops.length > 0)
    currentLoop = psychoJS.experiment._unfinishedLoops.at(-1);
  else
    currentLoop = psychoJS.experiment;
  return Scheduler.Event.NEXT;
}

function trialsLoopEndIteration(scheduler, snapshot) {
  return async function () {
    if (typeof snapshot !== 'undefined') {
      if (snapshot.finished || window.testEnded) {
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

// ==========================================
// TRIAL ROUTINE
// ==========================================
var trialMaxDurationReached;
var _key_resp_allKeys;
var trialMaxDuration;
var trialComponents;

function trialRoutineBegin(snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot);

    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    trialClock.reset();
    routineTimer.reset();
    trialMaxDurationReached = false;

    // Generate new number and add to sequence
    let newNum = Math.floor(Math.random() * 10);
    window.sequence.push(newNum);
    window.currentNumber = newNum.toString();
    window.currentIndex = window.sequence.length - 1;

    // Check if this is a match (current number == number N positions ago)
    let n = window.nbackLevel;
    window.isMatch = false;
    if (window.currentIndex >= n) {
      window.isMatch = (window.sequence[window.currentIndex] === window.sequence[window.currentIndex - n]);
    }

    numberStim.setText(window.currentNumber);
    questionStim.setText(`Czy ta cyfra pojawiła się ${n} miejsc temu? (TAK/NIE)`);

    key_resp.keys = undefined;
    key_resp.rt = undefined;
    _key_resp_allKeys = [];

    psychoJS.experiment.addData('trial.started', globalClock.getTime());
    psychoJS.experiment.addData('trial_number', window.currentIndex - 4); // Trial number after initial 5
    psychoJS.experiment.addData('current_number', window.currentNumber);
    psychoJS.experiment.addData('is_match', window.isMatch);
    psychoJS.experiment.addData('sequence_so_far', JSON.stringify(window.sequence));

    trialMaxDuration = null;
    trialComponents = [];
    trialComponents.push(questionStim);
    trialComponents.push(numberStim);
    trialComponents.push(key_resp);

    for (const thisComponent of trialComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}

function trialRoutineEachFrame() {
  return async function () {
    t = trialClock.getTime();
    frameN = frameN + 1;

    // Keyboard input
    if (t >= 0 && key_resp.status === PsychoJS.Status.NOT_STARTED) {
      key_resp.tStart = t;
      key_resp.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () { key_resp.clock.reset(); });
      psychoJS.window.callOnFlip(function () { key_resp.start(); });
      psychoJS.window.callOnFlip(function () { key_resp.clearEvents(); });
    }

    let frameRemains = 0 + window.decisionTime - psychoJS.window.monitorFramePeriod * 0.75;
    if (key_resp.status === PsychoJS.Status.STARTED && t >= frameRemains) {
      key_resp.tStop = t;
      key_resp.frameNStop = frameN;
      key_resp.status = PsychoJS.Status.FINISHED;
    }

    if (key_resp.status === PsychoJS.Status.STARTED) {
      let theseKeys = key_resp.getKeys({ keyList: ['y', 'n', 't', 'Y', 'N', 'T'], waitRelease: false });
      _key_resp_allKeys = _key_resp_allKeys.concat(theseKeys);
      if (_key_resp_allKeys.length > 0) {
        key_resp.keys = _key_resp_allKeys[_key_resp_allKeys.length - 1].name;
        key_resp.rt = _key_resp_allKeys[_key_resp_allKeys.length - 1].rt;
        key_resp.duration = _key_resp_allKeys[_key_resp_allKeys.length - 1].duration;
        continueRoutine = false;
      }
    }

    // Number display
    if (t >= 0.0 && numberStim.status === PsychoJS.Status.NOT_STARTED) {
      numberStim.tStart = t;
      numberStim.frameNStart = frameN;
      numberStim.setAutoDraw(true);
    }

    if (numberStim.status === PsychoJS.Status.STARTED && t >= (0.0 + window.decisionTime - psychoJS.window.monitorFramePeriod * 0.75)) {
      numberStim.tStop = t;
      numberStim.frameNStop = frameN;
      numberStim.setAutoDraw(false);
    }

    // Question display
    if (t >= 0.0 && questionStim.status === PsychoJS.Status.NOT_STARTED) {
      questionStim.tStart = t;
      questionStim.frameNStart = frameN;
      questionStim.setAutoDraw(true);
    }

    if (questionStim.status === PsychoJS.Status.STARTED && t >= (0.0 + window.decisionTime - psychoJS.window.monitorFramePeriod * 0.75)) {
      questionStim.tStop = t;
      questionStim.frameNStop = frameN;
      questionStim.setAutoDraw(false);
    }

    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;
    for (const thisComponent of trialComponents)
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

function trialRoutineEnd(snapshot) {
  return async function () {
    for (const thisComponent of trialComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('trial.stopped', globalClock.getTime());

    // Evaluate response
    let pressed = false;
    let userSaidYes = false;

    if (typeof key_resp !== 'undefined' && key_resp.keys) {
      if (typeof key_resp.keys === 'string' && key_resp.keys.length > 0) {
        pressed = true;
        let k = key_resp.keys.toLowerCase();
        userSaidYes = (k === 'y' || k === 't'); // TAK or Yes
      }
    }

    // Determine correctness
    let wasCorrect = false;
    if (window.isMatch && userSaidYes) {
      wasCorrect = true; // Match and user said TAK
    } else if (!window.isMatch && pressed && !userSaidYes) {
      wasCorrect = true; // No match and user said NIE
    } else if (!window.isMatch && !pressed) {
      wasCorrect = true; // No match and user didn't press (timeout = NIE)
    }

    if (wasCorrect) {
      window.totalCorrect++;
      window.feedbackColor = 'green';
      window.feedbackText = '✓ Poprawnie!';
    } else {
      window.feedbackColor = 'red';
      if (window.isMatch) {
        window.feedbackText = `✗ Błąd! Ta cyfra była taka sama jak ${window.nbackLevel} miejsc temu.`;
      } else {
        window.feedbackText = '✗ Błąd!';
      }
      window.testEnded = true;
    }

    // Check if we reached 50 correct answers
    if (window.totalCorrect >= window.targetCorrect) {
      window.testEnded = true;
      window.feedbackColor = 'green';
      window.feedbackText = '🎉 Gratulacje! Osiągnięto 50 poprawnych odpowiedzi!';
    }

    psychoJS.experiment.addData('user_response', userSaidYes ? 'TAK' : (pressed ? 'NIE' : 'BRAK'));
    psychoJS.experiment.addData('was_correct', wasCorrect);
    psychoJS.experiment.addData('total_correct', window.totalCorrect);
    psychoJS.experiment.addData('test_ended', window.testEnded);

    if (typeof key_resp !== 'undefined') {
      psychoJS.experiment.addData('key_resp.keys', key_resp.keys);
      if (typeof key_resp.keys !== 'undefined') {
        psychoJS.experiment.addData('key_resp.rt', key_resp.rt);
        psychoJS.experiment.addData('key_resp.duration', key_resp.duration);
      }
    }

    key_resp.stop();
    routineTimer.reset();

    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  }
}

// ==========================================
// FEEDBACK ROUTINE
// ==========================================
var feedbackMaxDurationReached;
var feedbackMaxDuration;
var feedbackComponents;

function feedbackRoutineBegin(snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot);

    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    feedbackClock.reset(routineTimer.getTime());
    routineTimer.add(1.5);
    feedbackMaxDurationReached = false;

    // No feedback text - just blank screen
    feedbackStim.setColor(new util.Color('black'));
    feedbackStim.setText('');

    psychoJS.experiment.addData('feedback.started', globalClock.getTime());
    feedbackMaxDuration = null;
    feedbackComponents = [];
    feedbackComponents.push(feedbackStim);

    for (const thisComponent of feedbackComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}

function feedbackRoutineEachFrame() {
  return async function () {
    t = feedbackClock.getTime();
    frameN = frameN + 1;

    if (t >= 0.0 && feedbackStim.status === PsychoJS.Status.NOT_STARTED) {
      feedbackStim.tStart = t;
      feedbackStim.frameNStart = frameN;
      feedbackStim.setAutoDraw(true);
    }

    if (feedbackStim.status === PsychoJS.Status.STARTED) {
    }

    let frameRemains = 0.0 + 1.5 - psychoJS.window.monitorFramePeriod * 0.75;
    if (feedbackStim.status === PsychoJS.Status.STARTED && t >= frameRemains) {
      feedbackStim.tStop = t;
      feedbackStim.frameNStop = frameN;
      feedbackStim.status = PsychoJS.Status.FINISHED;
      feedbackStim.setAutoDraw(false);
    }

    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;
    for (const thisComponent of feedbackComponents)
      if ('status' in thisComponent && thisComponent.status !== PsychoJS.Status.FINISHED) {
        continueRoutine = true;
        break;
      }

    if (continueRoutine && routineTimer.getTime() > 0) {
      return Scheduler.Event.FLIP_REPEAT;
    } else {
      return Scheduler.Event.NEXT;
    }
  };
}

function feedbackRoutineEnd(snapshot) {
  return async function () {
    for (const thisComponent of feedbackComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('feedback.stopped', globalClock.getTime());
    if (routineForceEnded) {
      routineTimer.reset();
    } else if (feedbackMaxDurationReached) {
      feedbackClock.add(feedbackMaxDuration);
    } else {
      feedbackClock.add(1.5);
    }
    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  }
}

// ==========================================
// IMPORT CONDITIONS
// ==========================================
function importConditions(currentLoop) {
  return async function () {
    psychoJS.importAttributes(currentLoop.getCurrentTrial());
    return Scheduler.Event.NEXT;
  };
}

// ==========================================
// QUIT PSYCHOJS
// ==========================================
async function quitPsychoJS(message, isCompleted) {
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }

  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted) {
      let rawData = psychoJS.experiment._trialsData || [];
      let allData = rawData.filter(trial => trial.hasOwnProperty('was_correct'));

      let poprawneNacisniecia = 0;
      let bledneNacisniecia = 0;
      let wszystkieNacisniecia = 0;
      let sumRT = 0;
      let validRTCount = 0;

      for (let trial of allData) {
        let wasCorrect = !!trial.was_correct;
        let pressed = false;

        let k = trial['key_resp.keys'] || (trial.key_resp && trial.key_resp.keys);
        if (k !== undefined && k !== null) {
          if (typeof k === 'string' && k.length > 0) {
            pressed = true;
          }
        }

        let rt = trial['key_resp.rt'] || (trial.key_resp && trial.key_resp.rt);
        if (rt !== undefined && rt !== null) {
          if (typeof rt === 'number' && rt >= 0) {
            sumRT += rt;
            validRTCount++;
          }
        }

        if (wasCorrect) {
          poprawneNacisniecia++;
        } else {
          bledneNacisniecia++;
        }
        if (pressed) {
          wszystkieNacisniecia++;
        }
      }

      let sredniCzasReakcji = validRTCount > 0 ? Math.round((sumRT / validRTCount) * 1000) : 0;

      let payload = {
        testId: "NWstecz",
        subjectId: expInfo['participant'],
        timestamp: new Date().toISOString(),

        ilosc_poprawnych_nacisniec: poprawneNacisniecia,
        ilosc_blednych_nacisniec: bledneNacisniecia,
        ogolna_ilosc_nacisniec: wszystkieNacisniecia,
        sredni_czas_reakcji: sredniCzasReakcji,

        poziom_trudnosci: `${window.nbackLevelName} | ${window.difficultyName}`,
        nback_level: window.nbackLevel,
        decision_time: window.decisionTime,
        total_correct: window.totalCorrect,
        test_ended_reason: window.totalCorrect >= window.targetCorrect ? '50_correct' : 'wrong_answer',

        score: `Poprawne: ${poprawneNacisniecia} | Błędne: ${bledneNacisniecia} | N-Back: ${window.nbackLevelName} | Poziom: ${window.difficultyName} | Śr. RT: ${sredniCzasReakcji} ms`,

        statystyki: {
          poprawne: poprawneNacisniecia,
          bledne: bledneNacisniecia,
          wszystkie_próby: allData.length,
          nback_level: window.nbackLevel,
          decision_time: window.decisionTime,
          initial_sequence: window.sequence.slice(0, 10)
        },

        wyniki: allData
      };

      console.log("Wysyłanie do Nous...", payload);
      window.electronTest.sendResults(payload);
    } else {
      window.electronTest.close();
    }
  }

  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });

  return Scheduler.Event.QUIT;
}
