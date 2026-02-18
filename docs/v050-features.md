# v0.5.0 Feature Guide

## Overview

APEX v0.5.0 introduces comprehensive tool system capabilities with fine-grained permission controls, browser automation, and code quality integration. This release transforms APEX into a powerful development platform with robust safety controls and intelligent automation.

## Quick Start

### Browser Automation Setup

```bash
# Install browser dependencies
npx playwright install chromium

# Configure browser automation
echo "tools:
  browser:
    enabled: true
    engine: chromium
    headless: true
    allowedDomains:
      - localhost
      - '*.local'
    blockedDomains:
      - '*.onion'" >> .apex/config.yaml
```

### Permission Preset Selection

```yaml
# .apex/config.yaml
permissions:
  preset: autonomous          # Full automation
  # preset: reviewAll         # Prompt for every operation
  # preset: readOnly          # Block write operations
  persistence: true
```

### Autonomy Control Configuration

```yaml
# .apex/config.yaml
autonomy:
  enabled: true
  limits:
    budgetLimit: 10.0        # USD limit
    tokenLimit: 100000       # Token limit
    timeLimit: 3600000       # 1 hour in ms
    changeLimit:
      files: 20              # Max files modified
      lines: 1000            # Max lines changed
  warningThreshold: 0.8      # Warn at 80%
```

## Feature Categories

### 1. Browser Automation

APEX provides headless browser automation for testing and visual debugging.

**Capabilities:**
- Navigate, click, type, scroll, hover
- Screenshot capture with visual regression testing
- Console log capture and runtime error detection
- Form automation and submission
- Element inspection and content extraction

**Usage:**
```typescript
// Navigate to page
await apex.browser.navigate({ url: 'https://localhost:3000' });

// Interact with elements
await apex.browser.click({ selector: '#submit-btn' });
await apex.browser.type({ selector: '#input', text: 'Hello World' });

// Capture screenshot
await apex.browser.screenshot({ filename: 'result.png' });

// Visual regression testing
await apex.browser.compareScreenshot({
  baseline: 'baseline.png',
  current: 'current.png'
});
```

**Permission Requirements:**
- `browser:navigate` - Navigate to URLs
- `browser:evaluate` - Execute JavaScript (elevated)
- `browser:submit` - Submit forms (elevated)

### 2. Built-in Tools (Claude Code Parity)

APEX includes all essential development tools:

- **Read** - Read file contents with line numbers
- **Write** - Create new files
- **Edit** - Surgical edits with old_string/new_string
- **MultiEdit** - Multiple edits in single operation
- **Bash** - Execute shell commands with safety controls
- **Glob** - Fast file pattern matching
- **Grep** - Content search with ripgrep
- **WebFetch** - Fetch and analyze web content
- **WebSearch** - Search the web for information
- **NotebookEdit** - Edit Jupyter notebooks
- **TodoWrite** - Manage task lists

### 3. Tool Visualization

Real-time tool execution display with comprehensive feedback:

- **Tool call display** - Show tool name and parameters
- **Tool output formatting** - Syntax highlighted outputs
- **Tool timing** - Execution duration tracking
- **Tool error display** - Clear error messages with context
- **Diff preview** - Show changes before applying
- **Undo capability** - Revert tool actions
- **Dry-run mode** - Simulate tool actions without execution

### 4. Permission System

Fine-grained permission controls with three levels:

**Permission Levels:**
- `allow-always` - Permanent permission
- `allow-once` - Single-use permission
- `deny` - Block operation

**Permission Presets:**
- **Autonomous** - Full auto-approval for maximum automation
- **Review All** - Prompt for every operation for maximum control
- **Read Only** - Block all write operations for safe exploration

**Directory Access Control:**
```yaml
permissions:
  directoryAccess:
    allowedPaths:
      - 'src/**'
      - 'test/**'
      - 'docs/**'
    blockedPaths:
      - 'node_modules/**'
      - '.git/**'
      - 'dist/**'
    requireConfirmation:
      - 'config/**'
      - 'scripts/**'
```

**Per-Tool Configuration:**
```yaml
tools:
  bash:
    requireConfirmation: true
    blockedCommands:
      - 'rm -rf /'
      - 'sudo *'
  browser:
    allowedDomains:
      - 'localhost'
      - '*.local'
    blockedDomains:
      - '*.onion'
```

### 5. Autonomy Controls

Intelligent resource management with configurable limits:

**Budget Limits:**
```yaml
autonomy:
  limits:
    budgetLimit: 25.0        # Stop at $25
    warningThreshold: 0.8    # Warn at 80% ($20)
```

**Token Limits:**
```yaml
autonomy:
  limits:
    tokenLimit: 150000       # Stop at 150k tokens
    warningThreshold: 0.9    # Warn at 135k tokens
```

**Time Limits:**
```yaml
autonomy:
  limits:
    timeLimit: 7200000       # Stop after 2 hours
```

**Change Limits:**
```yaml
autonomy:
  limits:
    changeLimit:
      files: 50              # Max 50 files
      lines: 2000            # Max 2000 lines
```

**Approval Gates:**
```yaml
autonomy:
  approvalGates:
    - budget                 # Require approval before budget limit
    - changes                # Require approval before change limit
    - dangerous              # Require approval for dangerous operations
```

### 6. Code Quality Integration

Automated code quality enforcement with intelligent feedback loops:

**Lint-after-Edit:**
- Automatically lint code after every edit
- Fix syntax errors and missing imports automatically
- Pre-edit validation to prevent syntax errors

**Auto-Correction Loop:**
- Iteratively fix code until tests pass
- Monitor compiler errors and fix proactively
- Type checking integration for TypeScript/Flow

**Test-Driven Development (TDD):**
```yaml
codeQuality:
  tddMode: true
  autoCorrection: true
  regressionGuard: true
```

### 7. Tool Extensions & MCP

Extensible tool system with Model Context Protocol integration:

**Custom Tools:**
```typescript
// custom-tools/database.ts
export const databaseTool = {
  name: 'database-query',
  description: 'Query database',
  permissions: ['database'],
  execute: async (params) => {
    // Tool implementation
  }
};
```

**MCP Server Integration:**
```yaml
# .apex/config.yaml
mcp:
  servers:
    - id: file-server
      name: File Operations
      command: mcp-file-server
      args: []
    - id: git-server
      name: Git Operations
      command: mcp-git-server
      args: ["--repo", "."]
```

**Tool Hooks:**
```typescript
// Pre-execution validation
apex.addHook('beforeExecute', async (context) => {
  if (context.toolName === 'bash' && context.params.command.includes('rm')) {
    return { allowed: false, reason: 'Dangerous delete operation' };
  }
  return { allowed: true };
});

// Post-execution processing
apex.addHook('afterExecute', async (context, result) => {
  console.log(`Tool ${context.toolName} completed in ${result.duration}ms`);
  return result;
});
```

### 8. Policy-as-Code Rules

Enforce repository rules and organizational policies:

```yaml
# .apex/policy.yaml
version: "1.0"
enforcement: enforce        # enforce | audit | disabled

allowedPaths:
  mode: allowlist
  allow:
    - "src/**/*.{ts,tsx,js,jsx}"
    - "test/**/*.{ts,js}"
    - "docs/**/*.md"
  block:
    - "node_modules/**"
    - ".git/**"
    - "dist/**"
  sensitive:
    - "config/**"
    - "scripts/**"

approvalRules:
  - id: dangerous-operations
    name: Dangerous Operations
    urgency: high
    condition:
      type: tool-operation
      tools: [bash, evaluate]
      patterns: ["rm -rf", "sudo", "eval"]

  - id: config-changes
    name: Configuration Changes
    urgency: medium
    condition:
      type: file-pattern
      pattern: "**/*.{json,yaml,config}"
      operation: write

  - id: cost-threshold
    name: High Cost Operations
    urgency: low
    condition:
      type: cost-threshold
      threshold: 5.0
```

### 9. Secret Leak Guardrails

Prevent accidental exposure of sensitive information:

```yaml
secretDetection:
  enabled: true
  patterns:
    - name: API_KEY
      pattern: "(?i)(api[_-]?key|apikey)\\s*[:=]\\s*['\"]?([a-zA-Z0-9]{20,})['\"]?"
    - name: PASSWORD
      pattern: "(?i)(password|passwd|pwd)\\s*[:=]\\s*['\"]?([^\\s'\"]{8,})['\"]?"
    - name: JWT_TOKEN
      pattern: "eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+"
  actions:
    - block-commit
    - redact-output
    - alert-user
```

## Migration from v0.4.0

### New Configuration Options

Add to `.apex/config.yaml`:

```yaml
# Browser automation
tools:
  browser:
    enabled: true
    engine: chromium
    headless: true

# Permission system
permissions:
  preset: reviewAll
  persistence: true

# Autonomy controls
autonomy:
  enabled: true
  limits:
    budgetLimit: 10.0
    tokenLimit: 50000
```

### Breaking Changes

1. **Permission System** - Tools now require explicit permissions
2. **Policy Enforcement** - File access is restricted by default
3. **Autonomy Limits** - Tasks pause when limits are exceeded

### Upgrade Path

1. Update configuration file with new sections
2. Set permission preset based on desired autonomy level
3. Configure browser automation if needed
4. Review and adjust policy rules for your project

## Examples

### Full Feature Development Workflow

```bash
# 1. Create feature with browser testing
apex run "Add a login form with validation and visual testing"

# The workflow will:
# - Create login component files
# - Add form validation logic
# - Create browser test for user interactions
# - Take screenshots for visual regression
# - Run linting and type checking
# - Execute tests to ensure functionality
# - Request approval for sensitive changes
```

### Visual Regression Testing

```bash
# 1. Set up baseline screenshots
apex run "Create baseline screenshots for all pages"

# 2. Make UI changes
apex run "Update button styling and layout"

# 3. Compare against baselines
apex run "Run visual regression tests and report differences"
```

### Policy-Driven Development

```bash
# 1. Configure project policies
echo "approval required for config changes" >> .apex/policy.yaml

# 2. Attempt config change (will require approval)
apex run "Update database connection settings"

# 3. Review and approve through CLI
apex approve <task-id>
```

## Best Practices

### Permission Management

1. **Start with `reviewAll`** preset to understand tool usage
2. **Graduate to `autonomous`** preset for trusted workflows
3. **Use directory access controls** to protect sensitive files
4. **Configure per-tool permissions** for fine-grained control

### Autonomy Controls

1. **Set conservative limits** initially and adjust based on usage
2. **Use warning thresholds** to get advance notice
3. **Configure approval gates** for critical checkpoints
4. **Monitor resource usage** through dashboard

### Browser Automation

1. **Use localhost domains** for local testing
2. **Block external domains** to prevent unintended requests
3. **Take screenshots** for debugging and documentation
4. **Implement visual regression** for UI stability

### Code Quality

1. **Enable lint-after-edit** for automatic cleanup
2. **Use TDD mode** for test-driven development
3. **Configure type checking** for TypeScript projects
4. **Set up regression guards** to prevent breaking changes

## Troubleshooting

### Common Issues

**Permission Denied Errors:**
```bash
# Check current permissions
apex permissions list

# Grant tool permission
apex permissions grant browser allow-always

# Reset session cache
apex permissions reset-session
```

**Autonomy Limit Exceeded:**
```bash
# Check current usage
apex status limits

# Increase limits temporarily
apex config set autonomy.limits.budgetLimit 20.0

# Resume paused task
apex resume <task-id>
```

**Browser Automation Failures:**
```bash
# Check browser installation
npx playwright install chromium

# Test browser connectivity
apex browser test-connection

# Check domain allowlist
apex config get tools.browser.allowedDomains
```

**Policy Violations:**
```bash
# Check policy rules
apex policy validate

# Review violations
apex policy violations <task-id>

# Update policy configuration
edit .apex/policy.yaml
```

## Performance Tips

1. **Use appropriate autonomy levels** - autonomous for trusted tasks
2. **Configure browser headless mode** for faster execution
3. **Set reasonable resource limits** to prevent runaway tasks
4. **Use MCP servers** for frequently used external tools
5. **Enable dry-run mode** for testing workflows before execution

## Security Considerations

1. **Review permission presets** carefully before use
2. **Block dangerous domains** in browser configuration
3. **Use approval gates** for sensitive operations
4. **Enable secret detection** to prevent leaks
5. **Audit tool usage** regularly through logs

## Next Steps

- Explore [Browser Automation Guide](./browser-automation.md)
- Learn [Permission System](./permission-system.md)
- Configure [Autonomy Controls](./autonomy-controls.md)
- Set up [Tool Extensions](./tool-extensions.md)
- Review [Code Quality Integration](./code-quality.md)