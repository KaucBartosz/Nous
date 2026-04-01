/************* 
 * Stop *
 *************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
//some handy aliases as in the psychopy scripts;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;


// store info about the experiment session:
let expName = 'stop';  // from the Builder filename that created this script
let expInfo = {
  'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  'session': '001',
};
let PILOTING = util.getUrlParameters().has('__pilotToken');

// Start code blocks for 'Before Experiment'
// init psychoJS with error handling:
let psychoJS;
try {
  psychoJS = new PsychoJS({
    debug: true
  });
  console.log("PsychoJS initialized successfully");
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
  backgroundImage: 'resources/tlo.png',
  backgroundFit: 'fill',
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
const trialsLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(trialsLoopBegin(trialsLoopScheduler));
flowScheduler.add(trialsLoopScheduler);
flowScheduler.add(trialsLoopEnd);


flowScheduler.add(quitPsychoJS, 'Thank you for your patience.', true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, 'Thank you for your patience.', false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: [
    // resources:
      { 'name': 'resources/tlo.png', 'path': 'resources/tlo.png' },
      { 'name': 'resources/car.png', 'path': 'resources/car.png' },
      { 'name': 'resources/stop.png', 'path': 'resources/stop.png' },
      { 'name': 'tlo.png', 'path': 'resources/tlo.png' },
      { 'name': 'stop.png', 'path': 'resources/stop.png' },
      { 'name': 'resources/jelonek.png', 'path': 'resources/jelonek.png' },
      { 'name': 'resources/drzewo.png', 'path': 'resources/drzewo.png' }
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
var text;
var key_resp;
var driveClock;
var tlo;
var car;
var stopSign;
var jelonek;
var drzewo;
var mouse;
var globalClock;
var routineTimer;
async function experimentInit() {
  // Initialize components for Routine "welcome"
  welcomeClock = new util.Clock();
  text = new visual.TextStim({
    win: psychoJS.window,
    name: 'text',
    text: 'Twoim zadaniem będzie wcisnąć SPACJĘ, za każdym razem, gdy na ekranie pojawi się znak STOP. Staraj się reagować najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    font: 'Arial',
    units: undefined,
    pos: [0, 0], draggable: false, height: 0.05, wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });

  key_resp = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "drive"
  driveClock = new util.Clock();
  tlo = new visual.ImageStim({
    win: psychoJS.window,
    name: 'tlo', units: undefined,
    image: 'resources/tlo.png', mask: undefined,
    anchor: 'center',
    ori: 0.0,
    pos: [0, 0],
    draggable: false,
    size: [2, 1],
    color: new util.Color([1, 1, 1]), opacity: undefined,
    flipHoriz: false, flipVert: false,
    texRes: 128.0, interpolate: true, depth: 0.0
  });
  car = new visual.ImageStim({
    win: psychoJS.window,
    name: 'car', units: undefined,
    image: 'resources/car.png', mask: undefined,
    anchor: 'center',
    ori: 0.0,
    pos: [0, (- 0.3)],
    draggable: false,
    size: [0.28, 0.28],
    color: new util.Color([1, 1, 1]), opacity: undefined,
    flipHoriz: false, flipVert: false,
    texRes: 128.0, interpolate: true, depth: -1.0
  });
  stopSign = new visual.ImageStim({
    win: psychoJS.window,
    name: 'stopSign', units: undefined,
    image: 'resources/stop.png', mask: undefined,
    anchor: 'center',
    ori: 0.0,
    pos: [0, 0.2],
    draggable: false,
    size: [0.2, 0.2],
    color: new util.Color([1, 1, 1]), opacity: undefined,
    flipHoriz: false, flipVert: false,
    texRes: 128.0, interpolate: true, depth: -2.0
  });
  jelonek = new visual.ImageStim({
    win: psychoJS.window,
    name: 'jelonek', units: undefined,
    image: 'resources/jelonek.png', mask: undefined,
    anchor: 'center',
    ori: 0.0,
    pos: [0, 0],
    draggable: false,
    size: [0.15, 0.15],
    color: new util.Color([1, 1, 1]), opacity: undefined,
    flipHoriz: false, flipVert: false,
    texRes: 128.0, interpolate: true, depth: -1.5
  });
  drzewo = new visual.ImageStim({
    win: psychoJS.window,
    name: 'drzewo', units: undefined,
    image: 'resources/drzewo.png', mask: undefined,
    anchor: 'center',
    ori: 0.0,
    pos: [0, 0],
    draggable: false,
    size: [0.2, 0.3],
    color: new util.Color([1, 1, 1]), opacity: undefined,
    flipHoriz: false, flipVert: false,
    texRes: 128.0, interpolate: true, depth: -1.5
  });
  mouse = new core.Mouse({
    win: psychoJS.window,
  });
  mouse.mouseClock = new util.Clock();
  // --- INTEGRACJA Z LAUNCHEREM (INIT) ---
  if (typeof window.electronTest !== 'undefined') {
    console.log("Wykryto PsychoLauncher. Blokowanie zapisu CSV.");

    // Nadpisujemy funkcję zapisu - zwracamy pustą obietnicę, 
    // dzięki czemu PsychoPy myśli, że zapisało, ale nic nie pobiera.
    psychoJS.experiment.save = function () {
      return Promise.resolve();
    };
  }
  // --- Obsługa ekranu dotykowego (klik na auto / znak STOP) ---
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
  // Create some handy timers
  globalClock = new util.Clock();  // to track the time since experiment started
  routineTimer = new util.CountdownTimer();  // to track time remaining of each (non-slip) routine

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
    welcomeComponents.push(text);
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

    // *text* updates
    if (t >= 0.0 && text.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      text.tStart = t;  // (not accounting for frame time here)
      text.frameNStart = frameN;  // exact frame index

      text.setAutoDraw(true);
    }


    // if text is active this frame...
    if (text.status === PsychoJS.Status.STARTED) {
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
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
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


var trials;
function trialsLoopBegin(trialsLoopScheduler, snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // update internal variables (.thisN etc) of the loop

    // set up handler to look after randomisation of conditions etc
    trials = new TrialHandler({
      psychoJS: psychoJS,
      nReps: 50, method: TrialHandler.Method.RANDOM,
      extraInfo: expInfo, originPath: undefined,
      trialList: undefined,
      seed: undefined, name: 'trials'
    });
    psychoJS.experiment.addLoop(trials); // add the loop to the experiment
    currentLoop = trials;  // we're now the current loop

    // Schedule all the trials in the trialList:
    for (const thisTrial of trials) {
      snapshot = trials.getSnapshot();
      trialsLoopScheduler.add(importConditions(snapshot));
      trialsLoopScheduler.add(driveRoutineBegin(snapshot));
      trialsLoopScheduler.add(driveRoutineEachFrame());
      trialsLoopScheduler.add(driveRoutineEnd(snapshot));
      trialsLoopScheduler.add(trialsLoopEndIteration(trialsLoopScheduler, snapshot));
    }

    return Scheduler.Event.NEXT;
  }
}


async function trialsLoopEnd() {
  // terminate loop
  psychoJS.experiment.removeLoop(trials);
  // update the current loop from the ExperimentHandler
  if (psychoJS.experiment._unfinishedLoops.length > 0)
    currentLoop = psychoJS.experiment._unfinishedLoops.at(-1);
  else
    currentLoop = psychoJS.experiment;  // so we use addData from the experiment
  return Scheduler.Event.NEXT;
}


function trialsLoopEndIteration(scheduler, snapshot) {
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


var driveMaxDurationReached;
var gotValidClick;
var stopOnset;
var stop_visible;
var trialClock;
var stopClock;
var rt;
var responded;
var correct;
var isFalstart;
var car_start_x;
var car_y;
var car_speed;
var car_direction;
var anim_start_time;
var anim_pause_time;
var anim_is_paused;
var distraction_speed;
var driveMaxDuration;
var driveComponents;
function driveRoutineBegin(snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // ensure that .thisN vals are up to date

    //--- Prepare to start Routine 'drive' ---
    t = 0;
    frameN = -1;
    continueRoutine = true; // until we're told otherwise
    // keep track of whether this Routine was forcibly ended
    routineForceEnded = false;
    driveClock.reset();
    routineTimer.reset();
    driveMaxDurationReached = false;
    // update component parameters for each repeat
    // setup some python lists for storing info about the mouse
    // current position of the mouse:
    mouse.x = [];
    mouse.y = [];
    mouse.leftButton = [];
    mouse.midButton = [];
    mouse.rightButton = [];
    mouse.time = [];
    gotValidClick = false; // until a click is received
    // Run 'Begin Routine' code from code
    // losowy czas pojawienia STOP (1–3 s)
    stopOnset = 1.0 + Math.random() * 2.0;


    // STOP ukryty
    // losowy X dla znaku STOP
    let stopY = 0.2;
    let stopX = -0.6 + Math.random() * 1.2;  // zakres -0.6..0.6
    stopSign.setPos([stopX, stopY]);

    stop_visible = false;
    stopSign.setOpacity(0.0);

    // zegary
    trialClock = new util.Clock();
    stopClock = null;

    // odpowiedź
    rt = null;
    responded = false;
    correct = 0;
    isFalstart = false;

    // Samochód stoi w miejscu początkowym, ustawiamy parametry animacji
    car.setPos([0.25, -0.3]);
    anim_start_time = globalClock.getTime();
    anim_pause_time = 0;
    anim_is_paused = false;

    // Distractions setup (losowa strona, górna 1/3 ekranu)
    let side1 = Math.random() < 0.5 ? -1 : 1;
    let side2 = Math.random() < 0.5 ? -1 : 1;
    jelonek.setPos([side1 * (0.78 + Math.random() * 0.1), -0.1]);
    drzewo.setPos([side2 * (0.78 + Math.random() * 0.1), -0.1]);
    distraction_speed = 0.5 + Math.random() * 0.5; // units per second

    // Reset dotyku na początku próby
    window._touchJustStarted = false;
    window._touchPsychoX = null;
    window._touchPsychoY = null;
    window._prevMousePressed = true; // Zapobiega uznaniu trzymanego przycisku za nowy klik na początku próby
    psychoJS.eventManager.clearEvents();

    psychoJS.experiment.addData('drive.started', globalClock.getTime());
    driveMaxDuration = null
    // keep track of which components have finished
    driveComponents = [];
    driveComponents.push(tlo);
    driveComponents.push(car);
    driveComponents.push(stopSign);
    driveComponents.push(jelonek);
    driveComponents.push(drzewo);
    driveComponents.push(mouse);

    for (const thisComponent of driveComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}


var prevButtonState;
var _mouseButtons;
var _mouseXYs;
var x;
function driveRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'drive' ---
    // get current time
    t = driveClock.getTime();
    frameN = frameN + 1;// number of completed frames (so 0 is the first frame)
    // update/draw components on each frame

    // *tlo* updates
    if (t >= 0.0 && tlo.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      tlo.tStart = t;  // (not accounting for frame time here)
      tlo.frameNStart = frameN;  // exact frame index

      tlo.setAutoDraw(true);
    }


    // if tlo is active this frame...
    if (tlo.status === PsychoJS.Status.STARTED) {
    }


    // *car* updates
    if (t >= 0.0 && car.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      car.tStart = t;  // (not accounting for frame time here)
      car.frameNStart = frameN;  // exact frame index

      car.setAutoDraw(true);
    }


    // if car is active this frame...
    if (car.status === PsychoJS.Status.STARTED) {
    }


    // *stopSign* updates
    if (t >= 0.0 && stopSign.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      stopSign.tStart = t;  // (not accounting for frame time here)
      stopSign.frameNStart = frameN;  // exact frame index

      stopSign.setAutoDraw(true);
    }

    // if stopSign is active this frame...
    if (stopSign.status === PsychoJS.Status.STARTED) {
    }

    // *jelonek* updates
    if (t >= 0.0 && jelonek.status === PsychoJS.Status.NOT_STARTED) {
      jelonek.tStart = t;
      jelonek.frameNStart = frameN;
      jelonek.setAutoDraw(true);
    }

    // *drzewo* updates
    if (t >= 0.0 && drzewo.status === PsychoJS.Status.NOT_STARTED) {
      drzewo.tStart = t;
      drzewo.frameNStart = frameN;
      drzewo.setAutoDraw(true);
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
    // Run 'Each Frame' code from code

    function pointInStim(px, py, stim) {
      let pos = stim.pos || stim._pos;
      let size = stim.size || stim._size || [0.28, 0.28];
      if (!pos || (typeof pos[0] !== 'number') || (typeof pos[1] !== 'number')) return false;
      let hx = (Array.isArray(size) ? size[0] : size) / 2;
      let hy = (Array.isArray(size) ? size[1] : size) / 2;
      return Math.abs(px - pos[0]) <= hx && Math.abs(py - pos[1]) <= hy;
    }
    
    // Update car animation, stop for 2s if stopVisible
    let current_global_time = globalClock.getTime();
    
    let anim_time = current_global_time - anim_start_time;
    if (anim_is_paused) {
       anim_time = anim_pause_time - anim_start_time; // zamrożenie czasu
    }
    
    let car_y_offset = Math.sin(anim_time * Math.PI * 0.8) * 0.05; // zwolnione o 20%, 5% amplitudy
    car.setPos([0.25, -0.3 + car_y_offset]);

    // Move distractions
    if (!anim_is_paused) {
        let dt = frameDur || (1.0 / 60.0);
        let pos_j = jelonek.pos || jelonek._pos;
        jelonek.setPos([pos_j[0], pos_j[1] - distraction_speed * dt]);
        if (pos_j[1] < -0.6) {
             let side1 = Math.random() < 0.5 ? -1 : 1;
             jelonek.setPos([side1 * (0.78 + Math.random() * 0.1), -0.1]);
        }
        let pos_d = drzewo.pos || drzewo._pos;
        drzewo.setPos([pos_d[0], pos_d[1] - distraction_speed * dt]);
        if (pos_d[1] < -0.6) {
             let side2 = Math.random() < 0.5 ? -1 : 1;
             drzewo.setPos([side2 * (0.78 + Math.random() * 0.1), -0.1]);
        }
    }

    // --- pojawienie się STOP ---
    if (!stop_visible && t >= stopOnset) {
      stop_visible = true;
      stopSign.setOpacity(1.0);
      stopClock = new util.Clock();
    }

    // --- klik (mysz) w auto LUB znak STOP po pojawieniu się STOP ---
    let buttons = mouse.getPressed();
    let mouse_just_pressed = (buttons[0] || buttons[1] || buttons[2]) && !window._prevMousePressed;
    window._prevMousePressed = (buttons[0] || buttons[1] || buttons[2]);

    if (stop_visible && !responded && mouse_just_pressed) {
      if (mouse.isPressedIn(car) || mouse.isPressedIn(stopSign)) {
        responded = true;
        rt = stopClock.getTime();
        correct = 1;
        anim_is_paused = true;
        anim_pause_time = current_global_time;
      }
    }

    // --- spacja (klawiatura) po pojawieniu się STOP ---
    let keys = psychoJS.eventManager.getKeys({ keyList: ['space'], waitRelease: false });
    if (stop_visible && !responded && keys.length > 0) {
      responded = true;
      rt = stopClock.getTime();
      correct = 1;
      anim_is_paused = true;
      anim_pause_time = current_global_time;
    }

    // --- REAKCJA PRZED ZNAKIEM STOP (Falstart) ---
    if (!stop_visible && !responded) {
      let touch_down = window._touchJustStarted && window._touchPsychoX != null && window._touchCanvas;

      if (mouse_just_pressed || keys.length > 0 || touch_down) {
        responded = true;
        correct = 0;
        isFalstart = true;
        continueRoutine = false;
        if (touch_down) {
          window._touchJustStarted = false;
          window._touchPsychoX = null;
          window._touchPsychoY = null;
        }
      }
    }

    // --- dotyk w auto lub znak STOP ---
    if (stop_visible && !responded && window._touchJustStarted && window._touchPsychoX != null && window._touchCanvas) {
      if (pointInStim(window._touchPsychoX, window._touchPsychoY, car) ||
        pointInStim(window._touchPsychoX, window._touchPsychoY, stopSign)) {
        responded = true;
        rt = stopClock.getTime();
        correct = 1;
        anim_is_paused = true;
        anim_pause_time = current_global_time;
      }
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    } else if (window._touchJustStarted) {
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    }

    // --- zakończenie próby po zatrzymaniu animacji na 1s ---
    if (anim_is_paused && (current_global_time - anim_pause_time >= 1.0)) {
        continueRoutine = false;
    }

    // --- limit czasu 5 s od pojawienia się STOP ---
    if (stop_visible && stopClock && stopClock.getTime() >= 5.0 && !responded) {
      continueRoutine = false;
    }

    // check for quit (typically the Esc key)
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
    }

    // check if the Routine should terminate
    if (!continueRoutine) {  // a component has requested a forced-end of Routine
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }

    continueRoutine = false;  // reverts to True if at least one component still running
    for (const thisComponent of driveComponents)
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


function driveRoutineEnd(snapshot) {
  return async function () {
    //--- Ending Routine 'drive' ---
    for (const thisComponent of driveComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('drive.stopped', globalClock.getTime());
    // store data for psychoJS.experiment (ExperimentHandler)
    psychoJS.experiment.addData('mouse.x', mouse.x);
    psychoJS.experiment.addData('mouse.y', mouse.y);
    psychoJS.experiment.addData('mouse.leftButton', mouse.leftButton);
    psychoJS.experiment.addData('mouse.midButton', mouse.midButton);
    psychoJS.experiment.addData('mouse.rightButton', mouse.rightButton);
    psychoJS.experiment.addData('mouse.time', mouse.time);

    // Run 'End Routine' code from code
    psychoJS.experiment.addData('stopOnset', stopOnset);
    psychoJS.experiment.addData('rt', rt);
    psychoJS.experiment.addData('responded', responded);
    psychoJS.experiment.addData('correct', correct);
    psychoJS.experiment.addData('isFalstart', isFalstart);

    // the Routine "drive" was not non-slip safe, so reset the non-slip timer
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
  // Check for and save orphaned data
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }
  // --- INTEGRACJA Z LAUNCHEREM (WYSYŁKA DANYCH) ---

  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted) {
      // Pobieramy surowe dane tylko z prób (mają pole 'correct')
      let rawData = psychoJS.experiment._trialsData || [];
      let allData = rawData.filter(trial => typeof trial.correct !== 'undefined');

      // Zmienne do statystyk
      let totalTrials = allData.length;
      let totalRT = 0;
      let validRTCount = 0;
      let correctCount = 0;         // poprawne reakcje (kliknięcie auto/STOP gdy znak widoczny)
      let respondedCount = 0;       // wszystkie próby z reakcją (kliknięcie)
      let incorrectResponses = 0;   // reakcje błędne

      // Analiza danych
      for (let trial of allData) {
        let responded = !!trial.responded;
        let isCorrect = trial.correct === 1;

        if (responded) {
          respondedCount++;
          if (isCorrect) {
            correctCount++;
          } else {
            incorrectResponses++;
          }
          if (typeof trial.rt === 'number' && trial.rt >= 0) {
            totalRT += trial.rt;
            validRTCount++;
          }
        }
      }

      // Suma dobrych naciśnięć i naciśnięć przed znakiem (falstartów)
      let totalClicks = respondedCount;

      // Obliczenia (RT w ms)
      let sredniCzasReakcji = validRTCount > 0 ? Math.round((totalRT / validRTCount) * 1000) : 0;
      let accuracy = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;

      // Budujemy paczkę dla Launchera
      let payload = {
        testId: "Stop",
        subjectId: expInfo['participant'],
        timestamp: new Date().toISOString(),

        // Standaryzowane pola Nous
        ilosc_poprawnych_nacisniec: correctCount,
        ilosc_blednych_nacisniec: incorrectResponses,
        ogolna_ilosc_nacisniec: respondedCount,
        sredni_czas_reakcji: sredniCzasReakcji,

        // Ujednolicony format score
        score: `Poprawne: ${correctCount} | Błędne: ${incorrectResponses} | Łącznie: ${respondedCount} | Skuteczność: ${accuracy}% | Śr. RT: ${sredniCzasReakcji} ms`,

        // Statystyki szczegółowe
        statystyki: {
          poprawne_reakcje: correctCount,
          wszystkie_proby: totalTrials,
          skutecznosc: accuracy,
          reakcje: respondedCount,
          bledne_reakcje: incorrectResponses,
          falstarty: allData.filter(t => !!t.isFalstart).length
        },

        // Pełne dane (każda próba)
        wyniki: allData
      };

      console.log("Wysyłanie danych do Launchera...", payload);
      window.electronTest.sendResults(payload);
    } else {
      // ESC lub anulowanie dialogu – wyjście bez zapisu
      window.electronTest.close();
    }
  } else {
    console.log("Tryb przeglądarki - standardowy zapis CSV.");
  }
  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });

  return Scheduler.Event.QUIT;
}
