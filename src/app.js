// src/app.js
import {
  elements,
  switchView,
  showLoginChoice,
  showLoginOnlinePanel,
  showLoginLocalPanel,
} from "./modules/ui.js";
import {
  initAuth,
  login,
  register,
  logout,
  loginGuest,
  loginLocal,
  registerLocal,
  logoutLocal,
  getUserStatus,
  changeLocalPassword,
} from "./modules/auth.js";
import { initE2E } from "./modules/e2e.js";
import { loadLocalAccountsAdmin } from "./modules/localAccountsAdmin.js";
import { loadTestsList, initViewSwitcher } from "./modules/library.js";

import {
  loadHistoryData,
  exportHistoryToCSV,
  initHistoryView,
} from "./modules/history.js";
import { loadUpdatesData } from "./modules/updates.js";
import {
  initDemographics,
  saveDemographicsFromForm,
} from "./modules/demographics.js";
import {
  initDemoCreator,
  refreshTemplatesList,
} from "./modules/demoCreator.js";
import { initResultsHandler } from "./modules/results.js";
import {
  initSyncService,
  setAutoSync,
  getAutoSyncState,
} from "./modules/sync.js";
import { initSettings } from "./modules/settings.js";
import { initAppUpdater } from "./modules/appUpdater.js";
import { initWhatsNew, loadWhatsNewView } from "./modules/whatsNew.js";
import { renderParticipantsList } from "./modules/participants.js";
import { getPlatform } from "./platform/index.js";
import { shellPolicyFor, applyShellPolicy } from "./platform/shell.js";
import { initLocalPasswordModal } from "./session/passwordModal.js";
import { Notify } from "./notify/notify.js";
import { setCryptoWarningHandler } from "./db/cryptoPolicy.js";

// --- INITIALIZATION ---

document.addEventListener("DOMContentLoaded", () => {
  // 0. Initialize Settings (must be first to apply saved theme/colors)
  initSettings();

  // C2: ostrzeżenia szyfrowania (z warstwy DB) pokazuj jako Notify — DB nie zna UI
  setCryptoWarningHandler((message, level) => {
    if (level === "error") Notify.error(message);
    else if (level === "warning") Notify.warning(message);
    else Notify.info(message);
  });

  // 1. Auth Setup przez seam powłoki (A2: polityka trybu w shell.js,
  // app.js tylko stosuje + wybiera ścieżkę logowania)
  const shellPolicy = shellPolicyFor(getPlatform().kind);
  if (applyShellPolicy(shellPolicy, { elements })) return;
  if (shellPolicy.guestAutoLogin) {
    // Wersja WEB: od razu Gość + biblioteka (bez ekranu logowania)
    loginGuest();
    switchView("library", { onLibrary: loadTestsList });
  } else {
    // Wersja DESKTOP
    initE2E();
    initAuth(() => {
      onAppStart();
    });
  }

  // Wspolny reset UI przy kazdym logowaniu (niezaleznie od typu konta)
  const onAppStart = () => {
    switchView("library", { onLibrary: loadTestsList });
  };

  // Local login success callback (shared)
  const onLocalLoginSuccess = () => {
    onAppStart();
  };

  // 1.5. Initialize library view switcher
  initViewSwitcher();

  // 2. Navigation
  elements.navLibrary.addEventListener("click", () =>
    switchView("library", { onLibrary: loadTestsList }),
  );
  elements.navHistory.addEventListener("click", () =>
    switchView("history", { onHistory: loadHistoryData }),
  );
  elements.navUpdates.addEventListener("click", () =>
    switchView("updates", { onUpdates: loadUpdatesData }),
  );
  elements.navDemographics.addEventListener("click", () =>
    switchView("demographics", { onDemographics: renderParticipantsList }),
  );
  elements.navDemoCreator.addEventListener("click", () =>
    switchView("creator", { onCreator: refreshTemplatesList }),
  );
  elements.navWhatsNew.addEventListener("click", () =>
    switchView("whatsNew", { onWhatsNew: loadWhatsNewView }),
  );
  elements.navSettings.addEventListener("click", () => switchView("settings"));
  elements.navLocalAdmin?.addEventListener("click", () =>
    switchView("localAdmin", { onLocalAdmin: loadLocalAccountsAdmin }),
  );

  // 3. Auth Buttons

  // --- Nawigacja paneli logowania ---
  elements.btnChooseOnline?.addEventListener("click", showLoginOnlinePanel);
  elements.btnChooseLocal?.addEventListener("click", showLoginLocalPanel);
  elements.btnBackOnline?.addEventListener("click", showLoginChoice);
  elements.btnBackLocal?.addEventListener("click", showLoginChoice);

  // --- Panel Online ---
  elements.btnLogin.addEventListener("click", () =>
    login(elements.emailInput.value, elements.passInput.value),
  );
  elements.btnRegister.addEventListener("click", () =>
    register(elements.emailInput.value, elements.passInput.value),
  );
  elements.btnTogglePassword.addEventListener("click", () => {
    const type =
      elements.passInput.getAttribute("type") === "password"
        ? "text"
        : "password";
    elements.passInput.setAttribute("type", type);
    elements.btnTogglePassword.querySelector(".material-icons").textContent =
      type === "password" ? "visibility" : "visibility_off";
  });
  const handleEnterLogin = (e) => {
    if (e.key === "Enter") {
      login(elements.emailInput.value, elements.passInput.value);
    }
  };
  elements.emailInput.addEventListener("keydown", handleEnterLogin);
  elements.passInput.addEventListener("keydown", handleEnterLogin);

  // --- Panel Lokalny ---
  elements.btnLoginLocal?.addEventListener("click", () => {
    loginLocal(
      elements.localUsernameInput.value,
      elements.localPassInput.value,
      onLocalLoginSuccess,
    );
  });
  elements.btnRegisterLocal?.addEventListener("click", () => {
    registerLocal(
      elements.localUsernameInput.value,
      elements.localPassInput.value,
      onLocalLoginSuccess,
    );
  });
  elements.btnToggleLocalPassword?.addEventListener("click", () => {
    const type =
      elements.localPassInput.getAttribute("type") === "password"
        ? "text"
        : "password";
    elements.localPassInput.setAttribute("type", type);
    elements.btnToggleLocalPassword.querySelector(
      ".material-icons",
    ).textContent = type === "password" ? "visibility" : "visibility_off";
  });
  const handleEnterLocalLogin = (e) => {
    if (e.key === "Enter") {
      loginLocal(
        elements.localUsernameInput.value,
        elements.localPassInput.value,
        onLocalLoginSuccess,
      );
    }
  };
  elements.localUsernameInput?.addEventListener(
    "keydown",
    handleEnterLocalLogin,
  );
  elements.localPassInput?.addEventListener("keydown", handleEnterLocalLogin);

  // --- Gość (w panelu lokalnym) ---
  elements.btnGuest.addEventListener("click", () => {
    loginGuest();
    onAppStart();
  });

  // --- Wylogowanie ---
  elements.btnLogout.addEventListener("click", () => {
    const status = getUserStatus();
    if (status === "LOCAL") {
      logoutLocal();
    } else {
      logout();
    }
  });

  // --- Zmiana hasła dla konta LOCAL (A2: formularz w session/passwordModal.js) ---
  initLocalPasswordModal({ changePassword: changeLocalPassword });

  // 4. Feature Buttons
  document
    .getElementById("btn-export-csv")
    .addEventListener("click", exportHistoryToCSV);

  // 5. About Modal
  if (elements.navAbout)
    elements.navAbout.addEventListener("click", () =>
      elements.aboutModal.classList.remove("hidden"),
    );
  if (elements.btnCloseAbout)
    elements.btnCloseAbout.addEventListener("click", () =>
      elements.aboutModal.classList.add("hidden"),
    );

  if (elements.btnAboutCloseFooter)
    elements.btnAboutCloseFooter.addEventListener("click", () =>
      elements.aboutModal.classList.add("hidden"),
    );

  document.getElementById("btn-about-project").addEventListener("click", () => {
    const url = "https://kaucbartosz.github.io/Nous/";
    // C1: Electron otwiera zewnętrznie, Web w nowej karcie (w adapterze)
    getPlatform().links.openExternal(url);
  });

  // 5.5. History View Init
  initHistoryView();

  // 6. Subsystems
  initDemographics();
  initDemoCreator();
  initResultsHandler();
  initAppUpdater();
  initWhatsNew();

  // 7. Offline Sync & Toggle
  initSyncService();

  // Initialize toggle state
  if (elements.toggleSync) {
    elements.toggleSync.checked = getAutoSyncState();
    elements.toggleSync.addEventListener("change", (e) => {
      setAutoSync(e.target.checked);
    });
  }

  // Refresh history if sync updates something
  window.addEventListener("sync-complete", () => {
    // Only refresh if history view is active
    if (elements.navHistory.classList.contains("active")) {
      loadHistoryData();
    }
  });

  // 8. Global Status/Error Handling (C1: Web = noop w adapterze)
  getPlatform().tests.onStatus((message) => {
    console.log("[Electron Status]:", message);

    // Simple heuristic to detect errors
    if (message.startsWith("BŁĄD") || message.includes("Error")) {
      Notify.error(message);
    } else {
      // For non-error messages, we might just log them or show a toast if we had one.
      // Currently, many messages are handled by the button state updates in library.js (download progress/state).
      // However, some global messages might be useful to see.
    }
  });
});
