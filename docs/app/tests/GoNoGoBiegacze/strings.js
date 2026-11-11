// strings.js — katalog tekstów testu Go/No-Go (cyfry/GoNoGoBiegacze).
// Tłumaczone są tylko teksty widoczne dla badanego; klucze danych wyników
// w sendResults pozostają polskie.

export const STRINGS = {
  pl: {
    'mode': 'Wybierz tryb:\n1 - Badanie\n2 - Trening',
    'instructions':
      'Zadanie Go/No-Go\n\nNaciśnij SPACJĘ, gdy zobaczysz cyfrę NIEPARZYSTĄ (1, 3, 7, 9).\nNIE naciskaj niczego, gdy zobaczysz cyfrę PARZYSTĄ (2, 4, 6, 8).\n\nNaciśnij SPACJĘ, aby rozpocząć.',
    'break': 'Przerwa. Naciśnij SPACJĘ, aby kontynuować.',
    'postTraining':
      'Koniec treningu\n\nTeraz zacznie się zadanie właściwe - zasady są te same,\nale nie będzie się wyświetlać informacja o poprawności reakcji.\n\nZasady:\nNaciśnij SPACJĘ, gdy zobaczysz cyfrę NIEPARZYSTĄ (1, 3, 7, 9).\nNIE naciskaj niczego, gdy zobaczysz cyfrę PARZYSTĄ (2, 4, 6, 8).\n\nNaciśnij SPACJĘ, aby rozpocząć zadanie.',
    'feedback.correct': 'Dobrze!',
    'feedback.wrong': 'Źle!',
    'quit.thanks': 'Dziękujemy za udział w badaniu.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score':
      "Hits: {{hits}}/{{go}} | FA: {{fa}}/{{nogo}} | Skut: {{accuracy}}% | d': {{d}} | RT Hits: {{rtHits}} ms | RT FA: {{rtFa}} ms",
  },
  en: {
    'mode': 'Choose a mode:\n1 - Study\n2 - Practice',
    'instructions':
      'Go/No-Go task\n\nPress the SPACE bar when you see an ODD digit (1, 3, 7, 9).\nDo NOT press anything when you see an EVEN digit (2, 4, 6, 8).\n\nPress SPACE to begin.',
    'break': 'Break. Press SPACE to continue.',
    'postTraining':
      'End of practice\n\nThe real task starts now - the rules are the same,\nbut no feedback about response correctness will be shown.\n\nRules:\nPress the SPACE bar when you see an ODD digit (1, 3, 7, 9).\nDo NOT press anything when you see an EVEN digit (2, 4, 6, 8).\n\nPress SPACE to start the task.',
    'feedback.correct': 'Correct!',
    'feedback.wrong': 'Wrong!',
    'quit.thanks': 'Thank you for taking part in the study.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score':
      "Hits: {{hits}}/{{go}} | FA: {{fa}}/{{nogo}} | Acc: {{accuracy}}% | d': {{d}} | RT Hits: {{rtHits}} ms | RT FA: {{rtFa}} ms",
  },
};
