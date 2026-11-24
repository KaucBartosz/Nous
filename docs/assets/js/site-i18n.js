// site-i18n.js — przełącznik języka strony (docs/).
// Używa tego samego klucza co aplikacja Web ('nous-language'), więc wybór
// dokonany na stronie ustawia też język interfejsu i testów w /app/.
(function () {
  var STORAGE_KEY = "nous-language";
  var FALLBACK = "pl";

  var DICTS = {
    pl: {
      "lang.label": "Język",
      "nav.home": "Start",
      "nav.guide": "Przewodnik",
      "nav.try": "Przetestuj",
      "nav.features": "O funkcjach",
      "nav.download": "Pobierz",
      "nav.source": "Kod źródłowy",
      "footer.description": "Platforma do dystrybucji i przeprowadzania testów psychometrycznych.",
      "footer.rights": "© 2026 Nous. Wszelkie prawa zastrzeżone.",
      "footer.madeBy": "Stworzone z ❤️ przez",
      "footer.thesis": "Praca Inżynierska · Uniwersytet Kazimierza Wielkiego",
      "meta.guideTitle": "Przewodnik po Nous",
      "hero.subtitle": "Nowoczesne narzędzie do przeprowadzania testów psychometrycznych",
      "hero.tagline": "Testuj, Badaj, Rozwijaj",
      "hero.download": "Pobierz Nous",
      "hero.latestVersion": "Najnowsza wersja: {{version}}",
      "hero.try": "Przetestuj",
      "hero.otherSystems": "Pobierz dla innych systemów",
      "promises.free": "Darmowe (Open Source)",
      "promises.local": "Dane na urządzeniu",
      "promises.fast": "Napisane nowocześnie",
      "features.eyebrow": "Funkcje",
      "features.title": "Wszystko czego potrzebujesz do efektywnego zarządzania testami",
      "features.offlineTitle": "W pełni funkcjonalny Offline",
      "features.offlineText": "Testuj i zbieraj dane nawet bez internetu. Wystarczy pobrać testy wcześniej.",
      "features.speedTitle": "Błyskawiczna wydajność",
      "features.speedText": "Zoptymalizowana architektura zapewnia natychmiastowy dostęp do testów w każdym miejscu na świecie.",
      "features.privacyTitle": "Prywatność przede wszystkim",
      "features.privacyText": "Twoje dane pozostają na Twoim urządzeniu. Pełna kontrola nad informacjami.",
      "features.searchTitle": "Potężne wyszukiwanie",
      "features.searchText": "Znajdź test w mgnieniu oka dzięki zaawansowanemu silnikowi wyszukiwania.",
      "features.personalTitle": "Personalizacja",
      "features.personalText": "Dostosuj interfejs i funkcje do swoich potrzeb i stylu pracy.",
      "features.demographicsTitle": "Wsparcie Metryczek",
      "features.demographicsText": "Zbierz dane, których potrzebujesz do skutecznego badania.",
      "download.title": "Wybierz swoją platformę",
      "download.subtitle": "Prosty proces instalacji dla każdego systemu operacyjnego.",
      "download.windows": "Pobierz dla Windows",
      "download.windowsBtn": "Pobierz plik instalacyjny .exe",
      "download.windowsNoteTitle": "Uwaga: System Windows ochronił ten komputer",
      "download.windowsNoteText": 'System Windows (SmartScreen) może zablokować uruchomienie ponieważ aplikacja jest nowa. Aby zainstalować:<br><br>1. Kliknij <strong>"Więcej informacji"</strong>.<br>2. Kliknij <strong>"Uruchom mimo to"</strong>.',
      "download.macos": "Pobierz dla macOS",
      "download.macosBtn": "Pobierz plik .dmg",
      "download.macosNoteTitle": "Przy pierwszym uruchomieniu",
      "download.macosNoteText": 'System macOS (Gatekeeper) może zablokować aplikację, ponieważ pochodzi od "niezidentyfikowanego dewelopera".<br><br>1. Otwórz folder <strong>Aplikacje</strong>.<br>2. <strong>Kliknij prawym przyciskiem myszy</strong> na "Nous" i wybierz <strong>"Otwórz"</strong>.',
      "download.linux": "Pobierz dla Linux",
      "download.linuxBtn": "Pobierz plik .AppImage",
      "download.terminal": "Jak uruchomić w terminalu:",
      "download.linuxNote": "Skoro używasz linuxa to na pewno sobie poradzisz! 🐧",
      "download.detected": "Wykryto: {{os}}",
      "guide.title": 'Poznaj możliwości <span class="gradient-text">Nous</span>',
      "guide.subtitle": "Przewodnik po najważniejszych modułach aplikacji, który pomoże Ci w pełni wykorzystać jej potencjał.",
      "guide.nav.library": "Biblioteka Testów",
      "guide.nav.history": "Historia Wyników",
      "guide.nav.creator": "Kreator Metryczek",
      "guide.nav.settings": "Ustawienia",
      "guide.library.title": "Biblioteka Testów",
      "guide.library.text": "Centralne miejsce zarządzania Twoimi narzędziami badawczymi. Przeglądaj dostępne testy, pobieraj nowe paczki i uruchamiaj badania jednym kliknięciem.",
      "guide.library.b1": "Zautomatyzowana instalacja paczek testowych",
      "guide.library.b2": "Szybkie wyszukiwanie i filtrowanie",
      "guide.library.b3": "Podgląd instrukcji przed badaniem",
      "guide.history.title": "Historia Wyników",
      "guide.history.text": "Wszystkie przeprowadzone badania w jednym miejscu. Analizuj surowe dane, eksportuj wyniki i śledź postępy swoich badanych.",
      "guide.history.b1": "Przejrzysta tabela z wynikami",
      "guide.history.b2": "Eksport do formatów CSV i JSON",
      "guide.history.b3": "Bezpieczne, lokalne przechowywanie danych z możliwością eksportu do chmury",
      "guide.history.b4": "Wykonano test w trybie offline? Tu możesz go podejrzeć/zaimportować!",
      "guide.creator.title": "Kreator Metryczek",
      "guide.creator.text": "Dostosuj dane wejściowe do swoich potrzeb. Twórz własne formularze metryczek, które użytkownik wypełnia przed przystąpieniem do testu.",
      "guide.creator.b1": "Intuicyjny edytor pól (wiek, płeć, ID)",
      "guide.creator.b2": "Możliwość definiowania własnych zmiennych",
      "guide.creator.b3": "Zapisywanie szablonów dla różnych badań",
      "guide.settings.title": "Ustawienia",
      "guide.settings.text": "Spersonalizuj swoje doświadczenie z Nous. Dostosuj interfejs i wygląd aplikacji.",
      "guide.settings.b1": "Przełączanie motywów (Light/Dark/Custom)",
      "guide.settings.b2": "Możliwość stworzenia wielu motywów i ich zapisania",
      "guide.placeholder": "Oczekiwanie na zrzut ekranu...",
      "guide.alt.library": "Biblioteka Testów",
      "guide.alt.history": "Historia Wyników",
      "guide.alt.creator": "Kreator Metryczek",
      "guide.alt.settings": "Ustawienia",
    },
    en: {
      "lang.label": "Language",
      "nav.home": "Home",
      "nav.guide": "Guide",
      "nav.try": "Try it",
      "nav.features": "Features",
      "nav.download": "Download",
      "nav.source": "Source code",
      "footer.description": "A platform for distributing and conducting psychometric tests.",
      "footer.rights": "© 2026 Nous. All rights reserved.",
      "footer.madeBy": "Made with ❤️ by",
      "footer.thesis": "Engineering Thesis · Kazimierz Wielki University",
      "meta.guideTitle": "Nous Guide",
      "hero.subtitle": "A modern tool for conducting psychometric tests",
      "hero.tagline": "Test, Research, Grow",
      "hero.download": "Download Nous",
      "hero.latestVersion": "Latest version: {{version}}",
      "hero.try": "Try it",
      "hero.otherSystems": "Download for other systems",
      "promises.free": "Free (Open Source)",
      "promises.local": "Data on your device",
      "promises.fast": "Built with modern tech",
      "features.eyebrow": "Features",
      "features.title": "Everything you need to manage your tests effectively",
      "features.offlineTitle": "Fully functional offline",
      "features.offlineText": "Run tests and collect data even without internet. Just download the tests beforehand.",
      "features.speedTitle": "Lightning-fast performance",
      "features.speedText": "Optimized architecture gives instant access to tests anywhere in the world.",
      "features.privacyTitle": "Privacy first",
      "features.privacyText": "Your data stays on your device. Full control over your information.",
      "features.searchTitle": "Powerful search",
      "features.searchText": "Find a test in no time with the advanced search engine.",
      "features.personalTitle": "Personalization",
      "features.personalText": "Adapt the interface and features to your needs and workflow.",
      "features.demographicsTitle": "Demographics support",
      "features.demographicsText": "Collect the data you need for effective research.",
      "download.title": "Choose your platform",
      "download.subtitle": "Simple installation process for every operating system.",
      "download.windows": "Download for Windows",
      "download.windowsBtn": "Download the .exe installer",
      "download.windowsNoteTitle": "Note: Windows protected your PC",
      "download.windowsNoteText": 'Windows SmartScreen may block the app because it is new. To install:<br><br>1. Click <strong>"More info"</strong>.<br>2. Click <strong>"Run anyway"</strong>.',
      "download.macos": "Download for macOS",
      "download.macosBtn": "Download the .dmg file",
      "download.macosNoteTitle": "On first launch",
      "download.macosNoteText": 'macOS Gatekeeper may block the app because it comes from an "unidentified developer".<br><br>1. Open the <strong>Applications</strong> folder.<br>2. <strong>Right-click</strong> "Nous" and choose <strong>"Open"</strong>.',
      "download.linux": "Download for Linux",
      "download.linuxBtn": "Download the .AppImage file",
      "download.terminal": "How to run in the terminal:",
      "download.linuxNote": "If you use Linux, you'll figure it out! 🐧",
      "download.detected": "Detected: {{os}}",
      "guide.title": 'Discover what <span class="gradient-text">Nous</span> can do',
      "guide.subtitle": "A guide to the app's key modules to help you get the most out of it.",
      "guide.nav.library": "Test Library",
      "guide.nav.history": "Result History",
      "guide.nav.creator": "Demographics Creator",
      "guide.nav.settings": "Settings",
      "guide.library.title": "Test Library",
      "guide.library.text": "The central place to manage your research tools. Browse available tests, download new packages and run studies with one click.",
      "guide.library.b1": "Automated installation of test packages",
      "guide.library.b2": "Fast search and filtering",
      "guide.library.b3": "Preview instructions before a study",
      "guide.history.title": "Result History",
      "guide.history.text": "All your completed studies in one place. Analyze raw data, export results and track participants' progress.",
      "guide.history.b1": "Clear results table",
      "guide.history.b2": "Export to CSV and JSON",
      "guide.history.b3": "Secure local data storage with optional cloud export",
      "guide.history.b4": "Ran a test offline? Preview or import it here!",
      "guide.creator.title": "Demographics Creator",
      "guide.creator.text": "Tailor the input data to your needs. Create your own demographics forms that participants fill in before a test.",
      "guide.creator.b1": "Intuitive field editor (age, gender, ID)",
      "guide.creator.b2": "Define your own variables",
      "guide.creator.b3": "Save templates for different studies",
      "guide.settings.title": "Settings",
      "guide.settings.text": "Personalize your Nous experience. Adjust the interface and appearance of the app.",
      "guide.settings.b1": "Theme switching (Light/Dark/Custom)",
      "guide.settings.b2": "Create and save multiple themes",
      "guide.placeholder": "Waiting for screenshot...",
      "guide.alt.library": "Test Library",
      "guide.alt.history": "Result History",
      "guide.alt.creator": "Demographics Creator",
      "guide.alt.settings": "Settings",
    },
  };

  var current = FALLBACK;
  var listeners = [];

  function supported(lang) {
    return Object.prototype.hasOwnProperty.call(DICTS, lang);
  }

  function detect() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved && supported(saved)) return saved;
    } catch (e) {}
    var nav = (typeof navigator !== "undefined" && navigator.language) || "";
    return String(nav).toLowerCase().indexOf("pl") === 0 ? "pl" : "en";
  }

  function t(key, params) {
    var str = (DICTS[current] || DICTS[FALLBACK])[key];
    if (str === undefined) str = DICTS[FALLBACK][key];
    if (str === undefined) return key;
    if (!params) return str;
    return str.replace(/\{\{(\w+)\}\}/g, function (m, name) {
      return params[name] !== undefined ? String(params[name]) : m;
    });
  }

  var ATTRS = [
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-alt", "alt"],
    ["data-i18n-title", "title"],
    ["data-i18n-aria-label", "aria-label"],
  ];

  function applyI18n() {
    var d = DICTS[current];
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = d[el.getAttribute("data-i18n")];
      if (v !== undefined) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = d[el.getAttribute("data-i18n-html")];
      if (v !== undefined) el.innerHTML = v;
    });
    ATTRS.forEach(function (pair) {
      document.querySelectorAll("[" + pair[0] + "]").forEach(function (el) {
        var v = d[el.getAttribute(pair[0])];
        if (v !== undefined) el.setAttribute(pair[1], v);
      });
    });
    document.querySelectorAll("[data-site-locale]").forEach(function (btn) {
      var active = btn.getAttribute("data-site-locale") === current;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function setLocale(lang) {
    if (!supported(lang)) lang = FALLBACK;
    current = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      applyI18n();
    }
    listeners.forEach(function (fn) {
      try { fn(lang); } catch (e) { console.error("[site-i18n] listener", e); }
    });
    return lang;
  }

  function init() {
    document.querySelectorAll("[data-site-locale]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLocale(btn.getAttribute("data-site-locale"));
      });
    });
    setLocale(detect());
  }

  window.siteI18n = {
    t: t,
    getLocale: function () { return current; },
    setLocale: setLocale,
    onLocaleChange: function (fn) { listeners.push(fn); },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
