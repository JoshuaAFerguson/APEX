# ADR-052: Comprehensive Test Coverage for Configurable Response System

## Status
Proposed

## Context
The `MockClaudeAgentSDK` and related mock utilities in `packages/orchestrator/src/__tests__/mocks/` provide a configurable response system for testing Claude Agent SDK interactions. While the existing test files (`claude-agent-sdk.test.ts`, `test-utilities-demo.test.ts`, `claude-agent-sdk-integration.test.ts`) cover many scenarios, the acceptance criteria require comprehensive coverage for:

1. Static responses via builder
2. Dynamic handlers (conditional responses based on input)
3. Response sequences (first call returns X, second returns Y)
4. Delays per method
5. Mixed configurations

## Current Architecture Analysis

### Existing Components
```
packages/orchestrator/src/__tests__/mocks/
├── claude-agent-sdk.ts         # MockClaudeAgentSDK, MockResponseBuilder, StreamingResponseBuilder
├── claude-agent-sdk.types.ts   # Type definitions
├── claude-agent-sdk.test.ts    # Core unit tests
├── claude-agent-sdk-integration.test.ts  # Integration with ApexOrchestrator
├── test-utilities-demo.test.ts # Usage demonstrations
└── index.ts                    # Re-exports
```

### Current Capabilities
1. **Static Responses**: `addResponse({ content: 'text' })`
2. **Response Queues**: Sequential responses via `addResponse()` chain
3. **Default Fallbacks**: `setDefaultResponse()`
4. **Error Simulation**: `addError()` with predefined `MockErrors`
5. **Streaming**: `addStreamingResponse()` with delays

### Gap Analysis
| Feature | Status | Notes |
|---------|--------|-------|
| Static responses via builder | ✅ Covered | `MockResponseBuilder` exists |
| Dynamic handlers | ❌ Missing | No conditional logic based on input |
| Response sequences | ✅ Partial | Queue exists but explicit sequence testing needed |
| Delays per method | ✅ Partial | Streaming has delays, but not for non-streaming |
| Mixed configurations | ❌ Missing | No tests combining multiple features |

## Decision

### 1. Technical Design for New Test Coverage

#### A. Static Responses via Builder (Enhance Existing)
Add comprehensive tests for `MockResponseBuilder` covering all content types:
```typescript
describe('MockResponseBuilder Comprehensive', () => {
  it('should build all content block types')
  it('should support multiple content blocks in sequence')
  it('should handle requestId configuration')
  it('should support tool_result content type')
});
```

#### B. Dynamic Handlers (New Feature Required)
Extend `MockClaudeAgentSDK` to support dynamic response handlers:
```typescript
interface DynamicResponseHandler {
  (agent: SDKAgentDefinition, message: string, options?: QueryOptions):
    MockQueryResponse | Promise<MockQueryResponse>;
}

// In MockClaudeAgentSDK:
setDynamicHandler(handler: DynamicResponseHandler): this;
```

Test scenarios:
```typescript
describe('Dynamic Handlers', () => {
  it('should call handler with agent, message, and options')
  it('should support async handlers')
  it('should support conditional responses based on message content')
  it('should support conditional responses based on agent name')
  it('should fallback to queue/default when handler returns null')
});
```

#### C. Response Sequences (Explicit Testing)
Add explicit sequence testing with verification:
```typescript
describe('Response Sequences', () => {
  it('first call returns X, second returns Y - explicit verification')
  it('should handle N-call sequences with distinct responses')
  it('should verify call order via history')
  it('should transition from sequence to default after queue exhaustion')
  it('should support interleaved success/error sequences')
});
```

#### D. Delays Per Method (New Feature Required)
Extend `MockClaudeAgentSDK` to support non-streaming delays:
```typescript
interface MockQueryResponse {
  // ... existing fields
  delay?: number;  // Add delay support
}

// Or via fluent API:
addResponse(response: MockQueryResponse, options?: { delay?: number }): this;
```

Test scenarios:
```typescript
describe('Delays Per Method', () => {
  it('should delay non-streaming responses')
  it('should support different delays for different methods')
  it('should verify timing with tolerance')
  it('should not delay when no delay configured')
});
```

#### E. Mixed Configurations
Comprehensive tests combining multiple features:
```typescript
describe('Mixed Configurations', () => {
  it('should combine static responses with dynamic handler fallback')
  it('should combine sequences with delays')
  it('should combine streaming with non-streaming responses')
  it('should combine errors within sequences with recovery')
  it('should handle complex multi-agent workflow with mixed config')
});
```

### 2. Implementation Architecture

#### New Test File Structure
```
packages/orchestrator/src/__tests__/mocks/
├── claude-agent-sdk.ts                    # Enhanced with dynamic handlers + delays
├── claude-agent-sdk.types.ts              # Updated type definitions
├── claude-agent-sdk.test.ts               # Core tests (existing)
├── claude-agent-sdk.comprehensive.test.ts # NEW: Comprehensive coverage
├── claude-agent-sdk-integration.test.ts   # Integration tests (existing)
├── test-utilities-demo.test.ts            # Usage demos (existing)
└── index.ts                               # Re-exports
```

#### Type Extensions
```typescript
// claude-agent-sdk.types.ts additions
export interface ResponseOptions {
  delay?: number;  // Delay in milliseconds before returning
}

export type DynamicResponseHandler = (
  agent: SDKAgentDefinition,
  message: string,
  options?: QueryOptions
) => MockQueryResponse | StreamingEvent[] | Error | null | Promise<MockQueryResponse | StreamingEvent[] | Error | null>;
```

#### MockClaudeAgentSDK Extensions
```typescript
// claude-agent-sdk.ts additions
class MockClaudeAgentSDK {
  private dynamicHandler: DynamicResponseHandler | null = null;
  private responseDelays: Map<number, number> = new Map(); // index -> delay

  // New methods
  setDynamicHandler(handler: DynamicResponseHandler): this {
    this.dynamicHandler = handler;
    return this;
  }

  addResponseWithDelay(response: MockQueryResponse, delay: number): this {
    const index = this.queryResponses.length;
    this.queryResponses.push(response);
    this.responseDelays.set(index, delay);
    return this;
  }

  // Updated setupQueryMock to support dynamic handlers and delays
  private async setupQueryMock(): void {
    this.queryMock.mockImplementation(async (agent, message, options) => {
      // 1. Try dynamic handler first
      if (this.dynamicHandler) {
        const dynamicResponse = await this.dynamicHandler(agent, message, options);
        if (dynamicResponse !== null) {
          return this.createAsyncIterator(dynamicResponse);
        }
      }

      // 2. Try queued response
      const responseIndex = this.consumedCount++;
      const response = this.queryResponses.shift() ?? this.defaultResponse ?? { content: 'Mock response' };

      // 3. Apply delay if configured
      const delay = this.responseDelays.get(responseIndex);
      if (delay) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // 4. Handle errors
      if (response instanceof Error) throw response;

      return this.createAsyncIterator(response);
    });
  }
}
```

### 3. Test Implementation Plan

#### Phase 1: Extend Core Types and Classes
1. Update `claude-agent-sdk.types.ts` with new interfaces
2. Update `MockClaudeAgentSDK` with new methods
3. Ensure backward compatibility with existing tests

#### Phase 2: Create Comprehensive Test File
Create `claude-agent-sdk.comprehensive.test.ts` with:

```typescript
/**
 * Comprehensive test coverage for MockClaudeAgentSDK configurable response system
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockClaudeAgentSDK,
  MockResponseBuilder,
  StreamingResponseBuilder,
  MockErrors
} from './claude-agent-sdk';
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

vi.mock('@anthropic-ai/claude-agent-sdk');

describe('Configurable Response System - Comprehensive Tests', () => {
  // Test suites for each acceptance criterion

  describe('1. Static Responses via Builder', () => {
    // Comprehensive MockResponseBuilder tests
  });

  describe('2. Dynamic Handlers', () => {
    // Conditional response tests
  });

  describe('3. Response Sequences', () => {
    // Explicit sequence verification tests
  });

  describe('4. Delays Per Method', () => {
    // Timing verification tests
  });

  describe('5. Mixed Configurations', () => {
    // Complex scenario tests
  });
});
```

#### Phase 3: Verify All Tests Pass
1. Run `npm run build` to ensure no TypeScript errors
2. Run `npm run test` to verify all tests pass
3. Document any edge cases discovered

### 4. Acceptance Criteria Mapping

| Criterion | Test Suite | Test Count |
|-----------|------------|------------|
| Static responses via builder | `1. Static Responses via Builder` | 8 tests |
| Dynamic handlers | `2. Dynamic Handlers` | 6 tests |
| Response sequences | `3. Response Sequences` | 5 tests |
| Delays per method | `4. Delays Per Method` | 4 tests |
| Mixed configurations | `5. Mixed Configurations` | 5 tests |

**Total new tests: ~28 tests**

## Consequences

### Positive
- Complete test coverage for configurable response system
- Better documentation through comprehensive test examples
- More robust mock utilities for future test development
- Clear patterns for testing complex agent workflows

### Negative
- Increases test maintenance burden
- Extends test execution time (especially with delay tests)
- Requires careful backward compatibility management

### Mitigation
- Use `vi.useFakeTimers()` for delay tests to avoid actual wait times
- Group timing-sensitive tests separately
- Maintain existing test file structure to avoid breaking changes

## Implementation Notes for Developer Stage

1. **Start with type definitions** - Update `claude-agent-sdk.types.ts` first
2. **Extend MockClaudeAgentSDK incrementally** - Add one feature at a time
3. **Write tests alongside implementation** - TDD approach
4. **Use fake timers** - For delay tests to avoid slow test execution
5. **Maintain backward compatibility** - All existing tests must continue to pass

## Related ADRs
- None directly related

## References
- `packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.ts` - Main mock implementation
- `packages/orchestrator/src/__tests__/mocks/claude-agent-sdk.test.ts` - Existing tests
- `packages/orchestrator/src/__tests__/mocks/test-utilities-demo.test.ts` - Usage patterns
