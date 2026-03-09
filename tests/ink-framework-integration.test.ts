/**
 * Comprehensive Test Suite for Ink Framework Integration
 *
 * Verification of Ink-based UI framework integration according to acceptance criteria:
 * - App.tsx uses Ink components (Box, Text, useInput, useApp)
 * - index.tsx has render() call
 * - package.json has ink dependency
 * - Wiring completeness validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Import the actual modules for runtime testing
// Note: Module imports are skipped due to build dependencies
// import { startInkApp, type StartInkAppOptions } from '../packages/cli/src/ui/index.js';
// import { App, type AppState } from '../packages/cli/src/ui/App.js';

// File system paths for integration verification
const CLI_PACKAGE_ROOT = resolve(process.cwd(), 'packages/cli');
const UI_ROOT = resolve(CLI_PACKAGE_ROOT, 'src/ui');
const APP_TSX_PATH = resolve(UI_ROOT, 'App.tsx');
const INDEX_TSX_PATH = resolve(UI_ROOT, 'index.tsx');
const PACKAGE_JSON_PATH = resolve(CLI_PACKAGE_ROOT, 'package.json');

describe('Ink Framework Integration Audit', () => {
  describe('File Existence Verification', () => {
    it('should have required files in expected locations', () => {
      expect(existsSync(APP_TSX_PATH), 'App.tsx should exist').toBe(true);
      expect(existsSync(INDEX_TSX_PATH), 'index.tsx should exist').toBe(true);
      expect(existsSync(PACKAGE_JSON_PATH), 'package.json should exist').toBe(true);
    });
  });

  describe('Package.json Ink Dependency Verification', () => {
    let packageJson: any;

    beforeEach(() => {
      const packageJsonContent = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
      packageJson = JSON.parse(packageJsonContent);
    });

    it('should have ink as a dependency', () => {
      expect(packageJson.dependencies).toBeDefined();
      expect(packageJson.dependencies.ink).toBeDefined();
      expect(packageJson.dependencies.ink).toMatch(/^\^?\d+\.\d+\.\d+/);
    });

    it('should have react as a dependency (required for Ink)', () => {
      expect(packageJson.dependencies.react).toBeDefined();
      expect(packageJson.dependencies.react).toMatch(/^\^?\d+\.\d+\.\d+/);
    });

    it('should have ink-related auxiliary packages', () => {
      const inkPackages = [
        'ink-big-text',
        'ink-gradient',
        'ink-spinner',
        'ink-text-input',
        'ink-select-input',
        'ink-progress-bar'
      ];

      inkPackages.forEach(pkg => {
        expect(packageJson.dependencies[pkg], `${pkg} should be included`).toBeDefined();
      });
    });

    it('should have ink-testing-library in devDependencies', () => {
      expect(packageJson.devDependencies).toBeDefined();
      expect(packageJson.devDependencies['ink-testing-library']).toBeDefined();
    });
  });

  describe('App.tsx Ink Components Integration', () => {
    let appTsxContent: string;

    beforeEach(() => {
      appTsxContent = readFileSync(APP_TSX_PATH, 'utf-8');
    });

    it('should import Box and Text from ink', () => {
      const boxImportRegex = /import\s+.*\bBox\b.*from\s+['"]ink['"]/;
      const textImportRegex = /import\s+.*\bText\b.*from\s+['"]ink['"]/;

      expect(appTsxContent).toMatch(boxImportRegex);
      expect(appTsxContent).toMatch(textImportRegex);
    });

    it('should import useApp and useInput hooks from ink', () => {
      const useAppImportRegex = /import\s+.*\buseApp\b.*from\s+['"]ink['"]/;
      const useInputImportRegex = /import\s+.*\buseInput\b.*from\s+['"]ink['"]/;

      expect(appTsxContent).toMatch(useAppImportRegex);
      expect(appTsxContent).toMatch(useInputImportRegex);
    });

    it('should use Box components in JSX', () => {
      const boxUsageRegex = /<Box[\s>]/;
      expect(appTsxContent).toMatch(boxUsageRegex);
    });

    it('should use Text components in JSX', () => {
      const textUsageRegex = /<Text[\s>]/;
      expect(appTsxContent).toMatch(textUsageRegex);
    });

    it('should use useApp hook', () => {
      const useAppUsageRegex = /\buseApp\s*\(/;
      expect(appTsxContent).toMatch(useAppUsageRegex);
    });

    it('should use useInput hook', () => {
      const useInputUsageRegex = /\buseInput\s*\(/;
      expect(appTsxContent).toMatch(useInputUsageRegex);
    });

    it('should export App component function', () => {
      const appExportRegex = /export\s+function\s+App\s*\(/;
      expect(appTsxContent).toMatch(appExportRegex);
    });

    it('should return React.ReactElement from App component', () => {
      const returnTypeRegex = /:\s*React\.ReactElement\s*\{/;
      expect(appTsxContent).toMatch(returnTypeRegex);
    });

    it('should properly structure Ink component hierarchy', () => {
      // Main container should be Box
      const mainBoxRegex = /<Box\s+flexDirection=['"]column['"][^>]*>/;
      expect(appTsxContent).toMatch(mainBoxRegex);
    });
  });

  describe('index.tsx Render Function Integration', () => {
    let indexTsxContent: string;

    beforeEach(() => {
      indexTsxContent = readFileSync(INDEX_TSX_PATH, 'utf-8');
    });

    it('should import render from ink', () => {
      const renderImportRegex = /import\s+.*\brender\b.*from\s+['"]ink['"]/;
      expect(indexTsxContent).toMatch(renderImportRegex);
    });

    it('should call render function', () => {
      const renderCallRegex = /\brender\s*\(/;
      expect(indexTsxContent).toMatch(renderCallRegex);
    });

    it('should render the App component', () => {
      const appRenderRegex = /<App[\s\n]/;
      expect(indexTsxContent).toMatch(appRenderRegex);
    });

    it('should export startInkApp function', () => {
      const exportRegex = /export\s+async\s+function\s+startInkApp\s*\(/;
      expect(indexTsxContent).toMatch(exportRegex);
    });

    it('should destructure waitUntilExit and unmount from render', () => {
      const destructureRegex = /\{\s*waitUntilExit\s*,\s*unmount\s*\}\s*=\s*render\s*\(/;
      expect(indexTsxContent).toMatch(destructureRegex);
    });

    it('should provide proper InkAppInstance interface', () => {
      const interfaceRegex = /export\s+interface\s+InkAppInstance/;
      expect(indexTsxContent).toMatch(interfaceRegex);
    });
  });

  describe('Module Structure Verification', () => {
    it.skip('Module imports skipped due to build dependencies', () => {
      // Module imports are skipped due to TypeScript compilation requirements
      // This would typically test module imports and exports
      console.log('Module import tests require compiled JavaScript - skipped in current environment');
    });

    it('should have proper file structure for module exports', () => {
      // Verify that the source files exist and have proper structure
      const indexContent = readFileSync(INDEX_TSX_PATH, 'utf-8');
      const appContent = readFileSync(APP_TSX_PATH, 'utf-8');

      // Check for export statements
      expect(indexContent).toMatch(/export\s+async\s+function\s+startInkApp/);
      expect(indexContent).toMatch(/export\s+interface\s+InkAppInstance/);
      expect(appContent).toMatch(/export\s+function\s+App/);
      expect(appContent).toMatch(/export\s+interface\s+AppState/);
    });

    // Note: Runtime tests are skipped due to Ink terminal requirements and build dependencies
    it.skip('Runtime tests require terminal environment and built modules', () => {
      // This test is intentionally skipped as Ink requires:
      // 1. A real terminal environment
      // 2. Compiled JavaScript modules
      // In a production environment, integration tests would be run with proper setup
      console.log('Runtime Ink tests require terminal environment and built modules - skipped');
    });
  });

  describe('Wiring Completeness Verification', () => {
    it('should have complete file integration chain', () => {
      // Verify package.json has ink dependency
      const packageJsonContent = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      expect(packageJson.dependencies.ink).toBeDefined();

      // Verify index.tsx imports and uses render from ink
      const indexContent = readFileSync(INDEX_TSX_PATH, 'utf-8');
      expect(indexContent).toMatch(/import\s+.*\brender\b.*from\s+['"]ink['"]/);
      expect(indexContent).toMatch(/\brender\s*\(/);

      // Verify App.tsx imports and uses Ink components
      const appContent = readFileSync(APP_TSX_PATH, 'utf-8');
      expect(appContent).toMatch(/import\s+.*\{[^}]*Box[^}]*\}.*from\s+['"]ink['"]/);
      expect(appContent).toMatch(/import\s+.*\{[^}]*Text[^}]*\}.*from\s+['"]ink['"]/);
      expect(appContent).toMatch(/import\s+.*\{[^}]*useApp[^}]*\}.*from\s+['"]ink['"]/);
      expect(appContent).toMatch(/import\s+.*\{[^}]*useInput[^}]*\}.*from\s+['"]ink['"]/);
    });

    it('should have proper TypeScript integration', () => {
      const indexContent = readFileSync(INDEX_TSX_PATH, 'utf-8');
      const appContent = readFileSync(APP_TSX_PATH, 'utf-8');

      // Check for React imports (required for JSX)
      expect(appContent).toMatch(/import\s+React/);
      expect(indexContent).toMatch(/import\s+React/);

      // Check for TypeScript interfaces/types
      expect(indexContent).toMatch(/interface.*InkAppInstance/);
      expect(appContent).toMatch(/interface.*AppProps/);
    });

    it('should maintain proper component structure', () => {
      const appContent = readFileSync(APP_TSX_PATH, 'utf-8');

      // Main App function should exist and be properly typed
      expect(appContent).toMatch(/export\s+function\s+App\s*\([^)]*\):\s*React\.ReactElement/);

      // Should return JSX starting with Box
      expect(appContent).toMatch(/return\s*\(\s*<Box/);

      // Should use Ink hooks properly
      expect(appContent).toMatch(/const\s+\{[^}]*exit[^}]*\}\s*=\s*useApp\s*\(\s*\)/);
      expect(appContent).toMatch(/useInput\s*\([^)]*\)/);
    });

    it('should have complete render chain integration', () => {
      const indexContent = readFileSync(INDEX_TSX_PATH, 'utf-8');

      // Should properly set up render call with App component
      expect(indexContent).toMatch(/<App\s+[^>]*initialState={initialState}[^>]*>/);
      expect(indexContent).toMatch(/onCommand={onCommand}/);
      expect(indexContent).toMatch(/onTask={onTask}/);
      expect(indexContent).toMatch(/onExit={onExit}/);
    });
  });

  describe('Integration Health Check', () => {
    it('should have proper module structure for integration in source files', () => {
      // This test verifies that the integration has proper module structure
      // Runtime instantiation is skipped due to terminal and build requirements
      const indexContent = readFileSync(INDEX_TSX_PATH, 'utf-8');
      const appContent = readFileSync(APP_TSX_PATH, 'utf-8');

      // Verify function exports exist in source
      expect(indexContent).toMatch(/export\s+async\s+function\s+startInkApp/);
      expect(appContent).toMatch(/export\s+function\s+App/);

      // Verify proper TypeScript return types
      expect(appContent).toMatch(/:\s*React\.ReactElement/);
      expect(indexContent).toMatch(/:\s*Promise<InkAppInstance>/);
    });

    it('should validate version compatibility', () => {
      const packageJsonContent = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Verify ink version is recent and compatible
      const inkVersion = packageJson.dependencies.ink;
      const majorVersion = parseInt(inkVersion.replace(/\D/g, '').charAt(0));
      expect(majorVersion, 'Ink major version should be 4 or higher for modern React').toBeGreaterThanOrEqual(4);

      // Verify React version is compatible with Ink
      const reactVersion = packageJson.dependencies.react;
      const reactMajorVersion = parseInt(reactVersion.replace(/\D/g, '').substring(0, 2));
      expect(reactMajorVersion, 'React major version should be 18 for modern Ink').toBeGreaterThanOrEqual(18);
    });
  });
});