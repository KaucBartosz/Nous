// strings.js — katalog tekstów testu Stroop (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'instructions':
      'Za chwilę na ekranie pojawiać się będą kolejno słowa zapisane kolorową czcionką. Twoim zadaniem jest zareagowanie na KOLOR czcionki i ignorowanie treści słowa.\n\nUżywaj klawiszy: 1-Czerwony, 2-Niebieski, 3-Zielony, 4-Żółty\n\nWybierz długość testu:\n1 - 10 pytań\n2 - 20 pytań\n3 - 30 pytań\n\nESC - Wyjście',
    'hint.1': '1: Czerwony',
    'hint.2': '2: Niebieski',
    'hint.3': '3: Zielony',
    'hint.4': '4: Żółty',
    'quit.thanks': 'Dziękujemy!',
    'quit.cancelled': 'Anulowano.',
    'quit.aborted': 'Przerwano.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'difficulty': '{{count}} pytań',
    'difficulty_one': '{{count}} pytanie',
    'difficulty_few': '{{count}} pytania',
    'score':
      'Poprawne: {{correct}} | Błędne: {{errors}} | Pominięte: {{skipped}} | Śr. RT: {{rt}} ms | Skuteczność: {{accuracy}}%',
  },
  en: {
    'instructions':
      'Words written in a coloured font will appear on the screen one after another. Your task is to respond to the COLOUR of the font and ignore what the word says.\n\nUse the keys: 1-Red, 2-Blue, 3-Green, 4-Yellow\n\nChoose the test length:\n1 - 10 questions\n2 - 20 questions\n3 - 30 questions\n\nESC - Exit',
    'hint.1': '1: Red',
    'hint.2': '2: Blue',
    'hint.3': '3: Green',
    'hint.4': '4: Yellow',
    'quit.thanks': 'Thank you!',
    'quit.cancelled': 'Cancelled.',
    'quit.aborted': 'Aborted.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'difficulty': '{{count}} questions',
    'difficulty_one': '{{count}} question',
    'score':
      'Correct: {{correct}} | Wrong: {{errors}} | Skipped: {{skipped}} | Avg RT: {{rt}} ms | Accuracy: {{accuracy}}%',
  },
};
