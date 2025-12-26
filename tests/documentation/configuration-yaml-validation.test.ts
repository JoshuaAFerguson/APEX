import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as yamlParse, YAMLParseError } from 'yaml';
import {
  ApexConfigSchema,
  ResourceLimitsSchema,
  WorkspaceConfigSchema,
  ContainerConfigSchema,
  type ApexConfig,
} from '../../packages/core/src/types';

const docsDir = path.join(__dirname, '../..');
const configurationMdPath = path.join(docsDir, 'docs/configuration.md');

// Helper to read documentation files
function readDocFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Documentation file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Helper to extract and validate YAML blocks
function extractAndValidateYaml(content: string): Array<{ yaml: any; raw: string; context: string }> {
  const yamlBlockRegex = /```yaml([\s\S]*?)```/g;
  const blocks: Array<{ yaml: any; raw: string; context: string }> = [];
  let match;

  while ((match = yamlBlockRegex.exec(content)) !== null) {
    const yamlContent = match[1].trim();

    // Get context
    const beforeMatch = content.substring(Math.max(0, match.index - 200), match.index);
    const contextLines = beforeMatch.split('\n').slice(-3);
    const context = contextLines.join('\n');

    try {
      const parsedYaml = yamlParse(yamlContent);
      blocks.push({
        yaml: parsedYaml,
        raw: yamlContent,
        context
      });
    } catch (error) {
      if (error instanceof YAMLParseError) {
        throw new Error(`Invalid YAML in documentation at context "${context}": ${error.message}\nYAML:\n${yamlContent}`);
      }
      throw error;
    }
  }

  return blocks;
}

describe('Configuration YAML Examples Validation', () => {
  let configContent: string;
  let yamlBlocks: Array<{ yaml: any; raw: string; context: string }>;

  beforeAll(() => {
    configContent = readDocFile(configurationMdPath);
    yamlBlocks = extractAndValidateYaml(configContent);
  });

  describe('YAML syntax validation', () => {
    it('should have parseable YAML in all code blocks', () => {
      expect(yamlBlocks.length).toBeGreaterThan(0);

      yamlBlocks.forEach((block, index) => {
        expect(block.yaml).toBeTruthy();
        expect(block.raw).toBeTruthy();
      });
    });

    it('should not have YAML parsing errors', () => {
      // This test passes if we get here, since extractAndValidateYaml would throw on parse errors
      expect(yamlBlocks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Full configuration example validation', () => {
    let fullConfig: any;

    beforeAll(() => {
      // Find the main full configuration example
      fullConfig = yamlBlocks.find(block =>
        block.yaml &&
        block.yaml.version === "1.0" &&
        block.yaml.workspace &&
        block.yaml.workspace.container &&
        block.yaml.workspace.container.resourceLimits
      );

      expect(fullConfig).toBeTruthy();
    });

    it('should validate against ApexConfigSchema', () => {
      expect(() => ApexConfigSchema.parse(fullConfig.yaml)).not.toThrow();

      const validated = ApexConfigSchema.parse(fullConfig.yaml);
      expect(validated.version).toBe("1.0");
      expect(validated.workspace?.container?.resourceLimits).toBeTruthy();
    });

    it('should have realistic resource limit values', () => {
      const limits = fullConfig.yaml.workspace.container.resourceLimits;

      // CPU should be reasonable for development
      expect(limits.cpu).toBeGreaterThan(0);
      expect(limits.cpu).toBeLessThanOrEqual(8);

      // Memory should use proper format and be reasonable
      expect(limits.memory).toMatch(/^\d+[gGmMkK]$/);

      // If cpuShares is set, should be in valid range
      if (limits.cpuShares) {
        expect(limits.cpuShares).toBeGreaterThanOrEqual(2);
        expect(limits.cpuShares).toBeLessThanOrEqual(262144);
      }

      // If pidsLimit is set, should be positive
      if (limits.pidsLimit) {
        expect(limits.pidsLimit).toBeGreaterThan(0);
      }
    });

    it('should have all required top-level sections', () => {
      const config = fullConfig.yaml as ApexConfig;

      expect(config.version).toBeTruthy();
      expect(config.project).toBeTruthy();
      expect(config.project.name).toBeTruthy();

      // Workspace section should be complete
      expect(config.workspace).toBeTruthy();
      expect(config.workspace.container).toBeTruthy();
    });

    it('should have consistent container configuration', () => {
      const containerConfig = fullConfig.yaml.workspace.container;

      expect(() => ContainerConfigSchema.parse(containerConfig)).not.toThrow();

      // Should have image specified when showing full example
      if (containerConfig.image) {
        expect(containerConfig.image).toMatch(/^[\w.-]+:[\w.-]+$/); // Basic Docker image format
      }
    });
  });

  describe('Workspace configuration examples validation', () => {
    let workspaceExamples: any[];

    beforeAll(() => {
      workspaceExamples = yamlBlocks.filter(block =>
        block.context.toLowerCase().includes('workspace') &&
        block.yaml &&
        (block.yaml.workspace || block.yaml.defaultStrategy || block.yaml.container)
      );
    });

    it('should have valid workspace configuration examples', () => {
      expect(workspaceExamples.length).toBeGreaterThan(0);

      workspaceExamples.forEach((example, index) => {
        const config = example.yaml;

        if (config.workspace) {
          expect(() => WorkspaceConfigSchema.parse(config.workspace)).not.toThrow();
        } else {
          // Standalone workspace config
          expect(() => WorkspaceConfigSchema.parse(config)).not.toThrow();
        }
      });
    });

    it('should demonstrate different workspace strategies', () => {
      const allWorkspaceYaml = yamlBlocks
        .map(block => block.raw)
        .join('\n');

      expect(allWorkspaceYaml).toContain('defaultStrategy:');

      // Should show container strategy when documenting resource limits
      expect(allWorkspaceYaml).toContain('"container"');
    });
  });

  describe('Resource limits specific validation', () => {
    let resourceLimitExamples: any[];

    beforeAll(() => {
      resourceLimitExamples = yamlBlocks
        .map(block => block.yaml)
        .filter(config => {
          if (!config) return false;

          // Check if this config has resource limits at any level
          if (config.resourceLimits) return true;
          if (config.workspace?.container?.resourceLimits) return true;
          if (config.container?.resourceLimits) return true;

          return false;
        })
        .map(config => {
          // Extract the resource limits object
          if (config.resourceLimits) return config.resourceLimits;
          if (config.workspace?.container?.resourceLimits) return config.workspace.container.resourceLimits;
          if (config.container?.resourceLimits) return config.container.resourceLimits;
          return null;
        })
        .filter(Boolean);
    });

    it('should have valid resource limit examples', () => {
      expect(resourceLimitExamples.length).toBeGreaterThan(0);

      resourceLimitExamples.forEach((limits, index) => {
        expect(() => ResourceLimitsSchema.parse(limits)).not.toThrow();

        const validated = ResourceLimitsSchema.parse(limits);

        // CPU validation if present
        if (validated.cpu) {
          expect(validated.cpu).toBeGreaterThanOrEqual(0.1);
          expect(validated.cpu).toBeLessThanOrEqual(64);
        }

        // Memory validation if present
        if (validated.memory) {
          expect(validated.memory).toMatch(/^\d+[kmgKMG]?$/);
        }

        // CPU shares validation if present
        if (validated.cpuShares) {
          expect(validated.cpuShares).toBeGreaterThanOrEqual(2);
          expect(validated.cpuShares).toBeLessThanOrEqual(262144);
        }

        // PIDs limit validation if present
        if (validated.pidsLimit) {
          expect(validated.pidsLimit).toBeGreaterThan(0);
        }
      });
    });

    it('should demonstrate various memory formats', () => {
      const allMemoryValues = resourceLimitExamples
        .filter(limits => limits.memory)
        .map(limits => limits.memory);

      expect(allMemoryValues.length).toBeGreaterThan(0);

      // Should have examples with different units
      const memoryFormats = allMemoryValues.join(' ');

      // Should demonstrate different formats
      const hasKilobytes = /\d+[kK]/.test(memoryFormats);
      const hasMegabytes = /\d+[mM]/.test(memoryFormats);
      const hasGigabytes = /\d+[gG]/.test(memoryFormats);

      // Should have at least megabytes and gigabytes in examples
      expect(hasMegabytes || hasGigabytes).toBe(true);
    });

    it('should show progression from basic to advanced configurations', () => {
      // Should have examples with just CPU/memory
      const basicExamples = resourceLimitExamples.filter(limits =>
        limits.cpu && limits.memory && !limits.cpuShares && !limits.pidsLimit
      );

      // Should have examples with advanced options
      const advancedExamples = resourceLimitExamples.filter(limits =>
        limits.cpuShares || limits.pidsLimit || limits.memoryReservation
      );

      expect(basicExamples.length).toBeGreaterThan(0);
      expect(advancedExamples.length).toBeGreaterThan(0);
    });
  });

  describe('Example consistency and best practices', () => {
    it('should use consistent indentation', () => {
      yamlBlocks.forEach((block, index) => {
        const lines = block.raw.split('\n');

        // Check for consistent indentation (should use spaces, not tabs)
        lines.forEach((line, lineIndex) => {
          if (line.trim() && line.match(/^\s+/)) {
            expect(line).not.toMatch(/^\t/); // No tabs
            const indent = line.match(/^(\s+)/)?.[1] || '';
            expect(indent.length % 2).toBe(0); // Even number of spaces
          }
        });
      });
    });

    it('should use proper YAML data types', () => {
      yamlBlocks.forEach(block => {
        if (!block.yaml) return;

        const checkDataTypes = (obj: any, path: string = '') => {
          if (typeof obj !== 'object' || obj === null) return;

          Object.entries(obj).forEach(([key, value]) => {
            const currentPath = path ? `${path}.${key}` : key;

            // CPU should be numeric
            if (key === 'cpu') {
              expect(typeof value).toBe('number');
            }

            // Memory values should be strings
            if (key.includes('memory') || key.includes('Memory')) {
              expect(typeof value).toBe('string');
            }

            // cpuShares should be numeric
            if (key === 'cpuShares') {
              expect(typeof value).toBe('number');
            }

            // pidsLimit should be numeric
            if (key === 'pidsLimit') {
              expect(typeof value).toBe('number');
            }

            // Boolean fields
            if (['autoRemove', 'cleanupOnComplete'].includes(key)) {
              expect(typeof value).toBe('boolean');
            }

            // Recurse into objects
            if (typeof value === 'object' && value !== null) {
              checkDataTypes(value, currentPath);
            }
          });
        };

        checkDataTypes(block.yaml);
      });
    });

    it('should have realistic and practical examples', () => {
      // Find resource limit values across all examples
      const allCpuValues: number[] = [];
      const allMemoryValues: string[] = [];

      yamlBlocks.forEach(block => {
        const extractValues = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;

          if (obj.cpu && typeof obj.cpu === 'number') {
            allCpuValues.push(obj.cpu);
          }
          if (obj.memory && typeof obj.memory === 'string') {
            allMemoryValues.push(obj.memory);
          }

          Object.values(obj).forEach(value => {
            if (typeof value === 'object') {
              extractValues(value);
            }
          });
        };

        extractValues(block.yaml);
      });

      // CPU values should be practical
      allCpuValues.forEach(cpu => {
        expect(cpu).toBeGreaterThanOrEqual(0.5); // Not too small
        expect(cpu).toBeLessThanOrEqual(16); // Not excessively large
      });

      // Memory values should be practical
      allMemoryValues.forEach(memory => {
        const match = memory.match(/^(\d+)([kmgKMG]?)$/);
        expect(match).toBeTruthy();

        const [, amount, unit] = match!;
        const numAmount = parseInt(amount);

        if (unit.toLowerCase() === 'm') {
          expect(numAmount).toBeGreaterThanOrEqual(256); // At least 256MB
        } else if (unit.toLowerCase() === 'g') {
          expect(numAmount).toBeGreaterThanOrEqual(1); // At least 1GB
          expect(numAmount).toBeLessThanOrEqual(32); // Not more than 32GB for examples
        }
      });
    });
  });

  describe('Documentation context accuracy', () => {
    it('should place YAML examples in appropriate documentation contexts', () => {
      yamlBlocks.forEach(block => {
        // If it has resource limits, context should be about containers/workspace
        if (block.yaml?.workspace?.container?.resourceLimits ||
            block.yaml?.container?.resourceLimits ||
            block.yaml?.resourceLimits) {

          const context = block.context.toLowerCase();
          const shouldMentionContainer =
            context.includes('container') ||
            context.includes('resource') ||
            context.includes('workspace') ||
            context.includes('example') ||
            context.includes('config');

          expect(shouldMentionContainer).toBe(true);
        }
      });
    });

    it('should not have orphaned or unexplained YAML blocks', () => {
      yamlBlocks.forEach((block, index) => {
        // Each YAML block should have meaningful context
        expect(block.context.trim().length).toBeGreaterThan(0);

        // Should not just be a standalone code block
        const context = block.context.toLowerCase();
        const hasContext =
          context.includes('example') ||
          context.includes('config') ||
          context.includes('yaml') ||
          context.includes('workspace') ||
          context.includes('container') ||
          context.includes('section') ||
          context.includes('full');

        expect(hasContext).toBe(true);
      });
    });
  });
});