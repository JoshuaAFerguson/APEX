# Behavior Modes Implementation Example

This document demonstrates the configurable behavior modes (warn, block, redact) implementation for APEX hook system.

## Overview

The implementation adds three configurable behavior modes that can be used in tool post-hooks:

1. **warn**: Emit event and pass output through unchanged
2. **block**: Emit event and block/return error
3. **redact**: Replace sensitive content with [REDACTED] placeholders

## Usage Example

### Hook Configuration (.apex/config.yaml)

```yaml
toolHooks:
  enabled: true
  post:
    - name: "security-scanner"
      handlerPath: "./hooks/security-check.js"
      tools: ["bash-tool", "write-tool"]
      priority: 100
      timeoutMs: 5000
```

### Hook Handler (hooks/security-check.js)

```javascript
#!/usr/bin/env node

const fs = require('fs');
const contextFile = process.argv[2];
const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

// Example security check logic
function checkForSensitiveContent(result) {
  const output = JSON.stringify(result);

  // Check for potential secrets
  if (output.includes('password') || output.includes('secret')) {
    return {
      behaviorMode: 'redact',
      behaviorReason: 'Detected sensitive information in output'
    };
  }

  // Check for dangerous commands
  if (output.includes('rm -rf') || output.includes('DELETE FROM')) {
    return {
      behaviorMode: 'block',
      behaviorReason: 'Dangerous operation detected'
    };
  }

  // Check for warnings
  if (output.includes('warning') || output.includes('deprecated')) {
    return {
      behaviorMode: 'warn',
      behaviorReason: 'Operation completed with warnings'
    };
  }

  return null; // No behavior mode triggered
}

const behaviorResult = checkForSensitiveContent(context.result);
if (behaviorResult) {
  console.log(JSON.stringify(behaviorResult));
}
```

## Implementation Details

### Type Definitions

- `BehaviorMode`: Enum with values 'warn', 'block', 'redact'
- `BehaviorEventData`: Event data structure for behavior notifications
- `PostHookResult`: Enhanced to include `behaviorMode` and `behaviorReason` fields

### Behavior Processing

1. **Warn Behavior**:
   - Emits `hook:behavior:triggered` event
   - Logs warning message
   - Passes original output through unchanged

2. **Block Behavior**:
   - Emits `hook:behavior:triggered` event
   - Logs error message
   - Returns error result and blocks further execution
   - Short-circuits remaining hook execution

3. **Redact Behavior**:
   - Emits `hook:behavior:triggered` event
   - Logs info message
   - Applies redaction patterns to sensitive content
   - Returns modified output with [REDACTED] placeholders

### Redaction Patterns

The implementation includes patterns for common sensitive data:
- Long tokens/keys (20+ characters)
- Password/secret assignments
- Email addresses
- Phone numbers
- Credit card numbers
- SSH private keys
- AWS credentials
- Environment variables with sensitive names

## Event Handling

Applications can listen for behavior events:

```javascript
orchestrator.hookManager.on('hook:behavior:triggered', (event) => {
  console.log(`Behavior ${event.behaviorMode} triggered:`, event.reason);
  // Handle the event (logging, notifications, etc.)
});
```

## Testing

The implementation includes comprehensive tests covering:
- All three behavior modes
- Event emission
- Result modification
- Error handling
- Nested content redaction
- Multiple hook execution
- Short-circuiting for block behavior