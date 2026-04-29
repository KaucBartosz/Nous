/**************** 
 * Semafor *
 ****************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
//some handy aliases as in the psychopy scripts;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;


// store info about the experiment session:
let expName = 'semafor';  // from the Builder filename that created this script
let expInfo = {
  'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  'session': '001',
};
let PILOTING = util.getUrlParameters().has('__pilotToken');

// Start code blocks for 'Before Experiment'
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

// flowScheduler gets run if the participants presses OK
flowScheduler.add(updateInfo); // add timeStamp
flowScheduler.add(experimentInit);
flowScheduler.add(welcomeRoutineBegin());
flowScheduler.add(welcomeRoutineEachFrame());
flowScheduler.add(welcomeRoutineEnd());
const n_trialsLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(n_trialsLoopBegin(n_trialsLoopScheduler));
flowScheduler.add(n_trialsLoopScheduler);
flowScheduler.add(n_trialsLoopEnd);


flowScheduler.add(quitPsychoJS, 'Thank you for your patience.', true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, 'Thank you for your patience.', false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: [
    // resources:
    { 'name': 'resources/lampkaZielOFF.png', 'path': 'resources/lampkaZielOFF.png' },
    { 'name': 'resources/lampkaZielON.png', 'path': 'resources/lampkaZielON.png' },
    { 'name': 'resources/lampkaOFF.png', 'path': 'resources/lampkaOFF.png' },
    { 'name': 'resources/lampkaON.png', 'path': 'resources/lampkaON.png' },
  ]
});

psychoJS.experimentLogger.setLevel(core.Logger.ServerLevel.INFO);


var currentLoop;
var frameDur;
async function updateInfo() {
  currentLoop = psychoJS.experiment;  // right now there are no loops
  expInfo['date'] = util.MonotonicClock.getDateStr();  // add a simple timestamp
  expInfo['expName'] = expName;
  expInfo['psychopyVersion'] = '2025.1.1';
  expInfo['OS'] = window.navigator.platform;


  // store frame rate of monitor if we can measure it successfully
  expInfo['frameRate'] = psychoJS.window.getActualFrameRate();
  if (typeof expInfo['frameRate'] !== 'undefined')
    frameDur = 1.0 / Math.round(expInfo['frameRate']);
  else
    frameDur = 1.0 / 60.0; // couldn't get a reliable measure so guess

  // add info from the URL:
  util.addInfoFromUrl(expInfo);



  psychoJS.experiment.dataFileName = (("." + "/") + `data/${expInfo["participant"]}_${expName}_${expInfo["date"]}`);
  psychoJS.experiment.field_separator = '\t';


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
async function experimentInit() {
  // Initialize components for Routine "welcome"
  welcomeClock = new util.Clock();
  welcomeText = new visual.TextStim({
    win: psychoJS.window,
    name: 'welcomeText',
    text: 'Za chwilę zobaczysz planszę z lampkami. Twoim zadaniem będzie, za pomocą MYSZY, wskazać tę lampkę, która znajduje się na przecięciu prostych dwóch lampek zapalonych na zielono. Staraj się klikać najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.05, wrapWidth: 1.2, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });

  key_resp = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "trial"
  trialClock = new util.Clock();
  // Run 'Begin Experiment' code from code
  // --- INTEGRACJA Z LAUNCHEREM (INIT) ---
  if (typeof window.electronTest !== 'undefined') {
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
        image: 'resources/lampkaOFF.png',
        size: [0.08, 0.08],
        pos: [coords[ix], coords[iy]],
        opacity: 1.0
      });
      row.push(stim);
    }
    lamp_grid.push(row);
  }

  // zielona ramka + ukryte rogi
  let cornerCoords = [[0, 0], [0, N - 1], [N - 1, 0], [N - 1, N - 1]];

  for (let ix = 0; ix < N; ix++) {
    for (let iy = 0; iy < N; iy++) {
      let is_outer = (ix === 0) || (ix === N - 1) || (iy === 0) || (iy === N - 1);

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
        lamp_grid[ix][iy].setImage('resources/lampkaZielOFF.png');
      } else {
        lamp_grid[ix][iy].setImage('resources/lampkaOFF.png');
      }
    }
  }
  mouse = new core.Mouse({
    win: psychoJS.window,
  });
  mouse.mouseClock = new util.Clock();
  // Create some handy timers
  globalClock = new util.Clock();  // to track the time since experiment started
  routineTimer = new util.CountdownTimer();  // to track time remaining of each (non-slip) routine

  // --- EKRAN DOTYKOWY ---
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


var t;
var frameN;
var continueRoutine;
var routineForceEnded;
var welcomeMaxDurationReached;
var _key_resp_allKeys;
var welcomeMaxDuration;
var welcomeComponents;
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
    psychoJS.experiment.addData('welcome.started', globalClock.getTime());
    welcomeMaxDuration = null
    // keep track of which components have finished
    welcomeComponents = [];
    welcomeComponents.push(welcomeText);
    welcomeComponents.push(key_resp);

    for (const thisComponent of welcomeComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}


function welcomeRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'welcome' ---
    // get current time
    t = welcomeClock.getTime();
    frameN = frameN + 1;// number of completed frames (so 0 is the first frame)
    // update/draw components on each frame

    // *welcomeText* updates
    if (t >= 0.0 && welcomeText.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      welcomeText.tStart = t;  // (not accounting for frame time here)
      welcomeText.frameNStart = frameN;  // exact frame index

      welcomeText.setAutoDraw(true);
    }


    // if welcomeText is active this frame...
    if (welcomeText.status === PsychoJS.Status.STARTED) {
    }


    // *key_resp* updates
    if (t >= 0.0 && key_resp.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      key_resp.tStart = t;  // (not accounting for frame time here)
      key_resp.frameNStart = frameN;  // exact frame index

      // keyboard checking is just starting
      psychoJS.window.callOnFlip(function () { key_resp.clock.reset(); });  // t=0 on next screen flip
      psychoJS.window.callOnFlip(function () { key_resp.start(); }); // start on screen flip
      psychoJS.window.callOnFlip(function () { key_resp.clearEvents(); });
    }

    // if key_resp is active this frame...
    if (key_resp.status === PsychoJS.Status.STARTED) {
      let theseKeys = key_resp.getKeys({ keyList: ['y', 'n', 'left', 'right', 'space'], waitRelease: false });
      _key_resp_allKeys = _key_resp_allKeys.concat(theseKeys);
      if (_key_resp_allKeys.length > 0) {
        key_resp.keys = _key_resp_allKeys[_key_resp_allKeys.length - 1].name;  // just the last key pressed
        key_resp.rt = _key_resp_allKeys[_key_resp_allKeys.length - 1].rt;
        key_resp.duration = _key_resp_allKeys[_key_resp_allKeys.length - 1].duration;
        // a response ends the routine
        continueRoutine = false;
      }
    }

    // check for quit (typically the Esc key)
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }

    // check if the Routine should terminate
    if (!continueRoutine) {  // a component has requested a forced-end of Routine
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;  // reverts to True if at least one component still running
    for (const thisComponent of welcomeComponents)
      if ('status' in thisComponent && thisComponent.status !== PsychoJS.Status.FINISHED) {
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
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('welcome.stopped', globalClock.getTime());
    // update the trial handler
    if (currentLoop instanceof MultiStairHandler) {
      currentLoop.addResponse(key_resp.corr, level);
    }
    psychoJS.experiment.addData('key_resp.keys', key_resp.keys);
    if (typeof key_resp.keys !== 'undefined') {  // we had a response
      psychoJS.experiment.addData('key_resp.rt', key_resp.rt);
      psychoJS.experiment.addData('key_resp.duration', key_resp.duration);
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
  }
}


var n_trials;
function n_trialsLoopBegin(n_trialsLoopScheduler, snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // update internal variables (.thisN etc) of the loop

    // set up handler to look after randomisation of conditions etc
    n_trials = new TrialHandler({
      psychoJS: psychoJS,
      nReps: 20, method: TrialHandler.Method.RANDOM,
      extraInfo: expInfo, originPath: undefined,
      trialList: undefined,
      seed: undefined, name: 'n_trials'
    });
    psychoJS.experiment.addLoop(n_trials); // add the loop to the experiment
    currentLoop = n_trials;  // we're now the current loop

    // Schedule all the trials in the trialList:
    for (const thisN_trial of n_trials) {
      snapshot = n_trials.getSnapshot();
      n_trialsLoopScheduler.add(importConditions(snapshot));
      n_trialsLoopScheduler.add(trialRoutineBegin(snapshot));
      n_trialsLoopScheduler.add(trialRoutineEachFrame());
      n_trialsLoopScheduler.add(trialRoutineEnd(snapshot));
      n_trialsLoopScheduler.add(n_trialsLoopEndIteration(n_trialsLoopScheduler, snapshot));
    }

    return Scheduler.Event.NEXT;
  }
}


async function n_trialsLoopEnd() {
  // terminate loop
  psychoJS.experiment.removeLoop(n_trials);
  // update the current loop from the ExperimentHandler
  if (psychoJS.experiment._unfinishedLoops.length > 0)
    currentLoop = psychoJS.experiment._unfinishedLoops.at(-1);
  else
    currentLoop = psychoJS.experiment;  // so we use addData from the experiment
  return Scheduler.Event.NEXT;
}


function n_trialsLoopEndIteration(scheduler, snapshot) {
  // ------Prepare for next entry------
  return async function () {
    if (typeof snapshot !== 'undefined') {
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

    let cornerCoords = [[0, 0], [0, N - 1], [N - 1, 0], [N - 1, N - 1]];

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
        let is_outer = (ix === 0) || (ix === N - 1) || (iy === 0) || (iy === N - 1);

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
          lamp_grid[ix][iy].setImage('resources/lampkaZielOFF.png');
        } else {
          lamp_grid[ix][iy].setOpacity(1.0);
          lamp_grid[ix][iy].setImage('resources/lampkaOFF.png');
        }
      }
    }

    // los krawędzi
    x_edge = (Math.random() < 0.5) ? 'top' : 'bottom';
    y_edge = (Math.random() < 0.5) ? 'left' : 'right';

    // wiersz dla X, kolumna dla Y
    y_edge_row = (x_edge === 'top') ? 0 : (N - 1);
    x_edge_col = (y_edge === 'left') ? 0 : (N - 1);

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
        if ((x_lamp[0] === cx && x_lamp[1] === cy) ||
          (y_lamp[0] === cx && y_lamp[1] === cy)) {
          bad = true;
          break;
        }
      }

      if (!bad) {
        break;
      }
    }

    // zapalamy X
    lamp_grid[x_index][y_edge_row].setImage('resources/lampkaZielON.png');
    // zapalamy Y
    lamp_grid[x_edge_col][y_index].setImage('resources/lampkaZielON.png');

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
    psychoJS.experiment.addData('trial.started', globalClock.getTime());
    trialMaxDuration = null
    // keep track of which components have finished
    trialComponents = [];
    trialComponents.push(mouse);

    for (const thisComponent of trialComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}


var prevButtonState;
var _mouseButtons;
var _mouseXYs;
function trialRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'trial' ---
    // get current time
    t = trialClock.getTime();
    frameN = frameN + 1;// number of completed frames (so 0 is the first frame)
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
      if (!pos || (typeof pos[0] !== 'number') || (typeof pos[1] !== 'number')) return false;
      let hx = (Array.isArray(size) ? size[0] : size) / 2;
      let hy = (Array.isArray(size) ? size[1] : size) / 2;
      return Math.abs(px - pos[0]) <= hx && Math.abs(py - pos[1]) <= hy;
    }

    // 2) obsługa kliku (mysz) – pomijamy niewidoczne rogi (opacity 0)
    let buttons = mouse.getPressed();
    if ((buttons[0] || buttons[1] || buttons[2]) && show_feedback === false) {
      for (let ix = 0; ix < lamp_grid.length; ix++) {
        for (let iy = 0; iy < lamp_grid[ix].length; iy++) {
          if (lamp_grid[ix][iy].opacity === 0) continue;
          if (mouse.isPressedIn(lamp_grid[ix][iy])) {
            clicked_x = ix;
            clicked_y = iy;
            rt = trialClock.getTime();
            correct = ((clicked_x === target_x) && (clicked_y === target_y)) ? 1 : 0;
            if (correct === 1) {
              lamp_grid[clicked_x][clicked_y].setImage('resources/lampkaON.png');
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
    if (show_feedback === false && window._touchJustStarted && window._touchPsychoX != null && window._touchCanvas) {
      for (let ix = 0; ix < lamp_grid.length; ix++) {
        for (let iy = 0; iy < lamp_grid[ix].length; iy++) {
          if (lamp_grid[ix][iy].opacity === 0) continue;
          if (pointInStim(window._touchPsychoX, window._touchPsychoY, lamp_grid[ix][iy])) {
            clicked_x = ix;
            clicked_y = iy;
            rt = trialClock.getTime();
            correct = ((clicked_x === target_x) && (clicked_y === target_y)) ? 1 : 0;
            if (correct === 1) {
              lamp_grid[clicked_x][clicked_y].setImage('resources/lampkaON.png');
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
      mouse.tStart = t;  // (not accounting for frame time here)
      mouse.frameNStart = frameN;  // exact frame index

      mouse.status = PsychoJS.Status.STARTED;
      mouse.mouseClock.reset();
      prevButtonState = mouse.getPressed();  // if button is down already this ISN'T a new click
    }

    // if mouse is active this frame...
    if (mouse.status === PsychoJS.Status.STARTED) {
      _mouseButtons = mouse.getPressed();
      if (!_mouseButtons.every((e, i,) => (e == prevButtonState[i]))) { // button state changed?
        prevButtonState = _mouseButtons;
        if (_mouseButtons.reduce((e, acc) => (e + acc)) > 0) { // state changed to a new click
          _mouseXYs = mouse.getPos();
          mouse.x.push(_mouseXYs[0]);
          mouse.y.push(_mouseXYs[1]);
          mouse.leftButton.push(_mouseButtons[0]);
          mouse.midButton.push(_mouseButtons[1]);
          mouse.rightButton.push(_mouseButtons[2]);
          mouse.time.push(mouse.mouseClock.getTime());
          if (gotValidClick === true) { // end routine on response
            continueRoutine = false;
          }
        }
      }
    }
    // check for quit (typically the Esc key)
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }

    // check if the Routine should terminate
    if (!continueRoutine) {  // a component has requested a forced-end of Routine
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;  // reverts to True if at least one component still running
    for (const thisComponent of trialComponents)
      if ('status' in thisComponent && thisComponent.status !== PsychoJS.Status.FINISHED) {
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
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('trial.stopped', globalClock.getTime());
    // Run 'End Routine' code from code
    psychoJS.experiment.addData('x_edge', x_edge);
    psychoJS.experiment.addData('y_edge', y_edge);
    psychoJS.experiment.addData('x_index', x_index);
    psychoJS.experiment.addData('y_index', y_index);
    psychoJS.experiment.addData('target_x', target_x);
    psychoJS.experiment.addData('target_y', target_y);
    psychoJS.experiment.addData('clicked_x', clicked_x);
    psychoJS.experiment.addData('clicked_y', clicked_y);
    psychoJS.experiment.addData('rt', rt);
    psychoJS.experiment.addData('correct', correct);

    // store data for psychoJS.experiment (ExperimentHandler)
    psychoJS.experiment.addData('mouse.x', mouse.x);
    psychoJS.experiment.addData('mouse.y', mouse.y);
    psychoJS.experiment.addData('mouse.leftButton', mouse.leftButton);
    psychoJS.experiment.addData('mouse.midButton', mouse.midButton);
    psychoJS.experiment.addData('mouse.rightButton', mouse.rightButton);
    psychoJS.experiment.addData('mouse.time', mouse.time);

    // the Routine "trial" was not non-slip safe, so reset the non-slip timer
    routineTimer.reset();

    // Routines running outside a loop should always advance the datafile row
    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  }
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
  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted) {
      let allData = (psychoJS.experiment._trialsData || []).filter(function (t) { return typeof t.correct !== 'undefined'; });
      let poprawneTrafienia = 0;
      let iloscKlikniecOgolem = 0;
      let noAnserw = 0;

      let sumRT = 0;
      let validRTCount = 0;
      for (let trial of allData) {
        if (trial.clicked_x != null && trial.clicked_y != null) {
          iloscKlikniecOgolem++;
          if (trial.correct === 1) poprawneTrafienia++;
          if (typeof trial.rt === 'number' && trial.rt >= 0) {
            sumRT += trial.rt;
            validRTCount++;
          }
        } else {
          noAnserw++;
        }
      }
      let sredniCzasReakcji = validRTCount > 0 ? Math.round((sumRT / validRTCount) * 1000) : 0;
      let bledneTrafienia = Math.max(0, iloscKlikniecOgolem - poprawneTrafienia) + noAnserw;
      let totalTrials = iloscKlikniecOgolem + noAnserw;
      let accuracy = totalTrials > 0 ? Math.round((poprawneTrafienia / totalTrials) * 100) : 0;

      window.electronTest.sendResults({
        testId: expInfo['expName'] || 'semafor',
        subjectId: expInfo['participant'],
        timestamp: new Date().toISOString(),
        ilosc_poprawnych_nacisniec: poprawneTrafienia,
        ilosc_blednych_nacisniec: bledneTrafienia,
        ogolna_ilosc_nacisniec: iloscKlikniecOgolem,
        ilosc_brakow_nacisniec: noAnserw,
        noAnserw: noAnserw,
        sredni_czas_reakcji: sredniCzasReakcji,
        score: `Kliknięć: ${iloscKlikniecOgolem} | Poprawne: ${poprawneTrafienia} | Błędne (w tym brak odp.): ${bledneTrafienia} | Brak odp.: ${noAnserw} | Skuteczność: ${accuracy}% | Śr. RT: ${sredniCzasReakcji} ms`,
        statystyki: {
          poprawne: poprawneTrafienia,
          bledne: bledneTrafienia,
          wszystkie_kliki: iloscKlikniecOgolem,
          brak_odpowiedzi: noAnserw,
          proby: allData.length,
          skutecznosc_proc: accuracy
        },
        wyniki: allData
      });
    } else {
      window.electronTest.close();
    }
  }
  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });
  return Scheduler.Event.QUIT;
}
