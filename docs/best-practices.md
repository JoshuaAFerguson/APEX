# APEX Best Practices

This guide covers best practices for getting the most out of APEX, from writing effective task descriptions to managing costs and ensuring quality.

## Task Descriptions

### Be Specific and Clear

Good task descriptions are the foundation of successful automation.

**Bad:**
```bash
apex run "Fix the bug"
```

**Good:**
```bash
apex run "Fix the login form validation bug where email addresses with + characters are rejected"
```

**Better:**
```bash
apex run "Fix login form email validation to accept + characters. The regex in src/utils/validation.ts incorrectly rejects valid emails like user+tag@example.com"
```

### Include Context

Provide relevant context that helps agents understand the codebase:

```bash
apex run "Add rate limiting to the /api/users endpoint. We use Express.js with Redis for caching. See existing rate limiting in /api/auth as reference"
```

### Use Acceptance Criteria

Define clear success criteria:

```bash
apex run "Add password strength indicator" \
  --criteria "Must show weak/medium/strong, update in real-time, match design spec in Figma"
```

## Workflow Selection

### Choose the Right Workflow

| Task Type | Workflow | When to Use |
|-----------|----------|-------------|
| New features | `feature` | Adding new functionality |
| Bug fixes | `bugfix` | Fixing existing issues |
| Code cleanup | `refactor` | Improving code without changing behavior |
| Documentation | `docs` | Documentation updates |
| Quick changes | `quick` | Simple, low-risk changes |

```bash
# Feature with full review cycle
apex run "Add user profile page" --workflow feature

# Quick fix without extensive review
apex run "Fix typo in error message" --workflow quick
```

### Create Custom Workflows

For repetitive task patterns, create specialized workflows:

```yaml
# .apex/workflows/security-fix.yaml
name: security-fix
description: Security vulnerability fixes
stages:
  - name: analysis
    agent: security
    description: Analyze vulnerability
  - name: fix
    agent: developer
    description: Implement fix
  - name: testing
    agent: tester
    description: Add security tests
  - name: review
    agent: security
    description: Verify fix
```

## Autonomy Levels

### Start Conservative

Begin with lower autonomy until you trust the system:

```bash
# Start here
apex run "Add feature" --autonomy manual

# Then try
apex run "Add feature" --autonomy review-before-commit

# Eventually
apex run "Add feature" --autonomy review-before-merge
```

### Match Autonomy to Risk

| Risk Level | Autonomy | Examples |
|------------|----------|----------|
| Low | `full` | Documentation, comments, simple tests |
| Medium | `review-before-commit` | New features, refactoring |
| High | `review-before-merge` | Core logic, security-sensitive code |
| Critical | `manual` | Database migrations, deployment configs |

## Cost Management

### Set Appropriate Limits

Configure limits in `.apex/config.yaml`:

```yaml
limits:
  maxCostPerTask: 5.00    # Stop if task exceeds $5
  maxTokensPerTask: 500000 # Token limit
  dailyBudget: 50.00      # Daily spending cap
  maxTurns: 50            # Prevent infinite loops
```

### Monitor Usage

Check costs regularly:

```bash
# View task costs
apex status

# Detailed task info
apex status <task-id>
```

### Optimize for Cost

1. **Use appropriate models**: Configure `haiku` for simple reviews
2. **Break large tasks down**: Smaller tasks are more predictable
3. **Use dry-run mode**: Preview without executing

```bash
# Preview task plan
apex run "Large feature" --dry-run
```

## Agent Configuration

### Match Models to Tasks

```yaml
# .apex/agents/planner.md
---
model: opus  # Complex planning needs powerful model
---

# .apex/agents/reviewer.md
---
model: haiku  # Quick reviews can use faster model
---
```

### Restrict Tools Appropriately

Only give agents the tools they need:

```yaml
# .apex/agents/reviewer.md
---
tools: Read, Grep, Glob  # No write access for reviewers
---
```

### Keep Prompts Focused

Each agent should have a single, clear responsibility:

```markdown
# Bad: Agent does too much
You are a developer, tester, and reviewer...

# Good: Focused responsibility
You are a code reviewer. Your only job is to identify issues...
```

## Code Quality

### Enable All Review Stages

Don't skip the review stage for non-trivial changes:

```yaml
stages:
  - name: implementation
    agent: developer
  - name: testing
    agent: tester
  - name: review         # Don't remove this
    agent: reviewer
```

### Add Tests

Always include testing in your workflows:

```yaml
stages:
  - name: implementation
    agent: developer
  - name: testing        # Always test
    agent: tester
```

### Use Consistent Patterns

Agents learn from existing code. Maintain consistent patterns:

1. Follow established conventions
2. Keep similar code in similar places
3. Use consistent naming

## Git Integration

### Use Feature Branches

APEX creates feature branches automatically. Keep them small:

```bash
# Good: Small, focused task
apex run "Add email validation helper"

# Avoid: Large, multi-part task
apex run "Rewrite the entire authentication system"
```

### Review PRs Before Merging

Even with `full` autonomy, review PRs:

```bash
# Create PR for review
apex pr <task-id>

# Review the PR in GitHub/GitLab
# Then merge manually
```

### Clean Up Branches

After merging, clean up branches:

```bash
# Delete merged branches
git branch -d apex/task-branch
git push origin --delete apex/task-branch
```

## Project Organization

### Keep .apex Directory Clean

```
.apex/
├── config.yaml       # Main configuration
├── agents/           # Agent definitions
│   ├── planner.md
│   ├── developer.md
│   └── custom.md     # Your custom agents
├── workflows/        # Workflow definitions
│   ├── feature.yaml
│   └── custom.yaml   # Your custom workflows
└── scripts/          # Helper scripts
    ├── lint.sh
    └── test.sh
```

### Version Control Everything

Keep all APEX configuration in version control:

```bash
git add .apex/
git commit -m "chore: update APEX configuration"
```

### Document Custom Agents

Add documentation for custom agents:

```markdown
<!-- .apex/agents/api-designer.md -->
---
name: api-designer
description: Designs REST APIs following our conventions
---

# API Designer Agent

This agent designs REST APIs following our company standards:
- RESTful resource naming
- OpenAPI specification
- Our authentication patterns

## When to Use
Use this agent for new API endpoint design...
```

## Troubleshooting

### Start Simple

If tasks fail, simplify:

1. Use smaller, focused tasks
2. Add more context
3. Use `--verbose` for debugging
4. Try `--autonomy manual` to step through

### Check Logs

```bash
# View detailed logs
apex logs <task-id>

# Watch logs in real-time
apex run "task" --verbose
```

### Verify Setup

```bash
# Check configuration
apex config

# List agents
apex agents

# List workflows
apex workflows
```

## Security

### Review Sensitive Changes

Always review changes to:
- Authentication/authorization code
- Database schemas
- API keys and secrets
- Deployment configurations

### Audit Commands

APEX logs all bash commands. Review them:

```bash
apex logs <task-id> --level debug
```

### Don't Commit Secrets

APEX warns about sensitive files. Pay attention to warnings about:
- `.env` files
- API keys
- Credentials

## Performance Tips

### Parallel Execution

For independent tasks, run them in parallel:

```bash
# In separate terminals
apex run "Add feature A"
apex run "Add feature B"
```

### Use Checkpoints

For long tasks, checkpoints enable resume:

```yaml
# Already enabled by default
# If interrupted, retry to resume
apex retry <task-id>
```

### Optimize Prompts

Shorter, clearer prompts use fewer tokens:

```markdown
# Bad: Verbose prompt
You are an incredibly talented and experienced software developer
with many years of experience who excels at writing clean code...

# Good: Concise prompt
You are a senior developer. Write clean, tested code following
project conventions.
```

## Summary

1. **Write clear task descriptions** with context and acceptance criteria
2. **Choose appropriate workflows** and autonomy levels
3. **Set cost limits** to prevent unexpected spending
4. **Configure agents** with appropriate models and tools
5. **Always include testing** in your workflows
6. **Review PRs** even with high autonomy
7. **Keep configuration in version control**
8. **Monitor logs** and costs regularly

## Next Steps

- [Getting Started](getting-started.md) - Initial setup
- [Agent Authoring Guide](agents.md) - Create custom agents
- [Workflow Authoring Guide](workflows.md) - Define workflows
- [Troubleshooting Guide](troubleshooting.md) - Common issues
