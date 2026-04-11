/******************** 
 * ZlapSygnal *
 ********************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
//some handy aliases as in the psychopy scripts;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;


// store info about the experiment session:
let expName = 'ZlapSygnal';  // from the Builder filename that created this script
let expInfo = {
  'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  'session': '001',
};

// --- KONFIGURACJA ZMIENNYCH ---
const APPEARANCE_RATE = 107;  // Częstotliwość pojawiania się znaków na minutę
const TIME_BETWEEN_CIRCLES = 60 / APPEARANCE_RATE;  // Czas między znakami w sekundach
const CIRCLE_SIZE = 0.15;  // Rozmiar kółka w jednostkach height

// Opcje czasu trwania testu (w sekundach)
const DURATION_OPTIONS = [30, 60, 90, 120];
let selectedDuration = 60;  // Domyślnie 60 sekund

// init psychoJS:
const psychoJS = new PsychoJS({
  debug: true
});

// open window:
psychoJS.openWindow({
  fullscr: true,
  color: new util.Color([(- 1.0), (- 1.0), (- 1.0)]),
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
flowScheduler.add(durationSelectionRoutineBegin());
flowScheduler.add(durationSelectionRoutineEachFrame());
flowScheduler.add(durationSelectionRoutineEnd());
flowScheduler.add(welcomeRoutineBegin());
flowScheduler.add(welcomeRoutineEachFrame());
flowScheduler.add(welcomeRoutineEnd());
flowScheduler.add(trialRoutineBegin());
flowScheduler.add(trialRoutineEachFrame());
flowScheduler.add(trialRoutineEnd());
flowScheduler.add(quitPsychoJS, 'Thank you for your patience.', true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, 'Thank you for your patience.', false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: [
    // resources:
    { 'name': 'resources/car.png', 'path': 'resources/car.png' },
    { 'name': 'resources/stop.png', 'path': 'resources/stop.png' },
    { 'name': 'resources/sygCzer.png', 'path': 'resources/sygCzer.png' },
    { 'name': 'resources/sygZiel.png', 'path': 'resources/sygZiel.png' },
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


var durationSelectionClock;
var durationText;
var durationButtons;
var durationMouse;
var welcomeClock;
var welcomeText;
var welcomeKey;
var trialClock;
var mouse;
var globalClock;
var routineTimer;
async function experimentInit() {
  // Initialize components for Routine "durationSelection"
  durationSelectionClock = new util.Clock();

  durationText = new visual.TextStim({
    win: psychoJS.window,
    name: 'durationText',
    text: 'Wybierz czas trwania testu poniżej',
    font: 'Arial',
    units: 'height',
    pos: [0, 0.3], draggable: false, height: 0.06, wrapWidth: 1.2, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });

  // Tworzenie przycisków wyboru czasu
  window.durationButtons = [];
  let buttonY = 0;
  let buttonSpacing = 0.15;
  for (let i = 0; i < DURATION_OPTIONS.length; i++) {
    let button = new visual.TextStim({
      win: psychoJS.window,
      name: 'durationButton' + i,
      text: DURATION_OPTIONS[i] + ' sekund',
      font: 'Arial',
      units: 'height',
      pos: [0, buttonY - i * buttonSpacing], draggable: false, height: 0.08, wrapWidth: undefined, ori: 0.0,
      languageStyle: 'LTR',
      color: new util.Color('lightgray'), opacity: undefined,
      depth: 1.0,
      borderColor: new util.Color('white'),
      borderWidth: 0.005
    });
    window.durationButtons.push(button);
  }

  durationMouse = new core.Mouse({
    win: psychoJS.window,
  });
  durationMouse.mouseClock = new util.Clock();

  // Initialize components for Routine "welcome"
  welcomeClock = new util.Clock();

  welcomeText = new visual.TextStim({
    win: psychoJS.window,
    name: 'welcomeText',
    text: 'Na ekranie w krótkich odstępach czasu pojawiać się będzie czerwone kółko. \nTwoim zadaniem jest, za pomocą MYSZY, kliknąć na samochód za każdym razem, gdy pojawi się nowe kółko. \nStaraj się reagować najszybciej jak potrafisz. \nAby rozpocząć zadanie, wciśnij SPACJĘ.',
    font: 'Arial',
    units: 'height',
    pos: [0, 0], draggable: false, height: 0.05, wrapWidth: 1.2, ori: 0.0,
    languageStyle: 'LTR',
    color: new util.Color('white'), opacity: undefined,
    depth: 0.0
  });

  welcomeKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

  // Initialize components for Routine "trial"
  trialClock = new util.Clock();

  // --- NOUS INTEGRATION: INIT ---
  if (typeof window.electronTest !== 'undefined') {
    psychoJS.experiment.save = function () { return Promise.resolve(); };
  }

  // Samochód - statyczny na środku na dole ekranu
  window.car = new visual.ImageStim({
    win: psychoJS.window,
    image: 'resources/car.png',
    size: [0.3, 0.15],
    pos: [0, -0.35]
  });

  // Zmienne do śledzenia kółek
  window.currentCircle = null;
  window.circleOnsetTime = null;
  window.nextCircleTime = null;
  window.responded = false;
  window.rt = null;
  window.correctCount = 0;
  window.missCount = 0;
  window.totalResponses = 0;
  window.rtSum = 0;
  window.rtList = [];
  window.trialResults = [];
  window.testStartTime = null;
  window.testEnded = false;
  window.clicksWithoutCircle = 0;  // Kliknięcia bez widocznego kółka

  mouse = new core.Mouse({
    win: psychoJS.window,
  });
  mouse.mouseClock = new util.Clock();

  // Create some handy timers
  globalClock = new util.Clock();  // to track the time since experiment started
  routineTimer = new util.CountdownTimer();  // to track time remaining of each (non-slip) routine

  // --- EKRAN DOTYKOWY: konwersja touch -> PsychoJS "height" units ---
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
var durationSelectionMaxDurationReached;
var durationSelectionMaxDuration;
var durationSelectionComponents;
function durationSelectionRoutineBegin(snapshot) {
  return async function () {
    TrialHandler.fromSnapshot(snapshot); // ensure that .thisN vals are up to date

    //--- Prepare to start Routine 'durationSelection' ---
    t = 0;
    frameN = -1;
    continueRoutine = true; // until we're told otherwise
    // keep track of whether this Routine was forcibly ended
    routineForceEnded = false;
    durationSelectionClock.reset();
    routineTimer.reset();
    durationSelectionMaxDurationReached = false;
    // update component parameters for each repeat
    psychoJS.experiment.addData('durationSelection.started', globalClock.getTime());
    durationSelectionMaxDuration = null;
    // keep track of which components have finished
    durationSelectionComponents = [];
    durationSelectionComponents.push(durationText);
    for (let i = 0; i < window.durationButtons.length; i++) {
      durationSelectionComponents.push(window.durationButtons[i]);
    }
    durationSelectionComponents.push(durationMouse);

    for (const thisComponent of durationSelectionComponents)
      if ('status' in thisComponent)
        thisComponent.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  }
}


function durationSelectionRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'durationSelection' ---
    // get current time
    t = durationSelectionClock.getTime();
    frameN = frameN + 1;// number of completed frames (so 0 is the first frame)
    // update/draw components on each frame

    // *durationText* updates
    if (t >= 0.0 && durationText.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      durationText.tStart = t;  // (not accounting for frame time here)
      durationText.frameNStart = frameN;  // exact frame index

      durationText.setAutoDraw(true);
    }

    // Rysowanie przycisków
    for (let i = 0; i < window.durationButtons.length; i++) {
      if (t >= 0.0 && window.durationButtons[i].status === PsychoJS.Status.NOT_STARTED) {
        window.durationButtons[i].setAutoDraw(true);
      }
    }

    // Sprawdzanie kliknięcia na przyciski (mysz)
    let mousePos = durationMouse.getPos();
    for (let i = 0; i < window.durationButtons.length; i++) {
      let button = window.durationButtons[i];
      let buttonPos = button.pos;
      let buttonHeight = button.height;
      let buttonWidth = 0.4;  // Przybliżona szerokość przycisku

      let isOverButton = mousePos[0] >= buttonPos[0] - buttonWidth / 2 &&
        mousePos[0] <= buttonPos[0] + buttonWidth / 2 &&
        mousePos[1] >= buttonPos[1] - buttonHeight / 2 &&
        mousePos[1] <= buttonPos[1] + buttonHeight / 2;

      if (isOverButton) {
        button.setColor(new util.Color('yellow'));

        if (durationMouse.getPressed()[0]) {
          selectedDuration = DURATION_OPTIONS[i];
          continueRoutine = false;
        }
      } else {
        button.setColor(new util.Color('lightgray'));
      }
    }

    // Obsługa ekranu dotykowego dla wyboru czasu trwania
    if (window._touchJustStarted && window._touchPsychoX != null) {
      for (let i = 0; i < window.durationButtons.length; i++) {
        let button = window.durationButtons[i];
        let buttonPos = button.pos;
        let buttonHeight = button.height;
        let buttonWidth = 0.4;

        if (window._touchPsychoX >= buttonPos[0] - buttonWidth / 2 &&
          window._touchPsychoX <= buttonPos[0] + buttonWidth / 2 &&
          window._touchPsychoY >= buttonPos[1] - buttonHeight / 2 &&
          window._touchPsychoY <= buttonPos[1] + buttonHeight / 2) {

          selectedDuration = DURATION_OPTIONS[i];
          continueRoutine = false;
          break;
        }
      }
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
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
    for (const thisComponent of durationSelectionComponents)
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


function durationSelectionRoutineEnd(snapshot) {
  return async function () {
    //--- Ending Routine 'durationSelection' ---
    for (const thisComponent of durationSelectionComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('durationSelection.stopped', globalClock.getTime());
    psychoJS.experiment.addData('selectedDuration', selectedDuration);

    // the Routine "durationSelection" was not non-slip safe, so reset the non-slip timer
    routineTimer.reset();

    // Routines running outside a loop should always advance the datafile row
    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  }
}


var welcomeMaxDurationReached;
var _welcomeKey_allKeys;
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
    welcomeKey.keys = undefined;
    welcomeKey.rt = undefined;
    _welcomeKey_allKeys = [];
    psychoJS.experiment.addData('welcome.started', globalClock.getTime());
    welcomeMaxDuration = null
    // keep track of which components have finished
    welcomeComponents = [];
    welcomeComponents.push(welcomeText);
    welcomeComponents.push(welcomeKey);

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


    // *welcomeKey* updates
    if (t >= 0.0 && welcomeKey.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      welcomeKey.tStart = t;  // (not accounting for frame time here)
      welcomeKey.frameNStart = frameN;  // exact frame index

      // keyboard checking is just starting
      psychoJS.window.callOnFlip(function () { welcomeKey.clock.reset(); });  // t=0 on next screen flip
      psychoJS.window.callOnFlip(function () { welcomeKey.start(); }); // start on screen flip
      psychoJS.window.callOnFlip(function () { welcomeKey.clearEvents(); });
    }

    // if welcomeKey is active this frame...
    if (welcomeKey.status === PsychoJS.Status.STARTED) {
      let theseKeys = welcomeKey.getKeys({ keyList: ['y', 'n', 'left', 'right', 'space'], waitRelease: false });
      _welcomeKey_allKeys = _welcomeKey_allKeys.concat(theseKeys);
      if (_welcomeKey_allKeys.length > 0) {
        welcomeKey.keys = _welcomeKey_allKeys[_welcomeKey_allKeys.length - 1].name;  // just the last key pressed
        welcomeKey.rt = _welcomeKey_allKeys[_welcomeKey_allKeys.length - 1].rt;
        welcomeKey.duration = _welcomeKey_allKeys[_welcomeKey_allKeys.length - 1].duration;
        // a response ends the routine
        continueRoutine = false;
      }
    }

    // Obsługa ekranu dotykowego dla ekranu powitalnego
    if (window._touchJustStarted && window._touchPsychoX != null) {
      // Dotknięcie dowolnego miejsca na ekranie rozpoczyna test
      continueRoutine = false;
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
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
      currentLoop.addResponse(welcomeKey.corr, level);
    }
    psychoJS.experiment.addData('welcomeKey.keys', welcomeKey.keys);
    if (typeof welcomeKey.keys !== 'undefined') {  // we had a response
      psychoJS.experiment.addData('welcomeKey.rt', welcomeKey.rt);
      psychoJS.experiment.addData('welcomeKey.duration', welcomeKey.duration);
      routineTimer.reset();
    }

    welcomeKey.stop();
    // the Routine "welcome" was not non-slip safe, so reset the non-slip timer
    routineTimer.reset();

    // Routines running outside a loop should always advance the datafile row
    if (currentLoop === psychoJS.experiment) {
      psychoJS.experiment.nextEntry(snapshot);
    }
    return Scheduler.Event.NEXT;
  }
}


var trialMaxDurationReached;
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

    // Reset zmiennych przed próbą
    window.currentCircle = null;
    window.circleOnsetTime = null;
    window.nextCircleTime = TIME_BETWEEN_CIRCLES;  // Pierwsze kółko po TIME_BETWEEN_CIRCLES sekundach
    window.waitingForRelease = false;
    window.circleTimeout = 0;
    window.responded = false;
    window.rt = null;
    window.correctCount = 0;
    window.missCount = 0;
    window.totalResponses = 0;
    window.rtSum = 0;
    window.rtList = [];
    window.trialResults = [];
    window.testStartTime = null;
    window.testEnded = false;
    window.circleId = 0;
    window.prevMouseState = false;
    window.clicksWithoutCircle = 0;  // Reset kliknięć bez kółka

    // setup some python lists for storing info about the mouse
    gotValidClick = false; // until a click is received
    mouse.mouseClock.reset();
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
function trialRoutineEachFrame() {
  return async function () {
    //--- Loop for each frame of Routine 'trial' ---
    // get current time
    t = trialClock.getTime();
    frameN = frameN + 1;// number of completed frames (so 0 is the first frame)
    // update/draw components on each frame

    let currentTime = trialClock.getTime();

    // Inicjalizacja czasu startu testu
    if (window.testStartTime === null) {
      window.testStartTime = currentTime;
    }

    // Sprawdzenie czy test się zakończył
    let elapsedTime = currentTime - window.testStartTime;
    if (elapsedTime >= selectedDuration) {
      window.testEnded = true;
      continueRoutine = false;
    }

    // Odczyt stanu myszy na początku klatki
    let buttons = mouse.getPressed();
    let isPressedNow = (buttons[0] || buttons[1] || buttons[2]);
    let isNewClick = isPressedNow && !window.prevMouseState;
    window.prevMouseState = isPressedNow;

    // Jeżeli czekaliśmy na puszczenie przycisku i gracz go puścił:
    if (window.waitingForRelease && !isPressedNow) {
      window.waitingForRelease = false;
      // Zaczynamy liczyć czas do następnego kółka dopiero teraz
      window.nextCircleTime = currentTime + TIME_BETWEEN_CIRCLES;
    }

    // Logika wyświetlania i wnikania kółek
    if (!window.testEnded) {
      // Sprawdzanie timeoutu dla widocznego kółka (miss)
      if (window.currentCircle !== null && !window.responded) {
        if (currentTime >= window.circleTimeout) {
          window.missCount++;
          window.trialResults.push({
            circleId: window.circleId,
            correct: 0,
            miss: 1,
            rt: null
          });
          window.currentCircle.setAutoDraw(false);
          window.currentCircle = null; // Ekran jest pusty
          // Po opuszczeniu kółka od razu odmierzamy czas do następnego
          window.nextCircleTime = currentTime + TIME_BETWEEN_CIRCLES;
        }
      }

      // Tworzenie nowego kółka
      if (window.currentCircle === null && !window.waitingForRelease && currentTime >= window.nextCircleTime) {
        window.circleId++;
        let randomX = (Math.random() - 0.5) * 1.0;  // Losowa pozycja X (±0.50, bez obrzeży)
        let randomY = -0.10 + Math.random() * 0.53;  // Losowa pozycja Y (od -0.10 do 0.43)

        window.currentCircle = new visual.Polygon({
          win: psychoJS.window,
          name: 'circle' + window.circleId,
          radius: CIRCLE_SIZE / 2,
          edges: 32,
          pos: [randomX, randomY],
          fillColor: new util.Color('red'),
          lineColor: new util.Color('red'),
          opacity: 1.0,
          depth: -1
        });
        window.currentCircle.setAutoDraw(true);
        window.circleOnsetTime = currentTime;
        window.responded = false;
        window.rt = null;

        // Czas po jakim kółko znika, jeśli gracz go nie kliknie (stały dla danego kółka ~0.84s)
        window.circleTimeout = currentTime + TIME_BETWEEN_CIRCLES * 1.5;
      }
    }

    // Rysowanie samochodu
    window.car.draw();

    // Obsługa poprawnego kliknięcia
    if (window.currentCircle !== null && !window.responded && isNewClick) {
      if (mouse.isPressedIn(window.car)) {
        window.responded = true;
        window.rt = currentTime - window.circleOnsetTime;
        window.correctCount++;
        window.totalResponses++;
        window.rtSum += window.rt;
        window.rtList.push(window.rt);

        window.trialResults.push({
          circleId: window.circleId,
          correct: 1,
          miss: 0,
          rt: window.rt
        });

        // Znikają cel i przechodzimy w tryb oczekiwania na puszczenie
        window.currentCircle.setAutoDraw(false);
        window.currentCircle = null;
        window.waitingForRelease = true;
      }
    }

    // Kliknięcie bez widocznego kółka (mysz)
    if (isNewClick && (window.currentCircle === null || window.responded)) {
      if (mouse.isPressedIn(window.car)) {
        window.clicksWithoutCircle++;
      }
    }

    // Obsługa ekranu dotykowego
    if (window.currentCircle !== null && !window.responded && window._touchJustStarted && window._touchPsychoX != null) {
      // Sprawdzenie czy dotknięcie jest na samochodzie
      let carPos = window.car.pos;
      let carSize = window.car.size;
      let hx = carSize[0] / 2;
      let hy = carSize[1] / 2;

      if (Math.abs(window._touchPsychoX - carPos[0]) <= hx &&
        Math.abs(window._touchPsychoY - carPos[1]) <= hy) {
        window.responded = true;
        window.rt = currentTime - window.circleOnsetTime;
        window.correctCount++;
        window.totalResponses++;
        window.rtSum += window.rt;
        window.rtList.push(window.rt);

        window.trialResults.push({
          circleId: window.circleId,
          correct: 1,
          miss: 0,
          rt: window.rt
        });

        // Ukrycie kółka po poprawnej reakcji
        window.currentCircle.setAutoDraw(false);
        window.currentCircle = null;
        window.waitingForRelease = false; // Dotyk == brak przytrzymania w tym modelu
        window.nextCircleTime = currentTime + TIME_BETWEEN_CIRCLES;
      }

      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    } else if (window._touchJustStarted && window._touchPsychoX != null) {
      // Dotyk bez widocznego kółka (ekran dotykowy)
      let carPos = window.car.pos;
      let carSize = window.car.size;
      let hx = carSize[0] / 2;
      let hy = carSize[1] / 2;

      if (Math.abs(window._touchPsychoX - carPos[0]) <= hx &&
        Math.abs(window._touchPsychoY - carPos[1]) <= hy) {
        window.clicksWithoutCircle++;
      }

      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    } else if (window._touchJustStarted) {
      window._touchJustStarted = false;
      window._touchPsychoX = null;
      window._touchPsychoY = null;
    }

    // *mouse* updates
    if (t >= 0.0 && mouse.status === PsychoJS.Status.NOT_STARTED) {
      // keep track of start time/frame for later
      mouse.tStart = t;  // (not accounting for frame time here)
      mouse.frameNStart = frameN;  // exact frame index

      mouse.status = PsychoJS.Status.STARTED;
      prevButtonState = mouse.getPressed();  // if button is down already this ISN'T a new click
    }

    // if mouse is active this frame...
    if (mouse.status === PsychoJS.Status.STARTED) {
      _mouseButtons = mouse.getPressed();
      if (!_mouseButtons.every((e, i,) => (e == prevButtonState[i]))) { // button state changed?
        prevButtonState = _mouseButtons;
        if (_mouseButtons.reduce((e, acc) => (e + acc)) > 0) { // state changed to a new click
          if (gotValidClick === true) { // end routine on response
            continueRoutine = false;
          }
        }
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


var _mouseXYs;
function trialRoutineEnd(snapshot) {
  return async function () {
    //--- Ending Routine 'trial' ---
    for (const thisComponent of trialComponents) {
      if (typeof thisComponent.setAutoDraw === 'function') {
        thisComponent.setAutoDraw(false);
      }
    }
    psychoJS.experiment.addData('trial.stopped', globalClock.getTime());

    // Obliczenie wyników
    let avgRT = window.totalResponses > 0 ? (window.rtSum / window.totalResponses) * 1000 : 0;  // w ms
    let totalCircles = window.correctCount + window.missCount;
    let percentCorrect = totalCircles > 0 ? (window.correctCount / totalCircles) * 100 : 0;

    psychoJS.experiment.addData('correctCount', window.correctCount);
    psychoJS.experiment.addData('missCount', window.missCount);
    psychoJS.experiment.addData('totalCircles', totalCircles);
    psychoJS.experiment.addData('avgRT', avgRT);
    psychoJS.experiment.addData('percentCorrect', percentCorrect);
    psychoJS.experiment.addData('selectedDuration', selectedDuration);
    psychoJS.experiment.addData('clicksWithoutCircle', window.clicksWithoutCircle);

    // store data for psychoJS.experiment (ExperimentHandler)
    _mouseXYs = mouse.getPos();
    _mouseButtons = mouse.getPressed();
    psychoJS.experiment.addData('mouse.x', _mouseXYs[0]);
    psychoJS.experiment.addData('mouse.y', _mouseXYs[1]);
    psychoJS.experiment.addData('mouse.leftButton', _mouseButtons[0]);
    psychoJS.experiment.addData('mouse.midButton', _mouseButtons[1]);
    psychoJS.experiment.addData('mouse.rightButton', _mouseButtons[2]);

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

  if (typeof window.electronTest !== 'undefined') {
    if (isCompleted) {
      // Obliczenie wyników
      let avgRT = window.totalResponses > 0 ? Math.round((window.rtSum / window.totalResponses) * 1000) : 0;  // w ms
      let totalCircles = window.correctCount + window.missCount;

      window.electronTest.sendResults({
        testId: expInfo['expName'],
        subjectId: expInfo['participant'],
        timestamp: new Date().toISOString(),
        ilosc_poprawnych_nacisniec: window.correctCount,
        ilosc_blednych_nacisniec: window.missCount,
        ogolna_ilosc_nacisniec: totalCircles,
        sredni_czas_reakcji: avgRT,
        klikniecia_bez_kolka: window.clicksWithoutCircle,
        score: `Poprawne: ${window.correctCount} | Misses: ${window.missCount} | Bez kółka: ${window.clicksWithoutCircle} | Łącznie: ${totalCircles} | Śr. RT: ${avgRT} ms`,
        wyniki: window.trialResults
      });
    } else {
      window.electronTest.close();
    }
  }

  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });

  return Scheduler.Event.QUIT;
}