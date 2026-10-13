import { describe, it, expect, vi } from "vitest";
import {
  getTestStatus,
  buildAppIcon,
  buildStatusIcon,
  buildStatusText,
  buildStartButton,
  cardParts,
  setTestButtonState,
  setTestButtonProgress,
} from "../../src/catalog/testCard.js";

// testCard.js nie ma żadnych importów produkcyjnych — zero mocków.

const tMissing = { id: "m", name: "N", description: "D", version: 3, local_ver: 0, remote_ver: 3 };
const tOutdated = { id: "o", name: "N", description: "D", version: 1, local_ver: 1, remote_ver: 2 };
const tCurrent = { id: "c", name: "N", description: "D", version: 2, local_ver: 2, remote_ver: 2 };
const tDev = { id: "d", name: "N", description: "D", version: 0, local_ver: 0, remote_ver: 0, isLocalDev: true };

describe("testCard.getTestStatus", () => {
  it("4 gałęzie jak stare widoki", () => {
    expect(getTestStatus(tDev)).toMatchObject({ iconName: "code", btnText: "Uruchom (Dev)" });
    expect(getTestStatus(tMissing)).toMatchObject({ iconName: "cloud_download", btnText: "Pobierz", isDownloadOnly: true });
    expect(getTestStatus(tOutdated)).toMatchObject({ iconName: "system_update", btnClass: "outline" });
    expect(getTestStatus(tCurrent)).toMatchObject({ iconName: "check_circle", statusText: "Zainstalowano" });
  });
});

describe("testCard builders", () => {
  it("buildAppIcon: z rozmiarem jak grid, bez jak lista", () => {
    const sized = buildAppIcon("40px");
    expect(sized.style.cssText).toContain("40px");
    expect(sized.style.cssText).toContain("#444");
    const bare = buildAppIcon();
    expect(bare.getAttribute("style")).toBeNull();
    expect(bare.textContent).toBe("assignment");
  });

  it("buildStatusIcon: kolor/tytuł/nazwa; rozmiar opcjonalny (compact)", () => {
    const s = getTestStatus(tCurrent);
    const withSize = buildStatusIcon(s, "24px");
    expect(withSize.style.color).toBe("#4caf50");
    expect(withSize.title).toBe("Zainstalowano");
    expect(withSize.style.fontSize).toBe("24px");
    const compact = buildStatusIcon(s);
    expect(compact.style.fontSize).toBe("");
    expect(compact.textContent).toBe("check_circle");
  });

  it("buildStartButton: pełny vs compact (icon-only)", () => {
    const onStart = vi.fn();
    const full = buildStartButton(tMissing, getTestStatus(tMissing), { onStart });
    expect(full.id).toBe("start-test-m");
    expect(full.className).toBe("btn primary small");
    expect(full.textContent).toContain("Pobierz");
    full.click();
    expect(onStart).toHaveBeenCalledWith(tMissing, expect.objectContaining({ btnText: "Pobierz" }));

    const compact = buildStartButton(tMissing, getTestStatus(tMissing), { compact: true, onStart });
    expect(compact.className).toBe("btn primary compact");
    expect(compact.textContent).not.toContain("Pobierz");
    expect(compact.querySelector(".material-icons").style.fontSize).toBe("14px");
  });

  it("buildStartButton bez onStart nie wybucha na klik", () => {
    const btn = buildStartButton(tMissing, getTestStatus(tMissing));
    expect(() => btn.click()).not.toThrow();
  });

  it("cardParts: komplet klocków + warianty appIcon + tagBtn passthrough", () => {
    const tag = document.createElement("span");
    const onStart = vi.fn();
    const p = cardParts(tOutdated, { iconSize: "20px", appIcon: true, tagBtn: tag, onStart });
    expect(p.status.btnClass).toBe("outline");
    expect(p.testId).toBe("o");
    expect(p.titleEl.textContent).toBe("N");
    expect(p.descEl.textContent).toBe("D");
    expect(p.versionEl.textContent).toBe("v1");
    expect(p.tagBtn).toBe(tag);
    expect(p.appIcon.textContent).toBe("assignment");
    p.button.click();
    expect(onStart).toHaveBeenCalled();

    expect(cardParts(tOutdated, {}).appIcon).toBeNull(); // tabela/compact
    expect(cardParts(tOutdated, { appIcon: "40px" }).appIcon.style.cssText).toContain("40px");
  });

  it("cardParts: domyślne teksty przy braku nazwy/opisu", () => {
    const p = cardParts({ id: "x", version: 1, local_ver: 0, remote_ver: 1 });
    expect(p.titleEl.textContent).toBe("Bez nazwy");
    expect(p.descEl.textContent).toBe("Brak opisu");
  });
});

describe("testCard button state (kanoniczny szablon)", () => {
  it("busy: label bez paska", () => {
    const btn = document.createElement("button");
    setTestButtonState(btn, { label: "Inicjowanie..." });
    expect(btn.disabled).toBe(true);
    expect(btn.querySelector(".progress-text").textContent).toBe("Inicjowanie...");
    expect(btn.querySelector(".progress-bar")).toBeNull();
  });

  it("progress: label + pasek o szerokości procentu", () => {
    const btn = document.createElement("button");
    setTestButtonState(btn, { label: "42%", percent: 42 });
    expect(btn.querySelector(".progress-bar").style.width).toBe("42%");
  });

  it("setTestButtonProgress: fast path aktualizuje w miejscu", () => {
    const btn = document.createElement("button");
    setTestButtonState(btn, { label: "1%", percent: 1 });
    const textNode = btn.querySelector(".progress-text");
    const barNode = btn.querySelector(".progress-bar");
    setTestButtonProgress(btn, 57);
    // Te same węzły (brak przebudowy DOM), nowe wartości
    expect(btn.querySelector(".progress-text")).toBe(textNode);
    expect(btn.querySelector(".progress-bar")).toBe(barNode);
    expect(textNode.textContent).toBe("57%");
    expect(barNode.style.width).toBe("57%");
  });

  it("setTestButtonProgress: fallback renderuje pełny szablon", () => {
    const btn = document.createElement("button");
    btn.textContent = "Pobierz";
    setTestButtonProgress(btn, 30);
    expect(btn.querySelector(".progress-text").textContent).toBe("30%");
    expect(btn.querySelector(".progress-bar").style.width).toBe("30%");
  });
});
