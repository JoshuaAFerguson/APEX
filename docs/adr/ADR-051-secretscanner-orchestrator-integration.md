# ADR-051: SecretScanner Integration into ApexOrchestrator

## Status
Proposed

## Context

APEX has a `SecretScanner` class in `@apex/orchestrator` that provides pattern-matching capabilities for detecting secrets in content. The scanner is fully implemented with built-in patterns for common secrets (API keys, AWS keys, GitHub tokens, JWTs, database URLs, private keys, passwords, Slack tokens, etc.) and supports custom patterns.

Currently, the `SecretScanner` is a standalone class exported from the orchestrator package but is **not integrated into the `ApexOrchestrator`** class. The task is to:
1. Add scanner configuration to `ApexConfig`
2. Initialize `SecretScanner` in `ApexOrchestrator.initialize()`
3. Make the scanner optional (graceful handling if not configured)
4. Log initialization appropriately

### Current State Analysis

1. **SecretScanner Class**: Fully implemented in `packages/orchestrator/src/scanner.ts`
   - Constructor accepts `SecretScannerConfig` (all fields optional with sensible defaults)
   - Exports `SecretScanner`, `SecretPattern`, and `SecretScannerConfig` from `packages/orchestrator/src/index.ts`

2. **SecretScannerConfig Interface** (from scanner.ts):
   ```typescript
   interface SecretScannerConfig {
     customPatterns?: SecretPattern[];
     includeBuiltInPatterns?: boolean;  // default: true
     maxLineLength?: number;            // default: 10000
     maskSecrets?: boolean;             // default: true
     contextLength?: number;            // default: 20
   }
   ```

3. **ApexConfig Schema**: Defined in `packages/core/src/types.ts` with existing optional services:
   - `linter: LinterConfigSchema.optional()`
   - `hooks: z.lazy(() => z.array(HookConfigSchema)).optional().default([])`
   - `policy: z.lazy(() => PolicyConfigSchema).optional()`
   - etc.

4. **ApexOrchestrator Initialization Pattern**: The `initialize()` method follows a consistent pattern:
   - Load configuration
   - Initialize services conditionally based on config
   - Forward events for integration
   - Uses `!` definite assignment assertion for required services
   - Uses `?` for optional services (like `worktreeManager`)

## Decision

We will integrate `SecretScanner` into `ApexOrchestrator` following the established patterns for optional services:

### 1. Configuration Schema (in @apex/core)

Add a new `ScannerConfigSchema` to `packages/core/src/types.ts`:

```typescript
/**
 * Secret scanner configuration for detecting secrets in content (v0.5.0)
 */
export const ScannerConfigSchema = z.object({
  /** Enable secret scanning (default: false for backward compatibility) */
  enabled: z.boolean().optional().default(false),
  /** Include built-in patterns for common secrets (default: true) */
  includeBuiltInPatterns: z.boolean().optional().default(true),
  /** Maximum line length to scan (default: 10000) */
  maxLineLength: z.number().optional().default(10000),
  /** Mask sensitive content in findings (default: true) */
  maskSecrets: z.boolean().optional().default(true),
  /** Number of characters for context around matches (default: 20) */
  contextLength: z.number().optional().default(20),
  /** Custom patterns to scan for (advanced usage) */
  customPatterns: z.array(z.object({
    name: z.string(),
    regex: z.string(),
    secretType: z.string(),
    confidence: z.number().min(0).max(1),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    description: z.string(),
  })).optional().default([]),
});
export type ScannerConfig = z.infer<typeof ScannerConfigSchema>;
```

Add to `ApexConfigSchema`:
```typescript
/** Secret scanner configuration for detecting secrets in content (v0.5.0) */
scanner: ScannerConfigSchema.optional(),
```

### 2. Orchestrator Integration

In `packages/orchestrator/src/index.ts`:

```typescript
// Add import at the top
import { SecretScanner, type SecretScannerConfig, type SecretPattern } from './scanner';

// Add private property in ApexOrchestrator class
private secretScanner?: SecretScanner;

// In initialize() method, after other service initializations:
// Initialize secret scanner if configured
if (this.config.scanner?.enabled) {
  const scannerConfig: SecretScannerConfig = {
    includeBuiltInPatterns: this.config.scanner.includeBuiltInPatterns,
    maxLineLength: this.config.scanner.maxLineLength,
    maskSecrets: this.config.scanner.maskSecrets,
    contextLength: this.config.scanner.contextLength,
    customPatterns: this.config.scanner.customPatterns?.map(p => ({
      ...p,
      regex: new RegExp(p.regex, 'g'),
    })),
  };
  this.secretScanner = new SecretScanner(scannerConfig);
  // Log at debug level - following existing console.warn/log patterns
  // Note: Orchestrator uses console for logging, not a formal logger
}

// Add public getter method
public getSecretScanner(): SecretScanner | undefined {
  return this.secretScanner;
}
```

### 3. Architecture Diagram

```
.apex/config.yaml
      |
      v
+------------------+          +------------------+
| @apex/core       |          | @apex/orchestrator|
+------------------+          +------------------+
| ScannerConfig    |  --->    | ApexOrchestrator |
| (Zod schema)     |          |   - secretScanner?|
+------------------+          |   + getSecretScanner()|
                              +--------+---------+
                                       |
                                       v
                              +------------------+
                              | SecretScanner    |
                              | - scan()         |
                              | - getPatterns()  |
                              | - addPattern()   |
                              +------------------+
```

### 4. Configuration File Example

```yaml
# .apex/config.yaml
version: "1.0"
project:
  name: my-project

scanner:
  enabled: true
  includeBuiltInPatterns: true
  maxLineLength: 10000
  maskSecrets: true
  contextLength: 20
  customPatterns:
    - name: my-internal-key
      regex: "INTERNAL_[A-Z0-9]{32}"
      secretType: internal-key
      confidence: 0.9
      severity: high
      description: Internal API key pattern
```

### Key Design Decisions

1. **Opt-in by Default**: `enabled: false` by default for backward compatibility. Existing projects won't have scanning enabled until explicitly configured.

2. **Regex as String in Config**: Custom patterns store regex as string in YAML/JSON config. Converted to `RegExp` during initialization. This allows serialization in config files.

3. **Optional Property with `?`**: Following the `worktreeManager?: WorktreeManager` pattern for optional services.

4. **No Events Initially**: Unlike `LinterService` or `HookManager`, `SecretScanner` is synchronous and stateless. Events can be added later if needed (e.g., `secret:found`).

5. **Getter Method**: Provides access to the scanner instance for components that need it (e.g., hooks, tools). Returns `undefined` if not configured.

6. **Schema in Core**: The Zod schema goes in `@apex/core` to match the pattern of all other config schemas, even though the implementation is in `@apex/orchestrator`.

## Consequences

### Positive
- Enables secret scanning capability in APEX workflows
- Follows established patterns for optional services
- Backward compatible (disabled by default)
- Clear configuration in `.apex/config.yaml`
- Type-safe configuration with Zod validation

### Negative
- Additional field in ApexConfig (minor schema expansion)
- Regex validation happens at runtime, not schema level

### Neutral
- No new dependencies (SecretScanner already exists)
- No database changes required
- No event system changes required initially

## File Changes Required

1. **Modify**: `packages/core/src/types.ts`
   - Add `ScannerConfigSchema` definition
   - Add `scanner` field to `ApexConfigSchema`
   - Export `ScannerConfig` type

2. **Modify**: `packages/orchestrator/src/index.ts`
   - Add import for `SecretScanner` and types
   - Add `private secretScanner?: SecretScanner` property
   - Add initialization logic in `initialize()` method
   - Add `getSecretScanner()` public method

## Implementation Notes

### Initialization Order

The scanner should be initialized after config loading but before services that might use it:

```typescript
async initialize(): Promise<void> {
  // ... existing config and agent loading ...

  // Initialize secret scanner if configured (before hook manager)
  if (this.config.scanner?.enabled) {
    this.initializeSecretScanner();
  }

  // ... rest of initialization ...
}

private initializeSecretScanner(): void {
  const config = this.config.scanner!;
  const scannerConfig: SecretScannerConfig = {
    includeBuiltInPatterns: config.includeBuiltInPatterns,
    maxLineLength: config.maxLineLength,
    maskSecrets: config.maskSecrets,
    contextLength: config.contextLength,
    customPatterns: config.customPatterns?.map(p => ({
      ...p,
      regex: new RegExp(p.regex, 'g'),
    })),
  };
  this.secretScanner = new SecretScanner(scannerConfig);
}
```

### Graceful Handling

If scanner is not configured or disabled:
- `this.secretScanner` remains `undefined`
- `getSecretScanner()` returns `undefined`
- No error or warning is logged (opt-in feature)
- Consumers should check for undefined before using

### Testing Strategy

1. Unit tests for `ScannerConfigSchema` validation
2. Integration tests for orchestrator initialization with/without scanner config
3. Verify graceful handling when scanner is disabled
4. Test custom pattern regex conversion

## References

- SecretScanner implementation: `packages/orchestrator/src/scanner.ts`
- Existing scanner tests: `packages/orchestrator/src/scanner.test.ts`, `scanner.comprehensive.test.ts`
- ApexConfig types: `packages/core/src/types.ts` (line 1512)
- ApexOrchestrator: `packages/orchestrator/src/index.ts` (line 529)
