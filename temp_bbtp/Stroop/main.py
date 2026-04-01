# -*- coding: utf-8 -*-
"""
Test Stroopa – wersja PsychoPy (HPM).
Zadanie: zidentyfikuj KOLOR czcionki, ignorując TREŚĆ słowa.
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

# Definicje kolorów i słów
COLOR_MAP = {
    'czerwony': {'color': 'red', 'key': '1', 'label': '1: Czerwony'},
    'niebieski': {'color': 'blue', 'key': '2', 'label': '2: Niebieski'},
    'zielony': {'color': 'green', 'key': '3', 'label': '3: Zielony'},
    'żółty': {'color': 'yellow', 'key': '4', 'label': '4: Żółty'}
}
NAMES = list(COLOR_MAP.keys())

def _write_results(script_dir, trials_data, poprawne, bledne, wszystkie, avg_rt_ms, n_questions, score_text=''):
    results = {
        'testId': 'Stroop',
        'subjectId': f'{random.randint(0, 999999):06d}',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'ilosc_poprawnych_nacisniec': poprawne,
        'ilosc_blednych_nacisniec': bledne,
        'ogolna_ilosc_nacisniec': wszystkie,
        'sredni_czas_reakcji': avg_rt_ms,
        'poziom_trudnosci': f'{n_questions} pytań',
        'score': score_text,
        'statystyki': {
            'sredni_czas_ms': avg_rt_ms,
            'poprawne_reakcje': poprawne,
            'wszystkie_proby': wszystkie,
            'bledne_reakcje': bledne,
            'skutecznosc': round((poprawne / wszystkie) * 100) if wszystkie else 0
        },
        'wyniki': trials_data,
    }
    out_path = script_dir / 'results.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

def main():
    win = visual.Window(fullscr=True, units='height', color=(0, 0, 0), allowGUI=False)
    mouse = event.Mouse(win=win)
    mouse.setVisible(True)

    # Ekran wyboru długości testu
    selection_text = (
        "Za chwilę na ekranie pojawiać się będą kolejno słowa zapisane kolorową czcionką. "
        "Twoim zadaniem jest zareagowanie na KOLOR czcionki i ignorowanie treści słowa. "
        "Używaj klawiszy numerycznych:\n"
        "1 - Czerwony\n2 - Niebieski\n3 - Zielony\n4 - Żółty\n\n"
        "Wybierz długość testu:\n"
        "1 - 10 pytań\n"
        "2 - 20 pytań\n"
        "3 - 30 pytań\n\n"
        "Esc - Wyjście"
    )
    instr = visual.TextStim(win, text=selection_text, color='white', height=0.04, wrapWidth=1.5)
    instr.draw()
    win.flip()

    keys = event.waitKeys(keyList=['1', '2', '3', 'num_1', 'num_2', 'num_3', 'escape'])
    if 'escape' in keys:
        win.close()
        if NOUS_LAUNCHER: _write_results(SCRIPT_DIR, [], 0, 0, 0, 0, 0, score_text='Przerwano')
        return

    n_questions = 10
    if '2' in str(keys) or 'num_2' in str(keys): n_questions = 20
    elif '3' in str(keys) or 'num_3' in str(keys): n_questions = 30

    # Przygotowanie bodźców
    fixation = visual.TextStim(win, text='+', color='white', height=0.05)
    stim_text = visual.TextStim(win, text='', height=0.1, bold=True)
    
    # Podpowiedź klawiszy na górze
    hint_y = 0.4
    hints = [
        visual.TextStim(win, text=COLOR_MAP[n]['label'], color=COLOR_MAP[n]['color'], 
                        pos=((i*0.4)-0.6, hint_y), height=0.03)
        for i, n in enumerate(NAMES)
    ]

    trials_data = []
    
    for i in range(n_questions):
        word_name = random.choice(NAMES)
        color_name = random.choice(NAMES)
        congruent = (word_name == color_name)
        
        stim_text.text = word_name.upper()
        stim_text.color = COLOR_MAP[color_name]['color']
        correct_key = COLOR_MAP[color_name]['key']

        # Fixation
        fixation.draw()
        win.flip()
        core.wait(0.5)

        # Stimulus
        stim_text.draw()
        for h in hints: h.draw()
        win.flip()
        
        trial_clock = core.Clock()
        keys = event.waitKeys(keyList=['1', '2', '3', '4', 'escape'], maxWait=10.0)
        
        # Timeout (brak odpowiedzi w 10s)
        if keys is None:
            trials_data.append({
                'trial': i + 1,
                'word': word_name,
                'color': color_name,
                'congruent': congruent,
                'resp_key': 'none',
                'correct': 0,
                'rt': None,
                'responded': False
            })
            win.flip()
            core.wait(0.3)
            continue
        
        if 'escape' in keys:
            if NOUS_LAUNCHER: _write_results(SCRIPT_DIR, trials_data, 0, 0, 0, 0, n_questions, score_text='Przerwano w trakcie')
            win.close()
            return

        resp_key = keys[0]
        rt = round(trial_clock.getTime() * 1000)
        correct = 1 if resp_key == correct_key else 0
        
        trials_data.append({
            'trial': i + 1,
            'word': word_name,
            'color': color_name,
            'congruent': congruent,
            'resp_key': resp_key,
            'correct': correct,
            'rt': rt,
            'responded': True
        })

        # Feedback (krótka przerwa)
        win.flip()
        core.wait(0.3)

    win.close()

    # Statystyki
    responded = [t for t in trials_data if t.get('responded') and t['rt'] is not None]
    poprawne_nacisniecia = sum(t['correct'] for t in responded)
    wszystkie_nacisniecia = len(responded)
    bledne_nacisniecia = wszystkie_nacisniecia - poprawne_nacisniecia
    
    total_proby = len(trials_data)
    pominiete = total_proby - wszystkie_nacisniecia
    
    avg_rt = round(sum(t['rt'] for t in responded) / len(responded)) if responded else 0
    accuracy = round((poprawne_nacisniecia / total_proby) * 100) if total_proby else 0
    
    score_text = f'Poprawne: {poprawne_nacisniecia} | Błędne: {bledne_nacisniecia} | Pominięte: {pominiete} | Śr. RT: {avg_rt} ms | Skuteczność: {accuracy}%'

    if NOUS_LAUNCHER:
        _write_results(SCRIPT_DIR, trials_data, poprawne_nacisniecia, bledne_nacisniecia, wszystkie_nacisniecia, avg_rt, n_questions, score_text=score_text)

if __name__ == '__main__':
    main()
