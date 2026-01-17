import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'yaml';

describe('Agent Prompt Quality and Completeness', () => {
  const verifyPath = join(process.cwd(), '.apex/agents/verify.md');
  const regressionPath = join(process.cwd(), '.apex/agents/regression-check.md');

  let verifyAgent: { metadata: any; content: string } | null = null;
  let regressionAgent: { metadata: any; content: string } | null = null;

  beforeEach(() => {
    if (existsSync(verifyPath)) {
      const content = readFileSync(verifyPath, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontMatterMatch) {
        verifyAgent = {
          metadata: yaml.parse(frontMatterMatch[1]),
          content: frontMatterMatch[2].trim()
        };
      }
    }

    if (existsSync(regressionPath)) {
      const content = readFileSync(regressionPath, 'utf-8');
      const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      if (frontMatterMatch) {
        regressionAgent = {
          metadata: yaml.parse(frontMatterMatch[1]),
          content: frontMatterMatch[2].trim()
        };
      }
    }
  });

  describe('Content Structure Quality', () => {
    it('should have proper markdown structure', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/^#+ /m); // Should have headers
        expect(verifyAgent.content).toMatch(/##/); // Should have level 2 headers
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/^#+ /m);
        expect(regressionAgent.content).toMatch(/##/);
      }
    });

    it('should have comprehensive section coverage', () => {
      const requiredSections = [
        'Role',
        'Process',
        'Success Criteria',
        'Failure Response',
        'Output Format'
      ];

      if (verifyAgent) {
        for (const section of requiredSections) {
          expect(verifyAgent.content).toMatch(new RegExp(section, 'i'));
        }
      }

      if (regressionAgent) {
        for (const section of requiredSections) {
          expect(regressionAgent.content).toMatch(new RegExp(section, 'i'));
        }
      }
    });

    it('should have adequate content length', () => {
      // Quality prompts should be substantial
      if (verifyAgent) {
        expect(verifyAgent.content.length).toBeGreaterThan(1000);
      }

      if (regressionAgent) {
        expect(regressionAgent.content.length).toBeGreaterThan(1500); // More complex
      }
    });
  });

  describe('TDD Context Integration', () => {
    it('should demonstrate deep TDD understanding', () => {
      const tddConcepts = [
        'test-driven development',
        'tdd',
        'failing tests',
        'red-green-refactor',
        'incremental'
      ];

      if (verifyAgent) {
        const lowerContent = verifyAgent.content.toLowerCase();
        let conceptCount = 0;
        for (const concept of tddConcepts) {
          if (lowerContent.includes(concept)) conceptCount++;
        }
        expect(conceptCount).toBeGreaterThanOrEqual(3);
      }

      if (regressionAgent) {
        const lowerContent = regressionAgent.content.toLowerCase();
        let conceptCount = 0;
        for (const concept of tddConcepts) {
          if (lowerContent.includes(concept)) conceptCount++;
        }
        expect(conceptCount).toBeGreaterThanOrEqual(3);
      }
    });

    it('should specify TDD workflow positioning', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/verify stage/i);
        expect(verifyAgent.content).toMatch(/after implementation/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/regression-check stage/i);
        expect(regressionAgent.content).toMatch(/after verify/i);
      }
    });

    it('should maintain TDD principles', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/minimal implementation/i);
        expect(verifyAgent.content).toMatch(/over-engineering/i);
        expect(verifyAgent.content).toMatch(/exactly what tests require/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/tdd cycle/i);
        expect(regressionAgent.content).toMatch(/refactor phase/i);
        expect(regressionAgent.content).toMatch(/incremental validation/i);
      }
    });
  });

  describe('Testing Focus and Coverage', () => {
    it('should cover comprehensive testing aspects', () => {
      const testingAspects = [
        'test execution',
        'test behavior',
        'edge cases',
        'error handling',
        'test coverage',
        'false positives'
      ];

      if (verifyAgent) {
        const lowerContent = verifyAgent.content.toLowerCase();
        let aspectCount = 0;
        for (const aspect of testingAspects) {
          if (lowerContent.includes(aspect)) aspectCount++;
        }
        expect(aspectCount).toBeGreaterThanOrEqual(4);
      }

      if (regressionAgent) {
        const lowerContent = regressionAgent.content.toLowerCase();
        let aspectCount = 0;
        for (const aspect of testingAspects) {
          if (lowerContent.includes(aspect)) aspectCount++;
        }
        expect(aspectCount).toBeGreaterThanOrEqual(4);
      }
    });

    it('should address different test types', () => {
      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/integration tests/i);
        expect(regressionAgent.content).toMatch(/end-to-end tests/i);
        expect(regressionAgent.content).toMatch(/performance tests/i);
        expect(regressionAgent.content).toMatch(/full test suite/i);
      }
    });

    it('should focus on quality over quantity', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/quality/i);
        expect(verifyAgent.content).toMatch(/acceptable/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/comprehensive/i);
        expect(regressionAgent.content).toMatch(/reliable/i);
      }
    });
  });

  describe('Error Handling and Feedback', () => {
    it('should provide clear failure procedures', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/failure response/i);
        expect(verifyAgent.content).toMatch(/clearly identify/i);
        expect(verifyAgent.content).toMatch(/actionable feedback/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/failure response/i);
        expect(regressionAgent.content).toMatch(/immediate feedback/i);
        expect(regressionAgent.content).toMatch(/detailed analysis/i);
      }
    });

    it('should specify what information to provide on failure', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/which tests are failing/i);
        expect(verifyAgent.content).toMatch(/gaps between implementation/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/specific failures/i);
        expect(regressionAgent.content).toMatch(/error messages/i);
        expect(regressionAgent.content).toMatch(/impact scope/i);
      }
    });

    it('should provide recovery guidance', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/developer/i);
        expect(verifyAgent.content).toMatch(/return to implementation/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/suggested fixes/i);
        expect(regressionAgent.content).toMatch(/rollback consideration/i);
      }
    });
  });

  describe('Output Format Specifications', () => {
    it('should define clear output structure', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/output format/i);
        expect(verifyAgent.content).toMatch(/test results/i);
        expect(verifyAgent.content).toMatch(/coverage analysis/i);
        expect(verifyAgent.content).toMatch(/recommendation/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/output format/i);
        expect(regressionAgent.content).toMatch(/test suite summary/i);
        expect(regressionAgent.content).toMatch(/regression details/i);
        expect(regressionAgent.content).toMatch(/performance impact/i);
      }
    });

    it('should include decision guidance', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/proceed or return/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/proceed, fix regressions, or rollback/i);
      }
    });
  });

  describe('Performance and Efficiency', () => {
    it('should emphasize efficiency', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/efficient verification/i);
        expect(verifyAgent.content).toMatch(/tdd momentum/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/workflow efficiency/i);
        expect(regressionAgent.content).toMatch(/development cycle fast/i);
      }
    });

    it('should balance thoroughness with speed', () => {
      if (verifyAgent) {
        expect(verifyAgent.content).toMatch(/thorough but efficient/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/comprehensive.*while.*efficient/i);
      }
    });
  });

  describe('Integration and System Considerations', () => {
    it('should consider system integration', () => {
      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/system integration/i);
        expect(regressionAgent.content).toMatch(/module interfaces/i);
        expect(regressionAgent.content).toMatch(/data flow/i);
        expect(regressionAgent.content).toMatch(/configuration compatibility/i);
      }
    });

    it('should address CI/CD considerations', () => {
      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/ci\/cd integration/i);
        expect(regressionAgent.content).toMatch(/deployment safety/i);
        expect(regressionAgent.content).toMatch(/continuous integration/i);
      }
    });

    it('should consider monitoring and documentation', () => {
      if (regressionAgent) {
        expect(regressionAgent.content).toMatch(/monitoring integration/i);
        expect(regressionAgent.content).toMatch(/documentation updates/i);
      }
    });
  });

  describe('Language Quality', () => {
    it('should use clear, professional language', () => {
      if (verifyAgent) {
        // Should not have typos or unclear phrasing
        expect(verifyAgent.content).not.toMatch(/\b(teh|hte|adn|nad)\b/i);
        // Should use active voice and clear instructions
        expect(verifyAgent.content).toMatch(/\b(verify|confirm|ensure|check)\b/i);
      }

      if (regressionAgent) {
        expect(regressionAgent.content).not.toMatch(/\b(teh|hte|adn|nad)\b/i);
        expect(regressionAgent.content).toMatch(/\b(run|execute|analyze|detect)\b/i);
      }
    });

    it('should use consistent terminology', () => {
      if (verifyAgent) {
        // Should consistently use "implementation" not mix with "code"
        const implCount = (verifyAgent.content.match(/implementation/gi) || []).length;
        expect(implCount).toBeGreaterThan(0);
      }

      if (regressionAgent) {
        const regressionCount = (regressionAgent.content.match(/regression/gi) || []).length;
        expect(regressionCount).toBeGreaterThan(3);
      }
    });
  });
});