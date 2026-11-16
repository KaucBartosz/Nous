/******************** 
 * PingPong *
 ********************/

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler, MultiStairHandler } = data;
const { Scheduler } = util;
const { abs, sin, cos, PI: pi, sqrt } = Math;
const { round } = util;

// Store info about the experiment session:
let expName = 'pingpong';
let expInfo = {
    'participant': `${util.pad(Number.parseFloat(util.randint(0, 999999)).toFixed(0), 6)}`,
    'session': '001',
};

// Game configuration
const TEST_DURATION = 120; // 2 minutes in seconds
const DIFFICULTY_SETTINGS = {
    'Easy':     { baseSpeed: 0.005,  paddleHeight: 0.25 },
    'Normal':   { baseSpeed: 0.0096, paddleHeight: 0.20 },
    'Hard':     { baseSpeed: 0.0096, paddleHeight: 0.18 },
    'Survival': { baseSpeed: 0.0096, paddleHeight: 0.18 }  // Jeden błąd = koniec, bez limitu czasu
};

// Game state
let gameState = {
    difficulty: 'Normal',
    baseSpeed: 0.008,
    maxSpeedMultiplier: 4,           // x4 max speed (not used in Survival)
    speedIncreaseInterval: 1.5,      // Faster: every 1.5 seconds instead of 2
    speedIncreaseAmount: 0.2,        // Faster: 0.2 instead of 0.1 per increase
    leftWallHits: 0,
    rightWallHits: 0,
    totalWallHits: 0,
    speedMultiplier: 1,
    speedChanges: 0,
    maxSpeedReached: 1,
    survivalTime: 0,                 // Czas przeżycia w trybie Survival
    paddleHits: 0                    // Liczba odbić paletką
};

// Game objects
let leftPaddle, rightPaddle, ball;
let leftWall, rightWall;
let timerText;
let ballVelocity = { x: 0, y: 0 };
let keysPressed = {};
let lastPaddleHitTime = 0;

// Init psychoJS:
const psychoJS = new PsychoJS({
    debug: true
});

// Open window:
psychoJS.openWindow({
    fullscr: true,
    color: new util.Color([(-1.0), (-1.0), (-1.0)]),
    units: 'height',
    waitBlanking: true,
    backgroundImage: '',
    backgroundFit: 'none',
});

// Schedule the experiment:
psychoJS.schedule(psychoJS.gui.DlgFromDict({
    dictionary: expInfo,
    title: expName
}));

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(function() { return (psychoJS.gui.dialogComponent.button === 'OK'); }, flowScheduler, dialogCancelScheduler);

// flowScheduler gets run if the participants presses OK
flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(welcomeRoutineBegin());
flowScheduler.add(welcomeRoutineEachFrame());
flowScheduler.add(welcomeRoutineEnd());
flowScheduler.add(difficultyRoutineBegin());
flowScheduler.add(difficultyRoutineEachFrame());
flowScheduler.add(difficultyRoutineEnd());
flowScheduler.add(gameRoutineBegin());
flowScheduler.add(gameRoutineEachFrame());
flowScheduler.add(gameRoutineEnd());
flowScheduler.add(resultsRoutineBegin());
flowScheduler.add(resultsRoutineEachFrame());
flowScheduler.add(resultsRoutineEnd());
flowScheduler.add(quitPsychoJS, 'Thank you for your patience.', true);

// quit if user presses Cancel in dialog box:
dialogCancelScheduler.add(quitPsychoJS, 'Thank you for your patience.', false);

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

var welcomeClock;
var welcomeText;
var welcomeKey;
var difficultyClock;
var difficultyText;
var difficultyKey;
var gameClock;
var globalClock;
var routineTimer;
var resultsClock;
var resultsText;
var resultsKey;

async function experimentInit() {
    // Initialize components for Routine "welcome"
    welcomeClock = new util.Clock();
    welcomeText = new visual.TextStim({
        win: psychoJS.window,
        name: 'welcomeText',
        text: 'PING PONG - Test Koordynacji\n\n' +
              'Twoim zadaniem jest odbijanie piłki za pomocą dwóch paletek.\n\n' +
              'LEWA PALETKA: klawisze W (góra) i S (dół)\n' +
              'PRAWA PALETKA: strzałki góra i dół lub klawisze O (góra) i L (dół)\n\n' +
              'Test trwa 2 minuty. Odbijaj piłkę jak najdłużej!\n\n' +
              'Naciśnij SPACJĘ, aby wybrać poziom trudności\n' +
              'ESC - wyjście bez zapisu',
        font: 'Arial',
        units: undefined,
        pos: [0, 0], draggable: false, height: 0.04, wrapWidth: undefined, ori: 0.0,
        languageStyle: 'LTR',
        color: new util.Color('white'), opacity: undefined,
        depth: 0.0
    });
    
    welcomeKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    // Initialize components for Routine "difficulty"
    difficultyClock = new util.Clock();
    difficultyText = new visual.TextStim({
        win: psychoJS.window,
        name: 'difficultyText',
        text: 'WYBIERZ POZIOM TRUDNOŚCI\n\n' +
              '1 - ŁATWY (wolniejsza piłka, większe paletki)\n' +
              '2 - NORMALNY (standardowa prędkość)\n' +
              '3 - TRUDNY (prędkość rośnie z czasem)\n' +
              '4 - PRZETRWANIE (jeden błąd = koniec, bez limitu czasu)\n\n' +
              'Naciśnij 1, 2, 3 lub 4',
        font: 'Arial',
        units: undefined,
        pos: [0, 0], draggable: false, height: 0.04, wrapWidth: undefined, ori: 0.0,
        languageStyle: 'LTR',
        color: new util.Color('white'), opacity: undefined,
        depth: 0.0
    });
    
    difficultyKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    // Initialize components for Routine "game"
    gameClock = new util.Clock();
    
    // --- NOUS INTEGRATION: INIT ---
    if (typeof window.electronTest !== 'undefined') {
        psychoJS.experiment.save = function() { return Promise.resolve(); };
    }
    
    // Create some handy timers
    globalClock = new util.Clock();
    routineTimer = new util.CountdownTimer();

    // Initialize components for Routine "results"
    resultsClock = new util.Clock();
    resultsText = new visual.TextStim({
        win: psychoJS.window,
        name: 'resultsText',
        text: '',
        font: 'Arial',
        units: undefined,
        pos: [0, 0], draggable: false, height: 0.05, wrapWidth: undefined, ori: 0.0,
        languageStyle: 'LTR',
        color: new util.Color('white'), opacity: undefined,
        depth: 0.0
    });
    
    resultsKey = new core.Keyboard({ psychoJS: psychoJS, clock: new util.Clock(), waitForStart: true });

    // Set up keyboard events for continuous key tracking
    document.addEventListener('keydown', function(event) {
        keysPressed[event.key] = true;
    });
    document.addEventListener('keyup', function(event) {
        keysPressed[event.key] = false;
    });

    return Scheduler.Event.NEXT;
}

var t;
var frameN;
var continueRoutine;
var routineForceEnded;
var _welcomeKey_allKeys;
var welcomeComponents;

function welcomeRoutineBegin(snapshot) {
    return async function() {
        TrialHandler.fromSnapshot(snapshot);
        
        t = 0;
        frameN = -1;
        continueRoutine = true;
        routineForceEnded = false;
        welcomeClock.reset();
        routineTimer.reset();
        
        welcomeKey.keys = undefined;
        welcomeKey.rt = undefined;
        _welcomeKey_allKeys = [];
        psychoJS.experiment.addData('welcome.started', globalClock.getTime());
        
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
    return async function() {
        t = welcomeClock.getTime();
        frameN = frameN + 1;
        
        if (t >= 0.0 && welcomeText.status === PsychoJS.Status.NOT_STARTED) {
            welcomeText.tStart = t;
            welcomeText.frameNStart = frameN;
            welcomeText.setAutoDraw(true);
        }
        
        if (t >= 0.0 && welcomeKey.status === PsychoJS.Status.NOT_STARTED) {
            welcomeKey.tStart = t;
            welcomeKey.frameNStart = frameN;
            psychoJS.window.callOnFlip(function() { welcomeKey.clock.reset(); });
            psychoJS.window.callOnFlip(function() { welcomeKey.start(); });
            psychoJS.window.callOnFlip(function() { welcomeKey.clearEvents(); });
        }
        
        if (welcomeKey.status === PsychoJS.Status.STARTED) {
            let theseKeys = welcomeKey.getKeys({ keyList: ['space'], waitRelease: false });
            _welcomeKey_allKeys = _welcomeKey_allKeys.concat(theseKeys);
            if (_welcomeKey_allKeys.length > 0) {
                welcomeKey.keys = _welcomeKey_allKeys[_welcomeKey_allKeys.length - 1].name;
                welcomeKey.rt = _welcomeKey_allKeys[_welcomeKey_allKeys.length - 1].rt;
                welcomeKey.duration = _welcomeKey_allKeys[_welcomeKey_allKeys.length - 1].duration;
                continueRoutine = false;
            }
        }
        
        // Check for quit (ESC key)
        if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
            return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
        }
        
        if (!continueRoutine) {
            routineForceEnded = true;
            return Scheduler.Event.NEXT;
        }
        
        continueRoutine = false;
        for (const thisComponent of welcomeComponents)
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

function welcomeRoutineEnd(snapshot) {
    return async function() {
        for (const thisComponent of welcomeComponents) {
            if (typeof thisComponent.setAutoDraw === 'function') {
                thisComponent.setAutoDraw(false);
            }
        }
        psychoJS.experiment.addData('welcome.stopped', globalClock.getTime());
        welcomeKey.stop();
        routineTimer.reset();
        
        if (currentLoop === psychoJS.experiment) {
            psychoJS.experiment.nextEntry(snapshot);
        }
        return Scheduler.Event.NEXT;
    }
}

var _difficultyKey_allKeys;
var difficultyComponents;

function difficultyRoutineBegin(snapshot) {
    return async function() {
        TrialHandler.fromSnapshot(snapshot);
        
        t = 0;
        frameN = -1;
        continueRoutine = true;
        routineForceEnded = false;
        difficultyClock.reset();
        routineTimer.reset();
        
        difficultyKey.keys = undefined;
        difficultyKey.rt = undefined;
        _difficultyKey_allKeys = [];
        psychoJS.experiment.addData('difficulty.started', globalClock.getTime());
        
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
    return async function() {
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
            psychoJS.window.callOnFlip(function() { difficultyKey.clock.reset(); });
            psychoJS.window.callOnFlip(function() { difficultyKey.start(); });
            psychoJS.window.callOnFlip(function() { difficultyKey.clearEvents(); });
        }
        
        if (difficultyKey.status === PsychoJS.Status.STARTED) {
            let theseKeys = difficultyKey.getKeys({ keyList: ['1', '2', '3', '4'], waitRelease: false });
            _difficultyKey_allKeys = _difficultyKey_allKeys.concat(theseKeys);
            if (_difficultyKey_allKeys.length > 0) {
                difficultyKey.keys = _difficultyKey_allKeys[_difficultyKey_allKeys.length - 1].name;
                difficultyKey.rt = _difficultyKey_allKeys[_difficultyKey_allKeys.length - 1].rt;
                difficultyKey.duration = _difficultyKey_allKeys[_difficultyKey_allKeys.length - 1].duration;
                
                // Set difficulty based on key
                if (difficultyKey.keys === '1') {
                    gameState.difficulty = 'Easy';
                } else if (difficultyKey.keys === '2') {
                    gameState.difficulty = 'Normal';
                } else if (difficultyKey.keys === '3') {
                    gameState.difficulty = 'Hard';
                } else if (difficultyKey.keys === '4') {
                    gameState.difficulty = 'Survival';
                }
                continueRoutine = false;
            }
        }
        
        // Check for quit (ESC key)
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
    return async function() {
        for (const thisComponent of difficultyComponents) {
            if (typeof thisComponent.setAutoDraw === 'function') {
                thisComponent.setAutoDraw(false);
            }
        }
        psychoJS.experiment.addData('difficulty.stopped', globalClock.getTime());
        psychoJS.experiment.addData('selected_difficulty', gameState.difficulty);
        difficultyKey.stop();
        routineTimer.reset();
        
        if (currentLoop === psychoJS.experiment) {
            psychoJS.experiment.nextEntry(snapshot);
        }
        return Scheduler.Event.NEXT;
    }
}

var gameComponents;

function gameRoutineBegin(snapshot) {
    return async function() {
        TrialHandler.fromSnapshot(snapshot);
        
        t = 0;
        frameN = -1;
        continueRoutine = true;
        routineForceEnded = false;
        gameClock.reset();
        routineTimer.reset();
        
        // Apply difficulty settings
        let settings = DIFFICULTY_SETTINGS[gameState.difficulty];
        gameState.baseSpeed = settings.baseSpeed;
        gameState.speedMultiplier = 1;
        gameState.leftWallHits = 0;
        gameState.rightWallHits = 0;
        gameState.totalWallHits = 0;
        gameState.speedChanges = 0;
        gameState.maxSpeedReached = 1;
        gameState.survivalTime = 0;
        gameState.paddleHits = 0;
        
        // Create left paddle
        leftPaddle = new visual.Rect({
            win: psychoJS.window,
            name: 'leftPaddle',
            width: 0.02,
            height: settings.paddleHeight,
            fillColor: new util.Color('white'),
            lineColor: new util.Color('white'),
            pos: [-0.45, 0],
            ori: 0
        });
        
        // Create right paddle
        rightPaddle = new visual.Rect({
            win: psychoJS.window,
            name: 'rightPaddle',
            width: 0.02,
            height: settings.paddleHeight,
            fillColor: new util.Color('white'),
            lineColor: new util.Color('white'),
            pos: [0.45, 0],
            ori: 0
        });
        
    // Create ball (use Polygon with many vertices to approximate a circle)
    ball = new visual.Polygon({
        win: psychoJS.window,
        name: 'ball',
        edges: 100,
        radius: 0.015,
        fillColor: new util.Color('white'),
        lineColor: new util.Color('white'),
        pos: [0, 0],
        ori: 0
    });
    
    // Create visible left wall (red line)
    leftWall = new visual.Rect({
        win: psychoJS.window,
        name: 'leftWall',
        width: 0.005,
        height: 1.0,
        fillColor: new util.Color('red'),
        lineColor: new util.Color('red'),
        pos: [-0.5, 0],
        ori: 0
    });
    
    // Create visible right wall (red line)
    rightWall = new visual.Rect({
        win: psychoJS.window,
        name: 'rightWall',
        width: 0.005,
        height: 1.0,
        fillColor: new util.Color('red'),
        lineColor: new util.Color('red'),
        pos: [0.5, 0],
        ori: 0
    });
    
    // Create timer text display
    timerText = new visual.TextStim({
        win: psychoJS.window,
        name: 'timerText',
        text: '02:00',
        font: 'Arial',
        units: 'height',
        pos: [0, 0.45],
        height: 0.03,
        color: new util.Color('white'),
        ori: 0
    });
        
        // Initialize ball velocity
        resetBall();
        lastPaddleHitTime = 0;
        
        psychoJS.experiment.addData('game.started', globalClock.getTime());
        
        gameComponents = [];
        
        for (const thisComponent of gameComponents)
            if ('status' in thisComponent)
                thisComponent.status = PsychoJS.Status.NOT_STARTED;
        return Scheduler.Event.NEXT;
    }
}

function resetBall() {
    ball.setPos([0, 0]);
    
    // Random initial direction (left or right with slight vertical deviation)
    let horizontalDir = Math.random() > 0.5 ? 1 : -1;
    let verticalAngle = (Math.random() - 0.5) * 0.5; // ±~15° in radians
    
    let speed = gameState.baseSpeed * gameState.speedMultiplier;
    ballVelocity.x = horizontalDir * speed * Math.cos(verticalAngle);
    ballVelocity.y = speed * Math.sin(verticalAngle);
}

function updateBallSpeed() {
    let currentSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
    let newSpeed = gameState.baseSpeed * gameState.speedMultiplier;
    
    if (currentSpeed > 0) {
        ballVelocity.x = (ballVelocity.x / currentSpeed) * newSpeed;
        ballVelocity.y = (ballVelocity.y / currentSpeed) * newSpeed;
    }
}

function gameRoutineEachFrame() {
    return async function() {
        t = gameClock.getTime();
        frameN = frameN + 1;
        
        // Check for quit (ESC key)
        if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
            return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
        }
        
        // Check if 2 minutes have passed (not applicable in Survival mode)
        if (t >= TEST_DURATION && gameState.difficulty !== 'Survival') {
            continueRoutine = false;
            routineForceEnded = true;
            return Scheduler.Event.NEXT;
        }
        
        // Update paddle positions based on key states
        let paddleSpeed = 0.5 * frameDur; // height units per frame
        let settings = DIFFICULTY_SETTINGS[gameState.difficulty];
        let paddleHalfHeight = settings.paddleHeight / 2;
        
        let leftPos = leftPaddle.getPos();
        let rightPos = rightPaddle.getPos();
        
        // Left paddle (W/S)
        if (keysPressed['w'] || keysPressed['W']) {
            leftPaddle.setPos([leftPos[0], Math.min(leftPos[1] + paddleSpeed, 0.5 - paddleHalfHeight)]);
        }
        if (keysPressed['s'] || keysPressed['S']) {
            leftPaddle.setPos([leftPos[0], Math.max(leftPos[1] - paddleSpeed, -0.5 + paddleHalfHeight)]);
        }
        
        // Right paddle (Arrow keys or O/L)
        if (keysPressed['ArrowUp'] || keysPressed['o'] || keysPressed['O']) {
            rightPaddle.setPos([rightPos[0], Math.min(rightPos[1] + paddleSpeed, 0.5 - paddleHalfHeight)]);
        }
        if (keysPressed['ArrowDown'] || keysPressed['l'] || keysPressed['L']) {
            rightPaddle.setPos([rightPos[0], Math.max(rightPos[1] - paddleSpeed, -0.5 + paddleHalfHeight)]);
        }
        
        // Update ball position
        let ballPos = ball.getPos();
        ball.setPos([ballPos[0] + ballVelocity.x, ballPos[1] + ballVelocity.y]);
        ballPos = ball.getPos();
        
        // Handle collisions
        let paddleWidth = 0.02;
        let ballRadius = 0.015;
        leftPos = leftPaddle.getPos();
        rightPos = rightPaddle.getPos();
        
        // Top and bottom walls
        if (ballPos[1] + ballRadius >= 0.5) {
            ball.setPos([ballPos[0], 0.5 - ballRadius]);
            ballVelocity.y = -Math.abs(ballVelocity.y);
            ballPos = ball.getPos();
        }
        if (ballPos[1] - ballRadius <= -0.5) {
            ball.setPos([ballPos[0], -0.5 + ballRadius]);
            ballVelocity.y = Math.abs(ballVelocity.y);
            ballPos = ball.getPos();
        }
        
        // Left paddle collision
        if (ballPos[0] - ballRadius <= leftPos[0] + paddleWidth / 2 &&
            ballPos[0] + ballRadius >= leftPos[0] - paddleWidth / 2 &&
            ballPos[1] >= leftPos[1] - paddleHalfHeight &&
            ballPos[1] <= leftPos[1] + paddleHalfHeight &&
            ballVelocity.x < 0) {
            
            ball.setPos([leftPos[0] + paddleWidth / 2 + ballRadius, ballPos[1]]);
            ballVelocity.x = Math.abs(ballVelocity.x);
            
            // Add angle based on where ball hit paddle
            let hitPosition = (ballPos[1] - leftPos[1]) / paddleHalfHeight;
            ballVelocity.y += hitPosition * 0.003;
            
            // Record paddle hit
            gameState.paddleHits++;
            if (gameState.difficulty === 'Hard') {
                gameState.speedMultiplier = 1;
                lastPaddleHitTime = t;
                updateBallSpeed();
            }
        }
        
        // Right paddle collision
        if (ballPos[0] + ballRadius >= rightPos[0] - paddleWidth / 2 &&
            ballPos[0] - ballRadius <= rightPos[0] + paddleWidth / 2 &&
            ballPos[1] >= rightPos[1] - paddleHalfHeight &&
            ballPos[1] <= rightPos[1] + paddleHalfHeight &&
            ballVelocity.x > 0) {
            
            ball.setPos([rightPos[0] - paddleWidth / 2 - ballRadius, ballPos[1]]);
            ballVelocity.x = -Math.abs(ballVelocity.x);
            
            // Add angle based on where ball hit paddle
            let hitPosition = (ballPos[1] - rightPos[1]) / paddleHalfHeight;
            ballVelocity.y += hitPosition * 0.003;
            
            // Record paddle hit
            gameState.paddleHits++;
            if (gameState.difficulty === 'Hard') {
                gameState.speedMultiplier = 1;
                lastPaddleHitTime = t;
                updateBallSpeed();
            }
        }
        
        ballPos = ball.getPos();
        
        // Left wall (ball goes off left side)
        if (ballPos[0] - ballRadius <= -0.5) {
            gameState.leftWallHits++;
            gameState.totalWallHits++;
            
            if (gameState.difficulty === 'Survival') {
                // Jeden błąd = koniec testu
                gameState.survivalTime = t;
                continueRoutine = false;
                routineForceEnded = true;
                return Scheduler.Event.NEXT;
            }
            
            // Reset speed for hard mode
            if (gameState.difficulty === 'Hard') {
                gameState.speedMultiplier = 1;
                lastPaddleHitTime = t;
            }
            
            resetBall();
        }
        
        // Right wall (ball goes off right side)
        if (ballPos[0] + ballRadius >= 0.5) {
            gameState.rightWallHits++;
            gameState.totalWallHits++;
            
            if (gameState.difficulty === 'Survival') {
                // Jeden błąd = koniec testu
                gameState.survivalTime = t;
                continueRoutine = false;
                routineForceEnded = true;
                return Scheduler.Event.NEXT;
            }
            
            // Reset speed for hard mode
            if (gameState.difficulty === 'Hard') {
                gameState.speedMultiplier = 1;
                lastPaddleHitTime = t;
            }
            
            resetBall();
        }
        
        // Hard mode: increase speed over time without paddle hit (capped at x4)
        if (gameState.difficulty === 'Hard') {
            let timeSinceHit = t - lastPaddleHitTime;
            if (timeSinceHit >= gameState.speedIncreaseInterval && gameState.speedMultiplier < gameState.maxSpeedMultiplier) {
                gameState.speedMultiplier = Math.min(
                    gameState.speedMultiplier + gameState.speedIncreaseAmount,
                    gameState.maxSpeedMultiplier
                );
                gameState.speedChanges++;
                gameState.maxSpeedReached = Math.max(gameState.maxSpeedReached, gameState.speedMultiplier);
                lastPaddleHitTime = t;
                updateBallSpeed();
            }
        }
        
        // Survival mode: increase speed over time WITHOUT any cap
        if (gameState.difficulty === 'Survival') {
            let survivalInterval = 3.0; // Wolniejszy przyrost czasu w survivalu
            let survivalAmount = 0.1;   // Mniejszy skok prędkości
            
            let timeSinceHit = t - lastPaddleHitTime;
            if (timeSinceHit >= survivalInterval) {
                gameState.speedMultiplier += survivalAmount;
                gameState.speedChanges++;
                gameState.maxSpeedReached = Math.max(gameState.maxSpeedReached, gameState.speedMultiplier);
                lastPaddleHitTime = t;
                updateBallSpeed();
            }
        }
        
        // Update timer display
        let displayTime = gameState.difficulty === 'Survival' ? t : (TEST_DURATION - t);
        let minutes = Math.floor(displayTime / 60);
        let seconds = Math.floor(displayTime % 60);
        let timerString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        timerText.setText(timerString);
        
        // Draw everything
        leftWall.draw();
        rightWall.draw();
        leftPaddle.draw();
        rightPaddle.draw();
        ball.draw();
        timerText.draw();
        
        if (continueRoutine) {
            return Scheduler.Event.FLIP_REPEAT;
        } else {
            return Scheduler.Event.NEXT;
        }
    };
}

function gameRoutineEnd(snapshot) {
    return async function() {
        psychoJS.experiment.addData('game.stopped', globalClock.getTime());
        psychoJS.experiment.addData('left_wall_hits', gameState.leftWallHits);
        psychoJS.experiment.addData('right_wall_hits', gameState.rightWallHits);
        psychoJS.experiment.addData('total_wall_hits', gameState.totalWallHits);
        psychoJS.experiment.addData('difficulty', gameState.difficulty);
        psychoJS.experiment.addData('speed_changes', gameState.speedChanges);
        psychoJS.experiment.addData('max_speed_reached', gameState.maxSpeedReached);
        
        routineTimer.reset();
        
        if (currentLoop === psychoJS.experiment) {
            psychoJS.experiment.nextEntry(snapshot);
        }
        return Scheduler.Event.NEXT;
    }
}

var _resultsKey_allKeys;
var resultsComponents;

function resultsRoutineBegin(snapshot) {
    return async function() {
        TrialHandler.fromSnapshot(snapshot);
        
        t = 0;
        frameN = -1;
        continueRoutine = true;
        routineForceEnded = false;
        resultsClock.reset();
        routineTimer.reset();
        
        let resultsStr;
        if (gameState.difficulty === 'Survival') {
            let survMins = Math.floor(gameState.survivalTime / 60);
            let survSecs = Math.floor(gameState.survivalTime % 60);
            let survStr = `${survMins.toString().padStart(2, '0')}:${survSecs.toString().padStart(2, '0')}`;
            resultsStr = 'KONIEC TESTU – TRYB PRZETRWANIA\n\n' +
                `Czas przeżycia: ${survStr}\n` +
                `Odbicia paletką: ${gameState.paddleHits}\n\n` +
                'Naciśnij SPACJĘ, aby zakończyć';
        } else {
            resultsStr = 'KONIEC TESTU\n\n' +
                `Lewa strona: ${gameState.leftWallHits} uderzeń\n` +
                `Prawa strona: ${gameState.rightWallHits} uderzeń\n` +
                `Razem: ${gameState.totalWallHits} uderzeń\n\n` +
                'Naciśnij SPACJĘ, aby zakończyć';
        }
        resultsText.setText(resultsStr);
        
        resultsKey.keys = undefined;
        resultsKey.rt = undefined;
        _resultsKey_allKeys = [];
        psychoJS.experiment.addData('results.started', globalClock.getTime());
        
        resultsComponents = [];
        resultsComponents.push(resultsText);
        resultsComponents.push(resultsKey);
        
        for (const thisComponent of resultsComponents)
            if ('status' in thisComponent)
                thisComponent.status = PsychoJS.Status.NOT_STARTED;
        return Scheduler.Event.NEXT;
    }
}

function resultsRoutineEachFrame() {
    return async function() {
        t = resultsClock.getTime();
        frameN = frameN + 1;
        
        if (t >= 0.0 && resultsText.status === PsychoJS.Status.NOT_STARTED) {
            resultsText.tStart = t;
            resultsText.frameNStart = frameN;
            resultsText.setAutoDraw(true);
        }
        
        if (t >= 0.0 && resultsKey.status === PsychoJS.Status.NOT_STARTED) {
            resultsKey.tStart = t;
            resultsKey.frameNStart = frameN;
            psychoJS.window.callOnFlip(function() { resultsKey.clock.reset(); });
            psychoJS.window.callOnFlip(function() { resultsKey.start(); });
            psychoJS.window.callOnFlip(function() { resultsKey.clearEvents(); });
        }
        
        if (resultsKey.status === PsychoJS.Status.STARTED) {
            let theseKeys = resultsKey.getKeys({ keyList: ['space', 'escape'], waitRelease: false });
            _resultsKey_allKeys = _resultsKey_allKeys.concat(theseKeys);
            if (_resultsKey_allKeys.length > 0) {
                resultsKey.keys = _resultsKey_allKeys[_resultsKey_allKeys.length - 1].name;
                resultsKey.rt = _resultsKey_allKeys[_resultsKey_allKeys.length - 1].rt;
                resultsKey.duration = _resultsKey_allKeys[_resultsKey_allKeys.length - 1].duration;
                continueRoutine = false;
            }
        }
        
        // Check for quit (ESC key)
        if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
            return quitPsychoJS('The [Escape] key was pressed. Goodbye!', false);
        }
        
        if (!continueRoutine) {
            routineForceEnded = true;
            return Scheduler.Event.NEXT;
        }
        
        continueRoutine = false;
        for (const thisComponent of resultsComponents)
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

function resultsRoutineEnd(snapshot) {
    return async function() {
        for (const thisComponent of resultsComponents) {
            if (typeof thisComponent.setAutoDraw === 'function') {
                thisComponent.setAutoDraw(false);
            }
        }
        psychoJS.experiment.addData('results.stopped', globalClock.getTime());
        resultsKey.stop();
        routineTimer.reset();
        
        if (currentLoop === psychoJS.experiment) {
            psychoJS.experiment.nextEntry(snapshot);
        }
        return Scheduler.Event.NEXT;
    }
}

async function quitPsychoJS(message, isCompleted) {
    // Check for and save orphaned data
    if (psychoJS.experiment.isEntryEmpty()) {
        psychoJS.experiment.nextEntry();
    }

    if (typeof window.electronTest !== 'undefined') {
        if (isCompleted) {
            let isSurvival = gameState.difficulty === 'Survival';
            let results = {
                testId: expInfo['expName'],
                subjectId: expInfo['participant'],
                timestamp: new Date().toISOString(),
                ilosc_poprawnych_nacisniec: isSurvival ? gameState.paddleHits : 0,
                ilosc_blednych_nacisniec: 0,
                ogolna_ilosc_nacisniec: isSurvival ? gameState.paddleHits : gameState.totalWallHits,
                score: isSurvival
                    ? `Poziom: Przetrwanie | Czas: ${gameState.survivalTime.toFixed(1)}s | Odbicia: ${gameState.paddleHits}`
                    : `Poziom: ${gameState.difficulty} | Lewa: ${gameState.leftWallHits} | Prawa: ${gameState.rightWallHits} | Razem: ${gameState.totalWallHits}`,
                statystyki: {
                    poziom_trudnosci: gameState.difficulty,
                    lewa_ilosc_uderzen: gameState.leftWallHits,
                    prawa_ilosc_uderzen: gameState.rightWallHits,
                    czas_trwania: isSurvival ? `${gameState.survivalTime.toFixed(1)}s` : '2 min',
                    czas_przezycia_sek: isSurvival ? Math.round(gameState.survivalTime) : null,
                    odbicia_paletka: gameState.paddleHits,
                    maksymalna_predkosc: gameState.maxSpeedReached.toFixed(2),
                    ilosc_predkosciowych_zmian: gameState.speedChanges
                }
            };
            window.electronTest.sendResults(results);
        } else {
            window.electronTest.close();
        }
    }

    psychoJS.window.close();
    psychoJS.quit({ message: message, isCompleted: isCompleted });

    return Scheduler.Event.QUIT;
}
