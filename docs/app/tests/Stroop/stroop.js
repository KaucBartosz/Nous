/************* 
 * Stroop *
 *************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;

let expName = 'Stroop';
let expInfo = {
  'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  'session': '001',
};

// init psychoJS:
let psychoJS;
try {
  psychoJS = new PsychoJS({ debug: true });
} catch (error) {
  console.error("Failed to initialize PsychoJS:", error);
  throw error;
}

// open window:
psychoJS.openWindow({
  fullscr: true,
  color: new util.Color([0, 0, 0]),
  units: 'height',
  waitBlanking: true,
});

// schedule the experiment:
psychoJS.schedule(psychoJS.gui.DlgFromDict({
  dictionary: expInfo,
  title: expName
}));

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(
  function () { return (psychoJS.gui.dialogComponent.button === 'OK'); },
  flowScheduler,
  dialogCancelScheduler
);

// flowScheduler runs if the participant pressed OK
flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);

// --- Ekran wyboru ---
flowScheduler.add(selectionRoutineBegin());
flowScheduler.add(selectionRoutineEachFrame());
flowScheduler.add(selectionRoutineEnd());

// --- Pętla prób ---
const trialsLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(trialsLoopBegin(trialsLoopScheduler));
flowScheduler.add(trialsLoopScheduler);
flowScheduler.add(trialsLoopEnd);

flowScheduler.add(quitPsychoJS, 'Dziękujemy!', true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, 'Anulowano.', false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
});

// =============================================================
// GLOBALS
// =============================================================
const HINT_DATA = [
  { key: '1', label: '1: Czerwony', color: 'red',   x: -0.55 },
  { key: '2', label: '2: Niebieski', color: 'blue',  x: -0.18 },
  { key: '3', label: '3: Zielony',  color: 'green', x:  0.18 },
  { key: '4', label: '4: Żółty',   color: 'yellow', x:  0.55 },
];

var currentLoop;
var globalClock;
var routineTimer;
var n_questions = 10;

// Selection routine
var selectionClock;
var selectionText;
var selectionKB;
var selectionComponents;
var continueRoutine_sel;

// Trial routine
var trialClock;
var fixation;
var targetText;
var hintTexts = [];
var trialKB;
var trialComponents;
var continueRoutine_trial;

var t_sel, frameN_sel;
var t_trial, frameN_trial;

var trials_data = [];

const COLORS = {
  'czerwony': 'red',
  'niebieski': 'blue',
  'zielony': 'green',
  'żółty': 'yellow'
};
const KEYS_MAP = { '1': 'czerwony', '2': 'niebieski', '3': 'zielony', '4': 'żółty' };
const NAMES = Object.keys(COLORS);

var currentWord, currentColor, correctKey;

// =============================================================
async function updateInfo() {
  currentLoop = psychoJS.experiment;
  expInfo['date'] = util.MonotonicClock.getDateStr();
  expInfo['expName'] = expName;
  expInfo['psychopyVersion'] = '2025.1.1';
  expInfo['OS'] = window.navigator.platform;
  expInfo['frameRate'] = psychoJS.window.getActualFrameRate();
  util.addInfoFromUrl(expInfo);
  psychoJS.experiment.dataFileName = (("." + "/") + `data/${expInfo["participant"]}_${expName}_${expInfo["date"]}`);
  return Scheduler.Event.NEXT;
}

// =============================================================
async function experimentInit() {
  // --- Selection screen ---
  selectionClock = new util.Clock();
  selectionText = new visual.TextStim({
    win: psychoJS.window,
    name: 'selectionText',
    text: 'Za chwilę na ekranie pojawiać się będą kolejno słowa zapisane kolorową czcionką. Twoim zadaniem jest zareagowanie na KOLOR czcionki i ignorowanie treści słowa.\n\nUżywaj klawiszy: 1-Czerwony, 2-Niebieski, 3-Zielony, 4-Żółty\n\nWybierz długość testu:\n1 - 10 pytań\n2 - 20 pytań\n3 - 30 pytań\n\nESC - Wyjście',
    font: 'Arial',
    pos: [0, 0],
    height: 0.04,
    wrapWidth: 1.4,
    color: new util.Color('white'),
    depth: 0.0,
  });
  selectionKB = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // --- Trial screen ---
  trialClock = new util.Clock();
  fixation = new visual.TextStim({
    win: psychoJS.window,
    name: 'fixation',
    text: '+',
    font: 'Arial',
    pos: [0, 0],
    height: 0.07,
    color: new util.Color('white'),
    depth: -1.0,
  });
  targetText = new visual.TextStim({
    win: psychoJS.window,
    name: 'targetText',
    text: '',
    font: 'Arial',
    pos: [0, 0],
    height: 0.12,
    bold: true,
    color: new util.Color('white'),
    depth: -2.0,
  });
  hintTexts = HINT_DATA.map((h, i) => new visual.TextStim({
    win: psychoJS.window,
    name: `hintText_${i}`,
    text: h.label,
    font: 'Arial',
    pos: [h.x, 0.42],
    height: 0.035,
    color: new util.Color(h.color),
    depth: -3.0 - i,
  }));
  trialKB = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  if (typeof window.electronTest !== 'undefined') {
    psychoJS.experiment.save = function () { return Promise.resolve(); };
  }

  globalClock = new util.Clock();
  routineTimer = new util.CountdownTimer();

  return Scheduler.Event.NEXT;
}

// =============================================================
// SELECTION ROUTINE
// =============================================================
function selectionRoutineBegin() {
  return async function () {
    t_sel = 0;
    frameN_sel = -1;
    continueRoutine_sel = true;
    selectionClock.reset();
    routineTimer.reset();

    selectionKB.keys = undefined;
    selectionKB.rt = undefined;
    psychoJS.window.callOnFlip(function () { selectionKB.clock.reset(); });
    psychoJS.window.callOnFlip(function () { selectionKB.start(); });
    psychoJS.window.callOnFlip(function () { selectionKB.clearEvents(); });

    selectionComponents = [selectionText, selectionKB];
    for (const c of selectionComponents)
      if ('status' in c) c.status = PsychoJS.Status.NOT_STARTED;

    return Scheduler.Event.NEXT;
  };
}

function selectionRoutineEachFrame() {
  return async function () {
    t_sel = selectionClock.getTime();
    frameN_sel += 1;

    // selectionText
    if (t_sel >= 0.0 && selectionText.status === PsychoJS.Status.NOT_STARTED) {
      selectionText.tStart = t_sel;
      selectionText.frameNStart = frameN_sel;
      selectionText.setAutoDraw(true);
    }

    // selectionKB
    if (t_sel >= 0.0 && selectionKB.status === PsychoJS.Status.NOT_STARTED) {
      selectionKB.tStart = t_sel;
      selectionKB.frameNStart = frameN_sel;
      selectionKB.status = PsychoJS.Status.STARTED;
    }

    if (selectionKB.status === PsychoJS.Status.STARTED) {
      let theseKeys = selectionKB.getKeys({ keyList: ['1', '2', '3', 'num_1', 'num_2', 'num_3', 'escape'], waitRelease: false });
      if (theseKeys.length > 0) {
        let key = theseKeys[0].name;
        if (key === 'escape') return quitPsychoJS('Przerwano.', false);
        if (key === '1' || key === 'num_1') n_questions = 10;
        else if (key === '2' || key === 'num_2') n_questions = 20;
        else if (key === '3' || key === 'num_3') n_questions = 30;
        continueRoutine_sel = false;
      }
    }

    // ESC
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }

    if (!continueRoutine_sel) return Scheduler.Event.NEXT;

    continueRoutine_sel = false;
    for (const c of selectionComponents)
      if ('status' in c && c.status !== PsychoJS.Status.FINISHED) { continueRoutine_sel = true; break; }

    return continueRoutine_sel ? Scheduler.Event.FLIP_REPEAT : Scheduler.Event.NEXT;
  };
}

function selectionRoutineEnd() {
  return async function () {
    for (const c of selectionComponents)
      if (typeof c.setAutoDraw === 'function') c.setAutoDraw(false);
    selectionKB.stop();
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  };
}

// =============================================================
// TRIALS LOOP
// =============================================================
function trialsLoopBegin(scheduler) {
  return async function () {
    for (let i = 0; i < n_questions; i++) {
      scheduler.add(trialRoutineBegin(i));
      scheduler.add(trialRoutineEachFrame());
      scheduler.add(trialRoutineEnd());
    }
    return Scheduler.Event.NEXT;
  };
}

async function trialsLoopEnd() {
  return Scheduler.Event.NEXT;
}

// =============================================================
// TRIAL ROUTINE
// =============================================================
function trialRoutineBegin(trialIdx) {
  return async function () {
    t_trial = 0;
    frameN_trial = -1;
    continueRoutine_trial = true;
    trialClock.reset();
    routineTimer.reset();

    // Pick random word and colour
    currentWord = NAMES[Math.floor(Math.random() * NAMES.length)];
    currentColor = NAMES[Math.floor(Math.random() * NAMES.length)];
    correctKey = Object.keys(KEYS_MAP).find(k => KEYS_MAP[k] === currentColor);

    targetText.setText(currentWord.toUpperCase());
    targetText.setColor(new util.Color(COLORS[currentColor]));

    trialKB.keys = undefined;
    trialKB.rt = undefined;
    psychoJS.window.callOnFlip(function () { trialKB.clock.reset(); });
    psychoJS.window.callOnFlip(function () { trialKB.start(); });
    psychoJS.window.callOnFlip(function () { trialKB.clearEvents(); });

    trialComponents = [fixation, targetText, ...hintTexts, trialKB];
    for (const c of trialComponents)
      if ('status' in c) c.status = PsychoJS.Status.NOT_STARTED;

    return Scheduler.Event.NEXT;
  };
}

function trialRoutineEachFrame() {
  return async function () {
    t_trial = trialClock.getTime();
    frameN_trial += 1;

    // Fixation (0 – 0.5 s)
    if (t_trial >= 0.0 && fixation.status === PsychoJS.Status.NOT_STARTED) {
      fixation.tStart = t_trial;
      fixation.setAutoDraw(true);
    }
    if (fixation.status === PsychoJS.Status.STARTED && t_trial >= 0.5) {
      fixation.setAutoDraw(false);
      fixation.status = PsychoJS.Status.FINISHED;
    }

    // Target word (0.5 s onwards)
    if (t_trial >= 0.5 && targetText.status === PsychoJS.Status.NOT_STARTED) {
      targetText.tStart = t_trial;
      targetText.setAutoDraw(true);
    }
    for (const h of hintTexts) {
      if (h.status === PsychoJS.Status.NOT_STARTED && t_trial >= 0.5) {
        h.tStart = t_trial;
        h.setAutoDraw(true);
      }
    }

    // Keyboard
    if (t_trial >= 0.0 && trialKB.status === PsychoJS.Status.NOT_STARTED) {
      trialKB.tStart = t_trial;
      trialKB.status = PsychoJS.Status.STARTED;
    }

    if (t_trial >= 0.5 && trialKB.status === PsychoJS.Status.STARTED) {
      let theseKeys = trialKB.getKeys({ keyList: ['1', '2', '3', '4', 'escape'], waitRelease: false });
      if (theseKeys.length > 0) {
        let key = theseKeys[0].name;
        if (key === 'escape') return quitPsychoJS('Przerwano.', false);

        let rt_val = Math.round((theseKeys[0].rt - 0.5) * 1000); // RT od momentu pojawienia słowa (ms)
        let correct = (key === correctKey) ? 1 : 0;
        psychoJS.experiment.addData('trial_n', trials_data.length + 1);
        psychoJS.experiment.addData('word', currentWord);
        psychoJS.experiment.addData('color', currentColor);
        psychoJS.experiment.addData('resp_key', key);
        psychoJS.experiment.addData('correct', correct);
        psychoJS.experiment.addData('rt_ms', rt_val);

        trials_data.push({ correct: correct, rt: rt_val, responded: true });
        continueRoutine_trial = false;
      }
    }

    // --- Limit czasu: 5 s od pojawienia się słowa (= 5.5 s od startu) ---
    if (t_trial >= 5.5 && continueRoutine_trial) {
      psychoJS.experiment.addData('trial_n', trials_data.length + 1);
      psychoJS.experiment.addData('word', currentWord);
      psychoJS.experiment.addData('color', currentColor);
      psychoJS.experiment.addData('resp_key', 'none');
      psychoJS.experiment.addData('correct', 0);
      psychoJS.experiment.addData('rt_ms', null);
      trials_data.push({ correct: 0, rt: null, responded: false });
      continueRoutine_trial = false;
    }

    // ESC
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }

    if (!continueRoutine_trial) return Scheduler.Event.NEXT;

    continueRoutine_trial = false;
    for (const c of trialComponents)
      if ('status' in c && c.status !== PsychoJS.Status.FINISHED) { continueRoutine_trial = true; break; }

    return continueRoutine_trial ? Scheduler.Event.FLIP_REPEAT : Scheduler.Event.NEXT;
  };
}

function trialRoutineEnd() {
  return async function () {
    for (const c of trialComponents)
      if (typeof c.setAutoDraw === 'function') c.setAutoDraw(false);
    trialKB.stop();
    psychoJS.experiment.nextEntry();
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  };
}

// =============================================================
// QUIT
// =============================================================
async function quitPsychoJS(message, isCompleted) {
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }

  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted && trials_data.length > 0) {
      let responded = trials_data.filter(t => t.responded && t.rt !== null);
      let correct = responded.filter(t => t.correct === 1).length;
      let presses = responded.length;
      let errors = presses - correct;
      let total_trials = trials_data.length;
      
      let avgRT = presses > 0
        ? Math.round(responded.reduce((acc, t) => acc + t.rt, 0) / presses)
        : 0;
      let accuracy = Math.round((correct / total_trials) * 100);

      window.electronTest.sendResults({
        testId: expName,
        subjectId: expInfo['participant'],
        timestamp: new Date().toISOString(),
        ilosc_poprawnych_nacisniec: correct,
        ilosc_blednych_nacisniec: errors,
        ogolna_ilosc_nacisniec: presses,
        sredni_czas_reakcji: avgRT,
        poziom_trudnosci: `${n_questions} pytań`,
        score: `Poprawne: ${correct} | Błędne: ${errors} | Pominięte: ${total_trials - presses} | Śr. RT: ${avgRT} ms | Skuteczność: ${accuracy}%`,
        wyniki: trials_data
      });
    } else {
      window.electronTest.close();
    }
  }

  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });
  return Scheduler.Event.QUIT;
}
