// strings.js — katalog tekstów testu Corsi (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'TEST CORSI - Pamięć przestrzenna\n\nNa ekranie pojawią się koła w siatce.\nKilka kół zapali się na CZERWONO (wzór systemu).\nZapamiętaj kolejność i kliknij na koła — podświetlą się na ZIELONO.\nKażda poprawna odpowiedź wydłuży sekwencję.\nTest kończy się po błędnej odpowiedzi.\n\nNaciśnij SPACJĘ, aby kontynuować.\nESC - wyjście',
    'difficulty':
      'Wybierz rozmiar siatki:\n\n1 - 3x3 (Łatwy)\n2 - 4x4 (Średni)\n3 - 5x5 (Trudny)\n4 - 6x6 (Bardzo trudny)\n5 - 7x7 (Ekspert)\n6 - 8x8 (Mistrz)\n7 - 9x9 (Arcymistrz)\n8 - 10x10 (Legenda)\n\nNaciśnij 1-8\nESC - wyjście',
    'speed':
      'Wybierz szybkość świecenia:\n\n1 - Łatwy (1.0s - długo)\n2 - Normalny (0.5s)\n3 - Trudny (0.3s - szybko)\n\nNaciśnij 1, 2 lub 3\nESC - wyjście',
    'observe': 'Obserwuj sekwencje...',
    'observeProgress': 'Obserwuj... ({{current}}/{{total}})',
    'repeat': 'Klikaj koła w tej samej kolejności.',
    'error': 'BŁĄD! Powtórzenie poprawnej sekwencji:',
    'timeout': 'Czas minął! Powtórzenie poprawnej sekwencji:',
    'watch': 'Obserwuj uważnie...',
    'correct': 'POPRAWNIE!',
    'length': 'Długość: {{n}}',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'quit.cancelled': 'Anulowano.',
    'quit.escape': 'Escape',
    'difficultyLabel': '{{difficultyName}} ({{n}}x{{n}})',
    'difficultyNames': 'Łatwy|Średni|Trudny|Bardzo trudny|Ekspert|Mistrz|Arcymistrz|Legenda',
    'speedLabel': '{{speedName}} ({{seconds}}s)',
    'speedNames': 'Easy|Normal|Hard',
    'score':
      'Maks: {{max}} | Poprawne: {{correct}}/{{total}} | Skuteczność: {{accuracy}}% | Śr. RT: {{rt}}ms | {{difficulty}} | {{speed}}',
  },
  en: {
    'welcome':
      'CORSI TEST - Spatial memory\n\nCircles will appear in a grid.\nSeveral circles will light up RED (system pattern).\nRemember the order and click the circles — they will light up GREEN.\nEach correct answer makes the sequence longer.\nThe test ends after a wrong answer.\n\nPress SPACE to continue.\nESC - exit',
    'difficulty':
      'Choose the grid size:\n\n1 - 3x3 (Easy)\n2 - 4x4 (Medium)\n3 - 5x5 (Hard)\n4 - 6x6 (Very hard)\n5 - 7x7 (Expert)\n6 - 8x8 (Master)\n7 - 9x9 (Grandmaster)\n8 - 10x10 (Legend)\n\nPress 1-8\nESC - exit',
    'speed':
      'Choose the flash speed:\n\n1 - Easy (1.0s - slow)\n2 - Normal (0.5s)\n3 - Hard (0.3s - fast)\n\nPress 1, 2 or 3\nESC - exit',
    'observe': 'Watch the sequences...',
    'observeProgress': 'Watch... ({{current}}/{{total}})',
    'repeat': 'Click the circles in the same order.',
    'error': 'WRONG! Replay of the correct sequence:',
    'timeout': 'Time is up! Replay of the correct sequence:',
    'watch': 'Watch carefully...',
    'correct': 'CORRECT!',
    'length': 'Length: {{n}}',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'quit.cancelled': 'Cancelled.',
    'quit.escape': 'Escape',
    'difficultyLabel': '{{difficultyName}} ({{n}}x{{n}})',
    'difficultyNames': 'Easy|Medium|Hard|Very hard|Expert|Master|Grandmaster|Legend',
    'speedLabel': '{{speedName}} ({{seconds}}s)',
    'speedNames': 'Easy|Normal|Hard',
    'score':
      'Max: {{max}} | Correct: {{correct}}/{{total}} | Accuracy: {{accuracy}}% | Avg RT: {{rt}}ms | {{difficulty}} | {{speed}}',
  },
};
