import { describe, it, expect } from 'vitest';
import {
  parseSemver,
  compareVersions,
  isPreRelease,
  getUpdateType,
  type SemVer,
  type UpdateType,
} from '../utils.js';

describe('Semantic Versioning Utilities', () => {
  describe('parseSemver', () => {
    it('parses basic version strings', () => {
      const result = parseSemver('1.2.3');

      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        raw: '1.2.3',
      });
    });

    it('parses version strings with v prefix', () => {
      const result = parseSemver('v2.0.1');

      expect(result).toEqual({
        major: 2,
        minor: 0,
        patch: 1,
        raw: 'v2.0.1',
      });
    });

    it('parses prerelease versions', () => {
      const result = parseSemver('1.0.0-alpha');

      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: ['alpha'],
        raw: '1.0.0-alpha',
      });
    });

    it('parses prerelease versions with numbers', () => {
      const result = parseSemver('1.0.0-alpha.1');

      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: ['alpha', '1'],
        raw: '1.0.0-alpha.1',
      });
    });

    it('parses complex prerelease versions', () => {
      const result = parseSemver('2.1.0-beta.3.x.y.z');

      expect(result).toEqual({
        major: 2,
        minor: 1,
        patch: 0,
        prerelease: ['beta', '3', 'x', 'y', 'z'],
        raw: '2.1.0-beta.3.x.y.z',
      });
    });

    it('parses build metadata', () => {
      const result = parseSemver('1.0.0+build.1');

      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        build: ['build', '1'],
        raw: '1.0.0+build.1',
      });
    });

    it('parses complex build metadata', () => {
      const result = parseSemver('1.0.0+build.20240115.sha.abcdef');

      expect(result).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        build: ['build', '20240115', 'sha', 'abcdef'],
        raw: '1.0.0+build.20240115.sha.abcdef',
      });
    });

    it('parses full version with prerelease and build', () => {
      const result = parseSemver('1.2.3-alpha.1+build.123');

      expect(result).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: ['alpha', '1'],
        build: ['build', '123'],
        raw: '1.2.3-alpha.1+build.123',
      });
    });

    it('handles zero versions', () => {
      const result = parseSemver('0.0.0');

      expect(result).toEqual({
        major: 0,
        minor: 0,
        patch: 0,
        raw: '0.0.0',
      });
    });

    it('returns null for invalid versions', () => {
      expect(parseSemver('')).toBeNull();
      expect(parseSemver('not.a.version')).toBeNull();
      expect(parseSemver('1.2')).toBeNull();
      expect(parseSemver('1.2.3.4')).toBeNull();
      expect(parseSemver('1.a.3')).toBeNull();
      expect(parseSemver('a.b.c')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
      expect(parseSemver(null as any)).toBeNull();
      expect(parseSemver(undefined as any)).toBeNull();
      expect(parseSemver('  ')).toBeNull();
    });

    it('handles edge cases in prerelease and build', () => {
      expect(parseSemver('1.0.0-')).toBeNull(); // Invalid: empty prerelease
      expect(parseSemver('1.0.0+')).toBeNull(); // Invalid: empty build
      expect(parseSemver('1.0.0-alpha.+build')).toBeNull(); // Invalid: mixed format
    });

    it('parses various prerelease identifiers', () => {
      const alpha = parseSemver('1.0.0-alpha');
      const beta = parseSemver('1.0.0-beta');
      const rc = parseSemver('1.0.0-rc.1');
      const snapshot = parseSemver('1.0.0-SNAPSHOT');

      expect(alpha?.prerelease).toEqual(['alpha']);
      expect(beta?.prerelease).toEqual(['beta']);
      expect(rc?.prerelease).toEqual(['rc', '1']);
      expect(snapshot?.prerelease).toEqual(['SNAPSHOT']);
    });
  });

  describe('isPreRelease', () => {
    it('identifies prerelease versions', () => {
      expect(isPreRelease('1.0.0-alpha')).toBe(true);
      expect(isPreRelease('1.0.0-alpha.1')).toBe(true);
      expect(isPreRelease('1.0.0-beta')).toBe(true);
      expect(isPreRelease('1.0.0-rc.1')).toBe(true);
      expect(isPreRelease('2.1.3-SNAPSHOT')).toBe(true);
    });

    it('identifies stable versions', () => {
      expect(isPreRelease('1.0.0')).toBe(false);
      expect(isPreRelease('2.1.3')).toBe(false);
      expect(isPreRelease('0.0.1')).toBe(false);
    });

    it('handles build metadata correctly', () => {
      expect(isPreRelease('1.0.0+build.123')).toBe(false);
      expect(isPreRelease('1.0.0-alpha+build.123')).toBe(true);
    });

    it('handles invalid versions', () => {
      expect(isPreRelease('invalid')).toBe(false);
      expect(isPreRelease('')).toBe(false);
      expect(isPreRelease(null as any)).toBe(false);
    });

    it('works with parsed SemVer objects', () => {
      const stable = parseSemver('1.0.0')!;
      const prerelease = parseSemver('1.0.0-alpha')!;

      expect(isPreRelease(stable)).toBe(false);
      expect(isPreRelease(prerelease)).toBe(true);
    });
  });

  describe('compareVersions', () => {
    describe('basic version comparison', () => {
      it('compares major versions', () => {
        expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
        expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      });

      it('compares minor versions when major is equal', () => {
        expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
        expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
        expect(compareVersions('1.1.0', '1.1.0')).toBe(0);
      });

      it('compares patch versions when major and minor are equal', () => {
        expect(compareVersions('1.1.2', '1.1.1')).toBe(1);
        expect(compareVersions('1.1.1', '1.1.2')).toBe(-1);
        expect(compareVersions('1.1.1', '1.1.1')).toBe(0);
      });
    });

    describe('prerelease version comparison', () => {
      it('treats prerelease as less than stable', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
      });

      it('compares prerelease versions lexically', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
        expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1);
        expect(compareVersions('1.0.0-alpha', '1.0.0-alpha')).toBe(0);
      });

      it('compares prerelease versions with numbers', () => {
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe(1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1')).toBe(0);
      });

      it('treats numeric identifiers as less than non-numeric', () => {
        expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
        expect(compareVersions('1.0.0-alpha', '1.0.0-1')).toBe(1);
      });

      it('compares prerelease versions with different lengths', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha')).toBe(1);
      });

      it('handles complex prerelease scenarios', () => {
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1.1')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1.1', '1.0.0-alpha.1')).toBe(1);
        expect(compareVersions('1.0.0-alpha.beta', '1.0.0-alpha.1')).toBe(1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBe(-1);
      });
    });

    describe('edge cases and error handling', () => {
      it('handles invalid versions gracefully', () => {
        expect(compareVersions('invalid', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', 'invalid')).toBe(1);
        expect(compareVersions('invalid', 'invalid')).toBe(0);
      });

      it('ignores build metadata in comparison', () => {
        expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0);
        expect(compareVersions('1.0.0+build', '1.0.0')).toBe(0);
      });

      it('works with parsed SemVer objects', () => {
        const v1 = parseSemver('1.0.0')!;
        const v2 = parseSemver('2.0.0')!;

        expect(compareVersions(v1, v2)).toBe(-1);
        expect(compareVersions(v2, v1)).toBe(1);
        expect(compareVersions(v1, v1)).toBe(0);
      });

      it('handles mixed string and object inputs', () => {
        const v1 = parseSemver('1.0.0')!;

        expect(compareVersions(v1, '2.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', v1)).toBe(0);
      });
    });

    describe('real-world version scenarios', () => {
      it('sorts versions correctly', () => {
        const versions = [
          '1.0.0',
          '1.0.0-alpha',
          '1.0.0-alpha.1',
          '1.0.0-beta',
          '1.0.0-beta.2',
          '1.0.0-rc.1',
          '2.0.0',
          '2.0.0-alpha'
        ];

        const sorted = [...versions].sort(compareVersions);

        expect(sorted).toEqual([
          '1.0.0-alpha',
          '1.0.0-alpha.1',
          '1.0.0-beta',
          '1.0.0-beta.2',
          '1.0.0-rc.1',
          '1.0.0',
          '2.0.0-alpha',
          '2.0.0'
        ]);
      });

      it('handles npm/node version patterns', () => {
        expect(compareVersions('14.15.0', '16.0.0')).toBe(-1);
        expect(compareVersions('16.0.0', '14.15.0')).toBe(1);
        expect(compareVersions('18.0.0-pre', '18.0.0')).toBe(-1);
      });
    });
  });

  describe('getUpdateType', () => {
    it('identifies major updates', () => {
      expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
      expect(getUpdateType('1.5.3', '3.0.0')).toBe('major');
      expect(getUpdateType('0.9.9', '1.0.0')).toBe('major');
    });

    it('identifies minor updates', () => {
      expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
      expect(getUpdateType('2.5.3', '2.10.0')).toBe('minor');
      expect(getUpdateType('1.0.5', '1.2.0')).toBe('minor');
    });

    it('identifies patch updates', () => {
      expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
      expect(getUpdateType('2.5.3', '2.5.10')).toBe('patch');
      expect(getUpdateType('1.2.0', '1.2.1')).toBe('patch');
    });

    it('identifies prerelease updates', () => {
      expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
      expect(getUpdateType('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe('prerelease');
      expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');
    });

    it('identifies no update', () => {
      expect(getUpdateType('1.0.0', '1.0.0')).toBe('none');
      expect(getUpdateType('2.5.3', '2.5.3')).toBe('none');
      expect(getUpdateType('1.0.0-alpha', '1.0.0-alpha')).toBe('none');
    });

    it('identifies downgrades', () => {
      expect(getUpdateType('2.0.0', '1.0.0')).toBe('downgrade');
      expect(getUpdateType('1.1.0', '1.0.0')).toBe('downgrade');
      expect(getUpdateType('1.0.1', '1.0.0')).toBe('downgrade');
      expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('downgrade');
    });

    it('handles invalid versions', () => {
      expect(getUpdateType('invalid', '1.0.0')).toBe('none');
      expect(getUpdateType('1.0.0', 'invalid')).toBe('none');
      expect(getUpdateType('invalid', 'invalid')).toBe('none');
    });

    it('works with parsed SemVer objects', () => {
      const current = parseSemver('1.0.0')!;
      const latest = parseSemver('1.1.0')!;

      expect(getUpdateType(current, latest)).toBe('minor');
    });

    it('handles complex prerelease scenarios', () => {
      expect(getUpdateType('1.0.0-alpha.1', '1.0.0-beta.1')).toBe('prerelease');
      expect(getUpdateType('1.0.0-rc.1', '1.0.0')).toBe('prerelease');
      expect(getUpdateType('1.0.0', '1.0.1-alpha')).toBe('patch');
    });

    describe('priority of update types', () => {
      it('prioritizes major over minor and patch', () => {
        expect(getUpdateType('1.0.0', '2.1.1')).toBe('major');
        expect(getUpdateType('1.5.3', '3.0.0')).toBe('major');
      });

      it('prioritizes minor over patch', () => {
        expect(getUpdateType('1.0.0', '1.1.5')).toBe('minor');
        expect(getUpdateType('2.3.7', '2.5.0')).toBe('minor');
      });

      it('correctly identifies edge cases', () => {
        // Same version numbers but prerelease vs stable
        expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');

        // Build metadata should not affect update type
        expect(getUpdateType('1.0.0+build.1', '1.0.0+build.2')).toBe('none');
        expect(getUpdateType('1.0.0', '1.0.0+build.1')).toBe('none');
      });
    });

    describe('real-world update scenarios', () => {
      it('handles typical npm package updates', () => {
        expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch'); // Bug fix
        expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor'); // Feature addition
        expect(getUpdateType('1.0.0', '2.0.0')).toBe('major'); // Breaking change
      });

      it('handles pre-release to stable transitions', () => {
        expect(getUpdateType('1.0.0-rc.1', '1.0.0')).toBe('prerelease');
        expect(getUpdateType('1.0.0-beta', '1.0.0-rc.1')).toBe('prerelease');
      });

      it('handles development versions', () => {
        expect(getUpdateType('0.9.0', '0.9.1')).toBe('patch');
        expect(getUpdateType('0.9.0', '0.10.0')).toBe('minor');
        expect(getUpdateType('0.9.0', '1.0.0')).toBe('major');
      });
    });
  });

  describe('Integration tests', () => {
    it('all functions work together for version analysis', () => {
      const currentVersion = '1.0.0-alpha.1';
      const targetVersion = '1.0.0';

      const currentParsed = parseSemver(currentVersion)!;
      const targetParsed = parseSemver(targetVersion)!;

      expect(currentParsed).toBeTruthy();
      expect(targetParsed).toBeTruthy();

      expect(isPreRelease(currentParsed)).toBe(true);
      expect(isPreRelease(targetParsed)).toBe(false);

      expect(compareVersions(currentParsed, targetParsed)).toBe(-1);
      expect(getUpdateType(currentParsed, targetParsed)).toBe('prerelease');
    });

    it('handles version upgrade scenarios', () => {
      const scenarios = [
        { current: '1.0.0', target: '1.0.1', expectedType: 'patch' as UpdateType },
        { current: '1.0.0', target: '1.1.0', expectedType: 'minor' as UpdateType },
        { current: '1.0.0', target: '2.0.0', expectedType: 'major' as UpdateType },
        { current: '1.0.0-alpha', target: '1.0.0', expectedType: 'prerelease' as UpdateType },
        { current: '2.0.0', target: '1.0.0', expectedType: 'downgrade' as UpdateType },
        { current: '1.0.0', target: '1.0.0', expectedType: 'none' as UpdateType },
      ];

      scenarios.forEach(({ current, target, expectedType }) => {
        expect(getUpdateType(current, target)).toBe(expectedType);
      });
    });

    it('maintains consistency across different input formats', () => {
      const versionString = '1.2.3-alpha.1+build.123';
      const versionParsed = parseSemver(versionString)!;

      expect(isPreRelease(versionString)).toBe(isPreRelease(versionParsed));
      expect(compareVersions(versionString, '1.2.3')).toBe(compareVersions(versionParsed, '1.2.3'));
      expect(getUpdateType(versionString, '1.2.3')).toBe(getUpdateType(versionParsed, '1.2.3'));
    });
  });
});