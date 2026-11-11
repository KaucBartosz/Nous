// strings.js — katalog tekstów testu Bystre Oczko (tłumaczone tylko teksty
// widoczne dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'Za chwilę na ekranie pojawią się sygnalizacje świetlne. \nTwoim zadaniem jest, za pomocą MYSZY, kliknąć na tę z sygnalizacji, w której światło zmieni kolor na zielony. Staraj się reagować najszybciej jak potrafisz.\n\nGdy sygnalizacje zgasną, umieść kursor myszki na małym czerwonym kwadracie na środku ekranu, aby rozpocząć kolejną rundę.\n\nAby rozpocząć zadanie, wciśnij SPACJĘ.',
    'selection': 'Wybierz ilość rund:\n\n1 - 10 rund\n2 - 30 rund\n3 - 60 rund\n\nNaciśnij 1, 2 lub 3.',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poprawne: {{correct}} | Błędne: {{wrong}} | Braki: {{missing}} | Śr. RT: {{rt}} ms',
  },
  en: {
    'welcome':
      'Traffic lights will soon appear on the screen. \nUsing the MOUSE, click the traffic light whose light turns green. Try to respond as quickly as you can.\n\nWhen the lights go out, place the mouse cursor on the small red square in the middle of the screen to start the next round.\n\nTo start the task, press SPACE.',
    'selection': 'Choose the number of rounds:\n\n1 - 10 rounds\n2 - 30 rounds\n3 - 60 rounds\n\nPress 1, 2 or 3.',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Correct: {{correct}} | Wrong: {{wrong}} | Missed: {{missing}} | Avg RT: {{rt}} ms',
  },
};
