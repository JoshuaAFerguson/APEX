/**
 * Output & Feedback User Guide Content Validation Tests
 *
 * Comprehensive test suite to validate the Output & Feedback documentation
 * covering Activity Log, Error Display, and Success Celebration components.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Output & Feedback Documentation Content', () => {
  let content: string;

  beforeAll(() => {
    const docPath = path.join(__dirname, '../user-guide/output-feedback.md');
    content = fs.readFileSync(docPath, 'utf-8');
  });

  describe('Document Structure', () => {
    it('should have proper markdown structure with main title', () => {
      expect(content).toMatch(/^# Output & Feedback User Guide/m);
    });

    it('should contain all three main sections', () => {
      expect(content).toContain('## Activity Log');
      expect(content).toContain('## Error Display');
      expect(content).toContain('## Success Celebration');
    });

    it('should include overview table', () => {
      expect(content).toContain('| Component | Purpose | When It Appears |');
      expect(content).toContain('**Activity Log**');
      expect(content).toContain('**Error Display**');
      expect(content).toContain('**Success Celebration**');
    });

    it('should have integration section', () => {
      expect(content).toContain('## How Output & Feedback Components Work Together');
    });

    it('should have troubleshooting section', () => {
      expect(content).toContain('## Troubleshooting');
    });

    it('should have best practices section', () => {
      expect(content).toContain('## Tips and Best Practices');
    });
  });

  describe('Activity Log Section', () => {
    it('should document activity log features', () => {
      expect(content).toContain('Real-time activity logging');
      expect(content).toContain('filtering, search capabilities');
      expect(content).toContain('collapsible entries');
    });

    it('should include log entry types table', () => {
      expect(content).toContain('| Level | Icon | Description | Example |');
      expect(content).toContain('**debug** | 🔍');
      expect(content).toContain('**info** | ℹ️');
      expect(content).toContain('**warn** | ⚠️');
      expect(content).toContain('**error** | ❌');
      expect(content).toContain('**success** | ✅');
    });

    it('should show visual example with proper ASCII formatting', () => {
      expect(content).toContain('┌─ Activity Log ────');
      expect(content).toContain('│ Filter: error | Level: info+');
      expect(content).toContain('[10:30:45] ✅ [developer]');
      expect(content).toContain('└─────────────────────');
    });

    it('should document interactive controls', () => {
      expect(content).toContain('#### Navigation');
      expect(content).toContain('**↑↓ Arrow Keys**');
      expect(content).toContain('**Enter**');
      expect(content).toContain('**c**: Collapse');
    });

    it('should document display modes', () => {
      expect(content).toContain('#### Normal Mode');
      expect(content).toContain('#### Verbose Mode');
      expect(content).toContain('#### Compact Mode');
      expect(content).toContain('/verbose');
    });

    it('should include activity log variants', () => {
      expect(content).toContain('#### Full Activity Log');
      expect(content).toContain('#### Log Stream');
      expect(content).toContain('#### Compact Log');
    });

    it('should provide best practices examples', () => {
      expect(content).toContain('#### Use for Monitoring');
      expect(content).toContain('#### Debugging with Activity Log');
      expect(content).toContain('#### Filtering for Focus');
    });
  });

  describe('Error Display Section', () => {
    it('should document error display features', () => {
      expect(content).toContain('Intelligent error feedback system');
      expect(content).toContain('detailed error information');
      expect(content).toContain('actionable suggestions');
    });

    it('should include error categories table', () => {
      expect(content).toContain('| Error Type | Detection Pattern | Auto Suggestions |');
      expect(content).toContain('**Permission Issues**');
      expect(content).toContain('**Missing Commands**');
      expect(content).toContain('**Network Issues**');
      expect(content).toContain('**API Key Problems**');
      expect(content).toContain('**Syntax Errors**');
      expect(content).toContain('**File Not Found**');
    });

    it('should show comprehensive visual example', () => {
      expect(content).toContain('┌─ ❌ Authentication Error ────');
      expect(content).toContain('Failed to authenticate with GitHub API');
      expect(content).toContain('Context:');
      expect(content).toContain('Stack Trace');
      expect(content).toContain('💡 Suggestions:');
      expect(content).toContain('🔴 API Key Issue');
      expect(content).toContain('🟡 Configuration');
      expect(content).toContain('🟢 Documentation');
      expect(content).toContain('[D] [R]');
      expect(content).toContain('Dismiss  Retry');
    });

    it('should document suggestion priority levels', () => {
      expect(content).toContain('#### 🔴 High Priority');
      expect(content).toContain('#### 🟡 Medium Priority');
      expect(content).toContain('#### 🟢 Low Priority');
      expect(content).toContain('Most likely cause');
      expect(content).toContain('Alternative explanations');
      expect(content).toContain('Documentation references');
    });

    it('should include error display variants', () => {
      expect(content).toContain('#### Full Error Display');
      expect(content).toContain('#### Error Summary');
      expect(content).toContain('#### Validation Error');
    });

    it('should document stack trace display', () => {
      expect(content).toContain('### Stack Trace Display');
      expect(content).toContain('| Terminal Width | Normal Mode | Verbose Mode |');
      expect(content).toContain('**Narrow** (<60)');
      expect(content).toContain('**Compact** (60-100)');
      expect(content).toContain('**Normal** (100-160)');
      expect(content).toContain('**Wide** (≥160)');
    });

    it('should document interactive actions', () => {
      expect(content).toContain('#### Dismiss (D)');
      expect(content).toContain('#### Retry (R)');
      expect(content).toContain('Closes the error display');
      expect(content).toContain('Attempts the failed operation again');
    });

    it('should provide troubleshooting workflow', () => {
      expect(content).toContain('#### Troubleshooting Workflow');
      expect(content).toContain('1. Read the error message completely');
      expect(content).toContain('2. Check high-priority suggestions first');
    });
  });

  describe('Success Celebration Section', () => {
    it('should document success celebration features', () => {
      expect(content).toContain('Celebratory feedback system');
      expect(content).toContain('positive reinforcement');
      expect(content).toContain('performance metrics');
    });

    it('should include celebration types table', () => {
      expect(content).toContain('| Type | Title | Animation | Use Case |');
      expect(content).toContain('**task** | "Task Completed!" | 🎉 → ✨ → 🎊 → ✅');
      expect(content).toContain('**milestone** | "Milestone Achieved!" | 🏆');
      expect(content).toContain('**achievement** | "Achievement Unlocked!" | 👑');
      expect(content).toContain('**simple** | "Success!" | ✅');
    });

    it('should show elaborate visual example', () => {
      expect(content).toContain('✨ 🎉 ✨ 🎉 ✨');
      expect(content).toContain('🎊 🏆 🎈 🎉 🎆 🎊 🎊');
      expect(content).toContain('╔════════════════════════════════════════════╗');
      expect(content).toContain('║ 🎉 Task Completed! 🎉');
      expect(content).toContain('║ Successfully implemented user');
      expect(content).toContain('║ authentication with JWT tokens!');
      expect(content).toContain('══════ Performance Summary ══════');
      expect(content).toContain('Duration:        4m 32s');
      expect(content).toContain('Tokens Used:     2,847');
      expect(content).toContain('Cost:            $0.12');
      expect(content).toContain('Files Changed:   7');
      expect(content).toContain('Lines Added:     +234');
      expect(content).toContain('Lines Removed:   -18');
      expect(content).toContain('╚════════════════════════════════════════════╝');
    });

    it('should document performance metrics', () => {
      expect(content).toContain('#### Duration');
      expect(content).toContain('#### Token Usage');
      expect(content).toContain('#### Cost Information');
      expect(content).toContain('#### Code Changes');
      expect(content).toContain('Human-readable time');
      expect(content).toContain('Formatted with comma separators');
      expect(content).toContain('Currency format');
    });

    it('should include success celebration variants', () => {
      expect(content).toContain('#### Full Celebration');
      expect(content).toContain('#### Milestone Badge');
      expect(content).toContain('#### Progress Celebration');
      expect(content).toContain('#### Quick Success');
    });

    it('should document animation effects', () => {
      expect(content).toContain('#### Confetti Particles');
      expect(content).toContain('#### Sparkle Effects');
      expect(content).toContain('🎊 🎉 🎈 🎆');
      expect(content).toContain('✨ 💫 ⭐ 🌟 💥');
      expect(content).toContain('300ms frame intervals');
    });

    it('should include achievement badges table', () => {
      expect(content).toContain('| Rarity | Badge | Color | Description |');
      expect(content).toContain('**Common** | 🏅 ACHIEVEMENT 🏅 | Gray');
      expect(content).toContain('**Rare** | ⭐ RARE ⭐ | Green Bright');
      expect(content).toContain('**Epic** | 💎 EPIC 💎 | Blue Bright');
      expect(content).toContain('**Legendary** | ✨ LEGENDARY ✨ | Magenta Bright');
    });
  });

  describe('Integration and Cross-References', () => {
    it('should document integrated workflow', () => {
      expect(content).toContain('### Integrated Workflow');
      expect(content).toContain('Task Starts');
      expect(content).toContain('Activity Log: Real-time tracking');
      expect(content).toContain('If Error Occurs → Error Display');
      expect(content).toContain('Task Completes → Success Celebration');
    });

    it('should include display mode integration table', () => {
      expect(content).toContain('| Component | Normal | Compact | Verbose |');
      expect(content).toContain('**Activity Log** | On demand | Hidden | Always shown');
      expect(content).toContain('**Error Display** | Full display | Condensed | Enhanced');
      expect(content).toContain('**Success Celebration** | Standard animation | Quick confirmation | Full metrics');
    });

    it('should document terminal width adaptation', () => {
      expect(content).toContain('### Terminal Width Adaptation');
      expect(content).toContain('**Narrow** (<60 chars)');
      expect(content).toContain('**Compact** (60-100 chars)');
      expect(content).toContain('**Normal** (100-160 chars)');
      expect(content).toContain('**Wide** (≥160 chars)');
    });

    it('should include related features links', () => {
      expect(content).toContain('## Related Features');
      expect(content).toContain('[Display Modes](display-modes.md)');
      expect(content).toContain('[Input Preview](input-preview.md)');
      expect(content).toContain('[Session Management](../sessions.md)');
      expect(content).toContain('[Agent Workflows](../agents.md)');
      expect(content).toContain('[Command Reference](../commands.md)');
    });
  });

  describe('Interactive Examples and Code Blocks', () => {
    it('should include bash command examples', () => {
      const bashBlocks = content.match(/```bash[\s\S]*?```/g);
      expect(bashBlocks).toBeTruthy();
      expect(bashBlocks!.length).toBeGreaterThan(5);
    });

    it('should show verbose mode examples', () => {
      expect(content).toContain('/verbose');
      expect(content).toContain('implement user authentication with OAuth');
      expect(content).toContain('implement microservices architecture');
    });

    it('should include TypeScript code examples', () => {
      const tsBlocks = content.match(/```typescript[\s\S]*?```/g);
      expect(tsBlocks).toBeTruthy();
      expect(tsBlocks!.length).toBeGreaterThan(3);
    });

    it('should contain console commands for various scenarios', () => {
      expect(content).toContain('apex config set github.token');
      expect(content).toContain('apex config show github');
      expect(content).toContain('ls -la');
    });
  });

  describe('Best Practices and Tips', () => {
    it('should document effective monitoring strategies', () => {
      expect(content).toContain('### Effective Monitoring');
      expect(content).toContain('#### Use Verbose Mode for Complex Tasks');
      expect(content).toContain('#### Filter Activity Logs for Focus');
    });

    it('should provide error resolution strategy', () => {
      expect(content).toContain('### Error Resolution Strategy');
      expect(content).toContain('#### Follow the Suggestion Hierarchy');
      expect(content).toContain('1. **Try high-priority (🔴) suggestions first**');
      expect(content).toContain('#### Document Solutions');
    });

    it('should include celebrating success guidelines', () => {
      expect(content).toContain('### Celebrating Success');
      expect(content).toContain('#### Review Performance Trends');
      expect(content).toContain('#### Share Achievements');
      expect(content).toContain('Track token usage');
      expect(content).toContain('Monitor duration');
      expect(content).toContain('Observe cost patterns');
    });
  });

  describe('Troubleshooting Sections', () => {
    it('should provide activity log troubleshooting', () => {
      expect(content).toContain('### Activity Log Issues');
      expect(content).toContain('#### Log Not Appearing');
      expect(content).toContain('#### Too Much Information');
      expect(content).toContain('#### Navigation Not Working');
    });

    it('should provide error display troubleshooting', () => {
      expect(content).toContain('### Error Display Issues');
      expect(content).toContain('#### Missing Error Details');
      expect(content).toContain('#### Suggestions Not Helpful');
    });

    it('should provide success celebration troubleshooting', () => {
      expect(content).toContain('### Success Celebration Issues');
      expect(content).toContain('#### Animation Not Playing');
      expect(content).toContain('#### Missing Metrics');
    });

    it('should include specific solutions for each issue', () => {
      expect(content).toContain('1. **Enable verbose mode**: `/verbose`');
      expect(content).toContain('2. **Check display mode**: Compact mode hides');
      expect(content).toContain('1. **Wait for completion**: Animations play after');
      expect(content).toContain('1. **Ensure task completion**: Partial tasks may not');
    });
  });

  describe('Advanced Usage Section', () => {
    it('should document custom error handling', () => {
      expect(content).toContain('### Custom Error Handling');
      expect(content).toContain('# For persistent errors:');
      expect(content).toContain('# 1. Enable verbose mode for detailed tracking');
    });

    it('should document performance optimization', () => {
      expect(content).toContain('### Performance Optimization');
      expect(content).toContain('# Use success metrics to optimize:');
      expect(content).toContain('# 1. Track token usage patterns');
    });

    it('should document debugging complex workflows', () => {
      expect(content).toContain('### Debugging Complex Workflows');
      expect(content).toContain('# For multi-agent workflows:');
      expect(content).toContain('# 1. Enable verbose mode before starting');
    });
  });

  describe('Content Quality and Formatting', () => {
    it('should have consistent emoji usage throughout', () => {
      const emojiPattern = /[🎉✨🎊🏆👑✅❌⚠️ℹ️🔍🔴🟡🟢💡🚀📊]/g;
      const emojiMatches = content.match(emojiPattern);
      expect(emojiMatches).toBeTruthy();
      expect(emojiMatches!.length).toBeGreaterThan(50);
    });

    it('should use consistent formatting for UI elements', () => {
      expect(content).toContain('**Activity Log**');
      expect(content).toContain('**Error Display**');
      expect(content).toContain('**Success Celebration**');
    });

    it('should have proper table formatting', () => {
      const tableHeaders = content.match(/\|.*\|.*\|/g);
      expect(tableHeaders).toBeTruthy();
      expect(tableHeaders!.length).toBeGreaterThan(5);
    });

    it('should use consistent code block formatting', () => {
      const codeBlocks = content.match(/```[\s\S]*?```/g);
      expect(codeBlocks).toBeTruthy();
      expect(codeBlocks!.length).toBeGreaterThan(15);
    });

    it('should maintain consistent ASCII art box drawing', () => {
      expect(content).toContain('┌─');
      expect(content).toContain('└─');
      expect(content).toContain('│');
      expect(content).toContain('╔═');
      expect(content).toContain('╚═');
      expect(content).toContain('║');
    });
  });

  describe('Document Length and Comprehensiveness', () => {
    it('should be a substantial document with comprehensive content', () => {
      const lines = content.split('\n');
      expect(lines.length).toBeGreaterThan(600); // Should be over 600 lines
    });

    it('should have detailed sections for each component', () => {
      const activityLogSection = content.indexOf('## Activity Log');
      const errorDisplaySection = content.indexOf('## Error Display');
      const successCelebrationSection = content.indexOf('## Success Celebration');

      expect(activityLogSection).toBeGreaterThan(-1);
      expect(errorDisplaySection).toBeGreaterThan(activityLogSection);
      expect(successCelebrationSection).toBeGreaterThan(errorDisplaySection);
    });

    it('should include multiple subsections for each main component', () => {
      const activityLogSubsections = [
        "### What's Shown",
        "### Log Entry Types",
        "### Visual Example",
        "### Interactive Controls",
        "### Display Modes"
      ];

      activityLogSubsections.forEach(subsection => {
        expect(content).toContain(subsection);
      });
    });
  });
});