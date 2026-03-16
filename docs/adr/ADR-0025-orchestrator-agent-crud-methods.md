# ADR-0025: ApexOrchestrator Agent CRUD Methods

## Status
Proposed

## Date
2026-03-16

## Context

The ApexOrchestrator class currently manages an internal `agents` cache that is populated during initialization via `loadAgents()`. However, there's no way to programmatically create, update, delete, or retrieve individual agents through the orchestrator API. The core functions `saveAgent()` and `deleteAgent()` exist in `@apexcli/core`, but the orchestrator doesn't expose them with proper cache management and event emission.

### Current State
- `packages/orchestrator/src/index.ts`:
  - `private agents: Record<string, AgentDefinition> = {}` - Internal cache
  - `async getAgents()` - Returns all cached agents (already exists)
  - Agents loaded during `initialize()`: `this.agents = await loadAgents(this.projectPath)`
  - Imports `loadAgents` from `@apexcli/core`
  - Does NOT import `saveAgent` or `deleteAgent` from `@apexcli/core`

- `packages/core/src/config.ts`:
  - `saveAgent(projectPath, agent)` - Saves agent to markdown file
  - `deleteAgent(projectPath, agentName)` - Deletes agent markdown file
  - `loadAgents(projectPath)` - Loads all agents

### Acceptance Criteria
Add `createAgent()`, `updateAgent()`, `deleteAgent()`, `getAgent()` methods to ApexOrchestrator that:
1. Use the core functions for persistence
2. Manage the internal `agents` cache
3. Emit appropriate events

## Decision

We will add four agent CRUD methods to the ApexOrchestrator class following the existing patterns used for templates (createTemplate, updateTemplate, etc.).

### New Events

Add to `OrchestratorEvents` interface:
```typescript
'agent:created': (agent: AgentDefinition) => void;
'agent:updated': (agent: AgentDefinition, previousAgent: AgentDefinition) => void;
'agent:deleted': (agentName: string, deletedAgent: AgentDefinition) => void;
```

### Method Signatures

```typescript
/**
 * Create a new agent definition
 * @param agent - The agent definition to create
 * @returns The created agent definition
 * @throws {Error} When agent with same name already exists
 */
async createAgent(agent: AgentDefinition): Promise<AgentDefinition>;

/**
 * Update an existing agent definition
 * @param agentName - The name of the agent to update
 * @param updates - Partial updates to apply
 * @returns The updated agent definition
 * @throws {Error} When agent is not found
 */
async updateAgent(
  agentName: string,
  updates: Partial<Omit<AgentDefinition, 'name'>>
): Promise<AgentDefinition>;

/**
 * Delete an agent definition
 * @param agentName - The name of the agent to delete
 * @throws {Error} When agent is not found
 */
async deleteAgent(agentName: string): Promise<void>;

/**
 * Get a specific agent by name
 * @param agentName - The name of the agent to retrieve
 * @returns The agent definition or null if not found
 */
async getAgent(agentName: string): Promise<AgentDefinition | null>;
```

### Implementation Details

#### Import Changes
Add to existing imports from `@apexcli/core`:
```typescript
import {
  // ... existing imports ...
  saveAgent,
  deleteAgent,
  // Note: deleteAgent from core conflicts with our method name,
  // so we'll rename it during import
} from '@apexcli/core';
```

To avoid naming conflict with the orchestrator's `deleteAgent` method:
```typescript
import {
  // ... existing imports ...
  saveAgent as saveAgentToFile,
  deleteAgent as deleteAgentFile,
} from '@apexcli/core';
```

#### createAgent Implementation
```typescript
async createAgent(agent: AgentDefinition): Promise<AgentDefinition> {
  await this.ensureInitialized();

  // Check if agent already exists
  if (this.agents[agent.name]) {
    throw new Error(`Agent '${agent.name}' already exists`);
  }

  // Save to file system
  await saveAgentToFile(this.projectPath, agent);

  // Update cache
  this.agents[agent.name] = agent;

  // Emit event
  this.emit('agent:created', agent);

  return agent;
}
```

#### updateAgent Implementation
```typescript
async updateAgent(
  agentName: string,
  updates: Partial<Omit<AgentDefinition, 'name'>>
): Promise<AgentDefinition> {
  await this.ensureInitialized();

  // Check if agent exists
  const existingAgent = this.agents[agentName];
  if (!existingAgent) {
    throw new Error(`Agent '${agentName}' not found`);
  }

  // Merge updates with existing agent (name cannot be changed)
  const updatedAgent: AgentDefinition = {
    ...existingAgent,
    ...updates,
    name: agentName, // Ensure name is preserved
  };

  // Save to file system
  await saveAgentToFile(this.projectPath, updatedAgent);

  // Update cache
  this.agents[agentName] = updatedAgent;

  // Emit event with both old and new agent for comparison
  this.emit('agent:updated', updatedAgent, existingAgent);

  return updatedAgent;
}
```

#### deleteAgent Implementation
```typescript
async deleteAgent(agentName: string): Promise<void> {
  await this.ensureInitialized();

  // Check if agent exists
  const existingAgent = this.agents[agentName];
  if (!existingAgent) {
    throw new Error(`Agent '${agentName}' not found`);
  }

  // Delete from file system
  await deleteAgentFile(this.projectPath, agentName);

  // Remove from cache
  delete this.agents[agentName];

  // Emit event
  this.emit('agent:deleted', agentName, existingAgent);
}
```

#### getAgent Implementation
```typescript
async getAgent(agentName: string): Promise<AgentDefinition | null> {
  await this.ensureInitialized();
  return this.agents[agentName] || null;
}
```

### Event Data Types

The events use existing types and don't require new interfaces:
- `'agent:created'`: Emits the `AgentDefinition` that was created
- `'agent:updated'`: Emits both the new and previous `AgentDefinition` for change detection
- `'agent:deleted'`: Emits the agent name and the deleted `AgentDefinition`

## File Changes

### packages/orchestrator/src/index.ts

1. **Import changes** (around line 48-109):
   - Add `saveAgent as saveAgentToFile` and `deleteAgent as deleteAgentFile` to imports from `@apexcli/core`

2. **OrchestratorEvents interface** (around line 275):
   - Add three new event signatures

3. **ApexOrchestrator class** (insert after existing `getAgents()` method around line 5756):
   - Add `getAgent()` method
   - Add `createAgent()` method
   - Add `updateAgent()` method
   - Add `deleteAgent()` method

### Estimated Lines of Code
- Import changes: ~2 lines modified
- Event interface: ~3 lines added
- Method implementations: ~80 lines added
- Total: ~85 lines added

## Placement Strategy

Place the new methods after the existing `getAgents()` method to group all agent-related methods together:
```
getAgents()          // existing, line ~5753
getAgent()           // NEW
createAgent()        // NEW
updateAgent()        // NEW
deleteAgent()        // NEW
getLinterService()   // existing
```

## Test Plan

### Unit Tests (to be added in implementation stage)
1. `createAgent()` - creates agent, updates cache, emits event
2. `createAgent()` - throws when agent already exists
3. `updateAgent()` - updates agent, preserves name, emits event
4. `updateAgent()` - throws when agent not found
5. `deleteAgent()` - deletes agent, removes from cache, emits event
6. `deleteAgent()` - throws when agent not found
7. `getAgent()` - returns agent when found
8. `getAgent()` - returns null when not found
9. Event payloads contain correct data

## Alternatives Considered

### 1. Direct Core Function Exposure
**Rejected**: Doesn't manage the internal cache, requiring manual cache invalidation. Would break the orchestrator's internal state consistency.

### 2. Automatic Cache Refresh
**Rejected**: Would require file system reads after every operation. Our approach updates the cache in-memory which is more efficient.

### 3. Separate AgentManager Service
**Rejected**: Over-engineering for this use case. The template CRUD methods follow the same pattern of being directly on the orchestrator.

## Consequences

### Positive
- Provides complete CRUD API for agents through the orchestrator
- Maintains cache consistency automatically
- Follows existing patterns (template CRUD)
- Enables programmatic agent management from CLI and web UI

### Negative
- Adds ~85 lines to already large index.ts file
- Agent name immutability may require delete+create for renames

### Risks
- **Risk**: Race conditions if multiple concurrent modifications
  - **Mitigation**: Operations are async and await file system operations; cache updates are synchronous after file ops complete
