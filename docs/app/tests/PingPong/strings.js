// strings.js — katalog tekstów testu PingPong (tłumaczone tylko teksty widoczne
// dla badanego; klucze danych wyników w sendResults pozostają polskie).

export const STRINGS = {
  pl: {
    'welcome':
      'PING PONG - Test Koordynacji\n\nTwoim zadaniem jest odbijanie piłki za pomocą dwóch paletek.\n\nLEWA PALETKA: klawisze W (góra) i S (dół)\nPRAWA PALETKA: strzałki góra i dół lub klawisze O (góra) i L (dół)\n\nTest trwa 2 minuty. Odbijaj piłkę jak najdłużej!\n\nNaciśnij SPACJĘ, aby wybrać poziom trudności\nESC - wyjście bez zapisu',
    'difficulty':
      'WYBIERZ POZIOM TRUDNOŚCI\n\n1 - ŁATWY (wolniejsza piłka, większe paletki)\n2 - NORMALNY (standardowa prędkość)\n3 - TRUDNY (prędkość rośnie z czasem)\n4 - PRZETRWANIE (jeden błąd = koniec, bez limitu czasu)\n\nNaciśnij 1, 2, 3 lub 4',
    'results.survival':
      'KONIEC TESTU – TRYB PRZETRWANIA\n\nCzas przeżycia: {{time}}\nOdbicia paletką: {{hits}}\n\nNaciśnij SPACJĘ, aby zakończyć',
    'results.normal':
      'KONIEC TESTU\n\nLewa strona: {{left}} uderzeń\nPrawa strona: {{right}} uderzeń\nRazem: {{total}} uderzeń\n\nNaciśnij SPACJĘ, aby zakończyć',
    'level.Easy': 'Łatwy',
    'level.Normal': 'Normalny',
    'level.Hard': 'Trudny',
    'level.Survival': 'Przetrwanie',
    'level.survivalWord': 'Przetrwanie',
    'quit.thanks': 'Dziękujemy za cierpliwość.',
    'quit.escapeCompleted': 'Naciśnięto klawisz [Escape]. Do widzenia!',
    'score.survival':
      'Poziom: {{level}} | Czas: {{seconds}}s | Odbicia: {{hits}}',
    'score.normal':
      'Poziom: {{level}} | Lewa: {{left}} | Prawa: {{right}} | Razem: {{total}}',
  },
  en: {
    'welcome':
      'PING PONG - Coordination Test\n\nYour task is to keep the ball in play using two paddles.\n\nLEFT PADDLE: keys W (up) and S (down)\nRIGHT PADDLE: up/down arrows or keys O (up) and L (down)\n\nThe test lasts 2 minutes. Keep the ball in play as long as you can!\n\nPress SPACE to choose the difficulty level\nESC - exit without saving',
    'difficulty':
      'CHOOSE THE DIFFICULTY LEVEL\n\n1 - EASY (slower ball, larger paddles)\n2 - NORMAL (standard speed)\n3 - HARD (speed increases over time)\n4 - SURVIVAL (one mistake = game over, no time limit)\n\nPress 1, 2, 3 or 4',
    'results.survival':
      'END OF TEST – SURVIVAL MODE\n\nSurvival time: {{time}}\nPaddle hits: {{hits}}\n\nPress SPACE to finish',
    'results.normal':
      'END OF TEST\n\nLeft side: {{left}} hits\nRight side: {{right}} hits\nTotal: {{total}} hits\n\nPress SPACE to finish',
    'level.Easy': 'Easy',
    'level.Normal': 'Normal',
    'level.Hard': 'Hard',
    'level.Survival': 'Survival',
    'level.survivalWord': 'Survival',
    'quit.thanks': 'Thank you for your patience.',
    'quit.escapeCompleted': 'The [Escape] key was pressed. Goodbye!',
    'score.survival':
      'Level: {{level}} | Time: {{seconds}}s | Hits: {{hits}}',
    'score.normal':
      'Level: {{level}} | Left: {{left}} | Right: {{right}} | Total: {{total}}',
  },
};
