# ADR-001: MCP Server Template YAML Files

## Status
Proposed

## Context
APEX needs a set of MCP (Model Context Protocol) server template YAML files to provide users with pre-configured, ready-to-use configurations for common MCP servers. These templates will simplify the process of setting up MCP integrations by providing sensible defaults, environment variable definitions, and capability declarations.

The templates must conform to the `MCPTemplateSchema` defined in `packages/core/src/types.ts`.

## Decision

### Template Location
All MCP server template files will be stored in:
```
packages/core/templates/mcp/
```

### Template Structure
Each template YAML file must include the following fields as defined by `MCPTemplateSchema`:

#### Required Fields
- `id`: Unique identifier (e.g., 'filesystem', 'github')
- `name`: Human-readable display name
- `description`: Description of the MCP server's purpose
- `package`: NPM package name
- `config`: Server configuration (partial MCPServerConfig)

#### Optional Fields with Defaults
- `envVars`: Array of environment variable definitions (default: [])
- `capabilities`: Array of capability strings (default: [])
- `verified`: Boolean indicating official/verified source (default: false)
- `defaultEnabled`: Whether enabled by default (default: false)
- `tags`: Array of searchable tags (default: [])
- `category`: Template category for grouping
- `minVersion`: Minimum required package version
- `documentationUrl`: Link to documentation
- `repositoryUrl`: Link to source repository

### Servers to Template

1. **filesystem** (`@modelcontextprotocol/server-filesystem`)
   - Category: filesystem
   - Capabilities: filesystem, read, write, search, directory
   - Official MCP server for filesystem operations

2. **fetch** (`@modelcontextprotocol/server-fetch`)
   - Category: network
   - Capabilities: http, fetch, web, request
   - Official MCP server for HTTP requests

3. **memory** (`@modelcontextprotocol/server-memory`)
   - Category: storage
   - Capabilities: memory, key-value, persistence
   - Official MCP server for knowledge graph/memory storage

4. **github** (`@modelcontextprotocol/server-github`)
   - Category: api
   - Capabilities: github, git, repositories, issues, pull-requests
   - Official MCP server for GitHub API integration

5. **postgres** (`@modelcontextprotocol/server-postgres`)
   - Category: database
   - Capabilities: database, sql, postgresql, queries
   - Official MCP server for PostgreSQL operations

6. **brave-search** (`@anthropic-ai/mcp-server-brave-search`)
   - Category: search
   - Capabilities: search, web-search, brave
   - Brave Search API integration for web search

### Environment Variable Design Principles

1. **Required vs Optional**: Mark variables as `required: true` only when the server cannot function without them
2. **Sensitivity**: Mark API keys, tokens, and passwords as `sensitive: true`
3. **Source Types**:
   - `user`: User must provide (API keys, tokens)
   - `config`: Typically configured in project settings
   - `env`: Read from environment
   - `default`: Has sensible default value
4. **Patterns**: Include regex patterns for validation where applicable (e.g., connection strings)

### Capability Naming Conventions
- Use lowercase with hyphens for multi-word capabilities
- Primary capability matches the server's main function
- Include both general and specific capabilities (e.g., 'database', 'postgresql')

### File Naming Convention
```
{server-id}.yaml
```
Examples: `filesystem.yaml`, `github.yaml`, `postgres.yaml`

## Consequences

### Positive
- Users get pre-configured templates for common MCP servers
- Consistent structure across all templates
- Environment variables clearly documented with metadata
- Capabilities enable intelligent server selection

### Negative
- Templates may need updates when upstream packages change
- Some servers may have additional configuration options not captured

### Risks
- Package versions may become outdated
- External server behavior may change

## Implementation Notes

### Directory Structure
```
packages/core/templates/
├── agents/          # Existing agent templates
├── workflows/       # Existing workflow templates
└── mcp/            # NEW: MCP server templates
    ├── filesystem.yaml
    ├── fetch.yaml
    ├── memory.yaml
    ├── github.yaml
    ├── postgres.yaml
    └── brave-search.yaml
```

### Template Validation
Templates should be validated against `MCPTemplateSchema` during build/test to ensure correctness.

### Integration Points
- `packages/core/src/config.ts` may need updates to load MCP templates
- CLI `init` command can use these templates for setup wizards
- API can expose available templates for UI selection

## Technical Design Summary

### filesystem.yaml
```yaml
id: filesystem
name: Filesystem Server
description: Read and write files, list directories, search content
package: '@modelcontextprotocol/server-filesystem'
config:
  name: filesystem
  type: stdio
  command: npx
  args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace']
  autoStart: true
envVars:
  - name: ALLOWED_PATHS
    description: Allowed paths for filesystem operations
    required: false
    sensitive: false
    defaultValue: '/workspace'
    source: config
capabilities: [filesystem, read, write, search, directory, list]
verified: true
defaultEnabled: true
category: filesystem
tags: [filesystem, files, workspace, io, read, write]
documentationUrl: https://modelcontextprotocol.io/docs/servers/filesystem
repositoryUrl: https://github.com/modelcontextprotocol/servers
```

### fetch.yaml
```yaml
id: fetch
name: Fetch Server
description: Make HTTP requests and fetch web content
package: '@modelcontextprotocol/server-fetch'
config:
  name: fetch
  type: stdio
  command: npx
  args: ['-y', '@modelcontextprotocol/server-fetch']
  autoStart: true
envVars:
  - name: USER_AGENT
    description: Custom User-Agent header for requests
    required: false
    sensitive: false
    source: config
  - name: ALLOWED_DOMAINS
    description: Comma-separated list of allowed domains
    required: false
    sensitive: false
    source: config
capabilities: [http, fetch, web, request, api]
verified: true
defaultEnabled: true
category: network
tags: [http, fetch, web, network, api, request]
documentationUrl: https://modelcontextprotocol.io/docs/servers/fetch
repositoryUrl: https://github.com/modelcontextprotocol/servers
```

### memory.yaml
```yaml
id: memory
name: Memory Server
description: Persistent memory and knowledge graph storage
package: '@modelcontextprotocol/server-memory'
config:
  name: memory
  type: stdio
  command: npx
  args: ['-y', '@modelcontextprotocol/server-memory']
  autoStart: true
envVars: []
capabilities: [memory, knowledge-graph, persistence, storage]
verified: true
defaultEnabled: false
category: storage
tags: [memory, storage, knowledge-graph, persistence, recall]
documentationUrl: https://modelcontextprotocol.io/docs/servers/memory
repositoryUrl: https://github.com/modelcontextprotocol/servers
```

### github.yaml
```yaml
id: github
name: GitHub Server
description: GitHub API integration for repository management
package: '@modelcontextprotocol/server-github'
config:
  name: github
  type: stdio
  command: npx
  args: ['-y', '@modelcontextprotocol/server-github']
  autoStart: false
envVars:
  - name: GITHUB_PERSONAL_ACCESS_TOKEN
    description: GitHub Personal Access Token for API authentication
    required: true
    sensitive: true
    source: user
capabilities: [github, git, repositories, issues, pull-requests, api]
verified: true
defaultEnabled: false
category: api
tags: [github, git, vcs, repositories, issues, pull-requests, api]
documentationUrl: https://modelcontextprotocol.io/docs/servers/github
repositoryUrl: https://github.com/modelcontextprotocol/servers
```

### postgres.yaml
```yaml
id: postgres
name: PostgreSQL Server
description: PostgreSQL database operations and queries
package: '@modelcontextprotocol/server-postgres'
config:
  name: postgres
  type: stdio
  command: npx
  args: ['-y', '@modelcontextprotocol/server-postgres']
  autoStart: false
envVars:
  - name: POSTGRES_CONNECTION_STRING
    description: PostgreSQL connection string (postgresql://user:pass@host:port/db)
    required: true
    sensitive: true
    pattern: '^postgresql://.*'
    source: user
capabilities: [database, sql, postgresql, queries, read, write]
verified: true
defaultEnabled: false
category: database
tags: [database, postgresql, postgres, sql, queries]
documentationUrl: https://modelcontextprotocol.io/docs/servers/postgres
repositoryUrl: https://github.com/modelcontextprotocol/servers
```

### brave-search.yaml
```yaml
id: brave-search
name: Brave Search Server
description: Web search using Brave Search API
package: '@anthropic-ai/mcp-server-brave-search'
config:
  name: brave-search
  type: stdio
  command: npx
  args: ['-y', '@anthropic-ai/mcp-server-brave-search']
  autoStart: false
envVars:
  - name: BRAVE_API_KEY
    description: Brave Search API key
    required: true
    sensitive: true
    source: user
capabilities: [search, web-search, brave, internet]
verified: true
defaultEnabled: false
category: search
tags: [search, web-search, brave, internet, query]
documentationUrl: https://brave.com/search/api/
repositoryUrl: https://github.com/anthropics/mcp-server-brave-search
```

## References
- MCPTemplateSchema: `packages/core/src/types.ts` (line ~2432)
- MCPServerConfigSchema: `packages/core/src/types.ts` (line ~2339)
- MCPEnvironmentVarSchema: `packages/core/src/types.ts` (line ~2315)
- Model Context Protocol: https://modelcontextprotocol.io/
