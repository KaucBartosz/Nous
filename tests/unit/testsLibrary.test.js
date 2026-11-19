import { describe, it, expect, vi, afterEach } from 'vitest';

const { resolveBuildLibrary, resolveE2eLibrary } = require('../../tools/tests-library.js');
const FIXTURE = 'fixture';

describe('resolveTestsLibrary', () => {
  afterEach(() => {
    delete process.env.BBTP_DIR;
    delete process.env.NOUS_E2E_TESTS_DIR;
    vi.unstubAllGlobals();
  });

  it('E2E jest hermetyczne: fixture, chyba że jawnie ustawiono override', () => {
    expect(resolveE2eLibrary(FIXTURE)).toBe(FIXTURE);
    process.env.NOUS_E2E_TESTS_DIR = 'C:/custom';
    expect(resolveE2eLibrary(FIXTURE)).toBe('C:/custom');
  });

  it('build honoruje BBTP_DIR i wraca do katalogów obok repo', () => {
    process.env.BBTP_DIR = 'C:/bbtp';
    vi.spyOn(require('fs'), 'existsSync').mockImplementation((p) =>
      String(p).toLowerCase().includes('bbtp'),
    );
    expect(resolveBuildLibrary()).toBe('C:/bbtp');
  });
});
