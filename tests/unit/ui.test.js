import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("UI Module", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    document.body.innerHTML = `
      <div id="login-screen" class="">
        <div id="login-choice-panel" class=""></div>
        <div id="login-online-panel" class="hidden">
          <input id="email" type="text" />
          <input id="password" type="password" />
          <p id="error-msg"></p>
        </div>
        <div id="login-local-panel" class="hidden">
          <input id="local-username" type="text" />
          <input id="local-password" type="password" />
          <p id="error-msg-local"></p>
        </div>
      </div>
      <div id="dashboard-screen" class="hidden"></div>
      <div id="user-email-display"></div>
      <div id="user-status-display"></div>
      <div id="sync-toggle-container"></div>
      <button id="nav-library"></button>
      <button id="nav-history"></button>
      <button id="nav-updates"></button>
      <button id="nav-demographics"></button>
      <button id="nav-demo-creator"></button>
      <button id="nav-settings"></button>
      <button id="nav-whats-new"></button>
      <button id="nav-local-admin" class="hidden"></button>
      <div id="library-view" class="hidden"></div>
      <div id="history-view" class="hidden"></div>
      <div id="updates-view" class="hidden"></div>
      <div id="demographics-view" class="hidden"></div>
      <div id="demo-creator-view" class="hidden"></div>
      <div id="settings-view" class="hidden"></div>
      <div id="whats-new-view" class="hidden"></div>
      <div id="local-admin-view" class="hidden"></div>
      <button id="btn-change-local-password" class="hidden"></button>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  // ─── elements proxy ────────────────────────────────────────
  describe("elements", () => {
    it("zwraca elementy DOM po id", async () => {
      const { elements } = await import("../../src/modules/ui.js");
      expect(elements.loginScreen).toBeDefined();
      expect(elements.dashboardScreen).toBeDefined();
      expect(elements.emailInput).toBeDefined();
    });

    it("zwraca null/falsy dla nieistniejącego elementu", async () => {
      const { elements } = await import("../../src/modules/ui.js");
      expect(elements.nonExistentElement).toBeFalsy();
    });
  });

  // ─── switchView ────────────────────────────────────────────
  describe("switchView", () => {
    it("pokazuje widok biblioteki i aktywuje nav", async () => {
      const { switchView } = await import("../../src/modules/ui.js");
      switchView("library");
      expect(
        document.getElementById("library-view").classList.contains("hidden"),
      ).toBe(false);
      expect(
        document.getElementById("nav-library").classList.contains("active"),
      ).toBe(true);
    });

    it("ukrywa poprzedni widok przy przełączeniu", async () => {
      const { switchView } = await import("../../src/modules/ui.js");
      switchView("library");
      switchView("history");
      expect(
        document.getElementById("library-view").classList.contains("hidden"),
      ).toBe(true);
      expect(
        document.getElementById("history-view").classList.contains("hidden"),
      ).toBe(false);
    });

    it("wywołuje callback po przełączeniu widoku", async () => {
      const { switchView } = await import("../../src/modules/ui.js");
      const cb = vi.fn();
      switchView("library", { onLibrary: cb });
      expect(cb).toHaveBeenCalled();
    });

    it("obsługuje nieznany widok bez rzucenia błędu", async () => {
      const { switchView } = await import("../../src/modules/ui.js");
      const spy = vi.spyOn(console, "warn");
      switchView("unknown-view");
      expect(spy).toHaveBeenCalledWith("Unknown view: unknown-view");
    });
  });

  // ─── updateAuthUI ───────────────────────────────────────────
  describe("updateAuthUI", () => {
    it("pokazuje dashboard i ukrywa ekran logowania", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "APPROVED");
      expect(
        document.getElementById("login-screen").classList.contains("hidden"),
      ).toBe(true);
      expect(
        document
          .getElementById("dashboard-screen")
          .classList.contains("hidden"),
      ).toBe(false);
    });

    it("wyświetla email użytkownika", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "APPROVED");
      expect(document.getElementById("user-email-display").textContent).toBe(
        "test@example.com",
      );
    });

    it('wyświetla "Gość" dla null email', async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI(null, "GUEST");
      expect(document.getElementById("user-email-display").textContent).toBe(
        "Gość",
      );
    });

    it("ustawia zielony kolor dla statusu APPROVED", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "APPROVED");
      expect(document.getElementById("user-status-display").style.color).toBe(
        "#4caf50",
      );
    });

    it("ustawia pomarańczowy kolor dla statusu PENDING", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "PENDING");
      expect(document.getElementById("user-status-display").style.color).toBe(
        "#ff9800",
      );
    });

    it("ustawia niebieski kolor dla statusu LOCAL", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("Jan", "LOCAL");
      expect(document.getElementById("user-status-display").style.color).toBe(
        "#64b5f6",
      );
    });

    it("ukrywa sync toggle dla GUEST", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI(null, "GUEST");
      expect(
        document
          .getElementById("sync-toggle-container")
          .classList.contains("hidden"),
      ).toBe(true);
    });

    it("ukrywa sync toggle dla LOCAL", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("Jan", "LOCAL");
      expect(
        document
          .getElementById("sync-toggle-container")
          .classList.contains("hidden"),
      ).toBe(true);
    });

    it("pokazuje sync toggle dla APPROVED", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "APPROVED");
      expect(
        document
          .getElementById("sync-toggle-container")
          .classList.contains("hidden"),
      ).toBe(false);
    });

    it("pokazuje nav-local-admin tylko dla ADMIN", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("admin@example.com", "ADMIN");
      expect(
        document.getElementById("nav-local-admin").classList.contains("hidden"),
      ).toBe(false);
    });

    it("ukrywa nav-local-admin dla nie-ADMIN", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "APPROVED");
      expect(
        document.getElementById("nav-local-admin").classList.contains("hidden"),
      ).toBe(true);
    });

    it("pokazuje btn-change-local-password dla LOCAL", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("Jan", "LOCAL");
      expect(
        document
          .getElementById("btn-change-local-password")
          .classList.contains("hidden"),
      ).toBe(false);
    });

    it("ukrywa btn-change-local-password dla nie-LOCAL", async () => {
      const { updateAuthUI } = await import("../../src/modules/ui.js");
      updateAuthUI("test@example.com", "APPROVED");
      expect(
        document
          .getElementById("btn-change-local-password")
          .classList.contains("hidden"),
      ).toBe(true);
    });
  });

  // ─── showLoginScreen / showLoginChoice / panels ─────────────
  describe("showLoginScreen", () => {
    it("pokazuje ekran logowania i ukrywa dashboard", async () => {
      const { showLoginScreen } = await import("../../src/modules/ui.js");
      document.getElementById("login-screen").classList.add("hidden");
      document.getElementById("dashboard-screen").classList.remove("hidden");
      showLoginScreen();
      expect(
        document.getElementById("login-screen").classList.contains("hidden"),
      ).toBe(false);
      expect(
        document
          .getElementById("dashboard-screen")
          .classList.contains("hidden"),
      ).toBe(true);
    });

    it("po showLoginScreen panel wyboru jest widoczny", async () => {
      const { showLoginScreen } = await import("../../src/modules/ui.js");
      showLoginScreen();
      expect(
        document
          .getElementById("login-choice-panel")
          .classList.contains("hidden"),
      ).toBe(false);
      expect(
        document
          .getElementById("login-online-panel")
          .classList.contains("hidden"),
      ).toBe(true);
      expect(
        document
          .getElementById("login-local-panel")
          .classList.contains("hidden"),
      ).toBe(true);
    });
  });

  describe("showLoginOnlinePanel", () => {
    it("pokazuje panel online i ukrywa pozostałe", async () => {
      const { showLoginOnlinePanel } = await import("../../src/modules/ui.js");
      showLoginOnlinePanel();
      expect(
        document
          .getElementById("login-choice-panel")
          .classList.contains("hidden"),
      ).toBe(true);
      expect(
        document
          .getElementById("login-online-panel")
          .classList.contains("hidden"),
      ).toBe(false);
      expect(
        document
          .getElementById("login-local-panel")
          .classList.contains("hidden"),
      ).toBe(true);
    });

    it("czyści wiadomość błędu po przełączeniu", async () => {
      const { showLoginOnlinePanel } = await import("../../src/modules/ui.js");
      document.getElementById("error-msg").textContent = "Stary błąd";
      showLoginOnlinePanel();
      expect(document.getElementById("error-msg").textContent).toBe("");
    });
  });

  describe("showLoginLocalPanel", () => {
    it("pokazuje panel lokalny i ukrywa pozostałe", async () => {
      const { showLoginLocalPanel } = await import("../../src/modules/ui.js");
      showLoginLocalPanel();
      expect(
        document
          .getElementById("login-choice-panel")
          .classList.contains("hidden"),
      ).toBe(true);
      expect(
        document
          .getElementById("login-online-panel")
          .classList.contains("hidden"),
      ).toBe(true);
      expect(
        document
          .getElementById("login-local-panel")
          .classList.contains("hidden"),
      ).toBe(false);
    });
  });

  // ─── showError / showErrorLocal ─────────────────────────────
  describe("showError", () => {
    it("wyświetla wiadomość błędu w panelu online", async () => {
      const { showError } = await import("../../src/modules/ui.js");
      showError("Błąd testowy");
      expect(document.getElementById("error-msg").textContent).toBe(
        "Błąd testowy",
      );
    });

    it("czyści wiadomość przy pustym stringu", async () => {
      const { showError } = await import("../../src/modules/ui.js");
      showError("Pierwszy błąd");
      showError("");
      expect(document.getElementById("error-msg").textContent).toBe("");
    });
  });

  describe("showErrorLocal", () => {
    it("wyświetla wiadomość błędu w panelu lokalnym", async () => {
      const { showErrorLocal } = await import("../../src/modules/ui.js");
      showErrorLocal("Błąd lokalny");
      expect(document.getElementById("error-msg-local").textContent).toBe(
        "Błąd lokalny",
      );
    });

    it("czyści wiadomość przy pustym stringu", async () => {
      const { showErrorLocal } = await import("../../src/modules/ui.js");
      showErrorLocal("Błąd");
      showErrorLocal("");
      expect(document.getElementById("error-msg-local").textContent).toBe("");
    });
  });
});
