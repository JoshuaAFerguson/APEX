# Test-Driven Development (TDD) Workflows

## Overview

APEX supports Test-Driven Development (TDD) workflows to help teams follow the Red-Green-Refactor cycle with AI assistance. TDD mode enables "write test first, then fix" development patterns, ensuring comprehensive test coverage and robust code quality.

## What is TDD?

Test-Driven Development is a software development approach where:

1. **Red** - Write a failing test first
2. **Green** - Write minimal code to make the test pass
3. **Refactor** - Improve code quality while keeping tests passing

This cycle ensures code is thoroughly tested, well-designed, and meets requirements.

## TDD Mode Configuration

### Enable TDD Mode

```yaml
# .apex/config.yaml
codeQuality:
  enabled: true
  tddMode: true
  regressionGuard: true

  testing:
    runner: jest              # or vitest, mocha, etc.
    watchMode: true
    coverage: true
    minCoverage: 80

workflows:
  tdd:
    enabled: true
    testFirst: true
    requirePassingTests: true
```

### TDD-Specific Settings

```yaml
tdd:
  enforceRedPhase: true       # Require failing test before implementation
  autoRunTests: true          # Run tests after each change
  stopOnFailure: true         # Stop workflow on test failures
  coverageThreshold: 80       # Minimum test coverage required
  testPatterns:
    - "**/*.test.ts"
    - "**/*.spec.ts"
    - "**/__tests__/**/*.ts"
```

## TDD Workflows

### Built-in TDD Workflow

APEX includes a dedicated TDD workflow for test-first development:

```yaml
# .apex/workflows/tdd.yaml
name: tdd
description: Test-driven development workflow with Red-Green-Refactor cycle

stages:
  - name: red_phase
    agent: tester
    description: Write failing tests first
    outputs:
      - test_files
      - test_requirements
    validation:
      - tests_fail: true

  - name: green_phase
    agent: developer
    description: Write minimal code to make tests pass
    dependsOn: [red_phase]
    outputs:
      - implementation
      - passing_tests
    validation:
      - tests_pass: true

  - name: refactor_phase
    agent: developer
    description: Improve code quality while maintaining test coverage
    dependsOn: [green_phase]
    outputs:
      - refactored_code
      - maintained_coverage
    validation:
      - tests_pass: true
      - coverage_maintained: true
```

### TDD Feature Development

For feature development with TDD:

```yaml
# .apex/workflows/tdd-feature.yaml
name: tdd-feature
description: Full feature development using TDD principles

stages:
  - name: planning
    agent: planner
    description: Plan feature with acceptance criteria
    outputs:
      - feature_requirements
      - acceptance_criteria

  - name: test_planning
    agent: tester
    description: Design test strategy and test cases
    dependsOn: [planning]
    outputs:
      - test_plan
      - test_cases

  - name: red_phase
    agent: tester
    description: Write failing acceptance and unit tests
    dependsOn: [test_planning]
    outputs:
      - failing_tests

  - name: green_phase
    agent: developer
    description: Implement feature to make tests pass
    dependsOn: [red_phase]
    outputs:
      - feature_implementation

  - name: refactor_phase
    agent: developer
    description: Refactor and optimize implementation
    dependsOn: [green_phase]
    outputs:
      - optimized_code

  - name: review
    agent: reviewer
    description: Code and test quality review
    dependsOn: [refactor_phase]
    outputs:
      - review_report
```

## Using TDD Workflows

### Start TDD Development

```bash
# Use the TDD workflow for new features
apex run "Add user authentication" --workflow tdd-feature

# Use TDD for bug fixes
apex run "Fix validation issue" --workflow tdd-bugfix

# Pure TDD cycle for existing feature
apex run "Refactor user service" --workflow tdd
```

### TDD Mode Commands

```bash
# Enable TDD mode globally
apex config set codeQuality.tddMode true

# Run in TDD mode for single task
apex run "Add payment processing" --tdd

# Check TDD compliance
apex validate --tdd

# View test coverage
apex test --coverage
```

## TDD Best Practices

### 1. Start with Acceptance Tests

Define behavior before implementation by writing high-level tests that describe the expected functionality.

### 2. Write Minimal Implementation

Make tests pass with the simplest possible code that satisfies the test requirements.

### 3. Refactor with Confidence

Improve code quality while tests provide a safety net to ensure functionality remains intact.

### 4. Maintain High Coverage

TDD naturally achieves high test coverage since all code is written to satisfy tests.

### 5. Test Edge Cases

Include boundary conditions and error cases in your test suite.

## TDD Metrics and Reporting

### Test Coverage Reports

```bash
# Generate coverage report
apex test --coverage --report

# Coverage by workflow
apex report --workflow tdd-feature --coverage

# Historical coverage trends
apex metrics --coverage --trend
```

### TDD Cycle Metrics

Track TDD effectiveness:

```yaml
metrics:
  tdd:
    - cycle_time: "Average time for Red-Green-Refactor cycle"
    - test_first_percentage: "Percentage of features developed test-first"
    - bug_density: "Bugs per 1000 lines in TDD vs non-TDD code"
    - coverage_improvement: "Coverage increase from TDD adoption"
```

## Troubleshooting TDD Workflows

### Common Issues

**Tests Don't Fail Initially**
- Ensure test is actually testing the requirement
- Check for missing assertions
- Verify testing correct behavior

**Coverage Not Improving**
- Check coverage gaps
- Identify untested code paths

**Long TDD Cycles**
- Use smaller test increments
- Optimize test execution speed
- Improve development tooling

### Debug Commands

```bash
# Debug failing TDD workflow
apex debug TASK_ID --tdd

# Show test execution timeline
apex timeline TASK_ID --tests

# Analyze coverage changes
apex diff --coverage before after
```

## Integration with Code Quality

TDD works seamlessly with APEX's code quality features:

```yaml
# Combined TDD and quality configuration
codeQuality:
  enabled: true
  tddMode: true
  lintAfterEdit: true
  autoFix: true

  validation:
    preCommit:
      - lint_check
      - test_run
      - coverage_check
```

## Example Usage

### Complete TDD Session

```bash
# 1. Start TDD feature development
apex run "Add shopping cart functionality" --workflow tdd-feature

# 2. Monitor progress
apex status --watch

# 3. Review test coverage
apex coverage --detailed

# 4. Complete the workflow (automatic merge after all stages pass)
```

### Custom TDD Configuration

```yaml
# .apex/config.yaml - Custom TDD setup
workflows:
  custom-tdd:
    stages:
      - name: acceptance_test
        agent: tester
        description: Write acceptance tests

      - name: unit_test
        agent: tester
        description: Write detailed unit tests
        dependsOn: [acceptance_test]

      - name: implementation
        agent: developer
        description: Implement to make all tests pass
        dependsOn: [unit_test]

      - name: refactor
        agent: developer
        description: Clean up and optimize
        dependsOn: [implementation]

tdd:
  enforceRedPhase: true
  minCoverage: 85
  testTimeout: 30000
  watchMode: true
```

## Benefits of TDD with APEX

- **AI-Assisted Test Writing**: Agents help create comprehensive test suites
- **Automatic Red-Green-Refactor**: Workflow enforces TDD discipline
- **Quality Assurance**: Built-in coverage and quality checks
- **Documentation**: Tests serve as living documentation
- **Regression Prevention**: Comprehensive test coverage prevents bugs

## Next Steps

- [Code Quality Integration](code-quality.md) - Broader quality features
- [Workflow Authoring](workflows.md) - Create custom workflows
- [Agent Configuration](agents.md) - Configure TDD agents
- [Best Practices](best-practices.md) - Development best practices

---

TDD with APEX combines the rigor of test-first development with the power of AI assistance, ensuring high-quality code with comprehensive test coverage while maintaining development velocity.