// strings.js — katalog tekstów testu FabrykaFigur (tłumaczone tylko teksty
// widoczne dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'instructions':
      'Za chwilę na ekranie zobaczysz serię różnych figur. Za pomocą MYSZY, klikaj na te figury, których kształt i kolor odpowiada wzorcowi przedstawionemu u góry ekranu. Wzorzec, co jakiś czas będzie się zmieniał. Zawsze należy klikać na te figury, których kształt i kolor odpowiada aktualnemu wzorcowi. Staraj się reagować najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    'difficulty':
      'Wybierz poziom trudności:\n\n1 – Łatwy (3 figury, 3 kolory)\n2 – Średni (4 figury, 4 kolory, +20% prędkości)\n3 – Trudny (5 figur, 5 kolorów, +35% prędkości)\n\nNaciśnij 1, 2 lub 3.',
    'duration':
      'Wybierz czas trwania testu:\n\n1 – 40 sekund\n2 – 180 sekund\n3 – 300 sekund\n\nNaciśnij 1, 2 lub 3.',
    'correct': 'Poprawne: {{n}}',
    'difficulty.easy': 'Łatwy',
    'difficulty.medium': 'Średni',
    'difficulty.hard': 'Trudny',
    'difficulty.unknown': 'nieznany',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poziom: {{level}} | Czas: {{seconds}}s | Poprawne: {{correct}} | Błędne: {{wrong}} | Pominięte: {{missed}} | Obiektów: {{objects}} | Skuteczność: {{accuracy}}%',
  },
  en: {
    'instructions':
      'A series of different figures will soon appear on the screen. Using the MOUSE, click the figures whose shape and color match the pattern shown at the top of the screen. The pattern will change from time to time. Always click the figures whose shape and color match the current pattern. Try to respond as fast as you can. To start the task, press SPACE.',
    'difficulty':
      'Choose the difficulty level:\n\n1 – Easy (3 shapes, 3 colors)\n2 – Medium (4 shapes, 4 colors, +20% speed)\n3 – Hard (5 shapes, 5 colors, +35% speed)\n\nPress 1, 2 or 3.',
    'duration':
      'Choose the test duration:\n\n1 – 40 seconds\n2 – 180 seconds\n3 – 300 seconds\n\nPress 1, 2 or 3.',
    'correct': 'Correct: {{n}}',
    'difficulty.easy': 'Easy',
    'difficulty.medium': 'Medium',
    'difficulty.hard': 'Hard',
    'difficulty.unknown': 'unknown',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Level: {{level}} | Time: {{seconds}}s | Correct: {{correct}} | Wrong: {{wrong}} | Missed: {{missed}} | Objects: {{objects}} | Accuracy: {{accuracy}}%',
  },
};
