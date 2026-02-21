/**
 * Test validation suite for detectTestFrameworks() acceptance criteria
 *
 * This test suite validates that the detectTestFrameworks() method meets ALL acceptance criteria:
 * 1. Detects test frameworks (Jest, Vitest, Mocha, Pytest, etc.)
 * 2. Returns framework name, config file path, and test run command
 * 3. Unit tests verify detection of at least 6 test frameworks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('detectTestFrameworks() - Acceptance Criteria Validation', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-acceptance-test-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp dir:', error);
    }
  });

  describe('ACCEPTANCE CRITERIA 1: Detects test frameworks', () => {
    it('should detect Jest framework', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: { jest: '^29.0.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Jest');
    });

    it('should detect Vitest framework', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: { vitest: '^0.34.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Vitest');
    });

    it('should detect Mocha framework', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: { mocha: '^10.0.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Mocha');
    });

    it('should detect Pytest framework', async () => {
      const packageJson = {
        name: 'test-project',
        dependencies: { pytest: '^7.0.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Pytest');
    });

    it('should detect Playwright framework', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: { '@playwright/test': '^1.36.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Playwright');
    });

    it('should detect Cypress framework', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: { cypress: '^12.0.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Cypress');
    });

    it('should detect additional frameworks (Karma, Jasmine, AVA, Tape, QUnit)', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          karma: '^6.0.0',
          jasmine: '^5.0.0',
          ava: '^5.0.0',
          tape: '^5.0.0',
          qunit: '^2.19.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Karma');
      expect(frameworkNames).toContain('Jasmine');
      expect(frameworkNames).toContain('AVA');
      expect(frameworkNames).toContain('Tape');
      expect(frameworkNames).toContain('QUnit');
    });

    it('should detect Python Unittest from test file patterns', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'tests'));
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_example.py'),
        'import unittest\nclass TestExample(unittest.TestCase):\n    def test_something(self):\n        pass'
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Unittest');
    });

    it('should detect Cargo Test framework', async () => {
      const cargoToml = `
[package]
name = "test-project"
version = "0.1.0"

[dependencies]
`;
      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        cargoToml
      );

      // Create tests directory
      await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'integration_test.rs'),
        '#[test] fn test_something() {}'
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('Cargo Test');
    });

    it('should detect RSpec framework', async () => {
      const rspecConfig = `
--color
--format documentation
`;
      await fs.promises.writeFile(
        path.join(tempDir, '.rspec'),
        rspecConfig
      );

      // Create spec directory
      await fs.promises.mkdir(path.join(tempDir, 'spec'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'example_spec.rb'),
        'RSpec.describe "Example" do\nend'
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('RSpec');
    });

    it('should detect JUnit framework', async () => {
      const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0-SNAPSHOT</version>

    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>`;

      await fs.promises.writeFile(
        path.join(tempDir, 'pom.xml'),
        pomXml
      );

      // Create test directory structure
      await fs.promises.mkdir(path.join(tempDir, 'src', 'test', 'java'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'test', 'java', 'ExampleTest.java'),
        'import org.junit.Test;\npublic class ExampleTest {\n    @Test\n    public void test() {}\n}'
      );

      const result = await analyzer.detectTestFrameworks();
      const frameworkNames = result.map(f => f.name);

      expect(frameworkNames).toContain('JUnit');
    });
  });

  describe('ACCEPTANCE CRITERIA 2: Returns framework name, config file path, and test run command', () => {
    it('should return framework name for all detected frameworks', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result.length).toBeGreaterThan(0);
      result.forEach(framework => {
        expect(framework).toHaveProperty('name');
        expect(typeof framework.name).toBe('string');
        expect(framework.name.length).toBeGreaterThan(0);
      });
    });

    it('should return config file path when config files exist', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = { testEnvironment: "node" };'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'vitest.config.ts'),
        'export default { test: {} };'
      );

      const result = await analyzer.detectTestFrameworks();

      const jestFramework = result.find(f => f.name === 'Jest');
      const vitestFramework = result.find(f => f.name === 'Vitest');

      expect(jestFramework).toBeDefined();
      expect(jestFramework?.configFile).toBe('jest.config.js');

      expect(vitestFramework).toBeDefined();
      expect(vitestFramework?.configFile).toBe('vitest.config.ts');
    });

    it('should return test run command for all frameworks', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
          '@playwright/test': '^1.36.0',
          cypress: '^12.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      const expectedCommands = {
        Jest: 'npm test',
        Vitest: 'vitest',
        Mocha: 'mocha',
        Playwright: 'playwright test',
        Cypress: 'cypress run',
        'Cargo Test': 'cargo test',
        RSpec: 'bundle exec rspec',
        JUnit: 'mvn test',
      };

      result.forEach(framework => {
        expect(framework).toHaveProperty('runCommand');
        expect(typeof framework.runCommand).toBe('string');
        expect(framework.runCommand.length).toBeGreaterThan(0);

        if (expectedCommands[framework.name as keyof typeof expectedCommands]) {
          expect(framework.runCommand).toBe(expectedCommands[framework.name as keyof typeof expectedCommands]);
        }
      });
    });

    it('should have correct return type structure', async () => {
      const packageJson = {
        name: 'test-project',
        devDependencies: { jest: '^29.0.0' },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = {};'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const framework = result[0];
      expect(typeof framework).toBe('object');
      expect(framework).toHaveProperty('name');
      expect(framework).toHaveProperty('runCommand');

      // configFile is optional
      if (framework.configFile) {
        expect(typeof framework.configFile).toBe('string');
      }
    });
  });

  describe('ACCEPTANCE CRITERIA 3: Unit tests verify detection of at least 6 test frameworks', () => {
    it('should detect at least 6 different test frameworks in comprehensive setup', async () => {
      // Create comprehensive test project with 8+ frameworks
      const packageJson = {
        name: 'comprehensive-test-project',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
          karma: '^6.0.0',
          jasmine: '^5.0.0',
          '@playwright/test': '^1.36.0',
          cypress: '^12.0.0',
          ava: '^5.0.0',
          tape: '^5.0.0',
          qunit: '^2.19.0',
        },
        dependencies: {
          pytest: '^7.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Add Python unittest via test files
      await fs.promises.mkdir(path.join(tempDir, 'tests'));
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_example.py'),
        'import unittest\nclass TestExample(unittest.TestCase):\n    def test_something(self):\n        pass'
      );

      const result = await analyzer.detectTestFrameworks();

      // Should detect at least 6 frameworks (requirement), actually detects 12
      expect(result.length).toBeGreaterThanOrEqual(6);

      const frameworkNames = result.map(f => f.name);

      // Verify specific frameworks are detected
      const expectedFrameworks = [
        'Jest',
        'Vitest',
        'Mocha',
        'Pytest',
        'Playwright',
        'Cypress',
        'Karma',
        'Jasmine',
        'AVA',
        'Tape',
        'QUnit',
        'Unittest',
        'Cargo Test',
        'RSpec',
        'JUnit'
      ];

      // At least 6 of these should be present
      const detectedExpectedFrameworks = expectedFrameworks.filter(name => frameworkNames.includes(name));
      expect(detectedExpectedFrameworks.length).toBeGreaterThanOrEqual(6);

      // Verify each detected framework has required properties
      result.forEach(framework => {
        expect(framework).toHaveProperty('name');
        expect(framework).toHaveProperty('runCommand');
        expect(typeof framework.name).toBe('string');
        expect(typeof framework.runCommand).toBe('string');
        expect(framework.name.length).toBeGreaterThan(0);
        expect(framework.runCommand.length).toBeGreaterThan(0);
      });
    });

    it('should validate comprehensive framework detection capabilities', async () => {
      // Test that the method can detect frameworks through different methods
      const packageJson = {
        name: 'multi-method-detection',
        devDependencies: {
          jest: '^29.0.0',    // Package detection
        },
        dependencies: {
          pytest: '^7.0.0',   // Package detection (different section)
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Config file detection
      await fs.promises.writeFile(
        path.join(tempDir, 'vitest.config.ts'),
        'export default { test: {} };'
      );

      // Test pattern detection
      await fs.promises.writeFile(
        path.join(tempDir, 'test_python.py'),
        'def test_example():\n    assert True'
      );

      const result = await analyzer.detectTestFrameworks();

      // Should detect at least 3 frameworks via different methods
      expect(result.length).toBeGreaterThanOrEqual(3);

      const frameworkNames = result.map(f => f.name);
      expect(frameworkNames).toContain('Jest');      // From package.json devDependencies
      expect(frameworkNames).toContain('Pytest');    // From package.json dependencies + test files
      expect(frameworkNames).toContain('Vitest');    // From config file

      // Verify detection methods work correctly
      const jestFramework = result.find(f => f.name === 'Jest');
      const vitestFramework = result.find(f => f.name === 'Vitest');
      const pytestFramework = result.find(f => f.name === 'Pytest');

      expect(jestFramework?.runCommand).toBe('npm test');
      expect(vitestFramework?.configFile).toBe('vitest.config.ts');
      expect(pytestFramework?.runCommand).toBe('pytest');
    });
  });

  describe('COMPREHENSIVE ACCEPTANCE VALIDATION', () => {
    it('should fully satisfy all acceptance criteria in a single comprehensive test', async () => {
      // ACCEPTANCE CRITERIA 1: Detects test frameworks
      const packageJson = {
        name: 'complete-acceptance-test',
        devDependencies: {
          jest: '^29.0.0',
          vitest: '^0.34.0',
          mocha: '^10.0.0',
          '@playwright/test': '^1.36.0',
          cypress: '^12.0.0',
          karma: '^6.0.0',
          jasmine: '^5.0.0',
          ava: '^5.0.0',
        },
        dependencies: {
          pytest: '^7.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Add config files for comprehensive detection
      await fs.promises.writeFile(
        path.join(tempDir, 'jest.config.js'),
        'module.exports = { testEnvironment: "node" };'
      );
      await fs.promises.writeFile(
        path.join(tempDir, 'pytest.ini'),
        '[tool:pytest]\naddopts = -v'
      );

      // Add test pattern for Python unittest
      await fs.promises.mkdir(path.join(tempDir, 'tests'));
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'test_example.py'),
        'import unittest\nclass TestExample(unittest.TestCase):\n    def test_something(self):\n        pass'
      );

      const result = await analyzer.detectTestFrameworks();

      // VALIDATION: All acceptance criteria met

      // 1. Detects test frameworks (Jest, Vitest, Mocha, Pytest, etc.) ✅
      const frameworkNames = result.map(f => f.name);
      expect(frameworkNames).toContain('Jest');
      expect(frameworkNames).toContain('Vitest');
      expect(frameworkNames).toContain('Mocha');
      expect(frameworkNames).toContain('Pytest');

      // 2. Returns framework name, config file path, and test run command ✅
      result.forEach(framework => {
        // Required: name and runCommand
        expect(framework).toHaveProperty('name');
        expect(framework).toHaveProperty('runCommand');
        expect(typeof framework.name).toBe('string');
        expect(typeof framework.runCommand).toBe('string');
        expect(framework.name.length).toBeGreaterThan(0);
        expect(framework.runCommand.length).toBeGreaterThan(0);

        // Optional: configFile (when present, must be string)
        if (framework.configFile) {
          expect(typeof framework.configFile).toBe('string');
          expect(framework.configFile.length).toBeGreaterThan(0);
        }
      });

      // 3. Unit tests verify detection of at least 6 test frameworks ✅
      expect(result.length).toBeGreaterThanOrEqual(6);

      // Additional validation: specific config file detection
      const jestFramework = result.find(f => f.name === 'Jest');
      const pytestFramework = result.find(f => f.name === 'Pytest');

      expect(jestFramework?.configFile).toBe('jest.config.js');
      expect(pytestFramework?.configFile).toBe('pytest.ini');

      // Additional validation: correct run commands
      expect(jestFramework?.runCommand).toBe('npm test');
      expect(pytestFramework?.runCommand).toBe('pytest');

      console.log(`✅ ACCEPTANCE CRITERIA FULLY SATISFIED:`);
      console.log(`   - Detected ${result.length} test frameworks (requirement: 6+)`);
      console.log(`   - All frameworks have name and runCommand`);
      console.log(`   - Config files properly detected when present`);
      console.log(`   - Frameworks: ${frameworkNames.join(', ')}`);
    });
  });
});