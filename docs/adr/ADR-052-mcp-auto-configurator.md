# ADR-052: MCP Auto-Configurator System Architecture

## Status
Proposed

## Context

APEX needs an MCP auto-configuration system that can:
1. Generate `claude_desktop_config.json` or equivalent MCP configuration files
2. Auto-detect required environment variables for MCP servers
3. Provide configuration templates per server type
4. Validate configurations before applying them

### Current State

The codebase has extensive MCP infrastructure:

1. **`MCPServerManager`** (`packages/orchestrator/src/mcp/server-manager.ts`)
   - Manages server configurations in APEX format
   - Fetches and caches marketplace entries
   - Basic server lifecycle management

2. **`MCPMarketplaceService`** (`packages/orchestrator/src/mcp/marketplace-service.ts`)
   - Auto-configuration of standard tools
   - Project-based server recommendations
   - Tool collections (development, productivity, devops)

3. **`MCPInstaller`** (`packages/orchestrator/src/mcp-installer.ts`)
   - npm/npx-based installation
   - Installation status tracking
   - Event-driven progress reporting

4. **Core Types** (`packages/core/src/types.ts`)
   - `MCPServerConfig` - Runtime configuration with type, command, args, env
   - `MCPEnvironmentVar` - Rich env var metadata (name, required, sensitive, pattern)
   - `MCPConfig` - Global MCP configuration
   - `MCPConnectionConfig` - Connection settings (retry, timeout, pooling)

### Gap Analysis

While infrastructure exists, we need:
1. A dedicated `MCPConfigurator` class for external config generation
2. `claude_desktop_config.json` format generation (Claude Desktop compatibility)
3. Automated environment variable detection and validation
4. Reusable server templates with sensible defaults
5. Pre-apply validation to catch misconfigurations early

## Decision

Create a new **`MCPConfigurator`** class in `@apex/orchestrator` that serves as the central service for MCP configuration generation, validation, and management.

### Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                              MCPConfigurator                                   │
│                                                                               │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐   │
│  │  generateConfig()   │  │ detectEnvVariables() │  │ getServerTemplate()│   │
│  └─────────┬───────────┘  └──────────┬───────────┘  └─────────┬──────────┘   │
│            │                         │                         │              │
│            ▼                         ▼                         ▼              │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │                         ConfigurationEngine                               │ │
│  │                                                                          │ │
│  │  - Transforms APEX config ↔ external formats (Claude Desktop, etc.)     │ │
│  │  - Manages server templates registry                                     │ │
│  │  - Performs environment variable discovery                              │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│            │                         │                         │              │
│            ▼                         ▼                         ▼              │
│  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐   │
│  │ validateConfig()    │  │   applyConfig()      │  │ exportConfig()     │   │
│  └─────────────────────┘  └──────────────────────┘  └────────────────────┘   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                    │                          │
                    ▼                          ▼
         ┌────────────────────┐    ┌────────────────────────┐
         │   MCPServerManager │    │  .apex/config.yaml     │
         │   (Runtime config) │    │  (Persistence)         │
         └────────────────────┘    └────────────────────────┘
```

### Class Design

#### MCPConfigurator Interface

```typescript
// packages/orchestrator/src/mcp/configurator.ts

import { EventEmitter } from 'eventemitter3';
import {
  MCPConfig,
  MCPServerConfig,
  MCPEnvironmentVar,
  MCPConnectionConfig,
  ApexConfig,
} from '@apexcli/core';

/**
 * Supported external configuration formats
 */
export type MCPConfigFormat = 'claude-desktop' | 'apex' | 'json';

/**
 * Claude Desktop configuration format
 * Compatible with claude_desktop_config.json
 */
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, ClaudeDesktopServerConfig>;
}

export interface ClaudeDesktopServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Environment variable detection result
 */
export interface EnvVarDetectionResult {
  /** All environment variables for the server */
  variables: MCPEnvironmentVar[];
  /** Variables that are missing and required */
  missing: MCPEnvironmentVar[];
  /** Variables that are present in the environment */
  found: MCPEnvironmentVar[];
  /** Validation warnings (e.g., pattern mismatches) */
  warnings: Array<{ variable: string; message: string }>;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
    code: ConfigValidationErrorCode;
  }>;
  warnings: Array<{
    path: string;
    message: string;
    code: ConfigValidationWarningCode;
  }>;
}

export type ConfigValidationErrorCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_COMMAND'
  | 'MISSING_ENV_VAR'
  | 'INVALID_URL'
  | 'CONFLICTING_CONFIG'
  | 'UNKNOWN_SERVER_TYPE';

export type ConfigValidationWarningCode =
  | 'MISSING_OPTIONAL_ENV'
  | 'DEPRECATED_FIELD'
  | 'SUBOPTIMAL_CONFIG'
  | 'UNVERIFIED_SERVER';

/**
 * Server template definition
 */
export interface MCPServerTemplate {
  /** Unique template identifier */
  id: string;
  /** Display name */
  name: string;
  /** Server description */
  description: string;
  /** Package name (npm) */
  package: string;
  /** Base configuration */
  config: Partial<MCPServerConfig>;
  /** Environment variables with metadata */
  envVars: MCPEnvironmentVar[];
  /** Capabilities this server provides */
  capabilities: string[];
  /** Whether this template is verified/official */
  verified: boolean;
  /** Default enabled state */
  defaultEnabled?: boolean;
}

/**
 * MCPConfigurator events
 */
export interface MCPConfiguratorEvents {
  'config:generated': (data: { format: MCPConfigFormat; path?: string }) => void;
  'config:validated': (data: ConfigValidationResult) => void;
  'config:applied': (data: { serverCount: number }) => void;
  'env:detected': (data: EnvVarDetectionResult) => void;
  'env:missing': (data: { variables: MCPEnvironmentVar[] }) => void;
}

/**
 * MCPConfigurator options
 */
export interface MCPConfiguratorOptions {
  /** Project path */
  projectPath: string;
  /** APEX configuration */
  config: ApexConfig;
  /** Custom templates to register */
  customTemplates?: MCPServerTemplate[];
}

/**
 * MCPConfigurator - Central service for MCP configuration management
 */
export class MCPConfigurator extends EventEmitter<MCPConfiguratorEvents> {
  constructor(options: MCPConfiguratorOptions);

  // =========================================================================
  // Configuration Generation
  // =========================================================================

  /**
   * Generate MCP configuration in the specified format
   * @param format - Target format (claude-desktop, apex, json)
   * @param servers - Servers to include (defaults to all configured)
   * @returns Generated configuration object
   */
  generateConfig(
    format: MCPConfigFormat,
    servers?: string[]
  ): ClaudeDesktopConfig | MCPConfig;

  /**
   * Generate claude_desktop_config.json format
   * @param servers - Servers to include
   * @returns Claude Desktop compatible configuration
   */
  generateClaudeDesktopConfig(servers?: string[]): ClaudeDesktopConfig;

  /**
   * Export configuration to a file
   * @param format - Target format
   * @param outputPath - Output file path (defaults based on format)
   * @param servers - Servers to include
   */
  exportConfig(
    format: MCPConfigFormat,
    outputPath?: string,
    servers?: string[]
  ): Promise<void>;

  // =========================================================================
  // Environment Variable Detection
  // =========================================================================

  /**
   * Detect required environment variables for a server
   * @param serverId - Server identifier or template ID
   * @returns Detection result with found/missing variables
   */
  detectEnvironmentVariables(serverId: string): Promise<EnvVarDetectionResult>;

  /**
   * Detect environment variables for all configured servers
   * @returns Map of server ID to detection results
   */
  detectAllEnvironmentVariables(): Promise<Map<string, EnvVarDetectionResult>>;

  /**
   * Resolve environment variable value from multiple sources
   * @param varName - Variable name
   * @param sources - Sources to check (env, config, user)
   * @returns Resolved value and source, or undefined
   */
  resolveEnvVariable(
    varName: string,
    sources?: Array<'env' | 'config' | 'user'>
  ): { value: string; source: 'env' | 'config' | 'user' } | undefined;

  // =========================================================================
  // Server Templates
  // =========================================================================

  /**
   * Get available server templates
   * @param category - Optional category filter
   * @returns Array of server templates
   */
  getServerTemplates(category?: string): MCPServerTemplate[];

  /**
   * Get a specific server template by ID
   * @param templateId - Template identifier
   * @returns Template or undefined
   */
  getServerTemplate(templateId: string): MCPServerTemplate | undefined;

  /**
   * Register custom server template
   * @param template - Template to register
   */
  registerTemplate(template: MCPServerTemplate): void;

  /**
   * Generate server configuration from template
   * @param templateId - Template identifier
   * @param overrides - Configuration overrides
   * @returns Generated server configuration
   */
  generateFromTemplate(
    templateId: string,
    overrides?: Partial<MCPServerConfig>
  ): MCPServerConfig;

  // =========================================================================
  // Configuration Validation
  // =========================================================================

  /**
   * Validate MCP configuration
   * @param config - Configuration to validate
   * @returns Validation result
   */
  validateConfig(config: MCPConfig): ConfigValidationResult;

  /**
   * Validate a single server configuration
   * @param serverConfig - Server configuration to validate
   * @returns Validation result
   */
  validateServerConfig(serverConfig: MCPServerConfig): ConfigValidationResult;

  /**
   * Validate environment variables for a server
   * @param serverId - Server identifier
   * @returns Validation result focusing on env vars
   */
  validateEnvironmentVariables(serverId: string): Promise<ConfigValidationResult>;

  // =========================================================================
  // Configuration Application
  // =========================================================================

  /**
   * Apply configuration to APEX
   * @param config - Configuration to apply
   * @param options - Apply options
   */
  applyConfig(
    config: MCPConfig,
    options?: {
      merge?: boolean;     // Merge with existing (default: true)
      validate?: boolean;  // Validate before applying (default: true)
      backup?: boolean;    // Create backup (default: true)
    }
  ): Promise<void>;

  /**
   * Import configuration from external format
   * @param source - Source path or configuration object
   * @param format - Source format
   */
  importConfig(
    source: string | ClaudeDesktopConfig,
    format: MCPConfigFormat
  ): Promise<MCPConfig>;
}
```

### Built-in Server Templates

The MCPConfigurator includes a comprehensive registry of server templates:

```typescript
// packages/orchestrator/src/mcp/templates.ts

export const BUILTIN_TEMPLATES: MCPServerTemplate[] = [
  // Filesystem
  {
    id: 'filesystem',
    name: 'Filesystem Server',
    description: 'Read and write files, list directories',
    package: '@modelcontextprotocol/server-filesystem',
    config: {
      name: 'filesystem',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '{{PROJECT_PATH}}'],
      capabilities: ['filesystem'],
    },
    envVars: [],
    capabilities: ['filesystem', 'read', 'write'],
    verified: true,
  },

  // Git
  {
    id: 'git',
    name: 'Git Server',
    description: 'Git operations - status, diff, commit, log',
    package: '@modelcontextprotocol/server-git',
    config: {
      name: 'git',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git', '--repository', '{{PROJECT_PATH}}'],
      capabilities: ['git', 'vcs'],
    },
    envVars: [],
    capabilities: ['git', 'vcs'],
    verified: true,
  },

  // GitHub
  {
    id: 'github',
    name: 'GitHub Integration',
    description: 'GitHub API operations - issues, PRs, repos',
    package: '@modelcontextprotocol/server-github',
    config: {
      name: 'github',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      capabilities: ['github', 'api'],
    },
    envVars: [
      {
        name: 'GITHUB_PERSONAL_ACCESS_TOKEN',
        description: 'GitHub Personal Access Token for API access',
        required: true,
        sensitive: true,
        pattern: '^(gh[ps]_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})$',
      },
    ],
    capabilities: ['github', 'api', 'issues', 'prs'],
    verified: true,
  },

  // PostgreSQL
  {
    id: 'postgres',
    name: 'PostgreSQL Server',
    description: 'PostgreSQL database operations',
    package: '@modelcontextprotocol/server-postgres',
    config: {
      name: 'postgres',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres'],
      capabilities: ['database', 'postgres'],
    },
    envVars: [
      {
        name: 'POSTGRES_CONNECTION_STRING',
        description: 'PostgreSQL connection string',
        required: true,
        sensitive: true,
        pattern: '^postgres(ql)?://.*$',
      },
    ],
    capabilities: ['database', 'postgres', 'sql'],
    verified: true,
  },

  // Slack
  {
    id: 'slack',
    name: 'Slack Integration',
    description: 'Slack messaging and channel operations',
    package: '@modelcontextprotocol/server-slack',
    config: {
      name: 'slack',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      capabilities: ['slack', 'messaging'],
    },
    envVars: [
      {
        name: 'SLACK_BOT_TOKEN',
        description: 'Slack Bot OAuth Token',
        required: true,
        sensitive: true,
        pattern: '^xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9]+$',
      },
      {
        name: 'SLACK_TEAM_ID',
        description: 'Slack Team/Workspace ID',
        required: false,
        sensitive: false,
      },
    ],
    capabilities: ['slack', 'messaging', 'channels'],
    verified: true,
  },

  // Puppeteer
  {
    id: 'puppeteer',
    name: 'Puppeteer Browser',
    description: 'Browser automation via Puppeteer',
    package: '@modelcontextprotocol/server-puppeteer',
    config: {
      name: 'puppeteer',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      capabilities: ['browser', 'automation'],
    },
    envVars: [],
    capabilities: ['browser', 'automation', 'puppeteer'],
    verified: true,
  },

  // Fetch (HTTP)
  {
    id: 'fetch',
    name: 'HTTP Fetch Server',
    description: 'HTTP requests with URL fetching',
    package: '@modelcontextprotocol/server-fetch',
    config: {
      name: 'fetch',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-fetch'],
      capabilities: ['http', 'fetch'],
    },
    envVars: [],
    capabilities: ['http', 'fetch', 'web'],
    verified: true,
  },

  // Memory
  {
    id: 'memory',
    name: 'Memory Server',
    description: 'Key-value storage for conversation context',
    package: '@modelcontextprotocol/server-memory',
    config: {
      name: 'memory',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      capabilities: ['memory', 'storage'],
    },
    envVars: [],
    capabilities: ['memory', 'storage', 'context'],
    verified: true,
  },

  // Sequential Thinking
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    description: 'Chain-of-thought reasoning support',
    package: '@modelcontextprotocol/server-sequential-thinking',
    config: {
      name: 'sequential-thinking',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      capabilities: ['reasoning', 'thinking'],
    },
    envVars: [],
    capabilities: ['reasoning', 'thinking', 'cot'],
    verified: true,
  },

  // Brave Search
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search via Brave Search API',
    package: '@modelcontextprotocol/server-brave-search',
    config: {
      name: 'brave-search',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      capabilities: ['search', 'web'],
    },
    envVars: [
      {
        name: 'BRAVE_API_KEY',
        description: 'Brave Search API key',
        required: true,
        sensitive: true,
      },
    ],
    capabilities: ['search', 'web'],
    verified: true,
  },

  // Sentry
  {
    id: 'sentry',
    name: 'Sentry',
    description: 'Error monitoring and issue tracking',
    package: '@modelcontextprotocol/server-sentry',
    config: {
      name: 'sentry',
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-sentry'],
      capabilities: ['monitoring', 'errors'],
    },
    envVars: [
      {
        name: 'SENTRY_AUTH_TOKEN',
        description: 'Sentry authentication token',
        required: true,
        sensitive: true,
      },
      {
        name: 'SENTRY_ORG',
        description: 'Sentry organization slug',
        required: false,
        sensitive: false,
      },
    ],
    capabilities: ['monitoring', 'errors', 'sentry'],
    verified: true,
  },
];
```

### Claude Desktop Configuration Format

The `claude_desktop_config.json` format is:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

### Environment Variable Detection Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Environment Variable Detection                            │
│                                                                             │
│  Sources (in priority order):                                               │
│                                                                             │
│  1. Process Environment (process.env)                                       │
│     └── Runtime environment variables                                       │
│                                                                             │
│  2. Configuration Files                                                     │
│     ├── .apex/config.yaml (mcp.servers.<name>.env)                         │
│     └── .apex/config.yaml (mcp.servers.<name>.envVars)                     │
│                                                                             │
│  3. Environment Files                                                       │
│     ├── .env                                                               │
│     ├── .env.local                                                         │
│     └── .env.development                                                   │
│                                                                             │
│  4. Template Defaults                                                       │
│     └── MCPServerTemplate.envVars[].defaultValue                           │
│                                                                             │
│  Validation:                                                                │
│     ├── Required check: envVar.required === true                           │
│     ├── Pattern match: value.match(envVar.pattern)                         │
│     └── Sensitivity: mask if envVar.sensitive === true                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Validation Rules

| Rule | Error Code | Description |
|------|------------|-------------|
| Missing command | `MISSING_REQUIRED_FIELD` | stdio servers require command |
| Missing URL | `MISSING_REQUIRED_FIELD` | http/sse servers require url |
| Invalid URL format | `INVALID_URL` | URL must be valid format |
| Missing required env | `MISSING_ENV_VAR` | Required env var not found |
| Unknown server type | `UNKNOWN_SERVER_TYPE` | type must be stdio, http, sse, or sdk |
| Conflicting config | `CONFLICTING_CONFIG` | Both command and url specified for stdio |

### Integration Points

1. **CLI Commands**
   ```bash
   # Generate Claude Desktop config
   apex mcp export --format claude-desktop --output ~/Library/Application\ Support/Claude/claude_desktop_config.json

   # Detect missing env vars
   apex mcp check-env

   # Generate from template
   apex mcp add github --env GITHUB_TOKEN=ghp_...

   # Validate configuration
   apex mcp validate
   ```

2. **API Endpoints**
   ```typescript
   // POST /mcp/config/generate
   // POST /mcp/config/validate
   // GET /mcp/templates
   // GET /mcp/templates/:id
   // POST /mcp/config/export
   // POST /mcp/env/detect
   ```

3. **Orchestrator Integration**
   ```typescript
   const configurator = orchestrator.getMCPConfigurator();

   // Auto-configure for project
   const detection = await configurator.detectAllEnvironmentVariables();
   if (detection.missing.length > 0) {
     // Prompt user for missing env vars
   }

   // Generate and export
   await configurator.exportConfig('claude-desktop');
   ```

## File Structure

```
packages/orchestrator/src/mcp/
├── index.ts                    # Add MCPConfigurator export
├── configurator.ts             # NEW: MCPConfigurator class
├── configurator.test.ts        # NEW: Unit tests
├── templates.ts                # NEW: Built-in server templates
├── templates.test.ts           # NEW: Template tests
├── env-detector.ts             # NEW: Environment variable detection
├── env-detector.test.ts        # NEW: Env detection tests
├── config-validator.ts         # NEW: Configuration validation
├── config-validator.test.ts    # NEW: Validation tests
├── server-manager.ts           # Existing
├── marketplace-service.ts      # Existing
├── client.ts                   # Existing
└── connection-manager.ts       # Existing
```

## Consequences

### Positive
- Unified configuration management for MCP servers
- Claude Desktop compatibility enables broader ecosystem integration
- Environment variable detection reduces misconfiguration errors
- Template system accelerates server setup
- Comprehensive validation catches issues before runtime

### Negative
- Additional complexity in MCP module
- Template registry requires maintenance as MCP ecosystem evolves
- Multiple configuration formats to support

### Risks
- Claude Desktop config format may change
- Environment variable patterns may not match all valid formats
- Template configurations may become outdated

## Implementation Notes

### Dependencies
- No new external dependencies required
- Uses existing Zod schemas for validation
- Uses existing `dotenv` patterns for env file parsing

### Testing Strategy
1. Unit tests for configuration generation
2. Unit tests for validation logic
3. Integration tests for env detection
4. Snapshot tests for config format compliance

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [Claude Desktop Configuration](https://claude.ai/docs/desktop)
- ADR-051: MCP Installer Service
- Existing `MCPServerManager` implementation
- Existing `MCPMarketplaceService` implementation
