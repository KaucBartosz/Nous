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

function block(name) {
  const m = rules.match(new RegExp(`match\\s+/${name}\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
}

describe('firestore.rules — guard polityki dostępu', () => {
  it('używa rules_version 2', () => {
    expect(rules).toMatch(/rules_version\s*=\s*'2'\s*;/);
  });

  it('ma helpery signedIn / isOwner / isAdmin', () => {
    expect(rules).toMatch(/function\s+signedIn\(\)/);
    expect(rules).toMatch(/function\s+isOwner\(uid\)/);
    expect(rules).toMatch(/function\s+isAdmin\(\)/);
    // isAdmin czyta status z dokumentu użytkownika, nie z request.resource
    expect(rules).toMatch(/get\(.*\/documents\/users\/.*\)\.data\.status\s*==\s*['"]ADMIN['"]/);
  });

  it('user_keys/{uid} wymaga isOwner(uid)', () => {
    const userKeys = block('user_keys\\/{uid}');
    expect(userKeys).not.toBeNull();
    expect(userKeys).toMatch(/allow\s+read,\s+write:\s+if\s+isOwner\(uid\)/);
  });

  it('users/{uid}: odczyt tylko właściciel, zapis tylko create z PENDING', () => {
    const users = block('users\\/{uid}');
    expect(users).not.toBeNull();
    expect(users).toMatch(/allow\s+read:\s+if\s+isOwner\(uid\)/);
    expect(users).toMatch(/allow\s+create:/);
    expect(users).toMatch(/isOwner\(uid\)[\s\S]*status\s*==\s*['"]PENDING['"]/);
    // Klient NIE może zmienić statusu (eskalacja do ADMIN).
    expect(users).toMatch(/allow\s+update,\s+delete:\s+if\s+false/);
    // Nie ma już szerokiego "allow read, write" dla users.
    expect(users).not.toMatch(/allow\s+read,\s+write:/);
  });

  it('tests: odczyt publiczny, zapis tylko dla admina', () => {
    const tests = block('tests\\/{testId}');
    expect(tests).not.toBeNull();
    expect(tests).toMatch(/allow\s+read:\s+if\s+true/);
    expect(tests).toMatch(/allow\s+write:\s+if\s+isAdmin\(\)/);
  });

  it('wyniki requiring researcher_uid dla kolekcji results', () => {
    const results = block('results\\/{resultId}');
    expect(results).not.toBeNull();
    expect(results).toMatch(/allow\s+read:/);
    expect(results).toMatch(/request\.auth\.uid\s*==\s*resource\.data\.researcher_uid/);
    expect(results).toMatch(/allow\s+create:/);
    expect(results).toMatch(/request\.auth\.uid\s*==\s*request\.resource\.data\.researcher_uid/);
    // update/delete celowo niedozwolone
    expect(results).not.toMatch(/allow\s+(update|delete|read,\s+write):/);
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
