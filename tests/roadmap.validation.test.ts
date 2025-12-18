import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ROADMAP.md v0.3.0 Status Icon Validation', () => {
  let roadmapContent: string;
  const projectRoot = path.resolve(__dirname, '..');

  beforeEach(async () => {
    roadmapContent = await fs.readFile(path.join(projectRoot, 'ROADMAP.md'), 'utf-8');
  });

  describe('Rich Terminal UI (@apexcli/cli)', () => {
    it('should have correct status icons for core UI components', async () => {
      // Verify all Rich Terminal UI features are marked as complete (🟢)
      const richUiFeatures = [
        'Ink-based UI framework',
        'Streaming response rendering',
        'Markdown rendering',
        'Syntax-highlighted code blocks',
        'Diff views',
        'Boxed UI elements',
        'Responsive layouts',
        'Theme support'
      ];

      for (const feature of richUiFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify corresponding components exist in codebase
      const expectedComponents = [
        'packages/cli/src/ui/components/StreamingText.tsx',
        'packages/cli/src/ui/components/MarkdownRenderer.tsx',
        'packages/cli/src/ui/components/SyntaxHighlighter.tsx',
        'packages/cli/src/ui/components/DiffViewer.tsx'
      ];

      for (const componentPath of expectedComponents) {
        const fullPath = path.join(projectRoot, componentPath);
        await expect(fs.access(fullPath)).resolves.not.toThrow();
      }
    });
  });

  describe('Status Bar & Information Display', () => {
    it('should have correct status icons for status bar features', async () => {
      // Verify all Status Bar features are marked as complete (🟢)
      const statusBarFeatures = [
        'Persistent status bar',
        'Token usage counter',
        'Cost tracker',
        'Model indicator',
        'Session timer',
        'Git branch display',
        'Agent indicator',
        'Workflow stage display',
        'Subtask progress'
      ];

      for (const feature of statusBarFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify StatusBar component exists
      const statusBarPath = path.join(projectRoot, 'packages/cli/src/ui/components/StatusBar.tsx');
      await expect(fs.access(statusBarPath)).resolves.not.toThrow();
    });
  });

  describe('Natural Language Interface', () => {
    it('should have correct status icons for NLI features', async () => {
      // Verify all NL Interface features are marked as complete (🟢)
      const nliFeatures = [
        'Natural language first',
        'Smart intent detection',
        'Conversational context',
        'Task refinement',
        'Suggested actions'
      ];

      for (const feature of nliFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify key components exist
      const expectedComponents = [
        'packages/cli/src/ui/components/IntentDetector.tsx',
        'packages/cli/src/services/ConversationManager.ts',
        'packages/cli/src/ui/components/SmartSuggestions.tsx'
      ];

      for (const componentPath of expectedComponents) {
        const fullPath = path.join(projectRoot, componentPath);
        await expect(fs.access(fullPath)).resolves.not.toThrow();
      }
    });
  });

  describe('Input Experience', () => {
    it('should have correct status icons for input features', async () => {
      // Verify completed features are marked as complete (🟢)
      const completedInputFeatures = [
        'Tab completion',
        'History navigation',
        'History search',
        'Multi-line input',
        'Inline editing'
      ];

      for (const feature of completedInputFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify planned features are marked as planned (⚪)
      const plannedInputFeatures = [
        'Input preview'
      ];

      for (const feature of plannedInputFeatures) {
        const regex = new RegExp(`⚪.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify AdvancedInput component exists
      const advancedInputPath = path.join(projectRoot, 'packages/cli/src/ui/components/AdvancedInput.tsx');
      await expect(fs.access(advancedInputPath)).resolves.not.toThrow();
    });
  });

  describe('Output & Feedback', () => {
    it('should have correct status icons for output features', async () => {
      // Verify completed features are marked as complete (🟢)
      const completedOutputFeatures = [
        'Streaming output',
        'Progress indicators',
        'Activity log',
        'Error formatting',
        'Success celebration'
      ];

      for (const feature of completedOutputFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify planned features are marked as planned (⚪)
      const plannedOutputFeatures = [
        'Compact mode',
        'Verbose mode'
      ];

      for (const feature of plannedOutputFeatures) {
        const regex = new RegExp(`⚪.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify key components exist
      const expectedComponents = [
        'packages/cli/src/ui/components/ProgressIndicators.tsx',
        'packages/cli/src/ui/components/ActivityLog.tsx',
        'packages/cli/src/ui/components/ErrorDisplay.tsx',
        'packages/cli/src/ui/components/SuccessCelebration.tsx'
      ];

      for (const componentPath of expectedComponents) {
        const fullPath = path.join(projectRoot, componentPath);
        await expect(fs.access(fullPath)).resolves.not.toThrow();
      }
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should have correct status icons for keyboard shortcuts', async () => {
      // All keyboard shortcuts should be marked as complete (🟢) based on the implementation
      const keyboardShortcuts = [
        'Ctrl+C',
        'Ctrl+D',
        'Ctrl+L',
        'Ctrl+U',
        'Ctrl+W',
        'Ctrl+A/E',
        'Ctrl+P/N',
        'Tab',
        'Escape',
        'Full ShortcutManager'
      ];

      for (const shortcut of keyboardShortcuts) {
        const regex = new RegExp(`🟢.*${shortcut.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify ShortcutManager exists
      const shortcutManagerPath = path.join(projectRoot, 'packages/cli/src/services/ShortcutManager.ts');
      await expect(fs.access(shortcutManagerPath)).resolves.not.toThrow();
    });
  });

  describe('Multi-Agent Visualization', () => {
    it('should have correct status icons for agent visualization features', async () => {
      // All agent visualization features should be marked as complete (🟢)
      const agentVisualizationFeatures = [
        'Agent activity panel',
        'Agent handoff animation',
        'Parallel execution view',
        'Subtask tree',
        'Workflow progress',
        'Agent thought display'
      ];

      for (const feature of agentVisualizationFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify key components exist
      const expectedComponents = [
        'packages/cli/src/ui/components/agents/AgentPanel.tsx',
        'packages/cli/src/ui/components/agents/SubtaskTree.tsx'
      ];

      for (const componentPath of expectedComponents) {
        const fullPath = path.join(projectRoot, componentPath);
        await expect(fs.access(fullPath)).resolves.not.toThrow();
      }
    });
  });

  describe('Session Management', () => {
    it('should have correct status icons for session management features', async () => {
      // All session management features should be marked as complete (🟢)
      const sessionFeatures = [
        'Session persistence',
        'Session export',
        'Session branching',
        'Named sessions',
        'Session search',
        'Auto-save',
        'Session commands'
      ];

      for (const feature of sessionFeatures) {
        const regex = new RegExp(`🟢.*${feature.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Verify SessionStore exists
      const sessionStorePath = path.join(projectRoot, 'packages/cli/src/services/SessionStore.ts');
      await expect(fs.access(sessionStorePath)).resolves.not.toThrow();
    });
  });

  describe('Development Plan Progress Tracking', () => {
    it('should accurately reflect Phase 1 completion status', () => {
      // Phase 1 should be marked as COMPLETE with all tasks showing 🟢
      expect(roadmapContent).toMatch(/\*\*Phase 1:.*\(COMPLETE\)\*\*/);

      const phase1Tasks = [
        'Wire CompletionEngine to AdvancedInput',
        'Integrate ConversationManager with REPL',
        'StatusBar session timer + subtask progress',
        'Wire ShortcutManager event handlers',
        'Real-time streaming to UI'
      ];

      for (const task of phase1Tasks) {
        const regex = new RegExp(`🟢.*${task.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }
    });

    it('should accurately reflect Phase 2 completion status', () => {
      // Phase 2 should be marked as COMPLETE with most tasks showing 🟢
      expect(roadmapContent).toMatch(/\*\*Phase 2:.*\(COMPLETE\)\*\*/);

      const phase2CompletedTasks = [
        'AgentPanel enhancements (handoff, parallel)',
        'SubtaskTree enhancements (collapse/expand)'
      ];

      for (const task of phase2CompletedTasks) {
        const regex = new RegExp(`🟢.*${task.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }

      // Display modes should still be planned (⚪)
      expect(roadmapContent).toMatch(/⚪.*Display modes \(compact\/verbose\)/i);
    });

    it('should accurately reflect Phase 3 medium priority status', () => {
      // Phase 3 should be marked as MEDIUM PRIORITY with tasks still planned (⚪)
      expect(roadmapContent).toMatch(/\*\*Phase 3:.*\(MEDIUM PRIORITY\)\*\*/);

      const phase3Tasks = [
        'Integration tests',
        'Documentation updates'
      ];

      for (const task of phase3Tasks) {
        const regex = new RegExp(`⚪.*${task.replace(/[-\/\\\^$*+?.()|[\]{}]/g, '\\$&')}`, 'i');
        expect(roadmapContent).toMatch(regex);
      }
    });

    it('should show realistic remaining work estimate', () => {
      // Should show 2-3 days remaining estimate
      expect(roadmapContent).toMatch(/\*\*Estimated Remaining\*\*.*2-3 days/);
    });
  });

  describe('Dependencies and Project Structure', () => {
    it('should verify all mentioned dependencies are actually installed', async () => {
      // Read package.json to verify dependencies
      const packageJsonPath = path.join(projectRoot, 'packages/cli/package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      const expectedDependencies = [
        'ink',
        'shiki',
        'marked',
        'diff',
        'fuse.js'
      ];

      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const dep of expectedDependencies) {
        expect(allDependencies).toHaveProperty(dep);
      }
    });

    it('should verify core CLI structure exists', async () => {
      // Verify key directories and files exist
      const expectedPaths = [
        'packages/cli/src/ui/components',
        'packages/cli/src/services',
        'packages/cli/src/repl.tsx',
        'packages/cli/src/index.ts'
      ];

      for (const expectedPath of expectedPaths) {
        const fullPath = path.join(projectRoot, expectedPath);
        await expect(fs.access(fullPath)).resolves.not.toThrow();
      }
    });
  });

  describe('Icon Consistency', () => {
    it('should use consistent status icons throughout the document', () => {
      // Count occurrences of each status icon in v0.3.0 section
      const v030Section = roadmapContent.split('## v0.3.0')[1]?.split('## v0.4.0')[0] || '';

      const completeMatches = v030Section.match(/🟢/g) || [];
      const plannedMatches = v030Section.match(/⚪/g) || [];
      const inProgressMatches = v030Section.match(/🟡/g) || [];

      // Should have many completed features
      expect(completeMatches.length).toBeGreaterThan(50);

      // Should have some planned features (mainly display modes, integration tests, etc.)
      expect(plannedMatches.length).toBeGreaterThan(0);

      // Should have minimal in-progress features (if any)
      expect(inProgressMatches.length).toBeLessThanOrEqual(5);
    });

    it('should not have any inconsistent status indicators', () => {
      // Check for any features that might have wrong icons
      // This test looks for patterns that might indicate errors

      // Should not have completed features marked as planned
      const suspiciousPatterns = [
        /⚪.*Ink-based UI framework/i,
        /⚪.*StatusBar/i,
        /⚪.*ConversationManager/i,
        /⚪.*ShortcutManager/i
      ];

      for (const pattern of suspiciousPatterns) {
        expect(roadmapContent).not.toMatch(pattern);
      }
    });
  });

  describe('ADR References', () => {
    it('should reference correct ADRs for technical design', () => {
      // Verify ADR references exist and are correct
      expect(roadmapContent).toMatch(/ADR-008.*Comprehensive Technical Design/);
      expect(roadmapContent).toMatch(/ADR-009.*Implementation Plan/);
      expect(roadmapContent).toMatch(/ADR-010.*Feature Development Technical Design/);
    });
  });
});