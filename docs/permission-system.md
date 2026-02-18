# Permission System

## Overview

APEX's permission system provides fine-grained control over tool operations with three levels of permission: allow-always, allow-once, and deny. The system includes configurable presets, directory access controls, and persistence across sessions for both security and usability.

## Permission Levels

### allow-always
Permanent permission that persists across sessions until explicitly revoked.

```typescript
// Grant permanent permission for browser navigation
await apex.permissions.grantPermission('browser', 'allow-always', 'navigate');
```

### allow-once
Single-use permission that is consumed after one operation.

```typescript
// Grant one-time permission for bash command
await apex.permissions.grantPermission('bash', 'allow-once', 'execute');
```

### deny
Block operation and prevent execution.

```typescript
// Deny dangerous bash operations
await apex.permissions.denyPermission('bash', 'dangerous-operations');
```

## Permission Presets

### Autonomous Preset
Full auto-approval for maximum automation efficiency.

```yaml
# .apex/config.yaml
permissions:
  preset: autonomous
  persistence: true
```

**Behavior:**
- All tool operations automatically approved
- No user prompts for standard operations
- Elevated operations may still require confirmation
- Best for trusted, repetitive workflows

### Review All Preset
Prompt for every operation for maximum control.

```yaml
permissions:
  preset: reviewAll
  persistence: true
```

**Behavior:**
- Every tool operation requires approval
- Detailed operation descriptions shown
- User can grant allow-once or allow-always
- Best for learning or sensitive environments

### Read Only Preset
Block all write operations for safe exploration.

```yaml
permissions:
  preset: readOnly
  persistence: true
```

**Behavior:**
- Read operations automatically approved
- Write operations blocked
- File modifications prevented
- Best for code review and analysis

## Configuration

### Basic Permission Configuration

```yaml
# .apex/config.yaml
permissions:
  preset: reviewAll              # autonomous | reviewAll | readOnly
  persistence: true              # Save decisions across sessions
  sessionTimeout: 3600000        # Session cache timeout (1 hour)

  # Default permissions for tools
  defaults:
    browser: allow-always
    file: reviewAll
    bash: deny
```

### Per-Tool Permission Configuration

```yaml
tools:
  browser:
    requireConfirmation: false
    allowedOperations:
      - navigate
      - click
      - type
      - screenshot
    elevatedOperations:
      - evaluate              # Requires explicit approval
      - submit                # Requires explicit approval

  bash:
    requireConfirmation: true
    blockedCommands:
      - 'rm -rf /'
      - 'sudo *'
      - 'dd if=*'
    allowedCommands:
      - 'git *'
      - 'npm *'
      - 'node *'

  file:
    allowedExtensions:
      - '.js'
      - '.ts'
      - '.md'
      - '.json'
    blockedExtensions:
      - '.exe'
      - '.sh'
      - '.bat'
```

### Directory Access Control

```yaml
permissions:
  directoryAccess:
    mode: allowlist             # allowlist | blocklist

    # Allowlist mode - only these paths allowed
    allowedPaths:
      - 'src/**'
      - 'test/**'
      - 'docs/**'
      - 'package.json'

    # Blocklist mode - these paths blocked
    blockedPaths:
      - 'node_modules/**'
      - '.git/**'
      - 'dist/**'
      - 'build/**'

    # Paths requiring confirmation regardless of mode
    requireConfirmation:
      - 'config/**'
      - 'scripts/**'
      - '.env*'

    # Sensitive paths with extra warnings
    sensitive:
      - 'credentials/**'
      - 'keys/**'
      - '*.key'
      - '*.pem'
```

## Usage Examples

### Checking Permissions

```typescript
// Check if tool permission exists
const permission = await apex.permissions.getPermission('browser', 'navigate');
console.log(`Browser navigation permission: ${permission}`);

// Check if operation is allowed
const allowed = await apex.permissions.checkToolPermission({
  tool: 'bash',
  scope: 'execute',
  context: { command: 'git status' }
});

if (allowed.granted) {
  console.log('Command execution permitted');
} else {
  console.log(`Permission denied: ${allowed.reason}`);
}
```

### Managing Permissions

```typescript
// Grant permanent permission
await apex.permissions.grantPermission('browser', 'allow-always');

// Grant scoped permission
await apex.permissions.grantPermission('file', 'allow-always', 'read');
await apex.permissions.grantPermission('file', 'allow-once', 'write');

// Deny specific operations
await apex.permissions.denyPermission('bash', 'dangerous-operations');

// Reset permissions for fresh start
await apex.permissions.resetPermissions('browser');
```

### Session Management

```typescript
// Check session status
const session = await apex.permissions.getSessionStatus();
console.log(`Session expires: ${session.expiresAt}`);
console.log(`Cached permissions: ${session.cached.length}`);

// Reset session cache (clears allow-once permissions)
await apex.permissions.resetSession();

// Extend session timeout
await apex.permissions.extendSession(3600000); // 1 hour
```

## Directory Access Patterns

### Project Structure Protection

```yaml
permissions:
  directoryAccess:
    mode: allowlist
    allowedPaths:
      # Source code
      - 'src/**/*.{js,ts,tsx,jsx}'
      - 'lib/**/*.{js,ts}'

      # Tests
      - 'test/**/*.{js,ts}'
      - '**/*.test.{js,ts}'
      - '**/*.spec.{js,ts}'

      # Documentation
      - 'docs/**/*.md'
      - 'README.md'
      - 'CHANGELOG.md'

      # Configuration
      - 'package.json'
      - 'tsconfig.json'
      - '.apex/config.yaml'

    blockedPaths:
      # Generated files
      - 'node_modules/**'
      - 'dist/**'
      - 'build/**'
      - '.next/**'

      # Version control
      - '.git/**'

      # Logs and caches
      - 'logs/**'
      - '.cache/**'
      - '*.log'
```

### Security-Focused Configuration

```yaml
permissions:
  directoryAccess:
    mode: allowlist
    allowedPaths:
      - 'public/**'           # Public assets only
      - 'src/**/*.{js,ts}'    # Source code only

    blockedPaths:
      - 'config/**'          # Configuration blocked
      - 'scripts/**'         # Scripts blocked
      - 'server/**'          # Server code blocked

    sensitive:
      - '.env*'              # Environment files
      - '*.key'              # Key files
      - '*.pem'              # Certificate files
      - 'credentials.*'      # Credential files

    requireConfirmation:
      - 'package.json'       # Package changes
      - '*.json'             # Any JSON files
      - '*.yaml'             # YAML configurations
```

## Permission Events

### Event Types

The permission system emits events for monitoring and debugging:

```typescript
// Listen to permission events
apex.permissions.on('permission:requested', (event) => {
  console.log(`Permission requested for ${event.tool}:${event.scope}`);
});

apex.permissions.on('permission:granted', (event) => {
  console.log(`Permission granted: ${event.level} for ${event.tool}:${event.scope}`);
});

apex.permissions.on('permission:denied', (event) => {
  console.log(`Permission denied for ${event.tool}:${event.scope}: ${event.reason}`);
});

apex.permissions.on('permission:expired', (event) => {
  console.log(`Permission expired for ${event.tool}:${event.scope}`);
});
```

### Event Data Structure

```typescript
interface PermissionEvent {
  timestamp: Date;
  tool: string;
  scope?: string;
  level?: PermissionLevel;
  reason?: string;
  context?: any;
  userId?: string;
  sessionId: string;
}
```

## Advanced Features

### Conditional Permissions

```typescript
// Permission based on file path
const filePermission = await apex.permissions.checkFileAccess({
  path: 'src/components/Button.tsx',
  operation: 'write'
});

// Permission based on command content
const bashPermission = await apex.permissions.checkCommandPermission({
  command: 'git commit -m "Update documentation"',
  workingDirectory: '/project/root'
});

// Permission based on URL domain
const browserPermission = await apex.permissions.checkDomainPermission({
  url: 'https://api.example.com/data',
  operation: 'navigate'
});
```

### Permission Hooks

```typescript
// Pre-execution permission hook
apex.permissions.addHook('beforeCheck', async (context) => {
  // Custom permission logic
  if (context.tool === 'bash' && context.command?.includes('rm')) {
    return { allowed: false, reason: 'Dangerous delete operation blocked' };
  }
  return { allowed: true };
});

// Post-execution permission hook
apex.permissions.addHook('afterGrant', async (context, result) => {
  // Log permission grants
  console.log(`Permission granted: ${context.tool}:${context.scope}`);

  // Custom notifications
  if (result.level === 'allow-always') {
    await sendNotification(`Permanent permission granted for ${context.tool}`);
  }
});
```

### Permission Delegation

```typescript
// Delegate permissions to specific contexts
await apex.permissions.createDelegation({
  id: 'build-script',
  permissions: [
    { tool: 'bash', scope: 'build-commands' },
    { tool: 'file', scope: 'dist' }
  ],
  constraints: {
    workingDirectory: '/project',
    timeLimit: 3600000  // 1 hour
  }
});

// Use delegated permissions
const buildResult = await apex.permissions.withDelegation('build-script', async () => {
  await apex.bash.execute({ command: 'npm run build' });
  await apex.file.write({ path: 'dist/build-info.json', content: buildInfo });
});
```

## CLI Commands

### List Permissions

```bash
# List all permissions
apex permissions list

# List permissions for specific tool
apex permissions list browser

# List permissions with details
apex permissions list --verbose
```

### Grant Permissions

```bash
# Grant tool permission
apex permissions grant browser allow-always

# Grant scoped permission
apex permissions grant browser:navigate allow-once

# Grant with expiration
apex permissions grant bash:build allow-always --expires 3600
```

### Manage Sessions

```bash
# Show session status
apex permissions session

# Reset session cache
apex permissions reset-session

# Clear all permissions
apex permissions reset --confirm
```

## Security Best Practices

### 1. Principle of Least Privilege

```yaml
# Start with restrictive defaults
permissions:
  preset: reviewAll
  defaults:
    browser: deny
    bash: deny
    file: allow-once
```

### 2. Regular Permission Audits

```bash
# Review granted permissions
apex permissions audit

# Check for unused permissions
apex permissions cleanup --dry-run

# Export permission report
apex permissions export --format json > permissions-audit.json
```

### 3. Environment-Specific Configurations

```yaml
# Development environment
permissions:
  preset: autonomous
  directoryAccess:
    mode: allowlist
    allowedPaths: ['src/**', 'test/**']

---
# Production environment
permissions:
  preset: readOnly
  directoryAccess:
    mode: allowlist
    allowedPaths: ['public/**']
```

### 4. Monitoring and Alerting

```typescript
// Set up permission monitoring
apex.permissions.on('permission:denied', (event) => {
  if (event.tool === 'bash' && event.context?.command?.includes('rm')) {
    // Alert on dangerous command attempts
    sendSecurityAlert(`Dangerous command blocked: ${event.context.command}`);
  }
});

// Monitor permission escalation
apex.permissions.on('permission:granted', (event) => {
  if (event.level === 'allow-always' && event.scope === 'dangerous-operations') {
    logSecurityEvent(`Elevated permission granted: ${event.tool}:${event.scope}`);
  }
});
```

## Troubleshooting

### Common Issues

**Permission Denied Errors:**
```bash
# Check current permissions
apex permissions list

# Grant missing permission
apex permissions grant <tool> allow-once

# Check permission logs
apex logs permissions
```

**Session Timeout Issues:**
```bash
# Check session status
apex permissions session

# Extend session
apex permissions extend-session 3600

# Reset if corrupted
apex permissions reset-session
```

**Directory Access Blocked:**
```bash
# Check directory permissions
apex permissions check-path /path/to/file

# Add to allowed paths
apex config add permissions.directoryAccess.allowedPaths "new/path/**"

# Verify configuration
apex config get permissions.directoryAccess
```

### Debug Mode

```bash
# Enable permission debugging
apex config set permissions.debug true

# Run with verbose permission logging
apex run --verbose-permissions "task description"

# Check permission decision logs
tail -f .apex/logs/permissions.log
```

## Migration and Backup

### Backup Permissions

```bash
# Export current permissions
apex permissions export > permissions-backup.json

# Restore permissions
apex permissions import permissions-backup.json

# Migrate between environments
apex permissions export --env production > prod-permissions.json
apex permissions import prod-permissions.json --env development
```

### Configuration Migration

```typescript
// Migrate old permission format
const oldConfig = {
  browser: 'always',
  file: 'prompt',
  bash: 'never'
};

const newConfig = {
  browser: 'allow-always',
  file: 'allow-once',
  bash: 'deny'
};

await apex.permissions.migrate(oldConfig, newConfig);
```

For more examples and integration patterns, see:
- [Permission System Examples](./examples/permission-system/)
- [Security Configuration Patterns](./examples/security-patterns/)
- [Multi-Environment Setup](./examples/multi-environment/)