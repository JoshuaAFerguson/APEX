# ADR-038: Input Preview Feature - Completion Architecture

## Status

**Proposed** - Architecture design for completing input preview feature

## Date

2025-01-19

## Context

The input preview feature was designed to show users what will be sent to the APEX system before execution. While the core functionality is implemented, the planning stage identified gaps that need to be addressed to fully satisfy the acceptance criteria:

### Acceptance Criteria
1. ✅ Input preview shows processed input before submission - **IMPLEMENTED**
2. ✅ Preview includes detected intent type - **IMPLEMENTED**
3. ✅ User can confirm or cancel from preview - **IMPLEMENTED**
4. ⚠️ **Configurable via settings** - Config schema exists, partially wired

### Current State Analysis

**Fully Implemented:**
- `PreviewPanel` component (`packages/cli/src/ui/components/PreviewPanel.tsx`) with responsive layout
- Intent detection via `ConversationManager.detectIntent()` (`packages/cli/src/services/ConversationManager.ts`)
- Preview mode toggle via `/preview` command in `repl.tsx`
- Keyboard shortcuts (Enter/Escape/e) for confirm/cancel/edit in `App.tsx`
- State management with `previewMode` and `pendingPreview` in `AppState`
- `previewMode` initialization from config at startup (line 53 in `ui/index.tsx`)

**Gaps Identified:**
1. `previewConfidence`, `autoExecuteHighConfidence`, `previewTimeout` not wired to runtime behavior
2. No runtime commands to modify confidence/timeout/auto-execute
3. StatusBar shows preview indicator but could show more config info

### Existing UIConfig Schema

**Location**: `packages/core/src/types.ts` (lines 125-131)

```typescript
export const UIConfigSchema = z.object({
  previewMode: z.boolean().optional().default(true),
  previewConfidence: z.number().min(0).max(1).optional().default(0.7),
  autoExecuteHighConfidence: z.boolean().optional().default(false),
  previewTimeout: z.number().min(1000).optional().default(5000),
});
```

### Existing Config Loading

**Location**: `packages/core/src/config.ts` (lines 314-319 in `getEffectiveConfig`)

```typescript
ui: {
  previewMode: config.ui?.previewMode ?? true,
  previewConfidence: config.ui?.previewConfidence ?? 0.7,
  autoExecuteHighConfidence: config.ui?.autoExecuteHighConfidence ?? false,
  previewTimeout: config.ui?.previewTimeout ?? 5000,
},
```

### Current Initialization

**Location**: `packages/cli/src/ui/index.tsx` (line 53)

```typescript
previewMode: (config as any)?.ui?.previewMode ?? false,
```

**Note**: Only `previewMode` is currently wired. The other config values are loaded but not used

## Decision

### Architecture Design for Feature Completion

#### 1. Wire UIConfig Settings to Runtime Behavior

**Current UIConfig Schema** (in `packages/core/src/types.ts`):
```typescript
export const UIConfigSchema = z.object({
  previewMode: z.boolean().optional().default(true),
  previewConfidence: z.number().min(0).max(1).optional().default(0.7),
  autoExecuteHighConfidence: z.boolean().optional().default(false),
  previewTimeout: z.number().min(1000).optional().default(5000),
});
```

**Behavior Mapping:**

| Config Field | Purpose | Implementation Point |
|--------------|---------|---------------------|
| `previewMode` | Default preview state on app start | `App.tsx` initial state |
| `previewConfidence` | Threshold below which preview is shown in auto mode | `handleInput()` logic |
| `autoExecuteHighConfidence` | Auto-execute when confidence >= threshold | `handleInput()` logic |
| `previewTimeout` | Auto-cancel preview after timeout (ms) | `useEffect` with timer |

#### 2. Component Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         AppState                                  │  │
│  │  previewMode: boolean (from config.ui.previewMode)               │  │
│  │  pendingPreview?: PendingPreview                                 │  │
│  │  previewConfig: UIConfig (from config.ui)                        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐  │
│  │   InputPrompt    │───▶│   handleInput    │───▶│  PreviewLogic   │  │
│  │  (user types)    │    │  (intercepts)    │    │  (config-aware) │  │
│  └──────────────────┘    └──────────────────┘    └────────┬────────┘  │
│                                                            │           │
│                           ┌────────────────────────────────┼──────┐    │
│                           │                                │      │    │
│                           ▼                                ▼      │    │
│              ┌────────────────────┐          ┌────────────────┐   │    │
│              │  Show PreviewPanel │          │ Auto-Execute   │   │    │
│              │  (low confidence)  │          │ (high conf.)   │   │    │
│              └────────────────────┘          └────────────────┘   │    │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### 3. Configuration Flow Design

```
.apex/config.yaml                loadConfig()              getEffectiveConfig()
     │                               │                            │
     ▼                               ▼                            ▼
┌─────────────┐              ┌─────────────────┐          ┌──────────────────┐
│ ui:         │   parse      │ ApexConfig      │  merge   │ Required<Config> │
│   preview..│─────────────▶│   ui?: UIConfig │────────▶│   ui: UIConfig   │
└─────────────┘              └─────────────────┘          └────────┬─────────┘
                                                                   │
                                                                   ▼
                                                          ┌──────────────────┐
                                                          │  App.tsx uses    │
                                                          │  effective config│
                                                          └──────────────────┘
```

#### 4. State Management Enhancement

**Modified AppState Interface:**

```typescript
export interface AppState {
  // ... existing fields ...

  // Preview mode state (enhanced)
  previewMode: boolean;              // Current toggle state
  pendingPreview?: PendingPreview;   // Pending preview data
  previewConfig: PreviewConfig;      // Runtime config settings
}

// New interface for preview configuration
interface PreviewConfig {
  confidenceThreshold: number;       // From config.ui.previewConfidence
  autoExecuteHighConfidence: boolean; // From config.ui.autoExecuteHighConfidence
  timeoutMs: number;                 // From config.ui.previewTimeout
}
```

#### 5. Input Processing Logic Enhancement

**Enhanced handleInput in App.tsx:**

```typescript
const handleInput = useCallback(
  async (input: string) => {
    // ... existing conversation context code ...

    // ENHANCED PREVIEW MODE LOGIC
    if (state.previewMode && !isPreviewCommand(input)) {
      const intent = conversationManager.detectIntent(input);

      // Check for auto-execute (high confidence bypass)
      const { confidenceThreshold, autoExecuteHighConfidence } = state.previewConfig;

      if (autoExecuteHighConfidence && intent.confidence >= confidenceThreshold) {
        // Auto-execute for high confidence - skip preview
        addMessage({
          type: 'system',
          content: `Auto-executing (${Math.round(intent.confidence * 100)}% confidence)`,
        });
        // Continue to execute without preview
      } else if (intent.confidence < confidenceThreshold || !autoExecuteHighConfidence) {
        // Show preview for low confidence or when auto-execute is off
        setState((prev) => ({
          ...prev,
          pendingPreview: {
            input,
            intent: {
              type: intent.type,
              confidence: intent.confidence,
              command: parseCommandDetails(input)?.command,
              args: parseCommandDetails(input)?.args,
              metadata: intent.metadata,
            },
            timestamp: new Date(),
          },
        }));
        return; // Wait for confirmation
      }
    }

    // ... rest of existing logic ...
  },
  [state.previewMode, state.previewConfig, conversationManager, addMessage]
);
```

#### 6. Preview Timeout Implementation

**New useEffect in App.tsx:**

```typescript
// Preview timeout auto-cancel
useEffect(() => {
  if (!state.pendingPreview) return;

  const timeoutMs = state.previewConfig.timeoutMs;
  if (timeoutMs <= 0) return; // Timeout disabled

  const timer = setTimeout(() => {
    setState((prev) => ({ ...prev, pendingPreview: undefined }));
    addMessage({
      type: 'system',
      content: `Preview timed out after ${timeoutMs / 1000}s. Input cancelled.`,
    });
  }, timeoutMs);

  return () => clearTimeout(timer);
}, [state.pendingPreview, state.previewConfig.timeoutMs, addMessage]);
```

#### 7. Config Initialization at App Startup

**In repl.tsx or App initialization:**

```typescript
// When loading config
const config = await loadConfig(projectPath);
const effectiveConfig = getEffectiveConfig(config);

// Initialize preview config from loaded settings
const previewConfig: PreviewConfig = {
  confidenceThreshold: effectiveConfig.ui.previewConfidence,
  autoExecuteHighConfidence: effectiveConfig.ui.autoExecuteHighConfidence,
  timeoutMs: effectiveConfig.ui.previewTimeout,
};

// Pass to App component
const initialState: AppState = {
  // ... other fields ...
  previewMode: effectiveConfig.ui.previewMode,
  previewConfig,
};
```

#### 8. Runtime Configuration Commands

**Enhanced /preview command:**

```
/preview              - Toggle preview mode
/preview on           - Enable preview mode
/preview off          - Disable preview mode
/preview status       - Show current settings
/preview confidence N - Set confidence threshold (0-100)
/preview timeout N    - Set timeout in seconds (0 to disable)
/preview auto on/off  - Toggle auto-execute for high confidence
```

**Implementation in repl.tsx:**

```typescript
async function handlePreview(args: string[]): Promise<void> {
  const action = args[0]?.toLowerCase();
  const currentState = ctx.app?.getState();

  switch (action) {
    // ... existing on/off/toggle cases ...

    case 'confidence':
      const confValue = parseInt(args[1], 10);
      if (isNaN(confValue) || confValue < 0 || confValue > 100) {
        ctx.app?.addMessage({
          type: 'error',
          content: 'Usage: /preview confidence <0-100>',
        });
        return;
      }
      ctx.app?.updateState({
        previewConfig: {
          ...currentState?.previewConfig,
          confidenceThreshold: confValue / 100,
        },
      });
      ctx.app?.addMessage({
        type: 'system',
        content: `Preview confidence threshold set to ${confValue}%`,
      });
      break;

    case 'timeout':
      const timeoutValue = parseInt(args[1], 10);
      if (isNaN(timeoutValue) || timeoutValue < 0) {
        ctx.app?.addMessage({
          type: 'error',
          content: 'Usage: /preview timeout <seconds> (0 to disable)',
        });
        return;
      }
      ctx.app?.updateState({
        previewConfig: {
          ...currentState?.previewConfig,
          timeoutMs: timeoutValue * 1000,
        },
      });
      ctx.app?.addMessage({
        type: 'system',
        content: timeoutValue === 0
          ? 'Preview timeout disabled'
          : `Preview timeout set to ${timeoutValue}s`,
      });
      break;

    case 'auto':
      const autoValue = args[1]?.toLowerCase();
      if (autoValue !== 'on' && autoValue !== 'off') {
        ctx.app?.addMessage({
          type: 'error',
          content: 'Usage: /preview auto <on|off>',
        });
        return;
      }
      ctx.app?.updateState({
        previewConfig: {
          ...currentState?.previewConfig,
          autoExecuteHighConfidence: autoValue === 'on',
        },
      });
      ctx.app?.addMessage({
        type: 'system',
        content: `Auto-execute for high confidence ${autoValue === 'on' ? 'enabled' : 'disabled'}`,
      });
      break;

    case 'status':
      const config = currentState?.previewConfig;
      ctx.app?.addMessage({
        type: 'assistant',
        content: `Preview Mode Status:
  Mode: ${currentState?.previewMode ? 'enabled' : 'disabled'}
  Confidence Threshold: ${Math.round((config?.confidenceThreshold || 0.7) * 100)}%
  Auto-Execute High Confidence: ${config?.autoExecuteHighConfidence ? 'yes' : 'no'}
  Timeout: ${config?.timeoutMs ? `${config.timeoutMs / 1000}s` : 'disabled'}`,
      });
      break;
  }
}
```

### File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/ui/App.tsx` | Modify | Add `previewConfig` to state, wire timeout, enhance handleInput |
| `packages/cli/src/repl.tsx` | Modify | Enhance handlePreview with config commands, load config at init |
| `packages/cli/src/ui/components/PreviewPanel.tsx` | Modify | Add optional timeout indicator |
| `packages/cli/src/ui/components/StatusBar.tsx` | Modify | Show config-sourced preview info |
| No new files needed | - | Existing architecture supports extension |

### Testing Strategy

#### Unit Tests
```typescript
describe('Preview Configuration', () => {
  it('should use config values for initial state', () => { /* ... */ });
  it('should auto-execute when confidence >= threshold', () => { /* ... */ });
  it('should show preview when confidence < threshold', () => { /* ... */ });
  it('should timeout preview after configured duration', () => { /* ... */ });
  it('should allow runtime config changes via /preview commands', () => { /* ... */ });
});
```

#### Integration Tests
```typescript
describe('Preview Config Integration', () => {
  it('should load preview settings from .apex/config.yaml', () => { /* ... */ });
  it('should persist runtime config changes to session', () => { /* ... */ });
  it('should handle missing config with defaults', () => { /* ... */ });
});
```

### Data Flow for Configuration

```
1. App startup
   |
2. loadConfig(projectPath) from .apex/config.yaml
   |
3. getEffectiveConfig(config) applies defaults
   |
4. Extract ui section for preview settings
   |
5. Create initialState with previewConfig
   |
6. App renders with config-aware behavior
   |
7. User can modify via /preview commands
   |
8. Changes apply to state.previewConfig
   |
9. handleInput uses state.previewConfig for decisions
```

## Consequences

### Positive
- Full acceptance criteria satisfied
- Config-driven behavior enables customization without code changes
- Runtime commands allow quick adjustments
- Timeout prevents stuck preview states
- Auto-execute improves power user workflow

### Negative
- Slightly increased complexity in handleInput
- More state to manage in App.tsx
- Need to document all config options

### Neutral
- Config schema already exists (no breaking changes)
- Existing PreviewPanel component needs minimal changes

## Implementation Priority

1. **High**: Wire existing config values to App state initialization
2. **High**: Implement auto-execute logic in handleInput
3. **Medium**: Add preview timeout with useEffect
4. **Medium**: Enhance /preview command with config options
5. **Low**: Add timeout indicator to PreviewPanel UI

## References

- Existing ADR: `docs/adr/0004-input-preview-feature.md`
- Technical Spec: `.apex/docs/input-preview-technical-spec.md`
- UIConfig Schema: `packages/core/src/types.ts`
- Current Implementation: `packages/cli/src/ui/App.tsx`
