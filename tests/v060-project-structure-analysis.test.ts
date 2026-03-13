/**
 * @fileoverview Comprehensive test suite for v0.6.0 Project Structure Analysis features
 *
 * This test suite validates the project structure analysis functionality implemented for v0.6.0:
 * - Directory layout analysis with depth control
 * - File type detection and categorization
 * - Size calculations and statistics
 * - Framework and technology detection
 * - Configuration file awareness
 * - Integration with project context
 *
 * Tests verify both implementation completeness and performance with large codebases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ProjectContextAnalyzer,
  type ProjectStructure,
  type FrameworkDetection,
  type ConfigurationInfo,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
} from '@apexcli/core';

describe('v0.6.0 Project Structure Analysis Features', () => {
  const testProjectDir = '/tmp/apex-project-structure-test';
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    // Clean up and create fresh test project
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Directory may not exist, ignore
    }

    await fs.mkdir(testProjectDir, { recursive: true });
    analyzer = new ProjectContextAnalyzer(testProjectDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Directory Layout Analysis', () => {
    it('should analyze basic project structure', async () => {
      // Create a basic project structure
      await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(testProjectDir, 'tests'), { recursive: true });
      await fs.mkdir(path.join(testProjectDir, 'docs'), { recursive: true });

      await fs.writeFile(path.join(testProjectDir, 'README.md'), '# Test Project\n');
      await fs.writeFile(path.join(testProjectDir, 'src', 'index.js'), 'console.log("hello");\n');
      await fs.writeFile(path.join(testProjectDir, 'tests', 'index.test.js'), 'test("hello", () => {});\n');

      const structure = await analyzer.getProjectStructure(testProjectDir, {
        maxDepth: 2,
        includeHidden: false
      });

      // Validate schema compliance
      expect(() => ProjectStructureSchema.parse(structure)).not.toThrow();

      // Verify basic structure information
      expect(structure.totalFiles).toBeGreaterThan(0);
      expect(structure.totalDirectories).toBeGreaterThan(0);
      expect(structure.totalSize).toBeGreaterThan(0);
      expect(structure.entries.length).toBeGreaterThan(0);

      // Check that expected directories are found
      const directoryNames = structure.entries
        .filter(entry => entry.type === 'directory')
        .map(entry => entry.name);

      expect(directoryNames).toContain('src');
      expect(directoryNames).toContain('tests');
      expect(directoryNames).toContain('docs');
    });

    it('should respect depth limits', async () => {
      // Create deep nested structure
      await fs.mkdir(path.join(testProjectDir, 'level1', 'level2', 'level3', 'level4'), { recursive: true });
      await fs.writeFile(path.join(testProjectDir, 'level1', 'level2', 'level3', 'level4', 'deep.txt'), 'deep file\n');

      const shallowStructure = await analyzer.getProjectStructure(testProjectDir, {
        maxDepth: 2,
        includeHidden: false
      });

      const deepStructure = await analyzer.getProjectStructure(testProjectDir, {
        maxDepth: 5,
        includeHidden: false
      });

      expect(shallowStructure.maxDepth).toBeLessThanOrEqual(2);
      expect(deepStructure.maxDepth).toBeGreaterThan(shallowStructure.maxDepth);
      expect(deepStructure.totalFiles).toBeGreaterThanOrEqual(shallowStructure.totalFiles);
    });

    it('should handle hidden files correctly', async () => {
      // Create hidden files and directories
      await fs.writeFile(path.join(testProjectDir, '.hidden-file'), 'hidden content\n');
      await fs.mkdir(path.join(testProjectDir, '.hidden-dir'), { recursive: true });
      await fs.writeFile(path.join(testProjectDir, '.hidden-dir', 'nested.txt'), 'nested hidden\n');
      await fs.writeFile(path.join(testProjectDir, 'visible.txt'), 'visible content\n');

      const withoutHidden = await analyzer.getProjectStructure(testProjectDir, {
        maxDepth: 3,
        includeHidden: false
      });

      const withHidden = await analyzer.getProjectStructure(testProjectDir, {
        maxDepth: 3,
        includeHidden: true
      });

      expect(withHidden.totalFiles).toBeGreaterThan(withoutHidden.totalFiles);

      const hiddenEntries = withHidden.entries.filter(entry => entry.name.startsWith('.'));
      expect(hiddenEntries.length).toBeGreaterThan(0);

      const visibleOnlyEntries = withoutHidden.entries.filter(entry => entry.name.startsWith('.'));
      expect(visibleOnlyEntries.length).toBe(0);
    });

    it('should calculate size information accurately', async () => {
      // Create files with known content sizes
      const testFiles = [
        { name: 'small.txt', content: 'small' }, // 5 bytes
        { name: 'medium.txt', content: 'x'.repeat(100) }, // 100 bytes
        { name: 'large.txt', content: 'y'.repeat(1000) } // 1000 bytes
      ];

      for (const file of testFiles) {
        await fs.writeFile(path.join(testProjectDir, file.name), file.content);
      }

      const structure = await analyzer.getProjectStructure(testProjectDir);

      // Total size should be at least the sum of our test files
      const expectedMinSize = testFiles.reduce((sum, file) => sum + file.content.length, 0);
      expect(structure.totalSize).toBeGreaterThanOrEqual(expectedMinSize);

      // Check individual file sizes
      const smallFile = structure.entries.find(entry => entry.name === 'small.txt');
      expect(smallFile?.size).toBe(5);

      const mediumFile = structure.entries.find(entry => entry.name === 'medium.txt');
      expect(mediumFile?.size).toBe(100);

      const largeFile = structure.entries.find(entry => entry.name === 'large.txt');
      expect(largeFile?.size).toBe(1000);
    });

    it('should handle empty directories', async () => {
      // Create empty directories
      await fs.mkdir(path.join(testProjectDir, 'empty1'), { recursive: true });
      await fs.mkdir(path.join(testProjectDir, 'empty2'), { recursive: true });
      await fs.mkdir(path.join(testProjectDir, 'not-empty'), { recursive: true });
      await fs.writeFile(path.join(testProjectDir, 'not-empty', 'file.txt'), 'content\n');

      const structure = await analyzer.getProjectStructure(testProjectDir);

      const emptyDirs = structure.entries.filter(entry =>
        entry.type === 'directory' && (entry.name === 'empty1' || entry.name === 'empty2')
      );

      expect(emptyDirs.length).toBe(2);
      expect(structure.totalDirectories).toBeGreaterThanOrEqual(3);
    });
  });

  describe('File Type Detection and Categorization', () => {
    it('should detect various file types', async () => {
      const testFiles = [
        'app.js',
        'component.tsx',
        'styles.css',
        'config.json',
        'README.md',
        'Dockerfile',
        'script.py',
        'main.go',
        'styles.scss',
        'App.vue',
        'package.json',
        'tsconfig.json',
        '.eslintrc.js',
        '.gitignore',
        'yarn.lock',
        'Cargo.toml',
        'main.rs'
      ];

      // Create files with representative content
      for (const fileName of testFiles) {
        const content = getTestContentForFile(fileName);
        await fs.writeFile(path.join(testProjectDir, fileName), content);
      }

      const structure = await analyzer.getProjectStructure(testProjectDir);

      // Verify files are detected
      expect(structure.totalFiles).toBe(testFiles.length);

      // Check that different file types are present
      const fileExtensions = structure.entries
        .filter(entry => entry.type === 'file')
        .map(entry => path.extname(entry.name))
        .filter(ext => ext.length > 0);

      const uniqueExtensions = [...new Set(fileExtensions)];
      expect(uniqueExtensions.length).toBeGreaterThan(5); // Should detect multiple types
      expect(uniqueExtensions).toContain('.js');
      expect(uniqueExtensions).toContain('.tsx');
      expect(uniqueExtensions).toContain('.json');
      expect(uniqueExtensions).toContain('.md');
    });

    it('should detect binary vs text files', async () => {
      // Create text files
      await fs.writeFile(path.join(testProjectDir, 'text.txt'), 'text content\n');
      await fs.writeFile(path.join(testProjectDir, 'code.js'), 'const x = 1;\n');

      // Create binary-like file (though not truly binary in this test)
      const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
      await fs.writeFile(path.join(testProjectDir, 'image.png'), binaryContent);

      const structure = await analyzer.getProjectStructure(testProjectDir);

      expect(structure.totalFiles).toBe(3);

      // All files should be detected regardless of type
      const fileNames = structure.entries
        .filter(entry => entry.type === 'file')
        .map(entry => entry.name);

      expect(fileNames).toContain('text.txt');
      expect(fileNames).toContain('code.js');
      expect(fileNames).toContain('image.png');
    });

    it('should handle special characters in file names', async () => {
      const specialFiles = [
        'file with spaces.txt',
        'file-with-dashes.txt',
        'file_with_underscores.txt',
        'file.with.dots.txt',
        'file@symbol.txt',
        'file(parentheses).txt'
      ];

      for (const fileName of specialFiles) {
        try {
          await fs.writeFile(path.join(testProjectDir, fileName), `content for ${fileName}\n`);
        } catch (error) {
          // Some special characters might not be allowed on certain file systems
          console.warn(`Skipping file with special characters: ${fileName}`);
        }
      }

      const structure = await analyzer.getProjectStructure(testProjectDir);

      expect(structure.totalFiles).toBeGreaterThan(0);

      // At least the basic special character files should work
      const fileNames = structure.entries
        .filter(entry => entry.type === 'file')
        .map(entry => entry.name);

      expect(fileNames.some(name => name.includes(' '))).toBe(true); // Spaces
      expect(fileNames.some(name => name.includes('-'))).toBe(true); // Dashes
      expect(fileNames.some(name => name.includes('_'))).toBe(true); // Underscores
    });
  });

  describe('Framework and Technology Detection', () => {
    it('should detect Node.js projects', async () => {
      await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        main: 'index.js',
        scripts: {
          start: 'node index.js',
          test: 'npm test'
        },
        dependencies: {
          'express': '^4.18.0'
        }
      }, null, 2));

      await fs.writeFile(path.join(testProjectDir, 'index.js'), `
const express = require('express');
const app = express();
app.listen(3000);
      `);

      const frameworks = await analyzer.detectFrameworks(testProjectDir);

      expect(() => {
        frameworks.forEach(framework => FrameworkDetectionSchema.parse(framework));
      }).not.toThrow();

      const nodeFramework = frameworks.find(f => f.name.toLowerCase().includes('node'));
      expect(nodeFramework).toBeDefined();

      if (nodeFramework) {
        expect(nodeFramework.category).toBe('runtime');
        expect(nodeFramework.confidence).toMatch(/^(high|medium|low)$/);
        expect(nodeFramework.detectionReasons.length).toBeGreaterThan(0);
      }
    });

    it('should detect TypeScript projects', async () => {
      await fs.writeFile(path.join(testProjectDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'es2020',
          module: 'commonjs',
          outDir: 'dist',
          strict: true
        }
      }, null, 2));

      await fs.writeFile(path.join(testProjectDir, 'src', 'app.ts'), `
interface User {
  id: number;
  name: string;
}

const user: User = { id: 1, name: 'Test' };
console.log(user);
      `);

      const frameworks = await analyzer.detectFrameworks(testProjectDir);

      const typeScriptFramework = frameworks.find(f => f.name.toLowerCase().includes('typescript'));
      expect(typeScriptFramework).toBeDefined();

      if (typeScriptFramework) {
        expect(typeScriptFramework.category).toBe('language');
        expect(typeScriptFramework.confidence).toBe('high');
        expect(typeScriptFramework.configFiles.some(f => f.includes('tsconfig.json'))).toBe(true);
      }
    });

    it('should detect React projects', async () => {
      await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
        name: 'react-app',
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        },
        devDependencies: {
          '@types/react': '^18.0.0'
        }
      }));

      await fs.writeFile(path.join(testProjectDir, 'src', 'App.tsx'), `
import React from 'react';

function App() {
  return <div>Hello React</div>;
}

export default App;
      `);

      const frameworks = await analyzer.detectFrameworks(testProjectDir);

      const reactFramework = frameworks.find(f => f.name.toLowerCase().includes('react'));
      expect(reactFramework).toBeDefined();

      if (reactFramework) {
        expect(reactFramework.category).toBe('frontend');
        expect(reactFramework.confidence).toBe('high');
      }
    });

    it('should detect testing frameworks', async () => {
      await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        devDependencies: {
          'vitest': '^1.0.0',
          'jest': '^29.0.0',
          '@testing-library/react': '^13.0.0'
        },
        scripts: {
          test: 'vitest',
          'test:jest': 'jest'
        }
      }));

      await fs.writeFile(path.join(testProjectDir, 'vitest.config.ts'), `
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom'
  }
});
      `);

      await fs.writeFile(path.join(testProjectDir, 'tests', 'app.test.ts'), `
import { test, expect } from 'vitest';

test('sample test', () => {
  expect(true).toBe(true);
});
      `);

      const frameworks = await analyzer.detectFrameworks(testProjectDir);

      const testingFrameworks = frameworks.filter(f => f.category === 'testing');
      expect(testingFrameworks.length).toBeGreaterThan(0);

      const vitestFramework = frameworks.find(f => f.name.toLowerCase().includes('vitest'));
      expect(vitestFramework).toBeDefined();

      if (vitestFramework) {
        expect(vitestFramework.confidence).toBe('high');
        expect(vitestFramework.detectionReasons).toContain('vitest.config.ts file');
      }
    });

    it('should provide confidence levels and detection reasons', async () => {
      // Create minimal framework detection scenario
      await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
        name: 'minimal-project',
        dependencies: {
          'lodash': '^4.17.0'
        }
      }));

      const frameworks = await analyzer.detectFrameworks(testProjectDir);

      frameworks.forEach(framework => {
        expect(framework.confidence).toMatch(/^(high|medium|low)$/);
        expect(framework.detectionReasons).toBeInstanceOf(Array);
        expect(framework.detectionReasons.length).toBeGreaterThan(0);

        // Each detection reason should be a meaningful string
        framework.detectionReasons.forEach(reason => {
          expect(typeof reason).toBe('string');
          expect(reason.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Configuration File Awareness', () => {
    it('should detect and parse various configuration files', async () => {
      const configFiles = [
        {
          name: 'package.json',
          content: JSON.stringify({
            name: 'test-project',
            version: '1.0.0',
            scripts: { test: 'npm test' }
          })
        },
        {
          name: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: { target: 'es2020', strict: true }
          })
        },
        {
          name: '.eslintrc.json',
          content: JSON.stringify({
            env: { node: true, es6: true },
            rules: { 'no-console': 'warn' }
          })
        },
        {
          name: 'vitest.config.ts',
          content: `
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { environment: 'jsdom' }
});
          `
        }
      ];

      for (const config of configFiles) {
        await fs.writeFile(path.join(testProjectDir, config.name), config.content);
      }

      const configs = await analyzer.getConfigurationInfoList(testProjectDir);

      expect(() => {
        configs.forEach(config => ConfigurationInfoSchema.parse(config));
      }).not.toThrow();

      expect(configs.length).toBeGreaterThan(0);

      // Check for expected configuration files
      const configNames = configs.map(c => path.basename(c.path));
      expect(configNames).toContain('package.json');
      expect(configNames).toContain('tsconfig.json');
      expect(configNames.some(name => name.includes('eslint'))).toBe(true);

      // Verify configuration purposes are assigned
      const packageConfig = configs.find(c => path.basename(c.path) === 'package.json');
      expect(packageConfig?.purposes).toContain('package_management');

      const tsconfigConfig = configs.find(c => path.basename(c.path) === 'tsconfig.json');
      expect(tsconfigConfig?.purposes).toContain('language_config');
    });

    it('should safely parse valid JSON configurations', async () => {
      await fs.writeFile(path.join(testProjectDir, 'valid.json'), JSON.stringify({
        setting1: 'value1',
        setting2: 42,
        setting3: true,
        nested: {
          prop: 'value'
        }
      }, null, 2));

      const configs = await analyzer.getConfigurationInfoList(testProjectDir);
      const validConfig = configs.find(c => path.basename(c.path) === 'valid.json');

      expect(validConfig).toBeDefined();
      expect(validConfig?.isValid).toBe(true);
      expect(validConfig?.settings).toBeDefined();

      if (validConfig?.settings) {
        expect(validConfig.settings.setting1).toBe('value1');
        expect(validConfig.settings.setting2).toBe(42);
        expect(validConfig.settings.setting3).toBe(true);
      }
    });

    it('should handle invalid JSON configurations gracefully', async () => {
      await fs.writeFile(path.join(testProjectDir, 'invalid.json'), '{ invalid json content');

      const configs = await analyzer.getConfigurationInfoList(testProjectDir);
      const invalidConfig = configs.find(c => path.basename(c.path) === 'invalid.json');

      expect(invalidConfig).toBeDefined();
      expect(invalidConfig?.isValid).toBe(false);
      expect(invalidConfig?.settings).toBeUndefined();
    });

    it('should not expose sensitive information in configuration settings', async () => {
      await fs.writeFile(path.join(testProjectDir, '.env'), `
API_KEY=secret123
PASSWORD=mypassword
TOKEN=abc123token
DATABASE_URL=postgres://user:pass@host:5432/db
NORMAL_SETTING=public_value
      `);

      await fs.writeFile(path.join(testProjectDir, 'config.json'), JSON.stringify({
        api_key: 'secret_key',
        password: 'hidden_password',
        public_setting: 'visible_value',
        database: {
          host: 'localhost',
          password: 'db_secret'
        }
      }));

      const configs = await analyzer.getConfigurationInfoList(testProjectDir);

      // Environment files should be detected but not parsed
      const envConfig = configs.find(c => path.basename(c.path) === '.env');
      if (envConfig) {
        expect(envConfig.isValid).toBe(true);
        expect(envConfig.settings).toBeUndefined(); // Should not parse env files for security
      }

      // JSON config should have sensitive data filtered
      const jsonConfig = configs.find(c => path.basename(c.path) === 'config.json');
      if (jsonConfig?.settings) {
        const settingsString = JSON.stringify(jsonConfig.settings);
        expect(settingsString.toLowerCase()).not.toMatch(/password|secret|key|token/);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large directory structures efficiently', async () => {
      const startTime = Date.now();

      // Create a moderately large project structure
      const directories = ['src', 'tests', 'docs', 'config', 'utils', 'components', 'services'];
      const filesPerDirectory = 20;

      for (const dir of directories) {
        await fs.mkdir(path.join(testProjectDir, dir), { recursive: true });

        for (let i = 0; i < filesPerDirectory; i++) {
          const fileName = `${dir}-file-${i}.js`;
          const content = `// ${dir} file ${i}\nexport const value${i} = ${i};\n`;
          await fs.writeFile(path.join(testProjectDir, dir, fileName), content);
        }
      }

      const structure = await analyzer.getProjectStructure(testProjectDir);
      const endTime = Date.now();

      expect(structure.totalFiles).toBe(directories.length * filesPerDirectory);
      expect(structure.totalDirectories).toBe(directories.length);

      // Should complete within reasonable time (3 seconds for ~140 files)
      expect(endTime - startTime).toBeLessThan(3000);
    });

    it('should provide accurate statistics for complex projects', async () => {
      // Create a realistic project structure with nested directories
      const structure = {
        'src/components': 15,
        'src/services': 8,
        'src/utils': 12,
        'src/types': 5,
        'tests/unit': 20,
        'tests/integration': 10,
        'docs/api': 6,
        'config/environments': 4
      };

      let totalExpectedFiles = 0;

      for (const [dirPath, fileCount] of Object.entries(structure)) {
        await fs.mkdir(path.join(testProjectDir, dirPath), { recursive: true });

        for (let i = 0; i < fileCount; i++) {
          const fileName = `file-${i}.js`;
          await fs.writeFile(
            path.join(testProjectDir, dirPath, fileName),
            `// File ${i} in ${dirPath}\n`
          );
          totalExpectedFiles++;
        }
      }

      const analysisResult = await analyzer.getProjectStructure(testProjectDir);

      expect(analysisResult.totalFiles).toBe(totalExpectedFiles);
      expect(analysisResult.totalDirectories).toBeGreaterThan(0);
      expect(analysisResult.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Integration with Full Project Analysis', () => {
    it('should integrate structure analysis with complete project context', async () => {
      // Create a comprehensive project
      await fs.mkdir(path.join(testProjectDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(testProjectDir, 'tests'), { recursive: true });

      await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
        name: 'integrated-test-project',
        version: '1.0.0',
        scripts: {
          test: 'vitest',
          build: 'tsc'
        },
        dependencies: {
          'react': '^18.0.0'
        },
        devDependencies: {
          'vitest': '^1.0.0',
          'typescript': '^5.0.0'
        }
      }));

      await fs.writeFile(path.join(testProjectDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
          target: 'es2020',
          module: 'commonjs'
        }
      }));

      await fs.writeFile(path.join(testProjectDir, 'src', 'index.tsx'), `
import React from 'react';
export const App = () => <div>Hello World</div>;
      `);

      await fs.writeFile(path.join(testProjectDir, 'tests', 'app.test.ts'), `
import { test } from 'vitest';
test('app test', () => {});
      `);

      const fullContext = await analyzer.analyze(testProjectDir, {
        includeGit: false, // Skip git for this test
        includeFrameworks: true,
        includeConfiguration: true,
        includeTestFrameworks: true,
        maxDepth: 3
      });

      expect(fullContext).toBeDefined();

      if (fullContext) {
        expect(fullContext.structure).toBeDefined();
        expect(fullContext.frameworks).toBeDefined();
        expect(fullContext.configurations).toBeDefined();
        expect(fullContext.testFrameworks).toBeDefined();

        // Structure should include our created files
        expect(fullContext.structure.totalFiles).toBeGreaterThan(3);
        expect(fullContext.structure.totalDirectories).toBeGreaterThan(1);

        // Should detect React, TypeScript, and Vitest
        const frameworkNames = fullContext.frameworks.map(f => f.name.toLowerCase());
        expect(frameworkNames.some(name => name.includes('react'))).toBe(true);
        expect(frameworkNames.some(name => name.includes('typescript'))).toBe(true);
        expect(frameworkNames.some(name => name.includes('vitest'))).toBe(true);

        // Should detect configuration files
        const configNames = fullContext.configurations.map(c => path.basename(c.path));
        expect(configNames).toContain('package.json');
        expect(configNames).toContain('tsconfig.json');

        // Should detect test framework
        expect(fullContext.testFrameworks.length).toBeGreaterThan(0);
        const vitestFramework = fullContext.testFrameworks.find(tf => tf.name.toLowerCase().includes('vitest'));
        expect(vitestFramework).toBeDefined();
      }
    });
  });
});

/**
 * Helper function to generate appropriate test content for different file types
 */
function getTestContentForFile(fileName: string): string {
  const ext = path.extname(fileName);

  switch (ext) {
    case '.js':
    case '.ts':
      return `// ${fileName}\nconst value = "test";\nexport default value;\n`;

    case '.jsx':
    case '.tsx':
      return `import React from 'react';\nexport const Component = () => <div>Test</div>;\n`;

    case '.css':
    case '.scss':
      return `.test-class {\n  color: blue;\n  margin: 10px;\n}\n`;

    case '.json':
      return JSON.stringify({ test: true, name: fileName }, null, 2);

    case '.md':
      return `# ${fileName}\n\nThis is a test markdown file.\n\n## Section\n\nContent here.\n`;

    case '.py':
      return `# ${fileName}\ndef hello():\n    print("Hello from Python")\n\nif __name__ == "__main__":\n    hello()\n`;

    case '.go':
      return `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from Go")\n}\n`;

    case '.rs':
      return `fn main() {\n    println!("Hello from Rust");\n}\n`;

    case '.vue':
      return `<template>\n  <div>{{ message }}</div>\n</template>\n\n<script>\nexport default {\n  data() {\n    return { message: 'Hello Vue' }\n  }\n}\n</script>\n`;

    default:
      if (fileName === 'Dockerfile') {
        return `FROM node:18-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nEXPOSE 3000\nCMD ["npm", "start"]\n`;
      }
      if (fileName.includes('ignore')) {
        return `node_modules/\ndist/\n*.log\n.env\n`;
      }
      if (fileName === 'yarn.lock' || fileName === 'package-lock.json') {
        return `# Generated lock file\n# Version: 1.0.0\n`;
      }
      if (fileName === 'Cargo.toml') {
        return `[package]\nname = "test-project"\nversion = "0.1.0"\nedition = "2021"\n`;
      }
      return `# Test content for ${fileName}\nThis is test content.\n`;
  }
}