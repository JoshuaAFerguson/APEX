# ADR: TDD Workflow Architecture

## Status
Proposed

## Context
The current TDD workflow in `/packages/core/templates/workflows/tdd.yaml` needs to be updated to meet the acceptance criteria:
- **planning** stage
- **test-first** stage
- **implementation** stage
- **refactor** stage
- **verification** stage

Each stage must have appropriate agent assignments and prompts.

### Current State Analysis

The existing TDD workflow has 5 stages:
1. `write-test` (tdd-tester) - Write failing tests
2. `run-test` (tdd-tester) - Validate tests fail
3. `implement` (tdd-developer) - Write minimal code
4. `verify` (tdd-tester) - Confirm tests pass
5. `regression-check` (tdd-tester) - Full suite + refactor suggestions

### Gap Analysis

| Required Stage | Current Implementation | Gap |
|---------------|------------------------|-----|
| planning | ❌ Missing | Need planning stage with planner agent |
| test-first | ✅ write-test + run-test | Consolidate into single stage |
| implementation | ✅ implement | Rename to "implementation" |
| refactor | ⚠️ Mixed into regression-check | Need dedicated refactor stage |
| verification | ✅ verify + regression-check | Consolidate into single stage |

## Decision

### Updated TDD Workflow Architecture

We will restructure the TDD workflow to have exactly 5 stages matching the acceptance criteria:

```
┌─────────────────────────────────────────────────────────────────┐
│                    TDD WORKFLOW STAGES                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PLANNING          →  planner agent                         │
│     ├─ Understand requirements                                  │
│     ├─ Define test strategy                                     │
│     └─ Output: test_strategy, requirements, affected_areas      │
│                                                                 │
│  2. TEST-FIRST (RED)  →  tdd-tester agent                      │
│     ├─ Write failing test cases                                 │
│     ├─ Validate tests fail correctly                            │
│     └─ Output: test_files, failing_tests, test_requirements     │
│                                                                 │
│  3. IMPLEMENTATION (GREEN) → tdd-developer agent               │
│     ├─ Write minimal code to pass tests                         │
│     ├─ Follow YAGNI principle                                   │
│     └─ Output: code_changes, implementation_notes               │
│                                                                 │
│  4. REFACTOR          →  tdd-developer agent                   │
│     ├─ Improve code quality                                     │
│     ├─ Remove duplication                                       │
│     └─ Output: refactored_code, refactoring_notes               │
│                                                                 │
│  5. VERIFICATION      →  tdd-tester agent                      │
│     ├─ Run full test suite                                      │
│     ├─ Verify coverage                                          │
│     ├─ Regression check                                         │
│     └─ Output: test_results, coverage_report, verification      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Stage Dependencies:
planning → test-first → implementation → refactor → verification
```

### Stage Details

#### 1. Planning Stage
- **Agent**: `planner`
- **Purpose**: Analyze requirements and plan the TDD approach
- **Outputs**:
  - `test_strategy` - Overall testing approach
  - `requirements` - Parsed feature requirements
  - `affected_areas` - Code areas to test/modify

#### 2. Test-First Stage (RED Phase)
- **Agent**: `tdd-tester`
- **Purpose**: Write failing tests that define expected behavior
- **Inputs**: Depends on `planning`
- **Outputs**:
  - `test_files` - Created test files
  - `failing_tests` - List of failing tests
  - `test_requirements` - Test documentation

#### 3. Implementation Stage (GREEN Phase)
- **Agent**: `tdd-developer`
- **Purpose**: Write minimal code to make tests pass
- **Inputs**: Depends on `test-first`
- **Outputs**:
  - `code_changes` - Implementation files
  - `implementation_notes` - Development notes

#### 4. Refactor Stage
- **Agent**: `tdd-developer`
- **Purpose**: Improve code quality while maintaining passing tests
- **Inputs**: Depends on `implementation`
- **Outputs**:
  - `refactored_code` - Improved code
  - `refactoring_notes` - Changes made

#### 5. Verification Stage
- **Agent**: `tdd-tester`
- **Purpose**: Final validation of all tests and coverage
- **Inputs**: Depends on `refactor`
- **Outputs**:
  - `test_results` - Final test results
  - `coverage_report` - Code coverage
  - `verification_status` - Pass/fail status

### Agent Assignments Rationale

| Stage | Agent | Rationale |
|-------|-------|-----------|
| planning | planner | Requires high-level analysis and decomposition skills |
| test-first | tdd-tester | Specialized in writing test-first code |
| implementation | tdd-developer | Trained for minimal GREEN-phase implementations |
| refactor | tdd-developer | Understands TDD constraints during refactoring |
| verification | tdd-tester | Expert in test execution and coverage analysis |

### Workflow Configuration

```yaml
name: tdd
description: Test-Driven Development workflow following Red-Green-Refactor cycle
trigger:
  - manual
  - apex:tdd
  - apex:test-driven

stages:
  - name: planning
    agent: planner
    description: Analyze requirements and plan TDD approach
    outputs:
      - test_strategy
      - requirements
      - affected_areas

  - name: test-first
    agent: tdd-tester
    description: Write failing tests (Red phase)
    dependsOn: [planning]
    outputs:
      - test_files
      - failing_tests
      - test_requirements

  - name: implementation
    agent: tdd-developer
    description: Write minimal code to pass tests (Green phase)
    dependsOn: [test-first]
    outputs:
      - code_changes
      - implementation_notes

  - name: refactor
    agent: tdd-developer
    description: Improve code quality while maintaining passing tests
    dependsOn: [implementation]
    outputs:
      - refactored_code
      - refactoring_notes

  - name: verification
    agent: tdd-tester
    description: Run full test suite and verify coverage
    dependsOn: [refactor]
    outputs:
      - test_results
      - coverage_report
      - verification_status
```

## Consequences

### Positive
- Matches acceptance criteria exactly with 5 named stages
- Clear separation of concerns between phases
- Each stage has a single responsibility
- Proper agent assignment based on expertise
- Explicit refactor stage ensures code quality is addressed
- Planning stage adds strategic thinking before coding

### Negative
- Slightly longer workflow execution (5 stages vs original 5, but restructured)
- Refactor stage could be skipped in simple cases (consider optional gates)

### Neutral
- Existing tdd-tester and tdd-developer agents are already well-suited
- No new agents required
- Workflow schema already supports this structure

## Implementation Notes

1. Update `/packages/core/templates/workflows/tdd.yaml` with new stage structure
2. No agent template changes required
3. Verify workflow loads correctly via config parser
4. Run build and tests to confirm no regressions

## References
- WorkflowStageSchema: `/packages/core/src/types.ts:1215`
- Existing TDD agents: `/packages/core/templates/agents/tdd-*.md`
- Similar workflow patterns: `/packages/core/templates/workflows/feature.yaml`
