import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from '@firebase/rules-unit-testing';

// Prawdziwe testy semantyki firestore.rules na emulatorze Firestore.
// Uruchamiane wyłącznie przez `npm run test:rules` (firebase emulators:exec),
// które wymaga Java 11+. Wykluczone z domyślnego `npm run test:run`.

const PROJECT_ID = 'nous-rules-test';
const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 8080;
const rulesPath = resolve(process.cwd(), 'firestore.rules');

let testEnv;

function signedInDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function seed(write) {
  return testEnv.withSecurityRulesDisabled(async (context) => {
    await write(context.firestore());
  });
}

describe('firestore.rules — semantyka na emulatorze', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: readFileSync(rulesPath, 'utf8'),
        host: EMULATOR_HOST,
        port: EMULATOR_PORT
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('nieuwierzytelniony nie czyta danych użytkownika ani wyników', async () => {
    const db = testEnv.unauthenticatedContext().firestore();

    await assertFails(db.doc('user_keys/alice').get());
    await assertFails(db.doc('users/alice').get());
    await assertFails(db.doc('results/r1').get());
    // Katalog testów jest jawnie publiczny (patrz osobny test poniżej).

    await assertFails(db.doc('user_keys/alice').set({ key: 'k' }));
    await assertFails(db.doc('users/alice').set({ status: 'PENDING' }));
    await assertFails(db.doc('results/r1').set({ researcher_uid: 'alice' }));
    await assertFails(db.doc('tests/t1').set({ title: 'x' }));
  });

  it('user_keys/{uid}: właściciel czyta i zapisuje, cudzy dostęp failuje', async () => {
    const alice = signedInDb('alice');

    await assertSucceeds(alice.doc('user_keys/alice').set({ key: 'secret' }));
    const own = await assertSucceeds(alice.doc('user_keys/alice').get());
    expect(own.data().key).toBe('secret');

    await assertFails(alice.doc('user_keys/bob').get());
    await assertFails(alice.doc('user_keys/bob').set({ key: 'x' }));
  });

  it('users/{uid}: create z statusem PENDING przechodzi', async () => {
    const alice = signedInDb('alice');
    await assertSucceeds(alice.doc('users/alice').set({ status: 'PENDING' }));
  });

  it('users/{uid}: create z statusem ADMIN failuje (eskalacja)', async () => {
    const alice = signedInDb('alice');
    await assertFails(alice.doc('users/alice').set({ status: 'ADMIN' }));
  });

  it('users/{uid}: update i delete własnego dokumentu failują (eskalacja statusu)', async () => {
    await seed((db) => db.doc('users/alice').set({ status: 'PENDING' }));
    const alice = signedInDb('alice');

    await assertFails(alice.doc('users/alice').update({ status: 'ADMIN' }));
    await assertFails(alice.doc('users/alice').delete());
  });

  it('tests/{id}: katalog testów jest publicznie czytelny', async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(anon.collection('tests').get());
    await assertSucceeds(anon.doc('tests/t1').get());
  });

  it('tests/{id}: zalogowany użytkownik czyta katalog', async () => {
    const alice = signedInDb('alice');
    await assertSucceeds(alice.collection('tests').get());
  });

  it('tests/{id}: zwykły użytkownik nie zapisuje katalogu', async () => {
    await seed((db) => db.doc('users/alice').set({ status: 'PENDING' }));
    const alice = signedInDb('alice');
    await assertFails(alice.doc('tests/t1').set({ title: 'x' }));
  });

  it('tests/{id}: użytkownik ADMIN zapisuje katalog', async () => {
    await seed((db) => db.doc('users/admin').set({ status: 'ADMIN' }));
    const admin = signedInDb('admin');
    await assertSucceeds(admin.doc('tests/t1').set({ title: 'x' }));
  });

  it('results/{id}: właściciel tworzy i czyta własny wynik', async () => {
    const alice = signedInDb('alice');

    await assertSucceeds(
      alice.doc('results/r1').set({ researcher_uid: 'alice', title: 'x' })
    );
    const own = await assertSucceeds(alice.doc('results/r1').get());
    expect(own.data().researcher_uid).toBe('alice');
  });

  it('results/{id}: właściciel nie czyta cudzego wyniku', async () => {
    await seed((db) => db.doc('results/r2').set({ researcher_uid: 'bob' }));
    const alice = signedInDb('alice');
    await assertFails(alice.doc('results/r2').get());
  });

  it('results/{id}: create z cudzym researcher_uid failuje', async () => {
    const alice = signedInDb('alice');
    await assertFails(alice.doc('results/r3').set({ researcher_uid: 'bob' }));
  });

  it('domyślna odmowa: zapis i odczyt nieznanej kolekcji failują', async () => {
    const alice = signedInDb('alice');
    await assertFails(alice.doc('random/x').set({ v: 1 }));
    await assertFails(alice.doc('random/x').get());
  });
});
