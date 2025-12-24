import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const docsDir = path.join(__dirname, '..');

// Helper to read documentation files
function readDocFile(filePath: string): string {
  const fullPath = path.join(docsDir, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Documentation file not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// Helper to check if file exists
function fileExists(filePath: string): boolean {
  const fullPath = path.join(docsDir, filePath);
  return fs.existsSync(fullPath);
}

describe('v0.3.0 Features Integration Tests', () => {
  describe('Feature Document Existence', () => {
    it('should have all referenced v0.3.0 feature documents', () => {
      const requiredDocs = [
        'features/v030-features.md',
        'user-guide/display-modes.md',
        'user-guide/input-preview.md'
      ];

      requiredDocs.forEach(doc => {
        expect(fileExists(doc)).toBe(true);
      });
    });
  });

  describe('Cross-Reference Validation', () => {
    const mainDocs = ['getting-started.md', 'cli-guide.md'];

    mainDocs.forEach(docPath => {
      describe(`${docPath} cross-references`, () => {
        let content: string;

        beforeAll(() => {
          content = readDocFile(docPath);
        });

        it('should link to Complete v0.3.0 Features Overview', () => {
          const overviewLink = 'features/v030-features.md';
          const overviewText = 'Complete v0.3.0 Features Overview';

          expect(content).toContain(overviewLink);
          expect(content).toContain(overviewText);

          // Should have proper markdown link syntax
          expect(content).toMatch(new RegExp(`\\[.*${overviewText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\\]\\(${overviewLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
        });

        it('should link to Display Modes User Guide', () => {
          const displayModesLink = 'user-guide/display-modes.md';
          const displayModesText = 'Display Modes';

          expect(content).toContain(displayModesLink);
          expect(content).toContain(displayModesText);

          // Should have proper markdown link
          expect(content).toMatch(/\[.*Display.*Modes.*Guide.*\]\(user-guide\/display-modes\.md\)/);
        });

        it('should link to Input Preview User Guide', () => {
          const inputPreviewLink = 'user-guide/input-preview.md';
          const inputPreviewText = 'Input Preview';

          expect(content).toContain(inputPreviewLink);
          expect(content).toContain(inputPreviewText);

          // Should have proper markdown link
          expect(content).toMatch(/\[.*Input.*Preview.*Guide.*\]\(user-guide\/input-preview\.md\)/);
        });

        it('should contain v0.3.0 version references', () => {
          // Should mention v0.3.0 in multiple contexts
          expect(content).toMatch(/v0\.3\.0/);
          expect(content).toMatch(/✨.*NEW.*v0\.3\.0/);
        });

        it('should have consistent link text patterns', () => {
          // Feature overview should be consistently named
          const overviewMatches = content.match(/\[.*v0\.3\.0.*Features.*Overview.*\]/g);
          if (overviewMatches) {
            overviewMatches.forEach(match => {
              expect(match).toMatch(/Complete.*v0\.3\.0.*Features.*Overview/);
            });
          }

          // User guides should be consistently named
          const userGuideMatches = content.match(/\[.*Guide.*\]\(user-guide\//g);
          if (userGuideMatches) {
            userGuideMatches.forEach(match => {
              expect(match).toMatch(/(Display Modes|Input Preview).*Guide/);
            });
          }
        });
      });
    });
  });

  describe('Feature Content Verification', () => {
    describe('Display Modes Feature', () => {
      it('should be documented in getting-started.md with examples', () => {
        const content = readDocFile('getting-started.md');

        // Should have dedicated section
        expect(content).toContain('### Display Modes ✨ NEW in v0.3.0');

        // Should explain the three modes
        expect(content).toContain('**Three Display Modes:**');
        expect(content).toContain('- **Normal** - Balanced information display (default)');
        expect(content).toContain('- **Compact** - Minimal display for focus or small terminals');
        expect(content).toContain('- **Verbose** - Maximum information for debugging and analysis');

        // Should show example commands
        expect(content).toContain('/compact');
        expect(content).toContain('/verbose');

        // Should link to detailed guide
        expect(content).toContain('See [Display Modes Guide](user-guide/display-modes.md)');
      });

      it('should be documented in cli-guide.md with command details', () => {
        const content = readDocFile('cli-guide.md');

        // Should have dedicated section
        expect(content).toContain('## Display Modes');
        expect(content).toContain('> **✨ NEW in v0.3.0**: Enhanced display modes');

        // Should have mode descriptions
        expect(content).toContain('| `normal` | Standard display');
        expect(content).toContain('| `compact` | Condensed output');
        expect(content).toContain('| `verbose` | Detailed debug');

        // Should have command sections
        expect(content).toContain('### `/compact` - Toggle Compact Mode');
        expect(content).toContain('### `/verbose` - Toggle Verbose Mode');

        // Should link to detailed guide
        expect(content).toContain('[Display Modes User Guide](user-guide/display-modes.md)');
      });
    });

    describe('Input Preview Feature', () => {
      it('should be documented in getting-started.md with examples', () => {
        const content = readDocFile('getting-started.md');

        // Should have dedicated section
        expect(content).toContain('### Input Preview ✨ NEW in v0.3.0');

        // Should show example preview box
        expect(content).toContain('┌─ Input Preview ─');
        expect(content).toContain('Intent: task_execution');
        expect(content).toContain('[Enter] Execute  [Escape] Cancel  [E] Edit');

        // Should explain benefits
        expect(content).toContain('**Benefits of Input Preview:**');
        expect(content).toContain('- Verify your intent before execution');
        expect(content).toContain('- See confidence levels for command interpretation');

        // Should link to detailed guide
        expect(content).toContain('See [Input Preview Guide](user-guide/input-preview.md)');
      });

      it('should be documented in cli-guide.md with command details', () => {
        const content = readDocFile('cli-guide.md');

        // Should have command section
        expect(content).toContain('### `/preview` - Toggle Preview Mode ✨ NEW in v0.3.0');

        // Should link to detailed guide
        expect(content).toContain('[Input Preview User Guide](user-guide/input-preview.md)');

        // Should have usage examples
        expect(content).toContain('/preview on');
        expect(content).toContain('/preview off');
      });
    });

    describe('Enhanced Session Management', () => {
      it('should be mentioned in getting-started.md', () => {
        const content = readDocFile('getting-started.md');

        // Should have session management section
        expect(content).toContain('## Session Management Basics');

        // Should mention persistence features
        expect(content).toContain('Sessions survive terminal disconnections');
        expect(content).toContain('Task state is automatically saved');
      });

      it('should be enhanced in cli-guide.md', () => {
        const content = readDocFile('cli-guide.md');

        // Should reference v0.3.0 enhancements
        expect(content).toContain('> **✨ NEW in v0.3.0**: Enhanced session management');

        // Should have session commands
        expect(content).toContain('/session list');
        expect(content).toContain('/session save');
        expect(content).toContain('/session branch');
      });
    });

    describe('Enhanced Keyboard Shortcuts', () => {
      it('should include new shortcuts in getting-started.md', () => {
        const content = readDocFile('getting-started.md');

        // Should mention display mode shortcuts
        expect(content).toContain('/compact');
        expect(content).toContain('/verbose');
        expect(content).toContain('/preview on|off');
      });

      it('should be enhanced in cli-guide.md', () => {
        const content = readDocFile('cli-guide.md');

        // Should reference v0.3.0 enhancements
        expect(content).toContain('> **✨ NEW in v0.3.0**: Enhanced keyboard shortcuts');

        // Should have comprehensive shortcut tables
        expect(content).toContain('### Global Shortcuts');
        expect(content).toContain('### Input Shortcuts');
        expect(content).toContain('### Auto-Completion');
      });
    });
  });

  describe('Feature Navigation Consistency', () => {
    it('should have consistent navigation between getting-started and cli-guide', () => {
      const gettingStarted = readDocFile('getting-started.md');
      const cliGuide = readDocFile('cli-guide.md');

      // Both should cross-reference each other
      expect(gettingStarted).toContain('[CLI Guide](cli-guide.md)');
      expect(cliGuide).toContain('[Getting Started Guide](getting-started.md)');

      // Both should reference the same v0.3.0 overview
      const overviewLink = 'features/v030-features.md';
      expect(gettingStarted).toContain(overviewLink);
      expect(cliGuide).toContain(overviewLink);

      // Both should mention v0.3.0 terminal interface examples
      expect(cliGuide).toContain('Quick start tutorial with v0.3.0 terminal interface examples');
    });

    it('should have proper section organization for v0.3.0 features', () => {
      const gettingStarted = readDocFile('getting-started.md');
      const cliGuide = readDocFile('cli-guide.md');

      // getting-started should have features embedded in workflow
      expect(gettingStarted).toContain('## Terminal Interface (v0.3.0)');
      expect(gettingStarted).toContain('### Display Modes ✨ NEW in v0.3.0');
      expect(gettingStarted).toContain('### Input Preview ✨ NEW in v0.3.0');

      // cli-guide should have dedicated sections
      expect(cliGuide).toContain('## Display Modes');
      expect(cliGuide).toContain('### `/preview` - Toggle Preview Mode ✨ NEW in v0.3.0');

      // Both should have "Related Documentation" or "Next Steps" sections
      expect(gettingStarted).toContain('## Next Steps');
      expect(cliGuide).toContain('## Related Documentation');
    });

    it('should maintain consistent feature ordering and naming', () => {
      const gettingStarted = readDocFile('getting-started.md');
      const cliGuide = readDocFile('cli-guide.md');

      // Feature names should be consistent
      const featureNames = [
        'Display Modes',
        'Input Preview',
        'Enhanced Session Management',
        'Advanced Keyboard Shortcuts'
      ];

      featureNames.forEach(featureName => {
        expect(gettingStarted).toContain(featureName);
        expect(cliGuide).toContain(featureName);
      });

      // Links should use consistent text
      const linkTexts = [
        'Complete v0.3.0 Features Overview',
        'Display Modes Guide',
        'Input Preview Guide'
      ];

      linkTexts.forEach(linkText => {
        expect(gettingStarted).toContain(linkText);
        expect(cliGuide).toContain(linkText);
      });
    });
  });

  describe('User Experience Flow', () => {
    it('should provide clear learning path from getting-started to detailed guides', () => {
      const gettingStarted = readDocFile('getting-started.md');

      // Should introduce features with examples
      expect(gettingStarted).toContain('Toggle compact mode for minimal display');
      expect(gettingStarted).toContain('Preview what will be sent to Claude before executing commands');

      // Should direct to comprehensive documentation
      expect(gettingStarted).toContain('See [Display Modes Guide](user-guide/display-modes.md) for complete details');
      expect(gettingStarted).toContain('See [Input Preview Guide](user-guide/input-preview.md) for complete details');

      // Should have overview link for deeper understanding
      expect(gettingStarted).toContain('[Complete v0.3.0 Features Overview](features/v030-features.md)');
    });

    it('should provide comprehensive reference in cli-guide', () => {
      const cliGuide = readDocFile('cli-guide.md');

      // Should start with overview of what's new
      expect(cliGuide).toContain('### ✨ What\'s New in v0.3.0');

      // Should link to specific feature sections
      expect(cliGuide).toContain('[Display Modes](#display-modes)');
      expect(cliGuide).toContain('[Input Preview](#preview---toggle-preview-mode--new-in-v030)');

      // Should end with related documentation section
      expect(cliGuide).toContain('### ✨ v0.3.0 Features');
    });
  });
});