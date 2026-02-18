# APEX System Integration Guide

## Overview

This document provides comprehensive documentation for APEX's three core integration systems:

1. **Tools System** - Claude Agent SDK integration, custom tools, and MCP server ecosystem
2. **Permissions System** - Fine-grained access control and autonomy management
3. **Browser Automation System** - Playwright-based web interaction and testing

These systems work together to provide a secure, extensible, and powerful AI agent platform.

## 🔧 Tools System

### Architecture

The tools system is built on three foundational layers:

1. **Claude Agent SDK Tools** - Core tools provided by the SDK (Read, Write, Edit, Bash, etc.)
2. **Custom APEX Tools** - Platform-specific tools (Browser, MCP integration, etc.)
3. **MCP Server Integration** - Model Context Protocol servers for external capabilities

### Core Claude Agent SDK Tools

APEX leverages the Claude Agent SDK's built-in tools with enhanced permission integration:

#### Filesystem Tools
- **Read** - File reading with directory access controls
- **Write** - File creation/modification with safety checks
- **Edit** - In-place file editing with validation
- **Glob** - File pattern matching with path restrictions

#### Search Tools
- **Grep** - Content searching with file type filtering
- **WebSearch** - Web search with domain restrictions

#### System Tools
- **Bash** - Command execution with sandboxing
- **WebFetch** - HTTP requests with security controls

```typescript
// Example: Using Claude Agent SDK tools with APEX permission integration
const result = await apex.tools.execute('Read', {
  file_path: '/project/src/config.ts',
  // Permission automatically checked against filesystem config
});

if (result.success) {
  console.log('File content:', result.content);
}
```

### Custom APEX Tools

#### Tool Categories

Tools are organized into categories for better management:

```typescript
export const ToolCategorySchema = z.enum([
  'filesystem',  // File operations
  'search',      // Content/file searching
  'shell',       // Command execution
  'web',         // Web operations
  'system',      // System-level operations
  'custom',      // User-defined tools
]);
```

#### Permission Levels

Each tool operation requires specific permission levels:

```typescript
export const ToolPermissionSchema = z.enum([
  'read',        // Read-only access
  'write',       // Write access
  'execute',     // Execute commands/scripts
  'network',     // Network access
  'admin',       // Administrative operations
]);
```

### Tool Configuration Schema

Each tool type has specific configuration options:

#### Filesystem Tools Configuration
```yaml
tools:
  filesystem:
    enabled: true
    timeout: 30000
    directoryAccess:
      allowlist: ["src/**", "docs/**"]
      blocklist: ["node_modules/**", ".git/**"]
      defaultAllow: false
    maxFileSize: 10485760  # 10MB
    allowedExtensions: [".js", ".ts", ".md"]
    blockedExtensions: [".exe", ".sh"]
```

#### Shell Tools Configuration
```yaml
tools:
  shell:
    enabled: true
    timeout: 60000
    blockedCommands: ["rm -rf /", "sudo *"]
    allowElevatedPrivileges: false
    environment:
      NODE_ENV: "development"
    workingDirectory: "/project"
```

#### Web Tools Configuration
```yaml
tools:
  web:
    enabled: true
    allowedDomains: ["*.github.com", "api.example.com"]
    blockedDomains: ["*.onion", "malicious.site"]
    maxResponseSize: 5242880  # 5MB
    followRedirects: true
```

### MCP Server Integration

#### MCP Server Configuration

APEX supports Model Context Protocol servers for extending capabilities:

```yaml
# .apex/config.yaml
mcp:
  enabled: true
  servers:
    # Filesystem server
    - id: filesystem-server
      name: Advanced File Operations
      description: Enhanced file system operations
      command: npx
      args: ["@modelcontextprotocol/server-filesystem", "/project"]
      environment:
        FILESYSTEM_ALLOWED_PATHS: "src,docs,tests"

    # Git server
    - id: git-server
      name: Git Operations
      description: Advanced git repository operations
      command: mcp-git-server
      args: ["--repo", ".", "--allow-push", "false"]

    # Database server
    - id: database-server
      name: Database Operations
      description: Database queries and operations
      command: mcp-database-server
      args: ["--connection-string", "${DATABASE_URL}"]
      environment:
        DB_MAX_CONNECTIONS: "10"

  # Global settings
  timeout: 30000
  maxRetries: 3
  autoRestart: true
  logLevel: info
```

#### MCP Connection Management

```typescript
// Connection manager handles MCP server lifecycle
export interface MCPConnectionManagerOptions {
  projectPath: string;
  config: ApexConfig;
  connectionConfig?: MCPConnectionConfig;
}

// Events emitted by connection manager
export interface MCPConnectionManagerEvents {
  'connected': (connection: MCPConnection) => void;
  'disconnected': (serverId: string, reason?: string) => void;
  'error': (serverId: string, error: Error) => void;
  'tool:start': (event: MCPToolStartEvent) => void;
  'tool:complete': (event: MCPToolCompleteEvent) => void;
}
```

#### Using MCP Tools

```typescript
// Execute MCP tool
const result = await apex.mcp.executeTool('filesystem-server', 'analyze-directory', {
  path: '/src/components',
  recursive: true
});

// Check MCP tool permissions
const permission = await apex.permissions.checkMCPPermission(
  'database-server',
  'query'
);
```

### Tool Registry and Discovery

```typescript
// Register custom tools
import { ToolRegistry } from '@apexcli/core';

class CustomAnalyticsTool extends BaseTool {
  static metadata = {
    id: 'analytics',
    name: 'Analytics Tool',
    description: 'Custom analytics operations',
    permissions: ['read', 'network']
  };

  async execute(params: any) {
    // Tool implementation
  }
}

ToolRegistry.register(CustomAnalyticsTool);
```

## 🛡️ Permissions System

### Permission Levels

The permission system provides three levels of access control:

```typescript
export const PermissionLevelSchema = z.enum([
  'allow-always',  // Permanent permission
  'allow-once',    // Single-use permission
  'deny',          // Block operation
]);
```

### Permission Presets

#### Autonomous Preset
```yaml
permissions:
  preset: autonomous
  persistence: true
```
- All standard operations auto-approved
- Elevated operations may still require confirmation
- Best for trusted, repetitive workflows

#### Review All Preset
```yaml
permissions:
  preset: reviewAll
  persistence: true
```
- Every operation requires approval
- Detailed operation descriptions shown
- Best for learning or sensitive environments

#### Read Only Preset
```yaml
permissions:
  preset: readOnly
  persistence: true
```
- Read operations auto-approved
- Write operations blocked
- Best for code review and analysis

### Per-Tool Permission Configuration

Each tool type supports specific permission controls:

#### Base Tool Configuration
```typescript
export const BaseToolPermissionConfigSchema = z.object({
  enabled: z.boolean().optional().default(true),
  timeout: z.number().int().min(0).optional().default(0),
  requireConfirmation: z.boolean().optional().default(false),
  rateLimitPerMinute: z.number().int().min(0).optional().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

#### Filesystem Tool Permissions
```typescript
export const FilesystemToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  directoryAccess: DirectoryAccessConfigSchema.optional(),
  maxFileSize: z.number().int().min(0).optional().default(0),
  allowedExtensions: z.array(z.string()).optional().default([]),
  blockedExtensions: z.array(z.string()).optional().default([]),
});
```

#### Browser Tool Permissions
```typescript
export const BrowserToolConfigSchema = BaseToolPermissionConfigSchema.extend({
  allowedDomains: z.array(z.string()).optional().default([]),
  blockedDomains: z.array(z.string()).optional().default([]),
  allowJavaScriptExecution: z.boolean().optional(),
  allowFormSubmission: z.boolean().optional(),
  pageLoadTimeout: z.number().int().min(0).optional(),
  allowDownloads: z.boolean().optional(),
  allowScreenshots: z.boolean().optional(),
  engine: z.enum(['chromium', 'firefox', 'webkit']).optional(),
});
```

### Directory Access Control

```typescript
export const DirectoryAccessConfigSchema = z.object({
  allowlist: z.array(z.string()).optional().default([]),
  blocklist: z.array(z.string()).optional().default([]),
  defaultAllow: z.boolean().optional(),
  resolveSymlinks: z.boolean().optional().default(true),
  maxDepth: z.number().int().min(0).optional().default(0),
});
```

Example configuration:
```yaml
permissions:
  directoryAccess:
    mode: allowlist
    allowedPaths:
      - 'src/**/*.{js,ts,tsx}'
      - 'test/**/*.{test,spec}.{js,ts}'
      - 'docs/**/*.md'
    blockedPaths:
      - 'node_modules/**'
      - '.git/**'
      - '*.log'
    sensitive:
      - '.env*'
      - '*.key'
      - 'credentials/**'
```

### Permission Events

The permission system emits events for monitoring:

```typescript
interface PermissionEvent {
  timestamp: Date;
  tool: string;
  scope?: string;
  level?: PermissionLevel;
  reason?: string;
  context?: any;
  userId?: string;
  sessionId: string;
}
```

Usage example:
```typescript
apex.permissions.on('permission:denied', (event) => {
  console.log(`Access denied: ${event.tool}:${event.scope}`);
  if (event.tool === 'bash' && event.context?.command?.includes('rm')) {
    sendSecurityAlert(`Dangerous command blocked: ${event.context.command}`);
  }
});
```

### CLI Permission Commands

```bash
# List permissions
apex permissions list
apex permissions list browser

# Grant permissions
apex permissions grant browser allow-always
apex permissions grant browser:navigate allow-once

# Manage sessions
apex permissions session
apex permissions reset-session
```

## 🌐 Browser Automation System

### Architecture

The browser automation system is built on Playwright and provides:

- Multi-browser support (Chromium, Firefox, WebKit)
- Permission-integrated operations
- Screenshot capture and visual regression testing
- Console monitoring and error detection
- Form automation capabilities

### Browser Tool Operations

```typescript
export type BrowserOperation =
  | 'navigate'           // Navigate to URLs
  | 'click'              // Click elements
  | 'type'               // Type text
  | 'screenshot'         // Capture screenshots
  | 'compareScreenshot'  // Visual regression testing
  | 'evaluate'           // Execute JavaScript (elevated)
  | 'submit'             // Submit forms (elevated)
  | 'waitForSelector'    // Wait for elements
  | 'getAttribute'       // Get element attributes
  | 'getText'            // Get element text
  | 'getHtml'            // Get page HTML
  | 'scroll'             // Scroll page
  | 'hover';             // Hover elements
```

### Configuration

#### Basic Browser Configuration
```yaml
tools:
  browser:
    enabled: true
    engine: chromium          # chromium, firefox, webkit
    headless: true
    timeout: 30000
    allowedDomains:
      - localhost
      - '*.local'
      - 'test.example.com'
    blockedDomains:
      - '*.onion'
      - 'malicious.site'
```

#### Advanced Browser Configuration
```yaml
tools:
  browser:
    enabled: true
    backend: playwright
    engine: chromium

    # Launch options
    launchOptions:
      slowMo: 0
      devtools: false
      args:
        - '--no-sandbox'
        - '--disable-dev-shm-usage'

    # Context options
    contextOptions:
      viewport:
        width: 1920
        height: 1080
      userAgent: 'APEX/1.0'
      locale: 'en-US'
      timezoneId: 'America/New_York'

    # Security settings
    security:
      allowedDomains: ['localhost', '*.test.local']
      blockResources: ['image', 'font']
      interceptRequests: true

    # Permission controls
    permissions:
      allowJavaScriptExecution: false
      allowFormSubmission: true
      allowDownloads: false
      allowScreenshots: true
```

### Usage Examples

#### Basic Navigation and Interaction
```typescript
// Navigate to page
const navResult = await apex.browser.navigate({
  url: 'https://localhost:3000',
  waitUntil: 'networkidle'
});

// Click element
const clickResult = await apex.browser.click({
  selector: '#submit-button',
  button: 'left'
});

// Type text
const typeResult = await apex.browser.type({
  selector: '#username',
  text: 'testuser',
  delay: 50
});
```

#### Screenshot Capture
```typescript
// Basic screenshot
const screenshot = await apex.browser.screenshot({
  filename: 'page-capture.png',
  fullPage: true
});

// Element screenshot
const elementShot = await apex.browser.screenshot({
  filename: 'button.png',
  selector: '#important-button'
});
```

#### Visual Regression Testing
```typescript
// Compare screenshots
const comparison = await apex.browser.compareScreenshot({
  baseline: 'baseline.png',
  current: 'current.png',
  threshold: 0.2,
  diffFilename: 'diff.png'
});

if (!comparison.identical) {
  console.log(`Visual difference: ${comparison.difference}%`);
}
```

### Browser Tool Implementation

The BrowserTool class integrates with the permission system:

```typescript
export interface BrowserToolOptions {
  permissionManager?: PermissionManager;
  backend?: 'playwright' | 'puppeteer';
  engine?: 'chromium' | 'firefox' | 'webkit';
  headless?: boolean;
  eventEmitter?: EventEmitter;
  taskId?: string;
}
```

Key features:
- **Permission Integration** - Each operation checks permissions
- **Domain Security** - Allowlist/blocklist domain controls
- **Console Monitoring** - Captures browser console logs and errors
- **Visual Comparison** - Built-in screenshot diffing
- **Event Emission** - Broadcasts automation events

### Console Stream Integration

The browser tool includes enhanced console monitoring:

```typescript
interface BrowserConsoleMessage {
  level: ConsoleLogLevel;
  text: string;
  args?: any[];
  location?: {
    url: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  timestamp: Date;
}

interface BrowserRuntimeError {
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  timestamp: Date;
}
```

## 🔗 System Integration Points

### Tools ↔ Permissions Integration

1. **Permission Checking**: All tool executions check permissions first
2. **Scoped Permissions**: Tools can request specific scope permissions
3. **Dynamic Approval**: Users can grant temporary or permanent access
4. **Security Policies**: Per-tool security configurations

```typescript
// Example permission check flow
const permission = await permissionManager.checkToolPermission({
  tool: 'browser',
  scope: 'navigate',
  context: { domain: 'example.com' }
});

if (!permission.granted) {
  throw new Error(`Permission denied: ${permission.reason}`);
}
```

### MCP ↔ Permissions Integration

1. **MCP Tool Discovery**: Automatic discovery of MCP server capabilities
2. **Permission Mapping**: MCP tools mapped to APEX permission system
3. **Secure Execution**: All MCP tool calls go through permission checks
4. **Resource Management**: Connection pooling and health monitoring

### Browser ↔ Security Integration

1. **Domain Control**: Domain-based access restrictions
2. **Operation Gating**: Elevated operations require explicit approval
3. **Console Monitoring**: Real-time JavaScript error detection
4. **Resource Blocking**: Block images/fonts for performance
5. **Request Interception**: Monitor and filter network requests

## 🚀 Best Practices

### Security Best Practices

1. **Principle of Least Privilege**: Start with restrictive permissions
2. **Regular Audits**: Review and cleanup unused permissions
3. **Environment Separation**: Different configs for dev/prod
4. **Monitoring**: Set up alerts for permission denials

### Performance Best Practices

1. **Tool Caching**: Cache tool results where appropriate
2. **Connection Pooling**: Reuse MCP connections
3. **Resource Limits**: Set appropriate timeouts and size limits
4. **Batch Operations**: Group related tool executions

### Development Best Practices

1. **Permission Testing**: Test with different permission levels
2. **Error Handling**: Implement robust error recovery
3. **Event Monitoring**: Subscribe to relevant system events
4. **Documentation**: Document custom tools and permissions

## 📊 Monitoring and Debugging

### Events and Logging

All three systems emit events for monitoring:

- **Tool Events**: tool:start, tool:complete, tool:error
- **Permission Events**: permission:requested, permission:granted, permission:denied
- **Browser Events**: browser:navigate, browser:screenshot, browser:error
- **MCP Events**: mcp:connected, mcp:disconnected, mcp:tool:execute

### Debug Configuration

```yaml
debug:
  enabled: true
  logLevel: verbose
  traceEvents: true
  permissionDebug: true
  toolExecutionTrace: true
```

### CLI Debugging

```bash
# Enable debug mode
apex config set debug.enabled true

# View system events
apex events --follow --filter browser

# Check permission logs
apex logs permissions

# Monitor tool executions
apex tools monitor --tool browser
```

## 📋 Configuration Reference

### Complete Configuration Example

```yaml
# .apex/config.yaml
tools:
  # Filesystem tools
  filesystem:
    enabled: true
    directoryAccess:
      allowlist: ["src/**", "docs/**", "tests/**"]
      blocklist: ["node_modules/**", ".git/**"]
    maxFileSize: 10485760
    allowedExtensions: [".js", ".ts", ".md", ".json"]

  # Shell tools
  shell:
    enabled: true
    blockedCommands: ["rm -rf", "sudo", "dd"]
    workingDirectory: "/project"

  # Web tools
  web:
    enabled: true
    allowedDomains: ["github.com", "*.stackoverfow.com"]
    maxResponseSize: 5242880

  # Browser tools
  browser:
    enabled: true
    engine: chromium
    headless: true
    allowedDomains: ["localhost", "*.test.local"]
    allowScreenshots: true
    allowJavaScriptExecution: false

# Permissions
permissions:
  preset: reviewAll
  persistence: true
  directoryAccess:
    mode: allowlist
    allowedPaths: ["src/**", "docs/**"]

# MCP Servers
mcp:
  enabled: true
  servers:
    - id: filesystem
      command: npx
      args: ["@modelcontextprotocol/server-filesystem", "."]
    - id: git
      command: mcp-git-server
      args: ["--repo", "."]

# Debug settings
debug:
  enabled: false
  logLevel: info
```

This comprehensive integration guide covers the architecture, configuration, and usage of APEX's three core systems. The systems work together to provide a secure, extensible, and powerful platform for AI agent automation.