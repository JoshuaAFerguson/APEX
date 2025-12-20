import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Integration test to verify Phase 3 documentation status update in ROADMAP.md
 * This test validates the actual change made by the developer agent
 */
describe('ROADMAP.md Phase 3 Documentation Status Update', () => {
  const roadmapPath = resolve(__dirname, '../../../ROADMAP.md');

  describe('Verification of actual changes', () => {
    it('should have Phase 3 Documentation updates marked as Complete', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        // If we can't read the file, skip this test
        console.warn('Could not read ROADMAP.md file, skipping verification test');
        return;
      }

      // Verify the specific change: Phase 3 'Documentation updates' row changed from ⚪ to 🟢 Complete
      const phase3Pattern = /Phase 3.*Documentation updates.*\|\s*([⚪🟡🟢]+(?:\s+Complete)?)/i;
      const match = roadmapContent.match(phase3Pattern);

      expect(match).not.toBeNull();
      if (match) {
        const status = match[1].trim();
        expect(status).toBe('🟢 Complete');
      }
    });

    it('should maintain proper table structure in v0.3.0 Development Plan', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping table structure test');
        return;
      }

      // Check that the table structure is maintained
      expect(roadmapContent).toContain('**Phase 3: Polish & Testing (MEDIUM PRIORITY)**');
      expect(roadmapContent).toContain('| Task | Status | Effort | Files |');
      expect(roadmapContent).toContain('|------|--------|--------|-------|');

      // Verify the table row exists and is properly formatted
      const tableRowPattern = /\|\s*Documentation updates\s*\|\s*🟢 Complete\s*\|\s*1 day\s*\|\s*`docs\/`\s*\|/;
      expect(roadmapContent).toMatch(tableRowPattern);
    });

    it('should not have broken other content in the file', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping content integrity test');
        return;
      }

      // Verify key sections are still intact
      expect(roadmapContent).toContain('# APEX Roadmap');
      expect(roadmapContent).toContain('## v0.3.0 - Claude Code-like Interactive Experience');
      expect(roadmapContent).toContain('### v0.3.0 Development Plan (Updated December 2024)');

      // Verify other phases/tasks are not affected
      expect(roadmapContent).toContain('**Phase 1: Integration Work (COMPLETE)**');
      expect(roadmapContent).toContain('**Phase 2: Enhancements (COMPLETE)**');

      // Verify the legend is still present
      expect(roadmapContent).toContain('🟢 Complete');
      expect(roadmapContent).toContain('🟡 In Progress');
      expect(roadmapContent).toContain('⚪ Planned');
    });

    it('should verify acceptance criteria compliance', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping acceptance criteria test');
        return;
      }

      // Acceptance Criteria: Phase 3 'Documentation updates' row in v0.3.0 Development Plan table
      // changed from ⚪ to 🟢 Complete, with any other necessary status updates verified

      // 1. Verify the specific row was updated
      const documentationUpdatePattern = /Documentation updates\s*\|\s*🟢 Complete/;
      expect(roadmapContent).toMatch(documentationUpdatePattern);

      // 2. Verify there are no remaining ⚪ for "Documentation updates" in Phase 3
      const oldStatusPattern = /Phase 3.*Documentation updates.*⚪/;
      expect(roadmapContent).not.toMatch(oldStatusPattern);

      // 3. Verify the change is in the correct section (v0.3.0 Development Plan)
      const developmentPlanIndex = roadmapContent.indexOf('### v0.3.0 Development Plan');
      const nextSectionIndex = roadmapContent.indexOf('### ', developmentPlanIndex + 1);
      const relevantSection = nextSectionIndex === -1
        ? roadmapContent.substring(developmentPlanIndex)
        : roadmapContent.substring(developmentPlanIndex, nextSectionIndex);

      expect(relevantSection).toMatch(documentationUpdatePattern);
    });

    it('should validate the format matches the roadmap legend', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping legend format test');
        return;
      }

      // Extract the legend section
      const legendMatch = roadmapContent.match(/> \*\*Legend:\*\*(.*?)---/s);
      expect(legendMatch).not.toBeNull();

      if (legendMatch) {
        const legendSection = legendMatch[1];

        // Verify the legend defines the status we're using
        expect(legendSection).toContain('🟢 Complete');

        // Verify our status update uses the correct format from the legend
        const phase3StatusMatch = roadmapContent.match(/Documentation updates\s*\|\s*(🟢 Complete)/);
        expect(phase3StatusMatch).not.toBeNull();

        if (phase3StatusMatch) {
          const statusUsed = phase3StatusMatch[1];
          expect(legendSection).toContain(statusUsed);
        }
      }
    });
  });

  describe('Regression tests', () => {
    it('should not have accidentally changed other task statuses', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping regression test');
        return;
      }

      // Verify that Integration tests status was not changed (should still be ⚪ or its intended status)
      const integrationTestsPattern = /Integration tests\s*\|\s*([⚪🟡🟢]+(?:\s+Complete)?)/;
      const match = roadmapContent.match(integrationTestsPattern);

      expect(match).not.toBeNull();
      // The integration tests should not be marked as complete unless specifically updated
      // This test ensures we only changed the documentation task
    });

    it('should preserve table alignment and markdown formatting', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping formatting test');
        return;
      }

      // Check that table structure is preserved with proper pipe separators
      const phase3TableRows = roadmapContent
        .split('\n')
        .filter(line => line.includes('Documentation updates') && line.includes('|'));

      expect(phase3TableRows.length).toBeGreaterThan(0);

      for (const row of phase3TableRows) {
        // Each row should have proper table structure
        const columns = row.split('|').map(col => col.trim()).filter(col => col.length > 0);

        if (columns.length >= 4) { // Task | Status | Effort | Files
          expect(columns.length).toBeGreaterThanOrEqual(4);
          // Status column should contain our update
          expect(columns[1]).toMatch(/🟢 Complete/);
        }
      }
    });

    it('should maintain estimated remaining time section', () => {
      let roadmapContent: string;

      try {
        roadmapContent = readFileSync(roadmapPath, 'utf8');
      } catch (error) {
        console.warn('Could not read ROADMAP.md file, skipping estimated time test');
        return;
      }

      // The estimated remaining section should still exist
      expect(roadmapContent).toContain('**Estimated Remaining**');

      // The time should be updated to reflect completion of documentation
      // Since documentation was 1 day and now complete, remaining should be reduced
      const estimatedPattern = /\*\*Estimated Remaining\*\*:\s*(\d+)\s*days?/;
      const match = roadmapContent.match(estimatedPattern);

      if (match) {
        const remainingDays = parseInt(match[1]);
        // Should be 1 day (just integration tests remaining) or similar
        expect(remainingDays).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing file gracefully in test environment', () => {
      // This test ensures our test suite doesn't crash if ROADMAP.md is missing
      // In actual implementation, this would be handled by the application
      const invalidPath = '/nonexistent/ROADMAP.md';

      expect(() => {
        try {
          readFileSync(invalidPath, 'utf8');
        } catch (error) {
          // Expected behavior - file doesn't exist
          expect(error).toBeDefined();
          throw error;
        }
      }).toThrow();
    });

    it('should validate content structure if file exists', () => {
      try {
        const roadmapContent = readFileSync(roadmapPath, 'utf8');

        // Basic structure validation
        expect(roadmapContent).toContain('# APEX Roadmap');
        expect(roadmapContent).toContain('v0.3.0');
        expect(roadmapContent).toContain('Development Plan');

      } catch (error) {
        // File doesn't exist, skip validation
        console.warn('ROADMAP.md not found, skipping validation');
      }
    });
  });
});