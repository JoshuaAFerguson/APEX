/**
 * Multi-Agent Visual Examples Validation Test
 *
 * Tests the quality, completeness, and accuracy of visual examples and ASCII art
 * in the Multi-Agent Visualization documentation.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOCS_PATH = join(__dirname, '../../../../docs/features/v030-features.md');

describe('Multi-Agent Visual Examples Validation', () => {
  let docContent: string;

  beforeAll(() => {
    expect(existsSync(DOCS_PATH)).toBe(true);
    docContent = readFileSync(DOCS_PATH, 'utf-8');
  });

  describe('ASCII Art Quality and Consistency', () => {
    it('should have well-formed box drawings for workflow examples', () => {
      // Check for proper Unicode box drawing characters
      expect(docContent).toMatch(/┌─.*──────.*─┐/); // Top border
      expect(docContent).toMatch(/└─.*──────.*─┘/); // Bottom border
      expect(docContent).toMatch(/│.*│/); // Side borders

      // Ensure consistent box drawing style
      const boxChars = docContent.match(/[┌┐└┘├┤┬┴┼─│]/g) || [];
      expect(boxChars.length).toBeGreaterThan(10); // Should have substantial ASCII art
    });

    it('should include proper emoji usage for agent representation', () => {
      const expectedEmojis = [
        '📋', // planner
        '🏗️', // architect
        '👨‍💻', // developer
        '🧪', // tester
        '👀', // reviewer
        '🚀', // devops
        '⚡', // active indicator
        '💡'  // thoughts indicator
      ];

      expectedEmojis.forEach(emoji => {
        expect(docContent).toMatch(new RegExp(emoji.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '\\$&')));
      });
    });

    it('should display realistic progress bars', () => {
      // Check for progress bars with full blocks and empty blocks
      expect(docContent).toMatch(/████+░+.*%/); // Progress with percentage
      expect(docContent).toMatch(/100%/); // Completed tasks
      expect(docContent).toMatch(/[0-9]{2}%/); // Percentage values

      // Ensure progress bars have consistent length
      const progressBars = docContent.match(/█+░+/g) || [];
      expect(progressBars.length).toBeGreaterThan(3); // Multiple progress examples

      // Check that progress bars are roughly consistent in length
      const barLengths = progressBars.map(bar => bar.length);
      const avgLength = barLengths.reduce((a, b) => a + b, 0) / barLengths.length;
      barLengths.forEach(length => {
        expect(Math.abs(length - avgLength)).toBeLessThan(10); // Within reasonable variance
      });
    });

    it('should show proper tree structure characters', () => {
      // Check for tree drawing characters
      expect(docContent).toMatch(/├─/); // Branch
      expect(docContent).toMatch(/└─/); // Last branch
      expect(docContent).toMatch(/│/);  // Vertical line

      // Should have hierarchical structure
      expect(docContent).toMatch(/├─.*\n.*├─/); // Multiple branches at same level
      expect(docContent).toMatch(/└─.*\n.*├─/); // Proper nesting
    });
  });

  describe('Complete Workflow Example Validation', () => {
    let workflowExample: string;

    beforeAll(() => {
      const startIndex = docContent.indexOf('APEX Multi-Agent Workflow');
      const endIndex = docContent.indexOf('```', startIndex + 1);
      workflowExample = docContent.substring(startIndex, endIndex);
    });

    it('should show all agent types in workflow', () => {
      const agentTypes = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

      agentTypes.forEach(agent => {
        expect(workflowExample).toMatch(new RegExp(agent));
      });
    });

    it('should display current stage information', () => {
      expect(workflowExample).toMatch(/Current Stage:/);
      expect(workflowExample).toMatch(/Active Agents:/);
      expect(workflowExample).toMatch(/Total Progress:/);
    });

    it('should show active agent details', () => {
      expect(workflowExample).toMatch(/⚡ Primary Agent:/);
      expect(workflowExample).toMatch(/Stage:.*\[.*elapsed\]/);
      expect(workflowExample).toMatch(/Progress:.*%/);
      expect(workflowExample).toMatch(/Subtasks:.*complete/);
    });

    it('should include parallel execution section', () => {
      expect(workflowExample).toMatch(/⟂ Parallel Execution/);
      expect(workflowExample).toMatch(/⟂ tester.*\[active\]/);
      expect(workflowExample).toMatch(/⟂ reviewer.*\[active\]/);
    });

    it('should display subtask breakdown', () => {
      expect(workflowExample).toMatch(/📊 Subtask Breakdown/);
      expect(workflowExample).toMatch(/✅.*Core authentication logic/);
      expect(workflowExample).toMatch(/🔄.*Frontend integration.*in progress/);
      expect(workflowExample).toMatch(/⏳.*Error handling/);
    });

    it('should include thoughts command reference', () => {
      expect(workflowExample).toMatch(/💡 Use '\/thoughts developer'/);
      expect(workflowExample).toMatch(/to see current reasoning/);
    });
  });

  describe('Agent Status Display Examples', () => {
    it('should show different agent states', () => {
      const agentStates = [
        '\\[completed\\]',
        '\\[active\\]',
        '\\[pending\\]',
        '\\[in progress\\]'
      ];

      agentStates.forEach(state => {
        expect(docContent).toMatch(new RegExp(state));
      });
    });

    it('should include timing information', () => {
      expect(docContent).toMatch(/\d+:\d+:\d+.*elapsed/); // Timer format
      expect(docContent).toMatch(/elapsed/);
    });

    it('should show task completion status', () => {
      expect(docContent).toMatch(/\d+\/\d+.*complete/); // X/Y complete format
      expect(docContent).toMatch(/complete/);
    });
  });

  describe('Parallel Execution Visual Examples', () => {
    it('should display parallel agent grid layout', () => {
      // Should show multiple agents side by side with box drawing
      expect(docContent).toMatch(/┌─.*┬─.*┐/); // Multi-column header
      expect(docContent).toMatch(/├─.*┼─.*┤/); // Multi-column separator
    });

    it('should show resource allocation information', () => {
      expect(docContent).toMatch(/Running.*integration tests/);
      expect(docContent).toMatch(/Code review.*authentication/);
    });

    it('should include progress indicators for parallel tasks', () => {
      // Each parallel agent should have its own progress
      const parallelProgressBars = docContent.match(/⟂.*████+░+.*%/g) || [];
      expect(parallelProgressBars.length).toBeGreaterThan(1);
    });
  });

  describe('Subtask Tree Visual Structure', () => {
    it('should show proper hierarchical nesting', () => {
      // Should have multiple levels of indentation
      expect(docContent).toMatch(/├─.*\n.*└─/); // Parent with children
      expect(docContent).toMatch(/└─.*\n.*├─/); // Nested structure
    });

    it('should include task status indicators in tree', () => {
      expect(docContent).toMatch(/✅.*implementation/); // Completed task
      expect(docContent).toMatch(/🔄.*in progress/);    // In progress task
      expect(docContent).toMatch(/⏳.*implementation/); // Pending task
    });

    it('should show realistic task hierarchy', () => {
      // Should have logical parent-child relationships
      expect(docContent).toMatch(/Core authentication logic.*implementation/);
      expect(docContent).toMatch(/Database schema.*updates/);
      expect(docContent).toMatch(/API endpoint.*creation/);
      expect(docContent).toMatch(/Frontend integration/);
    });
  });

  describe('Coordination Pattern Examples', () => {
    it('should document sequential handoff pattern', () => {
      expect(docContent).toMatch(/Sequential Handoffs/);
      expect(docContent).toMatch(/Traditional workflow progression/);
      expect(docContent).toMatch(/clear stage boundaries/);
    });

    it('should include visual examples of coordination patterns', () => {
      // Should have visual representations of different patterns
      expect(docContent).toMatch(/```[\s\S]*?planner.*architect.*developer[\s\S]*?```/);
    });
  });

  describe('Real-time Status Integration', () => {
    it('should show live updating elements', () => {
      expect(docContent).toMatch(/real-time/);
      expect(docContent).toMatch(/live.*update/);
      expect(docContent).toMatch(/streaming/);
    });

    it('should include websocket integration examples', () => {
      expect(docContent).toMatch(/WebSocket/);
      expect(docContent).toMatch(/events/);
    });
  });

  describe('Responsive Layout Examples', () => {
    it('should show different terminal width adaptations', () => {
      const widthModes = ['narrow', 'compact', 'normal', 'wide'];

      widthModes.forEach(mode => {
        expect(docContent).toMatch(new RegExp(mode, 'i'));
      });
    });

    it('should document layout breakpoints with examples', () => {
      expect(docContent).toMatch(/width.*60/); // Narrow
      expect(docContent).toMatch(/60-79/);     // Compact
      expect(docContent).toMatch(/80-119/);    // Normal
      expect(docContent).toMatch(/120\+/);     // Wide
    });

    it('should include column calculation examples', () => {
      expect(docContent).toMatch(/column calculation/);
      expect(docContent).toMatch(/2-4.*columns/);
      expect(docContent).toMatch(/4-6.*columns/);
    });
  });

  describe('Visual Example Consistency', () => {
    it('should use consistent naming across examples', () => {
      // Agent names should be consistent
      const agentNames = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

      agentNames.forEach(agent => {
        const occurrences = (docContent.match(new RegExp(agent, 'g')) || []).length;
        expect(occurrences).toBeGreaterThan(1); // Should appear multiple times
      });
    });

    it('should maintain consistent progress representation', () => {
      // All progress should use same format
      const progressFormats = docContent.match(/\d+%/g) || [];
      expect(progressFormats.length).toBeGreaterThan(5);

      // Should have both completed (100%) and partial progress
      expect(docContent).toMatch(/100%/);
      expect(docContent).toMatch(/[1-9][0-9]%/); // Non-100% progress
    });

    it('should use consistent time format', () => {
      // Time should be consistently formatted
      const timeFormats = docContent.match(/\d+:\d+:\d+/g) || [];
      expect(timeFormats.length).toBeGreaterThan(0);

      timeFormats.forEach(time => {
        expect(time).toMatch(/^\d{1,2}:\d{2}:\d{2}$/); // H:MM:SS or HH:MM:SS
      });
    });
  });
});