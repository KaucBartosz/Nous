// strings.js — katalog tekstów testu Sygnalizacja (tłumaczone tylko teksty
// widoczne dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'Za chwilę zobaczysz dwa samochody i dwie sygnalizacje świetlne. \nZa pomocą strzałek na klawiaturze wskaż ten z samochodów, przy którym sygnalizacja zmieni kolor na zielony. \nStaraj się reagować najszybciej jak potrafisz. \nAby rozpocząć zadanie, wciśnij SPACJĘ.',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poprawne: {{correct}} | Błędne: {{wrong}} | Łącznie: {{total}} | Skuteczność: {{accuracy}}% | Śr. RT: {{rt}} ms',
  },
  en: {
    'welcome':
      'You will soon see two cars and two traffic lights. \nUsing the arrow keys on your keyboard, indicate the car whose traffic light turns green. \nTry to respond as quickly as you can. \nTo start the task, press SPACE.',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Correct: {{correct}} | Wrong: {{wrong}} | Total: {{total}} | Accuracy: {{accuracy}}% | Avg RT: {{rt}} ms',
  },
};
