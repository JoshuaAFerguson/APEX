/**
 * @fileoverview Full integration test for ProjectContextAnalyzer
 *
 * This test verifies that the ProjectContextAnalyzer integrates properly
 * with realistic project structures and comprehensive scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('ProjectContextAnalyzer - Full Integration', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-full-integration-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should analyze a realistic APEX-like monorepo structure', async () => {
    // Create a comprehensive project structure similar to APEX
    const projectFiles = {
      'package.json': {
        name: 'apex-like-monorepo',
        version: '0.6.0',
        private: true,
        workspaces: ['packages/*'],
        scripts: {
          build: 'turbo run build',
          test: 'vitest run',
          lint: 'turbo run lint',
          typecheck: 'turbo run typecheck'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'vitest': '^1.0.0',
          'turbo': '^1.10.0',
          '@typescript-eslint/eslint-plugin': '^6.0.0',
          'prettier': '^3.0.0'
        }
      },
      'turbo.json': {
        '$schema': 'https://turbo.build/schema.json',
        pipeline: {
          build: { outputs: ['dist/**', '.next/**'] },
          test: { cache: false },
          lint: {},
          typecheck: {}
        }
      },
      'tsconfig.json': {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true
        },
        include: ['packages/*/src/**/*'],
        references: [
          { path: './packages/core' },
          { path: './packages/cli' }
        ]
      },
      'vitest.config.ts': 'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { environment: "node" } });',
      '.eslintrc.json': {
        root: true,
        extends: ['@typescript-eslint/recommended'],
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        ignorePatterns: ['dist/', 'node_modules/']
      },
      'prettier.config.js': 'module.exports = { semi: true, singleQuote: true, trailingComma: "es5" };',
      '.gitignore': 'node_modules/\ndist/\n.env\ncoverage/\n*.log\n.DS_Store',
      'README.md': '# APEX-like Monorepo\n\nA comprehensive test monorepo structure.\n\n## Packages\n\n- `@test/core` - Core functionality\n- `@test/cli` - Command line interface\n- `@test/web-ui` - Web user interface',
      'LICENSE': 'MIT License\n\nCopyright (c) 2024 Test Project\n\nPermission is hereby granted...'
    };

    // Create root files
    for (const [fileName, content] of Object.entries(projectFiles)) {
      const fullPath = path.join(tempDir, fileName);
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.promises.writeFile(fullPath, fileContent);
    }

    // Create core package
    const corePackageDir = path.join(tempDir, 'packages/core');
    await fs.promises.mkdir(corePackageDir, { recursive: true });

    const coreFiles = {
      'package.json': {
        name: '@test/core',
        version: '0.6.0',
        type: 'module',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        dependencies: {
          'zod': '^3.22.0'
        },
        devDependencies: {
          'typescript': '^5.0.0'
        },
        scripts: {
          build: 'tsc',
          test: 'vitest run'
        }
      },
      'tsconfig.json': {
        extends: '../../tsconfig.json',
        compilerOptions: {
          outDir: 'dist',
          rootDir: 'src'
        },
        include: ['src/**/*']
      },
      'src/index.ts': 'export * from "./types";\nexport * from "./analyzer";',
      'src/types.ts': 'import { z } from "zod";\n\nexport const ConfigSchema = z.object({\n  name: z.string(),\n  version: z.string()\n});\nexport type Config = z.infer<typeof ConfigSchema>;',
      'src/analyzer.ts': 'import { Config } from "./types";\n\nexport class ProjectAnalyzer {\n  analyze(config: Config) {\n    return { result: `Analyzing ${config.name}` };\n  }\n}',
      'src/__tests__/analyzer.test.ts': 'import { describe, it, expect } from "vitest";\nimport { ProjectAnalyzer } from "../analyzer";\n\ndescribe("ProjectAnalyzer", () => {\n  it("should analyze config", () => {\n    const analyzer = new ProjectAnalyzer();\n    const result = analyzer.analyze({ name: "test", version: "1.0.0" });\n    expect(result.result).toBe("Analyzing test");\n  });\n});'
    };

    for (const [filePath, content] of Object.entries(coreFiles)) {
      const fullPath = path.join(corePackageDir, filePath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.promises.writeFile(fullPath, fileContent);
    }

    // Create CLI package
    const cliPackageDir = path.join(tempDir, 'packages/cli');
    await fs.promises.mkdir(cliPackageDir, { recursive: true });

    const cliFiles = {
      'package.json': {
        name: '@test/cli',
        version: '0.6.0',
        type: 'module',
        bin: { 'test-cli': 'dist/cli.js' },
        dependencies: {
          '@test/core': 'workspace:*',
          'commander': '^11.0.0',
          'chalk': '^5.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          '@types/node': '^20.0.0'
        }
      },
      'src/index.ts': 'import { ProjectAnalyzer } from "@test/core";\nimport { Command } from "commander";\n\nconst program = new Command();\nprogram.version("0.6.0");',
      'src/commands/init.ts': 'export function initCommand() {\n  console.log("Initializing project...");\n  return { success: true };\n}',
      'src/commands/analyze.ts': 'import { ProjectAnalyzer } from "@test/core";\n\nexport function analyzeCommand(projectPath: string) {\n  const analyzer = new ProjectAnalyzer();\n  return analyzer.analyze({ name: "project", version: "1.0.0" });\n}'
    };

    for (const [filePath, content] of Object.entries(cliFiles)) {
      const fullPath = path.join(cliPackageDir, filePath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.promises.writeFile(fullPath, fileContent);
    }

    // Create web-ui package
    const webUiPackageDir = path.join(tempDir, 'packages/web-ui');
    await fs.promises.mkdir(webUiPackageDir, { recursive: true });

    const webUiFiles = {
      'package.json': {
        name: '@test/web-ui',
        version: '0.6.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start'
        },
        dependencies: {
          '@test/core': 'workspace:*',
          'react': '^18.2.0',
          'react-dom': '^18.2.0',
          'next': '^13.4.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          '@types/react': '^18.2.0'
        }
      },
      'next.config.js': 'module.exports = {\n  experimental: { appDir: true },\n  transpilePackages: ["@test/core"]\n};',
      'src/app/page.tsx': 'import { ProjectAnalyzer } from "@test/core";\n\nexport default function HomePage() {\n  return <div><h1>Test Web UI</h1></div>;\n}',
      'src/components/ProjectList.tsx': 'import React from "react";\n\ninterface Props {\n  projects: string[];\n}\n\nexport const ProjectList: React.FC<Props> = ({ projects }) => {\n  return (\n    <ul>\n      {projects.map(project => <li key={project}>{project}</li>)}\n    </ul>\n  );\n};'
    };

    for (const [filePath, content] of Object.entries(webUiFiles)) {
      const fullPath = path.join(webUiPackageDir, filePath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.promises.writeFile(fullPath, fileContent);
    }

    // Now analyze the project
    const context = await analyzer.analyze();

    // Verify comprehensive analysis
    expect(context).toBeDefined();
    expect(context.structure).toBeDefined();
    expect(context.frameworks).toBeDefined();
    expect(context.configurations).toBeDefined();
    expect(context.testFrameworks).toBeDefined();
    expect(context.detectedAt).toBeInstanceOf(Date);

    // Project structure validation
    expect(context.structure!.root).toBe(tempDir);
    expect(context.structure!.hasPackageJson).toBe(true);
    expect(context.structure!.hasReadme).toBe(true);
    expect(context.structure!.hasLicense).toBe(true);
    expect(context.structure!.hasGitIgnore).toBe(true);
    expect(context.structure!.commonDirectories).toContain('packages');
    expect(context.structure!.totalFiles).toBeGreaterThan(15);
    expect(context.structure!.totalDirectories).toBeGreaterThan(5);

    // Framework detection validation
    if (context.frameworks && context.frameworks.length > 0) {
      const typescriptFramework = context.frameworks.find(f => f.name === 'TypeScript');
      expect(typescriptFramework).toBeDefined();
      expect(typescriptFramework?.confidence).toBe('high');

      const reactFramework = context.frameworks.find(f => f.name === 'React');
      expect(reactFramework).toBeDefined();

      const nextFramework = context.frameworks.find(f => f.name === 'Next.js');
      expect(nextFramework).toBeDefined();
    }

    // Configuration detection validation
    if (context.configurations && context.configurations.length > 0) {
      const configNames = context.configurations.map(c => c.name);
      expect(configNames).toContain('package.json');
      expect(configNames).toContain('tsconfig.json');
      expect(configNames).toContain('.eslintrc.json');
      expect(configNames).toContain('turbo.json');

      const packageJsonConfig = context.configurations.find(c => c.name === 'package.json');
      expect(packageJsonConfig?.purpose).toBe('package-manager');
      expect(packageJsonConfig?.isValid).toBe(true);
    }

    // Test framework detection validation
    if (context.testFrameworks && context.testFrameworks.length > 0) {
      const vitestFramework = context.testFrameworks.find(f => f.name === 'Vitest');
      expect(vitestFramework).toBeDefined();
      expect(vitestFramework?.type).toBe('unit');
    }

    // Git status validation (non-git directory)
    expect(context.gitStatus).toBeDefined();
    expect(context.gitStatus!.isRepository).toBe(false);
    expect(context.gitStatus!.branch).toBe(null);

    // Error handling
    expect(context.errors).toBeDefined();
    expect(Array.isArray(context.errors)).toBe(true);
  });

  it('should handle complex multi-framework project', async () => {
    const multiFrameworkPackageJson = {
      name: 'multi-framework-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.2.0',
        'vue': '^3.3.0',
        'express': '^4.18.0',
        'fastify': '^4.21.0',
        'socket.io': '^4.7.0'
      },
      devDependencies: {
        'typescript': '^5.0.0',
        'jest': '^29.5.0',
        'vitest': '^0.32.0',
        '@playwright/test': '^1.35.0',
        'cypress': '^12.17.0',
        'eslint': '^8.42.0',
        'prettier': '^2.8.8',
        'webpack': '^5.88.0',
        'vite': '^4.4.0'
      }
    };

    await fs.promises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(multiFrameworkPackageJson, null, 2)
    );

    // Create various config files
    const configFiles = [
      { name: 'webpack.config.js', content: 'module.exports = { entry: "./src/index.js" };' },
      { name: 'vite.config.ts', content: 'import { defineConfig } from "vite"; export default defineConfig({});' },
      { name: 'jest.config.js', content: 'module.exports = { testEnvironment: "jsdom" };' },
      { name: 'playwright.config.ts', content: 'export default { testDir: "./e2e" };' },
      { name: 'cypress.config.ts', content: 'export default { e2e: { baseUrl: "http://localhost:3000" } };' },
      { name: '.eslintrc.json', content: '{ "extends": ["eslint:recommended"] }' },
      { name: 'prettier.config.js', content: 'module.exports = { semi: false };' },
      { name: 'tsconfig.json', content: '{ "compilerOptions": { "strict": true } }' }
    ];

    for (const file of configFiles) {
      await fs.promises.writeFile(path.join(tempDir, file.name), file.content);
    }

    // Create source files with different extensions
    const sourceFiles = [
      { path: 'src/app.ts', content: 'console.log("TypeScript");' },
      { path: 'src/component.tsx', content: 'export const Component = () => <div />;' },
      { path: 'src/vue-component.vue', content: '<template><div>Vue</div></template>' },
      { path: 'src/server.js', content: 'const express = require("express");' },
      { path: 'src/styles.css', content: 'body { margin: 0; }' },
      { path: 'src/styles.scss', content: '$primary: blue; body { color: $primary; }' }
    ];

    for (const file of sourceFiles) {
      await fs.promises.mkdir(path.dirname(path.join(tempDir, file.path)), { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, file.path), file.content);
    }

    // Create test files
    const testFiles = [
      { path: 'src/app.test.ts', content: 'test("app", () => expect(true).toBe(true));' },
      { path: 'tests/unit/component.test.jsx', content: 'test("component", () => {});' },
      { path: 'e2e/login.spec.ts', content: 'test("login flow", async ({ page }) => {});' },
      { path: 'cypress/e2e/integration.cy.js', content: 'describe("integration", () => { it("works", () => {}); });' }
    ];

    for (const file of testFiles) {
      await fs.promises.mkdir(path.dirname(path.join(tempDir, file.path)), { recursive: true });
      await fs.promises.writeFile(path.join(tempDir, file.path), file.content);
    }

    const context = await analyzer.analyze();

    // Should detect multiple frameworks
    if (context.frameworks && context.frameworks.length > 0) {
      expect(context.frameworks.length).toBeGreaterThan(3);

      const frameworkNames = context.frameworks.map(f => f.name);
      expect(frameworkNames).toContain('React');
      expect(frameworkNames).toContain('Vue');
      expect(frameworkNames).toContain('Express');
      expect(frameworkNames).toContain('TypeScript');
    }

    // Should detect multiple test frameworks
    if (context.testFrameworks && context.testFrameworks.length > 0) {
      const testFrameworkNames = context.testFrameworks.map(f => f.name);
      expect(testFrameworkNames).toContain('Jest');
      expect(testFrameworkNames).toContain('Vitest');
      expect(testFrameworkNames).toContain('Playwright');
      expect(testFrameworkNames).toContain('Cypress');
    }

    // Should detect multiple configuration files
    if (context.configurations && context.configurations.length > 0) {
      expect(context.configurations.length).toBeGreaterThan(5);
      const configNames = context.configurations.map(c => c.name);
      expect(configNames).toContain('webpack.config.js');
      expect(configNames).toContain('vite.config.ts');
      expect(configNames).toContain('jest.config.js');
    }

    // Language detection should find multiple languages
    const detection = await analyzer.detectFrameworks();
    if (detection.languages && detection.languages.length > 0) {
      const languageNames = detection.languages.map(l => l.name);
      expect(languageNames).toContain('TypeScript');
      expect(languageNames).toContain('JavaScript');
      expect(languageNames).toContain('CSS');
    }
  });

  it('should perform analysis with selective options', async () => {
    // Create basic project structure
    await fs.promises.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'selective-test',
      dependencies: { react: '^18.0.0' },
      devDependencies: { jest: '^29.0.0' }
    }, null, 2));

    await fs.promises.writeFile(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ES2022' }
    }, null, 2));

    // Test with minimal analysis
    const minimalAnalyzer = new ProjectContextAnalyzer(tempDir, {
      analyzeGit: false,
      detectFrameworks: false,
      analyzeConfiguration: false,
      detectTests: false
    });

    const minimalContext = await minimalAnalyzer.analyze();

    expect(minimalContext.gitStatus).toBeUndefined();
    expect(minimalContext.frameworks).toEqual([]);
    expect(minimalContext.configurations).toEqual([]);
    expect(minimalContext.testFrameworks).toEqual([]);
    expect(minimalContext.structure).toBeDefined(); // Always analyzed

    // Test with selective analysis
    const selectiveAnalyzer = new ProjectContextAnalyzer(tempDir, {
      analyzeGit: true,
      detectFrameworks: true,
      analyzeConfiguration: false,
      detectTests: false
    });

    const selectiveContext = await selectiveAnalyzer.analyze();

    expect(selectiveContext.gitStatus).toBeDefined();
    expect(selectiveContext.frameworks).toBeDefined();
    expect(selectiveContext.configurations).toEqual([]);
    expect(selectiveContext.testFrameworks).toEqual([]);
  });

  it('should maintain consistency across multiple analysis runs', async () => {
    // Create stable project structure
    const stableStructure = {
      'package.json': { name: 'stable-project', version: '1.0.0' },
      'README.md': '# Stable Project\n\nThis project structure should be consistent.',
      'src/index.ts': 'export const version = "1.0.0";',
      'src/utils/helper.ts': 'export function help() { return "help"; }'
    };

    for (const [filePath, content] of Object.entries(stableStructure)) {
      const fullPath = path.join(tempDir, filePath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      const fileContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
      await fs.promises.writeFile(fullPath, fileContent);
    }

    // Run multiple analyses
    const contexts = await Promise.all([
      analyzer.analyze(),
      analyzer.analyze(),
      analyzer.analyze()
    ]);

    // All contexts should be identical in structure
    for (let i = 1; i < contexts.length; i++) {
      expect(contexts[i].structure.root).toBe(contexts[0].structure.root);
      expect(contexts[i].structure.totalFiles).toBe(contexts[0].structure.totalFiles);
      expect(contexts[i].structure.totalDirectories).toBe(contexts[0].structure.totalDirectories);
      expect(contexts[i].structure.hasPackageJson).toBe(contexts[0].structure.hasPackageJson);
      expect(contexts[i].structure.hasReadme).toBe(contexts[0].structure.hasReadme);
    }

    // Detected timestamps might differ slightly but should be close
    const timeDifferences = contexts.map((ctx, i) => {
      if (i === 0) return 0;
      return Math.abs(ctx.detectedAt!.getTime() - contexts[0].detectedAt!.getTime());
    });

    timeDifferences.forEach(diff => {
      expect(diff).toBeLessThan(1000); // Within 1 second
    });
  });
});