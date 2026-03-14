/**
 * @fileoverview Tests for npm integration and project analysis components
 *
 * This test suite validates npm registry integration, package version checking,
 * and project analysis agent functionality that supports the v0.6.0 brownfield
 * analysis features.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import npm integration utilities
import { checkPackageVersion, queryNpmRegistry } from '../packages/core/src/npm-registry-utils.js';
import { runDoctor } from '../packages/core/src/doctor-utils.js';

// Import project analysis components
import { CodebaseIndexer } from '../packages/orchestrator/src/codebase-intelligence/indexer.js';
import { TreeSitterWrapper } from '../packages/orchestrator/src/codebase-intelligence/parsers/tree-sitter-wrapper.js';

// Import schema validators
import type {
  StackAnalysis,
  ArchitectureAnalysis,
  TechnicalDebtAnalysis
} from '../packages/core/src/types.js';

describe('npm Integration and Project Analysis', () => {
  const testProjectDir = '/tmp/apex-npm-integration-test';
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Directory may not exist, ignore
    }

    await fs.mkdir(testProjectDir, { recursive: true });
    process.chdir(testProjectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    try {
      await fs.rm(testProjectDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Reset all mocks
    vi.restoreAllMocks();
  });

  describe('npm Registry Integration', () => {
    it('should query npm registry for package information', async () => {
      const packageInfo = await queryNpmRegistry('express');

      expect(packageInfo).toBeDefined();
      expect(packageInfo.name).toBe('express');
      expect(packageInfo.version).toBeDefined();
      expect(packageInfo.description).toBeDefined();
    });

    it('should handle npm registry errors gracefully', async () => {
      // Mock fetch to simulate network error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        const result = await queryNpmRegistry('nonexistent-package-xyz');
        expect(result).toBeNull();
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }

      global.fetch = originalFetch;
    });

    it('should check package versions and detect outdated dependencies', async () => {
      await createProjectWithOutdatedDependencies();

      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      const dependencies = packageJson.dependencies || {};

      const results = await Promise.all(
        Object.entries(dependencies).map(([name, version]) =>
          checkPackageVersion(name, version as string)
        )
      );

      const hasOutdated = results.some(result => result.isOutdated);
      expect(hasOutdated).toBe(true);
    });

    it('should cache npm registry responses to improve performance', async () => {
      const packageName = 'lodash';

      const startTime1 = Date.now();
      await queryNpmRegistry(packageName);
      const firstCallTime = Date.now() - startTime1;

      const startTime2 = Date.now();
      await queryNpmRegistry(packageName);
      const secondCallTime = Date.now() - startTime2;

      // Second call should be significantly faster due to caching
      expect(secondCallTime).toBeLessThan(firstCallTime * 0.5);
    });

    it('should handle rate limiting from npm registry', async () => {
      // Mock fetch to simulate rate limiting
      let callCount = 0;
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 3) {
          return Promise.reject(new Response('Rate limited', { status: 429 }));
        }
        return originalFetch('https://registry.npmjs.org/express');
      });

      const result = await queryNpmRegistry('express');
      expect(result).toBeDefined();
      expect(callCount).toBeGreaterThan(1); // Should have retried

      global.fetch = originalFetch;
    });
  });

  describe('Project Analysis Agent Components', () => {
    it('should analyze JavaScript project structure', async () => {
      await createJavaScriptProject();

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        includeDocumentation: true,
        computeHashes: true
      });

      expect(repositoryMap).toBeDefined();
      expect(repositoryMap.files).toBeDefined();
      expect(repositoryMap.stats?.totalFiles).toBeGreaterThan(0);
      expect(repositoryMap.stats?.languageBreakdown?.javascript).toBeGreaterThan(0);
    });

    it('should analyze TypeScript project with type information', async () => {
      await createTypeScriptProject();

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        enableTypeAnalysis: true,
        includeSignatures: true
      });

      expect(repositoryMap).toBeDefined();
      expect(repositoryMap.stats?.languageBreakdown?.typescript).toBeGreaterThan(0);

      // Find TypeScript files and verify symbol extraction
      const tsFiles = Object.entries(repositoryMap.files).filter(([path]) => path.endsWith('.ts'));
      expect(tsFiles.length).toBeGreaterThan(0);

      const [, tsFileData] = tsFiles[0] as [string, any];
      expect(tsFileData.symbols).toBeDefined();
      expect(tsFileData.symbols.length).toBeGreaterThan(0);
    });

    it('should handle large codebases efficiently with parallel processing', async () => {
      await createLargeProject();

      const indexer = CodebaseIndexer.getInstance();
      const startTime = Date.now();

      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        concurrency: 4,
        maxFileSize: 1024 * 1024, // 1MB limit
        continueOnError: true
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(repositoryMap).toBeDefined();
      expect(repositoryMap.stats?.totalFiles).toBeGreaterThan(50);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should extract symbols using Tree-sitter parsers', async () => {
      await createProjectWithComplexSymbols();

      const treeSitter = new TreeSitterWrapper();
      await treeSitter.initialize();

      const jsFile = path.join(testProjectDir, 'complex.js');
      const content = await fs.readFile(jsFile, 'utf-8');

      const symbols = await treeSitter.extractSymbols(content, 'javascript');

      expect(symbols).toBeDefined();
      expect(symbols.length).toBeGreaterThan(0);

      const classSymbol = symbols.find(s => s.kind === 'class');
      const functionSymbol = symbols.find(s => s.kind === 'function');

      expect(classSymbol).toBeDefined();
      expect(functionSymbol).toBeDefined();
    });

    it('should handle parse errors gracefully', async () => {
      await createProjectWithSyntaxErrors();

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        continueOnError: true
      });

      expect(repositoryMap).toBeDefined();
      // Should still process valid files despite syntax errors in some files
      expect(repositoryMap.stats?.totalFiles).toBeGreaterThan(0);
    });

    it('should analyze import graphs and dependencies', async () => {
      await createProjectWithDependencies();

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        analyzeImportGraph: true
      });

      expect(repositoryMap).toBeDefined();
      expect(repositoryMap.importGraph).toBeDefined();
      expect(repositoryMap.importGraph.nodes?.length).toBeGreaterThan(0);
      expect(repositoryMap.importGraph.edges?.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle npm registry failures and continue analysis', async () => {
      await createNodeProject();

      // Mock queryNpmRegistry to fail
      const originalQueryNpmRegistry = queryNpmRegistry;
      vi.mocked(queryNpmRegistry).mockRejectedValue(new Error('Registry down'));

      try {
        // Should not throw - analysis should continue without npm data
        const indexer = CodebaseIndexer.getInstance();
        const repositoryMap = await indexer.indexDirectory(testProjectDir, {
          continueOnError: true
        });

        expect(repositoryMap).toBeDefined();
        expect(repositoryMap.files).toBeDefined();
      } finally {
        // Restore original function
        vi.mocked(queryNpmRegistry).mockImplementation(originalQueryNpmRegistry);
      }
    });

    it('should recover from individual analyzer failures', async () => {
      await createComplexProject();

      // Mock one component to fail
      const treeSitter = new TreeSitterWrapper();
      vi.spyOn(treeSitter, 'extractSymbols').mockRejectedValueOnce(new Error('Parser failed'));

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        continueOnError: true
      });

      // Should still produce results for other files
      expect(repositoryMap).toBeDefined();
    });

    it('should handle missing package.json gracefully', async () => {
      // Create project without package.json
      await fs.writeFile(path.join(testProjectDir, 'index.js'), 'console.log("hello");');

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir);

      expect(repositoryMap).toBeDefined();
      expect(repositoryMap.files).toBeDefined();
    });

    it('should handle permission errors during analysis', async () => {
      await createProjectWithRestrictedFiles();

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        continueOnError: true
      });

      // Should complete analysis despite permission issues
      expect(repositoryMap).toBeDefined();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should manage memory efficiently during large project analysis', async () => {
      await createVeryLargeProject();

      const initialMemory = process.memoryUsage().heapUsed;

      const indexer = CodebaseIndexer.getInstance();
      await indexer.indexDirectory(testProjectDir, {
        concurrency: 2,
        maxFileSize: 100 * 1024 // 100KB limit to prevent memory issues
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 200MB)
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    });

    it('should respect file size limits to prevent memory exhaustion', async () => {
      await createProjectWithLargeFiles();

      const indexer = CodebaseIndexer.getInstance();
      const repositoryMap = await indexer.indexDirectory(testProjectDir, {
        maxFileSize: 1024 // 1KB limit
      });

      expect(repositoryMap).toBeDefined();
      // Should skip large files but process small ones
      expect(repositoryMap.stats?.totalFiles).toBeGreaterThan(0);
    });

    it('should handle concurrent analysis requests efficiently', async () => {
      await createComplexProject();

      const indexer = CodebaseIndexer.getInstance();

      // Run multiple analysis operations concurrently
      const promises = Array.from({ length: 3 }, () =>
        indexer.indexDirectory(testProjectDir, {
          concurrency: 1,
          continueOnError: true
        })
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.files).toBeDefined();
      });
    });
  });

  describe('Integration with Doctor Utilities', () => {
    it('should integrate with doctor utilities for health checking', async () => {
      await createNodeProject();

      const doctorResult = await runDoctor(testProjectDir);

      expect(doctorResult).toBeDefined();
      expect(doctorResult.health).toBeDefined();
      expect(doctorResult.recommendations).toBeDefined();
    });

    it('should validate project structure using doctor utilities', async () => {
      await createIncompleteProject();

      const doctorResult = await runDoctor(testProjectDir);

      expect(doctorResult.issues).toBeDefined();
      expect(doctorResult.issues.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions to create test projects

async function createProjectWithOutdatedDependencies() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'outdated-project',
    version: '1.0.0',
    dependencies: {
      express: '3.0.0', // Very old version
      lodash: '3.10.1'  // Old version
    }
  }, null, 2));
}

async function createJavaScriptProject() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'js-project',
    version: '1.0.0',
    main: 'index.js',
    dependencies: {
      express: '^4.18.0'
    }
  }, null, 2));

  await fs.writeFile(path.join(testProjectDir, 'index.js'), `
const express = require('express');

class Server {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
  }

  start() {
    this.app.listen(this.port);
  }
}

function createServer(port) {
  return new Server(port);
}

module.exports = { Server, createServer };
  `);

  await fs.mkdir(path.join(testProjectDir, 'routes'));
  await fs.writeFile(path.join(testProjectDir, 'routes', 'users.js'), `
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ users: [] });
});

module.exports = router;
  `);
}

async function createTypeScriptProject() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'ts-project',
    version: '1.0.0',
    main: 'dist/index.js',
    scripts: {
      build: 'tsc'
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0'
    }
  }, null, 2));

  await fs.writeFile(path.join(testProjectDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      outDir: 'dist',
      strict: true
    }
  }, null, 2));

  await fs.writeFile(path.join(testProjectDir, 'src', 'service.ts'), `
export interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  public addUser(user: User): void {
    this.users.push(user);
  }

  public getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  public getAllUsers(): User[] {
    return [...this.users];
  }

  public async fetchUserFromApi(id: number): Promise<User | null> {
    try {
      const response = await fetch(\`/api/users/\${id}\`);
      return response.json();
    } catch (error) {
      return null;
    }
  }
}
  `);
}

async function createLargeProject() {
  await createJavaScriptProject();

  // Create many directories and files
  for (let i = 0; i < 15; i++) {
    const moduleDir = path.join(testProjectDir, `module${i}`);
    await fs.mkdir(moduleDir, { recursive: true });

    for (let j = 0; j < 8; j++) {
      await fs.writeFile(path.join(moduleDir, `file${j}.js`), `
// Module ${i}, File ${j}
const config = {
  moduleId: ${i},
  fileId: ${j},
  timestamp: Date.now()
};

function process${i}${j}(data) {
  return {
    ...data,
    processedBy: 'module${i}_file${j}',
    timestamp: Date.now()
  };
}

class Handler${i}${j} {
  constructor() {
    this.id = '${i}-${j}';
    this.active = true;
  }

  handle(request) {
    if (!this.active) return null;
    return process${i}${j}(request);
  }

  deactivate() {
    this.active = false;
  }
}

module.exports = {
  config,
  process${i}${j},
  Handler${i}${j}
};
      `);
    }
  }
}

async function createProjectWithComplexSymbols() {
  await fs.writeFile(path.join(testProjectDir, 'complex.js'), `
// Complex JavaScript with various symbol types

const constants = {
  PI: 3.14159,
  E: 2.71828
};

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const arrowFunction = (x, y) => x + y;

class Calculator {
  constructor(precision = 2) {
    this.precision = precision;
  }

  add(a, b) {
    return parseFloat((a + b).toFixed(this.precision));
  }

  static createDefault() {
    return new Calculator();
  }

  get version() {
    return '1.0.0';
  }

  async calculate(operation, ...args) {
    switch (operation) {
      case 'add':
        return this.add(...args);
      default:
        throw new Error('Unknown operation');
    }
  }
}

async function* dataGenerator() {
  for (let i = 0; i < 10; i++) {
    yield await Promise.resolve(i);
  }
}

const anonymousClass = class {
  method() {
    return 'anonymous';
  }
};

export { Calculator, constants, fibonacci };
export default arrowFunction;
  `);
}

async function createProjectWithSyntaxErrors() {
  await createJavaScriptProject();

  // Create file with syntax errors
  await fs.writeFile(path.join(testProjectDir, 'broken.js'), `
// File with syntax errors
const incomplete = {
  prop1: "value"
  prop2: 123
// Missing closing brace and comma

function unclosed(param {
  return param * 2;
// Missing closing parenthesis

class BadClass {
  method1() {
    return "ok";
  }

  // Missing method body
  method2()
}
  `);
}

async function createProjectWithDependencies() {
  await createJavaScriptProject();

  await fs.writeFile(path.join(testProjectDir, 'utils.js'), `
const { createServer } = require('./index');
const userRoutes = require('./routes/users');

function setupServer() {
  const server = createServer(8080);
  server.app.use('/users', userRoutes);
  return server;
}

module.exports = { setupServer };
  `);

  await fs.writeFile(path.join(testProjectDir, 'app.js'), `
const { setupServer } = require('./utils');

const server = setupServer();
server.start();

console.log('Application started');
  `);
}

async function createNodeProject() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'node-project',
    version: '1.0.0',
    main: 'index.js'
  }, null, 2));

  await fs.writeFile(path.join(testProjectDir, 'index.js'), `
console.log('Hello from Node.js');
  `);
}

async function createComplexProject() {
  await createJavaScriptProject();
  await createProjectWithComplexSymbols();
  await createProjectWithDependencies();
}

async function createProjectWithRestrictedFiles() {
  await createJavaScriptProject();

  // This might not work on all systems, but it's a test for permission handling
  try {
    await fs.writeFile(path.join(testProjectDir, 'restricted.js'), 'const secret = "hidden";');
    await fs.chmod(path.join(testProjectDir, 'restricted.js'), 0o000);
  } catch (error) {
    // Ignore if we can't create restricted files (e.g., on some CI systems)
  }
}

async function createVeryLargeProject() {
  await createLargeProject();

  // Add even more files
  for (let i = 15; i < 30; i++) {
    const moduleDir = path.join(testProjectDir, `module${i}`);
    await fs.mkdir(moduleDir, { recursive: true });

    for (let j = 0; j < 12; j++) {
      await fs.writeFile(path.join(moduleDir, `file${j}.js`), `
// Large module ${i}, file ${j}
${'// '.repeat(100)}\n
const data = ${JSON.stringify(Array.from({ length: 100 }, (_, k) => k))};
${'console.log("line");'.repeat(50)}
      `);
    }
  }
}

async function createProjectWithLargeFiles() {
  await createJavaScriptProject();

  // Create one very large file
  const largeContent = 'console.log("large file");'.repeat(10000);
  await fs.writeFile(path.join(testProjectDir, 'large.js'), largeContent);

  // Create normal small file
  await fs.writeFile(path.join(testProjectDir, 'small.js'), 'console.log("small");');
}

async function createIncompleteProject() {
  // Project with missing essential files
  await fs.writeFile(path.join(testProjectDir, 'README.md'), '# Incomplete Project');
  // No package.json, no main entry point
}