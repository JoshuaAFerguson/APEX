# Architecture Decision Record: `apex mcp list` Command

## Status
**Proposed**

## Context
We need to implement an `apex mcp list` command that displays all available MCP (Model Context Protocol) server templates with their name and description. This command will be integrated into the main CLI under an 'mcp' command group.

## Decision

### 1. Command Structure

The command will follow the existing CLI command pattern in `packages/cli/src/index.ts`:

```typescript
{
  name: 'mcp',
  aliases: [],
  description: 'Manage MCP (Model Context Protocol) servers',
  usage: '/mcp <list|add|remove|status>',
  handler: async (ctx, args) => { ... }
}
```

The `mcp` command will support subcommands, starting with `list`:
- `/mcp list` - Display available MCP server templates
- Future: `/mcp add <template-id>` - Add an MCP server from a template
- Future: `/mcp remove <server-name>` - Remove an MCP server
- Future: `/mcp status` - Show status of configured MCP servers

### 2. Data Sources

MCP templates are already defined in YAML files:
- **Location**: `packages/core/templates/mcp/*.yaml`
- **Currently available templates**:
  1. `filesystem` - Filesystem Server (secure filesystem access)
  2. `fetch` - Fetch Server (HTTP requests)
  3. `memory` - Memory Server (in-memory storage)
  4. `github` - GitHub Integration (repository management)
  5. `postgres` - PostgreSQL Database (SQL operations)
  6. `brave-search` - Brave Search (web search)

### 3. Existing Infrastructure

The `@apexcli/core` package already provides:

```typescript
// From packages/core/src/mcp-templates.ts
export async function loadMCPTemplates(templatesPath?: string): Promise<Record<string, MCPTemplate>>;
export async function getMCPTemplate(templateId: string, templatesPath?: string): Promise<MCPTemplate | null>;
export async function listMCPTemplateIds(templatesPath?: string): Promise<string[]>;
```

The `MCPTemplate` type (from `packages/core/src/types.ts`) includes:
- `id: string` - Unique identifier
- `name: string` - Human-readable display name
- `description: string` - Description of functionality
- `package: string` - NPM package name
- `category?: string` - Category for grouping (e.g., 'filesystem', 'api', 'database')
- `verified: boolean` - Official/verified source indicator
- `defaultEnabled: boolean` - Default enablement status
- `tags: string[]` - Searchability tags
- `capabilities: string[]` - Server capabilities
- `documentationUrl?: string` - Documentation link

### 4. Implementation Design

#### 4.1 CLI Handler Structure

```typescript
{
  name: 'mcp',
  aliases: [],
  description: 'Manage MCP (Model Context Protocol) servers',
  usage: '/mcp list [--category <category>] [--verbose]',
  handler: async (ctx, args) => {
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case 'list':
        await handleMCPList(ctx, args.slice(1));
        break;
      default:
        // Show usage help
    }
  }
}
```

#### 4.2 List Handler Implementation

```typescript
async function handleMCPList(ctx: ApexContext, args: string[]): Promise<void> {
  // Parse optional flags
  const verbose = args.includes('--verbose') || args.includes('-v');
  const categoryFilter = getArgValue(args, '--category');

  // Load templates using existing core function
  const templates = await loadMCPTemplates();

  // Group by category if available
  const grouped = groupByCategory(templates);

  // Display in formatted table
  displayTemplates(grouped, { verbose, categoryFilter });
}
```

#### 4.3 Output Format

**Basic output** (`/mcp list`):
```
MCP Server Templates:

📁 Filesystem
  ✓ filesystem    Secure filesystem access with path restrictions
  ✓ fetch         HTTP requests and web API interactions

🗄️ Database
  ✓ postgres      PostgreSQL database operations

🔌 API
  ✓ github        GitHub API integration

🔍 Search
  ✓ brave-search  Web search via Brave Search API

💾 Storage
  ✓ memory        In-memory key-value storage

Use '/mcp add <template-id>' to configure a server.
```

**Verbose output** (`/mcp list --verbose`):
```
MCP Server Templates:

📁 Filesystem

  ✓ filesystem - Filesystem Server
    Secure filesystem access with configurable path restrictions
    Package: @modelcontextprotocol/server-filesystem
    Docs: https://modelcontextprotocol.io/servers/filesystem
    Tags: filesystem, files, workspace

  ✓ fetch - Fetch Server
    HTTP requests and web API interactions
    Package: @modelcontextprotocol/server-fetch
    ...
```

#### 4.4 Import Updates

Add import to `packages/cli/src/index.ts`:
```typescript
import {
  // ... existing imports
  loadMCPTemplates,
  MCPTemplate,
} from '@apexcli/core';
```

### 5. File Modifications

| File | Changes |
|------|---------|
| `packages/cli/src/index.ts` | Add `mcp` command with `list` subcommand handler |

### 6. No Changes Required

The following already exist and need no modification:
- `packages/core/src/mcp-templates.ts` - Template loading functions
- `packages/core/src/types.ts` - MCPTemplate type definition
- `packages/core/templates/mcp/*.yaml` - Template definitions

### 7. Visual Indicators

Use consistent emoji/icons matching existing CLI patterns:
- `✓` (green) - Verified templates with `defaultEnabled: true`
- `○` (gray) - Available but not enabled by default
- Category icons:
  - 📁 Filesystem
  - 🗄️ Database
  - 🔌 API
  - 🔍 Search
  - 💾 Storage
  - 🌐 Networking

### 8. Error Handling

- If templates directory not found: Show error with helpful message
- If no templates available: Show informative message
- Handle YAML parsing errors gracefully

## Alternatives Considered

### Alternative 1: Separate Handler File
Create `packages/cli/src/handlers/mcp-handlers.ts` similar to existing handlers.

**Rejected because**: The `mcp list` command is simple enough to implement inline. Can be refactored later when more subcommands are added.

### Alternative 2: Custom Template Discovery
Implement additional template discovery from npm registry or user-defined locations.

**Deferred**: Focus on built-in templates first. Can be extended via configuration later.

## Consequences

### Positive
- Leverages existing `@apexcli/core` infrastructure
- Consistent with existing CLI command patterns
- Extensible for future `mcp add/remove/status` subcommands
- No changes required to core package

### Negative
- Initial implementation limited to built-in templates only
- Category grouping depends on templates having `category` field

## Implementation Notes for Developer Stage

1. Add the `mcp` command to the `commands` array in `packages/cli/src/index.ts`
2. Import `loadMCPTemplates` and `MCPTemplate` from `@apexcli/core`
3. Implement `handleMCPList` function with template grouping and formatting
4. Use `chalk` for colored output (already imported)
5. Follow existing command patterns for consistency
6. Ensure no initialization check is required (templates are built-in)

## Test Considerations

- Unit test for template loading
- Integration test for CLI command output
- Edge case: empty templates directory
- Edge case: malformed template YAML (handled by core)
