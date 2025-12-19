# ADR-039: /preview CLI Command Architecture

## Status

**Proposed** - Technical design for completing /preview command implementation

## Date

2025-01-19

## Context

The `/preview` command needs to support toggling preview mode, viewing settings, modifying the confidence threshold, and persisting settings to the config file.

### Acceptance Criteria
1. `/preview on|off` toggles preview mode
2. `/preview settings` shows current config
3. `/preview confidence <0-1>` sets confidence threshold
4. Settings persist to config file

### Current State Analysis

**What's Already Implemented:**

The `/preview` command in `packages/cli/src/repl.tsx` (lines 1254-1394) already has:
- ✅ `on|off` toggling (lines 1262-1276)
- ✅ `toggle` with no args (lines 1278-1286)
- ✅ `confidence <value>` (lines 1288-1312) - accepts 0-100 percentage
- ✅ `timeout <value>` (lines 1315-1340)
- ✅ `auto [on|off]` (lines 1342-1374)
- ✅ `status` - shows all current settings (lines 1376-1385)

**What's Missing (Gaps):**

| Gap | Description | Required For |
|-----|-------------|--------------|
| `/preview settings` alias | `status` exists but not `settings` | AC #2 |
| Config persistence | Runtime changes don't persist to `.apex/config.yaml` | AC #4 |
| Decimal confidence input | Currently accepts 0-100, AC expects 0-1 range | AC #3 |

### Existing Infrastructure

**Config System** (`packages/core/src/config.ts`):
- `loadConfig(projectPath)` - loads `.apex/config.yaml`
- `saveConfig(projectPath, config)` - writes to `.apex/config.yaml`
- `getEffectiveConfig(config)` - applies defaults

**UIConfig Schema** (`packages/core/src/types.ts`, lines 125-131):
```typescript
export const UIConfigSchema = z.object({
  previewMode: z.boolean().optional().default(true),
  previewConfidence: z.number().min(0).max(1).optional().default(0.7),
  autoExecuteHighConfidence: z.boolean().optional().default(false),
  previewTimeout: z.number().min(1000).optional().default(5000),
});
```

**AppState** (`packages/cli/src/ui/App.tsx`, lines 195-200):
```typescript
previewMode: boolean;
previewConfig: {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
};
```

**Context** (`packages/cli/src/repl.tsx`, lines 35-48):
- `ctx.config` - loaded ApexConfig
- `ctx.cwd` - project directory for save path
- `ctx.app` - InkAppInstance for state updates

## Decision

### Architecture Design

#### 1. Add `settings` Alias for `status` Subcommand

The `status` subcommand already provides exactly what AC #2 needs. Simply add `settings` as an alias:

```typescript
case 'status':
case 'settings':  // Add alias
  const config = currentState?.previewConfig;
  ctx.app?.addMessage({
    type: 'assistant',
    content: `Preview Settings:
• Mode: ${currentState?.previewMode ? 'enabled' : 'disabled'}
• Confidence threshold: ${(config?.confidenceThreshold * 100).toFixed(0)}%
• Auto-execute high confidence: ${config?.autoExecuteHighConfidence ? 'enabled' : 'disabled'}
• Timeout: ${config?.timeoutMs / 1000}s`,
  });
  break;
```

#### 2. Support Both 0-1 and 0-100 Input Ranges for Confidence

The acceptance criteria specifies `0-1` but the current implementation uses `0-100`. Support both:

```typescript
case 'confidence':
  if (value === undefined) {
    // Show current value
    ctx.app?.addMessage({
      type: 'assistant',
      content: `Preview confidence threshold: ${(currentState?.previewConfig.confidenceThreshold * 100).toFixed(0)}%`,
    });
  } else {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      ctx.app?.addMessage({
        type: 'error',
        content: 'Confidence must be a number between 0-1 (e.g., 0.7) or 0-100 (e.g., 70).',
      });
    } else {
      // Auto-detect range: 0-1 vs 0-100
      const threshold = parsed > 1 ? parsed / 100 : parsed;

      if (threshold < 0 || threshold > 1) {
        ctx.app?.addMessage({
          type: 'error',
          content: 'Confidence threshold must be between 0-1 (or 0-100).',
        });
      } else {
        const newConfig = {
          ...currentState?.previewConfig,
          confidenceThreshold: threshold,
        };
        ctx.app?.updateState({ previewConfig: newConfig });

        // Persist to config file
        await persistPreviewConfig(newConfig);

        ctx.app?.addMessage({
          type: 'system',
          content: `Preview confidence threshold set to ${(threshold * 100).toFixed(0)}%.`,
        });
      }
    }
  }
  break;
```

#### 3. Config Persistence Architecture

Create a helper function to persist preview config changes to disk:

```typescript
async function persistPreviewConfig(previewConfig: {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}): Promise<void> {
  if (!ctx.config || !ctx.initialized) return;

  // Update config object
  ctx.config.ui = {
    ...ctx.config.ui,
    previewMode: ctx.app?.getState()?.previewMode ?? true,
    previewConfidence: previewConfig.confidenceThreshold,
    autoExecuteHighConfidence: previewConfig.autoExecuteHighConfidence,
    previewTimeout: previewConfig.timeoutMs,
  };

  // Persist to file
  await saveConfig(ctx.cwd, ctx.config);
}
```

#### 4. Data Flow for Config Persistence

```
User: /preview confidence 0.8
          │
          ▼
    handlePreview()
          │
          ├─► Parse value (0.8 → 0.8 or 80 → 0.8)
          │
          ├─► Update app state (runtime)
          │   ctx.app?.updateState({ previewConfig: {...} })
          │
          └─► Persist to config (disk)
              persistPreviewConfig(newConfig)
                    │
                    ├─► Update ctx.config.ui
                    │
                    └─► saveConfig(ctx.cwd, ctx.config)
                              │
                              ▼
                        .apex/config.yaml
```

#### 5. Complete /preview Command Interface

After implementation, the command will support:

```
/preview              Toggle preview mode
/preview on           Enable preview mode
/preview off          Disable preview mode
/preview toggle       Toggle preview mode (same as no args)
/preview status       Show current configuration
/preview settings     Show current configuration (alias for status)
/preview confidence   Show current confidence threshold
/preview confidence N Set threshold (N can be 0-1 or 0-100)
/preview timeout      Show current timeout
/preview timeout N    Set timeout in seconds
/preview auto         Show auto-execute status
/preview auto on|off  Enable/disable auto-execute for high confidence
```

### File Changes Required

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/repl.tsx` | Modify | Add `settings` alias, fix confidence range, add persistence |

### Detailed Implementation Changes

#### In `packages/cli/src/repl.tsx`

**1. Add persistence helper function** (before `handlePreview`):

```typescript
// Add after line ~1253 (before handlePreview)
async function persistPreviewConfig(previewConfig: {
  confidenceThreshold: number;
  autoExecuteHighConfidence: boolean;
  timeoutMs: number;
}): Promise<void> {
  if (!ctx.config || !ctx.initialized) return;

  // Update config object
  ctx.config.ui = {
    ...ctx.config.ui,
    previewMode: ctx.app?.getState()?.previewMode ?? ctx.config.ui?.previewMode ?? true,
    previewConfidence: previewConfig.confidenceThreshold,
    autoExecuteHighConfidence: previewConfig.autoExecuteHighConfidence,
    previewTimeout: previewConfig.timeoutMs,
  };

  // Persist to file
  try {
    await saveConfig(ctx.cwd, ctx.config);
  } catch (error) {
    ctx.app?.addMessage({
      type: 'error',
      content: `Failed to persist config: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
```

**2. Modify `handlePreview` function** (lines 1254-1394):

- Add `'settings'` case to fall through to `'status'` (line ~1376)
- Update `'confidence'` case to:
  - Support 0-1 decimal range (auto-detect)
  - Call `persistPreviewConfig()` after state update
- Update `'on'`/`'off'` cases to persist previewMode
- Update `'timeout'` case to persist
- Update `'auto'` case to persist

### Config File Changes

After running `/preview confidence 0.8`, the `.apex/config.yaml` will be updated:

```yaml
# Before
ui:
  previewMode: true
  previewConfidence: 0.7

# After
ui:
  previewMode: true
  previewConfidence: 0.8
```

### Error Handling

1. **Config not initialized**: Skip persistence silently (user may be in non-apex directory)
2. **File write fails**: Show error message but don't fail the state update
3. **Invalid values**: Reject with helpful error message

### Testing Strategy

#### Unit Tests

```typescript
describe('/preview command', () => {
  describe('settings alias', () => {
    it('should show current config when using /preview settings', async () => {
      await handleCommand('/preview settings');
      expect(lastMessage.content).toContain('Preview Settings:');
    });

    it('should show same output as /preview status', async () => {
      await handleCommand('/preview status');
      const statusOutput = lastMessage.content;
      await handleCommand('/preview settings');
      const settingsOutput = lastMessage.content;
      expect(settingsOutput).toEqual(statusOutput);
    });
  });

  describe('confidence range', () => {
    it('should accept 0-1 decimal values', async () => {
      await handleCommand('/preview confidence 0.8');
      expect(state.previewConfig.confidenceThreshold).toBe(0.8);
    });

    it('should accept 0-100 percentage values', async () => {
      await handleCommand('/preview confidence 80');
      expect(state.previewConfig.confidenceThreshold).toBe(0.8);
    });

    it('should reject values outside valid range', async () => {
      await handleCommand('/preview confidence 150');
      expect(lastMessage.type).toBe('error');
    });
  });

  describe('config persistence', () => {
    it('should persist confidence changes to config file', async () => {
      await handleCommand('/preview confidence 0.9');
      const savedConfig = await loadConfig(ctx.cwd);
      expect(savedConfig.ui?.previewConfidence).toBe(0.9);
    });

    it('should persist mode changes to config file', async () => {
      await handleCommand('/preview off');
      const savedConfig = await loadConfig(ctx.cwd);
      expect(savedConfig.ui?.previewMode).toBe(false);
    });
  });
});
```

#### Integration Tests

```typescript
describe('Preview Config Integration', () => {
  it('should load saved settings on restart', async () => {
    // Set and persist
    await handleCommand('/preview confidence 0.85');

    // Simulate restart
    const newApp = await startInkApp(ctx.cwd);

    // Verify loaded
    expect(newApp.getState().previewConfig.confidenceThreshold).toBe(0.85);
  });
});
```

## Consequences

### Positive
- Full acceptance criteria satisfied
- Backward compatible (existing 0-100 syntax still works)
- Config survives session restarts
- Familiar `settings` alias for users expecting it

### Negative
- Slightly more I/O operations (config file writes)
- Need to handle edge case of rapid setting changes

### Neutral
- Uses existing config infrastructure (no new dependencies)
- Minimal code changes (~50 lines)

## Implementation Priority

1. **High**: Add `settings` alias (simple, 2 lines)
2. **High**: Fix confidence range handling (AC requirement)
3. **High**: Implement config persistence
4. **Low**: Add confirmation message showing file was saved

## Summary for Next Stages

**Key Points for Developer Stage:**
1. Modify `handlePreview()` in `packages/cli/src/repl.tsx`
2. Add `persistPreviewConfig()` helper function
3. Support both 0-1 and 0-100 confidence input
4. Call persistence on all setting changes (on/off/confidence/timeout/auto)
5. Add `'settings'` as fallthrough case to `'status'`

**Files to Modify:**
- `packages/cli/src/repl.tsx` - Main implementation

**Dependencies:**
- `saveConfig` from `@apexcli/core` (already imported)
- `ctx.config` and `ctx.cwd` (already available in context)

## References

- Existing implementation: `packages/cli/src/repl.tsx` lines 1254-1394
- Config system: `packages/core/src/config.ts`
- UIConfig schema: `packages/core/src/types.ts` lines 125-131
- Prior ADR: `docs/adr/ADR-038-input-preview-feature-completion.md`
