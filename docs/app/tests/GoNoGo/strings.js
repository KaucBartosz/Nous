// strings.js — katalog tekstów testu GoNoGo (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'instructions':
      'Za chwilę na ekranie będą pojawiać się kolejno cyfry. Twoim zadaniem jest wcisnąć SPACJĘ, gdy pokazywana cyfra będzie PARZYSTA (0, 2, 4, 6, 8) i powstrzymać się od reakcji, gdy cyfra będzie NIEPARZYSTA (1, 3, 5, 7, 9). Aby rozpocząć zadanie, wciśnij SPACJĘ.',
    'difficulty':
      'Wybierz poziom trudności:\n\n1 - ŁATWY (1.5 sekundy)\n2 - NORMALNY (1.0 sekunda)\n3 - TRUDNY (0.5 sekundy)\n\nNaciśnij 1, 2 lub 3.',
    'length':
      'Wybierz długość testu:\n\n1 - KRÓTKI (10 prób)\n2 - ŚREDNI (30 prób)\n3 - DŁUGI (60 prób)\n\nNaciśnij 1, 2 lub 3.',
    'difficultyEasy': 'Łatwy (1.5s)',
    'difficultyNormal': 'Normalny (1.0s)',
    'difficultyHard': 'Trudny (0.5s)',
    'difficultyDefault': 'Normalny (Domyślny)',
    'difficultyUnknown': 'Różny',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      'Poprawne: {{correct}} | Błędne: {{wrong}} | Łącznie: {{total}} | Skuteczność: {{accuracy}}% | Śr. RT: {{rt}} ms | Poziom: {{level}}',
  },
  en: {
    'instructions':
      'Digits will appear on the screen one after another. Your task is to press SPACE when the displayed digit is EVEN (0, 2, 4, 6, 8) and to withhold any response when the digit is ODD (1, 3, 5, 7, 9). To start the task, press SPACE.',
    'difficulty':
      'Choose the difficulty level:\n\n1 - EASY (1.5 seconds)\n2 - NORMAL (1.0 second)\n3 - HARD (0.5 seconds)\n\nPress 1, 2 or 3.',
    'length':
      'Choose the test length:\n\n1 - SHORT (10 trials)\n2 - MEDIUM (30 trials)\n3 - LONG (60 trials)\n\nPress 1, 2 or 3.',
    'difficultyEasy': 'Easy (1.5s)',
    'difficultyNormal': 'Normal (1.0s)',
    'difficultyHard': 'Hard (0.5s)',
    'difficultyDefault': 'Normal (default)',
    'difficultyUnknown': 'Various',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      'Correct: {{correct}} | Wrong: {{wrong}} | Total: {{total}} | Accuracy: {{accuracy}}% | Avg RT: {{rt}} ms | Level: {{level}}',
  },
};
