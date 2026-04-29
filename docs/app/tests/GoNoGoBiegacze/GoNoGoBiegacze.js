import { core, data, util, visual } from './lib/psychojs-2025.1.1.js';
const { PsychoJS } = core;
const { TrialHandler } = data;
const { Scheduler } = util;

let expName = 'GoNoGoCyfry';
let expInfo = { 'participant': util.pad(Math.floor(Math.random() * 1000000).toString(), 6), 'session': '001' };

const psychoJS = new PsychoJS({ debug: false });
psychoJS.openWindow({ fullscr: true, color: new util.Color('black'), units: 'height' });
psychoJS.schedule(psychoJS.gui.DlgFromDict({ dictionary: expInfo, title: expName }));

const flowScheduler = new Scheduler(psychoJS);
const dialogCancelScheduler = new Scheduler(psychoJS);
psychoJS.scheduleCondition(() => (psychoJS.gui.dialogComponent.button === 'OK'), flowScheduler, dialogCancelScheduler);

flowScheduler.add(updateInfo);
flowScheduler.add(experimentInit);
flowScheduler.add(modeRoutineBegin());
flowScheduler.add(modeRoutineEachFrame());
flowScheduler.add(modeRoutineEnd());

flowScheduler.add(instructionsRoutineBegin());
flowScheduler.add(instructionsRoutineEachFrame());
flowScheduler.add(instructionsRoutineEnd());

const trainingLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(trainingLoopBegin(trainingLoopScheduler));
flowScheduler.add(trainingLoopScheduler);
flowScheduler.add(trainingLoopEnd);
flowScheduler.add(postTrainingRoutineBegin());
flowScheduler.add(postTrainingRoutineEachFrame());
flowScheduler.add(postTrainingRoutineEnd());

const blocksLoopScheduler = new Scheduler(psychoJS);
flowScheduler.add(blocksLoopBegin(blocksLoopScheduler));
flowScheduler.add(blocksLoopScheduler);
flowScheduler.add(blocksLoopEnd);

flowScheduler.add(quitPsychoJS, 'Dziękujemy za udział w badaniu.', true);
dialogCancelScheduler.add(quitPsychoJS, 'Dziękujemy za udział w badaniu.', false);

psychoJS.start({ expName, expInfo, resources: [] });

let globalClock, routineTimer;
let modeText, modeKey;
let instrText, instrKey;
let trialText, trialKey, trialClock;
let feedbackText, feedbackClock;
let breakText, breakKey;
let postTrainingText, postTrainingKey;

async function updateInfo() {
  expInfo['date'] = util.MonotonicClock.getDateStr();
  psychoJS.experiment.dataFileName = `./data/${expInfo.participant}_${expName}_${expInfo.date}`;
  return Scheduler.Event.NEXT;
}

async function experimentInit() {
  globalClock = new util.Clock();
  routineTimer = new util.CountdownTimer();

  modeText = new visual.TextStim({ win: psychoJS.window, name: 'modeText', text: 'Wybierz tryb:\n1 - Badanie\n2 - Trening', height: 0.05 });
  modeKey = new core.Keyboard({ psychoJS, clock: new util.Clock(), waitForStart: true });

  instrText = new visual.TextStim({ win: psychoJS.window, name: 'instrText', text: 'Zadanie Go/No-Go\n\nNaciśnij SPACJĘ, gdy zobaczysz cyfrę NIEPARZYSTĄ (1, 3, 7, 9).\nNIE naciskaj niczego, gdy zobaczysz cyfrę PARZYSTĄ (2, 4, 6, 8).\n\nNaciśnij SPACJĘ, aby rozpocząć.', height: 0.05 });
  instrKey = new core.Keyboard({ psychoJS, clock: new util.Clock(), waitForStart: true });

  trialText = new visual.TextStim({ win: psychoJS.window, name: 'trialText', text: '', height: 0.15 });
  trialKey = new core.Keyboard({ psychoJS, clock: new util.Clock(), waitForStart: true });
  trialClock = new util.Clock();

  feedbackText = new visual.TextStim({ win: psychoJS.window, name: 'feedbackText', text: '', height: 0.1 });
  feedbackClock = new util.Clock();

  breakText = new visual.TextStim({ win: psychoJS.window, name: 'breakText', text: 'Przerwa. Naciśnij SPACJĘ, aby kontynuować.', height: 0.05 });
  breakKey = new core.Keyboard({ psychoJS, clock: new util.Clock(), waitForStart: true });

  postTrainingText = new visual.TextStim({
    win: psychoJS.window, name: 'postTrainingText',
    text: 'Koniec treningu\n\nTeraz zacznie się zadanie właściwe - zasady są te same,\nale nie będzie się wyświetlać informacja o poprawności reakcji.\n\nZasady:\nNaciśnij SPACJĘ, gdy zobaczysz cyfrę NIEPARZYSTĄ (1, 3, 7, 9).\nNIE naciskaj niczego, gdy zobaczysz cyfrę PARZYSTĄ (2, 4, 6, 8).\n\nNaciśnij SPACJĘ, aby rozpocząć zadanie.',
    height: 0.05, wrapWidth: 1.5
  });
  postTrainingKey = new core.Keyboard({ psychoJS, clock: new util.Clock(), waitForStart: true });

  window.nousData = [];
  if (typeof window.electronTest !== 'undefined') {
    psychoJS.experiment.save = () => Promise.resolve();
  }

  // --- Obsługa ekranu dotykowego (GO = dowolne dotknięcie) ---
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

function modeRoutineBegin() {
  return async function () {
    modeKey.keys = undefined; modeKey.clearEvents(); modeKey.start();
    modeText.setAutoDraw(true);
    return Scheduler.Event.NEXT;
  }
}
function modeRoutineEachFrame() {
  return async function () {
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }
    let keys = modeKey.getKeys({ keyList: ['1', '2'], waitRelease: false });
    if (keys.length > 0) {
      window.expMode = keys[0].name === '2' ? 'training' : 'test';
      return Scheduler.Event.NEXT;
    }
    return Scheduler.Event.FLIP_REPEAT;
  }
}
function modeRoutineEnd() {
  return async function () {
    modeText.setAutoDraw(false);
    modeKey.stop();
    return Scheduler.Event.NEXT;
  }
}

function instructionsRoutineBegin() {
  return async function () {
    instrKey.keys = undefined; instrKey.clearEvents(); instrKey.start();
    instrText.setAutoDraw(true);
    return Scheduler.Event.NEXT;
  }
}
function instructionsRoutineEachFrame() {
  return async function () {
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }
    let keys = instrKey.getKeys({ keyList: ['space'], waitRelease: false });

    if (window._touchJustStarted && window._touchCanvas) {
      keys = keys.concat([{ name: 'space', rt: instrKey.clock.getTime(), duration: 0 }]);
      window._touchJustStarted = false;
    }

    if (keys.length > 0) return Scheduler.Event.NEXT;
    return Scheduler.Event.FLIP_REPEAT;
  }
}
function instructionsRoutineEnd() {
  return async function () {
    instrText.setAutoDraw(false);
    instrKey.stop();
    return Scheduler.Event.NEXT;
  }
}

function generateBlock(numGo, numNoGo, maxConsecutiveNoGo) {
  let seq = [];
  while (true) {
    seq = [];
    let go = numGo, nogo = numNoGo;
    for (let i = 0; i < numGo + numNoGo; i++) {
      if (go === 0) { seq.push('nogo'); nogo--; }
      else if (nogo === 0) { seq.push('go'); go--; }
      else {
        if (Math.random() < go / (go + nogo)) { seq.push('go'); go--; }
        else { seq.push('nogo'); nogo--; }
      }
    }
    let maxCons = 0, currentCons = 0;
    for (let cond of seq) {
      if (cond === 'nogo') { currentCons++; if (currentCons > maxCons) maxCons = currentCons; }
      else currentCons = 0;
    }
    if (maxCons <= maxConsecutiveNoGo) break;
  }
  let goStims = [1, 3, 7, 9], nogoStims = [2, 4, 6, 8];
  return seq.map(cond => ({
    condition: cond,
    digit: (cond === 'go' ? goStims[Math.floor(Math.random() * goStims.length)] : nogoStims[Math.floor(Math.random() * nogoStims.length)]).toString(),
    soa: 1.3 + Math.random() * 0.3
  }));
}

let trainingLoop;
function trainingLoopBegin(scheduler) {
  return async function () {
    if (window.expMode !== 'training') return Scheduler.Event.NEXT;
    let trialsArr = generateBlock(10, 10, 3); // 20 trials, 50% Go
    trainingLoop = new TrialHandler({ psychoJS, nReps: 1, method: TrialHandler.Method.SEQUENTIAL, trialList: trialsArr, name: 'trainingLoop' });
    psychoJS.experiment.addLoop(trainingLoop);
    for (const trial of trainingLoop) {
      let snapshot = trainingLoop.getSnapshot();
      scheduler.add(importConditions(snapshot));
      scheduler.add(trialRoutineBegin(snapshot, true));
      scheduler.add(trialRoutineEachFrame(true));
      scheduler.add(trialRoutineEnd(snapshot, true));
      scheduler.add(feedbackRoutineBegin(snapshot));
      scheduler.add(feedbackRoutineEachFrame());
      scheduler.add(feedbackRoutineEnd(snapshot));
      scheduler.add(loopEndIteration(scheduler, snapshot));
    }
    return Scheduler.Event.NEXT;
  }
}
async function trainingLoopEnd() {
  if (trainingLoop) psychoJS.experiment.removeLoop(trainingLoop);
  return Scheduler.Event.NEXT;
}

function postTrainingRoutineBegin() {
  return async function () {
    if (window.expMode !== 'training') return Scheduler.Event.NEXT;
    postTrainingKey.keys = undefined; postTrainingKey.clearEvents(); postTrainingKey.start();
    postTrainingText.setAutoDraw(true);
    window._touchJustStarted = false;
    return Scheduler.Event.NEXT;
  }
}
function postTrainingRoutineEachFrame() {
  return async function () {
    if (window.expMode !== 'training') return Scheduler.Event.NEXT;
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }
    let keys = postTrainingKey.getKeys({ keyList: ['space'], waitRelease: false });
    if (window._touchJustStarted && window._touchCanvas) {
      keys = keys.concat([{ name: 'space', rt: postTrainingKey.clock.getTime(), duration: 0 }]);
      window._touchJustStarted = false;
    }
    if (keys.length > 0) return Scheduler.Event.NEXT;
    return Scheduler.Event.FLIP_REPEAT;
  }
}
function postTrainingRoutineEnd() {
  return async function () {
    if (window.expMode !== 'training') return Scheduler.Event.NEXT;
    postTrainingText.setAutoDraw(false);
    postTrainingKey.stop();
    return Scheduler.Event.NEXT;
  }
}

let blocksLoop, testLoop;
function blocksLoopBegin(scheduler) {
  return async function () {
    blocksLoop = new TrialHandler({ psychoJS, nReps: 1, method: TrialHandler.Method.SEQUENTIAL, trialList: [1, 2, 3, 4], name: 'blocksLoop' });
    psychoJS.experiment.addLoop(blocksLoop);
    for (const block of blocksLoop) {
      let bSnap = blocksLoop.getSnapshot();
      const testScheduler = new Scheduler(psychoJS);
      scheduler.add(testLoopBegin(bSnap, testScheduler));
      scheduler.add(testScheduler);
      scheduler.add(testLoopEnd);
      scheduler.add(breakRoutineBegin(bSnap));
      scheduler.add(breakRoutineEachFrame());
      scheduler.add(breakRoutineEnd());
      scheduler.add(loopEndIteration(scheduler, bSnap));
    }
    return Scheduler.Event.NEXT;
  }
}
function testLoopBegin(bSnap, testScheduler) {
  return async function () {
    let trialsArr = generateBlock(40, 10, 3); // 50 trials, 80% Go, 20% NoGo
    testLoop = new TrialHandler({ psychoJS, nReps: 1, method: TrialHandler.Method.SEQUENTIAL, trialList: trialsArr, name: 'testLoop' });
    psychoJS.experiment.addLoop(testLoop);
    for (const trial of testLoop) {
      let snapshot = testLoop.getSnapshot();
      testScheduler.add(importConditions(snapshot));
      testScheduler.add(trialRoutineBegin(snapshot, false));
      testScheduler.add(trialRoutineEachFrame(false));
      testScheduler.add(trialRoutineEnd(snapshot, false));
      testScheduler.add(loopEndIteration(testScheduler, snapshot));
    }
    return Scheduler.Event.NEXT;
  }
}
async function testLoopEnd() {
  if (testLoop) psychoJS.experiment.removeLoop(testLoop);
  return Scheduler.Event.NEXT;
}
async function blocksLoopEnd() {
  if (blocksLoop) psychoJS.experiment.removeLoop(blocksLoop);
  return Scheduler.Event.NEXT;
}

function importConditions(snapshot) {
  return async function () {
    window.currentTrial = snapshot;
    return Scheduler.Event.NEXT;
  }
}
function loopEndIteration(scheduler, snapshot) {
  return async function () {
    psychoJS.experiment.nextEntry(snapshot);
    return Scheduler.Event.NEXT;
  }
}

let tTrial, trialDuration;
function trialRoutineBegin(snapshot, isTraining) {
  return async function () {
    psychoJS.window.callOnFlip(function () { trialKey.clock.reset(); });
    psychoJS.window.callOnFlip(function () { trialKey.start(); });
    psychoJS.window.callOnFlip(function () { trialKey.clearEvents(); });
    trialKey.keys = undefined; trialKey.rt = undefined;
    trialText.setText(window.currentTrial.digit);
    trialText.status = PsychoJS.Status.STARTED;
    trialText.setAutoDraw(true);
    trialClock.reset();
    window.trialResponded = false;
    trialDuration = window.currentTrial.soa;

    // Reset stanu dotyku na początek próby
    window._touchJustStarted = false;
    window._touchPsychoX = null;
    window._touchPsychoY = null;

    return Scheduler.Event.NEXT;
  }
}
function trialRoutineEachFrame(isTraining) {
  return async function () {
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }
    tTrial = trialClock.getTime();

    // Bodziec widoczny 500ms
    if (tTrial >= 0.5 && trialText.status === PsychoJS.Status.STARTED) {
      trialText.setAutoDraw(false);
      trialText.status = PsychoJS.Status.FINISHED;
    }

    // Okno reakcji 1000ms
    if (tTrial <= 1.0 && !window.trialResponded) {
      let keys = trialKey.getKeys({ keyList: ['space'], waitRelease: false });

      // Dotyk ekranu traktujemy jak naciśnięcie SPACJI (GO)
      if (window._touchJustStarted && window._touchCanvas) {
        keys = keys.concat([{ name: 'space', rt: trialKey.clock.getTime(), duration: 0 }]);
        window._touchJustStarted = false;
        window._touchPsychoX = null;
        window._touchPsychoY = null;
      }

      if (keys.length > 0) {
        trialKey.keys = keys[0].name;
        trialKey.rt = keys[0].rt;
        window.trialResponded = true;
      }
    }

    // Czas trwania calej proby (SOA) to 1300-1600ms
    if (tTrial >= trialDuration) {
      return Scheduler.Event.NEXT;
    }
    return Scheduler.Event.FLIP_REPEAT;
  }
}
function trialRoutineEnd(snapshot, isTraining) {
  return async function () {
    trialText.setAutoDraw(false);
    trialKey.stop();

    let rt = trialKey.rt;
    let pressed = window.trialResponded;
    let anticipatory = pressed && rt < 0.150;
    let validResponse = pressed && !anticipatory;

    let isGo = window.currentTrial.condition === 'go';
    let wasCorrect = false;

    if (isGo) {
      if (validResponse) wasCorrect = true;
    } else {
      if (!validResponse) wasCorrect = true;
    }

    window.lastCorrect = wasCorrect;
    window.lastAnticipatory = anticipatory;

    if (!isTraining) {
      window.nousData.push({
        condition: window.currentTrial.condition,
        digit: window.currentTrial.digit,
        pressed: pressed,
        rt: rt,
        anticipatory: anticipatory,
        wasCorrect: wasCorrect
      });
    }

    psychoJS.experiment.addData('condition', window.currentTrial.condition);
    psychoJS.experiment.addData('digit', window.currentTrial.digit);
    psychoJS.experiment.addData('rt', rt);
    psychoJS.experiment.addData('anticipatory', anticipatory);
    psychoJS.experiment.addData('wasCorrect', wasCorrect);

    return Scheduler.Event.NEXT;
  }
}

function feedbackRoutineBegin(snapshot) {
  return async function () {
    if (window.lastCorrect) {
      feedbackText.setText('Dobrze!');
      feedbackText.setColor(new util.Color('green'));
    } else {
      feedbackText.setText('Źle!');
      feedbackText.setColor(new util.Color('red'));
    }
    feedbackText.setAutoDraw(true);
    feedbackClock.reset();
    return Scheduler.Event.NEXT;
  }
}
function feedbackRoutineEachFrame() {
  return async function () {
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }
    if (feedbackClock.getTime() >= 0.5) return Scheduler.Event.NEXT;
    return Scheduler.Event.FLIP_REPEAT;
  }
}
function feedbackRoutineEnd(snapshot) {
  return async function () {
    feedbackText.setAutoDraw(false);
    return Scheduler.Event.NEXT;
  }
}

function breakRoutineBegin(snapshot) {
  return async function () {
    if (blocksLoop.thisN === 3) return Scheduler.Event.NEXT; // brak przerwy po ostatnim bloku
    breakKey.keys = undefined; breakKey.clearEvents(); breakKey.start();
    breakText.setAutoDraw(true);
    return Scheduler.Event.NEXT;
  }
}
function breakRoutineEachFrame() {
  return async function () {
    if (psychoJS.experiment.experimentEnded || psychoJS.eventManager.getKeys({ keyList: ['escape'] }).length > 0) {
      return quitPsychoJS('The [Escape] key was pressed. Goodbye!', true);
    }
    if (blocksLoop.thisN === 3) return Scheduler.Event.NEXT;
    let keys = breakKey.getKeys({ keyList: ['space'], waitRelease: false });

    if (window._touchJustStarted && window._touchCanvas) {
      keys = keys.concat([{ name: 'space', rt: breakKey.clock.getTime(), duration: 0 }]);
      window._touchJustStarted = false;
    }

    if (keys.length > 0) return Scheduler.Event.NEXT;
    return Scheduler.Event.FLIP_REPEAT;
  }
}
function breakRoutineEnd() {
  return async function () {
    if (blocksLoop.thisN !== 3) {
      breakText.setAutoDraw(false);
      breakKey.stop();
    }
    return Scheduler.Event.NEXT;
  }
}

async function quitPsychoJS(message, isCompleted) {
  if (typeof window.electronTest !== 'undefined' && isCompleted) {
    let goTrials = 0, nogoTrials = 0;
    let hits = 0, misses = 0, cr = 0, fa = 0;
    let sumHitRT = 0, countHitRT = 0;
    let sumFaRT = 0, countFaRT = 0;

    for (let t of window.nousData) {
      if (t.anticipatory) continue;
      if (t.condition === 'go') {
        goTrials++;
        if (t.pressed) { hits++; sumHitRT += t.rt; countHitRT++; }
        else { misses++; }
      } else {
        nogoTrials++;
        if (t.pressed) { fa++; sumFaRT += t.rt; countFaRT++; }
        else { cr++; }
      }
    }

    let HR = countHitRT / (goTrials || 1);
    let FAR = countFaRT / (nogoTrials || 1);

    let HR_adj = HR; let FAR_adj = FAR;
    if (HR_adj === 1) HR_adj = 1 - 1 / (2 * goTrials);
    if (HR_adj === 0) HR_adj = 1 / (2 * goTrials);
    if (FAR_adj === 1) FAR_adj = 1 - 1 / (2 * nogoTrials);
    if (FAR_adj === 0) FAR_adj = 1 / (2 * nogoTrials);

    function pNorm(p) {
      let t = Math.sqrt(-2.0 * Math.log(Math.min(Math.max(p, 0.00001), 0.99999)));
      let num = 2.515517 + 0.802853 * t + 0.010328 * t * t;
      let den = 1.0 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t;
      let z = t - num / den;
      return p > 0.5 ? z : -z;
    }

    let dPrime = (pNorm(HR_adj) - pNorm(FAR_adj)).toFixed(2);
    let avgHitRT = countHitRT > 0 ? Math.round((sumHitRT / countHitRT) * 1000) : 0;
    let avgFaRT = countFaRT > 0 ? Math.round((sumFaRT / countFaRT) * 1000) : 0;

    let totalCorrect = hits + cr;
    let totalTrials = goTrials + nogoTrials;
    let accuracy = totalTrials > 0 ? Math.round((totalCorrect / totalTrials) * 100) : 0;

    let payload = {
      testId: "GoNoGoCyfry",
      subjectId: expInfo['participant'],
      session: expInfo['session'],
      timestamp: new Date().toISOString(),
      ilosc_poprawnych_nacisniec: hits,
      ilosc_blednych_nacisniec: fa,
      ogolna_ilosc_nacisniec: countHitRT + countFaRT,
      sredni_czas_reakcji: avgHitRT,
      score: `Hits: ${hits}/${goTrials} | FA: ${fa}/${nogoTrials} | Skut: ${accuracy}% | d': ${dPrime} | RT Hits: ${avgHitRT} ms | RT FA: ${avgFaRT} ms`,
      statystyki: {
        go_trials: goTrials,
        nogo_trials: nogoTrials,
        hits: hits,
        misses: misses,
        false_alarms: fa,
        correct_rejections: cr,
        d_prime: parseFloat(dPrime),
        avg_hit_rt_ms: avgHitRT,
        avg_fa_rt_ms: avgFaRT,
        accuracy_percent: accuracy
      },
      wyniki: window.nousData
    };

    window.electronTest.sendResults(payload);
  } else if (typeof window.electronTest !== 'undefined') {
    window.electronTest.close();
  }

  psychoJS.window.close();
  psychoJS.quit({ message, isCompleted });
  return Scheduler.Event.QUIT;
}
