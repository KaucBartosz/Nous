"""
Samochodzik - Test nawigacji (wersja PsychoPy)
Sterowanie: strzałki klawiatury
Mechanika: wykrywanie kolizji z białą trasą, reset na start po wyjechaniu poza trasę
"""

import os
import json
import random
import math
from datetime import datetime
from pathlib import Path
from psychopy import visual, core, event
from PIL import Image

# --- Konfiguracja Nous (HPM) ---
NOUS_LAUNCHER = os.environ.get('NOUS_LAUNCHER') == '1'
NOUS_TRAINING = os.environ.get('NOUS_TRAINING') == '1'
SCRIPT_DIR = Path(__file__).resolve().parent
RESOURCES = SCRIPT_DIR / 'resources'

# Konfiguracja testu
MAP_SCALE = 1.6
MAP_ASPECT = 0.555
CAR_SIZE = (0.03, 0.05)

INSTRUCTION = (
    'Twoim zadaniem będzie przejechanie labiryntu. Za pomocą strzałek na klawiaturze, pokieruj samochodem do mety. Staraj się dokładnie kierować samochodem, aby nie wyjechać poza krawędź labiryntu. Wyjechanie poza krawędź spowoduje powrót samochodu na start. Naciśnij SPACJĘ aby wybrać trasę.'
)

DIFFICULTY_TXT = (
    'WYBIERZ TRASĘ:\n\n'
    '1 - Klasyczna (Łatwa)\n'
    '2 - Labirynt (Trudna)\n\n'
    'Naciśnij 1 lub 2'
)

def _write_results(script_dir, trials_data, collision_count, duration, difficulty):
    results = {
        'testId': 'samochodzik',
        'subjectId': f'{random.randint(0, 999999):06d}',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'poziom_trudnosci': difficulty,
        'ilosc_poprawnych_nacisniec': 1 if duration > 0 else 0,
        'ilosc_blednych_nacisniec': collision_count,
        'ogolna_ilosc_nacisniec': (1 if duration > 0 else 0) + collision_count,
        'czas_pokonania_trasy_sek': round(duration),
        'score': f'Trasa {difficulty} | Kolizje: {collision_count} | Czas: {round(duration)}s',
        'statystyki': {
            'trasa': difficulty,
            'kolizje': collision_count,
            'czas_trwania_ms': round(duration * 1000)
        },
        'wyniki': trials_data,
    }
    out_path = script_dir / 'results.json'
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

def find_start_position(track_path):
    """Automatyczne szukanie środka zielonego punktu startowego na obrazie"""
    try:
        img = Image.open(str(track_path)).convert('RGB')
        pixels = img.load()
        width, height = img.size
        
        green_x = []
        green_y = []
        for y in range(height):
            for x in range(width):
                r, g, b = pixels[x, y]
                # Szukaj zielonego (0, 255, 0) z tolerancją
                if r < 50 and g > 200 and b < 50:
                    green_x.append(x)
                    green_y.append(y)
        
        if green_x:
            # Obliczamy średnią, aby trafić w środek pola
            avg_x = sum(green_x) / len(green_x)
            avg_y = sum(green_y) / len(green_y)
            sx = (avg_x / width - 0.5) * MAP_SCALE
            sy = (0.2775 - avg_y / width) * MAP_SCALE
            return (sx, sy), img
    except Exception as e:
        print(f"Błąd analizy mapy: {e}")
    return (-0.336, -0.322), None # Fallback

def is_on_track(x, y, track_pixels):
    img_w, img_h = track_pixels.size
    rel_x = x / MAP_SCALE
    rel_y = y / MAP_SCALE
    px = int((rel_x + 0.5) * img_w)
    py = int((0.2775 - rel_y) * img_w)
    if px < 0 or px >= img_w or py < 0 or py >= img_h: return False
    try:
        pixel = track_pixels.getpixel((px, py))
        if isinstance(pixel, int): return pixel > 50
        return any(c > 50 for c in pixel)
    except: return False

def is_at_finish(x, y, track_pixels):
    img_w, img_h = track_pixels.size
    rel_x = x / MAP_SCALE
    rel_y = y / MAP_SCALE
    px = int((rel_x + 0.5) * img_w)
    py = int((0.2775 - rel_y) * img_w)
    if px < 0 or px >= img_w or py < 0 or py >= img_h: return False
    try:
        p = track_pixels.getpixel((px, py))
        return p[0] > 150 and p[1] < 100 and p[2] < 100
    except: return False

def main():
    win = visual.Window(fullscr=True, units='height', color=(-1, -1, -1), allowGUI=False)
    mouse = event.Mouse(win=win)
    mouse.setVisible(True)

    # 1. Instrukcja
    instr = visual.TextStim(win, text=INSTRUCTION, color='white', height=0.04)
    instr.draw()
    win.flip()
    if 'escape' in event.waitKeys(keyList=['space', 'escape']):
        win.close()
        return

    # 2. Wybór trasy
    diff_stim = visual.TextStim(win, text=DIFFICULTY_TXT, color='white', height=0.04)
    diff_stim.draw()
    win.flip()
    keys = event.waitKeys(keyList=['1', '2', 'escape'])
    if not keys or 'escape' in keys:
        win.close()
        return
    
    difficulty = keys[0]
    track_path = RESOURCES / ('trasa.png' if difficulty == '1' else 'trasa2.png')
    
    # 3. Inicjalizacja trasy i samochodu
    start_pos, track_pil = find_start_position(track_path)
    
    track_stim = visual.ImageStim(win, image=str(track_path), pos=[0, 0], size=[MAP_SCALE, MAP_SCALE * MAP_ASPECT])
    car = visual.ImageStim(win, image=str(RESOURCES / 'sam.png'), pos=start_pos, size=CAR_SIZE)

    from pyglet.window import key
    key_handler = key.KeyStateHandler()
    win.winHandle.push_handlers(key_handler)

    car_x, car_y = start_pos
    car_rot = 0.0
    collision_count = 0
    start_time = core.getTime()
    finished = False
    freeze_timer = 0.0
    frame_clock = core.Clock()

    while not finished:
        dt = frame_clock.getTime()
        frame_clock.reset()
        if event.getKeys(['escape']): break
        
        # System mrożenia sterowania
        if freeze_timer > 0:
            freeze_timer -= dt
            car.opacity = 0.5
        else:
            car.opacity = 1.0
            dx, dy = 0, 0
            if key_handler[key.LEFT]: dx -= 1
            if key_handler[key.RIGHT]: dx += 1
            if key_handler[key.UP]: dy += 1
            if key_handler[key.DOWN]: dy -= 1
            
            if dx != 0 or dy != 0:
                length = math.sqrt(dx**2 + dy**2)
                car_x += (dx / length) * 0.007
                car_y += (dy / length) * 0.007
                car_rot = math.atan2(dx, dy)

        # Kolizja (4 rogi auta)
        half_w, half_h = CAR_SIZE[0]/2, CAR_SIZE[1]/2
        on_finish, collision = False, False
        for cx, cy in [(-half_w, -half_h), (half_w, -half_h), (-half_w, half_h), (half_w, half_h)]:
            rx = car_x + cx * math.cos(car_rot) + cy * math.sin(car_rot)
            ry = car_y - cx * math.sin(car_rot) + cy * math.cos(car_rot)
            if is_at_finish(rx, ry, track_pil): on_finish = True; break
            if not is_on_track(rx, ry, track_pil): collision = True; break

        if on_finish: finished = True; break
        if collision:
            car_x, car_y = start_pos
            car_rot = 0.0
            collision_count += 1
            freeze_timer = 0.5 # 0.5 sekundy blokady

        car.pos, car.ori = [car_x, car_y], math.degrees(car_rot)
        track_stim.draw()
        car.draw()
        win.flip()

    duration = core.getTime() - start_time
    if finished:
        visual.TextStim(win, text="META!", color='green', height=0.1).draw()
        win.flip()
        core.wait(2.0)

    win.close()
    if NOUS_LAUNCHER:
        _write_results(SCRIPT_DIR, [], collision_count, duration, difficulty)

if __name__ == '__main__':
    main()
