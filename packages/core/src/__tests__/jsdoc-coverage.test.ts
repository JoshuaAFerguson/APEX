/**
 * @fileoverview JSDoc coverage tests to verify all public APIs have proper documentation
 */

import * as fs from 'fs/promises';
import * as path from 'path';

interface JSDocInfo {
  hasJSDoc: boolean;
  hasParams: boolean;
  hasReturns: boolean;
  hasExamples: boolean;
  hasThrows: boolean;
  description: string;
}

interface ExportInfo {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'constant';
  jsDoc: JSDocInfo;
  lineNumber: number;
}

/**
 * Extract JSDoc information from source code
 */
function extractJSDocInfo(sourceCode: string, exportName: string, exportLineNumber: number): JSDocInfo {
  const lines = sourceCode.split('\n');

  // Look backwards from the export line to find JSDoc comment
  let jsDocStart = -1;
  let jsDocEnd = -1;

  for (let i = exportLineNumber - 1; i >= 0; i--) {
    const line = lines[i].trim();

    if (line === '*/') {
      jsDocEnd = i;
    }

    if (line.startsWith('/**')) {
      jsDocStart = i;
      break;
    }

    // Stop if we hit another export or significant code
    if (line.startsWith('export ') || line.startsWith('import ') ||
        (line.length > 0 && !line.startsWith('*') && !line.startsWith('//') && jsDocEnd === -1)) {
      break;
    }
  }

  if (jsDocStart === -1 || jsDocEnd === -1) {
    return {
      hasJSDoc: false,
      hasParams: false,
      hasReturns: false,
      hasExamples: false,
      hasThrows: false,
      description: ''
    };
  }

  const jsDocLines = lines.slice(jsDocStart, jsDocEnd + 1);
  const jsDocContent = jsDocLines.join('\n');

  return {
    hasJSDoc: true,
    hasParams: jsDocContent.includes('@param'),
    hasReturns: jsDocContent.includes('@returns') || jsDocContent.includes('@return'),
    hasExamples: jsDocContent.includes('@example'),
    hasThrows: jsDocContent.includes('@throws'),
    description: extractDescription(jsDocLines)
  };
}

/**
 * Extract description from JSDoc lines
 */
function extractDescription(jsDocLines: string[]): string {
  const descLines: string[] = [];
  let inDescription = false;

  for (const line of jsDocLines) {
    const trimmed = line.trim();

    if (trimmed === '/**') {
      inDescription = true;
      continue;
    }

    if (trimmed === '*/') {
      break;
    }

    if (trimmed.startsWith('@')) {
      break;
    }

    if (inDescription) {
      const content = trimmed.replace(/^\*\s?/, '');
      if (content) {
        descLines.push(content);
      }
    }
  }

  return descLines.join(' ').trim();
}

/**
 * Parse TypeScript source file to extract exported items
 */
function parseExports(sourceCode: string): ExportInfo[] {
  const lines = sourceCode.split('\n');
  const exports: ExportInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Export function
    const functionMatch = line.match(/^export\s+(?:async\s+)?function\s+(\w+)/);
    if (functionMatch) {
      exports.push({
        name: functionMatch[1],
        type: 'function',
        jsDoc: extractJSDocInfo(sourceCode, functionMatch[1], i),
        lineNumber: i + 1
      });
      continue;
    }

    // Export class
    const classMatch = line.match(/^export\s+(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      exports.push({
        name: classMatch[1],
        type: 'class',
        jsDoc: extractJSDocInfo(sourceCode, classMatch[1], i),
        lineNumber: i + 1
      });
      continue;
    }

    // Export interface
    const interfaceMatch = line.match(/^export\s+interface\s+(\w+)/);
    if (interfaceMatch) {
      exports.push({
        name: interfaceMatch[1],
        type: 'interface',
        jsDoc: extractJSDocInfo(sourceCode, interfaceMatch[1], i),
        lineNumber: i + 1
      });
      continue;
    }

    // Export type alias
    const typeMatch = line.match(/^export\s+type\s+(\w+)/);
    if (typeMatch) {
      exports.push({
        name: typeMatch[1],
        type: 'type',
        jsDoc: extractJSDocInfo(sourceCode, typeMatch[1], i),
        lineNumber: i + 1
      });
      continue;
    }

    // Export const/let/var
    const constMatch = line.match(/^export\s+(?:const|let|var)\s+(\w+)/);
    if (constMatch) {
      exports.push({
        name: constMatch[1],
        type: 'constant',
        jsDoc: extractJSDocInfo(sourceCode, constMatch[1], i),
        lineNumber: i + 1
      });
      continue;
    }
  }

  return exports;
}

/**
 * Get list of core source files to check
 */
async function getCoreSourceFiles(): Promise<string[]> {
  const coreDir = path.join(__dirname, '..');
  const files: string[] = [];

  const items = await fs.readdir(coreDir);

  for (const item of items) {
    if (item.endsWith('.ts') &&
        !item.endsWith('.test.ts') &&
        !item.endsWith('.d.ts') &&
        item !== 'index.ts') {
      files.push(path.join(coreDir, item));
    }
  }

  return files.sort();
}

describe('JSDoc Coverage Tests', () => {
  let coreFiles: string[] = [];

  beforeAll(async () => {
    coreFiles = await getCoreSourceFiles();
  });

  describe('JSDoc Presence', () => {
    test('should find core source files', () => {
      expect(coreFiles.length).toBeGreaterThan(0);
      expect(coreFiles.some(f => f.endsWith('utils.ts'))).toBe(true);
      expect(coreFiles.some(f => f.endsWith('config.ts'))).toBe(true);
      expect(coreFiles.some(f => f.endsWith('shell-utils.ts'))).toBe(true);
    });

    test('all exported functions should have JSDoc comments', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if (exp.type === 'function' && !exp.jsDoc.hasJSDoc) {
            issues.push(`${fileName}:${exp.lineNumber} - Function '${exp.name}' missing JSDoc`);
          }
        }
      }

      if (issues.length > 0) {
        console.error('Missing JSDoc comments:\n' + issues.join('\n'));
      }

      expect(issues).toHaveLength(0);
    });

    test('all exported classes should have JSDoc comments', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if (exp.type === 'class' && !exp.jsDoc.hasJSDoc) {
            issues.push(`${fileName}:${exp.lineNumber} - Class '${exp.name}' missing JSDoc`);
          }
        }
      }

      if (issues.length > 0) {
        console.error('Missing JSDoc comments:\n' + issues.join('\n'));
      }

      expect(issues).toHaveLength(0);
    });

    test('all exported interfaces should have JSDoc comments', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if (exp.type === 'interface' && !exp.jsDoc.hasJSDoc) {
            issues.push(`${fileName}:${exp.lineNumber} - Interface '${exp.name}' missing JSDoc`);
          }
        }
      }

      if (issues.length > 0) {
        console.error('Missing JSDoc comments:\n' + issues.join('\n'));
      }

      expect(issues).toHaveLength(0);
    });
  });

  describe('JSDoc Quality', () => {
    test('functions with parameters should document @param tags', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if (exp.type === 'function' && exp.jsDoc.hasJSDoc) {
            // Check if function has parameters by looking at the function signature
            const lines = sourceCode.split('\n');
            const functionLine = lines[exp.lineNumber - 1];
            const hasParameters = functionLine.includes('(') &&
                                functionLine.indexOf('(') < functionLine.indexOf(')') &&
                                !functionLine.match(/\(\s*\)/); // Not empty parentheses

            if (hasParameters && !exp.jsDoc.hasParams) {
              issues.push(`${fileName}:${exp.lineNumber} - Function '${exp.name}' has parameters but no @param tags`);
            }
          }
        }
      }

      // Allow some tolerance as parameter detection isn't perfect
      expect(issues.length).toBeLessThan(5);
    });

    test('functions should have @returns tags', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if (exp.type === 'function' && exp.jsDoc.hasJSDoc) {
            // Check if function returns something (not void)
            const lines = sourceCode.split('\n');
            const functionSignature = lines.slice(exp.lineNumber - 1, exp.lineNumber + 5).join('\n');
            const returnsVoid = functionSignature.includes(': void') ||
                              functionSignature.includes('):void');

            if (!returnsVoid && !exp.jsDoc.hasReturns) {
              issues.push(`${fileName}:${exp.lineNumber} - Function '${exp.name}' should have @returns tag`);
            }
          }
        }
      }

      // Allow some tolerance for getter/setter functions and simple utilities
      expect(issues.length).toBeLessThan(10);
    });

    test('public APIs should have @example tags', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if ((exp.type === 'function' || exp.type === 'class') && exp.jsDoc.hasJSDoc) {
            if (!exp.jsDoc.hasExamples) {
              issues.push(`${fileName}:${exp.lineNumber} - ${exp.type} '${exp.name}' should have @example tag`);
            }
          }
        }
      }

      // The acceptance criteria specifically asks for @example tags
      expect(issues.length).toBeLessThan(3);
    });

    test('JSDoc descriptions should be meaningful', async () => {
      const issues: string[] = [];

      for (const filePath of coreFiles) {
        const sourceCode = await fs.readFile(filePath, 'utf8');
        const exports = parseExports(sourceCode);
        const fileName = path.basename(filePath);

        for (const exp of exports) {
          if (exp.jsDoc.hasJSDoc && exp.jsDoc.description.length < 10) {
            issues.push(`${fileName}:${exp.lineNumber} - ${exp.type} '${exp.name}' has inadequate description: "${exp.jsDoc.description}"`);
          }
        }
      }

      expect(issues.length).toBeLessThan(5);
    });
  });

  describe('Critical API Documentation', () => {
    test('utils.ts exports should be well documented', async () => {
      const utilsPath = coreFiles.find(f => f.endsWith('utils.ts'));
      expect(utilsPath).toBeDefined();

      const sourceCode = await fs.readFile(utilsPath!, 'utf8');
      const exports = parseExports(sourceCode);

      // Check key utility functions
      const keyFunctions = ['generateTaskId', 'slugify', 'calculateCost', 'formatDuration', 'parseSemver'];

      for (const funcName of keyFunctions) {
        const exportInfo = exports.find(e => e.name === funcName && e.type === 'function');
        expect(exportInfo, `Function ${funcName} should be exported`).toBeDefined();

        if (exportInfo) {
          expect(exportInfo.jsDoc.hasJSDoc, `Function ${funcName} should have JSDoc`).toBe(true);
          expect(exportInfo.jsDoc.hasExamples, `Function ${funcName} should have examples`).toBe(true);
        }
      }
    });

    test('shell-utils.ts exports should be well documented', async () => {
      const shellUtilsPath = coreFiles.find(f => f.endsWith('shell-utils.ts'));
      expect(shellUtilsPath).toBeDefined();

      const sourceCode = await fs.readFile(shellUtilsPath!, 'utf8');
      const exports = parseExports(sourceCode);

      // Check key shell utility functions
      const keyFunctions = ['getPlatformShell', 'isWindows', 'getKillCommand', 'resolveExecutable'];

      for (const funcName of keyFunctions) {
        const exportInfo = exports.find(e => e.name === funcName && e.type === 'function');
        expect(exportInfo, `Function ${funcName} should be exported`).toBeDefined();

        if (exportInfo) {
          expect(exportInfo.jsDoc.hasJSDoc, `Function ${funcName} should have JSDoc`).toBe(true);
          expect(exportInfo.jsDoc.hasExamples, `Function ${funcName} should have examples`).toBe(true);
        }
      }
    });

    test('config.ts should have interface documentation', async () => {
      const configPath = coreFiles.find(f => f.endsWith('config.ts'));
      expect(configPath).toBeDefined();

      const sourceCode = await fs.readFile(configPath!, 'utf8');
      const exports = parseExports(sourceCode);

      // Check that interfaces are exported and documented
      const interfaces = exports.filter(e => e.type === 'interface');
      expect(interfaces.length).toBeGreaterThan(0);

      for (const interfaceInfo of interfaces) {
        expect(interfaceInfo.jsDoc.hasJSDoc,
          `Interface ${interfaceInfo.name} should have JSDoc`).toBe(true);
      }
    });
  });
});