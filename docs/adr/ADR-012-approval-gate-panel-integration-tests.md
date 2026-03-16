# ADR-012: ApprovalGatePanel Integration Test Architecture

## Status
Accepted

## Date
2024-01-15

## Context

The ApprovalGatePanel component requires comprehensive integration tests that verify:
1. Loading pending gates from API
2. Approve/reject flows with confirmation dialogs
3. WebSocket event updates for real-time gate state changes
4. Error handling for API failures and network issues
5. Accessibility compliance (WCAG 2.1 AA)

The component types are defined in:
- `packages/web-ui/src/types/approval-gate-panel.ts`
- `packages/web-ui/src/types/approval-gate-panel-constants.ts`

We have established patterns from similar integration tests:
- `ActiveTasksPanelRealtime.integration.test.tsx` - WebSocket mocking
- `websocket-client.integration.test.ts` - Connection state testing
- `PerformanceMetricsPanel.accessibility.test.tsx` - Accessibility with jest-axe
- `DiffViewer.accessibility.test.tsx` - Keyboard navigation patterns

## Decision

We will create a comprehensive integration test suite for ApprovalGatePanel following established patterns with these architectural decisions:

### 1. Test File Organization

```
packages/web-ui/src/components/approval/
  __tests__/
    ApprovalGatePanel.integration.test.tsx    # Main integration tests
    ApprovalGatePanel.accessibility.test.tsx  # Dedicated accessibility tests
    test-utils.ts                              # Test utilities and factories
```

### 2. Mock Architecture

#### WebSocket Mocking Pattern
Following `ActiveTasksPanelRealtime.integration.test.tsx`, we use controllable mock state:

```typescript
// Controllable mock state
let mockRealtimeState: ApprovalGateRealtimeState = {
  connectionState: 'disconnected',
  pendingGates: [],
  resolvedGates: [],
  isConnected: false,
  error: null,
}

// Mock hook with state-driven behavior
vi.mock('../../../lib/useApprovalGateRealtime', () => ({
  useApprovalGateRealtime: vi.fn(() => ({
    state: mockRealtimeState,
    ...mockActions,
  })),
}))
```

#### API Client Mocking Pattern
Following `api-client.ts` patterns:

```typescript
const mockApiClient = {
  approveGate: vi.fn().mockResolvedValue(undefined),
  rejectGate: vi.fn().mockResolvedValue(undefined),
  getTask: vi.fn().mockResolvedValue({ task: mockTask }),
}

vi.mock('../../../lib/api-client', () => ({
  apiClient: mockApiClient,
}))
```

### 3. Test Data Factories

Located in `test-utils.ts`:

```typescript
// Factory functions for consistent test data
export function createMockPendingGate(overrides?: Partial<PendingApprovalGate>): PendingApprovalGate
export function createMockResolvedGate(overrides?: Partial<ResolvedApprovalGate>): ResolvedApprovalGate
export function createMockGateWebSocketEvent(type: ApprovalGateEventType, overrides?: Partial<ApprovalGateWebSocketEvent>): ApprovalGateWebSocketEvent
export function createMockDiffData(overrides?: Partial<ApprovalDiffData>): ApprovalDiffData
```

### 4. Test Categories

#### Integration Tests (`ApprovalGatePanel.integration.test.tsx`)

| Category | Test Coverage |
|----------|---------------|
| **Loading States** | Initial loading, empty state, error states |
| **Gate Display** | Pending gates list, resolved gates history, diff preview |
| **Approve Flow** | Click approve, confirmation dialog, API call, success feedback |
| **Reject Flow** | Click reject, require comment, confirmation, API call |
| **WebSocket Events** | gate:required, gate:approved, gate:rejected, gate:timeout |
| **Connection States** | Connected, disconnected, reconnecting, error recovery |
| **Error Handling** | Network errors, API errors, timeout errors |
| **Performance** | Large gate lists, rapid events |

#### Accessibility Tests (`ApprovalGatePanel.accessibility.test.tsx`)

| Category | Test Coverage |
|----------|---------------|
| **axe Compliance** | No violations in all states |
| **Keyboard Navigation** | Tab order, Enter/Space activation, Escape to cancel |
| **Screen Reader** | ARIA labels, live regions, state announcements |
| **Focus Management** | Focus trapping in dialog, focus restoration |
| **High Contrast** | Sufficient contrast ratios, focus indicators |

### 5. Key Test Patterns

#### State Transition Testing
```typescript
it('should update UI when gate is approved via WebSocket', async () => {
  // Initial state with pending gate
  mockState.pendingGates = [createMockPendingGate({ id: 'gate-1' })]

  const { rerender } = render(<ApprovalGatePanel {...defaultProps} />)
  expect(screen.getByTestId('gate-item-gate-1')).toBeInTheDocument()

  // Simulate WebSocket event
  act(() => {
    mockState.pendingGates = []
    mockState.resolvedGates = [createMockResolvedGate({
      id: 'gate-1',
      status: 'approved'
    })]
  })

  rerender(<ApprovalGatePanel {...defaultProps} />)

  // Verify transition
  expect(screen.queryByTestId('pending-gates-list')).toHaveTextContent('No pending')
  expect(screen.getByTestId('resolved-gates-list')).toContainElement(
    screen.getByText(/approved/i)
  )
})
```

#### Confirmation Dialog Testing
```typescript
it('should require confirmation before rejecting a gate', async () => {
  const user = userEvent.setup()
  render(<ApprovalGatePanel {...propsWithPendingGates} />)

  // Click reject
  await user.click(screen.getByTestId('reject-button-gate-1'))

  // Verify dialog opens
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByText(/provide a reason/i)).toBeInTheDocument()

  // Try to confirm without comment
  await user.click(screen.getByRole('button', { name: /confirm/i }))
  expect(screen.getByText(/comment required/i)).toBeInTheDocument()

  // Add comment and confirm
  await user.type(screen.getByTestId('comment-input'), 'Needs revision')
  await user.click(screen.getByRole('button', { name: /confirm/i }))

  expect(mockApiClient.rejectGate).toHaveBeenCalledWith(
    'task-123',
    'gate-1',
    expect.objectContaining({ comment: 'Needs revision' })
  )
})
```

#### Accessibility Testing with axe
```typescript
it('should have no accessibility violations', async () => {
  const { container } = render(
    <ApprovalGatePanel {...propsWithPendingGates} />
  )

  const results = await axe(container)
  expect(results).toHaveNoViolations()
})

it('should support keyboard navigation', async () => {
  const user = userEvent.setup()
  render(<ApprovalGatePanel {...propsWithPendingGates} />)

  // Tab to first gate item
  await user.tab()
  expect(screen.getByTestId('gate-item-gate-1')).toHaveFocus()

  // Tab to approve button
  await user.tab()
  expect(screen.getByTestId('approve-button-gate-1')).toHaveFocus()

  // Activate with Enter
  await user.keyboard('{Enter}')
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  // Escape to close
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
```

### 6. Mocked Components Strategy

Following existing patterns, we mock child components to isolate testing:

```typescript
// Mock DiffViewer component
vi.mock('../../diff/DiffViewer', () => ({
  DiffViewer: ({ diff, ...props }: any) => (
    <div data-testid="diff-viewer" data-diff={diff} {...props}>
      Mock Diff Viewer
    </div>
  ),
}))

// Mock WebSocketConnectionIndicator
vi.mock('../../connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ size }: any) => (
    <div
      data-testid="connection-indicator"
      data-connection-status={mockState.isConnected ? 'connected' : 'disconnected'}
    />
  ),
}))
```

### 7. Test IDs Convention

Using constants from `approval-gate-panel-constants.ts`:

| Test ID | Component |
|---------|-----------|
| `approval-gate-panel` | Main panel container |
| `pending-gates-list` | List of pending gates |
| `resolved-gates-list` | History of resolved gates |
| `gate-item-{id}` | Individual gate item |
| `approve-button-{id}` | Approve button for gate |
| `reject-button-{id}` | Reject button for gate |
| `confirmation-dialog` | Confirmation modal |
| `comment-input` | Comment textarea in dialog |
| `confirm-button` | Confirm action button |
| `cancel-button` | Cancel dialog button |
| `diff-preview-{id}` | Diff preview section |
| `loading-indicator` | Loading spinner |
| `error-message` | Error display |
| `connection-indicator` | WebSocket status |

### 8. Error Scenario Coverage

```typescript
const ERROR_SCENARIOS = [
  { name: 'network error', error: new Error('Network connection failed') },
  { name: 'timeout', error: new Error('Request timed out') },
  { name: 'unauthorized', error: new ApiError('Unauthorized', 401) },
  { name: 'gate not found', error: new ApiError('Gate not found', 404) },
  { name: 'server error', error: new ApiError('Internal server error', 500) },
]

describe.each(ERROR_SCENARIOS)('Error handling: $name', ({ error }) => {
  it('should display error message and allow retry', async () => {
    mockApiClient.approveGate.mockRejectedValueOnce(error)
    // ... test implementation
  })
})
```

## Consequences

### Positive
- Comprehensive coverage of all acceptance criteria
- Follows established patterns making tests maintainable
- Accessibility testing ensures WCAG 2.1 AA compliance
- Clear separation between integration and accessibility tests
- Reusable test utilities for future component tests

### Negative
- Mock complexity for WebSocket state management
- Tests may be slower due to userEvent and waitFor patterns
- Need to keep mocks in sync with actual API client

### Mitigations
- Use vi.useFakeTimers() where appropriate
- Clear mock state in beforeEach to prevent test pollution
- Document mock update requirements in contributing guide

## References
- `packages/web-ui/src/types/approval-gate-panel.ts`
- `packages/web-ui/src/types/approval-gate-panel-constants.ts`
- `packages/web-ui/src/components/tasks/__tests__/ActiveTasksPanelRealtime.integration.test.tsx`
- `packages/web-ui/src/components/dashboard/__tests__/PerformanceMetricsPanel.accessibility.test.tsx`
- `packages/web-ui/src/lib/api-client.ts`
