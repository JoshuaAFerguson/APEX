import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ADR v0.3.0 Status Validation Tests
 *
 * These tests verify that the key ADR documents for v0.3.0 have been
 * properly updated to reflect implementation completion status.
 *
 * Key ADRs for v0.3.0:
 * - ADR-008: AgentPanel Test Coverage Improvement
 * - ADR-009: File Path Completion Integration Tests
 * - ADR-010: v0.3.0 Feature Development Technical Design
 */

describe('ADR v0.3.0 Status Validation', () => {
  const getAdrPath = (filename: string) => {
    // Try multiple possible locations for ADR documents
    const possiblePaths = [
      join(process.cwd(), 'docs/adr', filename),
      join(process.cwd(), 'packages/cli/docs/adr', filename),
      join(__dirname, '../../../docs/adr', filename),
      join(__dirname, '../../../../docs/adr', filename)
    ];

    for (const path of possiblePaths) {
      try {
        return { path, content: readFileSync(path, 'utf-8') };
      } catch {
        continue;
      }
    }

    throw new Error(`ADR file not found: ${filename}. Searched paths: ${possiblePaths.join(', ')}`);
  };

  describe('ADR-008: AgentPanel Test Coverage Improvement', () => {
    it('should have implemented status for v0.3.0 completion', () => {
      const { content, path } = getAdrPath('ADR-008-agentpanel-test-coverage-improvement.md');

      // Check that the status has been updated to reflect implementation
      expect(content).toMatch(/## Status\s*\n\s*(Implemented|**Implemented**)/i);

      // Should mention v0.3.0 completion
      expect(content.toLowerCase()).toContain('v0.3.0');
      expect(content.toLowerCase()).toContain('complete');

      // Should preserve historical information
      expect(content.toLowerCase()).toContain('december 2024');
    });

    it('should contain valid ADR structure with required sections', () => {
      const { content } = getAdrPath('ADR-008-agentpanel-test-coverage-improvement.md');

      // Check for required ADR sections
      expect(content).toMatch(/##\s*Status/i);
      expect(content).toMatch(/##\s*Date/i);
      expect(content).toMatch(/##\s*Context/i);
      expect(content).toMatch(/##\s*Decision/i);
    });

    it('should reference AgentPanel test coverage improvement content', () => {
      const { content } = getAdrPath('ADR-008-agentpanel-test-coverage-improvement.md');

      // Should contain content related to AgentPanel testing
      expect(content.toLowerCase()).toContain('agentpanel');
      expect(content.toLowerCase()).toContain('test');
      expect(content.toLowerCase()).toContain('coverage');
    });
  });

  describe('ADR-009: File Path Completion Integration Tests', () => {
    it('should have implemented status for v0.3.0 completion', () => {
      const { content } = getAdrPath('ADR-009-file-path-completion-integration-tests.md');

      // Check that the status has been updated to reflect implementation
      expect(content).toMatch(/\*\*Status\*\*:\s*(Implemented|Accepted)/i);

      // Should be marked as accepted/implemented
      const statusSection = content.match(/\*\*Status\*\*:\s*([^\n\r]*)/i);
      expect(statusSection?.[1]).toBeDefined();
    });

    it('should contain valid ADR structure with required sections', () => {
      const { content } = getAdrPath('ADR-009-file-path-completion-integration-tests.md');

      // Check for required ADR sections (alternative format)
      expect(content).toMatch(/\*\*Date\*\*/i);
      expect(content).toMatch(/\*\*Status\*\*/i);
      expect(content).toMatch(/##\s*Context/i);
      expect(content).toMatch(/##\s*Decision/i);
    });

    it('should reference file path completion integration content', () => {
      const { content } = getAdrPath('ADR-009-file-path-completion-integration-tests.md');

      // Should contain content related to file path completion
      expect(content.toLowerCase()).toContain('file path completion');
      expect(content.toLowerCase()).toContain('integration test');
      expect(content.toLowerCase()).toContain('completionengine');
    });
  });

  describe('ADR-010: v0.3.0 Feature Development Technical Design', () => {
    it('should have implemented status for v0.3.0 completion', () => {
      const { content } = getAdrPath('010-v030-feature-development-technical-design.md');

      // Check that the status has been updated to reflect implementation
      expect(content).toMatch(/##\s*Status\s*\n\s*\*\*Implemented\*\*/i);

      // Should mention v0.3.0 completion specifically
      expect(content).toContain('v0.3.0 Complete');
      expect(content).toContain('December 2024');

      // Should preserve historical status information
      expect(content).toContain('Previously:');
      expect(content.toLowerCase()).toContain('architecture stage');
    });

    it('should contain comprehensive v0.3.0 technical design content', () => {
      const { content } = getAdrPath('010-v030-feature-development-technical-design.md');

      // Should contain comprehensive technical design content
      expect(content.toLowerCase()).toContain('technical design');
      expect(content.toLowerCase()).toContain('v0.3.0');
      expect(content.toLowerCase()).toContain('claude code');
      expect(content.toLowerCase()).toContain('interactive experience');
    });

    it('should have proper ADR structure for comprehensive design doc', () => {
      const { content } = getAdrPath('010-v030-feature-development-technical-design.md');

      // Check for comprehensive ADR sections
      expect(content).toMatch(/##\s*Status/i);
      expect(content).toMatch(/##\s*Executive Summary/i);
      expect(content).toMatch(/##\s*.*Architecture Overview/i);
      expect(content).toMatch(/##\s*.*Implementation Status/i);
    });

    it('should reference completion of multiple architecture decisions', () => {
      const { content } = getAdrPath('010-v030-feature-development-technical-design.md');

      // Should reference multiple implemented features
      expect(content.toLowerCase()).toMatch(/(completed|implemented|✅)/);

      // Should contain references to implementation details
      expect(content.toLowerCase()).toContain('implementation');
    });
  });

  describe('Cross-ADR Consistency Validation', () => {
    it('should have consistent v0.3.0 completion timestamps across key ADRs', () => {
      const adr008 = getAdrPath('ADR-008-agentpanel-test-coverage-improvement.md');
      const adr009 = getAdrPath('ADR-009-file-path-completion-integration-tests.md');
      const adr010 = getAdrPath('010-v030-feature-development-technical-design.md');

      // All should reference December 2024 timeframe for v0.3.0
      [adr008.content, adr009.content, adr010.content].forEach((content, index) => {
        const adrNumber = ['008', '009', '010'][index];
        expect(content.toLowerCase(), `ADR-${adrNumber} should reference December 2024`).toContain('december 2024');
      });
    });

    it('should all reference v0.3.0 feature completion', () => {
      const adr008 = getAdrPath('ADR-008-agentpanel-test-coverage-improvement.md');
      const adr010 = getAdrPath('010-v030-feature-development-technical-design.md');

      // Core ADRs should reference v0.3.0
      [adr008.content, adr010.content].forEach((content, index) => {
        const adrNumber = ['008', '010'][index];
        expect(content.toLowerCase(), `ADR-${adrNumber} should reference v0.3.0`).toContain('v0.3.0');
      });
    });

    it('should have updated status fields indicating completion', () => {
      const adrs = [
        { file: 'ADR-008-agentpanel-test-coverage-improvement.md', name: 'ADR-008' },
        { file: 'ADR-009-file-path-completion-integration-tests.md', name: 'ADR-009' },
        { file: '010-v030-feature-development-technical-design.md', name: 'ADR-010' }
      ];

      adrs.forEach(({ file, name }) => {
        const { content } = getAdrPath(file);

        // Should have implementation-related status
        const hasImplementedStatus =
          content.toLowerCase().includes('implemented') ||
          content.toLowerCase().includes('accepted');

        expect(hasImplementedStatus,
          `${name} should have implemented or accepted status`).toBe(true);

        // Should not still be in proposed/draft state
        const isNotPending = !content.toLowerCase().match(/status[:\s]*proposed|status[:\s]*draft/i);
        expect(isNotPending,
          `${name} should not be in proposed/draft status`).toBe(true);
      });
    });
  });

  describe('Status Format Validation', () => {
    it('should follow consistent status format patterns', () => {
      // ADR-008: Check for "Status" + implementation indicator
      const adr008 = getAdrPath('ADR-008-agentpanel-test-coverage-improvement.md');
      expect(adr008.content).toMatch(/##\s*Status\s*\n\s*[A-Za-z\s\*\(\)]+/);

      // ADR-009: Check for "**Status**:" format
      const adr009 = getAdrPath('ADR-009-file-path-completion-integration-tests.md');
      expect(adr009.content).toMatch(/\*\*Status\*\*:\s*[A-Za-z\s]+/);

      // ADR-010: Check for "**Status**" with implementation details
      const adr010 = getAdrPath('010-v030-feature-development-technical-design.md');
      expect(adr010.content).toMatch(/##\s*Status\s*\n\s*\*\*Implemented\*\*/);
    });

    it('should maintain historical status information where applicable', () => {
      // ADR-010 should preserve "Previously:" historical information
      const adr010 = getAdrPath('010-v030-feature-development-technical-design.md');
      expect(adr010.content.toLowerCase()).toContain('previously:');

      // Should show status evolution
      expect(adr010.content.toLowerCase()).toMatch(/previously.*accepted.*architecture stage/i);
    });
  });

  describe('Date and Timestamp Validation', () => {
    it('should have valid date formats in ADR documents', () => {
      const adr009 = getAdrPath('ADR-009-file-path-completion-integration-tests.md');

      // Should have proper date format
      expect(adr009.content).toMatch(/\*\*Date\*\*:\s*December\s+\d{1,2},\s*2024/);
    });

    it('should reference December 2024 completion timeframe', () => {
      const adrs = [
        'ADR-008-agentpanel-test-coverage-improvement.md',
        'ADR-009-file-path-completion-integration-tests.md',
        '010-v030-feature-development-technical-design.md'
      ];

      adrs.forEach(file => {
        const { content } = getAdrPath(file);
        expect(content.toLowerCase()).toMatch(/december\s+2024/);
      });
    });
  });
});