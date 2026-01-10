import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  loadConfig,
  saveConfig,
  initializeApex,
  getEffectiveConfig,
} from '../config';
import { ApexConfig, ToolAlias, ApexConfigSchema } from '../types';

describe('Tool Alias Configuration Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-alias-integration-'));
    await fs.mkdir(path.join(testDir, '.apex', 'tools'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Full Configuration Loading Integration', () => {
    it('should load complete configuration with aliases from both sources', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'integration-test-project',
          language: 'typescript',
          framework: 'nextjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        autonomy: {
          level: 'review-before-commit',
          limits: {
            maxCost: 5.0,
            maxTokens: 100000,
            maxTurns: 50,
            dailyBudget: 50.0,
            maxConcurrentTasks: 2,
          },
        },
        models: {
          planning: 'opus',
          implementation: 'sonnet',
          review: 'haiku',
        },
        aliases: [
          {
            name: 'quick-test',
            tool: 'Bash',
            description: 'Quick test runner',
            defaults: {
              command: 'npm test -- --quick',
            },
            enabled: true,
            tags: ['testing'],
            aliasParameters: [],
            requireConfirmation: false,
          },
          {
            name: 'shared-alias',
            tool: 'Read',
            description: 'Will be overridden by file',
            enabled: true,
            tags: ['config'],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      // Create multiple file-based aliases
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'search-tests.yaml'),
        `name: search-tests
tool: Grep
description: Search for test files
defaults:
  pattern: "describe\\\\(|it\\\\("
  output_mode: "content"
  glob: "**/*.test.{js,ts,jsx,tsx}"
enabled: true
tags:
  - testing
  - search
aliasParameters:
  - name: testType
    type: string
    description: Type of test to search for
    values: ["unit", "integration", "e2e"]
    default: "unit"
parameterTemplates:
  pattern: "{{testType}}.*{{query}}"
  glob: "**/*.test.{js,ts}"`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'shared-alias.yaml'),
        `name: shared-alias
tool: Grep
description: File version overrides config
defaults:
  pattern: ".*"
  output_mode: "files_with_matches"
enabled: false
tags:
  - file-based
  - overridden
timeout: 10000
requireConfirmation: true`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'build-check.yaml'),
        `name: build-check
tool: Bash
description: Check build status
defaults:
  command: "npm run build -- --check"
timeout: 30000
enabled: true
tags:
  - build
  - verification`
      );

      const loaded = await loadConfig(testDir);

      // Verify basic config loading still works
      expect(loaded.project.name).toBe('integration-test-project');
      expect(loaded.project.language).toBe('typescript');
      expect(loaded.project.framework).toBe('nextjs');
      expect(loaded.autonomy?.level).toBe('review-before-commit');
      expect(loaded.models?.planning).toBe('opus');

      // Verify aliases are loaded and merged correctly
      expect(loaded.aliases).toHaveLength(4); // 2 from config + 2 from files (shared-alias overridden)

      const quickTest = loaded.aliases!.find(a => a.name === 'quick-test');
      const searchTests = loaded.aliases!.find(a => a.name === 'search-tests');
      const sharedAlias = loaded.aliases!.find(a => a.name === 'shared-alias');
      const buildCheck = loaded.aliases!.find(a => a.name === 'build-check');

      // Config-based alias should be preserved
      expect(quickTest).toBeDefined();
      expect(quickTest!.tool).toBe('Bash');
      expect(quickTest!.description).toBe('Quick test runner');
      expect(quickTest!.tags).toEqual(['testing']);

      // File-based aliases should be loaded
      expect(searchTests).toBeDefined();
      expect(searchTests!.tool).toBe('Grep');
      expect(searchTests!.tags).toEqual(['testing', 'search']);
      expect(searchTests!.aliasParameters).toHaveLength(1);
      expect(searchTests!.parameterTemplates).toBeDefined();

      expect(buildCheck).toBeDefined();
      expect(buildCheck!.tool).toBe('Bash');
      expect(buildCheck!.timeout).toBe(30000);

      // File-based alias should override config-based one
      expect(sharedAlias).toBeDefined();
      expect(sharedAlias!.tool).toBe('Grep'); // File overrides config (was Read)
      expect(sharedAlias!.description).toBe('File version overrides config');
      expect(sharedAlias!.enabled).toBe(false); // File overrides config (was true)
      expect(sharedAlias!.tags).toEqual(['file-based', 'overridden']);
      expect(sharedAlias!.timeout).toBe(10000);
      expect(sharedAlias!.requireConfirmation).toBe(true);
    });

    it('should work with getEffectiveConfig after alias loading', async () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'effective-config-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'effective-test',
            tool: 'Read',
            description: 'Test effective config',
            enabled: true,
            tags: [],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, config);

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'effective-file.yaml'),
        `name: effective-file
tool: Write
description: File-based effective test
enabled: true`
      );

      const loaded = await loadConfig(testDir);
      const effective = getEffectiveConfig(loaded);

      // Verify that aliases are preserved in effective config
      expect(effective.aliases).toHaveLength(2);
      expect(effective.aliases.find(a => a.name === 'effective-test')).toBeDefined();
      expect(effective.aliases.find(a => a.name === 'effective-file')).toBeDefined();

      // Verify that other effective config processing still works
      expect(effective.autonomy.level).toBe('review-before-commit'); // default
      expect(effective.git.branchPrefix).toBe('apex/'); // default
      expect(effective.limits.maxTokensPerTask).toBe(500000); // default
    });

    it('should handle initializeApex with subsequent alias additions', async () => {
      await initializeApex(testDir, {
        projectName: 'initialized-project',
        language: 'typescript',
        framework: 'react',
      });

      const initialConfig = await loadConfig(testDir);
      expect(initialConfig.aliases).toEqual([]); // Should be empty initially

      // Add aliases to config file manually
      const updatedConfig = {
        ...initialConfig,
        aliases: [
          {
            name: 'added-later',
            tool: 'Read',
            description: 'Added after initialization',
            enabled: true,
            tags: [],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, updatedConfig);

      // Add file-based alias
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'file-added.yaml'),
        `name: file-added
tool: Grep
description: File-based alias added later
enabled: true`
      );

      const finalConfig = await loadConfig(testDir);

      expect(finalConfig.aliases).toHaveLength(2);
      expect(finalConfig.aliases!.find(a => a.name === 'added-later')).toBeDefined();
      expect(finalConfig.aliases!.find(a => a.name === 'file-added')).toBeDefined();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle development team workflow aliases', async () => {
      // Simulate a team development environment with comprehensive aliases
      const teamConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'team-project',
          language: 'typescript',
          framework: 'nestjs',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          // Team lead defines common aliases in config
          {
            name: 'team-lint',
            tool: 'Bash',
            description: 'Team linting standards',
            defaults: {
              command: 'npm run lint -- --fix',
            },
            enabled: true,
            tags: ['team', 'linting'],
            aliasParameters: [],
            requireConfirmation: false,
          },
        ],
      };

      await saveConfig(testDir, teamConfig);

      // Individual developers add their own file-based aliases
      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'api-search.yaml'),
        `name: api-search
tool: Grep
description: Search API endpoints
defaults:
  pattern: "@(Get|Post|Put|Delete)\\\\("
  output_mode: "content"
  glob: "src/**/*.controller.ts"
enabled: true
tags:
  - api
  - development
aliasParameters:
  - name: method
    type: string
    description: HTTP method to search for
    values: ["GET", "POST", "PUT", "DELETE"]
    default: "GET"
parameterTemplates:
  pattern: "@{{method}}\\\\("`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'test-coverage.yaml'),
        `name: test-coverage
tool: Bash
description: Run tests with coverage
defaults:
  command: "npm test -- --coverage --watchAll=false"
timeout: 60000
enabled: true
tags:
  - testing
  - coverage`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'tools', 'db-migrate.yaml'),
        `name: db-migrate
tool: Bash
description: Database migration helper
defaults:
  command: "npm run typeorm:run"
requireConfirmation: true
enabled: true
tags:
  - database
  - migration
aliasParameters:
  - name: direction
    type: string
    description: Migration direction
    values: ["up", "down"]
    default: "up"
  - name: steps
    type: number
    description: Number of migration steps
    default: 1
parameterTemplates:
  command: "npm run typeorm:{{direction}} -- --steps={{steps}}"`
      );

      const loaded = await loadConfig(testDir);

      expect(loaded.aliases).toHaveLength(4);

      // Team-wide alias from config
      const teamLint = loaded.aliases!.find(a => a.name === 'team-lint');
      expect(teamLint).toBeDefined();
      expect(teamLint!.tags).toEqual(['team', 'linting']);

      // Developer-specific aliases from files
      const apiSearch = loaded.aliases!.find(a => a.name === 'api-search');
      expect(apiSearch).toBeDefined();
      expect(apiSearch!.aliasParameters).toHaveLength(1);
      expect(apiSearch!.parameterTemplates!.pattern).toBe('@{{method}}\\(');

      const testCoverage = loaded.aliases!.find(a => a.name === 'test-coverage');
      expect(testCoverage).toBeDefined();
      expect(testCoverage!.timeout).toBe(60000);

      const dbMigrate = loaded.aliases!.find(a => a.name === 'db-migrate');
      expect(dbMigrate).toBeDefined();
      expect(dbMigrate!.requireConfirmation).toBe(true);
      expect(dbMigrate!.aliasParameters).toHaveLength(2);
    });

    it('should handle config schema validation with aliases', async () => {
      const validConfigWithAliases = {
        version: '1.0',
        project: {
          name: 'schema-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: [
          {
            name: 'valid-alias',
            tool: 'Read',
            description: 'Valid alias',
            enabled: true,
            tags: ['test'],
            aliasParameters: [
              {
                name: 'file',
                type: 'string',
                description: 'File to read',
                required: true,
              },
            ],
            requireConfirmation: false,
          },
        ],
      };

      // Should parse without errors
      const parsed = ApexConfigSchema.parse(validConfigWithAliases);
      expect(parsed.aliases).toHaveLength(1);
      expect(parsed.aliases![0].name).toBe('valid-alias');
      expect(parsed.aliases![0].aliasParameters![0].type).toBe('string');
    });

    it('should handle large configuration files with many aliases efficiently', async () => {
      const configAliases: ToolAlias[] = [];

      // Create config with many aliases
      for (let i = 0; i < 25; i++) {
        configAliases.push({
          name: `bulk-config-${i}`,
          tool: i % 2 === 0 ? 'Read' : 'Grep',
          description: `Bulk config alias ${i}`,
          enabled: true,
          tags: [`bulk`, `config-${i}`],
          aliasParameters: [],
          requireConfirmation: false,
        });
      }

      const bulkConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'bulk-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        aliases: configAliases,
      };

      await saveConfig(testDir, bulkConfig);

      // Create many file-based aliases
      for (let i = 0; i < 25; i++) {
        await fs.writeFile(
          path.join(testDir, '.apex', 'tools', `bulk-file-${i}.yaml`),
          `name: bulk-file-${i}
tool: ${i % 3 === 0 ? 'Bash' : i % 3 === 1 ? 'Write' : 'Glob'}
description: Bulk file alias ${i}
enabled: true
tags:
  - bulk
  - file-${i}`
        );
      }

      const startTime = Date.now();
      const loaded = await loadConfig(testDir);
      const loadTime = Date.now() - startTime;

      expect(loaded.aliases).toHaveLength(50); // 25 from config + 25 from files
      expect(loadTime).toBeLessThan(1000); // Should load within 1 second

      // Verify a few aliases from each source
      expect(loaded.aliases!.find(a => a.name === 'bulk-config-0')).toBeDefined();
      expect(loaded.aliases!.find(a => a.name === 'bulk-file-0')).toBeDefined();
      expect(loaded.aliases!.find(a => a.name === 'bulk-config-24')).toBeDefined();
      expect(loaded.aliases!.find(a => a.name === 'bulk-file-24')).toBeDefined();
    });
  });
});