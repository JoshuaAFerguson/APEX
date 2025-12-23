# ADR-047: Agent and Workflow Completion Integration Tests

## Status
Proposed

## Date
2024-12-19

## Context

APEX needs integration tests to verify that agent and workflow completions work correctly in the CLI. The acceptance criteria require:

1. Tests verify: typing `@` triggers agent completions
2. Tests verify: typing `--workflow` triggers workflow completions
3. Tests verify: agents include proper descriptions
4. Tests verify: custom agents/workflows from context work

The existing codebase has:
- `CompletionEngine` service with provider-based architecture
- Unit tests in `CompletionEngine.test.ts` covering individual providers
- Integration tests in `completion.integration.test.tsx` covering UI integration
- Test utilities in `test-utils.tsx` for React component testing

## Decision

### Test File Location

Create a new integration test file:
```
packages/cli/src/__tests__/agent-workflow-completion.integration.test.ts
```

This follows the existing pattern of having focused integration tests for specific completion features (e.g., `command-completion.integration.test.tsx`, `session-subcommand-completion.test.ts`).

### Test Architecture

#### 1. Test Structure

The tests will be organized into focused describe blocks:

```typescript
describe('Agent and Workflow Completion Integration Tests', () => {
  describe('Agent Completion Trigger (@)', () => { ... })
  describe('Agent Descriptions', () => { ... })
  describe('Custom Agents from Context', () => { ... })
  describe('Workflow Completion Trigger (--workflow)', () => { ... })
  describe('Workflow Descriptions', () => { ... })
  describe('Custom Workflows from Context', () => { ... })
  describe('Combined Agent and Workflow Scenarios', () => { ... })
})
```

#### 2. Test Context Setup

Use a mock `CompletionContext` that includes both default and custom agents/workflows:

```typescript
interface TestSetup {
  mockContext: CompletionContext;
  engine: CompletionEngine;
}

const createTestContext = (overrides?: Partial<CompletionContext>): CompletionContext => ({
  projectPath: '/test/project',
  agents: ['planner', 'architect', 'developer', 'reviewer', 'tester', 'devops'],
  workflows: ['feature', 'bugfix', 'refactor'],
  recentTasks: [],
  inputHistory: [],
  ...overrides,
});
```

#### 3. Test Categories

**Category 1: Agent Completion Trigger Tests**
- `@` alone triggers all agent suggestions
- `@p` filters to agents starting with "p"
- `@plan` shows exact and partial matches
- Agent completion works mid-sentence (e.g., "ask @dev for help")
- Case-insensitive matching

**Category 2: Agent Description Tests**
- Default agents have predefined descriptions:
  - `planner`: "Creates implementation plans"
  - `architect`: "Designs system architecture"
  - `developer`: "Writes production code"
  - `reviewer`: "Reviews code quality"
  - `tester`: "Creates and runs tests"
  - `devops`: "Handles infrastructure"
- Descriptions are included in `CompletionSuggestion.description`
- Icons are present (`🤖`)

**Category 3: Custom Agent Tests**
- Custom agents from context are suggested
- Custom agents use fallback description format: "Agent: {name}"
- Mixed default and custom agents work together
- Empty agent list returns no suggestions

**Category 4: Workflow Completion Trigger Tests**
- `--workflow ` triggers workflow suggestions
- `--workflow f` filters to workflows starting with "f"
- Workflow completion requires the `--workflow` prefix
- Workflow value is suggested (not `--workflow value`)

**Category 5: Workflow Description Tests**
- Default workflows have predefined descriptions:
  - `feature`: "Full feature implementation"
  - `bugfix`: "Bug investigation and fix"
  - `refactor`: "Code refactoring"
- Descriptions are included in `CompletionSuggestion.description`
- Icons are present (`⚙️`)

**Category 6: Custom Workflow Tests**
- Custom workflows from context are suggested
- Custom workflows use fallback description format: "Workflow: {name}"
- Mixed default and custom workflows work together
- Empty workflow list returns no suggestions

**Category 7: Combined Scenario Tests**
- Input with both `@agent` and `--workflow` triggers both providers
- Score ordering ensures proper prioritization
- Deduplication works across provider types

#### 4. Test Patterns

**Direct Engine Testing (Primary Pattern):**
```typescript
it('should trigger agent completions on @ prefix', async () => {
  const engine = new CompletionEngine();
  const context = createTestContext();

  const results = await engine.getCompletions('@', 1, context);

  expect(results.length).toBeGreaterThan(0);
  expect(results.every(r => r.type === 'agent')).toBe(true);
  expect(results.every(r => r.value.startsWith('@'))).toBe(true);
});
```

**Context Variation Testing:**
```typescript
it('should include custom agents from context', async () => {
  const engine = new CompletionEngine();
  const context = createTestContext({
    agents: ['planner', 'my-custom-agent', 'qa-specialist'],
  });

  const results = await engine.getCompletions('@', 1, context);

  expect(results).toContainEqual(
    expect.objectContaining({
      value: '@my-custom-agent',
      description: 'Agent: my-custom-agent',
    })
  );
});
```

**Description Verification Testing:**
```typescript
it('should provide proper descriptions for default agents', async () => {
  const engine = new CompletionEngine();
  const context = createTestContext();

  const results = await engine.getCompletions('@planner', 8, context);

  expect(results).toContainEqual(
    expect.objectContaining({
      value: '@planner',
      description: 'Creates implementation plans',
      icon: '🤖',
    })
  );
});
```

#### 5. Mocking Strategy

Since these are integration tests focused on the CompletionEngine behavior rather than UI, minimal mocking is required:

```typescript
// No fs/promises mock needed for agent/workflow completions
// No os mock needed for agent/workflow completions
// Direct testing of CompletionEngine.getCompletions()
```

#### 6. Test Data

**Default Agents with Descriptions:**
```typescript
const defaultAgentDescriptions: Record<string, string> = {
  planner: 'Creates implementation plans',
  architect: 'Designs system architecture',
  developer: 'Writes production code',
  reviewer: 'Reviews code quality',
  tester: 'Creates and runs tests',
  devops: 'Handles infrastructure',
};
```

**Default Workflows with Descriptions:**
```typescript
const defaultWorkflowDescriptions: Record<string, string> = {
  feature: 'Full feature implementation',
  bugfix: 'Bug investigation and fix',
  refactor: 'Code refactoring',
};
```

### File Structure

```
packages/cli/src/__tests__/
├── agent-workflow-completion.integration.test.ts  # NEW - Focus of this ADR
├── completion.integration.test.tsx                # Existing UI integration
├── command-completion.integration.test.tsx        # Existing command tests
├── session-subcommand-completion.test.ts          # Existing session tests
├── tab-completion-acceptance.test.tsx             # Existing acceptance tests
└── test-utils.tsx                                 # Existing test utilities
```

## Consequences

### Positive

1. **Focused Testing**: Dedicated tests for agent/workflow completions make it easy to verify specific acceptance criteria
2. **Maintainability**: Separate test file keeps tests organized and easy to find
3. **Pattern Consistency**: Follows existing test patterns in the codebase
4. **Low Mocking Overhead**: Direct engine testing requires minimal mocking
5. **Clear Verification**: Each acceptance criterion maps to specific test cases

### Negative

1. **Test Overlap**: Some overlap with existing unit tests in `CompletionEngine.test.ts`
2. **Maintenance Burden**: Additional test file to maintain

### Mitigation

- Integration tests focus on end-to-end behavior validation
- Unit tests focus on edge cases and error handling
- Clear naming distinguishes integration vs unit tests

## Implementation Notes

### Test Implementation Order

1. Create test file with describe structure
2. Implement agent trigger tests (AC1)
3. Implement workflow trigger tests (AC2)
4. Implement agent description tests (AC3)
5. Implement custom agent/workflow context tests (AC4)
6. Add combined scenario tests

### Dependencies

- `vitest` - Test framework
- `CompletionEngine` - SUT (System Under Test)
- `CompletionContext` - Test context interface

### Test Commands

```bash
# Run all completion tests
npm test --workspace=@apexcli/cli -- --grep "completion"

# Run only agent/workflow integration tests
npm test --workspace=@apexcli/cli -- src/__tests__/agent-workflow-completion.integration.test.ts
```

## References

- Existing test patterns: `packages/cli/src/__tests__/*.test.ts`
- CompletionEngine implementation: `packages/cli/src/services/CompletionEngine.ts`
- Unit tests: `packages/cli/src/services/__tests__/CompletionEngine.test.ts`
