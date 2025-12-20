import { describe, it, expect } from 'vitest';
import { ShortcutManager } from '../services/ShortcutManager';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple test to validate the exact count of keyboard shortcuts
 * as claimed in the v0.3.0 documentation (22 shortcuts)
 */
describe('Keyboard Shortcuts Count Validation', () => {
  it('should have exactly 22 shortcuts as documented in v0.3.0', () => {
    const manager = new ShortcutManager();
    const shortcuts = manager.getShortcuts();

    // The documentation specifically claims 22 shortcuts
    expect(shortcuts).toHaveLength(22);
  });

  it('should document exactly 22 shortcuts in the CLI guide', () => {
    const docsPath = path.join(__dirname, '../../../docs/cli-guide.md');
    const content = fs.readFileSync(docsPath, 'utf8');

    // Count documented shortcut table rows
    const shortcutRows = content
      .split('\n')
      .filter(line => {
        // Match table rows with shortcuts (backtick-enclosed key combos)
        return line.match(/^\|\s*`[^`]+`\s*\|.*\|.*\|/);
      })
      .filter(line => {
        // Exclude non-shortcut table rows
        return !line.includes('ANTHROPIC_API_KEY') &&
               !line.includes('/help') &&
               !line.includes('--yes') &&
               !line.includes('normal') &&
               !line.includes('pending');
      });

    expect(shortcutRows).toHaveLength(22);
  });

  it('should have all documented shortcuts implemented', () => {
    const manager = new ShortcutManager();
    const implementedShortcuts = manager.getShortcuts();

    // Expected shortcuts based on documentation analysis
    const expectedShortcuts = [
      'cancel',      // Ctrl+C
      'exit',        // Ctrl+D
      'clear',       // Ctrl+L
      'dismiss',     // Escape
      'quickSave',   // Ctrl+S
      'help',        // Ctrl+H
      'sessionInfo', // Ctrl+Shift+I
      'sessionList', // Ctrl+Shift+L
      'status',      // Ctrl+Shift+S
      'agents',      // Ctrl+Shift+A
      'workflows',   // Ctrl+Shift+W
      'toggleThoughts', // Ctrl+T
      'clearLine',   // Ctrl+U
      'deleteWord',  // Ctrl+W
      'beginningOfLine', // Ctrl+A
      'endOfLine',   // Ctrl+E
      'submit',      // Enter
      'newline',     // Shift+Enter
      'complete',    // Tab
      'previousHistory', // Ctrl+P
      'nextHistory', // Ctrl+N
      'historySearch' // Ctrl+R
    ];

    expect(expectedShortcuts).toHaveLength(22);

    // Verify all expected shortcuts are implemented
    for (const expectedId of expectedShortcuts) {
      const found = implementedShortcuts.find(s => s.id === expectedId);
      expect(found, `Shortcut ${expectedId} should be implemented`).toBeDefined();
    }

    // Verify no extra shortcuts beyond the 22
    expect(implementedShortcuts).toHaveLength(22);
  });

  it('should match the v0.3.0 feature claim of "All 22 shortcuts"', () => {
    const docsPath = path.join(__dirname, '../../../docs/cli-guide.md');
    const content = fs.readFileSync(docsPath, 'utf8');

    // Verify the documentation mentions 22 shortcuts
    expect(content).toContain('22 shortcuts');

    // Verify this is specifically mentioned in the v0.3.0 section
    const v030Section = content
      .split('NEW in v0.3.0')[1]
      ?.split('---')[0] || '';

    expect(v030Section).toContain('22 shortcuts');
  });
});