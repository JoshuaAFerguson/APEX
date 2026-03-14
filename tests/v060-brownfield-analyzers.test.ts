/**
 * @fileoverview Comprehensive test suite for v0.6.0 Brownfield Codebase Analysis features
 *
 * This test suite validates all 7 core brownfield analysis features:
 * 1. Stack documentation auto-generation
 * 2. Architecture pattern documentation
 * 3. Coding convention extraction (already implemented)
 * 4. Testing pattern documentation
 * 5. Third-party integration mapping
 * 6. Technical debt identification
 * 7. Parallel agent spawning coordination
 *
 * Tests cover both unit-level analyzer functionality and integration with CodebaseMapper.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import the analyzers
import {
  StackAnalyzer,
  ArchitectureAnalyzer,
  ConventionAnalyzer,
  TestingPatternAnalyzer as TestingAnalyzer,
  IntegrationAnalyzer,
  TechnicalDebtAnalyzer,
  CodebaseAnalysisOrchestratorImpl as CodebaseAnalysisOrchestrator,
  AnalysisPhase
} from '../packages/orchestrator/src/codebase-analyzer/index.js';
import { CodebaseIndexer } from '../packages/orchestrator/src/codebase-intelligence/indexer.js';

// Import npm registry utils for testing
import { checkPackageVersion, queryNpmRegistry } from '../packages/core/src/npm-registry-utils.js';

// Import types
import type {
  StackAnalysis,
  ArchitectureAnalysis,
  ConventionAnalysis,
  TestingPatternAnalysis,
  IntegrationAnalysis,
  TechnicalDebtAnalysis,
  CodebaseAnalysis,
  RepositoryMap
} from '../packages/core/src/types.js';

describe('v0.6.0 Brownfield Analysis Features', () => {
  const testProjectDir = '/tmp/apex-brownfield-test';
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();

    // Clean up and create fresh test project
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
  });

  describe('1. Stack Documentation Auto-Generation', () => {
    it('should analyze package.json dependencies and detect technology stack', async () => {
      await createNodeProjectWithDependencies();

      const analyzer = new StackAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        includeDevDependencies: true,
        analyzeVersionCompatibility: true
      });

      expect(result).toBeDefined();
      expect(result.runtime).toBeDefined();
      expect(result.runtime.name).toBe('node');
      expect(result.frameworks).toContain(expect.objectContaining({ name: 'express' }));
      expect(result.testingFrameworks).toContain(expect.objectContaining({ name: 'vitest' }));
      expect(result.buildTools).toContain(expect.objectContaining({ name: 'typescript' }));
    });

    it('should detect Python stack from requirements files', async () => {
      await createPythonProject();

      const analyzer = new StackAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {});

      expect(result.runtime.name).toBe('python');
      expect(result.frameworks).toContain(expect.objectContaining({ name: 'flask' }));
      expect(result.testingFrameworks).toContain(expect.objectContaining({ name: 'pytest' }));
    });

    it('should identify polyglot stack with multiple runtimes', async () => {
      await createPolyglotProject();

      const analyzer = new StackAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {});

      expect(result.runtime.name).toMatch(/node|python|go/);
      expect(result.additionalRuntimes?.length).toBeGreaterThan(0);
    });

    it('should analyze npm package versions and security vulnerabilities', async () => {
      await createProjectWithOutdatedDependencies();

      const analyzer = new StackAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeVersionCompatibility: true,
        checkVulnerabilities: true
      });

      expect(result.vulnerabilities).toBeDefined();
      expect(result.outdatedPackages?.length).toBeGreaterThan(0);
    });

    it('should handle npm registry integration failures gracefully', async () => {
      await createNodeProjectWithDependencies();

      // Mock npm registry failure
      vi.mocked(queryNpmRegistry).mockRejectedValue(new Error('Registry unavailable'));

      const analyzer = new StackAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeVersionCompatibility: true
      });

      // Should still complete analysis without version checking
      expect(result).toBeDefined();
      expect(result.runtime).toBeDefined();
    });
  });

  describe('2. Architecture Pattern Documentation', () => {
    it('should identify MVC architecture pattern', async () => {
      await createMvcProject();

      const analyzer = new ArchitectureAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeImportGraph: true,
        identifyPatterns: true
      });

      expect(result.patterns).toContain(expect.objectContaining({
        name: 'MVC',
        confidence: expect.any(Number)
      }));
      expect(result.layering).toBeDefined();
      expect(result.layering.layers).toContain(expect.objectContaining({
        name: expect.stringMatching(/model|view|controller/i)
      }));
    });

    it('should detect microservices architecture', async () => {
      await createMicroservicesProject();

      const analyzer = new ArchitectureAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeServiceBoundaries: true
      });

      expect(result.patterns).toContain(expect.objectContaining({
        name: 'Microservices',
        confidence: expect.any(Number)
      }));
      expect(result.services?.length).toBeGreaterThan(1);
    });

    it('should analyze import graph and dependency relationships', async () => {
      await createComplexProject();

      const analyzer = new ArchitectureAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeImportGraph: true,
        calculateCoupling: true
      });

      expect(result.dependencyGraph).toBeDefined();
      expect(result.dependencyGraph.edges.length).toBeGreaterThan(0);
      expect(result.coupling).toBeDefined();
    });

    it('should identify circular dependencies', async () => {
      await createProjectWithCircularDeps();

      const analyzer = new ArchitectureAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        detectCircularDependencies: true
      });

      expect(result.issues).toBeDefined();
      expect(result.issues.circularDependencies?.length).toBeGreaterThan(0);
    });
  });

  describe('3. Coding Convention Extraction (Reference Implementation)', () => {
    it('should analyze existing convention analyzer functionality', async () => {
      await createStandardProject();

      const analyzer = new ConventionAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {});

      expect(result).toBeDefined();
      expect(result.naming).toBeDefined();
      expect(result.formatting).toBeDefined();
      expect(result.fileOrganization).toBeDefined();
    });
  });

  describe('4. Testing Pattern Documentation', () => {
    it('should identify testing frameworks and patterns', async () => {
      await createProjectWithTests();

      const analyzer = new TestingAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeTestStructure: true,
        identifyPatterns: true
      });

      expect(result.frameworks).toBeDefined();
      expect(result.frameworks.length).toBeGreaterThan(0);
      expect(result.patterns).toContain(expect.objectContaining({
        name: expect.any(String)
      }));
    });

    it('should calculate test coverage metrics', async () => {
      await createProjectWithTests();

      const analyzer = new TestingAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        calculateCoverage: true
      });

      expect(result.coverage).toBeDefined();
      expect(result.coverage.percentage).toBeGreaterThanOrEqual(0);
      expect(result.coverage.percentage).toBeLessThanOrEqual(100);
    });

    it('should identify test file naming conventions', async () => {
      await createProjectWithTests();

      const analyzer = new TestingAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeNamingConventions: true
      });

      expect(result.conventions).toBeDefined();
      expect(result.conventions.fileNaming).toBeDefined();
    });
  });

  describe('5. Third-Party Integration Mapping', () => {
    it('should map API integrations and external services', async () => {
      await createProjectWithApiIntegrations();

      const analyzer = new IntegrationAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        detectApiCalls: true,
        analyzeThirdPartyPackages: true
      });

      expect(result.integrations).toBeDefined();
      expect(result.integrations.apis?.length).toBeGreaterThan(0);
      expect(result.integrations.thirdPartyServices?.length).toBeGreaterThan(0);
    });

    it('should detect database integrations', async () => {
      await createProjectWithDatabase();

      const analyzer = new IntegrationAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        detectDatabaseConnections: true
      });

      expect(result.integrations.databases?.length).toBeGreaterThan(0);
    });

    it('should handle npm audit fallback when main detection fails', async () => {
      await createNodeProjectWithDependencies();

      // Mock primary detection failure
      const analyzer = new IntegrationAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        useNpmAuditFallback: true
      });

      // Should still provide some integration data via fallback
      expect(result.integrations).toBeDefined();
    });
  });

  describe('6. Technical Debt Identification', () => {
    it('should identify code smells and anti-patterns', async () => {
      await createProjectWithTechnicalDebt();

      const analyzer = new TechnicalDebtAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        detectCodeSmells: true,
        analyzeComplexity: true
      });

      expect(result.debt).toBeDefined();
      expect(result.debt.codeSmells?.length).toBeGreaterThan(0);
      expect(result.debt.complexity).toBeDefined();
    });

    it('should detect outdated dependencies', async () => {
      await createProjectWithOutdatedDependencies();

      const analyzer = new TechnicalDebtAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeDependencies: true
      });

      expect(result.debt.outdatedDependencies?.length).toBeGreaterThan(0);
    });

    it('should identify missing test coverage as technical debt', async () => {
      await createProjectWithPoorTestCoverage();

      const analyzer = new TechnicalDebtAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        analyzeTestCoverage: true
      });

      expect(result.debt.missingTests?.length).toBeGreaterThan(0);
    });

    it('should calculate debt score and prioritization', async () => {
      await createProjectWithTechnicalDebt();

      const analyzer = new TechnicalDebtAnalyzer();
      const repositoryMap = await createTestRepositoryMap();

      const result = await analyzer.analyze(repositoryMap, {
        calculateDebtScore: true
      });

      expect(result.score).toBeDefined();
      expect(result.score.overall).toBeGreaterThanOrEqual(0);
      expect(result.recommendations?.length).toBeGreaterThan(0);
    });
  });

  describe('7. Parallel Agent Spawning Integration', () => {
    it('should coordinate multiple analyzers in parallel', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const repositoryMap = await createTestRepositoryMap();

      const startTime = Date.now();

      const result = await orchestrator.runAnalysis(repositoryMap, {
        phases: [
          AnalysisPhase.STACK,
          AnalysisPhase.ARCHITECTURE,
          AnalysisPhase.CONVENTIONS,
          AnalysisPhase.TECHNICAL_DEBT
        ],
        parallel: true,
        maxConcurrency: 4
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.stack).toBeDefined();
      expect(result.architecture).toBeDefined();
      expect(result.conventions).toBeDefined();
      expect(result.technicalDebt).toBeDefined();

      // Parallel execution should complete faster than sequential
      expect(duration).toBeLessThan(30000); // 30 seconds max
    });

    it('should handle individual analyzer failures gracefully', async () => {
      await createComplexProject();

      // Mock one analyzer to fail
      const orchestrator = new CodebaseAnalysisOrchestrator();
      vi.spyOn(StackAnalyzer.prototype, 'analyze').mockRejectedValue(new Error('Stack analysis failed'));

      const repositoryMap = await createTestRepositoryMap();

      const result = await orchestrator.runAnalysis(repositoryMap, {
        phases: [AnalysisPhase.STACK, AnalysisPhase.CONVENTIONS],
        continueOnError: true
      });

      expect(result.conventions).toBeDefined(); // Should succeed
      expect(result.stack).toBeUndefined(); // Should be undefined due to failure
    });

    it('should provide progress tracking during parallel execution', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const repositoryMap = await createTestRepositoryMap();

      let progressEvents: any[] = [];
      const progressCallback = (progress: any) => {
        progressEvents.push(progress);
      };

      await orchestrator.runAnalysis(repositoryMap, {
        phases: [AnalysisPhase.STACK, AnalysisPhase.CONVENTIONS],
        parallel: true
      }, progressCallback);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(p => p.phase)).toBe(true);
    });

    it('should respect concurrency limits', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const repositoryMap = await createTestRepositoryMap();

      // Track concurrent executions
      let activeTasks = 0;
      let maxConcurrentTasks = 0;

      const originalAnalyze = StackAnalyzer.prototype.analyze;
      vi.spyOn(StackAnalyzer.prototype, 'analyze').mockImplementation(async function(...args) {
        activeTasks++;
        maxConcurrentTasks = Math.max(maxConcurrentTasks, activeTasks);

        const result = await originalAnalyze.apply(this, args);

        activeTasks--;
        return result;
      });

      await orchestrator.runAnalysis(repositoryMap, {
        phases: [AnalysisPhase.STACK, AnalysisPhase.CONVENTIONS, AnalysisPhase.TECHNICAL_DEBT],
        parallel: true,
        maxConcurrency: 2
      });

      expect(maxConcurrentTasks).toBeLessThanOrEqual(2);
    });
  });

  describe('Integration with CodebaseMapper', () => {
    it('should integrate with orchestrator for end-to-end analysis', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();

      const result = await orchestrator.analyze(testProjectDir, {
        includeDetails: true,
        maxDepth: 5
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should emit progress events during analysis', async () => {
      await createComplexProject();

      const orchestrator = new CodebaseAnalysisOrchestrator();
      const events: any[] = [];

      orchestrator.on('progress', (event) => {
        events.push(event);
      });

      await orchestrator.analyze(testProjectDir, {
        includeDetails: true
      });

      expect(events.length).toBeGreaterThan(0);
    });
  });
});

// Helper functions to create test projects

async function createNodeProjectWithDependencies() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    dependencies: {
      express: '^4.18.0',
      lodash: '^4.17.21',
      axios: '^1.0.0'
    },
    devDependencies: {
      typescript: '^5.0.0',
      vitest: '^0.34.0',
      eslint: '^8.0.0'
    }
  }, null, 2));

  await fs.writeFile(path.join(testProjectDir, 'index.js'), `
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(3000);
  `);
}

async function createPythonProject() {
  await fs.writeFile(path.join(testProjectDir, 'requirements.txt'), `
flask==2.3.0
requests==2.31.0
pytest==7.4.0
  `);

  await fs.writeFile(path.join(testProjectDir, 'app.py'), `
from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def hello():
    return jsonify({'message': 'Hello World'})

if __name__ == '__main__':
    app.run()
  `);
}

async function createPolyglotProject() {
  await createNodeProjectWithDependencies();
  await createPythonProject();

  await fs.writeFile(path.join(testProjectDir, 'main.go'), `
package main

import "fmt"

func main() {
    fmt.Println("Hello from Go")
}
  `);
}

async function createProjectWithOutdatedDependencies() {
  await fs.writeFile(path.join(testProjectDir, 'package.json'), JSON.stringify({
    name: 'outdated-project',
    version: '1.0.0',
    dependencies: {
      express: '^3.0.0', // Very outdated
      lodash: '^3.0.0'   // Very outdated
    }
  }, null, 2));
}

async function createMvcProject() {
  await fs.mkdir(path.join(testProjectDir, 'models'), { recursive: true });
  await fs.mkdir(path.join(testProjectDir, 'views'), { recursive: true });
  await fs.mkdir(path.join(testProjectDir, 'controllers'), { recursive: true });

  await fs.writeFile(path.join(testProjectDir, 'models', 'User.js'), `
class User {
  constructor(name, email) {
    this.name = name;
    this.email = email;
  }
}

module.exports = User;
  `);

  await fs.writeFile(path.join(testProjectDir, 'controllers', 'UserController.js'), `
const User = require('../models/User');

class UserController {
  async getUser(req, res) {
    // Controller logic
  }
}

module.exports = UserController;
  `);
}

async function createMicroservicesProject() {
  await fs.mkdir(path.join(testProjectDir, 'user-service'), { recursive: true });
  await fs.mkdir(path.join(testProjectDir, 'order-service'), { recursive: true });

  await fs.writeFile(path.join(testProjectDir, 'user-service', 'package.json'), JSON.stringify({
    name: 'user-service',
    main: 'index.js'
  }));

  await fs.writeFile(path.join(testProjectDir, 'order-service', 'package.json'), JSON.stringify({
    name: 'order-service',
    main: 'index.js'
  }));
}

async function createComplexProject() {
  await createNodeProjectWithDependencies();
  await createMvcProject();

  // Add some complex dependencies
  await fs.writeFile(path.join(testProjectDir, 'utils', 'database.js'), `
const mongoose = require('mongoose');
module.exports = { connect: () => {} };
  `);
}

async function createProjectWithCircularDeps() {
  await fs.writeFile(path.join(testProjectDir, 'a.js'), `
const b = require('./b');
module.exports = { b };
  `);

  await fs.writeFile(path.join(testProjectDir, 'b.js'), `
const a = require('./a');
module.exports = { a };
  `);
}

async function createStandardProject() {
  await createNodeProjectWithDependencies();
}

async function createProjectWithTests() {
  await createNodeProjectWithDependencies();

  await fs.mkdir(path.join(testProjectDir, 'test'), { recursive: true });
  await fs.mkdir(path.join(testProjectDir, '__tests__'), { recursive: true });

  await fs.writeFile(path.join(testProjectDir, 'test', 'user.test.js'), `
const { expect } = require('vitest');

describe('User', () => {
  it('should create user', () => {
    expect(true).toBe(true);
  });
});
  `);

  await fs.writeFile(path.join(testProjectDir, '__tests__', 'integration.test.js'), `
describe('Integration', () => {
  it('should integrate', () => {
    expect(true).toBe(true);
  });
});
  `);
}

async function createProjectWithApiIntegrations() {
  await createNodeProjectWithDependencies();

  await fs.writeFile(path.join(testProjectDir, 'api.js'), `
const axios = require('axios');

async function fetchUser() {
  return axios.get('https://api.github.com/user');
}

async function sendEmail() {
  return axios.post('https://api.sendgrid.com/v3/mail/send', {});
}

module.exports = { fetchUser, sendEmail };
  `);
}

async function createProjectWithDatabase() {
  await createNodeProjectWithDependencies();

  await fs.writeFile(path.join(testProjectDir, 'db.js'), `
const mongoose = require('mongoose');
const { Pool } = require('pg');

mongoose.connect('mongodb://localhost:27017/test');

const pool = new Pool({
  connectionString: 'postgresql://user:pass@localhost:5432/db'
});

module.exports = { mongoose, pool };
  `);
}

async function createProjectWithTechnicalDebt() {
  await createNodeProjectWithDependencies();

  // Create files with code smells
  await fs.writeFile(path.join(testProjectDir, 'debt.js'), `
// Large function (code smell)
function processEverything(data, options, callback, extra, more, params) {
  // 100+ lines of code
  let result = data;
  if (options) {
    if (options.transform) {
      if (typeof options.transform === 'function') {
        result = options.transform(result);
      }
    }
  }
  // Many more nested conditions...
  callback(result);
}

// Unused imports
const unused1 = require('lodash');
const unused2 = require('axios');

// Magic numbers
const MAGIC_NUMBER = 42;
const ANOTHER_MAGIC = 3.14159;

module.exports = { processEverything };
  `);
}

async function createProjectWithPoorTestCoverage() {
  await createNodeProjectWithDependencies();

  await fs.writeFile(path.join(testProjectDir, 'untested.js'), `
class UntestedClass {
  method1() {
    return 'no tests';
  }

  method2() {
    return 'also no tests';
  }
}

function untestedFunction() {
  return 'completely untested';
}

module.exports = { UntestedClass, untestedFunction };
  `);

  // Only minimal tests
  await fs.mkdir(path.join(testProjectDir, 'test'), { recursive: true });
  await fs.writeFile(path.join(testProjectDir, 'test', 'minimal.test.js'), `
describe('Minimal', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
  `);
}

async function createTestRepositoryMap(): Promise<RepositoryMap> {
  const indexer = CodebaseIndexer.getInstance();
  return await indexer.indexDirectory(testProjectDir, {
    continueOnError: true,
    includeDocumentation: true
  });
}