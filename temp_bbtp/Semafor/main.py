# -*- coding: utf-8 -*-
"""
Semafor – wersja PsychoPy (HPM / Nous).
Siatka lampek: zapalają się dwie zielone lampki na krawędziach;
zadaniem jest naciśnięcie na czerwoną lampkę na przecięciu ich prostych.
"""
import os
import json
import random
from datetime import datetime
from pathlib import Path

from psychopy import visual, core, event

# --- Konfiguracja Nous (HPM) ---
NOUS_LAUNCHER = os.environ.get('NOUS_LAUNCHER') == '1'
NOUS_TRAINING = os.environ.get('NOUS_TRAINING') == '1'
SCRIPT_DIR = Path(__file__).resolve().parent
RESOURCES = SCRIPT_DIR / 'resources'

N = 8
TRIAL_TIMEOUT_SEC = 15.0
FEEDBACK_TIME = 0.5
N_TRIALS = 20

INSTRUCTION = (
    'Za chwilę zobaczysz planszę z lampkami. Twoim zadaniem będzie, za pomocą MYSZY, wskazać tę lampkę, która znajduje się na przecięciu prostych dwóch lampek zapalonych na zielono. Staraj się klikać najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.'
)

CORNER_COORDS = [(0, 0), (0, N-1), (N-1, 0), (N-1, N-1)]


def main():
    win = visual.Window(
        fullscr=True,
        units='height',
        color=(0, 0, 0),
        allowGUI=False,
    )
    mouse = event.Mouse(win=win)
    mouse.setVisible(True)

    # Ekran instrukcji
    instr = visual.TextStim(
        win, text=INSTRUCTION,
        color='white', height=0.05,
        wrapWidth=1.2, alignText='center',
    )
    instr.draw()
    win.flip()
    keys = event.waitKeys(keyList=['space', 'return', 'y', 'n', 'escape'])
    first = keys[0] if keys else None
    keyname = first[0] if first and isinstance(first, (list, tuple)) else first
    if keyname == 'escape':
        win.close()
        if NOUS_LAUNCHER:
            _write_results(SCRIPT_DIR, [], 0, 0, 0)
        return

    # Tworzenie siatki lampek
    coords = [(i - (N - 1) / 2) * 0.08 for i in range(N)]
    lamp_grid = []
    for ix in range(N):
        row = []
        for iy in range(N):
            is_outer = (ix == 0) or (ix == N-1) or (iy == 0) or (iy == N-1)
            is_corner = (ix, iy) in CORNER_COORDS

            if is_corner:
                img = str(RESOURCES / 'lampkaOFF.png')
                opacity = 0.0
            elif is_outer:
                img = str(RESOURCES / 'lampkaZielOFF.png')
                opacity = 1.0
            else:
                img = str(RESOURCES / 'lampkaOFF.png')
                opacity = 1.0

            stim = visual.ImageStim(
                win,
                image=img,
                size=(0.08, 0.08),
                pos=(coords[ix], coords[iy]),
            )
            stim.opacity = opacity
            row.append(stim)
        lamp_grid.append(row)

    trials_data = []
    trial_clock = core.Clock()
    feedback_clock = core.Clock()
    escaped = False

    for trial_idx in range(N_TRIALS):
        if event.getKeys(keyList=['escape']):
            escaped = True
            break

        # Reset siatki: zielone OFF, czerwone OFF, rogi niewidoczne
        for ix in range(N):
            for iy in range(N):
                is_outer = (ix == 0) or (ix == N-1) or (iy == 0) or (iy == N-1)
                is_corner = (ix, iy) in CORNER_COORDS

                if is_corner:
                    lamp_grid[ix][iy].opacity = 0.0
                    lamp_grid[ix][iy].setImage(str(RESOURCES / 'lampkaOFF.png'))
                elif is_outer:
                    lamp_grid[ix][iy].opacity = 1.0
                    lamp_grid[ix][iy].setImage(str(RESOURCES / 'lampkaZielOFF.png'))
                else:
                    lamp_grid[ix][iy].opacity = 1.0
                    lamp_grid[ix][iy].setImage(str(RESOURCES / 'lampkaOFF.png'))

        # Losowanie krawędzi
        x_edge = 'top' if random.random() < 0.5 else 'bottom'
        y_edge = 'left' if random.random() < 0.5 else 'right'

        y_edge_row = 0 if x_edge == 'top' else (N - 1)
        x_edge_col = 0 if y_edge == 'left' else (N - 1)

        # Losowanie pozycji zielonych lampek (z wykluczeniem rogów)
        while True:
            x_index = random.randrange(N)
            while x_index == x_edge_col:
                x_index = random.randrange(N)

            y_index = random.randrange(N)
            while y_index == y_edge_row:
                y_index = random.randrange(N)

            x_lamp = (x_index, y_edge_row)
            y_lamp = (x_edge_col, y_index)

            bad = any(
                (x_lamp[0] == cx and x_lamp[1] == cy) or
                (y_lamp[0] == cx and y_lamp[1] == cy)
                for cx, cy in CORNER_COORDS
            )

            if not bad:
                break

        # Zapalenie zielonych lampek
        lamp_grid[x_index][y_edge_row].setImage(str(RESOURCES / 'lampkaZielON.png'))
        lamp_grid[x_edge_col][y_index].setImage(str(RESOURCES / 'lampkaZielON.png'))

        # Cel: czerwona lampka na przecięciu
        target_x = x_index
        target_y = y_index

        clicked_x = None
        clicked_y = None
        rt = None
        correct = 0
        show_feedback = False
        prev_pressed = mouse.getPressed()

        trial_clock.reset()
        feedback_clock.reset()

        while trial_clock.getTime() < TRIAL_TIMEOUT_SEC:
            if event.getKeys(keyList=['escape']):
                escaped = True
                break

            elapsed = trial_clock.getTime()

            # Rysuj siatkę
            for ix in range(N):
                for iy in range(N):
                    if lamp_grid[ix][iy].opacity > 0:
                        lamp_grid[ix][iy].draw()

            # Kliknięcie myszy
            pressed = mouse.getPressed()
            is_new_click = pressed[0] and not prev_pressed[0]
            prev_pressed = pressed

            if not show_feedback and is_new_click:
                click_pos = mouse.getPos()
                for ix in range(N):
                    for iy in range(N):
                        if lamp_grid[ix][iy].opacity == 0:
                            continue
                        if lamp_grid[ix][iy].contains(click_pos):
                            clicked_x = ix
                            clicked_y = iy
                            rt = elapsed
                            correct = 1 if (clicked_x == target_x and clicked_y == target_y) else 0
                            if correct == 1:
                                lamp_grid[clicked_x][clicked_y].setImage(str(RESOURCES / 'lampkaON.png'))
                            show_feedback = True
                            feedback_clock.reset()
                            break
                    if show_feedback:
                        break

            # Feedback
            if show_feedback and feedback_clock.getTime() >= FEEDBACK_TIME:
                break

            # Timeout
            if elapsed >= TRIAL_TIMEOUT_SEC:
                break

            win.flip()

        trials_data.append({
            'x_edge': x_edge,
            'y_edge': y_edge,
            'x_index': x_index,
            'y_index': y_index,
            'target_x': target_x,
            'target_y': target_y,
            'clicked_x': clicked_x,
            'clicked_y': clicked_y,
            'rt': rt,
            'correct': correct,
        })

        if escaped:
            break

    win.close()

    # Wyniki
    ilosc_klikniec_ogolem = sum(1 for t in trials_data if t['clicked_x'] is not None)
    poprawne_trafienia = sum(1 for t in trials_data if t['correct'] == 1)
    no_answer = sum(1 for t in trials_data if t['clicked_x'] is None)
    bledne_trafienia = max(0, ilosc_klikniec_ogolem - poprawne_trafienia) + no_answer
    total_trials = ilosc_klikniec_ogolem + no_answer
    accuracy = round((poprawne_trafienia / total_trials) * 100) if total_trials else 0

    if NOUS_LAUNCHER:
        # Liczenie średniego RT
        rts = [t['rt'] for t in trials_data if t.get('rt') is not None]
        avg_rt = round((sum(rts) / len(rts)) * 1000) if rts else 0
        _write_results(SCRIPT_DIR, trials_data, poprawne_trafienia, bledne_trafienia, ilosc_klikniec_ogolem, accuracy, no_answer, avg_rt)


def _write_results(script_dir, trials_data, poprawne_trafienia, bledne_trafienia, ilosc_klikniec_ogolem, accuracy, no_answer, avg_rt):
    results = {
        'testId': 'semafor',
        'subjectId': f'{random.randint(0, 999999):06d}',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'ilosc_poprawnych_nacisniec': poprawne_trafienia,
        'ilosc_blednych_nacisniec': bledne_trafienia,
        'ogolna_ilosc_nacisniec': ilosc_klikniec_ogolem,
        'ilosc_brakow_nacisniec': no_answer,
        'noAnserw': no_answer,
        'sredni_czas_reakcji': avg_rt,
        'score': f'Kliknięć: {ilosc_klikniec_ogolem} | Poprawne: {poprawne_trafienia} | Błędne (w tym brak odp.): {bledne_trafienia} | Brak odp.: {no_answer} | Skuteczność: {accuracy}% | Śr. RT: {avg_rt} ms',

        'statystyki': {
            'poprawne': poprawne_trafienia,
            'bledne': bledne_trafienia,
            'wszystkie_kliki': ilosc_klikniec_ogolem,
            'brak_odpowiedzi': no_answer,
            'proby': len(trials_data),
            'skutecznosc_proc': accuracy,
        },
        'wyniki': trials_data,
    }
    out_path = script_dir / 'results.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
