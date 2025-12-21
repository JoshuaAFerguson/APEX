import { describe, it, expect } from 'vitest';
import {
  parseSemver,
  isPreRelease,
  compareVersions,
  getUpdateType,
} from '../utils';

/**
 * Acceptance Criteria Verification Tests
 *
 * This test file specifically addresses the acceptance criteria:
 * "Utility functions exist for: compareVersions(), getUpdateType(current, latest),
 * isPreRelease(), parseSemver(). Unit tests cover edge cases (prerelease versions,
 * invalid versions, major/minor/patch detection). All tests pass."
 */

describe('Semver Acceptance Criteria Verification', () => {
  describe('Function Existence and Signature Verification', () => {
    it('should have parseSemver function with correct signature', () => {
      expect(typeof parseSemver).toBe('function');
      expect(parseSemver.length).toBe(1); // expects 1 parameter

      // Verify it returns correct structure
      const result = parseSemver('1.2.3');
      expect(result).toHaveProperty('major');
      expect(result).toHaveProperty('minor');
      expect(result).toHaveProperty('patch');
      expect(result).toHaveProperty('raw');
    });

    it('should have isPreRelease function with correct signature', () => {
      expect(typeof isPreRelease).toBe('function');
      expect(isPreRelease.length).toBe(1); // expects 1 parameter

      // Verify it returns boolean
      expect(typeof isPreRelease('1.0.0')).toBe('boolean');
      expect(typeof isPreRelease('1.0.0-alpha')).toBe('boolean');
    });

    it('should have compareVersions function with correct signature', () => {
      expect(typeof compareVersions).toBe('function');
      expect(compareVersions.length).toBe(2); // expects 2 parameters

      // Verify it returns -1, 0, or 1
      const result = compareVersions('1.0.0', '2.0.0');
      expect([-1, 0, 1]).toContain(result);
    });

    it('should have getUpdateType function with correct signature', () => {
      expect(typeof getUpdateType).toBe('function');
      expect(getUpdateType.length).toBe(2); // expects 2 parameters (current, latest)

      // Verify it returns correct update type
      const result = getUpdateType('1.0.0', '2.0.0');
      expect(['major', 'minor', 'patch', 'prerelease', 'none', 'downgrade']).toContain(result);
    });
  });

  describe('Major/Minor/Patch Detection Verification', () => {
    describe('Major version detection', () => {
      it('should detect major version updates correctly', () => {
        expect(getUpdateType('1.0.0', '2.0.0')).toBe('major');
        expect(getUpdateType('1.5.10', '2.0.0')).toBe('major');
        expect(getUpdateType('0.9.9', '1.0.0')).toBe('major');
        expect(getUpdateType('10.0.0', '11.0.0')).toBe('major');
      });

      it('should prioritize major updates over minor/patch changes', () => {
        expect(getUpdateType('1.0.0', '2.1.5')).toBe('major');
        expect(getUpdateType('1.5.10', '2.0.0')).toBe('major');
        expect(getUpdateType('0.1.0', '1.0.0')).toBe('major');
      });
    });

    describe('Minor version detection', () => {
      it('should detect minor version updates correctly', () => {
        expect(getUpdateType('1.0.0', '1.1.0')).toBe('minor');
        expect(getUpdateType('1.5.0', '1.10.0')).toBe('minor');
        expect(getUpdateType('2.0.0', '2.1.0')).toBe('minor');
      });

      it('should prioritize minor updates over patch changes', () => {
        expect(getUpdateType('1.0.0', '1.1.5')).toBe('minor');
        expect(getUpdateType('1.2.0', '1.5.10')).toBe('minor');
      });
    });

    describe('Patch version detection', () => {
      it('should detect patch version updates correctly', () => {
        expect(getUpdateType('1.0.0', '1.0.1')).toBe('patch');
        expect(getUpdateType('1.0.5', '1.0.10')).toBe('patch');
        expect(getUpdateType('2.5.0', '2.5.1')).toBe('patch');
      });

      it('should handle large patch increments', () => {
        expect(getUpdateType('1.0.0', '1.0.100')).toBe('patch');
        expect(getUpdateType('1.0.50', '1.0.999')).toBe('patch');
      });
    });
  });

  describe('Prerelease Version Handling', () => {
    describe('Prerelease identification', () => {
      it('should identify various prerelease formats', () => {
        // Alpha releases
        expect(isPreRelease('1.0.0-alpha')).toBe(true);
        expect(isPreRelease('1.0.0-alpha.1')).toBe(true);

        // Beta releases
        expect(isPreRelease('1.0.0-beta')).toBe(true);
        expect(isPreRelease('1.0.0-beta.2')).toBe(true);

        // Release candidates
        expect(isPreRelease('1.0.0-rc')).toBe(true);
        expect(isPreRelease('1.0.0-rc.1')).toBe(true);

        // Numeric prereleases
        expect(isPreRelease('1.0.0-0')).toBe(true);
        expect(isPreRelease('1.0.0-1')).toBe(true);

        // Custom prerelease identifiers
        expect(isPreRelease('1.0.0-snapshot')).toBe(true);
        expect(isPreRelease('1.0.0-dev')).toBe(true);
        expect(isPreRelease('1.0.0-next')).toBe(true);
      });

      it('should not identify stable versions as prerelease', () => {
        expect(isPreRelease('1.0.0')).toBe(false);
        expect(isPreRelease('2.5.10')).toBe(false);
        expect(isPreRelease('0.1.0')).toBe(false);
        expect(isPreRelease('v1.0.0')).toBe(false);
      });

      it('should handle build metadata correctly (not prerelease)', () => {
        expect(isPreRelease('1.0.0+build.123')).toBe(false);
        expect(isPreRelease('1.0.0+20230101')).toBe(false);
        expect(isPreRelease('1.0.0+commit.abc123')).toBe(false);
      });
    });

    describe('Prerelease comparison', () => {
      it('should rank stable versions higher than prerelease', () => {
        expect(compareVersions('1.0.0', '1.0.0-alpha')).toBe(1);
        expect(compareVersions('1.0.0', '1.0.0-beta')).toBe(1);
        expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBe(1);
      });

      it('should compare prerelease versions correctly', () => {
        // Alphabetic comparison
        expect(compareVersions('1.0.0-alpha', '1.0.0-beta')).toBe(-1);
        expect(compareVersions('1.0.0-beta', '1.0.0-rc')).toBe(-1);

        // Numeric comparison within same identifier
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe(-1);
        expect(compareVersions('1.0.0-rc.1', '1.0.0-rc.2')).toBe(-1);

        // Numeric vs alphabetic (numeric comes first)
        expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1);
        expect(compareVersions('1.0.0-2', '1.0.0-beta')).toBe(-1);
      });

      it('should handle complex prerelease hierarchies', () => {
        expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.1.1')).toBe(-1);
        expect(compareVersions('1.0.0-alpha.1.1', '1.0.0-alpha.2')).toBe(-1);
      });
    });

    describe('Prerelease update type detection', () => {
      it('should detect prerelease-to-prerelease updates', () => {
        expect(getUpdateType('1.0.0-alpha', '1.0.0-beta')).toBe('prerelease');
        expect(getUpdateType('1.0.0-alpha.1', '1.0.0-alpha.2')).toBe('prerelease');
        expect(getUpdateType('1.0.0-beta', '1.0.0-rc')).toBe('prerelease');
      });

      it('should detect prerelease-to-stable promotion', () => {
        expect(getUpdateType('1.0.0-alpha', '1.0.0')).toBe('prerelease');
        expect(getUpdateType('1.0.0-beta.1', '1.0.0')).toBe('prerelease');
        expect(getUpdateType('1.0.0-rc.1', '1.0.0')).toBe('prerelease');
      });

      it('should detect stable-to-prerelease demotion', () => {
        expect(getUpdateType('1.0.0', '1.0.0-alpha')).toBe('prerelease');
        expect(getUpdateType('2.0.0', '2.0.0-beta')).toBe('prerelease');
      });

      it('should prioritize version numbers over prerelease changes', () => {
        expect(getUpdateType('1.0.0-alpha', '2.0.0')).toBe('major');
        expect(getUpdateType('1.0.0-alpha', '1.1.0')).toBe('minor');
        expect(getUpdateType('1.0.0-alpha', '1.0.1')).toBe('patch');
      });
    });
  });

  describe('Invalid Version Handling', () => {
    describe('parseSemver invalid input handling', () => {
      it('should return null for clearly invalid versions', () => {
        expect(parseSemver('invalid')).toBeNull();
        expect(parseSemver('not-a-version')).toBeNull();
        expect(parseSemver('1.2')).toBeNull();
        expect(parseSemver('1.2.3.4')).toBeNull();
        expect(parseSemver('a.b.c')).toBeNull();
        expect(parseSemver('1.a.3')).toBeNull();
      });

      it('should return null for edge case invalid inputs', () => {
        expect(parseSemver('')).toBeNull();
        expect(parseSemver('   ')).toBeNull();
        expect(parseSemver(null as any)).toBeNull();
        expect(parseSemver(undefined as any)).toBeNull();
        expect(parseSemver(123 as any)).toBeNull();
        expect(parseSemver({} as any)).toBeNull();
      });

      it('should return null for malformed semver strings', () => {
        expect(parseSemver('1.2.3-')).toBeNull();
        expect(parseSemver('1.2.3+')).toBeNull();
        expect(parseSemver('1.2.3--alpha')).toBeNull();
        expect(parseSemver('1.2.3++build')).toBeNull();
        expect(parseSemver('01.2.3')).toBeNull(); // leading zeros
        expect(parseSemver('1.02.3')).toBeNull();
        expect(parseSemver('1.2.03')).toBeNull();
      });
    });

    describe('isPreRelease invalid input handling', () => {
      it('should return false for invalid versions', () => {
        expect(isPreRelease('invalid')).toBe(false);
        expect(isPreRelease('')).toBe(false);
        expect(isPreRelease('1.2')).toBe(false);
        expect(isPreRelease(null as any)).toBe(false);
        expect(isPreRelease(undefined as any)).toBe(false);
      });
    });

    describe('compareVersions invalid input handling', () => {
      it('should gracefully handle invalid versions by treating as 0.0.0', () => {
        expect(compareVersions('invalid', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', 'invalid')).toBe(1);
        expect(compareVersions('invalid', 'invalid')).toBe(0);
        expect(compareVersions('', '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', '')).toBe(1);
      });

      it('should handle null/undefined inputs gracefully', () => {
        expect(compareVersions(null as any, '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', null as any)).toBe(1);
        expect(compareVersions(undefined as any, '1.0.0')).toBe(-1);
        expect(compareVersions('1.0.0', undefined as any)).toBe(1);
      });
    });

    describe('getUpdateType invalid input handling', () => {
      it('should return "none" for invalid versions', () => {
        expect(getUpdateType('invalid', '1.0.0')).toBe('none');
        expect(getUpdateType('1.0.0', 'invalid')).toBe('none');
        expect(getUpdateType('invalid', 'invalid')).toBe('none');
        expect(getUpdateType('', '1.0.0')).toBe('none');
        expect(getUpdateType('1.0.0', '')).toBe('none');
      });
    });
  });

  describe('Comprehensive Integration Test', () => {
    it('should handle a realistic version progression scenario', () => {
      const versionSequence = [
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
        '1.1.1',
        '2.0.0-alpha',
        '2.0.0',
      ];

      // Verify all versions parse correctly
      for (const version of versionSequence) {
        const parsed = parseSemver(version);
        expect(parsed).not.toBeNull();
        expect(parsed!.raw).toBe(version);
      }

      // Verify prerelease identification
      const expectedPreReleases = [
        '0.2.0-alpha',
        '0.2.0-alpha.1',
        '0.2.0-beta',
        '0.2.0-rc.1',
        '1.0.0-alpha',
        '1.0.0-beta',
        '1.0.0-rc.1',
        '2.0.0-alpha',
      ];

      for (const version of versionSequence) {
        const expected = expectedPreReleases.includes(version);
        expect(isPreRelease(version)).toBe(expected);
      }

      // Verify version ordering
      for (let i = 0; i < versionSequence.length - 1; i++) {
        const current = versionSequence[i];
        const next = versionSequence[i + 1];
        expect(compareVersions(current, next)).toBe(-1);
        expect(compareVersions(next, current)).toBe(1);
      }

      // Verify update type detection for key transitions
      const expectedUpdates = [
        { from: '0.1.0', to: '0.1.1', type: 'patch' },
        { from: '0.1.1', to: '0.2.0-alpha', type: 'minor' },
        { from: '0.2.0-alpha', to: '0.2.0-alpha.1', type: 'prerelease' },
        { from: '0.2.0-rc.1', to: '0.2.0', type: 'prerelease' },
        { from: '0.2.1', to: '1.0.0-alpha', type: 'major' },
        { from: '1.0.0-rc.1', to: '1.0.0', type: 'prerelease' },
        { from: '1.0.0', to: '1.0.1', type: 'patch' },
        { from: '1.0.1', to: '1.1.0', type: 'minor' },
        { from: '1.1.1', to: '2.0.0-alpha', type: 'major' },
        { from: '2.0.0-alpha', to: '2.0.0', type: 'prerelease' },
      ];

      for (const { from, to, type } of expectedUpdates) {
        expect(getUpdateType(from, to)).toBe(type);
      }
    });

    it('should maintain consistency across all function interactions', () => {
      const testVersions = [
        '1.0.0',
        '1.0.0-alpha',
        '1.0.1',
        '1.1.0',
        '2.0.0',
        'v1.0.0',
        'invalid',
        '',
      ];

      for (const version1 of testVersions) {
        for (const version2 of testVersions) {
          const parsed1 = parseSemver(version1);
          const parsed2 = parseSemver(version2);
          const isPreRel1 = isPreRelease(version1);
          const isPreRel2 = isPreRelease(version2);
          const comparison = compareVersions(version1, version2);
          const updateType = getUpdateType(version1, version2);

          // Consistency checks
          if (parsed1 === null || parsed2 === null) {
            // If either version is invalid, update type should be 'none'
            expect(updateType).toBe('none');
          }

          if (version1 === version2) {
            expect(comparison).toBe(0);
            expect(updateType).toBe('none');
          }

          // If parsed successfully, prerelease detection should be consistent
          if (parsed1 !== null) {
            expect(isPreRel1).toBe(!!(parsed1.prerelease && parsed1.prerelease.length > 0));
          }
          if (parsed2 !== null) {
            expect(isPreRel2).toBe(!!(parsed2.prerelease && parsed2.prerelease.length > 0));
          }

          // Comparison should be symmetric
          if (comparison === 0) {
            expect(compareVersions(version2, version1)).toBe(0);
          } else if (comparison === 1) {
            expect(compareVersions(version2, version1)).toBe(-1);
          } else if (comparison === -1) {
            expect(compareVersions(version2, version1)).toBe(1);
          }
        }
      }
    });
  });
});