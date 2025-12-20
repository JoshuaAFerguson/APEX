/**
 * Keyboard Shortcuts Test Validation
 *
 * This utility validates the test structure and provides a summary
 * of test coverage for the keyboard shortcuts functionality.
 */

import { ShortcutManager } from '../services/ShortcutManager';
import * as fs from 'fs';
import * as path from 'path';

export interface TestValidationReport {
  implementedShortcuts: number;
  documentedShortcuts: number;
  testCoverage: {
    documentationTests: string[];
    integrationTests: string[];
    existingTests: string[];
  };
  validationResults: {
    implementationComplete: boolean;
    documentationAccurate: boolean;
    testCoverageComplete: boolean;
  };
}

export function validateKeyboardShortcutsTests(): TestValidationReport {
  const manager = new ShortcutManager();
  const implementedShortcuts = manager.getShortcuts();

  // Parse documentation
  const docsPath = path.join(__dirname, '../../../docs/cli-guide.md');
  const docContent = fs.readFileSync(docsPath, 'utf8');
  const documentedShortcuts = parseShortcutsFromDocs(docContent);

  // Check test files exist
  const testDir = __dirname;
  const testFiles = fs.readdirSync(testDir);

  const documentationTestFile = 'keyboard-shortcuts-documentation.test.ts';
  const integrationTestFile = 'keyboard-shortcuts-coverage.integration.test.ts';
  const existingTestFile = '../services/__tests__/ShortcutManager.test.ts';

  const report: TestValidationReport = {
    implementedShortcuts: implementedShortcuts.length,
    documentedShortcuts: documentedShortcuts.length,
    testCoverage: {
      documentationTests: testFiles.includes(documentationTestFile) ? [documentationTestFile] : [],
      integrationTests: testFiles.includes(integrationTestFile) ? [integrationTestFile] : [],
      existingTests: fs.existsSync(path.join(__dirname, existingTestFile)) ? [existingTestFile] : []
    },
    validationResults: {
      implementationComplete: implementedShortcuts.length >= 22,
      documentationAccurate: documentedShortcuts.length >= 22,
      testCoverageComplete: testFiles.includes(documentationTestFile) && testFiles.includes(integrationTestFile)
    }
  };

  return report;
}

function parseShortcutsFromDocs(content: string): any[] {
  const shortcuts = [];
  const lines = content.split('\n');
  let inTable = false;

  for (const line of lines) {
    if (line.includes('Shortcut') && line.includes('Description')) {
      inTable = true;
      continue;
    }

    if (line.match(/^\|[-\s|:]+\|$/)) {
      continue;
    }

    if (inTable && line.startsWith('|') && !line.includes('Shortcut')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p !== '');
      if (parts.length >= 3) {
        shortcuts.push({
          shortcut: parts[0].replace(/`/g, ''),
          description: parts[1],
          context: parts[2]
        });
      }
    }

    if (inTable && line.startsWith('#')) {
      inTable = false;
    }
  }

  return shortcuts;
}

// Validation Categories for Test Coverage
export const SHORTCUT_CATEGORIES = {
  global: ['exit', 'clear', 'dismiss', 'quickSave', 'help'],
  session: ['sessionInfo', 'sessionList'],
  quickCommands: ['status', 'agents', 'workflows', 'toggleThoughts'],
  input: ['clearLine', 'deleteWord', 'beginningOfLine', 'endOfLine', 'submit', 'newline', 'complete'],
  history: ['previousHistory', 'nextHistory', 'historySearch'],
  processing: ['cancel']
};

export const EXPECTED_TOTAL_SHORTCUTS = 22;

export const ESSENTIAL_SHORTCUTS = [
  'exit', 'cancel', 'clear', 'help', 'quickSave'
];

// Export for use in tests
export { ShortcutManager };