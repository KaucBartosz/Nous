// web/test-lang.js — język testu BBTP w wersji WEB.
//
// Desktop podaje język przez preload_test.js (window.electronTest.getLanguage);
// w Web test czyta go sam: z wyboru języka Nous (localStorage 'nous-language').
// Brak zapisanego wyboru = polski (nie zgadujemy z języka przeglądarki — ten sam
// fallback, co w BBTP/<Test>/i18n.js, gdy host nie podaje języka).
// build_web.js wstrzykuje ten plik po web-adapter.js.
(function () {
  if (window.electronTest && typeof window.electronTest.getLanguage === 'function') {
    return; // desktop: język pochodzi z hosta
  }

  function resolveLanguage() {
    try {
      const saved = localStorage.getItem('nous-language');
      if (saved === 'pl' || saved === 'en') return saved;
    } catch (e) {}
    return 'pl';
  }

  window.electronTest = Object.assign({}, window.electronTest, {
    getLanguage: resolveLanguage,
  });
})();
