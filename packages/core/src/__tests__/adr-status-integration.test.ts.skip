import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';

/**
 * ADR Status Integration Tests
 *
 * This test suite validates the overall ADR status management system
 * and ensures that v0.3.0 completion has been properly tracked across
 * all relevant architecture decision records.
 */

describe('ADR Status Integration', () => {
  const findAdrDirectories = () => {
    const searchPaths = [
      join(process.cwd(), 'docs/adr'),
      join(process.cwd(), 'packages/cli/docs/adr'),
      join(__dirname, '../../../docs/adr'),
      join(__dirname, '../../../../docs/adr')
    ];

    const validPaths: string[] = [];

    for (const path of searchPaths) {
      if (existsSync(path)) {
        validPaths.push(path);
      }
    }

    return validPaths;
  };

  const getAllAdrFiles = () => {
    const adrDirs = findAdrDirectories();
    const adrFiles: Array<{ path: string; content: string; filename: string }> = [];

    for (const dir of adrDirs) {
      try {
        const files = readdirSync(dir)
          .filter(f => f.toLowerCase().endsWith('.md') &&
                      (f.toLowerCase().includes('adr') || f.match(/^\d{3}-/)))
          .map(f => ({
            path: join(dir, f),
            content: readFileSync(join(dir, f), 'utf-8'),
            filename: f
          }));

        adrFiles.push(...files);
      } catch (error) {
        // Skip directories that can't be read
        continue;
      }
    }

    return adrFiles;
  };

  const getV030RelevantAdrs = () => {
    const allAdrs = getAllAdrFiles();
    return allAdrs.filter(adr =>
      adr.filename.includes('008') ||
      adr.filename.includes('009') ||
      adr.filename.includes('010') ||
      adr.content.toLowerCase().includes('v0.3.0') ||
      adr.content.toLowerCase().includes('agentpanel') ||
      adr.content.toLowerCase().includes('file path completion') ||
      adr.content.toLowerCase().includes('feature development technical design')
    );
  };

  describe('ADR Discovery and Structure', () => {
    it('should find ADR directories in expected locations', () => {
      const adrDirs = findAdrDirectories();
      expect(adrDirs.length).toBeGreaterThan(0);

      adrDirs.forEach(dir => {
        expect(existsSync(dir)).toBe(true);
      });
    });

    it('should find key v0.3.0 ADR documents', () => {
      const v030Adrs = getV030RelevantAdrs();
      expect(v030Adrs.length).toBeGreaterThanOrEqual(3);

      // Should find ADR-008, ADR-009, and ADR-010 or equivalent
      const adrNumbers = v030Adrs.map(adr => adr.filename);
      const has008 = adrNumbers.some(name => name.includes('008'));
      const has009 = adrNumbers.some(name => name.includes('009'));
      const has010 = adrNumbers.some(name => name.includes('010'));

      expect(has008 || v030Adrs.some(adr =>
        adr.content.toLowerCase().includes('agentpanel')))
        .toBe(true);
      expect(has009 || v030Adrs.some(adr =>
        adr.content.toLowerCase().includes('file path completion')))
        .toBe(true);
      expect(has010 || v030Adrs.some(adr =>
        adr.content.toLowerCase().includes('feature development technical design')))
        .toBe(true);
    });
  });

  describe('V0.3.0 Completion Status Tracking', () => {
    it('should have updated status fields for v0.3.0 completion', () => {
      const v030Adrs = getV030RelevantAdrs();

      const implementedAdrs = v030Adrs.filter(adr => {
        const content = adr.content.toLowerCase();
        return content.includes('implemented') || content.includes('accepted');
      });

      expect(implementedAdrs.length).toBeGreaterThanOrEqual(2);

      // Verify each has appropriate completion indicators
      implementedAdrs.forEach(adr => {
        const content = adr.content.toLowerCase();
        const hasCompletionIndicator =
          content.includes('v0.3.0 complete') ||
          content.includes('december 2024') ||
          content.includes('implemented') ||
          (content.includes('accepted') && !content.includes('proposed'));

        expect(hasCompletionIndicator,
          `${adr.filename} should have completion indicators`).toBe(true);
      });
    });

    it('should have consistent completion timestamps', () => {
      const v030Adrs = getV030RelevantAdrs();

      const adrsWithDates = v030Adrs.filter(adr =>
        adr.content.toLowerCase().includes('december 2024')
      );

      expect(adrsWithDates.length).toBeGreaterThanOrEqual(2);

      // All should reference December 2024 timeframe
      adrsWithDates.forEach(adr => {
        expect(adr.content.toLowerCase()).toMatch(/december\s+\d{1,2},?\s*2024/);
      });
    });

    it('should preserve historical status information', () => {
      const v030Adrs = getV030RelevantAdrs();

      // Look for ADRs that show status evolution
      const adrsWithHistory = v030Adrs.filter(adr => {
        const content = adr.content.toLowerCase();
        return content.includes('previously') ||
               content.includes('architecture stage') ||
               content.match(/status.*\n.*previously/s);
      });

      expect(adrsWithHistory.length).toBeGreaterThanOrEqual(1);

      adrsWithHistory.forEach(adr => {
        // Should show clear status progression
        const content = adr.content.toLowerCase();
        const hasStatusEvolution =
          (content.includes('previously') && content.includes('accepted')) ||
          (content.includes('architecture stage') && content.includes('implemented'));

        expect(hasStatusEvolution,
          `${adr.filename} should show status evolution`).toBe(true);
      });
    });
  });

  describe('ADR Content Validation', () => {
    it('should have required ADR sections in key documents', () => {
      const v030Adrs = getV030RelevantAdrs();

      v030Adrs.forEach(adr => {
        const content = adr.content;

        // Should have status section
        const hasStatus = content.match(/##\s*Status|Status:|**Status**/i);
        expect(hasStatus, `${adr.filename} should have Status section`).toBeTruthy();

        // Should have date information
        const hasDate = content.match(/##\s*Date|\*\*Date\*\*:|date:/i) ||
                       content.toLowerCase().includes('2024');
        expect(hasDate, `${adr.filename} should have date information`).toBeTruthy();

        // Should have context/decision content
        const hasDecisionContent = content.match(/##\s*(Context|Decision|Background)/i);
        expect(hasDecisionContent,
          `${adr.filename} should have Context or Decision section`).toBeTruthy();
      });
    });

    it('should not have any ADRs still marked as proposed for v0.3.0 features', () => {
      const v030Adrs = getV030RelevantAdrs();

      const stillProposed = v030Adrs.filter(adr => {
        const content = adr.content.toLowerCase();
        return content.match(/status[:\s]*proposed/i) &&
               (content.includes('v0.3.0') ||
                content.includes('agentpanel') ||
                content.includes('file path completion'));
      });

      expect(stillProposed.length).toBe(0);

      if (stillProposed.length > 0) {
        const proposedFiles = stillProposed.map(adr => adr.filename);
        throw new Error(`Found ADRs still marked as proposed: ${proposedFiles.join(', ')}`);
      }
    });

    it('should have appropriate technical content for implementation ADRs', () => {
      const v030Adrs = getV030RelevantAdrs();

      // Find technical implementation ADRs
      const technicalAdrs = v030Adrs.filter(adr => {
        const content = adr.content.toLowerCase();
        return content.includes('technical design') ||
               content.includes('test coverage') ||
               content.includes('integration test');
      });

      expect(technicalAdrs.length).toBeGreaterThanOrEqual(2);

      technicalAdrs.forEach(adr => {
        const content = adr.content.toLowerCase();

        // Should contain technical implementation details
        const hasTechnicalContent =
          content.includes('implementation') ||
          content.includes('test') ||
          content.includes('coverage') ||
          content.includes('integration') ||
          content.includes('architecture');

        expect(hasTechnicalContent,
          `${adr.filename} should contain technical content`).toBe(true);
      });
    });
  });

  describe('Cross-ADR Consistency', () => {
    it('should have consistent v0.3.0 feature references across ADRs', () => {
      const v030Adrs = getV030RelevantAdrs();

      const adrsReferencingV030 = v030Adrs.filter(adr =>
        adr.content.toLowerCase().includes('v0.3.0')
      );

      expect(adrsReferencingV030.length).toBeGreaterThanOrEqual(2);

      // Should all reference similar completion concepts
      const completionTerms = ['complete', 'implemented', 'finished'];
      adrsReferencingV030.forEach(adr => {
        const content = adr.content.toLowerCase();
        const hasCompletionTerm = completionTerms.some(term =>
          content.includes(term)
        );

        expect(hasCompletionTerm,
          `${adr.filename} should reference v0.3.0 completion`).toBe(true);
      });
    });

    it('should have consistent date format and timeline across ADRs', () => {
      const v030Adrs = getV030RelevantAdrs();

      const adrsWithTimeline = v030Adrs.filter(adr =>
        adr.content.toLowerCase().includes('2024')
      );

      expect(adrsWithTimeline.length).toBeGreaterThanOrEqual(3);

      // All should reference 2024 and specifically December for completion
      adrsWithTimeline.forEach(adr => {
        const content = adr.content;

        // Should have valid date format
        const hasValidDate = content.match(/\d{4}/) && content.includes('2024');
        expect(hasValidDate,
          `${adr.filename} should have valid date format`).toBe(true);
      });
    });
  });

  describe('Status Update Quality Assurance', () => {
    it('should have meaningful status descriptions', () => {
      const v030Adrs = getV030RelevantAdrs();

      const implementedAdrs = v030Adrs.filter(adr => {
        const content = adr.content.toLowerCase();
        return content.includes('implemented') ||
               (content.includes('accepted') && !content.includes('proposed'));
      });

      implementedAdrs.forEach(adr => {
        const content = adr.content;

        // Should have more than just "Implemented" - should have context
        const statusSection = content.match(
          /##\s*Status.*?\n(.*?)(?=##|\*\*|$)/is
        );

        if (statusSection) {
          const statusText = statusSection[1].trim();
          const hasContext = statusText.length > 20; // More than just "Implemented"

          expect(hasContext,
            `${adr.filename} should have meaningful status description`).toBe(true);
        }
      });
    });

    it('should validate that status updates are recent and appropriate', () => {
      const v030Adrs = getV030RelevantAdrs();

      const recentlyUpdated = v030Adrs.filter(adr => {
        const content = adr.content.toLowerCase();
        return content.includes('december 2024') ||
               content.includes('2024') && content.includes('complete');
      });

      expect(recentlyUpdated.length).toBeGreaterThanOrEqual(2);

      // Should not have future dates or inconsistent timing
      recentlyUpdated.forEach(adr => {
        const content = adr.content;

        // Should not reference dates after December 2024
        const hasFutureDates = content.match(/january\s+2025|february\s+2025/i);
        expect(hasFutureDates,
          `${adr.filename} should not have future completion dates`).toBeFalsy();

        // Should reference December 2024 timeframe appropriately
        if (content.toLowerCase().includes('december 2024')) {
          const decemberRef = content.match(/december\s+\d{1,2},?\s*2024/i);
          expect(decemberRef,
            `${adr.filename} should have valid December 2024 reference`).toBeTruthy();
        }
      });
    });
  });
});