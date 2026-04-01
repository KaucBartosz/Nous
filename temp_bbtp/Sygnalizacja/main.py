# -*- coding: utf-8 -*-
"""
Sygnalizacja – wersja PsychoPy (HPM).
Dwa samochody, dwa światła; po 1 s jedno światło zmienia się na zielone.
Kliknięcie w auto z zielonym światłem = poprawne (mierzymy RT). Falstart = błąd.
Integracja z Nous: NOUS_LAUNCHER, results.json, ESC bez zapisu.
"""
import os
import json
import random
from datetime import datetime
from pathlib import Path
from psychopy import visual, core, event

NOUS_LAUNCHER = os.environ.get('NOUS_LAUNCHER') == '1'
NOUS_TRAINING = os.environ.get('NOUS_TRAINING') == '1'
SCRIPT_DIR = Path(__file__).resolve().parent
RESOURCES = SCRIPT_DIR / 'resources'

N_TRIALS = 50 if not NOUS_TRAINING else 25
GREEN_ONSET = 1.0
TRIAL_TIMEOUT = 3.0


def _write_results(script_dir, trials_data, poprawne, bledne, wszystkie, avg_rt_ms, score_text=''):
    results = {
        'testId': 'Sygnalizacja',
        'subjectId': f'{random.randint(0, 999999):06d}',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'ilosc_poprawnych_nacisniec': poprawne,
        'ilosc_blednych_nacisniec': bledne,
        'ogolna_ilosc_nacisniec': wszystkie,
        'sredni_czas_reakcji': avg_rt_ms,
        'score': score_text or f'Poprawne: {poprawne} | Błędne: {bledne} | Łącznie: {wszystkie} | Śr. RT: {avg_rt_ms} ms',
        'wyniki': trials_data,
    }
    out_path = script_dir / 'results.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


def main():
    syg_czer = RESOURCES / 'sygCzer.png'
    syg_ziel = RESOURCES / 'sygZiel.png'
    sam = RESOURCES / 'sam.png'
    if not syg_czer.exists():
        syg_czer = SCRIPT_DIR / 'resources' / 'sygCzer.png'
    if not syg_ziel.exists():
        syg_ziel = SCRIPT_DIR / 'resources' / 'sygZiel.png'
    if not sam.exists():
        sam = SCRIPT_DIR / 'resources' / 'sam.png'

    win = visual.Window(fullscr=True, units='height', color=(0, 0, 0), allowGUI=False)

    instr = visual.TextStim(
        win,
        text='Za chwilę zobaczysz dwa samochody i dwie sygnalizacje świetlne. Za pomocą strzałek na klawiaturze lub przycisków A (prawo)/D (lewo), wskaż ten z samochodów, przy którym z sygnalizacja zmieni kolor na zielony. Staraj się reagować najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
        color='white', height=0.05, wrapWidth=1.8, alignText='center',
    )
    instr.draw()
    win.flip()
    keys = event.waitKeys(keyList=['space', 'escape'])
    if keys and keys[0] == 'escape':
        win.close()
        if NOUS_LAUNCHER:
            _write_results(SCRIPT_DIR, [], 0, 0, 0, 0, score_text='')
        return

    # Stimuli – pozycje jak w JS
    left_signal = visual.ImageStim(win, image=str(syg_czer), size=(0.15, 0.25), pos=(-0.6, 0.2))
    right_signal = visual.ImageStim(win, image=str(syg_czer), size=(0.15, 0.25), pos=(0.6, 0.2))
    left_car = visual.ImageStim(win, image=str(sam), size=(0.2, 0.2), pos=(-0.3, 0))
    right_car = visual.ImageStim(win, image=str(sam), size=(0.2, 0.2), pos=(0.3, 0))

    trials_data = []
    escaped = False

    for _ in range(N_TRIALS):
        correct_side = random.choice(['left', 'right'])
        left_signal.image = str(syg_czer)
        right_signal.image = str(syg_czer)

        trial_clock = core.Clock()
        clicked_side = None
        rt_sec = None

        while trial_clock.getTime() < TRIAL_TIMEOUT:
            t = trial_clock.getTime()

            # Po 1 s – zielone światło po stronie correct_side
            if t >= GREEN_ONSET:
                if correct_side == 'left':
                    left_signal.image = str(syg_ziel)
                else:
                    right_signal.image = str(syg_ziel)

            left_signal.draw()
            right_signal.draw()
            left_car.draw()
            right_car.draw()
            win.flip()

            if event.getKeys(keyList=['escape']):
                escaped = True
                break

            if clicked_side is None:
                # Klawiatura
                keys = event.getKeys(keyList=['left', 'right', 'a', 'd'])
                if keys:
                    k = keys[0]
                    if k in ('left', 'a'):
                        clicked_side = 'left' if t >= GREEN_ONSET else 'early'
                        rt_sec = (t - GREEN_ONSET) if t >= GREEN_ONSET else 0
                    elif k in ('right', 'd'):
                        clicked_side = 'right' if t >= GREEN_ONSET else 'early'
                        rt_sec = (t - GREEN_ONSET) if t >= GREEN_ONSET else 0

            if clicked_side is not None:
                break

        if escaped:
            break

        # Ocena
        if clicked_side is None:
            outcome = 'too_slow'
        elif clicked_side == 'early':
            outcome = 'incorrect'
        else:
            outcome = 'correct' if clicked_side == correct_side else 'incorrect'

        trials_data.append({
            'correct_side': correct_side,
            'clicked_side': clicked_side,
            'rt': rt_sec,
            'outcome': outcome,
        })

    win.close()

    if not NOUS_LAUNCHER:
        return

    # Liczby do standardu Nous (nacisnięcia = kliknięcia, nie „too_slow”)
    poprawne = sum(1 for t in trials_data if t.get('outcome') == 'correct')
    bledne = sum(1 for t in trials_data if t.get('outcome') == 'incorrect')
    wszystkie = sum(1 for t in trials_data if t.get('clicked_side') is not None)
    rts = [t['rt'] for t in trials_data if t.get('rt') is not None and t['rt'] >= 0 and t.get('outcome') == 'correct']
    if not rts:
        rts = [t['rt'] for t in trials_data if t.get('rt') is not None and t['rt'] >= 0]
    avg_rt_ms = round((sum(rts) / len(rts)) * 1000) if rts else 0
    total = len(trials_data)
    accuracy = round((poprawne / total) * 100) if total else 0
    score_text = f'Poprawne: {poprawne} | Błędne: {bledne} | Łącznie: {wszystkie} | Skuteczność: {accuracy}% | Śr. RT: {avg_rt_ms} ms'

    _write_results(SCRIPT_DIR, trials_data, poprawne, bledne, wszystkie, avg_rt_ms, score_text=score_text)


if __name__ == '__main__':
    main()
