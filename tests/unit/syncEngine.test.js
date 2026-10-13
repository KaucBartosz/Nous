import { describe, it, expect, vi } from "vitest";
import {
  LOCAL_PREFIX,
  isLocalRecord,
  selectSyncable,
  syncBlockReason,
  manualSyncBlockReason,
  packRecord,
  syncOneRecord,
  syncAll,
} from "../../src/sync/syncEngine.js";

// SyncEngine nie dotyka Firestore/DOM — tylko fejki.

const rec = (over = {}) => ({
  id: "r1",
  researcher_uid: "uid-1",
  test_id: "t1",
  subject_id: "s1",
  demographics: { age: 30 },
  wyniki: { score: 5 },
  timestamp: "2026-01-01T00:00:00.000Z",
  sync_status: "PENDING",
  ...over,
});

const encCrypto = {
  hasKey: () => true,
  encrypt: async ({ data, demographics }) => ({
    payload: { cipherOf: data, demoHidden: !!demographics },
    iv: "iv-1",
  }),
};
const plainCrypto = { hasKey: () => false, encrypt: vi.fn() };

const memIo = () => {
  const store = { saved: [], marked: [] };
  return {
    store,
    io: {
      packRecord: async (r) => ({ __docOf: r.id }),
      saveRemote: async (doc) => {
        store.saved.push(doc);
        return { id: `remote-${doc.__docOf}` };
      },
      markSynced: async (localId, remoteId) => {
        store.marked.push([localId, remoteId]);
      },
    },
  };
};

describe("syncEngine.isLocalRecord / selectSyncable", () => {
  it("LOCAL wykrywane po statusie i po prefiksie", () => {
    expect(LOCAL_PREFIX).toBe("LOCAL::");
    expect(isLocalRecord(rec({ sync_status: "LOCAL" }))).toBe(true);
    expect(isLocalRecord(rec({ researcher_uid: "LOCAL::jan" }))).toBe(true);
    expect(isLocalRecord(rec())).toBe(false);
    expect(isLocalRecord(rec({ researcher_uid: "GUEST" }))).toBe(false);
    expect(isLocalRecord(null)).toBe(false);
  });

  it("selectSyncable filtruje LOCAL, kolejność zachowana", () => {
    const out = selectSyncable([
      rec({ id: "a" }),
      rec({ id: "b", sync_status: "LOCAL" }),
      rec({ id: "c", researcher_uid: "LOCAL::x" }),
      rec({ id: "d" }),
    ]);
    expect(out.map((r) => r.id)).toEqual(["a", "d"]);
    expect(selectSyncable([])).toEqual([]);
  });
});

describe("syncEngine.syncBlockReason (guardy syncNow)", () => {
  const happy = {
    autoSyncEnabled: true,
    status: "APPROVED",
    online: true,
    user: { uid: "u" },
    syncing: false,
  };
  it("happy path nie blokuje", () => {
    expect(syncBlockReason(happy)).toBeNull();
  });
  it("5 powodów w kolejności oryginalnych if-ów", () => {
    expect(syncBlockReason({ ...happy, autoSyncEnabled: false })).toBe("disabled");
    expect(syncBlockReason({ ...happy, status: "LOCAL" })).toBe("local-session");
    expect(syncBlockReason({ ...happy, status: "GUEST" })).toBe("local-session");
    expect(syncBlockReason({ ...happy, online: false })).toBe("offline");
    expect(syncBlockReason({ ...happy, user: null })).toBe("no-user");
    expect(syncBlockReason({ ...happy, syncing: true })).toBe("in-progress");
  });
  it("pierwszy guard wygrywa (disabled przed offline)", () => {
    expect(
      syncBlockReason({ ...happy, autoSyncEnabled: false, online: false, user: null }),
    ).toBe("disabled");
  });
});

describe("syncEngine.manualSyncBlockReason (guardy ręcznej wysyłki)", () => {
  const ctx = { status: "APPROVED", online: true, user: { uid: "uid-1" } };
  it("happy path nie blokuje", () => {
    expect(manualSyncBlockReason(rec(), ctx)).toBeNull();
  });
  it("5 powodów", () => {
    expect(manualSyncBlockReason(rec(), { ...ctx, status: "LOCAL" })).toBe("local-session");
    expect(manualSyncBlockReason(rec({ sync_status: "LOCAL" }), ctx)).toBe("local-record");
    expect(manualSyncBlockReason(rec(), { ...ctx, online: false })).toBe("offline");
    expect(manualSyncBlockReason(rec(), { ...ctx, user: null })).toBe("no-user");
    expect(manualSyncBlockReason(rec({ researcher_uid: "uid-2" }), ctx)).toBe("foreign-record");
  });
});

describe("syncEngine.packRecord (pakowanie E2E)", () => {
  it("z kluczem: szyfrogram + demographics=null + iv", async () => {
    const doc = await packRecord(rec(), encCrypto);
    expect(doc).toMatchObject({
      researcher_uid: "uid-1",
      test_id: "t1",
      subject_id: "s1",
      data: { cipherOf: { score: 5 }, demoHidden: true },
      demographics: null,
      iv: "iv-1",
      is_encrypted: true,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(typeof doc.synced_at).toBe("string");
  });

  it("bez klucza: dane jawne + hook onUnencrypted", async () => {
    const onUnencrypted = vi.fn();
    const r = rec();
    const doc = await packRecord(r, plainCrypto, { onUnencrypted });
    expect(doc.data).toEqual({ score: 5 });
    expect(doc.demographics).toEqual({ age: 30 });
    expect(doc.is_encrypted).toBe(false);
    expect(doc.iv).toBeNull();
    expect(plainCrypto.encrypt).not.toHaveBeenCalled();
    expect(onUnencrypted).toHaveBeenCalledWith(r);
  });

  it("test_id fallback do testId; wyniki fallback do data", async () => {
    const doc = await packRecord(
      rec({ test_id: undefined, testId: "legacy", wyniki: undefined, data: { x: 1 } }),
      plainCrypto,
    );
    expect(doc.test_id).toBe("legacy");
    expect(doc.data).toEqual({ x: 1 });
  });
});

describe("syncEngine.syncOneRecord", () => {
  it("happy: pack → save → mark + zwrot remoteId", async () => {
    const { store, io } = memIo();
    const pack = vi.spyOn(io, "packRecord");
    const res = await syncOneRecord(rec({ id: "a" }), io);
    expect(res).toEqual({ synced: true, remoteId: "remote-a" });
    expect(pack).toHaveBeenCalled();
    expect(store.saved).toEqual([{ __docOf: "a" }]);
    expect(store.marked).toEqual([["a", "remote-a"]]);
  });

  it("LOCAL pomijany bez dotykania I/O", async () => {
    const { store, io } = memIo();
    const save = vi.spyOn(io, "saveRemote");
    const res = await syncOneRecord(rec({ sync_status: "LOCAL" }), io);
    expect(res).toEqual({ skipped: true });
    expect(save).not.toHaveBeenCalled();
    expect(store.marked).toEqual([]);
  });
});

describe("syncEngine.syncAll (pętla jak syncNow)", () => {
  const three = [rec({ id: "a" }), rec({ id: "b" }), rec({ id: "c" })];

  it("wszystko zielone + progress (done, total)", async () => {
    const { io } = memIo();
    const onProgress = vi.fn();
    const res = await syncAll(three, io, { onProgress });
    expect(res).toEqual({ synced: ["a", "b", "c"], failed: [], halted: false });
    expect(onProgress.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]]);
  });

  it("częściowy błąd: pada 1 rekord, reszta leci dalej", async () => {
    const { io } = memIo();
    const boom = new Error("quota");
    io.saveRemote = async (doc) => {
      if (doc.__docOf === "b") throw boom;
      return { id: `remote-${doc.__docOf}` };
    };
    const res = await syncAll(three, io);
    expect(res.synced).toEqual(["a", "c"]);
    expect(res.failed).toEqual([{ id: "b", error: boom }]);
    expect(res.halted).toBe(false);
  });

  it("permission-denied zatrzymuje pętlę (rekord c nietknięty)", async () => {
    const { store, io } = memIo();
    const denied = Object.assign(new Error("denied"), { code: "permission-denied" });
    io.saveRemote = async (doc) => {
      if (doc.__docOf === "b") throw denied;
      store.saved.push(doc);
      return { id: `remote-${doc.__docOf}` };
    };
    const res = await syncAll(three, io);
    expect(res.synced).toEqual(["a"]);
    expect(res.halted).toBe(true);
    expect(res.failed).toHaveLength(1);
    expect(store.saved.map((d) => d.__docOf)).toEqual(["a"]);
  });

  it("pusta lista: zera bez strzałów I/O", async () => {
    const { io } = memIo();
    const save = vi.spyOn(io, "saveRemote");
    expect(await syncAll([], io)).toEqual({ synced: [], failed: [], halted: false });
    expect(save).not.toHaveBeenCalled();
  });
});
