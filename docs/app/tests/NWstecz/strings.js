// strings.js — katalog tekstów testu N-wstecz (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'W tym teście będziesz widzieć kolejne cyfry.\n\nPo wyświetleniu pierwszych 5 cyfr, Twoim zadaniem będzie ocenić, czy aktualna cyfra jest TAKA SAMA jak cyfra zapisana N miejsc wcześniej.\n\nNaciśnij TAK (Y) jeśli cyfra jest taka sama, NIE (N) jeśli jest inna.\nBrak reakcji oznacza automatycznie odpowiedź "Nie".\n\nNaciśnij SPACJĘ, aby kontynuować.',
    'nback':
      'Wybierz ile miejsc wstecz chcesz zapamiętywać:\n\n1 - 1 miejsce wstecz\n2 - 2 miejsca wstecz\n3 - 3 miejsca wstecz\n4 - 4 miejsca wstecz\n5 - 5 miejsc wstecz\n\nNaciśnij 1, 2, 3, 4 lub 5.',
    'difficulty':
      'Wybierz czas na odpowiedź:\n\n1 - ŁATWY (5 sekund)\n2 - NORMALNY (2 sekundy)\n3 - TRUDNY (1 sekunda)\n\nNaciśnij 1, 2 lub 3.',
    'nbackLevel_1': '1 wstecz',
    'nbackLevel_2': '2 wstecz',
    'nbackLevel_3': '3 wstecz',
    'nbackLevel_4': '4 wstecz',
    'nbackLevel_5': '5 wstecz',
    'question': 'Czy ta cyfra pojawiła się {{n}} miejsc temu? (TAK/NIE)',
    'difficultyEasy': 'Łatwy (5s)',
    'difficultyNormal': 'Normalny (2s)',
    'difficultyHard': 'Trudny (1s)',
    'quit.thanks': 'Dziękujemy za udział w teście.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poprawne: {{correct}} | Błędne: {{wrong}} | N-Back: {{nback}} | Poziom: {{level}} | Śr. RT: {{rt}} ms',
  },
  en: {
    'welcome':
      'In this test you will see consecutive digits.\n\nAfter the first 5 digits are shown, your task is to judge whether the current digit is the SAME as the digit shown N positions earlier.\n\nPress YES (Y) if the digit is the same, NO (N) if it is different.\nNo response automatically means the answer "No".\n\nPress SPACE to continue.',
    'nback':
      'Choose how many positions back you want to remember:\n\n1 - 1 position back\n2 - 2 positions back\n3 - 3 positions back\n4 - 4 positions back\n5 - 5 positions back\n\nPress 1, 2, 3, 4 or 5.',
    'difficulty':
      'Choose the response time:\n\n1 - EASY (5 seconds)\n2 - NORMAL (2 seconds)\n3 - HARD (1 second)\n\nPress 1, 2 or 3.',
    'nbackLevel_1': '1 back',
    'nbackLevel_2': '2 back',
    'nbackLevel_3': '3 back',
    'nbackLevel_4': '4 back',
    'nbackLevel_5': '5 back',
    'question': 'Did this digit appear {{n}} positions ago? (YES/NO)',
    'difficultyEasy': 'Easy (5s)',
    'difficultyNormal': 'Normal (2s)',
    'difficultyHard': 'Hard (1s)',
    'quit.thanks': 'Thank you for taking part in the test.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Correct: {{correct}} | Wrong: {{wrong}} | N-Back: {{nback}} | Level: {{level}} | Avg RT: {{rt}} ms',
  },
};
