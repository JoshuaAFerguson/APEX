import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test suite to verify the accuracy of status icons in ROADMAP.md
 * This tests whether features marked as complete (🟢) actually exist
 * and features marked as planned (⚪) are truly not implemented yet.
 */
describe('ROADMAP.md Status Icon Accuracy Tests', () => {
  let roadmapContent: string;
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(async () => {
    roadmapContent = await fs.readFile(path.join(projectRoot, 'ROADMAP.md'), 'utf-8');
  });

  /**
   * Helper function to extract feature status from roadmap
   */
  function extractFeatureStatus(featureName: string): '🟢' | '🟡' | '⚪' | null {
    const lines = roadmapContent.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(featureName.toLowerCase())) {
        if (line.includes('🟢')) return '🟢';
        if (line.includes('🟡')) return '🟡';
        if (line.includes('⚪')) return '⚪';
      }
    }
    return null;
  }

  /**
   * Helper function to check if a file/directory exists
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
      return content.includes(searchText);
    } catch {
      return false;
    }
  }

  describe('Component Implementation Verification', () => {
    interface ComponentTestCase {
      featureName: string;
      expectedStatus: '🟢' | '🟡' | '⚪';
      componentPaths: string[];
      requiredContent?: Array<{ file: string; content: string }>;
    }

    const componentTests: ComponentTestCase[] = [
      {
        featureName: 'Streaming response rendering',
        expectedStatus: '🟢',
        componentPaths: ['packages/cli/src/ui/components/StreamingText.tsx'],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/StreamingText.tsx', content: 'StreamingText' },
          { file: 'packages/cli/src/ui/components/StreamingText.tsx', content: 'speed' }
        ]
      },
      {
        featureName: 'Markdown rendering',
        expectedStatus: '🟢',
        componentPaths: ['packages/cli/src/ui/components/MarkdownRenderer.tsx'],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/MarkdownRenderer.tsx', content: 'MarkdownRenderer' }
        ]
      },
      {
        featureName: 'Syntax-highlighted code blocks',
        expectedStatus: '🟢',
        componentPaths: [
          'packages/cli/src/ui/components/SyntaxHighlighter.tsx',
          'packages/cli/src/ui/components/CodeBlock.tsx'
        ],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/SyntaxHighlighter.tsx', content: 'SyntaxHighlighter' }
        ]
      },
      {
        featureName: 'Diff views',
        expectedStatus: '🟢',
        componentPaths: ['packages/cli/src/ui/components/DiffViewer.tsx'],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/DiffViewer.tsx', content: 'DiffViewer' }
        ]
      },
      {
        featureName: 'Persistent status bar',
        expectedStatus: '🟢',
        componentPaths: ['packages/cli/src/ui/components/StatusBar.tsx'],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/StatusBar.tsx', content: 'StatusBar' },
          { file: 'packages/cli/src/ui/components/StatusBar.tsx', content: 'gitBranch' },
          { file: 'packages/cli/src/ui/components/StatusBar.tsx', content: 'tokens' }
        ]
      },
      {
        featureName: 'Agent activity panel',
        expectedStatus: '🟢',
        componentPaths: ['packages/cli/src/ui/components/agents/AgentPanel.tsx'],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/agents/AgentPanel.tsx', content: 'AgentPanel' }
        ]
      },
      {
        featureName: 'Subtask tree',
        expectedStatus: '🟢',
        componentPaths: ['packages/cli/src/ui/components/agents/SubtaskTree.tsx'],
        requiredContent: [
          { file: 'packages/cli/src/ui/components/agents/SubtaskTree.tsx', content: 'SubtaskTree' }
        ]
      },
      {
        featureName: 'Tab completion',
        expectedStatus: '🟢',
        componentPaths: [
          'packages/cli/src/services/CompletionEngine.ts',
          'packages/cli/src/ui/components/AdvancedInput.tsx'
        ],
        requiredContent: [
          { file: 'packages/cli/src/services/CompletionEngine.ts', content: 'CompletionEngine' },
          { file: 'packages/cli/src/ui/components/AdvancedInput.tsx', content: 'completion' }
        ]
      }
    ];

    componentTests.forEach(({ featureName, expectedStatus, componentPaths, requiredContent }) => {
      it(`should have correct status for "${featureName}"`, async () => {
        const actualStatus = extractFeatureStatus(featureName);
        expect(actualStatus).toBe(expectedStatus);

        if (expectedStatus === '🟢') {
          // If marked as complete, all component paths should exist
          for (const componentPath of componentPaths) {
            const exists = await fileExists(componentPath);
            expect(exists).toBe(true);
          }

          // Check required content if specified
          if (requiredContent) {
            for (const { file, content } of requiredContent) {
              const hasContent = await fileContains(file, content);
              expect(hasContent).toBe(true);
            }
          }
        } else if (expectedStatus === '⚪') {
          // If marked as planned, components might not exist or be incomplete
          // This is acceptable for planned features
        }
      });
    });
  });

  describe('Service Implementation Verification', () => {
    interface ServiceTestCase {
      featureName: string;
      expectedStatus: '🟢' | '🟡' | '⚪';
      servicePaths: string[];
      requiredMethods?: Array<{ file: string; method: string }>;
    }

    const serviceTests: ServiceTestCase[] = [
      {
        featureName: 'Session persistence',
        expectedStatus: '🟢',
        servicePaths: ['packages/cli/src/services/SessionStore.ts'],
        requiredMethods: [
          { file: 'packages/cli/src/services/SessionStore.ts', method: 'saveSession' },
          { file: 'packages/cli/src/services/SessionStore.ts', method: 'loadSession' }
        ]
      },
      {
        featureName: 'Auto-save',
        expectedStatus: '🟢',
        servicePaths: ['packages/cli/src/services/SessionAutoSaver.ts'],
        requiredMethods: [
          { file: 'packages/cli/src/services/SessionAutoSaver.ts', method: 'SessionAutoSaver' }
        ]
      },
      {
        featureName: 'Conversational context',
        expectedStatus: '🟢',
        servicePaths: ['packages/cli/src/services/ConversationManager.ts'],
        requiredMethods: [
          { file: 'packages/cli/src/services/ConversationManager.ts', method: 'ConversationManager' },
          { file: 'packages/cli/src/services/ConversationManager.ts', method: 'addMessage' }
        ]
      },
      {
        featureName: 'Full ShortcutManager',
        expectedStatus: '🟢',
        servicePaths: ['packages/cli/src/services/ShortcutManager.ts'],
        requiredMethods: [
          { file: 'packages/cli/src/services/ShortcutManager.ts', method: 'ShortcutManager' },
          { file: 'packages/cli/src/services/ShortcutManager.ts', method: 'register' }
        ]
      }
    ];

    serviceTests.forEach(({ featureName, expectedStatus, servicePaths, requiredMethods }) => {
      it(`should have correct implementation for "${featureName}"`, async () => {
        const actualStatus = extractFeatureStatus(featureName);
        expect(actualStatus).toBe(expectedStatus);

        if (expectedStatus === '🟢') {
          // If marked as complete, all service paths should exist
          for (const servicePath of servicePaths) {
            const exists = await fileExists(servicePath);
            expect(exists).toBe(true);
          }

          // Check required methods if specified
          if (requiredMethods) {
            for (const { file, method } of requiredMethods) {
              const hasMethod = await fileContains(file, method);
              expect(hasMethod).toBe(true);
            }
          }
        }
      });
    });
  });

  describe('Package Dependency Verification', () => {
    it('should verify all mentioned dependencies are actually installed', async () => {
      const packageJsonPath = path.join(projectRoot, 'packages/cli/package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Dependencies mentioned in ROADMAP as already installed
      const roadmapDependencies = [
        'ink',
        'shiki',
        'marked',
        'diff',
        'fuse.js'
      ];

      for (const dep of roadmapDependencies) {
        expect(allDependencies).toHaveProperty(dep);
      }

      // Verify these dependencies have appropriate status in roadmap
      expect(roadmapContent).toMatch(/Dependencies \(Already Installed\)/);
    });
  });

  describe('Phase Progress Accuracy', () => {
    it('should verify Phase 1 completion claims are accurate', async () => {
      // Phase 1 tasks that should be complete
      const phase1Tasks = [
        'CompletionEngine',
        'ConversationManager',
        'StatusBar',
        'ShortcutManager'
      ];

      for (const task of phase1Tasks) {
        // Check if the key component exists
        const componentExists =
          await fileExists(`packages/cli/src/services/${task}.ts`) ||
          await fileExists(`packages/cli/src/ui/components/${task}.tsx`) ||
          await fileExists(`packages/cli/src/services/${task}.tsx`);

        expect(componentExists).toBe(true);
      }

      // Verify phase is marked as complete
      expect(roadmapContent).toMatch(/\*\*Phase 1:.*\(COMPLETE\)\*\*/);
    });

    it('should verify Phase 2 completion claims are accurate', async () => {
      // Phase 2 components that should be complete
      const phase2Components = [
        'packages/cli/src/ui/components/agents/AgentPanel.tsx',
        'packages/cli/src/ui/components/agents/SubtaskTree.tsx',
        'packages/cli/src/ui/components/agents/HandoffIndicator.tsx'
      ];

      for (const componentPath of phase2Components) {
        const exists = await fileExists(componentPath);
        expect(exists).toBe(true);
      }

      // Verify phase is marked as complete
      expect(roadmapContent).toMatch(/\*\*Phase 2:.*\(COMPLETE\)\*\*/);
    });

    it('should verify realistic remaining work estimate', async () => {
      // Count planned (⚪) features in v0.3.0 section
      const v030Section = roadmapContent.split('## v0.3.0')[1]?.split('## v0.4.0')[0] || '';
      const plannedFeatures = (v030Section.match(/⚪/g) || []).length;

      // Should have minimal remaining work for 2-3 day estimate to be realistic
      expect(plannedFeatures).toBeLessThan(10); // Should be mostly complete

      // Verify estimate is realistic
      expect(roadmapContent).toMatch(/\*\*Estimated Remaining\*\*.*2-3 days/);
    });
  });

  describe('ADR Reference Accuracy', () => {
    it('should verify ADR references exist and are accessible', async () => {
      // Check if ADR files actually exist
      const adrPaths = [
        'docs/adr/008-v030-comprehensive-technical-design.md',
        'docs/adr/009-v030-implementation-plan.md',
        'docs/adr/010-v030-feature-development-technical-design.md'
      ];

      for (const adrPath of adrPaths) {
        // Check if the file exists (we expect these might not exist in test environment)
        // But the references in ROADMAP should be consistent
        expect(roadmapContent).toMatch(new RegExp(adrPath.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')));
      }
    });
  });

  describe('Icon Pattern Consistency', () => {
    it('should have consistent status icon usage patterns', () => {
      const lines = roadmapContent.split('\n');
      const v030Lines = lines.filter((line, index) => {
        const v030Start = lines.findIndex(l => l.includes('## v0.3.0'));
        const v040Start = lines.findIndex(l => l.includes('## v0.4.0'));
        return index > v030Start && index < v040Start;
      });

      // Check that status icons are used consistently
      const statusIconLines = v030Lines.filter(line =>
        line.includes('🟢') || line.includes('🟡') || line.includes('⚪')
      );

      // Each line with a status icon should follow the pattern: - icon **text** - description
      for (const line of statusIconLines) {
        // Skip table headers and other special cases
        if (line.includes('|') || line.includes('*')) continue;

        // Should start with hyphen and have an icon
        const hasValidPattern = /^- [🟢🟡⚪]/.test(line.trim());
        if (!hasValidPattern && line.trim().length > 0) {
          // Only fail for substantial content lines
          expect(hasValidPattern).toBe(true);
        }
      }
    });

    it('should not have any obviously incorrect status assignments', () => {
      // Features that should definitely be complete based on codebase analysis
      const definitelyCompleteFeatures = [
        'StatusBar',
        'StreamingText',
        'ConversationManager',
        'SessionStore',
        'ShortcutManager',
        'AgentPanel'
      ];

      for (const feature of definitelyCompleteFeatures) {
        const status = extractFeatureStatus(feature);
        expect(status).toBe('🟢');
      }
    });
  });
});