import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// UWAGA: to jest test strażniczy (guard), nie pełna symulacja emulatora.
// Sprawdza treść prawdziwego pliku firestore.rules, ale NIE validates
// semantyki reguł — pełne testy wymagają @firebase/rules-unit-testing
// i emulatora Firestore, których ten projekt nie dodaje.
const rulesPath = resolve(process.cwd(), 'firestore.rules');
const raw = readFileSync(rulesPath, 'utf8');
// Usuwamy komentarze, by tekst w komentarzach nie dawał fałszywych trafień.
const rules = raw.replace(/\/\/.*$/gm, '');

describe('firestore.rules — guard polityki dostępu', () => {
  it('używa rules_version 2', () => {
    expect(rules).toMatch(/rules_version\s*=\s*'2'\s*;/);
  });

  it('user_keys/{uid} wymaga request.auth.uid == uid', () => {
    expect(rules).toMatch(/match\s+\/user_keys\/\{uid\}/);
    expect(rules).toMatch(/request\.auth\.uid\s*==\s*uid/);
  });

  it('users/{uid} wymaga request.auth.uid == uid', () => {
    const usersRule = rules.match(/match\s+\/users\/\{uid\}\s*\{([^}]*)\}/);
    expect(usersRule).not.toBeNull();
    expect(usersRule[1]).toMatch(/request\.auth\.uid\s*==\s*uid/);
  });

  it('wyniki requiring researcher_uid dla kolekcji results', () => {
    expect(rules).toMatch(/match\s+\/results\/\{/);
    expect(rules).toMatch(/request\.auth\.uid\s*==\s*resource\.data\.researcher_uid/);
    expect(rules).toMatch(/request\.auth\.uid\s*==\s*request\.resource\.data\.researcher_uid/);
  });

  it('ma domyślną regułę odmawiającą dostępu', () => {
    expect(rules).toMatch(/match\s+\/\{document=\*\*\}/);
    expect(rules).toMatch(/allow\s+read,\s+write:\s+if\s+false\s*;/);
  });

  it('nie ma reguły otwierającej dostęp (if true / pusty allow)', () => {
    expect(rules).not.toMatch(/allow\s+read,\s+write:\s+if\s+true\s*;/);
    expect(rules).not.toMatch(/allow\s+read,\s+write\s*;/);
  });
});
