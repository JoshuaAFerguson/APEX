# ADR-006: Agent File CRUD Operations

## Status
Accepted

## Date
2026-03-16

## Context

The APEX CLI needs the ability to programmatically create, update, and delete agent definition files in the `.apex/agents/` directory. Currently, the codebase only has `loadAgents()` and `parseAgentMarkdown()` functions for reading agents, but lacks write and delete capabilities.

### Current State
- `loadAgents(projectPath)` - Loads all agent definitions from `.apex/agents/*.md`
- `parseAgentMarkdown(content)` - Parses markdown with YAML frontmatter into `AgentDefinition`
- `AgentDefinitionSchema` - Zod schema for validating agent definitions

### Missing Capabilities
- `saveAgent()` - Write/update an agent markdown file
- `deleteAgent()` - Remove an agent markdown file

## Decision

We will implement two new functions in `packages/core/src/config.ts`:

### 1. `saveAgent(projectPath: string, agent: AgentDefinition): Promise<void>`

**Responsibilities:**
- Validate the agent definition using `AgentDefinitionSchema`
- Generate markdown content with YAML frontmatter
- Normalize the file path using existing `normalizePath()` utility
- Create the agents directory if it doesn't exist
- Write the markdown file to `.apex/agents/{agent.name}.md`
- Handle filesystem errors appropriately

**Validation Rules:**
- Agent name must be valid (validated by Zod schema)
- Agent name must be safe for use as a filename (no path separators, special chars)
- All required fields must be present (name, description, prompt)

**File Path Normalization:**
- Convert agent name to lowercase kebab-case for filename
- Sanitize any characters that aren't safe for filenames
- Use `normalizePath()` for cross-platform compatibility

### 2. `deleteAgent(projectPath: string, agentName: string): Promise<boolean>`

**Responsibilities:**
- Normalize the agent name to derive the filename
- Check if the agent file exists
- Delete the file if it exists
- Return `true` if deleted, `false` if not found
- Handle filesystem errors appropriately

**Error Handling:**
- Return `false` (not throw) for ENOENT (file not found)
- Throw for permission errors or other filesystem issues

## Function Signatures

```typescript
/**
 * Saves an agent definition to a markdown file in the .apex/agents directory.
 * Creates the agents directory if it doesn't exist.
 *
 * @param projectPath - The absolute path to the project directory
 * @param agent - The agent definition to save
 * @throws {Error} When validation fails or file cannot be written
 */
export async function saveAgent(
  projectPath: string,
  agent: AgentDefinition
): Promise<void>;

/**
 * Deletes an agent markdown file from the .apex/agents directory.
 *
 * @param projectPath - The absolute path to the project directory
 * @param agentName - The name of the agent to delete
 * @returns Promise resolving to true if deleted, false if not found
 * @throws {Error} When file deletion fails (except ENOENT)
 */
export async function deleteAgent(
  projectPath: string,
  agentName: string
): Promise<boolean>;
```

## Implementation Details

### Agent Name to Filename Conversion

```typescript
function agentNameToFilename(agentName: string): string {
  // Convert to lowercase kebab-case
  // Remove/replace unsafe characters
  // Examples:
  //   "myAgent" -> "my-agent.md"
  //   "Test Agent" -> "test-agent.md"
  //   "developer" -> "developer.md"
  return `${agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}.md`;
}
```

**Design Decision:** We use the agent's `name` field directly as the base filename (with `.md` extension) rather than transforming it, to maintain consistency with how `loadAgents()` currently works. The `loadAgents()` function uses the `name` field from the frontmatter as the key, so we preserve this mapping.

### Markdown Generation

```typescript
function generateAgentMarkdown(agent: AgentDefinition): string {
  const frontmatter: Record<string, unknown> = {
    name: agent.name,
    description: agent.description,
  };

  if (agent.tools?.length) {
    frontmatter.tools = agent.tools.join(', ');
  }

  if (agent.model) {
    frontmatter.model = agent.model;
  }

  if (agent.skills?.length) {
    frontmatter.skills = agent.skills.join(', ');
  }

  return `---\n${yaml.stringify(frontmatter)}---\n${agent.prompt}\n`;
}
```

### Error Categories

| Error Type | Behavior |
|------------|----------|
| Validation failure | Throw with descriptive message |
| Directory creation failure | Throw with original error |
| File write failure | Throw with original error |
| File not found (delete) | Return `false` |
| Permission denied | Throw with original error |

## File Structure

```
packages/core/src/
├── config.ts           # Add saveAgent(), deleteAgent() here
├── config.test.ts      # Add unit tests for new functions
└── types.ts            # AgentDefinition, AgentDefinitionSchema (existing)
```

## Test Plan

### Unit Tests for `saveAgent()`

1. **Happy path**: Save a valid agent and verify file contents
2. **Creates directory**: Save when agents directory doesn't exist
3. **Overwrites existing**: Save agent with same name overwrites
4. **Validation failure**: Invalid agent definition throws error
5. **Tools array handling**: Properly serializes tools to comma-separated
6. **Skills array handling**: Properly serializes skills to comma-separated
7. **Optional fields**: Handles missing optional fields (tools, model, skills)
8. **Cross-platform paths**: Works on both Unix and Windows

### Unit Tests for `deleteAgent()`

1. **Happy path**: Delete existing agent returns true
2. **Not found**: Delete non-existent agent returns false
3. **Path normalization**: Handles various path formats
4. **Directory missing**: Returns false when agents dir doesn't exist

### Integration Tests

1. **Round-trip**: Save an agent, load it back, verify equality
2. **Load after delete**: Delete an agent, verify it's no longer loaded

## Alternatives Considered

### 1. Separate AgentManager Class
**Rejected**: Would add unnecessary complexity. The existing pattern in `config.ts` uses standalone functions, and this approach maintains consistency.

### 2. Generic CRUD for All Entity Types
**Rejected**: Over-engineering for current needs. Agents, workflows, and skills have different formats and storage patterns. If needed, this can be refactored later.

### 3. Store Agents in YAML Instead of Markdown
**Rejected**: Markdown with frontmatter is the established pattern in APEX. It allows for rich prompt content with formatting.

## Dependencies

- No new dependencies required
- Uses existing: `fs/promises`, `path`, `yaml`, `normalizePath()`, `AgentDefinitionSchema`

## Migration

N/A - This is new functionality with no breaking changes.

## Consequences

### Positive
- Enables programmatic agent management (CLI commands, web UI)
- Follows established patterns in the codebase
- Cross-platform compatible using existing utilities

### Negative
- Increases config.ts file size (adds ~100 lines)
- Must maintain parity between read and write formats

### Risks
- **Risk**: Filename collision if agent names differ only in case
  - **Mitigation**: Use exact agent name as filename (current behavior in templates)
