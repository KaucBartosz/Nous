// Kaczki – JavaScript version for Nous (Electron)
// Reimplemented from the reference Python script (main.py)

import { core, data, sound, util, visual, hardware } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { Scheduler } = util;

// -----------------------------------------------------------------------------
// Experiment information
// -----------------------------------------------------------------------------
let expName = 'kaczki';
let expInfo = {
    participant: `${util.pad(Number.parseInt(util.randint(0, 999999)), 6)}`,
    session: '001',
};

// -----------------------------------------------------------------------------
// Global PsychoJS object
// -----------------------------------------------------------------------------
const psychoJS = new PsychoJS({
    debug: true,
    resources: []
});
psychoJS.experimentLogger.setLevel(core.Logger.ServerLevel.INFO);

// -----------------------------------------------------------------------------
// Game configuration (mirrors Python version)
// -----------------------------------------------------------------------------
const BALLS_TO_SHOOT = 60; // ~1 minute of gameplay

// -----------------------------------------------------------------------------
// Game state – mutable during the experiment
// -----------------------------------------------------------------------------
let gameState = {
    ballsToShoot: BALLS_TO_SHOOT,
    currentBalls: 0,
    score: { trafione: 0, przeszly: 0, ogolnie: 0 },
    nextBallTime: 0,
    isCompleted: false,
};

// -----------------------------------------------------------------------------
// Containers for visual objects and input devices
// -----------------------------------------------------------------------------
let balls = [];               // array of active ball objects
let mouse;                    // PsychoJS mouse
let keyboard;                 // PsychoJS keyboard (for ESC)
let ballStim;                 // reusable visual.Polygon for drawing balls
let welcomeText, welcomeKey;  // welcome routine components
let gameClock, globalClock, routineTimer;

// -----------------------------------------------------------------------------
// Helper – create a new ball object
// -----------------------------------------------------------------------------
function createBall() {
    // Horizontal spread – 90 % of the visible width (aspect‑aware)
    const aspect = psychoJS.window.size[0] / psychoJS.window.size[1];
    const margin = aspect * 0.9;
    const startX = Math.random() * margin - margin / 2;
    const startY = -0.6; // slightly below the bottom edge (units = height)
    const targetX = Math.random() * margin - margin / 2;
    const targetY = 0.6; // slightly above the top edge

    // Vector to target
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Speed – base 0.005 with up to +50 % random component (as in Python)
    const speed = 0.005 + Math.random() * 0.0025;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;

    // Random radius (0.02‑0.03) and colour
    const radius = 0.02 + Math.random() * 0.01;
    const colors = [
        [1, 0, 0], // red
        [0, 1, 0], // green
        [0, 0, 1], // blue
        [1, 1, 0], // yellow
        [1, 0, 1], // magenta
        [0, 1, 1]  // cyan
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    return { x: startX, y: startY, vx, vy, radius, color, visible: true };
}

// -----------------------------------------------------------------------------
// Welcome screen – press SPACE to start
// -----------------------------------------------------------------------------
function welcomeRoutineBegin() {
    return async function () {
        // reset keyboard state
        psychoJS.eventManager.clearEvents();
        // create welcome text
        welcomeText = new visual.TextStim({
            win: psychoJS.window,
            name: 'welcomeText',
            text: 'Kaczki – test strzelania do kul\n\nNaciśnij spację, aby rozpocząć test.',
            color: [1, 1, 1],
            height: 0.05,
            wrapWidth: 1.5,
            alignHoriz: 'center',
            alignVert: 'center'
        });
        welcomeKey = new core.Keyboard({
            psychoJS: psychoJS,
            clock: new util.Clock(),
            waitForStart: true
        });
        return Scheduler.Event.NEXT;
    };
}

function welcomeRoutineEachFrame() {
    return async function () {
        if (welcomeText.status === PsychoJS.Status.NOT_STARTED) {
            welcomeText.setAutoDraw(true);
            welcomeText.status = PsychoJS.Status.STARTED;
        }
        // check for SPACE
        if (welcomeKey.status === PsychoJS.Status.NOT_STARTED) {
            welcomeKey.start();
            welcomeKey.status = PsychoJS.Status.STARTED;
        }
        const theseKeys = welcomeKey.getKeys({ keyList: ['space', 'escape'], waitRelease: false });
        if (theseKeys.length > 0) {
            const key = theseKeys[0];
            if (key.name === 'escape') {
                return quitPsychoJS('User pressed Escape', false);
            }
            // SPACE – start the game
            welcomeText.setAutoDraw(false);
            return Scheduler.Event.NEXT;
        }
        return Scheduler.Event.FLIP_REPEAT;
    };
}

function welcomeRoutineEnd() {
    return async function () {
        welcomeKey.stop();
        return Scheduler.Event.NEXT;
    };
}

// -----------------------------------------------------------------------------
// Game routine – main loop
// -----------------------------------------------------------------------------
function gameRoutineBegin() {
    return async function () {
        // initialise clocks and schedule first ball
        gameClock = new util.Clock();
        globalClock = new util.Clock();
        routineTimer = new util.CountdownTimer();
        // reusable stimulus for drawing balls (polygon with 60 edges ≈ circle)
        ballStim = new visual.Polygon({
            win: psychoJS.window,
            edges: 60,
            size: [0.04, 0.04], // placeholder – will be overwritten per ball
            fillColor: [1, 1, 1],
            lineColor: [1, 1, 1],
            lineWidth: 2,
            pos: [0, 0]
        });
        // input devices
        mouse = new event.Mouse({ win: psychoJS.window });
        mouse.setVisible(true);
        mouse.clickReset();
        keyboard = new hardware.Keyboard({ psychoJS: psychoJS });
        // schedule first spawn after 1 s
        gameState.nextBallTime = gameClock.getTime() + 1.0;
        return Scheduler.Event.NEXT;
    };
}

function gameRoutineEachFrame() {
    return async function () {
        const t = gameClock.getTime();
        // ---------------------------------------------------------------------
        // 1️⃣  Spawn new balls if quota not yet reached
        // ---------------------------------------------------------------------
        const totalProcessed = gameState.score.trafione + gameState.score.przeszly;
        if (t >= gameState.nextBallTime && totalProcessed < gameState.ballsToShoot) {
            const numBalls = Math.floor(Math.random() * 3) + 1; // 1‑3 balls
            for (let i = 0; i < numBalls; i++) {
                const ball = createBall();
                balls.push(ball);
                gameState.currentBalls++;
            }
            // next spawn interval 0.5‑2.0 s
            gameState.nextBallTime = t + (0.5 + Math.random() * 1.5);
        }
        // ---------------------------------------------------------------------
        // 2️⃣  Update ball positions and remove those that leave the screen
        // ---------------------------------------------------------------------
        for (let i = balls.length - 1; i >= 0; i--) {
            const b = balls[i];
            b.x += b.vx;
            b.y += b.vy;
            // when the centre passes the top edge (y > 0.5) the ball is counted as missed
            if (b.y > 0.5) {
                b.visible = false;
                gameState.score.przeszly++;
                balls.splice(i, 1);
                continue;
            }
        }
        // ---------------------------------------------------------------------
        // 3️⃣  Mouse click handling – hit detection
        // ---------------------------------------------------------------------
        const btns = mouse.getPressed();
        if (btns[0]) { // left click
            const [mx, my] = mouse.getPos();
            for (let i = balls.length - 1; i >= 0; i--) {
                const b = balls[i];
                const dx = mx - b.x;
                const dy = my - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= b.radius) {
                    // hit!
                    balls.splice(i, 1);
                    gameState.score.trafione++;
                    gameState.score.ogolnie++;
                    break; // one click = one ball
                }
            }
        }
        // ---------------------------------------------------------------------
        // 4️⃣  Touch handling – identical to mouse (for tablets)
        // ---------------------------------------------------------------------
        if (window._touchJustStarted && window._touchPsychoX != null && window._touchPsychoY != null) {
            const tx = window._touchPsychoX;
            const ty = window._touchPsychoY;
            for (let i = balls.length - 1; i >= 0; i--) {
                const b = balls[i];
                const dx = tx - b.x;
                const dy = ty - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= b.radius) {
                    balls.splice(i, 1);
                    gameState.score.trafione++;
                    gameState.score.ogolnie++;
                    break;
                }
            }
            window._touchJustStarted = false;
            window._touchPsychoX = null;
            window._touchPsychoY = null;
        }
        // ---------------------------------------------------------------------
        // 5️⃣  Draw all visible balls using the reusable stimulus
        // ---------------------------------------------------------------------
        for (const b of balls) {
            ballStim.setPos([b.x, b.y]);
            ballStim.setSize([b.radius * 2, b.radius * 2]);
            ballStim.setFillColor(new util.Color(b.color));
            ballStim.setLineColor(new util.Color([1, 1, 1]));
            ballStim.draw();
        }
        // ---------------------------------------------------------------------
        // 6️⃣  Check for ESC key (quit early)
        // ---------------------------------------------------------------------
        const escKeys = keyboard.getKeys({ keyList: ['escape'], waitRelease: false });
        if (escKeys.length > 0) {
            return quitPsychoJS('User pressed Escape', false);
        }
        // ---------------------------------------------------------------------
        // 7️⃣  End condition – when processed balls reach the quota
        // ---------------------------------------------------------------------
        if (totalProcessed >= gameState.ballsToShoot) {
            gameState.isCompleted = true;
            return Scheduler.Event.NEXT; // will jump to end routine
        }
        // keep flipping
        return Scheduler.Event.FLIP_REPEAT;
    };
}

function gameRoutineEnd() {
    return async function () {
        // send results to Nous (Electron) if available
        if (typeof window.electronTest !== 'undefined') {
            const results = {
                testId: expName,
                subjectId: expInfo.participant,
                timestamp: new Date().toISOString(),
                ilosc_poprawnych_nacisniec: gameState.score.trafione,
                ilosc_blednych_nacisniec: 0,
                ogolna_ilosc_nacisniec: gameState.score.ogolnie,
                czas_trwania_sek: Math.round(globalClock.getTime()),
                trafione_kule: gameState.score.trafione,
                przeszly_kule: gameState.score.przeszly,
                wszystkie_kule: gameState.ballsToShoot,
                skutecznosc: gameState.ballsToShoot > 0 ? Math.round((gameState.score.trafione / gameState.ballsToShoot) * 100) : 0,
                score: `Trafione: ${gameState.score.trafione} | Przeszły: ${gameState.score.przeszly} | Skuteczność: ${gameState.ballsToShoot > 0 ? Math.round((gameState.score.trafione / gameState.ballsToShoot) * 100) : 0}%`
            };
            window.electronTest.sendResults(results);
        }
        return Scheduler.Event.NEXT;
    };
}

// -----------------------------------------------------------------------------
// Quit helper – also stores results if experiment finished
// -----------------------------------------------------------------------------
async function quitPsychoJS(message, isCompleted) {
    if (typeof window.electronTest !== 'undefined' && isCompleted) {
        // results already sent in gameRoutineEnd, nothing extra needed
    }
    console.log(message);
    psychoJS.experiment.save();
    psychoJS.window.close();
    return Scheduler.Event.QUIT;
}

// -----------------------------------------------------------------------------
// Build the schedule – welcome → game → quit
// -----------------------------------------------------------------------------
function initExperiment() {
    // schedule flow
    const flowScheduler = new Scheduler(psychoJS);
    flowScheduler.add(welcomeRoutineBegin());
    flowScheduler.add(welcomeRoutineEachFrame());
    flowScheduler.add(welcomeRoutineEnd());
    flowScheduler.add(gameRoutineBegin());
    flowScheduler.add(gameRoutineEachFrame());
    flowScheduler.add(gameRoutineEnd());
    flowScheduler.add(() => quitPsychoJS('Finished', true));
    // start
    psychoJS.start({
        expName: expName,
        expInfo: expInfo,
        resources: []
    });
    psychoJS.schedule(flowScheduler);
}

// -----------------------------------------------------------------------------
// Run the experiment
// -----------------------------------------------------------------------------
initExperiment();
