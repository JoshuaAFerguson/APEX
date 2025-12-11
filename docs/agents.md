# Agent Authoring Guide

Agents are the core workers in APEX. Each agent is a specialized AI persona that handles specific aspects of software development. This guide explains how to create, customize, and manage agents.

## Agent Basics

An agent is defined by a Markdown file with YAML frontmatter in `.apex/agents/`. The file structure is:

```markdown
---
name: agent-name
description: What this agent does
tools: Read, Write, Edit, Bash
model: sonnet
---

Your system prompt goes here. This tells the agent how to behave,
what its goals are, and any specific instructions.
```

## Frontmatter Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier for the agent |
| `description` | Yes | Brief description shown in listings |
| `tools` | No | Comma-separated list or array of allowed tools |
| `model` | No | Which model to use: `opus`, `sonnet` (default), or `haiku` |

### Tools

Available tools that agents can use:

| Tool | Description |
|------|-------------|
| `Read` | Read file contents |
| `Write` | Create or overwrite files |
| `Edit` | Make targeted edits to files |
| `MultiEdit` | Multiple edits in one operation |
| `Bash` | Execute shell commands |
| `Grep` | Search file contents |
| `Glob` | Find files by pattern |
| `Task` | Spawn sub-agents |
| `WebFetch` | Fetch web content |
| `WebSearch` | Search the web |

If `tools` is not specified, the agent has access to all tools.

### Models

Choose the model based on the task complexity:

| Model | Best For | Cost |
|-------|----------|------|
| `opus` | Complex planning, architecture decisions | Highest |
| `sonnet` | General development, balanced performance | Medium |
| `haiku` | Quick reviews, simple tasks | Lowest |

## Default Agents

APEX comes with six default agents:

### Planner
Creates implementation plans and breaks down tasks.

```markdown
---
name: planner
description: Creates implementation plans and breaks down tasks into subtasks
tools: Read, Grep, Glob
model: opus
---

You are a technical project planner...
```

### Architect
Designs system architecture and makes technical decisions.

### Developer
Implements features and writes production code.

### Reviewer
Reviews code for quality, bugs, and security issues.

### Tester
Creates and runs tests, analyzes coverage.

### DevOps
Handles infrastructure, CI/CD, and deployment.

## Creating Custom Agents

### Example: Documentation Agent

Create `.apex/agents/documenter.md`:

```markdown
---
name: documenter
description: Generates and maintains documentation
tools: Read, Write, Edit, Glob
model: sonnet
---

You are a technical documentation specialist. Your responsibilities:

1. Read and understand code thoroughly
2. Generate clear, concise documentation
3. Follow the project's documentation style
4. Include code examples where helpful
5. Keep README files up to date

When documenting:
- Use Markdown formatting
- Include TypeDoc/JSDoc comments for code
- Add usage examples
- Document public APIs thoroughly
- Link related documentation

Output documentation that is:
- Accurate and complete
- Easy to understand
- Well-organized
- Properly formatted
```

### Example: Security Auditor

Create `.apex/agents/security.md`:

```markdown
---
name: security
description: Audits code for security vulnerabilities
tools: Read, Grep, Glob
model: opus
---

You are a security specialist. Analyze code for:

1. OWASP Top 10 vulnerabilities
2. Injection attacks (SQL, XSS, command injection)
3. Authentication/authorization issues
4. Sensitive data exposure
5. Security misconfigurations
6. Dependency vulnerabilities

Output format:
```
FILE:LINE - VULNERABILITY - SEVERITY (critical/high/medium/low)
Description: What the issue is
Impact: Potential consequences
Remediation: How to fix it
```

Be thorough but avoid false positives.
Prioritize findings by severity and exploitability.
```

### Example: Performance Optimizer

Create `.apex/agents/optimizer.md`:

```markdown
---
name: optimizer
description: Identifies and fixes performance issues
tools: Read, Grep, Glob, Bash
model: sonnet
---

You are a performance engineer. Focus on:

1. Algorithm complexity (Big O)
2. Database query efficiency
3. Memory usage patterns
4. Async/await optimization
5. Caching opportunities
6. Bundle size reduction

Use profiling tools when available:
- npm run profile
- Performance DevTools
- Database query analyzers

Provide concrete metrics:
- Before/after comparisons
- Memory usage changes
- Response time improvements
```

## Writing Effective Prompts

### Be Specific
```markdown
# Bad
You are a developer.

# Good
You are a senior TypeScript developer specializing in React applications.
Follow functional programming patterns and prioritize type safety.
```

### Define Output Format
```markdown
When reviewing code, output findings as:
FILE:LINE - ISSUE - SEVERITY
Description of the problem

Recommended fix:
[Code suggestion if applicable]
```

### Include Constraints
```markdown
Constraints:
- Keep functions under 50 lines
- Maximum file size: 500 lines
- Follow existing code patterns
- No external dependencies without approval
```

### Provide Context
```markdown
The project uses:
- TypeScript with strict mode
- React 18 with hooks
- Prisma ORM for database
- Jest for testing

Follow these conventions:
- Camel case for variables
- Pascal case for components
- Use named exports
```

## Tool-Specific Guidance

### Restricting Bash Access
```markdown
tools: Read, Write, Edit, Grep, Glob  # No Bash

When you need to run commands, output them for manual review instead.
```

### Read-Only Agents
```markdown
tools: Read, Grep, Glob

You are a read-only analyzer. You cannot modify files.
Report findings without making changes.
```

### Sub-Agent Spawning
```markdown
tools: Read, Task

You are a coordinator. Delegate specific tasks to specialized agents:
- Use Task tool to spawn 'developer' for implementation
- Use Task tool to spawn 'tester' for test creation
```

## Agent Selection in Workflows

Agents are assigned to workflow stages:

```yaml
# .apex/workflows/feature.yaml
stages:
  - name: planning
    agent: planner

  - name: implementation
    agent: developer

  - name: testing
    agent: tester

  - name: review
    agent: reviewer
```

## Disabling Agents

Disable agents in config without deleting them:

```yaml
# .apex/config.yaml
agents:
  disabled:
    - devops  # Skip DevOps agent
```

## Agent Best Practices

### 1. Single Responsibility
Each agent should have one clear purpose. Create multiple specialized agents rather than one that does everything.

### 2. Clear Instructions
Be explicit about what the agent should do, how to format output, and what constraints to follow.

### 3. Match Model to Task
- Use `opus` for complex reasoning
- Use `sonnet` for general work
- Use `haiku` for quick, simple tasks

### 4. Limit Tools Appropriately
Only give agents the tools they need. A reviewer doesn't need `Write`, a planner doesn't need `Bash`.

### 5. Test Your Agents
Run agents on sample tasks to verify they behave as expected before using them in production.

### 6. Version Control
Keep agent definitions in version control. Track changes to prompts over time.

## Debugging Agents

### View Agent Output
```bash
apex run "your task" --verbose
```

### Check Logs
```bash
apex logs <task-id>
```

### Test Individual Agents
Create a workflow with a single stage to test an agent:

```yaml
# .apex/workflows/test-agent.yaml
name: test-agent
stages:
  - name: test
    agent: your-agent-name
    description: Test stage
```

```bash
apex run "Test task description" --workflow test-agent
```

## Next Steps

- [Workflow Authoring Guide](workflows.md) - Create custom workflows
- [Configuration Reference](configuration.md) - Configure APEX settings
- [Best Practices](best-practices.md) - Tips for effective usage
