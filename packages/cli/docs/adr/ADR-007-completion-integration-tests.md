# ADR-007: Completion System Integration Tests Architecture

## Status
Accepted

## Date
2024-12-17

## Context

The v0.3.0 integration test suite (`v030-features.integration.test.tsx`) contains only 3 basic completion engine tests (lines 909-935). The acceptance criteria require comprehensive coverage of:
1. All completion providers (command, path, agent, workflow, task, history)
2. Tab completion with debouncing
3. Fuzzy search integration

### Current State Analysis

**Existing Test Coverage (lines 909-935):**
- Basic command completion (`getCompletions('ru', 'command')`)
- History-based completion (`getCompletions('create', 'natural')`)
- Context-aware completion (`updateContext` + file-based suggestions)

**Gap Analysis:**
The existing tests use an outdated API signature. The actual `CompletionEngine` class (from `CompletionEngine.ts`) uses:
```typescript
getCompletions(input: string, cursorPos: number, context: CompletionContext)
```

Not the simplified `getCompletions(prefix: string, mode: string)` pattern shown in existing tests.

### Components to Test

1. **CompletionEngine Service** (`services/CompletionEngine.ts`)
   - 8 default providers registered
   - Provider priority system
   - Deduplication and scoring logic

2. **AdvancedInput Component** (`ui/components/AdvancedInput.tsx`)
   - Debounced completion updates (configurable `debounceMs`)
   - Fuzzy search via Fuse.js
   - Tab completion behavior
   - Suggestion navigation (arrow keys)

3. **Integration Points**
   - Session context → CompletionContext mapping
   - History provider integration with SessionStore
   - Real-time context updates

## Decision

### Test Structure Architecture

```
describe('Completion Engine Integration', () => {
  describe('Provider Coverage', () => {
    describe('Command Provider', ...)
    describe('Session Subcommand Provider', ...)
    describe('Path Provider', ...)
    describe('Agent Provider (@mentions)', ...)
    describe('Workflow Provider (--workflow)', ...)
    describe('Task ID Provider (task_*)', ...)
    describe('History Provider', ...)
    describe('Task Pattern Provider', ...)
  })

  describe('Tab Completion Integration', () => {
    describe('Debouncing Behavior', ...)
    describe('Completion Triggering', ...)
    describe('Smart Replacement', ...)
  })

  describe('Fuzzy Search Integration', () => {
    describe('Fuse.js Integration', ...)
    describe('Threshold Behavior', ...)
    describe('Combined Results', ...)
  })

  describe('Context-Aware Completions', () => {
    describe('Project Context', ...)
    describe('Session History', ...)
    describe('Recent Tasks', ...)
  })
})
```

### Key Design Decisions

#### 1. Mocking Strategy

**File System Mocking:**
- Use existing `vi.mock('fs/promises')` pattern from test file
- Mock `readdir` with `withFileTypes: true` for path completion tests

**Timing/Debounce:**
- Use `vi.useFakeTimers()` (already in use)
- Test debounce with `vi.advanceTimersByTime(debounceMs)`

**Fuse.js:**
- Create real Fuse instances for fuzzy search tests
- Alternative: use `vi.mock('fuse.js')` for controlled scoring

#### 2. CompletionContext Factory

Create a test factory for consistent context generation:

```typescript
const createTestContext = (overrides: Partial<CompletionContext> = {}): CompletionContext => ({
  projectPath: '/test/project',
  agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
  workflows: ['feature', 'bugfix', 'refactor'],
  recentTasks: [
    { id: 'task_abc123', description: 'Implement authentication' },
    { id: 'task_def456', description: 'Fix payment bug' }
  ],
  inputHistory: [
    'fix the bug in payment',
    'add new feature',
    'run tests',
    'create component Button'
  ],
  ...overrides,
});
```

#### 3. Test Categories

**Provider Tests (Unit-ish Integration):**
- Each provider tested with trigger pattern matching
- Score verification for exact vs partial matches
- Edge cases (empty input, special characters)

**Tab Completion Tests (Component Integration):**
- Simulate keyboard events via `mockUseInput`
- Verify debounce timing
- Test smart replacement logic (command vs word context)

**Fuzzy Search Tests (Algorithm Integration):**
- Threshold boundary testing
- Multi-field search (value + description)
- Result ordering verification

#### 4. Test Data Constants

```typescript
const TEST_COMMANDS = [
  { name: '/help', desc: 'Show help', icon: '?' },
  { name: '/status', desc: 'Task status', icon: '📊' },
  // ... (full list from CompletionEngine.ts)
];

const TEST_AGENTS = ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'];

const TEST_WORKFLOWS = ['feature', 'bugfix', 'refactor'];
```

### Implementation Phases

**Phase 1: Provider Coverage (24 tests)**
- Command provider (4 tests)
- Session subcommand provider (3 tests)
- Path provider (5 tests)
- Agent provider (4 tests)
- Workflow provider (3 tests)
- Task ID provider (3 tests)
- History provider (4 tests)
- Task pattern provider (3 tests)

**Phase 2: Tab Completion Integration (12 tests)**
- Debounce timing verification (3 tests)
- Tab key behavior (4 tests)
- Arrow key navigation (3 tests)
- Smart replacement (2 tests)

**Phase 3: Fuzzy Search (8 tests)**
- Fuse.js threshold behavior (3 tests)
- Multi-field matching (2 tests)
- Combined engine + fuzzy results (3 tests)

**Phase 4: Context Integration (8 tests)**
- Dynamic context updates (3 tests)
- Session-context mapping (2 tests)
- Error handling (3 tests)

**Total: ~52 new tests**

### Technical Considerations

#### Debounce Testing Pattern

```typescript
it('should debounce completion requests', async () => {
  const engine = new CompletionEngine();
  const context = createTestContext();
  const spy = vi.spyOn(engine, 'getCompletions');

  // Simulate rapid input
  for (let i = 0; i < 5; i++) {
    // Component would call this
    setInput(`/hel${i}`);
    vi.advanceTimersByTime(50); // Less than debounceMs
  }

  // Should not have called engine yet
  expect(spy).not.toHaveBeenCalled();

  // Advance past debounce threshold
  vi.advanceTimersByTime(150);
  await vi.runAllTimersAsync();

  // Should have called only once with final input
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith('/hel4', expect.any(Number), context);
});
```

#### Fuzzy Search Testing Pattern

```typescript
it('should use fuzzy matching with configurable threshold', async () => {
  const suggestions = [
    { value: '/help', description: 'Show help' },
    { value: '/health', description: 'Health check' },
    { value: '/helicopter', description: 'Not a command' }
  ];

  // With default threshold (0.4), 'hlp' should match 'help'
  const fuse = new Fuse(suggestions, {
    keys: ['value', 'description'],
    threshold: 0.4,
    includeScore: true
  });

  const results = fuse.search('hlp');
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].item.value).toBe('/help');
});
```

## Consequences

### Positive
- Comprehensive coverage of all 8 completion providers
- Proper testing of debouncing behavior prevents flaky tests
- Fuzzy search edge cases documented through tests
- Context-aware completion behavior verified

### Negative
- Increased test execution time (~2-3 seconds for completion tests)
- Requires careful timer management with fake timers

### Risks
- File system mocking complexity for path completion
- Fuse.js version changes could affect threshold behavior

## Implementation Notes

### File Structure
Tests will be added to existing `v030-features.integration.test.tsx` in a new `describe('Completion Engine Integration', ...)` block after line 935.

### Dependencies
- Existing mocks: `fs/promises`, `zlib`, `ink`
- May need: `fuse.js` mock for controlled fuzzy search tests

### Metrics
- Target: 100% provider coverage
- Target: Debounce timing assertions pass consistently
- Target: All tests complete in < 5 seconds
