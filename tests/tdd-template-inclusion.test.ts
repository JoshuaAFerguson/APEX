/**
 * Tests to verify TDD developer agent template is properly included in the core package
 *
 * This test file validates that:
 * - TDD developer agent template exists in the core package templates
 * - Template content is correct and complete
 * - Template is accessible during project initialization
 * - Template integrates properly with the TDD workflow template
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('TDD Developer Agent Template Inclusion Tests', () => {
  const templatePath = path.join(process.cwd(), 'packages', 'core', 'templates', 'agents', 'tdd-developer.md');
  const workflowTemplatePath = path.join(process.cwd(), 'packages', 'core', 'templates', 'workflows', 'tdd.yaml');

  describe('Template File Existence', () => {
    it('should have TDD developer agent template in core package', async () => {
      const templateExists = await fs.stat(templatePath).then(() => true).catch(() => false);
      expect(templateExists).toBe(true);
    });

    it('should have TDD workflow template in core package', async () => {
      const workflowExists = await fs.stat(workflowTemplatePath).then(() => true).catch(() => false);
      expect(workflowExists).toBe(true);
    });

    it('should have readable template files', async () => {
      // Should be able to read the template file
      const templateContent = await fs.readFile(templatePath, 'utf-8');
      expect(templateContent.length).toBeGreaterThan(100);

      const workflowContent = await fs.readFile(workflowTemplatePath, 'utf-8');
      expect(workflowContent.length).toBeGreaterThan(50);
    });
  });

  describe('Template Content Validation', () => {
    it('should have correct YAML frontmatter', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should start with YAML frontmatter
      expect(content).toMatch(/^---\n/);

      // Should have required metadata fields
      expect(content).toContain('name: tdd-developer');
      expect(content).toContain('description:');
      expect(content).toContain('tools:');
      expect(content).toContain('model:');

      // Should end frontmatter
      expect(content).toMatch(/---\n[\s\S]/);
    });

    it('should contain core TDD implementation guidance', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Core TDD concepts
      expect(content).toContain('TDD');
      expect(content).toContain('Red-Green-Refactor');
      expect(content).toContain('Green phase');
      expect(content).toContain('minimal');
      expect(content).toContain('implement');

      // Should have substantial content
      expect(content.length).toBeGreaterThan(3000);
    });

    it('should specify appropriate tools for implementation', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should include development tools
      expect(content).toContain('Read');
      expect(content).toContain('Write');
      expect(content).toContain('Edit');
      expect(content).toContain('MultiEdit');
      expect(content).toContain('Bash');
      expect(content).toContain('Grep');
      expect(content).toContain('Glob');
    });

    it('should use appropriate model for complex TDD tasks', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should use a capable model
      expect(content).toContain('model: sonnet');
    });
  });

  describe('Workflow Integration', () => {
    it('should be referenced in TDD workflow template', async () => {
      const workflowContent = await fs.readFile(workflowTemplatePath, 'utf-8');

      // Should reference tdd-developer agent
      expect(workflowContent).toContain('agent: tdd-developer');
    });

    it('should be assigned to implement stage', async () => {
      const workflowContent = await fs.readFile(workflowTemplatePath, 'utf-8');

      // Should find implement stage with tdd-developer
      const implementStagePattern = /name:\s*implement[\s\S]*?agent:\s*tdd-developer/;
      expect(workflowContent).toMatch(implementStagePattern);
    });

    it('should align with workflow stage description', async () => {
      const workflowContent = await fs.readFile(workflowTemplatePath, 'utf-8');

      // Implement stage should mention minimal code and Green phase
      expect(workflowContent).toContain('minimal code');
      expect(workflowContent).toContain('Green phase');
    });
  });

  describe('Template Structure and Quality', () => {
    it('should have well-structured markdown content', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have markdown headers
      expect(content).toMatch(/^##\s+/gm);

      // Should have lists
      expect(content).toMatch(/^-\s+/gm);
      expect(content).toMatch(/^\d+\.\s+/gm);

      // Should have emphasis
      expect(content).toMatch(/\*\*.*\*\*/g);
      expect(content).toMatch(/\*.*\*/g);
    });

    it('should include code examples', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have code blocks or examples
      expect(content).toMatch(/```[\s\S]*?```|`[^`]+`/g);
    });

    it('should have consistent formatting', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should not have inconsistent spacing
      expect(content).not.toMatch(/\n\n\n\n/); // No excessive line breaks
      expect(content).not.toMatch(/  \n/); // No trailing spaces

      // Should have consistent list formatting
      const lines = content.split('\n');
      const listLines = lines.filter(line => line.match(/^-\s+/));
      listLines.forEach(line => {
        expect(line).toMatch(/^- [A-Z*]/); // Should start with capital or formatting
      });
    });
  });

  describe('Content Completeness', () => {
    it('should cover all critical TDD implementation aspects', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      const criticalAspects = [
        'MINIMAL IMPLEMENTATION',
        'IMPLEMENT STAGE WORKFLOW',
        'TDD IMPLEMENTATION PATTERNS',
        'ANTI-PATTERNS',
        'SUCCESS CRITERIA',
        'RED-GREEN-REFACTOR CYCLE'
      ];

      criticalAspects.forEach(aspect => {
        expect(content.toUpperCase()).toContain(aspect);
      });
    });

    it('should include TDD patterns with examples', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      const patterns = [
        'Fake It Till You Make It',
        'Triangulation',
        'Obvious Implementation'
      ];

      patterns.forEach(pattern => {
        expect(content).toContain(pattern);
      });
    });

    it('should warn against common anti-patterns', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      const antiPatterns = [
        'OVER-ENGINEERING',
        'FUTURE-PROOFING',
        'PERFECTIONIST CODING'
      ];

      antiPatterns.forEach(pattern => {
        expect(content).toContain(pattern);
      });
    });
  });

  describe('Template Metadata Validation', () => {
    it('should have correct agent name matching filename', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Name should match filename (without extension)
      expect(content).toContain('name: tdd-developer');
    });

    it('should have descriptive agent description', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should clearly describe the agent's role
      const descriptionMatch = content.match(/description:\s*(.+)/);
      expect(descriptionMatch).toBeTruthy();

      if (descriptionMatch) {
        const description = descriptionMatch[1];
        expect(description.toLowerCase()).toContain('tdd');
        expect(description.toLowerCase()).toContain('implement');
        expect(description.toLowerCase()).toContain('minimal');
      }
    });

    it('should specify complete tool set for development', async () => {
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should have complete toolset
      const toolsMatch = content.match(/tools:\s*(.+)/);
      expect(toolsMatch).toBeTruthy();

      if (toolsMatch) {
        const tools = toolsMatch[1];
        expect(tools).toContain('Read');
        expect(tools).toContain('Write');
        expect(tools).toContain('Edit');
        expect(tools).toContain('MultiEdit');
        expect(tools).toContain('Bash');
        expect(tools).toContain('Grep');
        expect(tools).toContain('Glob');
      }
    });
  });

  describe('Template Accessibility', () => {
    it('should be in the correct templates directory structure', async () => {
      const expectedPath = path.join('packages', 'core', 'templates', 'agents', 'tdd-developer.md');
      const normalizedPath = templatePath.replace(process.cwd(), '').replace(/^\//, '').replace(/\\/g, '/');

      expect(normalizedPath).toBe(expectedPath);
    });

    it('should be accessible for project initialization', async () => {
      // Check if the template directory structure is correct
      const templatesDir = path.join(process.cwd(), 'packages', 'core', 'templates');
      const agentsDir = path.join(templatesDir, 'agents');
      const workflowsDir = path.join(templatesDir, 'workflows');

      const templatesDirExists = await fs.stat(templatesDir).then(() => true).catch(() => false);
      const agentsDirExists = await fs.stat(agentsDir).then(() => true).catch(() => false);
      const workflowsDirExists = await fs.stat(workflowsDir).then(() => true).catch(() => false);

      expect(templatesDirExists).toBe(true);
      expect(agentsDirExists).toBe(true);
      expect(workflowsDirExists).toBe(true);
    });

    it('should be valid UTF-8 encoded text', async () => {
      // Should be able to read without encoding issues
      const content = await fs.readFile(templatePath, 'utf-8');

      // Should not have encoding artifacts
      expect(content).not.toContain('\uFFFD'); // Replacement character
      expect(content).not.toMatch(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/); // Control characters

      // Should be valid text
      expect(typeof content).toBe('string');
      expect(content.length).toBeGreaterThan(0);
    });
  });
});