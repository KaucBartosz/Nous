/************ 
 * Syg *
 ************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
//some handy aliases as in the psychopy scripts;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;


// store info about the experiment session:
let expName = 'syg';  // from the Builder filename that created this script
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
  color: new util.Color([0,0,0]),
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
psychoJS.scheduleCondition(function() { return (psychoJS.gui.dialogComponent.button === 'OK'); },flowScheduler, dialogCancelScheduler);

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
    {'name': 'resources/sygCzer.png', 'path': 'resources/sygCzer.png'},
    {'name': 'resources/sam.png', 'path': 'resources/sam.png'},
    {'name': 'resources/sam.png', 'path': 'resources/sam.png'},
    {'name': 'resources/syg.png', 'path': 'resources/syg.png'},
    {'name': 'resources/sygCzer.png', 'path': 'resources/sygCzer.png'},
    {'name': 'resources/sygZiel.png', 'path': 'resources/sygZiel.png'},
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
var trialClock;
var left_signal;
var left_car;
var right_car;
var right_signal;
var globalClock;
var routineTimer;
async function experimentInit() {
  // Initialize components for Routine "welcome"
  welcomeClock = new util.Clock();
  text = new visual.TextStim({
    win: psychoJS.window,
    name: 'text',
    text: 'Za chwilę zobaczysz dwa samochody i dwie sygnalizacje świetlne. Za pomocą strzałek na klawiaturze lub przycisków A (prawo)/D (lewo), wskaż ten z samochodów, przy którym z sygnalizacja zmieni kolor na zielony. Staraj się reagować najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    font: 'Arial',
    units: undefined, 
    pos: [0, 0], draggable: false, height: 0.05,  wrapWidth: undefined, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'),  opacity: undefined,
    depth: 0.0 
  });
  
  key_resp = new core.Keyboard({psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true});
  
  // Initialize components for Routine "trial"
  trialClock = new util.Clock();
  left_signal = new visual.ImageStim({
    win : psychoJS.window,
    name : 'left_signal', units : undefined, 
    image : 'resources/sygCzer.png', mask : undefined,
    anchor : 'center',
    ori : 0.0, 
    pos : [(- 0.6), 0.2], 
    draggable: false,
    size : [0.15, 0.25],
    color : new util.Color([1,1,1]), opacity : undefined,
    flipHoriz : false, flipVert : false,
    texRes : 128.0, interpolate : true, depth : 0.0 
  });
  left_car = new visual.ImageStim({
    win : psychoJS.window,
    name : 'left_car', units : undefined, 
    image : 'resources/sam.png', mask : undefined,
    anchor : 'center',
    ori : 0.0, 
    pos : [(- 0.3), 0], 
    draggable: false,
    size : [0.2, 0.2],
    color : new util.Color([1,1,1]), opacity : undefined,
    flipHoriz : false, flipVert : false,
    texRes : 128.0, interpolate : true, depth : -1.0 
  });
  right_car = new visual.ImageStim({
    win : psychoJS.window,
    name : 'right_car', units : undefined, 
    image : 'resources/sam.png', mask : undefined,
    anchor : 'center',
    ori : 0.0, 
    pos : [0.3, 0], 
    draggable: false,
    size : [0.2, 0.2],
    color : new util.Color([1,1,1]), opacity : undefined,
    flipHoriz : false, flipVert : false,
    texRes : 128.0, interpolate : true, depth : -2.0 
  });
  right_signal = new visual.ImageStim({
    win : psychoJS.window,
    name : 'right_signal', units : undefined, 
    image : 'resources/sygCzer.png', mask : undefined,
    anchor : 'center',
    ori : 0.0, 
    pos : [0.6, 0.2], 
    draggable: false,
    size : [0.15, 0.25],
    color : new util.Color([1,1,1]), opacity : undefined,
    flipHoriz : false, flipVert : false,
    texRes : 128.0, interpolate : true, depth : -3.0 
  });
  // --- NOUS INTEGRATION: INIT ---
  if (typeof window.electronTest !== 'undefined') {
      console.log("Nous Launcher wykryty. Blokowanie zapisu CSV.");
      psychoJS.experiment.save = function() {
          return Promise.resolve(); 
      };
  }
  // --- Obsługa ekranu dotykowego (klik w samochód) ---
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
      psychoJS.window.callOnFlip(function() { key_resp.clock.reset(); });  // t=0 on next screen flip
      psychoJS.window.callOnFlip(function() { key_resp.start(); }); // start on screen flip
      psychoJS.window.callOnFlip(function() { key_resp.clearEvents(); });
    }
    
    // if key_resp is active this frame...
    if (key_resp.status === PsychoJS.Status.STARTED) {
      let theseKeys = key_resp.getKeys({keyList: ['y','n','left','right','space'], waitRelease: false});
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
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({keyList:['escape']}).length > 0) {
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
  return async function() {
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
      trialsLoopScheduler.add(trialRoutineBegin(snapshot));
      trialsLoopScheduler.add(trialRoutineEachFrame());
      trialsLoopScheduler.add(trialRoutineEnd(snapshot));
      trialsLoopScheduler.add(trialsLoopEndIteration(trialsLoopScheduler, snapshot));
    }
    
    return Scheduler.Event.NEXT;
  }
}


async function trialsLoopEnd() {
  // terminate loop
  psychoJS.experiment.removeLoop(trials);
  // update the current loop from the ExperimentHandler
  if (psychoJS.experiment._unfinishedLoops.length>0)
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


var trialMaxDurationReached;
var correct_side;
var clicked_side;
var rt;
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
    let sides = ['left', 'right'];
    correct_side = sides[Math.floor(Math.random() * sides.length)];
    
    left_signal.setImage("resources/sygCzer.png");
    right_signal.setImage("resources/sygCzer.png");
    
    
    trialClock = new util.Clock();
    clicked_side = null;
    rt = null;
    // Reset stanu dotyku dla nowej próby
    window._touchJustStarted = false;
    window._touchPsychoX = null;
    window._touchPsychoY = null;
    
    psychoJS.experiment.addData('trial.started', globalClock.getTime());
    trialMaxDuration = null
    // keep track of which components have finished
    trialComponents = [];
    trialComponents.push(left_signal);
    trialComponents.push(left_car);
    trialComponents.push(right_car);
    trialComponents.push(right_signal);
    
    for (const thisComponent of trialComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}


function trialRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'trial' ---
    // get current time
    t = trialClock.getTime();
    frameN = frameN + 1;// number of completed frames (so 0 is the first frame)
    // update/draw components on each frame
    
    // *left_signal* updates
    if (t >= 0.0 && left_signal.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      left_signal.tStart = t;  // (not accounting for frame time here)
      left_signal.frameNStart = frameN;  // exact frame index
      
      left_signal.setAutoDraw(true);
    }
    
    
    // if left_signal is active this frame...
    if (left_signal.status === PsychoJS.Status.STARTED) {
    }
    
    
    // *left_car* updates
    if (t >= 0.0 && left_car.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      left_car.tStart = t;  // (not accounting for frame time here)
      left_car.frameNStart = frameN;  // exact frame index
      
      left_car.setAutoDraw(true);
    }
    
    
    // if left_car is active this frame...
    if (left_car.status === PsychoJS.Status.STARTED) {
    }
    
    
    // *right_car* updates
    if (t >= 0.0 && right_car.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      right_car.tStart = t;  // (not accounting for frame time here)
      right_car.frameNStart = frameN;  // exact frame index
      
      right_car.setAutoDraw(true);
    }
    
    
    // if right_car is active this frame...
    if (right_car.status === PsychoJS.Status.STARTED) {
    }
    
    
    // *right_signal* updates
    if (t >= 0.0 && right_signal.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      right_signal.tStart = t;  // (not accounting for frame time here)
      right_signal.frameNStart = frameN;  // exact frame index
      
      right_signal.setAutoDraw(true);
    }
    
    
    // if right_signal is active this frame...
    if (right_signal.status === PsychoJS.Status.STARTED) {
    }
    
    // 1) Zmiana światła po 1s
    if (trialClock.getTime() >= 1.0) {
      if (correct_side === "left") {
        left_signal.setImage("resources/sygZiel.png");
      } else {
        right_signal.setImage("resources/sygZiel.png");
      }
    }
    
    // 2) Sprawdzanie wejścia (Klawiatura + Dotyk)
    let theseKeys = psychoJS.eventManager.getKeys({keyList: ['left', 'right', 'a', 'd']});

    function pointInStim(px, py, stim) {
      let pos = stim.pos || stim._pos;
      let size = stim.size || stim._size || [0.2, 0.2];
      if (!pos || (typeof pos[0] !== 'number') || (typeof pos[1] !== 'number')) return false;
      let hx = (Array.isArray(size) ? size[0] : size) / 2;
      let hy = (Array.isArray(size) ? size[1] : size) / 2;
      return Math.abs(px - pos[0]) <= hx && Math.abs(py - pos[1]) <= hy;
    }
    
    if (clicked_side === null) {
    
        // --- OBSŁUGA KLAWIATURY ---
        if (theseKeys.length > 0) {
            let keyName = theseKeys[0];
            if (trialClock.getTime() >= 1.0) {
                if (keyName === 'left' || keyName === 'a') {
                    clicked_side = "left";
                    rt = trialClock.getTime() - 1.0;
                } else if (keyName === 'right' || keyName === 'd') {
                    clicked_side = "right";
                    rt = trialClock.getTime() - 1.0;
                }
            } else {
                // Falstart klawiaturą
                clicked_side = "early";
                rt = 0;
            }
        }

        // --- OBSŁUGA EKRANU DOTYKOWEGO (klik w samochód) ---
        if (window._touchJustStarted && window._touchPsychoX != null && window._touchCanvas) {
            let now = trialClock.getTime();
            if (now >= 1.0) {
                if (pointInStim(window._touchPsychoX, window._touchPsychoY, left_car)) {
                    clicked_side = "left";
                    rt = now - 1.0;
                } else if (pointInStim(window._touchPsychoX, window._touchPsychoY, right_car)) {
                    clicked_side = "right";
                    rt = now - 1.0;
                }
            } else {
                // Falstart dotykiem
                if (pointInStim(window._touchPsychoX, window._touchPsychoY, left_car) ||
                    pointInStim(window._touchPsychoX, window._touchPsychoY, right_car)) {
                    clicked_side = "early";
                    rt = 0;
                }
            }
            window._touchJustStarted = false;
            window._touchPsychoX = null;
            window._touchPsychoY = null;
        } else if (window._touchJustStarted) {
            window._touchJustStarted = false;
            window._touchPsychoX = null;
            window._touchPsychoY = null;
        }
    }
    
    // 3) Koniec próby: dowolna reakcja lub timeout 3s
    if ((clicked_side !== null) || (trialClock.getTime() >= 3.0)) {
      continueRoutine = false;
    }
    // check for quit (typically the Esc key)
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({keyList:['escape']}).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
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


var outcome;
function trialRoutineEnd(snapshot) {
  return async function () {
    //--- Ending Routine 'trial' ---
    for (const thisComponent of trialComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('trial.stopped', globalClock.getTime());
    
    // Logika oceny wyniku (uwzględniająca falstart "early")
    if (clicked_side === null) {
        outcome = "too_slow";
    } else if (clicked_side === "early") {
        outcome = "incorrect"; // Falstart traktujemy jako błąd
    } else {
        if (clicked_side === correct_side) {
            outcome = "correct";
        } else {
            outcome = "incorrect";
        }
    }
    
    // Zapisywanie danych do eksperymentu
    psychoJS.experiment.addData("correct_side", correct_side);
    psychoJS.experiment.addData("clicked_side", clicked_side);
    psychoJS.experiment.addData("rt", rt);
    psychoJS.experiment.addData("outcome", outcome);
    
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
  // Check for and save orphaned data
  if (psychoJS.experiment.isEntryEmpty()) {
    psychoJS.experiment.nextEntry();
  }
  // --- NOUS INTEGRATION: SEND DATA ---
  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted) {
      // 1. Pobieramy surowe dane
      let rawData = psychoJS.experiment._trialsData || [];

      // 2. PRECYZYJNY FILTR: Zostawiamy tylko wiersze, które mają sensowny wynik
      let allData = rawData.filter(trial =>
          trial.outcome === 'correct' ||
          trial.outcome === 'incorrect' ||
          trial.outcome === 'too_slow'
      );

      // 3. Obliczenia na przefiltrowanej liście
      let totalTrials = allData.length;
      let correctCount = 0;
      let totalRT = 0;
      let validRTCount = 0;

      // Główne zmienne standardu Nous
      let poprawneNacisniecia = 0;
      let bledneNacisniecia = 0;
      let wszystkieNacisniecia = 0;

      for (let trial of allData) {
          let hasClick = trial.clicked_side !== null; // 'left', 'right', 'early'
          if (hasClick) {
              wszystkieNacisniecia++;
              if (trial.outcome === 'correct') {
                  poprawneNacisniecia++;
              } else if (trial.outcome === 'incorrect') {
                  bledneNacisniecia++;
              }
              if (typeof trial.rt === 'number' && trial.rt >= 0) {
                  totalRT += trial.rt;
                  validRTCount++;
              }
          }

          if (trial.outcome === 'correct') {
              correctCount++;
          }
      }

      // RT w ms
      let sredniCzasReakcji = validRTCount > 0 ? Math.round((totalRT / validRTCount) * 1000) : 0;
      let accuracy = totalTrials > 0 ? Math.round((correctCount / totalTrials) * 100) : 0;

      let payload = {
          testId: expInfo['expName'] || "Sygnalizacja",
          subjectId: expInfo['participant'],
          timestamp: new Date().toISOString(),

          // GŁÓWNY WYNIK (standaryzowane pola)
          ilosc_poprawnych_nacisniec: poprawneNacisniecia,
          ilosc_blednych_nacisniec: bledneNacisniecia,
          ogolna_ilosc_nacisniec: wszystkieNacisniecia,
          sredni_czas_reakcji: sredniCzasReakcji,

          // Zachowane pole kompatybilności
          czas_reakcji: sredniCzasReakcji,

          // Ujednolicony format score
          score: `Poprawne: ${poprawneNacisniecia} | Błędne: ${bledneNacisniecia} | Łącznie: ${wszystkieNacisniecia} | Skuteczność: ${accuracy}% | Śr. RT: ${sredniCzasReakcji} ms`,

          statystyki: {
              sredni_czas_ms: sredniCzasReakcji,
              poprawne: correctCount,
              wszystkie_proby: totalTrials,
              skutecznosc: accuracy,
              nacisniecia_poprawne: poprawneNacisniecia,
              nacisniecia_bledne: bledneNacisniecia,
              nacisniecia_lacznie: wszystkieNacisniecia
          },

          wyniki: allData
      };

      console.log("Wysyłanie do Nous...", payload);
      window.electronTest.sendResults(payload);
    } else {
      // ESC lub anulowanie dialogu – wyjście bez zapisu
      window.electronTest.close();
    }
  } else {
    console.log("Tryb przeglądarki.");
  }
  psychoJS.window.close();
  psychoJS.quit({message: message, isCompleted: isCompleted});
  
  return Scheduler.Event.QUIT;
}
