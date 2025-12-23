import { describe, it, expect } from 'vitest';
import {
  parseSemver,
  isPreRelease,
  compareVersions,
  getUpdateType,
  type SemVer,
  type UpdateType,
} from '../utils';

describe.skip('semver edge cases and advanced scenarios', () => {
  describe('parseSemver edge cases', () => {
    it('should handle versions with extremely large numbers', () => {
      const result = parseSemver('999999999.888888888.777777777');
      expect(result).toEqual({
        major: 999999999,
        minor: 888888888,
        patch: 777777777,
        raw: '999999999.888888888.777777777',
      });
    });

    it('should handle prerelease with hyphens and dots', () => {
      const result = parseSemver('1.0.0-alpha-beta.rc.1');
      expect(result?.prerelease).toEqual(['alpha-beta', 'rc', '1']);
    });

    it('should handle build metadata with special characters', () => {
      const result = parseSemver('1.0.0+build-123.sha-abc123.date-20250101');
      expect(result?.build).toEqual(['build-123', 'sha-abc123', 'date-20250101']);
    });

    it('should handle version with both complex prerelease and build', () => {
      const result = parseSemver('2.0.0-beta.2.rc.1+build.20250115.commit.abc123');
      expect(result).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: ['beta', '2', 'rc', '1'],
        build: ['build', '20250115', 'commit', 'abc123'],
        raw: '2.0.0-beta.2.rc.1+build.20250115.commit.abc123',
      });
    });

    it('should handle single character prerelease identifiers', () => {
      const result = parseSemver('1.0.0-a.b.c.d.e');
      expect(result?.prerelease).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('should reject versions with leading zeros', () => {
      expect(parseSemver('01.2.3')).toBeNull();
      expect(parseSemver('1.02.3')).toBeNull();
      expect(parseSemver('1.2.03')).toBeNull();
    });

    it('should reject versions with non-ASCII characters', () => {
      expect(parseSemver('1.2.3-αlpha')).toBeNull();
      expect(parseSemver('1.2.3+bùild')).toBeNull();
    });

    it('should reject versions with empty prerelease parts', () => {
      expect(parseSemver('1.2.3-')).toBeNull();
      expect(parseSemver('1.2.3-.alpha')).toBeNull();
      expect(parseSemver('1.2.3-alpha.')).toBeNull();
      expect(parseSemver('1.2.3-alpha..beta')).toBeNull();
    });

    it('should reject versions with empty build parts', () => {
      expect(parseSemver('1.2.3+')).toBeNull();
      expect(parseSemver('1.2.3+.build')).toBeNull();
      expect(parseSemver('1.2.3+build.')).toBeNull();
      expect(parseSemver('1.2.3+build..123')).toBeNull();
    });

    it('should handle maximum integer values', () => {
      const maxInt = Number.MAX_SAFE_INTEGER;
      const result = parseSemver(`${maxInt}.${maxInt}.${maxInt}`);
      expect(result?.major).toBe(maxInt);
      expect(result?.minor).toBe(maxInt);
      expect(result?.patch).toBe(maxInt);
    });
  });

  describe('isPreRelease edge cases', () => {
    it('should handle numeric-only prerelease', () => {
      expect(isPreRelease('1.0.0-0')).toBe(true);
      expect(isPreRelease('1.0.0-123')).toBe(true);
      expect(isPreRelease('1.0.0-999999')).toBe(true);
    });

    it('should handle mixed alphanumeric prerelease', () => {
      expect(isPreRelease('1.0.0-alpha1beta2')).toBe(true);
      expect(isPreRelease('1.0.0-rc1')).toBe(true);
      expect(isPreRelease('1.0.0-snapshot20250115')).toBe(true);
    });

    it('should handle prerelease with SemVer objects with undefined prerelease', () => {
      const semver: SemVer = {
        major: 1,
        minor: 0,
        patch: 0,
        raw: '1.0.0',
      };
      expect(isPreRelease(semver)).toBe(false);
    });

    it('should handle prerelease with SemVer objects with empty prerelease array', () => {
      const semver: SemVer = {
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: [],
        raw: '1.0.0',
      };
      expect(isPreRelease(semver)).toBe(false);
    });
  });

  describe('compareVersions complex scenarios', () => {
    it('should handle comparison with different prerelease formats', () => {
      expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1); // numeric < alpha
      expect(compareVersions('1.0.0-alpha', '1.0.0-alpha1')).toBe(-1); // alpha < alpha1
      expect(compareVersions('1.0.0-alpha1', '1.0.0-beta')).toBe(-1); // alpha1 < beta
      expect(compareVersions('1.0.0-beta', '1.0.0-beta2')).toBe(-1); // beta < beta2
      expect(compareVersions('1.0.0-beta2', '1.0.0-rc1')).toBe(-1); // beta2 < rc1
    });

    it('should handle deep prerelease hierarchies', () => {
      expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1.1')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1.1', '1.0.0-alpha.1.1.1')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1.1.1', '1.0.0-alpha.2')).toBe(-1);
    });

    it('should handle mixed numeric and alphanumeric identifiers in prerelease', () => {
      expect(compareVersions('1.0.0-1.alpha', '1.0.0-1.beta')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.2', '1.0.0-alpha.10')).toBe(-1);
      expect(compareVersions('1.0.0-alpha.10', '1.0.0-alpha.beta')).toBe(-1);
    });

    it('should handle versions where one has v prefix and other does not', () => {
      expect(compareVersions('v1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.0', 'v1.0.1')).toBe(-1);
      expect(compareVersions('v1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.0.1', 'v1.0.0')).toBe(1);
    });

    it('should handle extremely long prerelease chains', () => {
      const longPrerelease = 'alpha.1.2.3.4.5.6.7.8.9.10.11.12.13.14.15.16.17.18.19.20';
      expect(compareVersions(`1.0.0-${longPrerelease}`, '1.0.0-alpha.1.2.3.4.5.6.7.8.9.10.11.12.13.14.15.16.17.18.19')).toBe(1);
    });

    it('should handle null/undefined SemVer objects gracefully', () => {
      const validSemver = parseSemver('1.0.0')!;
      expect(compareVersions(null as any, validSemver)).toBe(-1);
      expect(compareVersions(validSemver, null as any)).toBe(1);
      expect(compareVersions(undefined as any, validSemver)).toBe(-1);
      expect(compareVersions(validSemver, undefined as any)).toBe(1);
    });
  });

  describe('getUpdateType complex scenarios', () => {
    it('should prioritize version number changes over prerelease status', () => {
      // Major version change should be 'major' even with prerelease changes
      expect(getUpdateType('1.0.0-alpha', '2.0.0-beta')).toBe('major');
      expect(getUpdateType('1.0.0', '2.0.0-alpha')).toBe('major');

      // Minor version change should be 'minor' even with prerelease changes
      expect(getUpdateType('1.0.0-alpha', '1.1.0-beta')).toBe('minor');
      expect(getUpdateType('1.0.0', '1.1.0-alpha')).toBe('minor');

      // Patch version change should be 'patch' even with prerelease changes
      expect(getUpdateType('1.0.0-alpha', '1.0.1-beta')).toBe('patch');
      expect(getUpdateType('1.0.0', '1.0.1-alpha')).toBe('patch');
    });

    it('should handle promotion from prerelease to stable correctly', () => {
      expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');
      expect(getUpdateType('1.0.0-beta', '1.0.0')).toBe('prerelease');
      expect(getUpdateType('1.0.0-rc.1', '1.0.0')).toBe('prerelease');
      expect(getUpdateType('2.0.0-alpha', '2.0.0')).toBe('prerelease');
    });

    it('should handle demotion from stable to prerelease correctly', () => {
      expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('prerelease');
      expect(getUpdateType('2.0.0', '2.0.0-beta')).toBe('prerelease');
    });

    it('should handle prerelease progression correctly', () => {
      expect(getUpdateType('1.0.0-alpha', '1.0.0-alpha.1')).toBe('prerelease');
      expect(getUpdateType('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe('prerelease');
      expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
      expect(getUpdateType('1.0.0-beta', '1.0.0-rc')).toBe('prerelease');
    });

    it('should detect downgrades in prerelease versions', () => {
      expect(getUpdateType('1.0.0-beta', '1.0.0-alpha')).toBe('downgrade');
      expect(getUpdateType('1.0.0-rc', '1.0.0-beta')).toBe('downgrade');
      expect(getUpdateType('1.0.0-alpha.2', '1.0.0-alpha.1')).toBe('downgrade');
    });

    it('should handle complex mixed scenarios', () => {
      // Same base version with different prerelease
      expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');

      // Different base versions with prerelease
      expect(getUpdateType('1.0.0-alpha', '1.1.0-alpha')).toBe('minor');
      expect(getUpdateType('1.1.0-alpha', '1.0.0-alpha')).toBe('downgrade');

      // Build metadata should be ignored
      expect(getUpdateType('1.0.0+build1', '1.0.0+build2')).toBe('none');
      expect(getUpdateType('1.0.0-alpha+build1', '1.0.0-alpha+build2')).toBe('none');
    });

    it('should handle edge cases with malformed versions', () => {
      // One valid, one invalid
      expect(getUpdateType('invalid', '1.0.0')).toBe('none');
      expect(getUpdateType('1.0.0', 'invalid')).toBe('none');

      // Both invalid
      expect(getUpdateType('invalid1', 'invalid2')).toBe('none');

      // Empty strings
      expect(getUpdateType('', '1.0.0')).toBe('none');
      expect(getUpdateType('1.0.0', '')).toBe('none');
      expect(getUpdateType('', '')).toBe('none');
    });

    it('should work with mixed string and SemVer object inputs', () => {
      const semver100 = parseSemver('1.0.0')!;
      const semver200 = parseSemver('2.0.0')!;
      const semverAlpha = parseSemver('1.0.0-alpha')!;

      expect(getUpdateType(semver100, '2.0.0')).toBe('major');
      expect(getUpdateType('1.0.0', semver200)).toBe('major');
      expect(getUpdateType(semver100, semver200)).toBe('major');

      expect(getUpdateType(semverAlpha, '1.0.0')).toBe('prerelease');
      expect(getUpdateType('1.0.0-alpha', semver100)).toBe('prerelease');
      expect(getUpdateType(semverAlpha, semver100)).toBe('prerelease');
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic version progression scenarios', () => {
      const versions = [
        '0.1.0',
        '0.1.1',
        '0.2.0-alpha',
        '0.2.0-alpha.1',
        '0.2.0-beta',
        '0.2.0-rc.1',
        '0.2.0',
        '0.2.1',
        '1.0.0-alpha',
        '1.0.0-beta',
        '1.0.0-rc.1',
        '1.0.0',
        '1.0.1',
        '1.1.0',
        '2.0.0',
      ];

      // Test that each version is correctly parsed
      for (const version of versions) {
        expect(parseSemver(version)).not.toBeNull();
      }

      // Test that versions are in ascending order
      for (let i = 0; i < versions.length - 1; i++) {
        expect(compareVersions(versions[i], versions[i + 1])).toBe(-1);
        expect(compareVersions(versions[i + 1], versions[i])).toBe(1);
      }

      // Test update types for common transitions
      expect(getUpdateType('0.1.0', '0.1.1')).toBe('patch');
      expect(getUpdateType('0.1.1', '0.2.0-alpha')).toBe('minor');
      expect(getUpdateType('0.2.0-alpha', '0.2.0-alpha.1')).toBe('prerelease');
      expect(getUpdateType('0.2.0-rc.1', '0.2.0')).toBe('prerelease');
      expect(getUpdateType('0.2.1', '1.0.0-alpha')).toBe('major');
      expect(getUpdateType('1.0.0-rc.1', '1.0.0')).toBe('prerelease');
      expect(getUpdateType('1.0.1', '1.1.0')).toBe('minor');
      expect(getUpdateType('1.1.0', '2.0.0')).toBe('major');
    });

    it('should handle npm/package.json style versioning', () => {
      const npmVersions = [
        '1.0.0',
        '1.0.1-next.0',
        '1.0.1-next.1',
        '1.0.1',
        '1.1.0-next.0',
        '1.1.0',
        '1.1.1',
        '2.0.0-next.0',
        '2.0.0',
      ];

      for (const version of npmVersions) {
        expect(parseSemver(version)).not.toBeNull();
      }

      // Verify next.X prerelease progression
      expect(compareVersions('1.0.1-next.0', '1.0.1-next.1')).toBe(-1);
      expect(getUpdateType('1.0.1-next.0', '1.0.1-next.1')).toBe('prerelease');
      expect(getUpdateType('1.0.1-next.1', '1.0.1')).toBe('prerelease');
    });

    it('should handle git tag style versioning', () => {
      const gitTags = [
        'v1.0.0',
        'v1.0.1-beta',
        'v1.0.1',
        'v1.1.0-alpha.1',
        'v1.1.0',
        'v2.0.0-rc.1+build.123',
        'v2.0.0',
      ];

      for (const tag of gitTags) {
        expect(parseSemver(tag)).not.toBeNull();
        expect(isPreRelease(tag)).toBe(tag.includes('-'));
      }

      // Test cross-format comparison (v prefix vs no prefix)
      expect(compareVersions('v1.0.0', '1.0.1')).toBe(-1);
      expect(getUpdateType('v1.0.0', '1.1.0')).toBe('minor');
    });

    it('should handle malformed input gracefully in real scenarios', () => {
      const malformedInputs = [
        null,
        undefined,
        '',
        '   ',
        'not-a-version',
        '1.2',
        '1.2.3.4',
        '1.a.3',
        'v1.2.3.4',
        '1.2.3-',
        '1.2.3+',
        '1.2.3--alpha',
        '1.2.3++build',
      ];

      for (const input of malformedInputs) {
        expect(parseSemver(input as any)).toBeNull();
        expect(isPreRelease(input as any)).toBe(false);
        expect(compareVersions(input as any, '1.0.0')).toBe(-1);
        expect(getUpdateType(input as any, '1.0.0')).toBe('none');
      }
    });
  });

  describe('performance and boundary testing', () => {
    it('should handle very long prerelease identifiers', () => {
      const longIdentifier = 'a'.repeat(1000);
      const version = `1.0.0-${longIdentifier}`;
      const parsed = parseSemver(version);

      expect(parsed).not.toBeNull();
      expect(parsed!.prerelease![0]).toBe(longIdentifier);
      expect(isPreRelease(parsed!)).toBe(true);
    });

    it('should handle many prerelease identifiers', () => {
      const manyIdentifiers = new Array(100).fill(0).map((_, i) => `id${i}`).join('.');
      const version = `1.0.0-${manyIdentifiers}`;
      const parsed = parseSemver(version);

      expect(parsed).not.toBeNull();
      expect(parsed!.prerelease!).toHaveLength(100);
      expect(isPreRelease(parsed!)).toBe(true);
    });

    it('should handle comparison of versions with many identifiers efficiently', () => {
      const version1 = '1.0.0-' + new Array(50).fill(0).map((_, i) => `a${i}`).join('.');
      const version2 = '1.0.0-' + new Array(50).fill(0).map((_, i) => `a${i}`).join('.') + '.extra';

      const result = compareVersions(version1, version2);
      expect(result).toBe(-1); // version1 < version2 (fewer identifiers)
    });
  });
});