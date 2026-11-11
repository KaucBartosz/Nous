// strings.js — katalog tekstów testu Samochodzik (tłumaczone tylko teksty
// widoczne dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'Twoim zadaniem będzie przejechanie labiryntu. Za pomocą strzałek na klawiaturze, pokieruj samochodem do mety. Staraj się dokładnie kierować samochodem, aby nie wyjechać poza krawędź labiryntu. Wyjechanie poza krawędź spowoduje powrót samochodu na start. Naciśnij SPACJĘ aby wybrać trasę.',
    'chooseTrack':
      'WYBIERZ TRASĘ:\n\n1 - Klasyczna (Łatwa)\n2 - Labirynt (Trudna)\n\nNaciśnij 1 lub 2',
    'finish': 'META!\n\nZamykanie...',
    'quit.exit': 'Wyjście',
    'quit.aborted': 'Przerwano',
    'quit.cancelled': 'Anulowano',
    'quit.finished': 'Koniec',
    'score': 'Trasa {{track}} | Kolizje: {{collisions}} | Czas: {{seconds}}s',
  },
  en: {
    'welcome':
      'Your task is to drive through the maze. Using the arrow keys on your keyboard, steer the car to the finish line. Try to steer carefully so you do not leave the edge of the maze. Leaving the edge sends the car back to the start. Press SPACE to choose a track.',
    'chooseTrack':
      'CHOOSE A TRACK:\n\n1 - Classic (Easy)\n2 - Maze (Hard)\n\nPress 1 or 2',
    'finish': 'FINISH!\n\nClosing...',
    'quit.exit': 'Exit',
    'quit.aborted': 'Aborted',
    'quit.cancelled': 'Cancelled',
    'quit.finished': 'Finished',
    'score': 'Track {{track}} | Collisions: {{collisions}} | Time: {{seconds}}s',
  },
};
