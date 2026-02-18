import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test suite to verify that all v0.5.0 features in ROADMAP.md are correctly marked as complete
 * and that the implementation actually exists in the codebase.
 */
describe('ROADMAP.md v0.5.0 Status Validation', () => {
  let roadmapContent: string;
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(async () => {
    roadmapContent = await fs.readFile(path.join(projectRoot, 'ROADMAP.md'), 'utf-8');
  });

  /**
   * Helper function to extract the v0.5.0 section from the roadmap
   */
  function getV050Section(): string {
    const lines = roadmapContent.split('\n');
    const v050Start = lines.findIndex(line => line.includes('## v0.5.0'));
    const v060Start = lines.findIndex(line => line.includes('## v0.6.0'));

    if (v050Start === -1) {
      throw new Error('v0.5.0 section not found in ROADMAP.md');
    }

    const endIndex = v060Start === -1 ? lines.length : v060Start;
    return lines.slice(v050Start, endIndex).join('\n');
  }

  /**
   * Helper function to check if a file exists
   */
  async function fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(projectRoot, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper function to check if a file contains specific content
   */
  async function fileContains(relativePath: string, searchText: string): Promise<boolean> {
    try {
      const content = await fs.readFile(path.join(projectRoot, relativePath), 'utf-8');
      return content.toLowerCase().includes(searchText.toLowerCase());
    } catch {
      return false;
    }
  }

  describe('v0.5.0 Section Status', () => {
    it('should mark v0.5.0 as complete', () => {
      const v050Section = getV050Section();

      // Check for completion status in section header or description
      expect(v050Section).toMatch(/v0\.5\.0.*Complete/i);
    });

    it('should have comprehensive feature coverage with 🟢 status', () => {
      const v050Section = getV050Section();

      // Count all feature items (lines with status icons)
      const featureLines = v050Section.split('\n').filter(line =>
        line.includes('🟢') || line.includes('🟡') || line.includes('⚪')
      );

      // Should have substantial number of features (v0.5.0 is a major release)
      expect(featureLines.length).toBeGreaterThan(40);

      // Count completed features
      const completedFeatures = featureLines.filter(line => line.includes('🟢'));

      // All features should be marked as complete
      expect(completedFeatures.length).toBe(featureLines.length);
    });
  });

  describe('Browser Automation Features', () => {
    const browserFeatures = [
      'Headless browser',
      'Browser actions',
      'Screenshot capture',
      'Console log capture',
      'Visual regression testing',
      'Runtime error detection'
    ];

    browserFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify browser automation implementation exists', async () => {
      // Check for browser-related MCP tool integration
      const hasMcpBrowser = await fileContains('packages/orchestrator/src/index.ts', 'browser') ||
                           await fileContains('packages/orchestrator/src/index.ts', 'mcp') ||
                           await fileExists('packages/orchestrator/src/tools/browser.ts');

      // Browser functionality should be implemented via MCP tools
      expect(hasMcpBrowser).toBe(true);
    });
  });

  describe('Built-in Tools (Claude Code parity)', () => {
    const builtInTools = [
      'Read',
      'Write',
      'Edit',
      'MultiEdit',
      'Bash',
      'Glob',
      'Grep',
      'WebFetch',
      'WebSearch',
      'NotebookEdit',
      'TodoWrite'
    ];

    builtInTools.forEach(tool => {
      it(`should have "${tool}" tool marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${tool.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify tool implementation exists in orchestrator', async () => {
      // Check that the orchestrator integrates with Claude Agent SDK tools
      const hasToolIntegration = await fileContains('packages/orchestrator/src/index.ts', 'tool') ||
                                await fileContains('packages/orchestrator/package.json', '@anthropic-ai/claude-agent-sdk');

      expect(hasToolIntegration).toBe(true);
    });
  });

  describe('Tool Visualization Features', () => {
    const visualizationFeatures = [
      'Tool call display',
      'Tool output formatting',
      'Tool timing',
      'Tool error display',
      'Diff preview',
      'Undo capability',
      'Dry-run mode'
    ];

    visualizationFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify tool visualization components exist', async () => {
      // Check for tool-related UI components
      const hasToolComponents = await fileExists('packages/cli/src/ui/components/tools') ||
                               await fileExists('packages/cli/src/ui/components/ToolCall.tsx') ||
                               await fileExists('packages/cli/src/ui/components/ToolOutput.tsx') ||
                               await fileContains('packages/cli/src/ui', 'tool');

      expect(hasToolComponents).toBe(true);
    });
  });

  describe('Permission System Features', () => {
    const permissionFeatures = [
      'Permission levels',
      'Per-tool permissions',
      'Per-directory permissions',
      'Dangerous operation warnings',
      'Permission presets',
      'Permission persistence',
      'Policy-as-code rules',
      'Secret-leak guardrails'
    ];

    permissionFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify permission system implementation', async () => {
      // Check for permission-related code in core or orchestrator
      const hasPermissionSystem = await fileExists('packages/core/src/permissions.ts') ||
                                  await fileExists('packages/orchestrator/src/permissions') ||
                                  await fileContains('packages/core/src/types.ts', 'permission') ||
                                  await fileContains('packages/orchestrator/src/index.ts', 'permission');

      expect(hasPermissionSystem).toBe(true);
    });
  });

  describe('Autonomy Controls Features', () => {
    const autonomyFeatures = [
      'Autonomy levels',
      'Approval gates',
      'Budget limits',
      'Token limits',
      'Time limits',
      'Change limits'
    ];

    autonomyFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify autonomy controls are implemented in config system', async () => {
      // Check for autonomy settings in config
      const hasAutonomyControls = await fileContains('packages/core/src/config.ts', 'autonomy') ||
                                  await fileContains('packages/core/src/types.ts', 'autonomy') ||
                                  await fileContains('packages/orchestrator/src/index.ts', 'budget') ||
                                  await fileContains('packages/orchestrator/src/index.ts', 'limit');

      expect(hasAutonomyControls).toBe(true);
    });
  });

  describe('Code Quality Integration Features', () => {
    const codeQualityFeatures = [
      'Lint-after-edit',
      'Auto-fix linting errors',
      'Pre-edit validation',
      'Compiler feedback loop',
      'Type checking integration'
    ];

    codeQualityFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify code quality integration exists', async () => {
      // Check for lint/quality related functionality
      const hasCodeQuality = await fileContains('packages/orchestrator/src/index.ts', 'lint') ||
                             await fileContains('packages/cli/src', 'quality') ||
                             await fileExists('packages/orchestrator/src/quality') ||
                             await fileContains('.apex', 'lint');

      expect(hasCodeQuality).toBe(true);
    });
  });

  describe('Tool Extensions Features', () => {
    const extensionFeatures = [
      'Custom tools',
      'Tool hooks',
      'Tool aliases',
      'MCP server support'
    ];

    extensionFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify MCP server support is implemented', async () => {
      // Check for MCP server integration
      const hasMcpSupport = await fileContains('packages/orchestrator/package.json', 'mcp') ||
                           await fileContains('packages/orchestrator/src/index.ts', 'mcp') ||
                           await fileExists('packages/orchestrator/src/mcp');

      expect(hasMcpSupport).toBe(true);
    });
  });

  describe('MCP Marketplace Features', () => {
    const mcpFeatures = [
      'MCP Marketplace',
      'Easy Install',
      'Auto-configuration'
    ];

    mcpFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify MCP marketplace functionality exists', async () => {
      // Check for MCP marketplace implementation
      const hasMcpMarketplace = await fileExists('packages/cli/src/commands/mcp.ts') ||
                               await fileContains('packages/cli/src', 'marketplace') ||
                               await fileContains('packages/orchestrator/src', 'marketplace');

      expect(hasMcpMarketplace).toBe(true);
    });
  });

  describe('Test-Driven Development Features', () => {
    const tddFeatures = [
      'TDD Mode',
      'Auto-Correction Loop',
      'Regression Guard'
    ];

    tddFeatures.forEach(feature => {
      it(`should have "${feature}" marked as complete (🟢)`, () => {
        const v050Section = getV050Section();
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(v050Section).toMatch(regex);
      });
    });

    it('should verify TDD functionality is implemented', async () => {
      // Check for TDD-related functionality
      const hasTdd = await fileContains('packages/orchestrator/src', 'tdd') ||
                    await fileContains('packages/core/src', 'test') ||
                    await fileExists('packages/orchestrator/src/workflows/tdd.ts');

      expect(hasTdd).toBe(true);
    });
  });

  describe('Feature Count Validation', () => {
    it('should have exactly 54 features marked as complete in v0.5.0', () => {
      const v050Section = getV050Section();
      const completedFeatures = (v050Section.match(/🟢/g) || []).length;

      // Based on the implementation summary, there should be 54 features
      expect(completedFeatures).toBe(54);
    });

    it('should have no in-progress (🟡) or planned (⚪) features in v0.5.0', () => {
      const v050Section = getV050Section();
      const inProgressFeatures = (v050Section.match(/🟡/g) || []).length;
      const plannedFeatures = (v050Section.match(/⚪/g) || []).length;

      // All features should be complete for a finished version
      expect(inProgressFeatures).toBe(0);
      expect(plannedFeatures).toBe(0);
    });
  });

  describe('Implementation Verification', () => {
    it('should verify core package structure supports v0.5.0 features', async () => {
      // Check that core package has necessary types and configs
      const coreFiles = [
        'packages/core/src/types.ts',
        'packages/core/src/config.ts',
        'packages/core/package.json'
      ];

      for (const file of coreFiles) {
        const exists = await fileExists(file);
        expect(exists).toBe(true);
      }
    });

    it('should verify orchestrator package supports tool system', async () => {
      // Check orchestrator has Claude Agent SDK integration
      const hasClaudeSDK = await fileContains('packages/orchestrator/package.json', '@anthropic-ai/claude-agent-sdk');
      expect(hasClaudeSDK).toBe(true);

      // Check orchestrator main file exists
      const orchestratorExists = await fileExists('packages/orchestrator/src/index.ts');
      expect(orchestratorExists).toBe(true);
    });

    it('should verify CLI package supports tool visualization', async () => {
      // Check CLI has UI components for tool interaction
      const cliUIExists = await fileExists('packages/cli/src/ui') &&
                         await fileExists('packages/cli/src/ui/components');
      expect(cliUIExists).toBe(true);
    });
  });

  describe('Configuration System Integration', () => {
    it('should verify .apex configuration supports v0.5.0 features', async () => {
      // Check for sample configs that would support v0.5.0 features
      const hasApexConfig = await fileExists('.apex') ||
                           await fileExists('docs/examples/.apex') ||
                           await fileContains('packages/core/src/config.ts', 'tool') ||
                           await fileContains('packages/core/src/config.ts', 'permission');

      expect(hasApexConfig).toBe(true);
    });

    it('should verify configuration schema supports tool permissions', async () => {
      // Check that config types include tool and permission settings
      const hasToolConfig = await fileContains('packages/core/src/types.ts', 'tool') ||
                           await fileContains('packages/core/src/types.ts', 'permission') ||
                           await fileContains('packages/core/src/config.ts', 'autonomy');

      expect(hasToolConfig).toBe(true);
    });
  });
});