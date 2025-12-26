import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parse as yamlParse } from 'yaml';
import {
  ApexConfigSchema,
  ResourceLimitsSchema,
  WorkspaceConfigSchema,
  ContainerConfigSchema,
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

// Helper to extract YAML code blocks from markdown
function extractYamlBlocks(content: string): Array<{ yaml: string; context: string }> {
  const yamlBlockRegex = /```yaml([\s\S]*?)```/g;
  const blocks: Array<{ yaml: string; context: string }> = [];
  let match;

  while ((match = yamlBlockRegex.exec(content)) !== null) {
    // Get surrounding context to understand what the YAML block is for
    const beforeMatch = content.substring(Math.max(0, match.index - 200), match.index);
    const contextLines = beforeMatch.split('\n').slice(-3);
    const context = contextLines.join('\n');

    blocks.push({
      yaml: match[1].trim(),
      context
    });
  }

  return blocks;
}

// Helper to extract CLI command examples
function extractCliExamples(content: string): string[] {
  const cliRegex = /apex run.*?(?:\n|$)/g;
  const examples: string[] = [];
  let match;

  while ((match = cliRegex.exec(content)) !== null) {
    examples.push(match[0].trim());
  }

  return examples;
}

describe('Container Resource Limits Documentation Tests', () => {
  let configContent: string;

  beforeAll(() => {
    configContent = readDocFile(configurationMdPath);
  });

  describe('Documentation file structure', () => {
    it('should exist and be readable', () => {
      expect(configContent).toBeTruthy();
      expect(configContent.length).toBeGreaterThan(0);
    });

    it('should contain required container resource limits sections', () => {
      const requiredSections = [
        '#### Container Resource Limits',
        '#### Container Configuration',
        '#### Per-Task Resource Overrides'
      ];

      requiredSections.forEach(section => {
        expect(configContent).toContain(section);
      });
    });

    it('should contain workspace isolation configuration section', () => {
      expect(configContent).toContain('### workspace');
      expect(configContent).toContain('Workspace isolation configuration');
    });
  });

  describe('Resource limits documentation content', () => {
    it('should document all resource limit fields with correct ranges', () => {
      const resourceLimitsSection = configContent.match(
        /#### Container Resource Limits([\s\S]*?)#### Container Configuration/
      );
      expect(resourceLimitsSection).toBeTruthy();

      const content = resourceLimitsSection![1];

      // Check all resource limit fields are documented
      const expectedFields = [
        { field: 'cpu', range: '0.1-64', description: 'CPU limit in cores' },
        { field: 'memory', description: 'Memory limit with unit' },
        { field: 'memoryReservation', description: 'Memory reservation' },
        { field: 'memorySwap', description: 'Maximum memory swap' },
        { field: 'cpuShares', range: '2-262144', description: 'CPU shares for relative weighting' },
        { field: 'pidsLimit', range: '1+', description: 'Maximum number of processes' }
      ];

      expectedFields.forEach(({ field, range, description }) => {
        expect(content).toContain(field);
        expect(content).toContain(description);
        if (range) {
          expect(content).toContain(range);
        }
      });
    });

    it('should document memory unit suffixes correctly', () => {
      expect(configContent).toContain('Memory Units');
      expect(configContent).toContain('k/K (kilobytes)');
      expect(configContent).toContain('m/M (megabytes)');
      expect(configContent).toContain('g/G (gigabytes)');
    });

    it('should contain examples for all resource limit options', () => {
      const yamlBlocks = extractYamlBlocks(configContent);

      // Find the main configuration example
      const mainExample = yamlBlocks.find(block =>
        block.yaml.includes('resourceLimits:') &&
        block.yaml.includes('cpu:') &&
        block.yaml.includes('memory:')
      );

      expect(mainExample).toBeTruthy();
      expect(mainExample!.yaml).toContain('cpu: 2');
      expect(mainExample!.yaml).toContain('memory: "4g"');
      expect(mainExample!.yaml).toContain('memoryReservation: "2g"');
      expect(mainExample!.yaml).toContain('cpuShares: 1024');
      expect(mainExample!.yaml).toContain('pidsLimit: 1000');
    });
  });

  describe('YAML configuration examples validation', () => {
    it('should have valid main configuration example that parses correctly', () => {
      const yamlBlocks = extractYamlBlocks(configContent);

      // Find the full configuration example at the top
      const mainConfig = yamlBlocks.find(block =>
        block.yaml.includes('version: "1.0"') &&
        block.yaml.includes('workspace:') &&
        block.yaml.includes('resourceLimits:')
      );

      expect(mainConfig).toBeTruthy();

      // Parse the YAML
      const parsedConfig = yamlParse(mainConfig!.yaml);
      expect(parsedConfig).toBeTruthy();

      // Validate against schema
      expect(() => ApexConfigSchema.parse(parsedConfig)).not.toThrow();

      const validatedConfig = ApexConfigSchema.parse(parsedConfig);
      expect(validatedConfig.workspace?.container?.resourceLimits).toBeTruthy();
    });

    it('should have valid workspace configuration example', () => {
      const yamlBlocks = extractYamlBlocks(configContent);

      // Find workspace-specific example
      const workspaceExample = yamlBlocks.find(block =>
        block.context.includes('workspace:') &&
        block.yaml.includes('container:') &&
        block.yaml.includes('resourceLimits:')
      );

      expect(workspaceExample).toBeTruthy();

      const parsedWorkspace = yamlParse(workspaceExample!.yaml);
      expect(() => WorkspaceConfigSchema.parse(parsedWorkspace)).not.toThrow();
    });

    it('should validate individual resource limits examples', () => {
      // Test that the documented resource limit values are valid
      const documentedLimits = {
        cpu: 2,
        memory: "4g",
        memoryReservation: "2g",
        cpuShares: 1024,
        pidsLimit: 1000
      };

      expect(() => ResourceLimitsSchema.parse(documentedLimits)).not.toThrow();

      const parsed = ResourceLimitsSchema.parse(documentedLimits);
      expect(parsed.cpu).toBe(2);
      expect(parsed.memory).toBe("4g");
      expect(parsed.cpuShares).toBe(1024);
      expect(parsed.pidsLimit).toBe(1000);
    });

    it('should validate memory format examples in documentation', () => {
      const configSection = configContent.match(/Memory Units.*?(?=\*\*|####)/s);
      expect(configSection).toBeTruthy();

      // Extract memory format examples
      const memoryExamples = ['256m', '1g', '2048m'];

      memoryExamples.forEach(example => {
        expect(() => ResourceLimitsSchema.parse({ memory: example })).not.toThrow();
      });
    });
  });

  describe('Per-task override examples', () => {
    it('should document CLI override options accurately', () => {
      const cliExamples = extractCliExamples(configContent);
      expect(cliExamples.length).toBeGreaterThan(0);

      // Find the CLI override example
      const cliOverrideExample = cliExamples.find(cmd =>
        cmd.includes('--container-cpu') && cmd.includes('--container-memory')
      );

      expect(cliOverrideExample).toBeTruthy();
      expect(cliOverrideExample).toContain('--workspace-strategy container');
      expect(cliOverrideExample).toContain('--container-cpu 4');
      expect(cliOverrideExample).toContain('--container-memory "8g"');
    });

    it('should list all available override options', () => {
      const overrideSection = configContent.match(
        /\*\*Available Override Options\*\*:([\s\S]*?)## Environment Variables/
      );
      expect(overrideSection).toBeTruthy();

      const expectedOptions = [
        '--workspace-strategy',
        '--container-cpu',
        '--container-memory',
        '--container-memory-reservation',
        '--container-cpu-shares',
        '--container-pids-limit'
      ];

      expectedOptions.forEach(option => {
        expect(overrideSection![1]).toContain(option);
      });
    });

    it('should show programmatic override example with valid JSON structure', () => {
      // Find the JSON programmatic override example
      const jsonMatch = configContent.match(/```(?:json)?\s*\{[\s\S]*?"workspace"[\s\S]*?\}/);
      expect(jsonMatch).toBeTruthy();

      const jsonString = jsonMatch![0].replace(/```(?:json)?/, '').replace(/```/, '').trim();
      const parsedJson = JSON.parse(jsonString);

      expect(parsedJson.workspace).toBeTruthy();
      expect(parsedJson.workspace.strategy).toBe('container');
      expect(parsedJson.workspace.container.resourceLimits).toBeTruthy();
    });
  });

  describe('Field descriptions and ranges accuracy', () => {
    it('should accurately document CPU field constraints', () => {
      expect(configContent).toContain('0.1-64');
      expect(configContent).toContain('CPU limit in cores');
      expect(configContent).toContain('half core');
    });

    it('should accurately document CPU shares constraints', () => {
      expect(configContent).toContain('2-262144');
      expect(configContent).toContain('1024 = 1 share');
      expect(configContent).toContain('relative weighting');
    });

    it('should accurately document pids limit constraints', () => {
      expect(configContent).toContain('1+');
      expect(configContent).toContain('Maximum number of processes allowed');
    });

    it('should match actual schema validation constraints', () => {
      // Test that documented ranges match actual schema constraints

      // CPU minimum and maximum
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.1 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 64 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.05 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpu: 65 })).toThrow();

      // CPU shares minimum and maximum
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 2 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262144 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();

      // PIDs minimum
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 1 })).not.toThrow();
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();
    });
  });

  describe('Integration with existing documentation', () => {
    it('should integrate properly within workspace section', () => {
      const workspaceMatch = configContent.match(/### workspace([\s\S]*?)### limits/);
      expect(workspaceMatch).toBeTruthy();

      const workspaceSection = workspaceMatch![1];
      expect(workspaceSection).toContain('Container Resource Limits');
      expect(workspaceSection).toContain('Per-Task Resource Overrides');
    });

    it('should reference container strategies appropriately', () => {
      expect(configContent).toContain('#### Workspace Strategies');
      expect(configContent).toContain('`container`');
      expect(configContent).toContain('Full environment isolation');
    });

    it('should maintain consistent formatting with rest of documentation', () => {
      // Check for consistent table formatting
      const tableMatches = configContent.match(/\| Field \| Type \| Range \| Description \|/g);
      expect(tableMatches?.length).toBeGreaterThan(0);

      // Check for consistent code block formatting
      const yamlBlocks = extractYamlBlocks(configContent);
      expect(yamlBlocks.length).toBeGreaterThan(0);

      yamlBlocks.forEach(block => {
        expect(block.yaml).not.toMatch(/^\s*$/); // Not empty
        expect(block.yaml.split('\n').length).toBeGreaterThan(1); // Multi-line
      });
    });
  });

  describe('Example completeness and accuracy', () => {
    it('should show realistic resource limit combinations', () => {
      const yamlBlocks = extractYamlBlocks(configContent);
      const mainExample = yamlBlocks.find(block => block.yaml.includes('resourceLimits:'));

      expect(mainExample).toBeTruthy();
      const config = yamlParse(mainExample!.yaml) as any;

      // Resource limits should be realistic for development
      const limits = config.workspace.container.resourceLimits;
      expect(limits.cpu).toBeGreaterThanOrEqual(1);
      expect(limits.cpu).toBeLessThanOrEqual(8);

      // Memory should be in reasonable range
      expect(limits.memory).toMatch(/^[1-9]\d*[gG]$/);
    });

    it('should show practical CLI override examples', () => {
      const cliExamples = extractCliExamples(configContent);
      const overrideExample = cliExamples.find(cmd => cmd.includes('--container-cpu'));

      expect(overrideExample).toBeTruthy();

      // Should use realistic values
      expect(overrideExample).toMatch(/--container-cpu \d+/);
      expect(overrideExample).toMatch(/--container-memory "\d+g"/);
    });

    it('should demonstrate common use cases', () => {
      // Should mention development vs production scenarios
      expect(configContent).toContain('development');

      // Should show both minimal and resource-intensive configurations
      const allYamlContent = extractYamlBlocks(configContent)
        .map(block => block.yaml)
        .join('\n');

      // Should have examples with different CPU amounts
      expect(allYamlContent).toMatch(/cpu:\s*[12]/);  // Low CPU examples
      expect(allYamlContent).toMatch(/cpu:\s*[48]/);  // Higher CPU examples
    });
  });

  describe('Documentation completeness', () => {
    it('should cover all acceptance criteria requirements', () => {
      // README or docs include example .apex/config.yaml with workspace.container.resourceLimits section
      expect(configContent).toContain('.apex/config.yaml');
      expect(configContent).toContain('workspace.container.resourceLimits');

      // Explanation of per-task overrides
      expect(configContent).toContain('Per-Task Resource Overrides');
      expect(configContent).toContain('Individual tasks can override');

      // Available limit options
      const allResourceFields = ['cpu', 'memory', 'memoryReservation', 'memorySwap', 'cpuShares', 'pidsLimit'];
      allResourceFields.forEach(field => {
        expect(configContent).toContain(field);
      });
    });

    it('should provide helpful context and explanations', () => {
      expect(configContent).toContain('Resource limits control');
      expect(configContent).toContain('containerized tasks');
      expect(configContent).toContain('Support standard suffixes');
      expect(configContent).toContain('relative weighting');
    });

    it('should include usage guidance', () => {
      expect(configContent).toContain('Use Case');
      expect(configContent).toContain('environment isolation');
      expect(configContent).toContain('CLI override example');
      expect(configContent).toContain('Programmatic override');
    });
  });
});