import { describe, it, expect, beforeEach } from 'vitest';
import { ShortcutManager } from '../services/ShortcutManager';
import * as fs from 'fs';
import * as path from 'path';

interface DocumentedShortcut {
  shortcut: string;
  description: string;
  context: string;
  category: string;
}

describe('Keyboard Shortcuts Documentation Validation', () => {
  let manager: ShortcutManager;
  let documentedShortcuts: DocumentedShortcut[] = [];

  beforeEach(() => {
    manager = new ShortcutManager();
    documentedShortcuts = parseDocumentedShortcuts();
  });

  describe('documentation completeness', () => {
    it('should document all 22 implemented shortcuts', () => {
      const implementedShortcuts = manager.getShortcuts();
      expect(implementedShortcuts).toHaveLength(22);
      expect(documentedShortcuts.length).toBeGreaterThanOrEqual(22);
    });

    it('should have all implemented shortcuts documented', () => {
      const implementedShortcuts = manager.getShortcuts();
      const documentedKeys = new Set(documentedShortcuts.map(d => normalizeShortcutKey(d.shortcut)));

      for (const shortcut of implementedShortcuts) {
        const formattedKey = manager.formatKey(shortcut.keys);
        const normalizedKey = normalizeShortcutKey(formattedKey);

        expect(documentedKeys.has(normalizedKey),
          `Shortcut "${formattedKey}" (${shortcut.description}) is implemented but not documented`)
          .toBe(true);
      }
    });

    it('should have accurate descriptions for all shortcuts', () => {
      const implementedShortcuts = manager.getShortcuts();
      const docShortcutMap = new Map<string, DocumentedShortcut>();

      for (const doc of documentedShortcuts) {
        docShortcutMap.set(normalizeShortcutKey(doc.shortcut), doc);
      }

      for (const shortcut of implementedShortcuts) {
        const formattedKey = manager.formatKey(shortcut.keys);
        const normalizedKey = normalizeShortcutKey(formattedKey);
        const documented = docShortcutMap.get(normalizedKey);

        if (documented) {
          // Allow for slight variations in description wording
          expect(documented.description.toLowerCase())
            .toContain(getKeyDescriptionWords(shortcut.description.toLowerCase()));
        }
      }
    });

    it('should not document non-existent shortcuts', () => {
      const implementedKeys = new Set();
      const implementedShortcuts = manager.getShortcuts();

      for (const shortcut of implementedShortcuts) {
        const formattedKey = manager.formatKey(shortcut.keys);
        implementedKeys.add(normalizeShortcutKey(formattedKey));
      }

      for (const doc of documentedShortcuts) {
        const normalizedKey = normalizeShortcutKey(doc.shortcut);
        expect(implementedKeys.has(normalizedKey),
          `Documentation includes non-existent shortcut: ${doc.shortcut}`)
          .toBe(true);
      }
    });
  });

  describe('documentation accuracy by category', () => {
    it('should correctly categorize global shortcuts', () => {
      const globalShortcuts = manager.getShortcuts().filter(
        s => !s.context || s.context === 'global'
      );

      const documentedGlobalShortcuts = documentedShortcuts.filter(
        d => d.category === 'Global Shortcuts' || d.context.toLowerCase().includes('global')
      );

      // Check that key global shortcuts are properly categorized
      const globalShortcutIds = ['exit', 'clear', 'dismiss', 'quickSave', 'help'];
      for (const id of globalShortcutIds) {
        const impl = globalShortcuts.find(s => s.id === id);
        if (impl) {
          const formattedKey = manager.formatKey(impl.keys);
          const docShortcut = documentedShortcuts.find(
            d => normalizeShortcutKey(d.shortcut) === normalizeShortcutKey(formattedKey)
          );

          if (docShortcut) {
            expect(docShortcut.context.toLowerCase())
              .toContain('global');
          }
        }
      }
    });

    it('should correctly categorize input context shortcuts', () => {
      const inputShortcuts = manager.getShortcuts().filter(
        s => s.context === 'input'
      );

      // Check that key input shortcuts are properly categorized
      const inputShortcutIds = ['clearLine', 'deleteWord', 'previousHistory', 'nextHistory', 'complete'];
      for (const id of inputShortcutIds) {
        const impl = inputShortcuts.find(s => s.id === id);
        if (impl) {
          const formattedKey = manager.formatKey(impl.keys);
          const docShortcut = documentedShortcuts.find(
            d => normalizeShortcutKey(d.shortcut) === normalizeShortcutKey(formattedKey)
          );

          if (docShortcut) {
            expect(docShortcut.context.toLowerCase())
              .toMatch(/(input|editing|history)/);
          }
        }
      }
    });

    it('should correctly categorize session management shortcuts', () => {
      const sessionShortcuts = manager.getShortcuts().filter(
        s => s.id.includes('session') || s.id === 'quickSave'
      );

      for (const shortcut of sessionShortcuts) {
        const formattedKey = manager.formatKey(shortcut.keys);
        const docShortcut = documentedShortcuts.find(
          d => normalizeShortcutKey(d.shortcut) === normalizeShortcutKey(formattedKey)
        );

        if (docShortcut) {
          expect(docShortcut.category.toLowerCase() || docShortcut.context.toLowerCase())
            .toMatch(/(session|management)/);
        }
      }
    });

    it('should correctly categorize quick command shortcuts', () => {
      const quickCommandIds = ['status', 'agents', 'workflows', 'toggleThoughts'];
      const quickCommandShortcuts = manager.getShortcuts().filter(
        s => quickCommandIds.includes(s.id)
      );

      for (const shortcut of quickCommandShortcuts) {
        const formattedKey = manager.formatKey(shortcut.keys);
        const docShortcut = documentedShortcuts.find(
          d => normalizeShortcutKey(d.shortcut) === normalizeShortcutKey(formattedKey)
        );

        if (docShortcut) {
          expect(docShortcut.category.toLowerCase() || docShortcut.context.toLowerCase())
            .toMatch(/(quick|command|status|agent|workflow|thought)/);
        }
      }
    });
  });

  describe('shortcut format consistency', () => {
    it('should use consistent key combination format in documentation', () => {
      for (const doc of documentedShortcuts) {
        // Check format: should be like "Ctrl+D", "Ctrl+Shift+S", "Tab", "Enter", etc.
        expect(doc.shortcut).toMatch(/^(?:(?:Ctrl|Alt|Shift|Cmd)\+)*[A-Z][a-z]*$/);
      }
    });

    it('should have proper table structure with all required columns', () => {
      for (const doc of documentedShortcuts) {
        expect(doc.shortcut).toBeTruthy();
        expect(doc.description).toBeTruthy();
        expect(doc.context).toBeTruthy();
        expect(doc.category).toBeTruthy();
      }
    });
  });

  describe('context awareness documentation', () => {
    it('should document context stack system', () => {
      const docContent = getDocumentationContent();
      expect(docContent).toContain('Context Stack System');
      expect(docContent).toContain('Global');
      expect(docContent).toContain('Input');
      expect(docContent).toContain('Processing');
    });

    it('should explain smart context switching', () => {
      const docContent = getDocumentationContent();
      expect(docContent).toContain('Smart Context Switching');
      expect(docContent).toMatch(/automatically.*based.*activity/i);
    });

    it('should provide quick reference card', () => {
      const docContent = getDocumentationContent();
      expect(docContent).toContain('Quick Reference Card');
      expect(docContent).toContain('Essential');
      expect(docContent).toContain('Ctrl+D');
      expect(docContent).toContain('Ctrl+C');
    });
  });

  describe('v0.3.0 feature documentation', () => {
    it('should highlight new v0.3.0 features', () => {
      const docContent = getDocumentationContent();
      expect(docContent).toContain('NEW in v0.3.0');
      expect(docContent).toContain('22 shortcuts');
      expect(docContent).toContain('context-aware');
    });

    it('should document all 22 shortcuts as claimed', () => {
      expect(documentedShortcuts).toHaveLength(22);

      // Also verify against implementation
      const implementedShortcuts = manager.getShortcuts();
      expect(implementedShortcuts).toHaveLength(22);
    });
  });

  describe('accessibility and usability', () => {
    it('should organize shortcuts by logical categories', () => {
      const categories = [...new Set(documentedShortcuts.map(d => d.category))];

      // Should have meaningful categories
      expect(categories.some(c => c.toLowerCase().includes('global'))).toBe(true);
      expect(categories.some(c => c.toLowerCase().includes('session'))).toBe(true);
      expect(categories.some(c => c.toLowerCase().includes('input'))).toBe(true);
      expect(categories.some(c => c.toLowerCase().includes('history'))).toBe(true);
    });

    it('should provide clear descriptions', () => {
      for (const doc of documentedShortcuts) {
        // Descriptions should be clear and not just repeat the key
        expect(doc.description.length).toBeGreaterThan(5);
        expect(doc.description).not.toBe(doc.shortcut);
      }
    });
  });
});

function parseDocumentedShortcuts(): DocumentedShortcut[] {
  const shortcuts: DocumentedShortcut[] = [];
  const docContent = getDocumentationContent();

  // Parse the markdown tables in the keyboard shortcuts section
  const lines = docContent.split('\n');
  let currentCategory = '';
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect category headers
    if (line.startsWith('###')) {
      currentCategory = line.replace(/^###\s*/, '').replace(/\*/g, '');
      inTable = false;
      continue;
    }

    // Detect table headers
    if (line.includes('Shortcut') && line.includes('Description') && line.includes('Context')) {
      inTable = true;
      continue;
    }

    // Skip table separator
    if (line.match(/^\|[-\s|:]+\|$/)) {
      continue;
    }

    // Parse table rows
    if (inTable && line.startsWith('|') && !line.includes('Shortcut')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');

      if (parts.length >= 3) {
        shortcuts.push({
          shortcut: parts[0].replace(/`/g, ''),
          description: parts[1],
          context: parts[2],
          category: currentCategory
        });
      }
    }
  }

  return shortcuts;
}

function getDocumentationContent(): string {
  const docsPath = path.join(__dirname, '../../../docs/cli-guide.md');
  return fs.readFileSync(docsPath, 'utf8');
}

function normalizeShortcutKey(key: string): string {
  return key
    .replace(/`/g, '')
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/CMD/g, 'META')
    .replace(/CONTROL/g, 'CTRL');
}

function getKeyDescriptionWords(description: string): string {
  // Extract key words from description for flexible matching
  const words = description.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  return words.slice(0, 2).join('|'); // Use first two meaningful words
}