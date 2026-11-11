// strings.js — katalog tekstów testu Stop (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'Twoim zadaniem będzie wcisnąć SPACJĘ, za każdym razem, gdy na ekranie pojawi się znak STOP. Staraj się reagować najszybciej jak potrafisz. Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poprawne: {{correct}} | Błędne: {{wrong}} | Łącznie: {{total}} | Skuteczność: {{accuracy}}% | Śr. RT: {{rt}} ms',
  },
  en: {
    'welcome':
      'Your task is to press SPACE every time the STOP sign appears on the screen. Try to respond as fast as you can. To start the task, press SPACE.',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Correct: {{correct}} | Wrong: {{wrong}} | Total: {{total}} | Accuracy: {{accuracy}}% | Avg RT: {{rt}} ms',
  },
};
