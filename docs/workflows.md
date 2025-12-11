# Workflow Authoring Guide

Workflows define how agents collaborate to complete tasks. This guide explains how to create, customize, and use workflows in APEX.

## Workflow Basics

A workflow is defined by a YAML file in `.apex/workflows/`. It specifies:

1. **Stages** - Sequential steps in the workflow
2. **Agents** - Which agent handles each stage
3. **Dependencies** - How stages relate to each other
4. **Outputs** - What each stage produces

## Basic Structure

```yaml
name: workflow-name
description: What this workflow accomplishes

stages:
  - name: stage-name
    agent: agent-name
    description: What this stage does
    outputs:
      - output_name
```

## Field Reference

### Workflow Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique workflow identifier |
| `description` | Yes | Brief description of the workflow |
| `trigger` | No | Events that can trigger this workflow |
| `stages` | Yes | Array of stage definitions |

### Stage Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique stage identifier |
| `agent` | Yes | Name of agent to use |
| `description` | Yes | What this stage accomplishes |
| `dependsOn` | No | Array of stage names that must complete first |
| `outputs` | No | Array of output names produced |
| `condition` | No | Expression that must be true to run |
| `timeout` | No | Maximum time in seconds |
| `retries` | No | Number of retry attempts on failure |

## Default Workflows

APEX includes three default workflows:

### Feature Workflow

The standard workflow for implementing new features:

```yaml
name: feature
description: Full feature implementation workflow

stages:
  - name: planning
    agent: planner
    description: Create implementation plan
    outputs:
      - implementation_plan
      - subtasks

  - name: architecture
    agent: architect
    description: Design technical solution
    dependsOn: [planning]
    outputs:
      - technical_design

  - name: implementation
    agent: developer
    description: Write the code
    dependsOn: [architecture]
    outputs:
      - code_changes
      - branch_name

  - name: testing
    agent: tester
    description: Create and run tests
    dependsOn: [implementation]
    outputs:
      - test_files
      - coverage_report

  - name: review
    agent: reviewer
    description: Review code quality
    dependsOn: [implementation, testing]
    outputs:
      - review_findings
```

### Bugfix Workflow

Streamlined workflow for fixing bugs:

```yaml
name: bugfix
description: Bug investigation and fix workflow

stages:
  - name: investigation
    agent: developer
    description: Investigate and locate the bug
    outputs:
      - root_cause
      - affected_files

  - name: fix
    agent: developer
    description: Implement the fix
    dependsOn: [investigation]
    outputs:
      - code_changes

  - name: testing
    agent: tester
    description: Add regression tests
    dependsOn: [fix]
    outputs:
      - test_files

  - name: review
    agent: reviewer
    description: Review the fix
    dependsOn: [fix, testing]
    outputs:
      - review_findings
```

### Refactor Workflow

Workflow for code refactoring:

```yaml
name: refactor
description: Code refactoring workflow

stages:
  - name: analysis
    agent: architect
    description: Analyze current code and plan refactoring
    outputs:
      - refactoring_plan

  - name: refactor
    agent: developer
    description: Execute refactoring
    dependsOn: [analysis]
    outputs:
      - code_changes

  - name: testing
    agent: tester
    description: Verify no regressions
    dependsOn: [refactor]
    outputs:
      - test_results

  - name: review
    agent: reviewer
    description: Review refactored code
    dependsOn: [refactor, testing]
    outputs:
      - review_findings
```

## Creating Custom Workflows

### Example: Documentation Workflow

```yaml
# .apex/workflows/docs.yaml
name: docs
description: Generate or update documentation

stages:
  - name: analysis
    agent: planner
    description: Identify what needs documentation
    outputs:
      - documentation_plan

  - name: writing
    agent: documenter
    description: Write the documentation
    dependsOn: [analysis]
    outputs:
      - documentation_files

  - name: review
    agent: reviewer
    description: Review documentation quality
    dependsOn: [writing]
    outputs:
      - review_findings
```

### Example: Security Audit Workflow

```yaml
# .apex/workflows/security-audit.yaml
name: security-audit
description: Comprehensive security audit

stages:
  - name: code-scan
    agent: security
    description: Scan code for vulnerabilities
    outputs:
      - vulnerability_report

  - name: dependency-check
    agent: security
    description: Check for vulnerable dependencies
    outputs:
      - dependency_report

  - name: remediation
    agent: developer
    description: Fix identified issues
    dependsOn: [code-scan, dependency-check]
    outputs:
      - fixes

  - name: verification
    agent: security
    description: Verify fixes
    dependsOn: [remediation]
    outputs:
      - verification_report
```

### Example: Quick Fix Workflow

Minimal workflow for simple changes:

```yaml
# .apex/workflows/quick.yaml
name: quick
description: Quick fix without full review cycle

stages:
  - name: fix
    agent: developer
    description: Make the change
    outputs:
      - code_changes
```

### Example: PR Review Workflow

For reviewing external pull requests:

```yaml
# .apex/workflows/pr-review.yaml
name: pr-review
description: Review a pull request

stages:
  - name: code-review
    agent: reviewer
    description: Review code quality and patterns

  - name: security-review
    agent: security
    description: Check for security issues

  - name: test-review
    agent: tester
    description: Verify test coverage
```

## Stage Dependencies

### Sequential Execution

Stages run in order when dependencies are specified:

```yaml
stages:
  - name: step1
    agent: planner

  - name: step2
    agent: developer
    dependsOn: [step1]

  - name: step3
    agent: tester
    dependsOn: [step2]
```

### Parallel Execution

Stages without dependencies on each other can run concurrently:

```yaml
stages:
  - name: planning
    agent: planner

  - name: frontend    # These run in parallel
    agent: developer
    dependsOn: [planning]

  - name: backend     # These run in parallel
    agent: developer
    dependsOn: [planning]

  - name: integration
    agent: tester
    dependsOn: [frontend, backend]  # Waits for both
```

### Diamond Dependencies

```yaml
stages:
  - name: plan
    agent: planner

  - name: code
    agent: developer
    dependsOn: [plan]

  - name: test
    agent: tester
    dependsOn: [plan]

  - name: review
    agent: reviewer
    dependsOn: [code, test]  # Waits for both paths
```

## Conditional Stages

Run stages only when conditions are met:

```yaml
stages:
  - name: analysis
    agent: planner
    outputs:
      - has_breaking_changes

  - name: migration
    agent: developer
    dependsOn: [analysis]
    condition: "outputs.analysis.has_breaking_changes == true"
```

## Stage Configuration

### Timeouts

Set maximum execution time:

```yaml
stages:
  - name: long-analysis
    agent: architect
    timeout: 600  # 10 minutes
```

### Retries

Configure automatic retries on failure:

```yaml
stages:
  - name: flaky-operation
    agent: developer
    retries: 3
```

### Combined Options

```yaml
stages:
  - name: robust-stage
    agent: developer
    timeout: 300
    retries: 2
    condition: "outputs.planning.proceed == true"
```

## Triggers

Define how workflows can be triggered:

```yaml
trigger:
  - manual           # Via CLI
  - apex:feature     # Via specific command
  - github:issue     # On GitHub issue creation
  - cron:daily       # Scheduled execution
```

## Using Workflows

### Specify Workflow

```bash
apex run "Add user authentication" --workflow feature
apex run "Fix login bug" --workflow bugfix
apex run "Update README" --workflow docs
```

### List Available Workflows

```bash
apex workflows
```

### Default Workflow

Set in config:

```yaml
# .apex/config.yaml
workflow:
  default: feature
```

## Workflow Best Practices

### 1. Keep It Simple

Start with minimal workflows and add complexity only when needed.

```yaml
# Simple is often better
stages:
  - name: do-the-thing
    agent: developer
```

### 2. Match Workflow to Task Type

Create workflows that fit your actual development patterns:
- `feature` - New functionality
- `bugfix` - Bug fixes
- `refactor` - Code cleanup
- `docs` - Documentation
- `quick` - Small changes

### 3. Balance Thoroughness and Speed

More stages = more thorough but slower.

```yaml
# Thorough workflow (slower)
stages: [plan, architecture, implement, test, review, document]

# Quick workflow (faster)
stages: [implement, test]
```

### 4. Use Appropriate Agents

Match agent capabilities to stage requirements:
- Planning stages: Use `opus` model agents
- Implementation: Use `sonnet` model agents
- Quick reviews: Use `haiku` model agents

### 5. Define Clear Outputs

Specify what each stage produces:

```yaml
outputs:
  - implementation_plan    # Good - specific
  - result                 # Bad - too vague
```

### 6. Handle Failures Gracefully

Add review stages after critical operations:

```yaml
stages:
  - name: database-migration
    agent: developer

  - name: verify-migration
    agent: tester
    dependsOn: [database-migration]
```

## Debugging Workflows

### Verbose Output

```bash
apex run "task" --workflow feature --verbose
```

### Check Stage Progress

```bash
apex status <task-id>
```

### View Stage Logs

```bash
apex logs <task-id>
```

### Dry Run

Plan without executing:

```bash
apex run "task" --workflow feature --dry-run
```

## Next Steps

- [Agent Authoring Guide](agents.md) - Create custom agents
- [Configuration Reference](configuration.md) - Configure APEX settings
- [Best Practices](best-practices.md) - Tips for effective usage
- [API Reference](api-reference.md) - REST API documentation
