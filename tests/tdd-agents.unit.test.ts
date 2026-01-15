/**
 * Unit tests for TDD agents functionality
 *
 * Tests the TDD agent definitions, parsing, and behavior specifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { loadAgents } from '@apexcli/core';

describe('TDD Agents Unit Tests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tdd-agents-test-'));

    // Create .apex directory structure
    const apexDir = path.join(testDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('TDD Tester Agent', () => {
    it('should parse tdd-tester agent correctly', async () => {
      const testerContent = `---
name: tdd-tester
description: Test-Driven Development specialist focused on writing failing tests first
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---

You are a TDD specialist focused on test-first development. Your approach follows the Red-Green-Refactor cycle.

## Red Phase (write-test, run-test stages)
When writing tests first:

1. **Understand requirements** - Parse the feature/function requirements thoroughly
2. **Design test cases** - Think about expected behavior, edge cases, and error conditions
3. **Write failing tests** - Create tests that describe the desired behavior
4. **Verify tests fail** - Ensure tests fail for the right reason (not syntax errors)
5. **Write minimal test code** - Start simple, add complexity incrementally

## Test Quality Guidelines
- Use descriptive test names that explain the scenario being tested
- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation details
- Include both happy path and error scenarios
- Write tests that are fast, isolated, and deterministic

Focus on creating comprehensive test suites that drive good design through test-first thinking.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        testerContent
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester).toBeDefined();
      expect(tddTester.name).toBe('tdd-tester');
      expect(tddTester.description).toBe('Test-Driven Development specialist focused on writing failing tests first');
      expect(tddTester.model).toBe('sonnet');
      expect(tddTester.tools).toEqual(['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob']);
    });

    it('should have TDD-specific guidance in prompt', async () => {
      const testerContent = `---
name: tdd-tester
description: TDD tester
tools: Read, Write, Edit, Bash
model: sonnet
---

You are a TDD specialist focused on test-first development. Your approach follows the Red-Green-Refactor cycle.

## Red Phase (write-test, run-test stages)
When writing tests first:

1. **Understand requirements** - Parse requirements thoroughly
2. **Write failing tests** - Create tests that describe desired behavior
3. **Verify tests fail** - Ensure tests fail for the right reason

## Test Quality Guidelines
- Follow AAA pattern: Arrange, Act, Assert
- Test behavior, not implementation details
- Write tests that are fast, isolated, and deterministic`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        testerContent
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.prompt).toContain('TDD specialist');
      expect(tddTester.prompt).toContain('Red-Green-Refactor cycle');
      expect(tddTester.prompt).toContain('write-test, run-test stages');
      expect(tddTester.prompt).toContain('AAA pattern');
      expect(tddTester.prompt).toContain('fast, isolated, and deterministic');
    });

    it('should have appropriate tools for testing', async () => {
      const testerContent = `---
name: tdd-tester
description: TDD tester
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
model: sonnet
---

TDD specialist prompt.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        testerContent
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      // Should have tools needed for testing tasks
      expect(tddTester.tools).toContain('Read');   // Reading existing code
      expect(tddTester.tools).toContain('Write');  // Writing test files
      expect(tddTester.tools).toContain('Edit');   // Editing test files
      expect(tddTester.tools).toContain('Bash');   // Running tests
      expect(tddTester.tools).toContain('Grep');   // Searching code
      expect(tddTester.tools).toContain('Glob');   // Finding test files
    });

    it('should contain guidance for all TDD phases', async () => {
      const testerContent = `---
name: tdd-tester
description: TDD tester
tools: Read, Write, Edit, Bash
model: sonnet
---

## Red Phase (write-test, run-test stages)
Write failing tests first.

## Green Validation (verify stage)
Run tests to confirm they now pass.

## Regression Safety (regression-check stage)
Run complete test suite including existing tests.

## TDD Principles
- Tests define the interface
- Incremental development`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        testerContent
      );

      const agents = await loadAgents(testDir);
      const tddTester = agents['tdd-tester'];

      expect(tddTester.prompt).toContain('Red Phase');
      expect(tddTester.prompt).toContain('Green Validation');
      expect(tddTester.prompt).toContain('Regression Safety');
      expect(tddTester.prompt).toContain('TDD Principles');
      expect(tddTester.prompt).toContain('Tests define the interface');
    });
  });

  describe('TDD Developer Agent', () => {
    it('should parse tdd-developer agent correctly', async () => {
      const developerContent = `---
name: tdd-developer
description: TDD-focused developer who writes minimal code to make tests pass
tools: Read, Write, Edit, MultiEdit, Bash, Grep, Glob
model: sonnet
---

You are a TDD-focused developer who follows the Green phase of Red-Green-Refactor. Your goal is to write the simplest code that makes failing tests pass.

## Green Phase Implementation Strategy
When implementing code to make tests pass:

1. **Analyze failing tests** - Understand exactly what behavior the tests expect
2. **Start with simplest solution** - Write the minimal code to make tests pass
3. **Avoid over-engineering** - Don't add functionality not required by tests
4. **Follow test-driven design** - Let test expectations guide your implementation
5. **Incremental progress** - Make one test pass at a time

## TDD Implementation Principles

### Minimal Implementation
- Write only the code needed to make the current test pass
- Avoid adding "might need later" functionality
- Use the simplest approach that works

Remember: Your success is measured by making tests pass with minimal, clean code.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        developerContent
      );

      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper).toBeDefined();
      expect(tddDeveloper.name).toBe('tdd-developer');
      expect(tddDeveloper.description).toBe('TDD-focused developer who writes minimal code to make tests pass');
      expect(tddDeveloper.model).toBe('sonnet');
      expect(tddDeveloper.tools).toEqual(['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep', 'Glob']);
    });

    it('should emphasize minimal implementation', async () => {
      const developerContent = `---
name: tdd-developer
description: TDD developer
tools: Read, Write, Edit
model: sonnet
---

## Green Phase Implementation Strategy
Write the simplest code that makes failing tests pass.

## TDD Implementation Principles

### Minimal Implementation
- Write only the code needed to make the current test pass
- Avoid adding "might need later" functionality
- Use the simplest approach that works

### Test-Driven Design
- Let tests define your API and interface design
- Trust that tests will guide you to good design`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        developerContent
      );

      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper.prompt).toContain('simplest code');
      expect(tddDeveloper.prompt).toContain('Minimal Implementation');
      expect(tddDeveloper.prompt).toContain('only the code needed');
      expect(tddDeveloper.prompt).toContain('Avoid adding "might need later"');
      expect(tddDeveloper.prompt).toContain('Test-Driven Design');
    });

    it('should have tools for code implementation', async () => {
      const developerContent = `---
name: tdd-developer
description: TDD developer
tools:
  - Read
  - Write
  - Edit
  - MultiEdit
  - Bash
  - Grep
  - Glob
model: sonnet
---

TDD developer prompt.`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        developerContent
      );

      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      // Should have tools needed for implementation tasks
      expect(tddDeveloper.tools).toContain('Read');      // Reading test files and requirements
      expect(tddDeveloper.tools).toContain('Write');     // Writing new implementation files
      expect(tddDeveloper.tools).toContain('Edit');      // Editing existing files
      expect(tddDeveloper.tools).toContain('MultiEdit'); // Bulk edits across files
      expect(tddDeveloper.tools).toContain('Bash');      // Running tests to verify
      expect(tddDeveloper.tools).toContain('Grep');      // Searching codebase
      expect(tddDeveloper.tools).toContain('Glob');      // Finding relevant files
    });

    it('should include common TDD patterns', async () => {
      const developerContent = `---
name: tdd-developer
description: TDD developer
tools: Read, Write, Edit
model: sonnet
---

## Common TDD Patterns

### Fake It Till You Make It
- Start with hardcoded return values
- Gradually replace with real logic as more tests are added

### Triangulation
- Use multiple test cases to drive toward the general solution
- Let the accumulation of tests reveal the true requirements

### Obvious Implementation
- When the solution is clear, implement it directly
- Still keep it minimal and focused on current test requirements`;

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        developerContent
      );

      const agents = await loadAgents(testDir);
      const tddDeveloper = agents['tdd-developer'];

      expect(tddDeveloper.prompt).toContain('Fake It Till You Make It');
      expect(tddDeveloper.prompt).toContain('Triangulation');
      expect(tddDeveloper.prompt).toContain('Obvious Implementation');
      expect(tddDeveloper.prompt).toContain('hardcoded return values');
      expect(tddDeveloper.prompt).toContain('multiple test cases');
    });
  });

  describe('Agent Tools Validation', () => {
    it('should have complementary tool sets for tester and developer', async () => {
      // Create both agents
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        `---
name: tdd-tester
description: TDD tester
tools: [Read, Write, Edit, Bash, Grep, Glob]
model: sonnet
---
Tester prompt.`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        `---
name: tdd-developer
description: TDD developer
tools: [Read, Write, Edit, MultiEdit, Bash, Grep, Glob]
model: sonnet
---
Developer prompt.`
      );

      const agents = await loadAgents(testDir);
      const tester = agents['tdd-tester'];
      const developer = agents['tdd-developer'];

      // Both should have core tools
      const commonTools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
      commonTools.forEach(tool => {
        expect(tester.tools).toContain(tool);
        expect(developer.tools).toContain(tool);
      });

      // Developer should have MultiEdit for bulk changes
      expect(developer.tools).toContain('MultiEdit');
      expect(tester.tools).not.toContain('MultiEdit');
    });

    it('should use sonnet model for complex TDD tasks', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        `---
name: tdd-tester
description: TDD tester
tools: [Read, Write]
model: sonnet
---
Prompt`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        `---
name: tdd-developer
description: TDD developer
tools: [Read, Write]
model: sonnet
---
Prompt`
      );

      const agents = await loadAgents(testDir);

      expect(agents['tdd-tester'].model).toBe('sonnet');
      expect(agents['tdd-developer'].model).toBe('sonnet');
    });

    it('should handle missing tools field gracefully', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        `---
name: tdd-tester
description: TDD tester
model: sonnet
---
Prompt without tools specified.`
      );

      const agents = await loadAgents(testDir);
      const tester = agents['tdd-tester'];

      expect(tester).toBeDefined();
      expect(tester.tools).toBeUndefined();
    });
  });

  describe('Agent Content Validation', () => {
    it('should contain specific TDD terminology', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        `---
name: tdd-tester
description: TDD tester
tools: [Read, Write]
model: sonnet
---

Red-Green-Refactor cycle. Write failing tests. Test-first development.`
      );

      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-developer.md'),
        `---
name: tdd-developer
description: TDD developer
tools: [Read, Write]
model: sonnet
---

Green phase. Minimal implementation. Make tests pass.`
      );

      const agents = await loadAgents(testDir);
      const tester = agents['tdd-tester'];
      const developer = agents['tdd-developer'];

      // Tester should mention TDD concepts
      expect(tester.prompt).toContain('Red-Green-Refactor');
      expect(tester.prompt).toContain('failing tests');
      expect(tester.prompt).toContain('Test-first');

      // Developer should mention implementation concepts
      expect(developer.prompt).toContain('Green phase');
      expect(developer.prompt).toContain('Minimal implementation');
      expect(developer.prompt).toContain('Make tests pass');
    });

    it('should have detailed guidance sections', async () => {
      await fs.writeFile(
        path.join(testDir, '.apex', 'agents', 'tdd-tester.md'),
        `---
name: tdd-tester
description: TDD tester
tools: [Read]
model: sonnet
---

## Red Phase (write-test, run-test stages)
Guidance for red phase.

## Green Validation (verify stage)
Guidance for validation.

## Test Quality Guidelines
Guidelines for quality.`
      );

      const agents = await loadAgents(testDir);
      const tester = agents['tdd-tester'];

      expect(tester.prompt).toContain('## Red Phase');
      expect(tester.prompt).toContain('## Green Validation');
      expect(tester.prompt).toContain('## Test Quality Guidelines');
    });
  });
});