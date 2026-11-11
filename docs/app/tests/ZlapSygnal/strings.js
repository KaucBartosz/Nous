// strings.js — katalog tekstów testu ZlapSygnal (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'chooseDuration': 'Wybierz czas trwania testu poniżej',
    'duration_seconds': '{{n}} sekund',
    'duration_seconds_one': '{{n}} sekunda',
    'duration_seconds_few': '{{n}} sekundy',
    'welcome':
      'Na ekranie w krótkich odstępach czasu pojawiać się będzie czerwone kółko. \nTwoim zadaniem jest, za pomocą MYSZY, kliknąć na samochód za każdym razem, gdy pojawi się nowe kółko. \nStaraj się reagować najszybciej jak potrafisz. \nAby rozpocząć zadanie, wciśnij SPACJĘ.',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poprawne: {{correct}} | Misses: {{misses}} | Bez kółka: {{withoutCircle}} | Łącznie: {{total}} | Śr. RT: {{rt}} ms',
  },
  en: {
    'chooseDuration': 'Choose the test duration below',
    'duration_seconds': '{{n}} seconds',
    'duration_seconds_one': '{{n}} second',
    'welcome':
      'A red circle will appear on the screen at short intervals. \nUsing the MOUSE, click the car every time a new circle appears. \nTry to respond as fast as you can. \nTo start the task, press SPACE.',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Correct: {{correct}} | Missed: {{misses}} | Without circle: {{withoutCircle}} | Total: {{total}} | Avg RT: {{rt}} ms',
  },
};
