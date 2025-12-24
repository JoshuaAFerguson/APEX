import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const docsDir = path.join(__dirname, '..');
const gettingStartedPath = path.join(docsDir, 'getting-started.md');
const cliGuidePath = path.join(docsDir, 'cli-guide.md');

// Helper to read documentation files
function readDocFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Documentation file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Helper to extract all markdown links from content
function extractMarkdownLinks(content: string): Array<{ text: string; href: string; line: number }> {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const lines = content.split('\n');
  const links: Array<{ text: string; href: string; line: number }> = [];

  lines.forEach((line, index) => {
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      links.push({
        text: match[1],
        href: match[2],
        line: index + 1
      });
    }
  });

  return links;
}

// Helper to check if a relative documentation path exists
function isValidDocPath(href: string): boolean {
  if (href.startsWith('http')) return true; // External links (assume valid)
  if (href.startsWith('#')) return true; // Anchor links (assume valid)

  const docPath = path.join(docsDir, href);
  return fs.existsSync(docPath);
}

describe('Documentation Validation', () => {
  describe('getting-started.md', () => {
    let content: string;

    beforeAll(() => {
      content = readDocFile(gettingStartedPath);
    });

    it('should exist and be readable', () => {
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have required sections', () => {
      const requiredSections = [
        '# Getting Started with APEX',
        '## Prerequisites',
        '## Installation',
        '## Quick Start',
        '## Terminal Interface (v0.3.0)',
        '## Session Management Basics',
        '## Keyboard Shortcuts & Tab Completion',
        '## Autonomy Levels',
        '## Next Steps'
      ];

      requiredSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should contain v0.3.0 feature sections', () => {
      const v030Sections = [
        '## Terminal Interface (v0.3.0)',
        '### Display Modes ✨ NEW in v0.3.0',
        '### Input Preview ✨ NEW in v0.3.0'
      ];

      v030Sections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should have valid markdown links', () => {
      const links = extractMarkdownLinks(content);
      expect(links.length).toBeGreaterThan(0);

      links.forEach(link => {
        if (!link.href.startsWith('http') && !link.href.startsWith('#')) {
          expect(isValidDocPath(link.href)).toBe(true);
        }
      });
    });

    it('should contain v0.3.0 feature cross-references in Next Steps section', () => {
      const nextStepsMatch = content.match(/## Next Steps([\s\S]*?)##/);
      expect(nextStepsMatch).toBeTruthy();

      const nextStepsContent = nextStepsMatch![1];

      // Should contain v0.3.0 features section
      expect(nextStepsContent).toContain('### ✨ NEW in v0.3.0 - Enhanced Features');

      // Should link to v0.3.0 features overview
      expect(nextStepsContent).toMatch(/\[.*v0\.3\.0.*Features.*Overview.*\]\(features\/v030-features\.md\)/);

      // Should link to display modes guide
      expect(nextStepsContent).toMatch(/\[.*Display.*Modes.*Guide.*\]\(user-guide\/display-modes\.md\)/);

      // Should link to input preview guide
      expect(nextStepsContent).toMatch(/\[.*Input.*Preview.*Guide.*\]\(user-guide\/input-preview\.md\)/);
    });

    it('should contain v0.3.0 features in Terminal Interface section', () => {
      const terminalInterfaceMatch = content.match(/## Terminal Interface \(v0\.3\.0\)([\s\S]*?)## Session Management/);
      expect(terminalInterfaceMatch).toBeTruthy();

      const terminalContent = terminalInterfaceMatch![1];

      // Should have display modes section
      expect(terminalContent).toContain('### Display Modes ✨ NEW in v0.3.0');
      expect(terminalContent).toContain('See [Display Modes Guide](user-guide/display-modes.md)');

      // Should have input preview section
      expect(terminalContent).toContain('### Input Preview ✨ NEW in v0.3.0');
      expect(terminalContent).toContain('See [Input Preview Guide](user-guide/input-preview.md)');

      // Should describe three display modes
      expect(terminalContent).toContain('**Three Display Modes:**');
      expect(terminalContent).toContain('- **Normal** - Balanced information display (default)');
      expect(terminalContent).toContain('- **Compact** - Minimal display for focus or small terminals');
      expect(terminalContent).toContain('- **Verbose** - Maximum information for debugging and analysis');
    });

    it('should have proper keyboard shortcuts documentation', () => {
      const shortcutsMatch = content.match(/### Interactive Controls([\s\S]*?)### Color-coded Output/);
      expect(shortcutsMatch).toBeTruthy();

      const shortcutsContent = shortcutsMatch![1];

      // Should contain v0.3.0 display mode shortcuts
      expect(shortcutsContent).toContain('/compact');
      expect(shortcutsContent).toContain('/verbose');
      expect(shortcutsContent).toContain('/preview on|off');
    });
  });

  describe('cli-guide.md', () => {
    let content: string;

    beforeAll(() => {
      content = readDocFile(cliGuidePath);
    });

    it('should exist and be readable', () => {
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should have required sections', () => {
      const requiredSections = [
        '# APEX CLI Guide',
        '## Getting Started',
        '## Starting APEX',
        '## REPL Commands',
        '## Session Management',
        '## Display Modes',
        '## Keyboard Shortcuts',
        '## Natural Language Tasks',
        '## Related Documentation'
      ];

      requiredSections.forEach(section => {
        expect(content).toContain(section);
      });
    });

    it('should contain v0.3.0 feature references in header', () => {
      const headerMatch = content.match(/^# APEX CLI Guide([\s\S]*?)---/);
      expect(headerMatch).toBeTruthy();

      const headerContent = headerMatch![1];

      // Should reference v0.3.0 features overview
      expect(headerContent).toContain('**✨ NEW in v0.3.0**: See the [Complete v0.3.0 Features Overview](features/v030-features.md)');
    });

    it('should have v0.3.0 features in Getting Started section', () => {
      const gettingStartedMatch = content.match(/## Getting Started([\s\S]*?)---/);
      expect(gettingStartedMatch).toBeTruthy();

      const gettingStartedContent = gettingStartedMatch![1];

      // Should mention v0.3.0 features
      expect(gettingStartedContent).toContain('### ✨ What\'s New in v0.3.0');

      // Should link to feature guides
      expect(gettingStartedContent).toContain('[Display Modes](#display-modes)');
      expect(gettingStartedContent).toContain('[Input Preview](#preview---toggle-preview-mode--new-in-v030)');
      expect(gettingStartedContent).toContain('[Enhanced Session Management](#session-management)');
      expect(gettingStartedContent).toContain('[Advanced Keyboard Shortcuts](#keyboard-shortcuts)');

      // Should link to complete overview
      expect(gettingStartedContent).toContain('[Complete v0.3.0 Features Overview](features/v030-features.md)');
    });

    it('should have enhanced display modes section', () => {
      const displayModesMatch = content.match(/## Display Modes([\s\S]*?)---/);
      expect(displayModesMatch).toBeTruthy();

      const displayModesContent = displayModesMatch![1];

      // Should reference v0.3.0 enhancement
      expect(displayModesContent).toContain('> **✨ NEW in v0.3.0**: Enhanced display modes');

      // Should link to detailed guide
      expect(displayModesContent).toContain('[Display Modes User Guide](user-guide/display-modes.md)');

      // Should describe all three modes
      expect(displayModesContent).toContain('| `normal` | Standard display');
      expect(displayModesContent).toContain('| `compact` | Condensed output');
      expect(displayModesContent).toContain('| `verbose` | Detailed debug');
    });

    it('should have input preview section', () => {
      expect(content).toContain('### `/preview` - Toggle Preview Mode ✨ NEW in v0.3.0');

      const previewMatch = content.match(/### `\/preview` - Toggle Preview Mode ✨ NEW in v0\.3\.0([\s\S]*?)---/);
      expect(previewMatch).toBeTruthy();

      const previewContent = previewMatch![1];

      // Should link to detailed guide
      expect(previewContent).toContain('[Input Preview User Guide](user-guide/input-preview.md)');
    });

    it('should have enhanced session management', () => {
      const sessionMatch = content.match(/## Session Management([\s\S]*?)---/);
      expect(sessionMatch).toBeTruthy();

      const sessionContent = sessionMatch![1];

      // Should reference v0.3.0 enhancements
      expect(sessionContent).toContain('> **✨ NEW in v0.3.0**: Enhanced session management');
    });

    it('should have enhanced keyboard shortcuts', () => {
      const shortcutsMatch = content.match(/## Keyboard Shortcuts([\s\S]*?)---/);
      expect(shortcutsMatch).toBeTruthy();

      const shortcutsContent = shortcutsMatch![1];

      // Should reference v0.3.0 enhancements
      expect(shortcutsContent).toContain('> **✨ NEW in v0.3.0**: Enhanced keyboard shortcuts');
    });

    it('should have Related Documentation section with v0.3.0 links', () => {
      const relatedDocsMatch = content.match(/## Related Documentation([\s\S]*)$/);
      expect(relatedDocsMatch).toBeTruthy();

      const relatedDocsContent = relatedDocsMatch![1];

      // Should have v0.3.0 features section
      expect(relatedDocsContent).toContain('### ✨ v0.3.0 Features');

      // Should link to all v0.3.0 guides
      expect(relatedDocsContent).toContain('[Complete v0.3.0 Features Overview](features/v030-features.md)');
      expect(relatedDocsContent).toContain('[Display Modes User Guide](user-guide/display-modes.md)');
      expect(relatedDocsContent).toContain('[Input Preview User Guide](user-guide/input-preview.md)');

      // Should also reference getting-started with v0.3.0 examples
      expect(relatedDocsContent).toContain('[Getting Started Guide](getting-started.md)');
      expect(relatedDocsContent).toContain('Quick start tutorial with v0.3.0 terminal interface examples');
    });

    it('should have valid markdown links', () => {
      const links = extractMarkdownLinks(content);
      expect(links.length).toBeGreaterThan(0);

      links.forEach(link => {
        if (!link.href.startsWith('http') && !link.href.startsWith('#')) {
          expect(isValidDocPath(link.href)).toBe(true);
        }
      });
    });
  });

  describe('Cross-Reference Consistency', () => {
    let gettingStartedContent: string;
    let cliGuideContent: string;

    beforeAll(() => {
      gettingStartedContent = readDocFile(gettingStartedPath);
      cliGuideContent = readDocFile(cliGuidePath);
    });

    it('should have consistent v0.3.0 feature links between documents', () => {
      const expectedLinks = [
        'features/v030-features.md',
        'user-guide/display-modes.md',
        'user-guide/input-preview.md'
      ];

      expectedLinks.forEach(link => {
        expect(gettingStartedContent).toContain(link);
        expect(cliGuideContent).toContain(link);
      });
    });

    it('should cross-reference each other appropriately', () => {
      // getting-started should link to cli-guide
      expect(gettingStartedContent).toContain('[CLI Guide](cli-guide.md)');

      // cli-guide should link to getting-started
      expect(cliGuideContent).toContain('[Getting Started Guide](getting-started.md)');
    });

    it('should have consistent v0.3.0 feature descriptions', () => {
      const expectedFeatures = [
        'Display Modes',
        'Input Preview',
        'Enhanced Session Management',
        'Advanced Keyboard Shortcuts'
      ];

      expectedFeatures.forEach(feature => {
        expect(gettingStartedContent).toContain(feature);
        expect(cliGuideContent).toContain(feature);
      });
    });

    it('should both reference the same v0.3.0 overview document', () => {
      const overviewLink = 'features/v030-features.md';

      // Both should link to the overview
      expect(gettingStartedContent).toContain(overviewLink);
      expect(cliGuideContent).toContain(overviewLink);

      // Both should mention it as "Complete v0.3.0 Features Overview"
      const overviewText = 'Complete v0.3.0 Features Overview';
      expect(gettingStartedContent).toContain(overviewText);
      expect(cliGuideContent).toContain(overviewText);
    });
  });

  describe('v0.3.0 Feature Highlights', () => {
    let gettingStartedContent: string;
    let cliGuideContent: string;

    beforeAll(() => {
      gettingStartedContent = readDocFile(gettingStartedPath);
      cliGuideContent = readDocFile(cliGuidePath);
    });

    it('should highlight display modes with proper examples', () => {
      // getting-started should show examples
      expect(gettingStartedContent).toContain('/compact');
      expect(gettingStartedContent).toContain('/verbose');
      expect(gettingStartedContent).toContain('● main | $0.0425');

      // cli-guide should have command descriptions
      expect(cliGuideContent).toContain('### `/compact` - Toggle Compact Mode');
      expect(cliGuideContent).toContain('### `/verbose` - Toggle Verbose Mode');
    });

    it('should highlight input preview with examples', () => {
      // getting-started should show preview box example
      expect(gettingStartedContent).toContain('┌─ Input Preview ─');
      expect(gettingStartedContent).toContain('Intent: task_execution');
      expect(gettingStartedContent).toContain('[Enter] Execute  [Escape] Cancel  [E] Edit');

      // cli-guide should have command description
      expect(cliGuideContent).toContain('### `/preview` - Toggle Preview Mode ✨ NEW in v0.3.0');
    });

    it('should properly mark new features with emojis', () => {
      const newFeatureMarkers = ['✨ NEW in v0.3.0'];

      newFeatureMarkers.forEach(marker => {
        expect(gettingStartedContent).toContain(marker);
        expect(cliGuideContent).toContain(marker);
      });
    });

    it('should show enhanced progress indicators', () => {
      // getting-started should show the enhanced progress box
      expect(gettingStartedContent).toContain('┌─ Task Progress ──');
      expect(gettingStartedContent).toContain('Stage: implementation [■■■■■■■░░░] 70%');
      expect(gettingStartedContent).toContain('Agent: developer');
      expect(gettingStartedContent).toContain('Recent Actions:');
    });
  });
});