/*****************
 * Corsi - Test pamieci przestrzennej
 *****************/

import { core, data, util, visual } from "./lib/psychojs-2025.1.1.js";
import { lang, t as tr } from "./i18n.js";
import { localizePsychoJSDialogs } from "./dialog-i18n.js";
const { PsychoJS } = core;
const { Scheduler } = util;
const { floor, random } = Math;
const { round } = util;

localizePsychoJSDialogs(lang);

// Etykiety opcji trzymane osobno (PL), tłumaczone dopiero w momencie użycia.
const DIFFICULTY_NAMES_PL = [
  "Łatwy",
  "Średni",
  "Trudny",
  "Bardzo trudny",
  "Ekspert",
  "Mistrz",
  "Arcymistrz",
  "Legenda",
];
const SPEED_NAMES_PL = ["Łatwy", "Normalny", "Trudny"];
function difficultyLabel(level) {
  return tr("difficultyLabel", {
    difficultyName: tr("difficultyNames").split("|")[level - 1],
    n: DIFFICULTY_CONFIG[level].gridSize,
  });
}
function speedLabel(level) {
  return tr("speedLabel", {
    speedName: tr("speedNames").split("|")[level - 1],
    seconds: FLASH_SPEED_CONFIG[level].fd.toFixed(1),
  });
}

let expName = "Corsi";
let expInfo = {
  participant: `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
  session: "001",
};
const psychoJS = new PsychoJS({ debug: false });

psychoJS.openWindow({
  fullscr: true,
  color: new util.Color([0, 0, 0]),
  units: "height",
  waitBlanking: true,
  backgroundImage: "",
  backgroundFit: "none",
});

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

flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(welcomeRoutineBegin());
flowScheduler.add(welcomeRoutineEachFrame());
flowScheduler.add(welcomeRoutineEnd());
flowScheduler.add(difficultyRoutineBegin());
flowScheduler.add(difficultyRoutineEachFrame());
flowScheduler.add(difficultyRoutineEnd());
flowScheduler.add(flashSpeedRoutineBegin());
flowScheduler.add(flashSpeedRoutineEachFrame());
flowScheduler.add(flashSpeedRoutineEnd());
flowScheduler.add(gameRoutineBegin());
flowScheduler.add(gameRoutineEachFrame());
flowScheduler.add(gameRoutineEnd());
flowScheduler.add(quitPsychoJS, tr('quit.thanks'), true);

dialogCancelScheduler.add(quitPsychoJS, tr('quit.thanks'), false);

psychoJS.start({
  expName: expName,
  expInfo: expInfo,
  resources: [],
});

psychoJS.experimentLogger.setLevel(core.Logger.ServerLevel.INFO);

// ================= CONSTANTS (matching Python) =================
const BLOCK_DEFAULT_COLOR = [0.2, 0.05, 0.05];
const BLOCK_SYSTEM_COLOR = [0.9, 0.1, 0.1]; // czerwony  – sekwencja systemu
const BLOCK_PLAYER_COLOR = [0.1, 0.8, 0.1]; // zielony   – kliknięcia badanego
const BLOCK_SIZE = 0.08;
const GAP = 0.02;
const RESPONSE_TIMEOUT = 30;
const MAX_SEQUENCE_LENGTH = 20;
// 0.3 s kółko świeci po ostatnim kliknięciu + 1.0 s ciszy przed nową sekwencją
const FEEDBACK_DURATION = 1.3;

const DIFFICULTY_CONFIG = {
  1: { gridSize: 3 },
  2: { gridSize: 4 },
  3: { gridSize: 5 },
  4: { gridSize: 6 },
  5: { gridSize: 7 },
  6: { gridSize: 8 },
  7: { gridSize: 9 },
  8: { gridSize: 10 },
};

const FLASH_SPEED_CONFIG = {
  1: { fd: 1.0, fg: 0.3 },
  2: { fd: 0.5, fg: 0.2 },
  3: { fd: 0.3, fg: 0.15 },
};

var currentLoop;
var frameDur;
var t, frameN, continueRoutine, routineForceEnded;
var chosenDifficulty = 1,
  gridSize = 3,
  chosenFlashSpeed = 2,
  flashDuration = 0.5,
  flashGap = 0.2;
var gridBlocks = [],
  blockPositions = [];
var sequence = [],
  currentSequenceLength = 2,
  playerSequence = [];
var totalTrials = 0,
  correctTrials = 0,
  maxCorrectLength = 0;
var trialData = [];
var mouse, globalClock, routineTimer;
var welcomeClock, difficultyClock, flashSpeedClock, gameClock;
var _prevMouseButtons;
var clickOffTimer = 0;

async function updateInfo() {
  currentLoop = psychoJS.experiment;
  expInfo["date"] = util.MonotonicClock.getDateStr();
  expInfo["expName"] = expName;
  expInfo["psychopyVersion"] = "2025.1.1";
  expInfo["OS"] = window.navigator.platform;
  expInfo["frameRate"] = psychoJS.window.getActualFrameRate();
  frameDur =
    typeof expInfo["frameRate"] !== "undefined"
      ? 1.0 / round(expInfo["frameRate"])
      : 1.0 / 60.0;
  util.addInfoFromUrl(expInfo);
  psychoJS.experiment.dataFileName =
    "." + "/" + `data/${expInfo["participant"]}_${expName}_${expInfo["date"]}`;
  psychoJS.experiment.field_separator = "\t";
  return Scheduler.Event.NEXT;
}

async function experimentInit() {
  if (typeof window.electronTest !== "undefined") {
    psychoJS.experiment.save = function () {
      return Promise.resolve();
    };
  }
  welcomeClock = new util.Clock();
  difficultyClock = new util.Clock();
  flashSpeedClock = new util.Clock();
  gameClock = new util.Clock();
  mouse = new core.Mouse({ win: psychoJS.window });
  mouse.mouseClock = new util.Clock();
  globalClock = new util.Clock();
  routineTimer = new util.CountdownTimer();
  window._touchJustStarted = false;
  window._touchPsychoX = null;
  window._touchPsychoY = null;
  let canvas =
    (psychoJS.window._renderer && psychoJS.window._renderer.view) ||
    document.querySelector("canvas");
  if (canvas) {
    window._touchCanvas = canvas;
    function ttp(cx, cy) {
      let r = canvas.getBoundingClientRect();
      let a = r.width / r.height;
      return {
        x: ((2 * (cx - r.left)) / r.width - 1) * a,
        y: 1 - (2 * (cy - r.top)) / r.height,
      };
    }
    canvas.addEventListener(
      "touchstart",
      function (e) {
        e.preventDefault();
        if (e.touches.length > 0) {
          let p = ttp(e.touches[0].clientX, e.touches[0].clientY);
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
  return Scheduler.Event.NEXT;
}

function generateSequence(gs, length) {
  let tot = gs * gs,
    s = [],
    u = new Set();
  while (s.length < length) {
    let i = floor(random() * tot);
    if (!u.has(i)) {
      s.push(i);
      u.add(i);
      if (u.size >= tot * 0.8) u.clear();
    }
  }
  return s;
}

function pointInCircle(px, py, cx, cy, radius) {
  let dx = px - cx,
    dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

var welcomeText, welcomeKeys, welcomeComponents;

function welcomeRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    welcomeClock.reset();
    routineTimer.reset();
    welcomeText = new visual.TextStim({
      win: psychoJS.window,
      name: "welcomeText",
      text: tr('welcome'),
      font: "Arial",
      pos: [0, 0],
      height: 0.04,
      wrapWidth: 1.6,
      color: new util.Color("white"),
    });
    welcomeKeys = new core.Keyboard({
      psychoJS: psychoJS,
      clock: new util.Clock(),
      waitForStart: true,
    });
    welcomeKeys.keys = undefined;
    welcomeKeys.rt = undefined;
    welcomeComponents = [welcomeText, welcomeKeys];
    for (let c of welcomeComponents)
      if ("status" in c) c.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  };
}

function welcomeRoutineEachFrame(snapshot) {
  return async function () {
    t = welcomeClock.getTime();
    frameN++;
    if (t >= 0.0 && welcomeText.status === PsychoJS.Status.NOT_STARTED) {
      welcomeText.tStart = t;
      welcomeText.frameNStart = frameN;
      welcomeText.setAutoDraw(true);
    }
    if (t >= 0.0 && welcomeKeys.status === PsychoJS.Status.NOT_STARTED) {
      welcomeKeys.tStart = t;
      welcomeKeys.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () {
        welcomeKeys.clock.reset();
      });
      psychoJS.window.callOnFlip(function () {
        welcomeKeys.start();
      });
      psychoJS.window.callOnFlip(function () {
        welcomeKeys.clearEvents();
      });
    }
    if (welcomeKeys.status === PsychoJS.Status.STARTED) {
      let k = welcomeKeys.getKeys({
        keyList: ["space", "escape"],
        waitRelease: false,
      });
      if (k.length > 0) {
        if (k[0].name === "escape") return quitPsychoJS(tr('quit.escape'), true);
        continueRoutine = false;
      }
    }
    if (
      psychoJS.experiment.experimentEnded ||
      psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0
    )
      return quitPsychoJS(tr('quit.escape'), false);
    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    continueRoutine = false;
    for (let c of welcomeComponents)
      if ("status" in c && c.status !== PsychoJS.Status.FINISHED) {
        continueRoutine = true;
        break;
      }
    return continueRoutine ? Scheduler.Event.FLIP_REPEAT : Scheduler.Event.NEXT;
  };
}

function welcomeRoutineEnd(snapshot) {
  return async function () {
    for (let c of welcomeComponents)
      if (typeof c.setAutoDraw === "function") c.setAutoDraw(false);
    welcomeKeys.stop();
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  };
}

var diffText, diffKeys, diffComponents;

function difficultyRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    difficultyClock.reset();
    routineTimer.reset();
    diffText = new visual.TextStim({
      win: psychoJS.window,
      name: "diffText",
      text: tr('difficulty'),
      font: "Arial",
      pos: [0, 0],
      height: 0.04,
      wrapWidth: 1.6,
      color: new util.Color("white"),
    });
    diffKeys = new core.Keyboard({
      psychoJS: psychoJS,
      clock: new util.Clock(),
      waitForStart: true,
    });
    diffKeys.keys = undefined;
    diffKeys.rt = undefined;
    diffComponents = [diffText, diffKeys];
    for (let c of diffComponents)
      if ("status" in c) c.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  };
}

function difficultyRoutineEachFrame(snapshot) {
  return async function () {
    t = difficultyClock.getTime();
    frameN++;
    if (t >= 0.0 && diffText.status === PsychoJS.Status.NOT_STARTED) {
      diffText.tStart = t;
      diffText.frameNStart = frameN;
      diffText.setAutoDraw(true);
    }
    if (t >= 0.0 && diffKeys.status === PsychoJS.Status.NOT_STARTED) {
      diffKeys.tStart = t;
      diffKeys.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () {
        diffKeys.clock.reset();
      });
      psychoJS.window.callOnFlip(function () {
        diffKeys.start();
      });
      psychoJS.window.callOnFlip(function () {
        diffKeys.clearEvents();
      });
    }
    if (diffKeys.status === PsychoJS.Status.STARTED) {
      let k = diffKeys.getKeys({
        keyList: ["1", "2", "3", "4", "5", "6", "7", "8", "escape"],
        waitRelease: false,
      });
      if (k.length > 0) {
        if (k[0].name === "escape") return quitPsychoJS(tr('quit.escape'), false);
        let dl = parseInt(k[0].name);
        if (dl >= 1 && dl <= 8) {
          chosenDifficulty = dl;
          gridSize = DIFFICULTY_CONFIG[dl].gridSize;
        }
        continueRoutine = false;
      }
    }
    if (psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0)
      return quitPsychoJS(tr('quit.escape'), false);
    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    continueRoutine = false;
    for (let c of diffComponents)
      if ("status" in c && c.status !== PsychoJS.Status.FINISHED) {
        continueRoutine = true;
        break;
      }
    return continueRoutine ? Scheduler.Event.FLIP_REPEAT : Scheduler.Event.NEXT;
  };
}

function difficultyRoutineEnd(snapshot) {
  return async function () {
    for (let c of diffComponents)
      if (typeof c.setAutoDraw === "function") c.setAutoDraw(false);
    diffKeys.stop();
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  };
}

var speedText, speedKeys, speedComponents;

function flashSpeedRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    flashSpeedClock.reset();
    routineTimer.reset();
    speedText = new visual.TextStim({
      win: psychoJS.window,
      name: "speedText",
      text: tr('speed'),
      font: "Arial",
      pos: [0, 0],
      height: 0.04,
      wrapWidth: 1.6,
      color: new util.Color("white"),
    });
    speedKeys = new core.Keyboard({
      psychoJS: psychoJS,
      clock: new util.Clock(),
      waitForStart: true,
    });
    speedKeys.keys = undefined;
    speedKeys.rt = undefined;
    speedComponents = [speedText, speedKeys];
    for (let c of speedComponents)
      if ("status" in c) c.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  };
}

function flashSpeedRoutineEachFrame(snapshot) {
  return async function () {
    t = flashSpeedClock.getTime();
    frameN++;
    if (t >= 0.0 && speedText.status === PsychoJS.Status.NOT_STARTED) {
      speedText.tStart = t;
      speedText.frameNStart = frameN;
      speedText.setAutoDraw(true);
    }
    if (t >= 0.0 && speedKeys.status === PsychoJS.Status.NOT_STARTED) {
      speedKeys.tStart = t;
      speedKeys.frameNStart = frameN;
      psychoJS.window.callOnFlip(function () {
        speedKeys.clock.reset();
      });
      psychoJS.window.callOnFlip(function () {
        speedKeys.start();
      });
      psychoJS.window.callOnFlip(function () {
        speedKeys.clearEvents();
      });
    }
    if (speedKeys.status === PsychoJS.Status.STARTED) {
      let k = speedKeys.getKeys({
        keyList: ["1", "2", "3", "escape"],
        waitRelease: false,
      });
      if (k.length > 0) {
        if (k[0].name === "escape") return quitPsychoJS(tr('quit.escape'), false);
        let sl = parseInt(k[0].name);
        if (sl >= 1 && sl <= 3) {
          chosenFlashSpeed = sl;
          flashDuration = FLASH_SPEED_CONFIG[sl].fd;
          flashGap = FLASH_SPEED_CONFIG[sl].fg;
        }
        continueRoutine = false;
      }
    }
    if (psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0)
      return quitPsychoJS(tr('quit.escape'), false);
    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    continueRoutine = false;
    for (let c of speedComponents)
      if ("status" in c && c.status !== PsychoJS.Status.FINISHED) {
        continueRoutine = true;
        break;
      }
    return continueRoutine ? Scheduler.Event.FLIP_REPEAT : Scheduler.Event.NEXT;
  };
}

function flashSpeedRoutineEnd(snapshot) {
  return async function () {
    for (let c of speedComponents)
      if (typeof c.setAutoDraw === "function") c.setAutoDraw(false);
    speedKeys.stop();
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  };
}

var gameComponents, instrText, fbText, seqLenText;
var seqIdx, phase, flashT, respStart, fbT;

function gameRoutineBegin(snapshot) {
  return async function () {
    t = 0;
    frameN = -1;
    continueRoutine = true;
    routineForceEnded = false;
    gameClock.reset();
    routineTimer.reset();

    currentSequenceLength = 2;
    totalTrials = 0;
    correctTrials = 0;
    maxCorrectLength = 0;
    trialData = [];

    gridBlocks = [];
    blockPositions = [];
    let tw = gridSize * BLOCK_SIZE + (gridSize - 1) * GAP;
    let sx = -tw / 2 + BLOCK_SIZE / 2,
      sy = tw / 2 - BLOCK_SIZE / 2;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        let x = sx + c * (BLOCK_SIZE + GAP),
          y = sy - r * (BLOCK_SIZE + GAP);
        let b = new visual.Polygon({
          win: psychoJS.window,
          edges: 60,
          radius: BLOCK_SIZE / 2,
          pos: [x, y],
          fillColor: new util.Color(BLOCK_DEFAULT_COLOR),
          lineColor: new util.Color([1, 1, 1]),
          lineWidth: 2,
        });
        b.index = r * gridSize + c;
        gridBlocks.push(b);
        blockPositions.push({ x: x, y: y });
      }
    }

    instrText = new visual.TextStim({
      win: psychoJS.window,
      name: "instrText",
      text: tr('observe'),
      pos: [0, 0.45],
      height: 0.035,
      color: new util.Color("white"),
    });
    fbText = new visual.TextStim({
      win: psychoJS.window,
      name: "fbText",
      text: "",
      pos: [0, -0.45],
      height: 0.04,
      color: new util.Color("white"),
    });
    seqLenText = new visual.TextStim({
      win: psychoJS.window,
      name: "seqLenText",
      text: tr('length', { n: 2 }),
      pos: [0.5, 0.45],
      height: 0.025,
      color: new util.Color("gray"),
    });

    sequence = generateSequence(gridSize, currentSequenceLength);
    playerSequence = [];
    seqIdx = 0;
    phase = "show";
    flashT = 0;
    fbT = 0;
    clickOffTimer = 0;
    window.litState = new Array(gridBlocks.length).fill(0);

    mouse.x = [];
    mouse.y = [];
    mouse.leftButton = [];
    mouse.time = [];
    _prevMouseButtons = [false, false, false];

    psychoJS.experiment.addData("game.started", globalClock.getTime());
    gameComponents = [mouse, instrText, fbText, seqLenText];
    for (let c of gameComponents)
      if ("status" in c) c.status = PsychoJS.Status.NOT_STARTED;
    return Scheduler.Event.NEXT;
  };
}

function gameRoutineEachFrame(snapshot) {
  return async function () {
    t = gameClock.getTime();
    frameN++;
    let dt = frameDur || 0.016;

    for (let i = 0; i < gridBlocks.length; i++) {
      let ls = window.litState ? window.litState[i] : 0;
      let col =
        ls === 1
          ? BLOCK_SYSTEM_COLOR
          : ls === 2
            ? BLOCK_PLAYER_COLOR
            : BLOCK_DEFAULT_COLOR;
      gridBlocks[i].setFillColor(new util.Color(col));
      gridBlocks[i].draw();
    }

    if (t >= 0.0 && instrText.status === PsychoJS.Status.NOT_STARTED) {
      instrText.tStart = t;
      instrText.frameNStart = frameN;
      instrText.setAutoDraw(true);
    }
    if (t >= 0.0 && fbText.status === PsychoJS.Status.NOT_STARTED) {
      fbText.tStart = t;
      fbText.frameNStart = frameN;
      fbText.setAutoDraw(true);
    }
    if (t >= 0.0 && seqLenText.status === PsychoJS.Status.NOT_STARTED) {
      seqLenText.tStart = t;
      seqLenText.frameNStart = frameN;
      seqLenText.setAutoDraw(true);
    }

    if (!window.litState)
      window.litState = new Array(gridBlocks.length).fill(0);

    // clickOffTimer działa globalnie – niezależnie od fazy
    if (clickOffTimer > 0) {
      clickOffTimer -= dt;
      if (clickOffTimer <= 0) {
        for (let j = 0; j < window.litState.length; j++) window.litState[j] = 0;
      }
    }

    if (phase === "show") {
      flashT += dt;
      if (seqIdx < sequence.length) {
        if (flashT < flashDuration) {
          window.litState[sequence[seqIdx]] = 1; // system – czerwony
          instrText.setText(
            tr('observeProgress', {
              current: seqIdx + 1,
              total: sequence.length,
            }),
          );
        } else if (flashT < flashDuration + flashGap) {
          window.litState[sequence[seqIdx]] = 0;
        } else {
          seqIdx++;
          flashT = 0;
        }
      } else {
        phase = "wait";
        respStart = t;
        playerSequence = [];
        instrText.setText(tr('repeat'));
        fbText.setText("");
        for (let i = 0; i < window.litState.length; i++) window.litState[i] = 0;
      }
    }

    if (phase === "wait") {
      let btn = mouse.getPressed();
      let newClick = btn[0] && !_prevMouseButtons[0];
      _prevMouseButtons = [btn[0], btn[1], btn[2]];

      function doClick(cp) {
        for (let i = 0; i < gridBlocks.length; i++) {
          if (
            pointInCircle(
              cp[0],
              cp[1],
              blockPositions[i].x,
              blockPositions[i].y,
              BLOCK_SIZE / 2,
            )
          ) {
            playerSequence.push(i);
            window.litState[i] = 2; // gracz – zielony
            let ci = playerSequence.length - 1;
            if (playerSequence[ci] !== sequence[ci]) {
              totalTrials++;
              trialData.push({
                trial: totalTrials,
                sequenceLength: currentSequenceLength,
                result: "incorrect",
                responseTime: t - respStart,
              });
              fbText.setText(tr('error'));
              fbText.setColor(new util.Color("red"));
              instrText.setText(tr('watch'));
              // 0.3 s błędne kółko świeci na zielono, potem replay na czerwono
              phase = "error_replay";
              fbT = 0;
            } else if (playerSequence.length === sequence.length) {
              totalTrials++;
              correctTrials++;
              maxCorrectLength = Math.max(
                maxCorrectLength,
                currentSequenceLength,
              );
              trialData.push({
                trial: totalTrials,
                sequenceLength: currentSequenceLength,
                result: "correct",
                responseTime: t - respStart,
              });
              fbText.setText(tr('correct'));
              fbText.setColor(new util.Color("green"));
              if (currentSequenceLength < MAX_SEQUENCE_LENGTH)
                currentSequenceLength++;
              phase = "fb";
              fbT = 0;
              seqLenText.setText(tr('length', { n: currentSequenceLength }));
              clickOffTimer = 0.3;
            } else {
              clickOffTimer = 0.15;
            }
            return;
          }
        }
      }

      if (newClick) doClick(mouse.getPos());
      if (window._touchJustStarted && window._touchPsychoX != null) {
        doClick([window._touchPsychoX, window._touchPsychoY]);
        window._touchJustStarted = false;
        window._touchPsychoX = null;
        window._touchPsychoY = null;
      }

      if (t - respStart > RESPONSE_TIMEOUT) {
        totalTrials++;
        trialData.push({
          trial: totalTrials,
          sequenceLength: currentSequenceLength,
          result: "timeout",
          responseTime: RESPONSE_TIMEOUT,
        });
        fbText.setText(tr('timeout'));
        fbText.setColor(new util.Color("orange"));
        instrText.setText(tr('watch'));
        for (let j = 0; j < window.litState.length; j++) window.litState[j] = 0;
        // od razu zaczynamy replay (brak błędnego kółka do pokazania)
        phase = "error_replay";
        fbT = 0.3;
      }
    }

    // Po błędzie/timeoucie: pokaż poprawną sekwencję na czerwono, potem zakończ
    if (phase === "error_replay") {
      fbT += dt;
      const REPLAY_FLASH = 0.3; // czas świecenia jednego kółka
      const REPLAY_GAP = 0.15; // przerwa między kółkami
      const blockTime = REPLAY_FLASH + REPLAY_GAP;

      if (fbT >= REPLAY_FLASH) {
        // błędne kółko wyświetlało się przez pierwsze 0.3 s — teraz je gaszymy
        let replayTime = fbT - REPLAY_FLASH;
        let currentBlock = Math.floor(replayTime / blockTime);

        for (let j = 0; j < window.litState.length; j++) window.litState[j] = 0;

        if (currentBlock < sequence.length) {
          let timeInBlock = replayTime % blockTime;
          if (timeInBlock < REPLAY_FLASH) {
            window.litState[sequence[currentBlock]] = 1; // system – czerwony
          }
        } else {
          // cała sekwencja pokazana — czekamy FEEDBACK_DURATION i kończymy
          let postReplayTime = replayTime - sequence.length * blockTime;
          if (postReplayTime >= FEEDBACK_DURATION) {
            continueRoutine = false;
          }
        }
      }
    }

    if (phase === "fb") {
      fbT += dt;
      if (fbT >= FEEDBACK_DURATION) {
        for (let j = 0; j < window.litState.length; j++) window.litState[j] = 0;
        sequence = generateSequence(gridSize, currentSequenceLength);
        playerSequence = [];
        seqIdx = 0;
        phase = "show";
        flashT = 0;
        instrText.setText(tr('observe'));
        fbText.setText("");
      }
    }

    if (t >= 0.0 && mouse.status === PsychoJS.Status.NOT_STARTED) {
      mouse.tStart = t;
      mouse.frameNStart = frameN;
      mouse.status = PsychoJS.Status.STARTED;
      mouse.mouseClock.reset();
      _prevMouseButtons = mouse.getPressed();
    }

    if (psychoJS.eventManager.getKeys({ keyList: ["escape"] }).length > 0)
      return quitPsychoJS(tr('quit.escape'), false);
    if (!continueRoutine) {
      routineForceEnded = true;
      return Scheduler.Event.NEXT;
    }
    continueRoutine = false;
    for (let c of gameComponents)
      if ("status" in c && c.status !== PsychoJS.Status.FINISHED) {
        continueRoutine = true;
        break;
      }
    return continueRoutine ? Scheduler.Event.FLIP_REPEAT : Scheduler.Event.NEXT;
  };
}

function gameRoutineEnd(snapshot) {
  return async function () {
    for (let c of gameComponents)
      if (typeof c.setAutoDraw === "function") c.setAutoDraw(false);
    routineTimer.reset();
    return Scheduler.Event.NEXT;
  };
}

async function quitPsychoJS(message, isCompleted) {
  if (psychoJS.experiment.isEntryEmpty()) psychoJS.experiment.nextEntry();
  if (typeof window.electronTest !== "undefined" && isCompleted) {
    let acc =
      totalTrials > 0 ? Math.round((correctTrials / totalTrials) * 100) : 0;
    let ct = trialData
      .filter((d) => d.result === "correct")
      .map((d) => d.responseTime);
    let avgRT =
      ct.length > 0
        ? Math.round(ct.reduce((a, b) => a + b * 1000, 0) / ct.length)
        : 0;
    let labels = [""];
    for (let i = 1; i <= 8; i++) labels.push(difficultyLabel(i));
    let speedLabels = [""];
    for (let i = 1; i <= 3; i++) speedLabels.push(speedLabel(i));
    window.electronTest.sendResults({
      testId: expName,
      subjectId: expInfo["participant"],
      timestamp: new Date().toISOString(),
      ilosc_poprawnych_nacisniec: correctTrials,
      ilosc_blednych_nacisniec: totalTrials - correctTrials,
      ogolna_ilosc_nacisniec: totalTrials,
      sredni_czas_reakcji: avgRT,
      max_dlugosc_sekwencji: maxCorrectLength,
      poziom_trudnosci: difficultyLabel(chosenDifficulty),
      rozmiar_siatki: gridSize + "x" + gridSize,
      szybkosc_swiecenia: speedLabel(chosenFlashSpeed),
      score: tr("score", {
        max: maxCorrectLength,
        correct: correctTrials,
        total: totalTrials,
        accuracy: acc,
        rt: avgRT,
        difficulty: difficultyLabel(chosenDifficulty),
        speed: speedLabel(chosenFlashSpeed),
      }),
      statystyki: {
        poprawne: correctTrials,
        bledne: totalTrials - correctTrials,
        wszystkie_proby: totalTrials,
        skutecznosc: acc,
        max_sekwencja: maxCorrectLength,
        sredni_czas_ms: avgRT,
        poziom: chosenDifficulty,
        rozmiar_siatki: gridSize,
        szybkosc_swiecenia: chosenFlashSpeed,
      },
      wyniki_szczegolowe: trialData,
    });
  } else if (typeof window.electronTest !== "undefined") {
    window.electronTest.close();
  }
  if (!isCompleted && message === tr("quit.escape")) message = tr("quit.escapeCompleted");
  psychoJS.window.close();
  psychoJS.quit({ message: message, isCompleted: isCompleted });
  return Scheduler.Event.QUIT;
}
