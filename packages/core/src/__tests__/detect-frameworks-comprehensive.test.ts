/**
 * Comprehensive test suite for the detectFrameworks() method
 *
 * This test suite ensures the detectFrameworks() method meets all acceptance criteria:
 * - Detects major frameworks (React, Vue, Angular, Next.js, Express, NestJS, FastAPI, Django, etc.)
 * - Analyzes package.json, config files, and directory patterns
 * - Returns framework name, version, and confidence score
 * - Unit tests cover detection of at least 10 frameworks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';
import type { FrameworkInfo } from '../types';

describe('detectFrameworks() - Comprehensive Test Suite', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-frameworks-test-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Package.json Detection', () => {
    it('should detect React framework with correct details', async () => {
      const packageJson = {
        name: 'react-app',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const react = detection.frameworks.find(f => f.name === 'React');

      expect(react).toBeDefined();
      expect(react!.name).toBe('React');
      expect(react!.version).toBe('^18.2.0');
      expect(react!.category).toBe('frontend');
      expect(react!.confidence).toBe('high');
      expect(react!.language).toBe('javascript');
      expect(react!.detectionReasons).toContain('package.json dependency: react');
      expect(react!.detectedVia).toContain('package.json dependency: react');
    });

    it('should detect Vue framework with correct details', async () => {
      const packageJson = {
        name: 'vue-app',
        dependencies: {
          vue: '^3.3.4'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const vue = detection.frameworks.find(f => f.name === 'Vue');

      expect(vue).toBeDefined();
      expect(vue!.name).toBe('Vue');
      expect(vue!.version).toBe('^3.3.4');
      expect(vue!.category).toBe('frontend');
      expect(vue!.confidence).toBe('high');
      expect(vue!.detectionReasons).toContain('package.json dependency: vue');
    });

    it('should detect Angular framework with correct details', async () => {
      const packageJson = {
        name: 'angular-app',
        dependencies: {
          '@angular/core': '^17.0.0',
          '@angular/common': '^17.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const angular = detection.frameworks.find(f => f.name === 'Angular');

      expect(angular).toBeDefined();
      expect(angular!.name).toBe('Angular');
      expect(angular!.version).toBe('^17.0.0');
      expect(angular!.category).toBe('frontend');
      expect(angular!.confidence).toBe('high');
      expect(angular!.detectionReasons).toContain('package.json dependency: @angular/core');
    });

    it('should detect Next.js framework with correct details', async () => {
      const packageJson = {
        name: 'nextjs-app',
        dependencies: {
          next: '^14.0.4',
          react: '^18.2.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const nextjs = detection.frameworks.find(f => f.name === 'Next.js');

      expect(nextjs).toBeDefined();
      expect(nextjs!.name).toBe('Next.js');
      expect(nextjs!.version).toBe('^14.0.4');
      expect(nextjs!.category).toBe('fullstack');
      expect(nextjs!.confidence).toBe('high');
      expect(nextjs!.detectionReasons).toContain('package.json dependency: next');
    });

    it('should detect Express framework with correct details', async () => {
      const packageJson = {
        name: 'express-app',
        dependencies: {
          express: '^4.18.2'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const express = detection.frameworks.find(f => f.name === 'Express');

      expect(express).toBeDefined();
      expect(express!.name).toBe('Express');
      expect(express!.version).toBe('^4.18.2');
      expect(express!.category).toBe('backend');
      expect(express!.confidence).toBe('high');
      expect(express!.detectionReasons).toContain('package.json dependency: express');
    });

    it('should detect NestJS framework with correct details', async () => {
      const packageJson = {
        name: 'nestjs-app',
        dependencies: {
          '@nestjs/core': '^10.2.8',
          '@nestjs/common': '^10.2.8'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();
      const nestjs = detection.frameworks.find(f => f.name === 'NestJS');

      expect(nestjs).toBeDefined();
      expect(nestjs!.name).toBe('NestJS');
      expect(nestjs!.version).toBe('^10.2.8');
      expect(nestjs!.category).toBe('backend');
      expect(nestjs!.confidence).toBe('high');
      expect(nestjs!.detectionReasons).toContain('package.json dependency: @nestjs/core');
    });

    it('should detect at least 10 major frameworks from package.json', async () => {
      const packageJson = {
        name: 'multi-framework-app',
        dependencies: {
          // Frontend frameworks (4)
          react: '^18.2.0',
          vue: '^3.3.4',
          svelte: '^4.2.8',
          'solid-js': '^1.8.5',

          // Fullstack frameworks (3)
          next: '^14.0.4',
          nuxt: '^3.8.2',
          gatsby: '^5.12.12',

          // Backend frameworks (4)
          express: '^4.18.2',
          fastify: '^4.24.3',
          '@nestjs/core': '^10.2.8',
          koa: '^2.14.2',

          // Build tools (3)
          vite: '^5.0.4',
          webpack: '^5.89.0',
          rollup: '^4.6.1',

          // Testing frameworks (2)
          jest: '^29.7.0',
          vitest: '^1.0.4',

          // CSS/UI frameworks (2)
          tailwindcss: '^3.3.6',
          '@mui/material': '^5.14.18',

          // State management (2)
          redux: '^5.0.0',
          zustand: '^4.4.7',

          // Database ORMs (2)
          prisma: '^5.6.0',
          mongoose: '^8.0.0',

          // Mobile/Desktop (2)
          'react-native': '^0.72.7',
          electron: '^27.1.3'
        },
        devDependencies: {
          typescript: '^5.2.2'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      // Should detect at least 10 frameworks
      expect(detection.frameworks.length).toBeGreaterThanOrEqual(10);

      // Verify specific major frameworks are detected
      const frameworkNames = detection.frameworks.map(f => f.name.toLowerCase());
      expect(frameworkNames).toContain('react');
      expect(frameworkNames).toContain('vue');
      expect(frameworkNames).toContain('next.js');
      expect(frameworkNames).toContain('express');
      expect(frameworkNames).toContain('nestjs');
      expect(frameworkNames).toContain('typescript');
      expect(frameworkNames).toContain('jest');
      expect(frameworkNames).toContain('vite');
      expect(frameworkNames).toContain('tailwind css');
      expect(frameworkNames).toContain('prisma');

      // Verify all have required properties
      for (const framework of detection.frameworks) {
        expect(framework.name).toBeDefined();
        expect(framework.version).toBeDefined();
        expect(framework.category).toBeDefined();
        expect(framework.confidence).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(framework.confidence);
        expect(framework.detectionReasons).toBeDefined();
        expect(framework.detectionReasons!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Configuration File Detection', () => {
    it('should detect frameworks from configuration files', async () => {
      const configFiles = [
        { name: 'next.config.js', content: 'module.exports = {}', expectedFramework: 'Next.js' },
        { name: 'nuxt.config.ts', content: 'export default defineNuxtConfig({})', expectedFramework: 'Nuxt' },
        { name: 'vue.config.js', content: 'module.exports = {}', expectedFramework: 'Vue' },
        { name: 'angular.json', content: '{"version": 1}', expectedFramework: 'Angular' },
        { name: 'svelte.config.js', content: 'export default {}', expectedFramework: 'Svelte' },
        { name: 'vite.config.ts', content: 'export default {}', expectedFramework: 'Vite' },
        { name: 'webpack.config.js', content: 'module.exports = {}', expectedFramework: 'Webpack' },
        { name: 'rollup.config.js', content: 'export default {}', expectedFramework: 'Rollup' },
        { name: 'jest.config.js', content: 'module.exports = {}', expectedFramework: 'Jest' },
        { name: 'playwright.config.ts', content: 'export default {}', expectedFramework: 'Playwright' },
        { name: 'cypress.config.js', content: 'module.exports = {}', expectedFramework: 'Cypress' },
        { name: 'tailwind.config.js', content: 'module.exports = {}', expectedFramework: 'Tailwind CSS' }
      ];

      // Create all config files
      for (const { name, content } of configFiles) {
        await fs.promises.writeFile(path.join(tempDir, name), content);
      }

      const detection = await analyzer.detectFrameworks();

      // Should detect at least 10 frameworks from config files
      expect(detection.frameworks.length).toBeGreaterThanOrEqual(10);

      // Verify specific frameworks are detected
      const frameworkNames = detection.frameworks.map(f => f.name);
      for (const { expectedFramework } of configFiles) {
        expect(frameworkNames).toContain(expectedFramework);
      }

      // All should have medium confidence (config-based detection)
      for (const framework of detection.frameworks) {
        expect(framework.confidence).toBe('medium');
        expect(framework.detectionReasons!.some(reason =>
          reason.toLowerCase().includes('configuration file')
        )).toBe(true);
        expect(framework.configFiles).toBeDefined();
        expect(framework.configFiles!.length).toBeGreaterThan(0);
      }
    });

    it('should detect Django from Python-specific files', async () => {
      // Create Django project structure
      await fs.promises.mkdir(path.join(tempDir, 'myproject'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'manage.py'),
        '#!/usr/bin/env python\nimport django'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'myproject', 'settings.py'),
        'INSTALLED_APPS = ["django.contrib.admin"]'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'myproject', 'models.py'),
        'from django.db import models'
      );

      const detection = await analyzer.detectFrameworks();
      const django = detection.frameworks.find(f => f.name === 'Django');

      expect(django).toBeDefined();
      expect(django!.category).toBe('backend');
      expect(django!.confidence).toBe('high');
      expect(django!.detectionReasons!.some(reason =>
        reason.includes('Django project structure found')
      )).toBe(true);
    });
  });

  describe('Directory Pattern Detection', () => {
    it('should detect React from JSX files and component patterns', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'components', 'App.jsx'),
        'import React from "react";\nexport default function App() { return <div>Hello</div>; }'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'components', 'Button.tsx'),
        'import React from "react";\nexport const Button = () => <button>Click</button>;'
      );

      const detection = await analyzer.detectFrameworks();
      const react = detection.frameworks.find(f => f.name === 'React');

      expect(react).toBeDefined();
      expect(react!.category).toBe('frontend');
      expect(react!.confidence).toBe('low'); // Pattern-based detection has lower confidence
      expect(react!.detectionReasons!.some(reason =>
        reason.includes('JSX files or React component patterns found')
      )).toBe(true);
    });

    it('should detect Vue from .vue files', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'src', 'components'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'components', 'HelloWorld.vue'),
        '<template>\n  <div>{{ msg }}</div>\n</template>\n<script>\nexport default {\n  name: "HelloWorld"\n}\n</script>'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'App.vue'),
        '<template>\n  <div id="app">Hello Vue</div>\n</template>'
      );

      const detection = await analyzer.detectFrameworks();
      const vue = detection.frameworks.find(f => f.name === 'Vue');

      expect(vue).toBeDefined();
      expect(vue!.category).toBe('frontend');
      expect(vue!.confidence).toBe('medium');
      expect(vue!.detectionReasons!.some(reason =>
        reason.includes('.vue files found')
      )).toBe(true);
    });

    it('should detect Next.js from pages directory structure', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'pages', 'api'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'pages', 'index.tsx'),
        'export default function Home() { return <h1>Welcome</h1>; }'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'pages', 'about.js'),
        'export default function About() { return <div>About page</div>; }'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'pages', 'api', 'hello.js'),
        'export default function handler(req, res) { res.json({ hello: "world" }); }'
      );

      const detection = await analyzer.detectFrameworks();
      const nextjs = detection.frameworks.find(f => f.name === 'Next.js');

      expect(nextjs).toBeDefined();
      expect(nextjs!.category).toBe('fullstack');
      expect(nextjs!.confidence).toBe('medium');
      expect(nextjs!.detectionReasons!.some(reason =>
        reason.includes('Next.js pages or app directory structure found')
      )).toBe(true);
    });
  });

  describe('Confidence Levels and Scoring', () => {
    it('should assign high confidence to package.json dependencies', async () => {
      const packageJson = {
        name: 'confidence-test',
        dependencies: {
          react: '^18.0.0',
          express: '^4.18.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      for (const framework of detection.frameworks) {
        if (framework.detectedVia?.includes('package.json dependency')) {
          expect(framework.confidence).toBe('high');
        }
      }
    });

    it('should assign medium confidence to configuration file detection', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'vite.config.js'),
        'export default {}'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = {}'
      );

      const detection = await analyzer.detectFrameworks();

      for (const framework of detection.frameworks) {
        if (framework.detectedVia?.includes('Configuration file')) {
          expect(framework.confidence).toBe('medium');
        }
      }
    });

    it('should assign low confidence to pattern-based detection', async () => {
      // Create JSX files without package.json
      await fs.promises.mkdir(path.join(tempDir, 'components'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'components', 'App.jsx'),
        'export default function App() { return <div>Hello</div>; }'
      );

      const detection = await analyzer.detectFrameworks();
      const react = detection.frameworks.find(f => f.name === 'React');

      if (react) {
        expect(react.confidence).toBe('low');
      }
    });

    it('should merge multiple detection sources and use highest confidence', async () => {
      // Create both package.json and config file for same framework
      const packageJson = {
        name: 'merge-test',
        dependencies: {
          next: '^14.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'next.config.js'),
        'module.exports = {}'
      );

      const detection = await analyzer.detectFrameworks();
      const nextjs = detection.frameworks.find(f => f.name === 'Next.js');

      expect(nextjs).toBeDefined();
      expect(nextjs!.confidence).toBe('high'); // Should use highest confidence (package.json)
      expect(nextjs!.detectionReasons!.length).toBeGreaterThanOrEqual(2);
      expect(nextjs!.configFiles).toBeDefined();
      expect(nextjs!.configFiles!.includes('next.config.js')).toBe(true);
    });
  });

  describe('Primary Framework Selection', () => {
    it('should select framework with highest confidence as primary', async () => {
      const packageJson = {
        name: 'primary-test',
        dependencies: {
          react: '^18.0.0', // High confidence
          lodash: '^4.17.21' // Not a framework
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Add medium confidence framework
      await fs.promises.writeFile(
        path.join(tempDir, 'vite.config.js'),
        'export default {}'
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.primary).toBeDefined();
      expect(detection.primary!.confidence).toBe('high');
      expect(detection.primary!.name).toBe('React');
    });
  });

  describe('Language Detection', () => {
    it('should detect primary language correctly', async () => {
      // Create TypeScript project
      const packageJson = {
        name: 'ts-project',
        devDependencies: {
          typescript: '^5.0.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'index.ts'),
        'console.log("Hello TypeScript");'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'types.ts'),
        'export interface User { name: string; }'
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.languages).toBeDefined();
      expect(detection.languages.length).toBeGreaterThan(0);
      expect(detection.primaryLanguage).toBe('typescript');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing package.json gracefully', async () => {
      // No package.json file
      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toBeDefined();
      expect(Array.isArray(detection.frameworks)).toBe(true);
      expect(detection.error).toBeUndefined();
    });

    it('should handle invalid package.json gracefully', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        '{ invalid json'
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toBeDefined();
      expect(Array.isArray(detection.frameworks)).toBe(true);
      // Should not crash, might have error but should continue
    });

    it('should handle empty directory gracefully', async () => {
      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks).toBeDefined();
      expect(detection.frameworks).toEqual([]);
      expect(detection.languages).toBeDefined();
      expect(detection.languages).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle projects with only devDependencies', async () => {
      const packageJson = {
        name: 'dev-only-project',
        devDependencies: {
          typescript: '^5.0.0',
          vitest: '^1.0.0',
          '@playwright/test': '^1.40.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks.length).toBeGreaterThanOrEqual(3);

      const typescript = detection.frameworks.find(f => f.name === 'TypeScript');
      expect(typescript).toBeDefined();
      expect(typescript!.isDevDependency).toBe(true);
    });

    it('should handle projects with complex directory structures', async () => {
      // Create deep nested structure
      await fs.promises.mkdir(path.join(tempDir, 'packages', 'web', 'src', 'components'), { recursive: true });
      await fs.promises.mkdir(path.join(tempDir, 'packages', 'api', 'src', 'controllers'), { recursive: true });

      await fs.promises.writeFile(
        path.join(tempDir, 'packages', 'web', 'src', 'components', 'App.vue'),
        '<template><div>Vue App</div></template>'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'packages', 'api', 'src', 'app.py'),
        'from django.conf import settings'
      );

      const detection = await analyzer.detectFrameworks();

      // Should handle deep nesting and still detect frameworks
      expect(detection.frameworks.length).toBeGreaterThan(0);
    });
  });

  describe('Real-world Framework Combinations', () => {
    it('should handle typical fullstack application (React + Express + TypeScript)', async () => {
      const packageJson = {
        name: 'fullstack-app',
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          express: '^4.18.2',
          cors: '^2.8.5'
        },
        devDependencies: {
          typescript: '^5.2.2',
          '@types/react': '^18.2.37',
          '@types/express': '^4.17.21',
          vitest: '^1.0.4',
          '@playwright/test': '^1.40.0'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext'
          }
        }, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks.length).toBeGreaterThanOrEqual(5);

      const frameworkNames = detection.frameworks.map(f => f.name);
      expect(frameworkNames).toContain('React');
      expect(frameworkNames).toContain('Express');
      expect(frameworkNames).toContain('TypeScript');
      expect(frameworkNames).toContain('Vitest');
      expect(frameworkNames).toContain('Playwright');

      // Should identify primary framework
      expect(detection.primary).toBeDefined();
      expect(['React', 'Express', 'TypeScript']).toContain(detection.primary!.name);
    });

    it('should handle modern frontend stack (Next.js + Tailwind + Prisma)', async () => {
      const packageJson = {
        name: 'modern-frontend',
        dependencies: {
          next: '^14.0.4',
          react: '^18.2.0',
          tailwindcss: '^3.3.6',
          '@prisma/client': '^5.6.0'
        },
        devDependencies: {
          typescript: '^5.2.2',
          prisma: '^5.6.0',
          '@types/react': '^18.2.37'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'next.config.js'),
        'module.exports = {}'
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'tailwind.config.js'),
        'module.exports = {}'
      );

      await fs.promises.mkdir(path.join(tempDir, 'prisma'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'prisma', 'schema.prisma'),
        'generator client {\n  provider = "prisma-client-js"\n}'
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.frameworks.length).toBeGreaterThanOrEqual(6);

      const frameworkNames = detection.frameworks.map(f => f.name);
      expect(frameworkNames).toContain('Next.js');
      expect(frameworkNames).toContain('React');
      expect(frameworkNames).toContain('Tailwind CSS');
      expect(frameworkNames).toContain('Prisma');
      expect(frameworkNames).toContain('TypeScript');
    });
  });

  describe('Package Manager and Runtime Detection', () => {
    it('should detect package manager correctly', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test' }, null, 2)
      );
      await fs.promises.writeFile(path.join(tempDir, 'yarn.lock'), '# Yarn lockfile');

      const detection = await analyzer.detectFrameworks();

      expect(detection.packageManager).toBe('yarn');
    });

    it('should detect runtime environment from frameworks', async () => {
      const packageJson = {
        name: 'node-app',
        dependencies: {
          express: '^4.18.2'
        }
      };

      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const detection = await analyzer.detectFrameworks();

      expect(detection.runtime).toBe('node');
    });
  });
});