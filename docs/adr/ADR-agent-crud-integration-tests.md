# ADR: Agent CRUD Integration Tests Architecture

**Date**: 2024-03-16
**Status**: Proposed
**Decision Makers**: Architecture Team

## Context

The APEX orchestrator provides comprehensive agent CRUD operations (`createAgent`, `updateAgent`, `deleteAgent`, `getAgent`, `getAgents`), but the API layer currently only exposes a single `GET /agents` endpoint. We need to:

1. Add missing API endpoints for full CRUD support
2. Create comprehensive integration tests that verify the full CRUD flow
3. Test edge cases including duplicate names, invalid data, and special characters

## Current State Analysis

### Orchestrator Layer (packages/orchestrator)
- **createAgent(agent: AgentDefinition)**: Saves agent to disk, updates cache, emits `agent:created` event
- **updateAgent(name, updates)**: Validates existence, prevents name changes, emits `agent:updated` event
- **deleteAgent(name)**: Validates existence, removes from disk and cache, emits `agent:deleted` event
- **getAgent(name)**: Returns single agent or null
- **getAgents()**: Returns all agents as Record<string, AgentDefinition>

### API Layer (packages/api)
- **Existing**: `GET /agents` - Lists all agents
- **Missing**: `POST /agents`, `GET /agents/:name`, `PUT /agents/:name`, `DELETE /agents/:name`

### AgentDefinition Schema
```typescript
{
  name: string,           // Required, unique identifier
  description: string,    // Required
  prompt: string,         // Required
  tools?: string[],       // Optional
  model?: AgentModel,     // Optional, defaults to 'sonnet'
  skills?: string[]       // Optional
}
```

## Decision

### 1. API Endpoint Design

| Method | Endpoint | Purpose | Status Code |
|--------|----------|---------|-------------|
| POST | /agents | Create new agent | 201 (success), 400 (invalid), 409 (duplicate) |
| GET | /agents | List all agents | 200 |
| GET | /agents/:name | Get single agent | 200 (found), 404 (not found) |
| PUT | /agents/:name | Update agent | 200 (success), 404 (not found), 400 (invalid) |
| DELETE | /agents/:name | Delete agent | 204 (success), 404 (not found) |

### 2. Test File Structure

```
packages/api/src/__tests__/
├── agents-crud-integration.test.ts    # Main CRUD integration tests
├── fixtures/
│   └── agent-fixtures.ts              # Test agent definitions
└── setup.ts                           # Extended with agent utilities
```

### 3. Integration Test Categories

#### A. Full CRUD Flow Tests
- Create agent → Read it back → Update it → Delete it
- Verify state consistency after each operation
- Test event emissions (agent:created, agent:updated, agent:deleted)

#### B. Edge Case Tests
- **Duplicate Names**: Attempt to create agent with existing name → 409 Conflict
- **Invalid Data**:
  - Missing required fields (name, description, prompt) → 400
  - Invalid model value → 400
  - Empty strings for required fields → 400
- **Special Characters in Names**:
  - Spaces: "test agent"
  - Unicode: "agente-español", "エージェント"
  - Symbols: "test-agent_v2.0"
  - Path traversal attempts: "../malicious", "..%2F.."

#### C. Boundary Tests
- Very long names/descriptions
- Large number of tools/skills
- Empty optional arrays vs undefined

#### D. Error Handling Tests
- Update non-existent agent → 404
- Delete non-existent agent → 404
- Get non-existent agent → 404
- Invalid JSON payload → 400

### 4. Test Implementation Pattern

```typescript
// packages/api/src/__tests__/agents-crud-integration.test.ts

describe('Agent CRUD Integration Tests', () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-agent-test-'));
    app = await createServer({ projectPath: tempDir, port: 0, silent: true });
    await app.ready();
  });

  afterEach(async () => {
    await app?.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Full CRUD Flow', () => {
    it('should complete full CRUD lifecycle', async () => {
      // CREATE
      const createResponse = await app.inject({
        method: 'POST',
        url: '/agents',
        payload: validAgentDefinition,
        headers: { 'content-type': 'application/json' }
      });
      expect(createResponse.statusCode).toBe(201);

      // READ
      const getResponse = await app.inject({
        method: 'GET',
        url: `/agents/${validAgentDefinition.name}`
      });
      expect(getResponse.statusCode).toBe(200);

      // UPDATE
      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/agents/${validAgentDefinition.name}`,
        payload: { description: 'Updated description' },
        headers: { 'content-type': 'application/json' }
      });
      expect(updateResponse.statusCode).toBe(200);

      // DELETE
      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/agents/${validAgentDefinition.name}`
      });
      expect(deleteResponse.statusCode).toBe(204);
    });
  });
});
```

### 5. Test Fixtures

```typescript
// packages/api/src/__tests__/fixtures/agent-fixtures.ts

export const validAgentFixtures = {
  minimal: {
    name: 'test-agent',
    description: 'A test agent',
    prompt: 'You are a test assistant.'
  },
  full: {
    name: 'full-test-agent',
    description: 'A fully configured test agent',
    prompt: 'You are a comprehensive test assistant.',
    tools: ['Read', 'Write', 'Edit'],
    model: 'sonnet',
    skills: ['testing', 'debugging']
  },
  withSpecialChars: {
    name: 'test-agent_v2.0',
    description: 'Agent with special characters',
    prompt: 'Test prompt'
  }
};

export const invalidAgentFixtures = {
  missingName: { description: 'test', prompt: 'test' },
  missingDescription: { name: 'test', prompt: 'test' },
  missingPrompt: { name: 'test', description: 'test' },
  invalidModel: { name: 'test', description: 'test', prompt: 'test', model: 'invalid' },
  emptyName: { name: '', description: 'test', prompt: 'test' }
};
```

### 6. API Implementation Requirements

#### POST /agents
```typescript
app.post<{ Body: AgentDefinition }>('/agents', async (request, reply) => {
  const agent = request.body;

  // Validate required fields
  if (!agent.name?.trim()) {
    return reply.status(400).send({ error: 'Agent name is required' });
  }
  if (!agent.description?.trim()) {
    return reply.status(400).send({ error: 'Agent description is required' });
  }
  if (!agent.prompt?.trim()) {
    return reply.status(400).send({ error: 'Agent prompt is required' });
  }

  // Check for duplicate
  const existing = await orchestrator.getAgent(agent.name);
  if (existing) {
    return reply.status(409).send({ error: `Agent already exists: ${agent.name}` });
  }

  try {
    const created = await orchestrator.createAgent(agent);
    return reply.status(201).send(created);
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});
```

#### GET /agents/:name
```typescript
app.get<{ Params: { name: string } }>('/agents/:name', async (request, reply) => {
  const { name } = request.params;
  const agent = await orchestrator.getAgent(name);

  if (!agent) {
    return reply.status(404).send({ error: `Agent not found: ${name}` });
  }

  return agent;
});
```

#### PUT /agents/:name
```typescript
app.put<{ Params: { name: string }; Body: Partial<AgentDefinition> }>(
  '/agents/:name',
  async (request, reply) => {
    const { name } = request.params;
    const updates = request.body;

    try {
      const updated = await orchestrator.updateAgent(name, updates);
      return updated;
    } catch (error) {
      if (error.message.includes('not found')) {
        return reply.status(404).send({ error: `Agent not found: ${name}` });
      }
      return reply.status(500).send({ error: error.message });
    }
  }
);
```

#### DELETE /agents/:name
```typescript
app.delete<{ Params: { name: string } }>('/agents/:name', async (request, reply) => {
  const { name } = request.params;

  try {
    await orchestrator.deleteAgent(name);
    return reply.status(204).send();
  } catch (error) {
    if (error.message.includes('not found')) {
      return reply.status(404).send({ error: `Agent not found: ${name}` });
    }
    return reply.status(500).send({ error: error.message });
  }
});
```

## Consequences

### Positive
- Complete REST API coverage for agent management
- Comprehensive test coverage ensures reliability
- Edge case testing prevents security issues (path traversal)
- Follows existing patterns in the codebase

### Negative
- Additional API surface to maintain
- Integration tests may be slower than unit tests

### Risks
- Special character handling needs careful sanitization
- File system operations need proper error handling

## Implementation Checklist

1. [ ] Create `agent-fixtures.ts` with test data
2. [ ] Implement missing API endpoints in `packages/api/src/index.ts`
3. [ ] Create `agents-crud-integration.test.ts` with full test suite
4. [ ] Extend `HttpTestUtils` in `setup.ts` with agent methods
5. [ ] Add validation for special characters in agent names
6. [ ] Run `npm test` to verify all tests pass
7. [ ] Run `npm run build` to verify build succeeds

## Related Documents
- packages/core/src/__tests__/config-agent-crud.test.ts - Core CRUD tests
- packages/api/src/__tests__/v010-rest-api-crud.test.ts - Existing REST test pattern
- packages/api/src/__tests__/setup.ts - Test infrastructure

## Pre-Existing Issues Noted During Analysis

The following pre-existing issues were identified during architecture analysis:

### Build Issues
1. **packages/web-ui**: Type errors in `ApprovalGatePanelHeader.tsx` and related components
2. **packages/api**: Type errors in `teams-service.ts` and `slack-*-service.ts` files

### Test Failures
1. **packages/api**: ~92 test files failing (primarily related to Teams/Slack integration services)
2. **packages/orchestrator**: 2 test files failing (linter plugin timeout issues)
3. **packages/core**: All tests passing ✓

These issues are unrelated to the agent CRUD integration tests and should be addressed separately. The integration tests can be implemented following this architecture once the existing build issues are resolved.

## Technical Design Summary

### Key Design Decisions

1. **Follow existing REST patterns**: Use the same Fastify injection pattern as `v010-rest-api-crud.test.ts`
2. **Reuse test infrastructure**: Leverage existing `setup.ts` utilities and extend with agent-specific methods
3. **Create dedicated fixtures**: Keep test data centralized in `agent-fixtures.ts`
4. **Test isolation**: Each test uses temporary directory with proper cleanup
5. **Cover acceptance criteria completely**:
   - Full CRUD lifecycle in single test
   - Edge cases for duplicates, invalid data, special characters
   - All tests runnable via `npm test`

### Implementation Sequence

1. **Phase 1**: Implement missing API endpoints (POST, GET/:name, PUT/:name, DELETE/:name)
2. **Phase 2**: Create test fixtures with valid and invalid agent definitions
3. **Phase 3**: Implement integration test suite following the patterns in this ADR
4. **Phase 4**: Verify all tests pass and build succeeds
