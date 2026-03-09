/**
 * Test suite for v0.1.0 Agent Definitions Audit
 *
 * Verifies that the audit script correctly identifies the status
 * of all required agent definitions for v0.1.0 compliance.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { auditAllAgents, AuditSummary } from '../scripts/audit-agent-definitions';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('v0.1.0 Agent Definitions Audit', () => {
  let auditResults: AuditSummary;

  beforeAll(async () => {
    // Run the audit once for all tests
    auditResults = await auditAllAgents();
  }, 30000); // 30 second timeout for audit

  describe('Required Agents Presence', () => {
    const requiredAgents = ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'];
    const locations = ['.apex/agents', 'packages/core/templates/agents'];

    requiredAgents.forEach(agentName => {
      describe(`${agentName} agent`, () => {
        locations.forEach(location => {
          it(`should exist in ${location}`, () => {
            const result = auditResults.results.find(r =>
              r.agent === agentName && r.location === location
            );

            expect(result, `Agent ${agentName} should be audited in ${location}`).toBeDefined();
            expect(result?.exists, `Agent file ${agentName}.md should exist in ${location}`).toBe(true);
          });

          it(`should have valid YAML frontmatter in ${location}`, () => {
            const result = auditResults.results.find(r =>
              r.agent === agentName && r.location === location
            );

            expect(result?.hasValidYaml, `Agent ${agentName} should have valid YAML in ${location}`).toBe(true);
          });

          it(`should have real prompt content in ${location}`, () => {
            const result = auditResults.results.find(r =>
              r.agent === agentName && r.location === location
            );

            expect(result?.hasRealPrompt, `Agent ${agentName} should have real prompt in ${location}`).toBe(true);
          });

          it(`should have no errors in ${location}`, () => {
            const result = auditResults.results.find(r =>
              r.agent === agentName && r.location === location
            );

            expect(result?.errors, `Agent ${agentName} should have no errors in ${location}`).toEqual([]);
          });
        });
      });
    });
  });

  describe('Overall Audit Compliance', () => {
    it('should pass overall audit', () => {
      expect(auditResults.overallStatus).toBe('PASS');
    });

    it('should have 100% success rate', () => {
      const successRate = Math.round((auditResults.passedAgents / auditResults.totalAgents) * 100);
      expect(successRate).toBe(100);
    });

    it('should have all 12 agent files passing (6 agents × 2 locations)', () => {
      expect(auditResults.totalAgents).toBe(12);
      expect(auditResults.passedAgents).toBe(12);
      expect(auditResults.failedAgents).toBe(0);
    });

    it('should have no missing agents', () => {
      expect(auditResults.missingAgents).toEqual([]);
    });

    it('should have no synchronization issues', () => {
      expect(auditResults.syncIssues).toEqual([]);
    });
  });

  describe('File Content Validation', () => {
    const requiredAgents = ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'];

    requiredAgents.forEach(agentName => {
      it(`should have ${agentName} agent file accessible`, async () => {
        const locations = ['.apex/agents', 'packages/core/templates/agents'];

        for (const location of locations) {
          const filePath = path.join(location, `${agentName}.md`);
          try {
            await fs.access(filePath);
            // File exists, check basic content
            const content = await fs.readFile(filePath, 'utf8');

            expect(content).toContain('---'); // Has YAML frontmatter
            expect(content.length).toBeGreaterThan(200); // Has substantial content
            expect(content).toContain('name:'); // Has name field
            expect(content).toContain('description:'); // Has description field

            // Should not contain obvious stub indicators
            const stubIndicators = ['TODO', 'STUB', 'PLACEHOLDER', 'To be implemented'];
            const upperContent = content.toUpperCase();

            stubIndicators.forEach(indicator => {
              expect(upperContent.includes(indicator.toUpperCase())).toBe(false);
            });
          } catch (error) {
            throw new Error(`Agent file ${filePath} is not accessible: ${error}`);
          }
        }
      });
    });
  });

  describe('Schema Compliance', () => {
    it('should have all agent files passing schema validation', () => {
      const validResults = auditResults.results.filter(r => r.hasValidYaml);
      expect(validResults).toHaveLength(auditResults.totalAgents);
    });

    it('should have all agents with proper naming convention', () => {
      auditResults.results.forEach(result => {
        if (result.exists) {
          // Agent names should be lowercase with hyphens
          expect(result.agent).toMatch(/^[a-z0-9-]+$/);
          expect(result.agent.length).toBeGreaterThan(1);
          expect(result.agent.length).toBeLessThan(30);
        }
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete audit within reasonable time', () => {
      // This test implicitly passes if beforeAll completes within 30s timeout
      expect(auditResults).toBeDefined();
    });

    it('should provide comprehensive result data', () => {
      expect(auditResults.results).toHaveLength(12); // 6 agents × 2 locations
      expect(typeof auditResults.totalAgents).toBe('number');
      expect(typeof auditResults.passedAgents).toBe('number');
      expect(typeof auditResults.failedAgents).toBe('number');
      expect(['PASS', 'FAIL']).toContain(auditResults.overallStatus);
    });

    it('should handle edge cases gracefully', () => {
      // No null or undefined results
      auditResults.results.forEach(result => {
        expect(result.agent).toBeDefined();
        expect(result.location).toBeDefined();
        expect(typeof result.exists).toBe('boolean');
        expect(typeof result.hasValidYaml).toBe('boolean');
        expect(typeof result.hasRealPrompt).toBe('boolean');
        expect(Array.isArray(result.errors)).toBe(true);
      });
    });
  });

  describe('Audit Report Generation', () => {
    it('should generate comprehensive audit data for reporting', () => {
      // Verify all data needed for audit report is present
      expect(auditResults.overallStatus).toBeDefined();
      expect(auditResults.totalAgents).toBeGreaterThan(0);
      expect(auditResults.passedAgents).toBeGreaterThanOrEqual(0);
      expect(auditResults.failedAgents).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(auditResults.results)).toBe(true);
      expect(Array.isArray(auditResults.missingAgents)).toBe(true);
      expect(Array.isArray(auditResults.syncIssues)).toBe(true);
    });

    it('should provide actionable error information', () => {
      // Even if overall status is PASS, verify error structure is correct
      auditResults.results.forEach(result => {
        expect(Array.isArray(result.errors)).toBe(true);
        result.errors.forEach(error => {
          expect(typeof error).toBe('string');
          expect(error.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Integration with Build Process', () => {
    it('should be suitable for CI/CD integration', () => {
      // Should have deterministic results
      expect(auditResults.overallStatus).toBe('PASS');

      // Should provide clear pass/fail status
      expect(['PASS', 'FAIL']).toContain(auditResults.overallStatus);

      // Should have quantifiable metrics
      expect(typeof auditResults.passedAgents).toBe('number');
      expect(typeof auditResults.failedAgents).toBe('number');
    });
  });
});