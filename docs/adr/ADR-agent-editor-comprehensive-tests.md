# ADR: Comprehensive Test Architecture for Agent Configuration Editor

## Status
Proposed

## Context
The task requires adding comprehensive tests for the agent configuration editor, including:
- Unit tests for AgentForm validation
- AgentPreview rendering tests
- Integration tests for the full editor flow

An analysis of the existing codebase reveals that extensive test coverage already exists, but there are gaps in certain areas and some existing tests are failing.

## Current Test Architecture

### Existing Test Files

#### AgentForm Component Tests (`packages/web-ui/src/components/forms/__tests__/`)
| File | Coverage | Status |
|------|----------|--------|
| `AgentForm.test.tsx` | Unit tests: rendering, validation, interactions, loading, accessibility, edge cases, defaults | Some failures |
| `AgentForm.integration.test.tsx` | Complete workflows, validation scenarios, character counters, state persistence, error recovery | Some failures |
| `AgentForm.edge-cases.test.tsx` | Boundary values, invalid data, performance, async, browser compat, accessibility edge cases, cleanup | Some failures |

#### AgentPreview Component Tests (`packages/web-ui/src/components/agent-editor/__tests__/`)
| File | Coverage | Status |
|------|----------|--------|
| `AgentPreview.test.tsx` | Main component: rendering, content generation, copy/download, props, error handling | Passing |
| `AgentPreview.integration.test.tsx` | Full workflow, real-time updates, copy-paste, download, format validation, edge cases | Passing |
| `AgentPreview.unit.test.tsx` | Hook testing (useAgentMarkdown), serializer utilities, markdown format | Passing |
| `AgentPreview.edge-cases.test.tsx` | Boundary conditions, special characters, array handling, filename generation, model field, key sorting | Passing |
| `AgentPreview.minimal.test.tsx` | Minimal rendering tests | Passing |

### Validation Schema (`packages/web-ui/src/lib/schemas/agent-schema.ts`)
- Zod-based validation with comprehensive rules
- Exported validation limits and error messages
- Helper functions: `validateAgentForm`, `parseAgentForm`, `getFormErrors`

## Analysis of Gaps

### 1. AgentForm Test Failures
Current test failures are primarily related to:
- **Validation error message assertions**: Tests expect specific error messages that don't match the actual Zod schema messages
- **Async timing issues**: `waitFor` timeouts on validation feedback
- **Form submission behavior**: Edge cases around empty form submission

### 2. Missing Coverage Areas

#### A. Full Editor Flow Integration Tests
The `AgentConfigEditor.architecture.md` describes a complete editor component that combines `AgentForm` + `AgentPreview`, but tests for this integrated flow don't exist yet:
- Create mode workflow
- Edit mode workflow
- Cancel/dirty state handling
- API integration

#### B. API Integration Tests
While backend API tests exist (`packages/api/src/__tests__/agents-crud-integration.test.ts`), frontend API client tests are minimal:
- Create agent API calls
- Update agent API calls
- Error handling for network failures
- Retry logic

#### C. User Interaction Integration
- Keyboard shortcuts (Ctrl+S for save)
- Tab navigation between form and preview (mobile)
- Focus management on errors
- Screen reader announcements

## Technical Design

### Test Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E Tests (Playwright)                       │
│  - Full page flows: /agents/new, /agents/[name]/edit            │
│  - Cross-browser verification                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                  Integration Tests (Vitest + RTL)                │
│  - AgentConfigEditor full flow with mocked API                  │
│  - Form + Preview synchronization                               │
│  - Save/cancel workflows                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↑
┌─────────────────────────────────────────────────────────────────┐
│                    Unit Tests (Vitest + RTL)                     │
│  - AgentForm: validation, field interactions, state             │
│  - AgentPreview: rendering, copy/download, content generation   │
│  - Hooks: useAgentMarkdown, useAgentEditor                      │
│  - Utils: agent-serializer, validation helpers                  │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Test Structure

```
packages/web-ui/src/
├── components/
│   ├── forms/__tests__/
│   │   ├── AgentForm.test.tsx              # Unit tests (fix existing)
│   │   ├── AgentForm.integration.test.tsx  # Integration tests (fix existing)
│   │   └── AgentForm.edge-cases.test.tsx   # Edge cases (fix existing)
│   │
│   └── agent-editor/__tests__/
│       ├── AgentPreview.test.tsx           # Unit tests (passing)
│       ├── AgentPreview.integration.test.tsx # Integration (passing)
│       ├── AgentPreview.unit.test.tsx      # Hook/util tests (passing)
│       ├── AgentPreview.edge-cases.test.tsx # Edge cases (passing)
│       ├── AgentPreview.minimal.test.tsx   # Minimal tests (passing)
│       ├── AgentConfigEditor.test.tsx      # NEW: Editor unit tests
│       ├── AgentConfigEditor.integration.test.tsx # NEW: Full flow tests
│       └── agent-serializer.test.ts        # Serializer tests (existing)
│
├── hooks/__tests__/
│   └── useAgentEditor.test.tsx             # NEW: Hook tests
│
└── lib/schemas/__tests__/
    └── agent-schema.test.ts                # NEW: Schema validation tests
```

### Test Categories and Coverage Matrix

| Category | Component | Tests | Priority |
|----------|-----------|-------|----------|
| **Form Validation** | AgentForm | name format, required fields, length limits, real-time feedback | P0 |
| **Preview Rendering** | AgentPreview | markdown generation, YAML format, content updates | P0 |
| **Copy/Download** | AgentPreview | clipboard, file download, success feedback | P1 |
| **Editor Integration** | AgentConfigEditor | form-preview sync, save/cancel, mode switching | P0 |
| **API Integration** | useAgentEditor | create/update calls, error handling, loading states | P1 |
| **Accessibility** | All | ARIA, keyboard nav, screen reader | P1 |
| **Error Handling** | All | network errors, validation errors, recovery | P1 |
| **Performance** | All | large data, rapid updates | P2 |
| **Edge Cases** | All | boundary values, special chars, unicode | P2 |

### Fix Strategy for Existing Failures

#### 1. AgentForm.test.tsx
**Issue**: Validation error messages don't match
**Fix**: Update test assertions to match actual Zod schema messages:
```typescript
// Current (failing):
expect(screen.getByText('Name must be at least 1 character')).toBeInTheDocument()

// Fixed (match schema):
expect(screen.getByText(AGENT_VALIDATION_MESSAGES.NAME_TOO_SHORT)).toBeInTheDocument()
```

#### 2. AgentForm.integration.test.tsx
**Issue**: Async timing on form submission
**Fix**:
- Increase `waitFor` timeouts where needed
- Use `findBy` queries for async elements
- Add proper `act()` wrapping for state updates

#### 3. AgentForm.edge-cases.test.tsx
**Issue**: Browser API mocking incomplete
**Fix**:
- Ensure consistent mock setup in `beforeEach`
- Restore mocks in `afterEach`
- Handle async cleanup

### New Test Files to Create

#### 1. `AgentConfigEditor.test.tsx` - Unit Tests
```typescript
describe('AgentConfigEditor', () => {
  describe('Rendering', () => {
    it('renders in create mode with empty form')
    it('renders in edit mode with provided data')
    it('shows loading state while fetching agent')
    it('shows error state on fetch failure')
  })

  describe('Form-Preview Synchronization', () => {
    it('updates preview when form changes')
    it('shows validation status in preview header')
    it('generates correct filename from agent name')
  })

  describe('Layout', () => {
    it('shows side-by-side layout on desktop')
    it('shows tab layout on mobile')
    it('switches tabs correctly on mobile')
  })
})
```

#### 2. `AgentConfigEditor.integration.test.tsx` - Full Flow Tests
```typescript
describe('AgentConfigEditor Integration', () => {
  describe('Create Mode Workflow', () => {
    it('completes full create workflow successfully')
    it('shows validation errors on invalid submission')
    it('handles API errors gracefully')
    it('navigates away on successful create')
  })

  describe('Edit Mode Workflow', () => {
    it('loads existing agent data')
    it('detects dirty state on changes')
    it('shows confirmation on cancel with changes')
    it('updates agent successfully')
  })

  describe('Cancel Flow', () => {
    it('navigates away immediately if no changes')
    it('shows confirmation dialog if dirty')
    it('stays on page if user cancels confirmation')
  })
})
```

#### 3. `useAgentEditor.test.tsx` - Hook Tests
```typescript
describe('useAgentEditor', () => {
  describe('State Management', () => {
    it('initializes with default state in create mode')
    it('loads data in edit mode')
    it('tracks dirty state correctly')
    it('validates form on changes')
  })

  describe('Actions', () => {
    it('updates form data')
    it('saves successfully')
    it('handles save errors')
    it('cancels editing')
  })
})
```

#### 4. `agent-schema.test.ts` - Validation Schema Tests
```typescript
describe('AgentFormSchema', () => {
  describe('Name Validation', () => {
    it('accepts valid lowercase names')
    it('accepts names with numbers and hyphens')
    it('rejects uppercase letters')
    it('rejects special characters')
    it('rejects empty string')
    it('enforces max length')
  })

  describe('Description Validation', () => {
    it('requires non-empty description')
    it('enforces max length')
    it('allows special characters')
  })

  describe('Prompt Validation', () => {
    it('enforces minimum length')
    it('enforces maximum length')
    it('allows multiline content')
  })

  describe('Model Validation', () => {
    it('accepts valid models: opus, sonnet, haiku, inherit')
    it('defaults to sonnet')
    it('rejects invalid models')
  })

  describe('Tools/Skills Arrays', () => {
    it('defaults to empty arrays')
    it('enforces max items')
    it('rejects empty string items')
  })
})
```

### Mock Strategy

#### API Mocks
```typescript
// test-utils/api-mocks.ts
export const mockApiClient = {
  getAgent: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
}

export const mockSuccessfulCreate = () => {
  mockApiClient.createAgent.mockResolvedValue({
    ok: true,
    agent: { name: 'test-agent', /* ... */ }
  })
}

export const mockNetworkError = () => {
  mockApiClient.createAgent.mockRejectedValue(new Error('Network error'))
}
```

#### Clipboard/Download Mocks
```typescript
// test-utils/browser-mocks.ts
export const setupClipboardMock = () => {
  const writeText = vi.fn(() => Promise.resolve())
  Object.assign(navigator, { clipboard: { writeText } })
  return writeText
}

export const setupDownloadMock = () => {
  const mockLink = { href: '', download: '', click: vi.fn() }
  // ... setup
  return mockLink
}
```

### Test Utilities to Create

```typescript
// test-utils/agent-test-utils.ts

export const validAgentData: AgentFormData = {
  name: 'test-agent',
  description: 'A test agent for testing purposes',
  prompt: 'You are a helpful assistant that helps with testing.',
  model: 'sonnet',
  tools: ['Read', 'Write'],
  skills: ['typescript', 'react'],
}

export const mockTools: MultiSelectOption[] = [
  { value: 'Read', label: 'Read Files' },
  { value: 'Write', label: 'Write Files' },
  { value: 'Bash', label: 'Execute Commands' },
]

export const mockSkills: MultiSelectOption[] = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'react', label: 'React' },
]

export const renderAgentForm = (props?: Partial<AgentFormProps>) => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    availableTools: mockTools,
    availableSkills: mockSkills,
  }
  return render(<AgentForm {...defaultProps} {...props} />)
}

export const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByTestId('name-input'), 'test-agent')
  await user.type(screen.getByTestId('description-textarea'), 'Test description')
  await user.type(screen.getByTestId('prompt-textarea'), 'Test prompt with enough characters')
}
```

## Decision

### Phase 1: Fix Existing Test Failures (Immediate)
1. Update AgentForm test assertions to match Zod schema error messages
2. Fix async timing issues with proper waitFor/findBy usage
3. Ensure all 127 agent-related tests pass

### Phase 2: Add Missing Coverage (Short-term)
1. Create `agent-schema.test.ts` for validation schema coverage
2. Create `useAgentEditor.test.tsx` for hook logic
3. Create `AgentConfigEditor.test.tsx` for editor unit tests

### Phase 3: Integration Tests (Medium-term)
1. Create `AgentConfigEditor.integration.test.tsx` for full flow
2. Add E2E tests with Playwright for critical paths

### Testing Guidelines
1. **Use consistent test data** via shared fixtures
2. **Import validation messages** from schema instead of hardcoding
3. **Proper async handling** with appropriate timeouts
4. **Clean mock setup/teardown** per test
5. **Descriptive test names** following pattern: "should [action] when [condition]"

## Consequences

### Positive
- Comprehensive coverage across validation, rendering, and integration
- Consistent test patterns across the codebase
- Shared utilities reduce test code duplication
- Clear test structure aids maintainability

### Negative
- Initial effort to fix existing failures
- Additional test files to maintain
- Potential for increased test runtime

### Mitigation
- Use `describe.skip` for flaky tests while fixing
- Parallelize tests where possible
- Create reusable test utilities to reduce maintenance burden

## Related
- `AgentConfigEditor.architecture.md` - Component architecture
- `agent-schema.ts` - Validation schema
- `packages/api/src/__tests__/agents-crud-integration.test.ts` - Backend API tests
