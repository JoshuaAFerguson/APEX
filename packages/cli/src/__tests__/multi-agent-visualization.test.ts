/**
 * Multi-Agent Visualization Documentation Test Suite
 *
 * Tests the completeness, structure, and quality of the Multi-Agent Visualization
 * section in v030-features.md documentation.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOCS_PATH = join(__dirname, '../../../../docs/features/v030-features.md');

describe('Multi-Agent Visualization Documentation', () => {
  let docContent: string;

  beforeAll(() => {
    expect(existsSync(DOCS_PATH)).toBe(true);
    docContent = readFileSync(DOCS_PATH, 'utf-8');
  });

  describe('Section Structure', () => {
    it('should contain Multi-Agent Visualization Overview section', () => {
      expect(docContent).toMatch(/#### Multi-Agent Visualization Overview/);
    });

    it('should contain all required subsections', () => {
      const requiredSections = [
        'Integrated Visualization Components',
        'Complete Multi-Agent Workflow Example',
        'Multi-Agent Coordination Patterns'
      ];

      requiredSections.forEach(section => {
        expect(docContent).toMatch(new RegExp(`##### ${section}`));
      });
    });

    it('should contain Agent Panel Visualization section', () => {
      expect(docContent).toMatch(/### 4\. Agent Panel Visualization/);
    });

    it('should contain all Agent Panel subsections', () => {
      const agentPanelSections = [
        'AgentPanel Component Overview',
        'Display Modes',
        'AgentPanel Component API',
        'Handoff Animations',
        'Parallel Execution View',
        'SubtaskTree Visualization'
      ];

      agentPanelSections.forEach(section => {
        expect(docContent).toMatch(new RegExp(`#### ${section}`));
      });
    });
  });

  describe('Agent Panel Components', () => {
    describe('AgentPanel Component', () => {
      it('should document AgentPanel component API', () => {
        expect(docContent).toMatch(/interface AgentPanelProps/);
        expect(docContent).toMatch(/import.*AgentPanel.*from.*@apex\/cli\/ui\/components/);
      });

      it('should include all required AgentPanel properties', () => {
        const requiredProps = [
          'agents: AgentInfo\\[\\]',
          'currentAgent\\?: string',
          'compact\\?: boolean',
          'showParallel\\?: boolean',
          'parallelAgents\\?: AgentInfo\\[\\]',
          'useDetailedParallelView\\?: boolean',
          'displayMode\\?: \'normal\' \\| \'compact\' \\| \'verbose\'',
          'showThoughts\\?: boolean',
          'width\\?: number'
        ];

        requiredProps.forEach(prop => {
          expect(docContent).toMatch(new RegExp(prop));
        });
      });

      it('should document responsive breakpoint system', () => {
        expect(docContent).toMatch(/4-tier breakpoint system/);
        expect(docContent).toMatch(/Breakpoint.*Width.*Layout.*Features/);
        const breakpoints = ['narrow', 'compact', 'normal', 'wide'];
        breakpoints.forEach(bp => {
          expect(docContent).toMatch(new RegExp(bp, 'i'));
        });
      });

      it('should include usage examples', () => {
        expect(docContent).toMatch(/<AgentPanel[^>]*>/);
        expect(docContent).toMatch(/agents=\{agentStates\}/);
        expect(docContent).toMatch(/currentAgent=/);
      });
    });

    describe('HandoffIndicator Component', () => {
      it('should document handoff animations', () => {
        expect(docContent).toMatch(/HandoffIndicator.*component/);
        expect(docContent).toMatch(/animated transitions/);
      });

      it('should include HandoffIndicator API', () => {
        expect(docContent).toMatch(/interface HandoffIndicatorProps/);
        expect(docContent).toMatch(/animationState: HandoffAnimationState/);
        expect(docContent).toMatch(/agentColors: Record<string, string>/);
      });

      it('should document animation styles', () => {
        expect(docContent).toMatch(/multiple animation styles/);
        expect(docContent).toMatch(/terminal capabilities/);
      });
    });

    describe('ParallelExecutionView Component', () => {
      it('should document parallel execution visualization', () => {
        expect(docContent).toMatch(/ParallelExecutionView.*component/);
        expect(docContent).toMatch(/multiple agents running concurrently/);
      });

      it('should include ParallelExecutionView API', () => {
        expect(docContent).toMatch(/interface ParallelExecutionViewProps/);
        expect(docContent).toMatch(/agents: ParallelAgent\[\]/);
        expect(docContent).toMatch(/maxColumns\?: number/);
        expect(docContent).toMatch(/compact\?: boolean/);
      });

      it('should document grid layout examples', () => {
        expect(docContent).toMatch(/Grid Layout Examples/);
        expect(docContent).toMatch(/responsive column layouts/);
        expect(docContent).toMatch(/terminal width/);
      });

      it('should include usage examples', () => {
        expect(docContent).toMatch(/<ParallelExecutionView[^>]*>/);
        expect(docContent).toMatch(/agents=\{parallelAgents\}/);
      });
    });

    describe('SubtaskTree Component', () => {
      it('should document subtask tree visualization', () => {
        expect(docContent).toMatch(/SubtaskTree.*component/);
        expect(docContent).toMatch(/hierarchical view of task breakdowns/);
      });

      it('should include SubtaskTree API', () => {
        expect(docContent).toMatch(/interface SubtaskTreeProps/);
        expect(docContent).toMatch(/task: SubtaskNode/);
        expect(docContent).toMatch(/maxDepth\?: number/);
        expect(docContent).toMatch(/defaultCollapsed\?: boolean/);
      });

      it('should document interactive features', () => {
        expect(docContent).toMatch(/keyboard navigation/);
        expect(docContent).toMatch(/collapse\/expand functionality/);
        expect(docContent).toMatch(/interactive/);
      });

      it('should include visual layout examples', () => {
        expect(docContent).toMatch(/Visual Layout/);
        expect(docContent).toMatch(/├─|└─|├─/); // Tree structure symbols
      });
    });
  });

  describe('Visual Examples and ASCII Art', () => {
    it('should include comprehensive workflow example with ASCII visualization', () => {
      expect(docContent).toMatch(/APEX Multi-Agent Workflow/);
      expect(docContent).toMatch(/┌─.*──────────────────────────────────────────────────────────────────────────────┐/);
      expect(docContent).toMatch(/📋 planner.*🏗️ architect.*👨‍💻 developer/);
    });

    it('should show agent progress bars in examples', () => {
      expect(docContent).toMatch(/████████████████████████████████████████████████████████████████████████ 100%/);
      expect(docContent).toMatch(/███████████████████████████████████████░░░░░░░░░░ 78%/);
    });

    it('should include subtask breakdown visualization', () => {
      expect(docContent).toMatch(/📊 Subtask Breakdown/);
      expect(docContent).toMatch(/✅.*Core authentication logic implementation/);
      expect(docContent).toMatch(/🔄.*Frontend integration \(in progress\)/);
      expect(docContent).toMatch(/⏳.*Error handling implementation/);
    });

    it('should show parallel execution in visual examples', () => {
      expect(docContent).toMatch(/⟂ Parallel Execution/);
      expect(docContent).toMatch(/⟂ tester.*\[active\]/);
      expect(docContent).toMatch(/⟂ reviewer.*\[active\]/);
    });

    it('should include coordination patterns examples', () => {
      expect(docContent).toMatch(/Sequential Handoffs/);
      expect(docContent).toMatch(/Traditional workflow progression/);
    });
  });

  describe('/thoughts Command Documentation', () => {
    it('should contain /thoughts command section', () => {
      expect(docContent).toMatch(/#### \/thoughts Command/);
    });

    it('should document basic usage', () => {
      expect(docContent).toMatch(/##### Basic Usage/);
      expect(docContent).toMatch(/\/thoughts.*command.*provides.*insight/);
    });

    it('should include command syntax examples', () => {
      expect(docContent).toMatch(/\/thoughts developer/);
      expect(docContent).toMatch(/\/thoughts architect/);
      expect(docContent).toMatch(/\/thoughts.*to see current reasoning/);
    });

    it('should document integration with agent panels', () => {
      expect(docContent).toMatch(/Integration with Agent Panels/);
      expect(docContent).toMatch(/displayed inline.*agent status/);
    });

    it('should include usage examples with output', () => {
      // Check for example thought outputs in code blocks
      expect(docContent).toMatch(/```[\s\S]*?Led to:.*implementation tasks[\s\S]*?```/);
    });
  });

  describe('Integration and Event Handling', () => {
    it('should document orchestrator events integration', () => {
      expect(docContent).toMatch(/Integration with Orchestrator Events/);
      expect(docContent).toMatch(/useOrchestratorEvents/);
    });

    it('should include event subscription examples', () => {
      expect(docContent).toMatch(/import.*useOrchestratorEvents.*from.*@apex\/cli\/ui\/hooks/);
      expect(docContent).toMatch(/const.*=.*useOrchestratorEvents\(orchestrator\)/);
    });

    it('should document agent lifecycle events', () => {
      const events = [
        'agent:start',
        'agent:progress',
        'agent:complete',
        'handoff:start',
        'handoff:complete',
        'parallel:start',
        'parallel:complete',
        'subtask:create',
        'subtask:update',
        'subtask:complete'
      ];

      events.forEach(event => {
        expect(docContent).toMatch(new RegExp(event.replace(':', '\\:')));
      });
    });
  });

  describe('Code Quality and Completeness', () => {
    it('should have proper TypeScript interfaces', () => {
      const interfaces = [
        'AgentPanelProps',
        'HandoffIndicatorProps',
        'ParallelExecutionViewProps',
        'SubtaskTreeProps'
      ];

      interfaces.forEach(interfaceName => {
        expect(docContent).toMatch(new RegExp(`interface ${interfaceName}`));
      });
    });

    it('should include import statements for all components', () => {
      const components = [
        'AgentPanel',
        'HandoffIndicator',
        'ParallelExecutionView',
        'SubtaskTree'
      ];

      components.forEach(component => {
        expect(docContent).toMatch(new RegExp(`import.*${component}.*from`));
      });
    });

    it('should document component file structure', () => {
      expect(docContent).toMatch(/packages\/cli\/src\/ui\/components\//);
      expect(docContent).toMatch(/AgentPanel\.tsx/);
      expect(docContent).toMatch(/HandoffIndicator\.tsx/);
      expect(docContent).toMatch(/SubtaskTree\.tsx/);
    });

    it('should include comprehensive usage examples for each component', () => {
      const components = ['AgentPanel', 'ParallelExecutionView', 'SubtaskTree'];

      components.forEach(component => {
        // Check for basic usage
        expect(docContent).toMatch(new RegExp(`<${component}[^>]*>`));
        // Check for props usage
        expect(docContent).toMatch(new RegExp(`<${component}[^>]*\\n[^<]*=\\{[^}]*\\}`));
      });
    });
  });

  describe('Documentation Accessibility and Usability', () => {
    it('should have clear section hierarchy', () => {
      // Check that sections follow proper markdown hierarchy
      const mainSections = docContent.match(/^### .+$/gm) || [];
      const subSections = docContent.match(/^#### .+$/gm) || [];
      const subSubSections = docContent.match(/^##### .+$/gm) || [];

      expect(mainSections.length).toBeGreaterThan(0);
      expect(subSections.length).toBeGreaterThan(0);
      expect(subSubSections.length).toBeGreaterThan(0);
    });

    it('should include descriptive text for each component', () => {
      // Each component should have explanatory text, not just code
      const componentSections = [
        'AgentPanel Component Overview',
        'Handoff Animations',
        'Parallel Execution View',
        'SubtaskTree Visualization'
      ];

      componentSections.forEach(section => {
        const sectionIndex = docContent.indexOf(section);
        expect(sectionIndex).toBeGreaterThan(-1);

        // Check that there's descriptive text after the section header
        const textAfterSection = docContent.substring(sectionIndex + section.length, sectionIndex + section.length + 500);
        expect(textAfterSection).toMatch(/\w+.*\w+.*\w+/); // At least some words
      });
    });

    it('should provide practical examples for developers', () => {
      // Should have code examples that developers can actually use
      expect(docContent).toMatch(/\/\/ Basic usage/);
      expect(docContent).toMatch(/\/\/ Explicit.*mode/);
      expect(docContent).toMatch(/\/\/ Full mode/);
    });
  });
});