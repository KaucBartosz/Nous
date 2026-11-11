// strings.js — katalog tekstów testu Semafor (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'menu.hint': '[ klawisze:  1  lub  2 ]',
    'menu.test': '1.Test',
    'menu.presentation': '2.Prezentacja',
    'prez.title': '— Prezentacja —',
    'prez.back': '← Wróć do menu',
    'prez.step1': 'Dwie lampki zapalają się na zielono...',
    'prez.step2': 'Każda wyznacza linię przez całą siatkę...',
    'prez.step3': 'Wskaż lampkę na przecięciu tych linii!',
    'prez.step4': 'Kliknij myszką w to miejsce!',
    'prez.step5': '✓  To jest prawidłowa odpowiedź!',
    'welcome':
      'Za chwilę zobaczysz planszę z lampkami. Twoim zadaniem będzie, za pomocą MYSZY, wskazać tę lampkę, która znajduje się na przecięciu prostych dwóch lampek zapalonych na zielono. Staraj się klikać najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Kliknięć: {{clicks}} | Poprawne: {{correct}} | Błędne (w tym brak odp.): {{wrongWithMisses}} | Brak odp.: {{misses}} | Skuteczność: {{accuracy}}% | Śr. RT: {{rt}} ms',
  },
  en: {
    'menu.hint': '[ keys:  1  or  2 ]',
    'menu.test': '1.Test',
    'menu.presentation': '2.Presentation',
    'prez.title': '— Presentation —',
    'prez.back': '← Back to menu',
    'prez.step1': 'Two lamps light up in green...',
    'prez.step2': 'Each of them marks a line across the grid...',
    'prez.step3': 'Point at the lamp where the lines cross!',
    'prez.step4': 'Click that spot with the mouse!',
    'prez.step5': '✓  This is the correct answer!',
    'welcome':
      'A board with lamps will appear shortly. Using the MOUSE, point at the lamp that lies at the crossing of the lines formed by two lamps lit in green. Try to click as fast as you can. To start the task, press SPACE.',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Clicks: {{clicks}} | Correct: {{correct}} | Wrong (incl. misses): {{wrongWithMisses}} | Missed: {{misses}} | Accuracy: {{accuracy}}% | Avg RT: {{rt}} ms',
  },
};
