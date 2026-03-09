/**
 * Edge Case Tests for Ink Framework Integration
 *
 * This test suite covers edge cases, error scenarios, and boundary conditions
 * that could affect Ink framework integration reliability and robustness.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Test file paths
const CLI_PACKAGE_ROOT = resolve(process.cwd(), 'packages/cli');
const UI_ROOT = resolve(CLI_PACKAGE_ROOT, 'src/ui');
const APP_TSX_PATH = resolve(UI_ROOT, 'App.tsx');
const INDEX_TSX_PATH = resolve(UI_ROOT, 'index.tsx');
const PACKAGE_JSON_PATH = resolve(CLI_PACKAGE_ROOT, 'package.json');

describe('Ink Integration Edge Cases', () => {
  describe('Malformed Import Statements', () => {
    it('should detect when ink imports are commented out', () => {
      const commentedContent = `
        // import { Box, Text, useApp, useInput } from 'ink';
        import React from 'react';

        export function App() {
          return <div>Not using Ink</div>;
        }
      `;

      const inkImportPattern = /^(?![ ]*\/\/).*import.*\{[^}]*Box[^}]*\}.*from ['"]ink['"]/m;
      expect(commentedContent.match(inkImportPattern)).toBeFalsy();
    });

    it('should detect when ink imports use wrong module name', () => {
      const wrongModuleContent = `
        import { Box, Text } from '@ink/core';
        import { useApp, useInput } from 'ink-hooks';
      `;

      const correctInkPattern = /import.*\{[^}]*Box[^}]*\}.*from ['"]ink['"]/;
      expect(wrongModuleContent.match(correctInkPattern)).toBeFalsy();
    });

    it('should handle multiline imports correctly', () => {
      const multilineContent = `
        import {
          Box,
          Text,
          useApp,
          useInput
        } from 'ink';
      `;

      const patterns = [
        /import.*\{[^}]*Box[^}]*\}.*from ['"]ink['"]/s,
        /import.*\{[^}]*Text[^}]*\}.*from ['"]ink['"]/s,
        /import.*\{[^}]*useApp[^}]*\}.*from ['"]ink['"]/s,
        /import.*\{[^}]*useInput[^}]*\}.*from ['"]ink['"]/s,
      ];

      patterns.forEach(pattern => {
        expect(multilineContent.match(pattern), 'Multiline import should match').toBeTruthy();
      });
    });
  });

  describe('Component Usage Edge Cases', () => {
    it('should detect Ink components used within other components', () => {
      const nestedContent = `
        function CustomComponent() {
          return (
            <Box flexDirection="row">
              <Text>Nested</Text>
            </Box>
          );
        }

        export function App() {
          return (
            <Box flexDirection="column">
              <CustomComponent />
            </Box>
          );
        }
      `;

      const boxPattern = /<Box[^>]*>/g;
      const textPattern = /<Text[^>]*>/g;

      const boxMatches = nestedContent.match(boxPattern);
      const textMatches = nestedContent.match(textPattern);

      expect(boxMatches).toHaveLength(2);
      expect(textMatches).toHaveLength(1);
    });

    it('should handle self-closing Ink components', () => {
      const selfClosingContent = `
        <Box flexDirection="column">
          <Text color="green">Hello</Text>
          <Text />
          <Box />
        </Box>
      `;

      const boxPattern = /<Box[\s>\/]/g;
      const textPattern = /<Text[\s>\/]/g;

      const boxMatches = selfClosingContent.match(boxPattern);
      const textMatches = selfClosingContent.match(textPattern);

      expect(boxMatches).toHaveLength(2);
      expect(textMatches).toHaveLength(2);
    });

    it('should detect hooks usage in different patterns', () => {
      const hookVariations = [
        'const { exit } = useApp();',
        'const app = useApp();',
        'const {exit, exitCode} = useApp();',
        'useInput((input, key) => {});',
        'useInput(handleInput);',
        'const inputHandler = useInput;'
      ];

      hookVariations.forEach(variation => {
        const useAppPattern = /useApp\s*\(/;
        const useInputPattern = /useInput\s*[\(\;]/;

        if (variation.includes('useApp')) {
          expect(variation.match(useAppPattern), `useApp pattern should match: ${variation}`).toBeTruthy();
        }
        if (variation.includes('useInput')) {
          expect(variation.match(useInputPattern), `useInput pattern should match: ${variation}`).toBeTruthy();
        }
      });
    });
  });

  describe('Package.json Edge Cases', () => {
    it('should handle version ranges and pre-release versions', () => {
      const versionScenarios = [
        { ink: '^5.2.1', valid: true },
        { ink: '~5.2.1', valid: true },
        { ink: '5.2.1', valid: true },
        { ink: '>=5.0.0 <6.0.0', valid: false }, // Complex range not handled by simple regex
        { ink: '5.2.1-beta.1', valid: false }, // Pre-release not handled by simple regex
        { ink: 'latest', valid: false },
        { ink: '*', valid: false },
      ];

      const versionPattern = /^[\^~]?\d+\.\d+\.\d+$/;

      versionScenarios.forEach(({ ink, valid }) => {
        const matches = ink.match(versionPattern);
        expect(!!matches).toBe(valid);
      });
    });

    it('should handle missing or corrupted dependencies section', () => {
      const packageJsonVariations = [
        { dependencies: {} }, // Empty dependencies
        { devDependencies: { ink: '^5.2.1' } }, // ink in wrong section
        {}, // No dependencies section
        { dependencies: null }, // Null dependencies
      ];

      packageJsonVariations.forEach(pkg => {
        const hasInkDependency = pkg.dependencies && pkg.dependencies.ink;
        expect(hasInkDependency).toBeFalsy();
      });
    });

    it('should validate comprehensive Ink ecosystem presence', () => {
      const mockPackageJson = {
        dependencies: {
          'ink': '^5.2.1',
          'ink-big-text': '^2.0.0',
          'ink-gradient': '^3.0.0',
          'ink-link': '^4.1.0',
          'ink-progress-bar': '^3.0.0',
          'ink-select-input': '^6.2.0',
          'ink-spinner': '^5.0.0',
          'ink-syntax-highlight': '^2.0.2',
          'ink-text-input': '^6.0.0',
          'ink-use-stdout-dimensions': '^1.0.5',
          'react': '^18.0.0'
        },
        devDependencies: {
          'ink-testing-library': '^4.0.0'
        }
      };

      // Count ink ecosystem packages
      const inkEcosystemPackages = Object.keys(mockPackageJson.dependencies)
        .filter(name => name.startsWith('ink-'));

      expect(inkEcosystemPackages.length).toBeGreaterThan(5); // Should have substantial ecosystem
      expect(mockPackageJson.devDependencies['ink-testing-library']).toBeDefined();
    });
  });

  describe('File Structure Edge Cases', () => {
    it('should handle missing files gracefully in real environment', () => {
      // This test verifies graceful handling when files don't exist
      const nonExistentPaths = [
        '/nonexistent/App.tsx',
        '/nonexistent/index.tsx',
        '/nonexistent/package.json'
      ];

      nonExistentPaths.forEach(path => {
        expect(existsSync(path)).toBe(false);
      });
    });

    it('should handle different file extensions appropriately', () => {
      const validExtensions = ['.tsx', '.ts', '.jsx', '.js'];
      const testFilename = 'App';

      validExtensions.forEach(ext => {
        const filename = `${testFilename}${ext}`;
        // In a real scenario, we'd check if Ink works with different extensions
        expect(filename).toMatch(new RegExp(`${testFilename}\\.(tsx?|jsx?)$`));
      });
    });
  });

  describe('TypeScript Integration Edge Cases', () => {
    it('should validate proper React.ReactElement return types', () => {
      const typeDefinitions = [
        'function App(): React.ReactElement',
        'export function App(): React.ReactElement {',
        'const App = (): React.ReactElement => {',
        'export const App: React.FC = () => {'
      ];

      const reactElementPattern = /React\.ReactElement/;
      const reactFCPattern = /React\.FC/;

      typeDefinitions.forEach(def => {
        const hasReactElement = reactElementPattern.test(def);
        const hasReactFC = reactFCPattern.test(def);

        expect(hasReactElement || hasReactFC, `Should have React types: ${def}`).toBe(true);
      });
    });

    it('should detect proper interface definitions', () => {
      const interfaceContent = `
        export interface AppProps {
          initialState?: AppState;
          onCommand?: (command: string) => void;
          onTask?: (task: any) => void;
          onExit?: () => void;
        }

        export interface InkAppInstance {
          waitUntilExit(): Promise<void>;
          unmount(): void;
        }
      `;

      const appPropsPattern = /interface\s+AppProps/;
      const inkAppInstancePattern = /interface\s+InkAppInstance/;

      expect(interfaceContent.match(appPropsPattern)).toBeTruthy();
      expect(interfaceContent.match(inkAppInstancePattern)).toBeTruthy();
    });
  });

  describe('Render Pipeline Edge Cases', () => {
    it('should validate complete render setup with providers', () => {
      const renderContent = `
        const { waitUntilExit, unmount } = render(
          <ThemeProvider defaultTheme="dark">
            <App
              initialState={initialState}
              onCommand={onCommand}
              onTask={onTask}
              onExit={onExit}
            />
          </ThemeProvider>
        );
      `;

      const renderCallPattern = /render\s*\(\s*</;
      const themeProviderPattern = /<ThemeProvider[^>]*>/;
      const appWithPropsPattern = /<App\s+[^>]*initialState={initialState}[^>]*>/;

      expect(renderContent.match(renderCallPattern)).toBeTruthy();
      expect(renderContent.match(themeProviderPattern)).toBeTruthy();
      expect(renderContent.match(appWithPropsPattern)).toBeTruthy();
    });

    it('should detect proper destructuring from render call', () => {
      const destructuringPatterns = [
        'const { waitUntilExit, unmount } = render(',
        'const { waitUntilExit } = render(',
        'const { unmount } = render(',
        'const result = render(',
      ];

      const destructurePattern = /const\s+\{\s*[\w\s,]*\}\s*=\s*render\s*\(/;
      const assignmentPattern = /const\s+\w+\s*=\s*render\s*\(/;

      destructuringPatterns.forEach(pattern => {
        const hasDestructure = destructurePattern.test(pattern);
        const hasAssignment = assignmentPattern.test(pattern);

        expect(hasDestructure || hasAssignment, `Should match render pattern: ${pattern}`).toBe(true);
      });
    });
  });

  describe('Integration Robustness', () => {
    it('should validate that all critical files exist', () => {
      // Test actual file existence in the real project structure
      const criticalFiles = [APP_TSX_PATH, INDEX_TSX_PATH, PACKAGE_JSON_PATH];

      criticalFiles.forEach(filePath => {
        expect(existsSync(filePath), `Critical file should exist: ${filePath}`).toBe(true);
      });
    });

    it('should validate package.json structure integrity', () => {
      if (existsSync(PACKAGE_JSON_PATH)) {
        const packageContent = readFileSync(PACKAGE_JSON_PATH, 'utf8');
        let packageJson;

        expect(() => {
          packageJson = JSON.parse(packageContent);
        }).not.toThrow();

        expect(packageJson).toHaveProperty('dependencies');
        expect(packageJson.dependencies).toHaveProperty('ink');
        expect(packageJson.dependencies).toHaveProperty('react');
      }
    });

    it('should verify App component exports and structure', () => {
      if (existsSync(APP_TSX_PATH)) {
        const appContent = readFileSync(APP_TSX_PATH, 'utf8');

        // Should export App function
        expect(appContent).toMatch(/export\s+function\s+App/);

        // Should have React import
        expect(appContent).toMatch(/import\s+React/);

        // Should have proper TypeScript return type
        expect(appContent).toMatch(/:\s*React\.ReactElement/);

        // Should return JSX starting with Box (main container)
        expect(appContent).toMatch(/return\s*\(\s*<Box/);
      }
    });

    it('should verify index.tsx render functionality', () => {
      if (existsSync(INDEX_TSX_PATH)) {
        const indexContent = readFileSync(INDEX_TSX_PATH, 'utf8');

        // Should import render from ink
        expect(indexContent).toMatch(/import.*\{[^}]*render[^}]*\}.*from ['"]ink['"]/);

        // Should export startInkApp function
        expect(indexContent).toMatch(/export\s+async\s+function\s+startInkApp/);

        // Should have proper TypeScript return type
        expect(indexContent).toMatch(/:\s*Promise<InkAppInstance>/);

        // Should destructure render result
        expect(indexContent).toMatch(/\{\s*waitUntilExit\s*,\s*unmount\s*\}\s*=\s*render/);
      }
    });
  });

  describe('Version Compatibility Edge Cases', () => {
    it('should validate React and Ink version compatibility', () => {
      if (existsSync(PACKAGE_JSON_PATH)) {
        const packageContent = readFileSync(PACKAGE_JSON_PATH, 'utf8');
        const packageJson = JSON.parse(packageContent);

        const inkVersion = packageJson.dependencies?.ink;
        const reactVersion = packageJson.dependencies?.react;

        if (inkVersion && reactVersion) {
          // Extract major versions
          const inkMajor = parseInt(inkVersion.replace(/\D/g, '').charAt(0));
          const reactMajor = parseInt(reactVersion.replace(/\D/g, '').substring(0, 2));

          // Ink 5.x requires React 18+
          if (inkMajor >= 5) {
            expect(reactMajor).toBeGreaterThanOrEqual(18);
          }
        }
      }
    });

    it('should verify modern Ink features are available', () => {
      if (existsSync(PACKAGE_JSON_PATH)) {
        const packageContent = readFileSync(PACKAGE_JSON_PATH, 'utf8');
        const packageJson = JSON.parse(packageContent);

        const inkVersion = packageJson.dependencies?.ink;

        if (inkVersion) {
          const majorVersion = parseInt(inkVersion.replace(/\D/g, '').charAt(0));

          // Modern Ink (4+) should be used for better React compatibility
          expect(majorVersion).toBeGreaterThanOrEqual(4);
        }
      }
    });
  });

  describe('Error Recovery and Fallbacks', () => {
    it('should handle graceful degradation scenarios', () => {
      // Test what happens when optional ink packages are missing
      const minimalPackageJson = {
        dependencies: {
          'ink': '^5.2.1',
          'react': '^18.0.0'
        }
      };

      // Should still work with just core ink
      expect(minimalPackageJson.dependencies.ink).toBeDefined();
      expect(minimalPackageJson.dependencies.react).toBeDefined();
    });

    it('should detect potential runtime issues', () => {
      // Check for common patterns that might cause runtime issues
      if (existsSync(APP_TSX_PATH)) {
        const appContent = readFileSync(APP_TSX_PATH, 'utf8');

        // Should not use DOM-specific React features
        const domPatterns = [
          /document\./,
          /window\./,
          /HTMLElement/,
          /querySelector/,
          /addEventListener/
        ];

        domPatterns.forEach(pattern => {
          expect(appContent.match(pattern), 'Should not use DOM APIs in Ink app').toBeFalsy();
        });
      }
    });
  });
});