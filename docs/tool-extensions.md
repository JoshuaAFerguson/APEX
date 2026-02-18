# Tool Extensions

## Overview

APEX's tool extension system allows developers to create custom tools, integrate Model Context Protocol (MCP) servers, and extend the platform's capabilities. The system provides powerful hooks, tool registration, and seamless integration with APEX's permission and autonomy systems.

## Custom Tools

### Basic Tool Definition

```typescript
// custom-tools/database-tool.ts
import { BaseTool } from '@apexcli/core';

export class DatabaseTool extends BaseTool {
  static readonly metadata = {
    id: 'database',
    name: 'Database Operations',
    description: 'Execute database queries and operations',
    version: '1.0.0',
    author: 'Your Team',
    permissions: ['database:read', 'database:write'],
    category: 'data'
  };

  async execute(params: {
    query: string;
    database?: string;
    readonly?: boolean;
  }) {
    // Validate permissions
    const permission = await this.checkPermission(
      params.readonly ? 'database:read' : 'database:write'
    );

    if (!permission.granted) {
      return this.error(`Permission denied: ${permission.reason}`);
    }

    try {
      const connection = await this.getConnection(params.database);
      const result = await connection.query(params.query);

      return this.success({
        rows: result.rows,
        rowCount: result.rowCount,
        duration: result.duration
      });
    } catch (error) {
      return this.error(`Database error: ${error.message}`);
    }
  }

  private async getConnection(database?: string) {
    // Database connection logic
  }
}
```

### Tool Registration

```typescript
// Register custom tool
import { ToolRegistry } from '@apexcli/core';
import { DatabaseTool } from './custom-tools/database-tool';

ToolRegistry.register(DatabaseTool);

// Register tool with configuration
ToolRegistry.register(DatabaseTool, {
  enabled: true,
  permissions: {
    requireConfirmation: true,
    allowedDatabases: ['development', 'staging']
  },
  config: {
    connectionTimeout: 30000,
    queryTimeout: 60000,
    maxRows: 1000
  }
});
```

### Configuration

```yaml
# .apex/config.yaml
tools:
  custom:
    database:
      enabled: true
      permissions:
        requireConfirmation: true
        allowedDatabases:
          - development
          - staging
      config:
        host: localhost
        port: 5432
        database: myapp_dev
        connectionTimeout: 30000
        queryTimeout: 60000
        maxRows: 1000
```

## Tool Hooks

### Pre-execution Hooks

```typescript
// Register pre-execution hook
apex.tools.addHook('beforeExecute', async (context) => {
  console.log(`Executing tool: ${context.toolName}`);

  // Validate context
  if (context.toolName === 'bash' && context.params.command?.includes('rm -rf')) {
    return {
      allowed: false,
      reason: 'Dangerous command detected'
    };
  }

  // Add context
  context.metadata.executionId = generateUniqueId();
  context.metadata.startTime = Date.now();

  return { allowed: true };
});

// Tool-specific pre-execution hook
apex.tools.addHook('beforeExecute:database', async (context) => {
  // Validate database connection
  const isConnected = await testDatabaseConnection(context.params.database);

  if (!isConnected) {
    return {
      allowed: false,
      reason: 'Database connection failed'
    };
  }

  // Log database access
  await logDatabaseAccess({
    user: context.user,
    database: context.params.database,
    query: context.params.query,
    timestamp: new Date()
  });

  return { allowed: true };
});
```

### Post-execution Hooks

```typescript
// Register post-execution hook
apex.tools.addHook('afterExecute', async (context, result) => {
  const duration = Date.now() - context.metadata.startTime;

  console.log(`Tool ${context.toolName} completed in ${duration}ms`);

  // Log execution metrics
  await apex.metrics.record({
    tool: context.toolName,
    duration,
    success: result.success,
    timestamp: new Date()
  });

  // Send notifications for long-running operations
  if (duration > 60000) { // 1 minute
    await sendNotification({
      type: 'tool_execution_slow',
      tool: context.toolName,
      duration,
      result: result.success ? 'success' : 'failure'
    });
  }

  return result;
});

// Error handling hook
apex.tools.addHook('onError', async (context, error) => {
  console.error(`Tool ${context.toolName} failed:`, error);

  // Send error notifications
  await sendErrorNotification({
    tool: context.toolName,
    error: error.message,
    context: context.params,
    timestamp: new Date()
  });

  // Automatic retry for transient errors
  if (isTransientError(error) && context.retryCount < 3) {
    console.log(`Retrying ${context.toolName} (attempt ${context.retryCount + 1})`);
    return { retry: true, delay: 1000 * Math.pow(2, context.retryCount) };
  }

  return { retry: false };
});
```

## Model Context Protocol (MCP) Integration

### MCP Server Configuration

```yaml
# .apex/config.yaml
mcp:
  enabled: true
  servers:
    # File operations server
    - id: file-server
      name: File Operations Server
      description: Advanced file operations and analysis
      command: npx
      args:
        - @modelcontextprotocol/server-filesystem
        - /project/root
      environment:
        FILESYSTEM_ALLOWED_PATHS: "src,docs,tests"
        FILESYSTEM_BLOCKED_PATHS: "node_modules,.git"

    # Git operations server
    - id: git-server
      name: Git Operations Server
      description: Git repository operations
      command: mcp-git-server
      args:
        - --repo
        - .
        - --allow-push
        - false

    # Database server
    - id: database-server
      name: Database Server
      description: Database operations and queries
      command: mcp-database-server
      args:
        - --connection-string
        - postgresql://user:pass@localhost:5432/db
      environment:
        DB_MAX_CONNECTIONS: "10"
        DB_TIMEOUT: "30000"

    # API client server
    - id: api-server
      name: API Client Server
      description: HTTP API operations
      command: mcp-http-server
      args:
        - --base-url
        - https://api.example.com
      environment:
        API_KEY: ${API_KEY}
        RATE_LIMIT: "100"

  # Global MCP settings
  timeout: 30000
  maxRetries: 3
  autoRestart: true
  logLevel: info
```

### MCP Server Management

```typescript
// Start MCP servers
const mcpManager = await apex.mcp.createManager();

// Start specific server
await mcpManager.startServer('file-server');

// Start all configured servers
await mcpManager.startAllServers();

// Monitor server status
mcpManager.on('server:started', (serverId) => {
  console.log(`MCP server started: ${serverId}`);
});

mcpManager.on('server:stopped', (serverId, reason) => {
  console.log(`MCP server stopped: ${serverId}, reason: ${reason}`);
});

mcpManager.on('server:error', (serverId, error) => {
  console.error(`MCP server error: ${serverId}`, error);
});

// Discover available tools
const availableTools = await mcpManager.discoverTools();
console.log('Available MCP tools:', availableTools);
```

### MCP Tool Usage

```typescript
// Use MCP tool
const result = await apex.mcp.executeTool('file-server', 'analyze-directory', {
  path: '/src/components',
  recursive: true,
  includeMetrics: true
});

if (result.success) {
  console.log('Directory analysis:', result.data);
}

// Use MCP tool with permission checking
const permission = await apex.permissions.checkMCPPermission('database-server', 'query');

if (permission.granted) {
  const queryResult = await apex.mcp.executeTool('database-server', 'query', {
    sql: 'SELECT * FROM users WHERE active = true',
    readonly: true
  });
}
```

## Tool Aliases

### Simple Aliases

```yaml
# .apex/config.yaml
tools:
  aliases:
    # Simple command aliases
    test: bash npm test
    build: bash npm run build
    deploy: bash npm run deploy

    # Multi-step aliases
    setup:
      - bash npm install
      - bash npm run build
      - file:write path=.env content="NODE_ENV=development"

    # Conditional aliases
    test-and-deploy:
      - bash npm test
      - if: success
        then:
          - bash npm run build
          - bash npm run deploy
```

### Complex Aliases

```typescript
// Register programmatic alias
apex.tools.registerAlias('full-deployment', {
  description: 'Complete deployment pipeline',
  permissions: ['bash', 'file', 'api'],

  async execute(params: { environment: string; version?: string }) {
    const steps = [
      // Run tests
      {
        tool: 'bash',
        params: { command: 'npm test' },
        required: true
      },

      // Build application
      {
        tool: 'bash',
        params: { command: 'npm run build' },
        required: true
      },

      // Update version
      {
        tool: 'file',
        params: {
          path: 'package.json',
          operation: 'update',
          jsonPath: '$.version',
          value: params.version || 'auto-increment'
        },
        condition: () => params.version !== undefined
      },

      // Deploy to environment
      {
        tool: 'api',
        params: {
          endpoint: `/deploy/${params.environment}`,
          method: 'POST',
          data: { version: params.version }
        },
        required: true
      }
    ];

    return await this.executeSteps(steps);
  }
});
```

## Tool Marketplace Integration

### Tool Discovery

```typescript
// Search for tools in marketplace
const tools = await apex.marketplace.searchTools({
  query: 'database',
  category: 'data',
  rating: '4+',
  license: 'MIT'
});

tools.forEach(tool => {
  console.log(`${tool.name}: ${tool.description}`);
  console.log(`Rating: ${tool.rating}/5, Downloads: ${tool.downloads}`);
});

// Get tool details
const toolDetails = await apex.marketplace.getToolDetails('postgres-admin-tool');
console.log('Features:', toolDetails.features);
console.log('Requirements:', toolDetails.requirements);
console.log('Installation:', toolDetails.installation);
```

### Tool Installation

```typescript
// Install tool from marketplace
const installResult = await apex.marketplace.installTool('postgres-admin-tool', {
  version: '2.1.0',
  acceptLicense: true,
  configure: {
    defaultDatabase: 'production',
    connectionTimeout: 30000
  }
});

if (installResult.success) {
  console.log('Tool installed successfully');
  console.log('Available commands:', installResult.commands);
}

// Install multiple tools
await apex.marketplace.installBundle('web-development-bundle', {
  tools: [
    'browser-automation',
    'api-testing',
    'performance-monitoring',
    'security-scanner'
  ]
});
```

### Tool Publishing

```typescript
// Publish custom tool to marketplace
const publishResult = await apex.marketplace.publishTool({
  manifest: {
    name: 'custom-database-tool',
    version: '1.0.0',
    description: 'Advanced database operations tool',
    author: 'Your Name',
    license: 'MIT',
    category: 'data',
    keywords: ['database', 'sql', 'postgres'],
    repository: 'https://github.com/yourname/custom-database-tool'
  },

  source: './custom-tools/database-tool',
  documentation: './docs/database-tool.md',
  examples: './examples/database-tool/',

  // Testing configuration
  tests: {
    unit: 'npm test',
    integration: 'npm run test:integration',
    coverage: 90
  },

  // Security review
  security: {
    permissions: ['database:read', 'database:write'],
    sandbox: true,
    auditLog: true
  }
});
```

## Advanced Tool Features

### Tool Composition

```typescript
// Create composite tool from multiple tools
apex.tools.createComposite('web-test-suite', {
  description: 'Complete web application testing suite',

  tools: [
    { id: 'browser', operations: ['navigate', 'screenshot', 'interact'] },
    { id: 'api-client', operations: ['get', 'post', 'put', 'delete'] },
    { id: 'database', operations: ['query', 'insert', 'update'] }
  ],

  async execute(params: { baseUrl: string; testSuite: string }) {
    // Navigate to application
    const navResult = await this.browser.navigate({
      url: `${params.baseUrl}/login`
    });

    // Take baseline screenshot
    await this.browser.screenshot({
      filename: `${params.testSuite}-baseline.png`
    });

    // Test API endpoints
    const apiTests = await this.apiClient.runTestSuite({
      baseUrl: params.baseUrl,
      suite: params.testSuite
    });

    // Verify database state
    const dbVerification = await this.database.query({
      sql: 'SELECT COUNT(*) FROM test_data WHERE suite = ?',
      params: [params.testSuite]
    });

    return {
      navigation: navResult,
      apiTests,
      dbVerification,
      screenshots: [`${params.testSuite}-baseline.png`]
    };
  }
});
```

### Tool Templates

```typescript
// Create tool template for common patterns
apex.tools.createTemplate('crud-api-tool', {
  description: 'Template for CRUD API tools',

  parameters: {
    entityName: { type: 'string', required: true },
    baseUrl: { type: 'string', required: true },
    authToken: { type: 'string', required: false }
  },

  generate(params) {
    return {
      name: `${params.entityName}-api`,
      description: `CRUD operations for ${params.entityName}`,

      operations: {
        create: {
          method: 'POST',
          url: `${params.baseUrl}/${params.entityName}s`,
          auth: params.authToken
        },

        read: {
          method: 'GET',
          url: `${params.baseUrl}/${params.entityName}s/{id}`,
          auth: params.authToken
        },

        update: {
          method: 'PUT',
          url: `${params.baseUrl}/${params.entityName}s/{id}`,
          auth: params.authToken
        },

        delete: {
          method: 'DELETE',
          url: `${params.baseUrl}/${params.entityName}s/{id}`,
          auth: params.authToken
        },

        list: {
          method: 'GET',
          url: `${params.baseUrl}/${params.entityName}s`,
          auth: params.authToken
        }
      }
    };
  }
});

// Use template to generate tool
const userApiTool = apex.tools.generateFromTemplate('crud-api-tool', {
  entityName: 'user',
  baseUrl: 'https://api.example.com',
  authToken: process.env.API_TOKEN
});
```

## CLI Commands

### Tool Management

```bash
# List available tools
apex tools list

# List enabled tools
apex tools list --enabled

# Enable/disable tools
apex tools enable database
apex tools disable browser

# Tool information
apex tools info database
apex tools info --all
```

### Custom Tool Development

```bash
# Create new tool from template
apex tools create my-custom-tool --template basic

# Validate tool configuration
apex tools validate my-custom-tool

# Test tool
apex tools test my-custom-tool --params '{"query": "SELECT 1"}'

# Package tool for distribution
apex tools package my-custom-tool
```

### MCP Management

```bash
# List MCP servers
apex mcp servers

# Start/stop MCP servers
apex mcp start file-server
apex mcp stop file-server
apex mcp restart all

# Discover MCP tools
apex mcp discover

# Test MCP tool
apex mcp test file-server analyze-directory '{"path": "src"}'
```

### Marketplace Operations

```bash
# Search marketplace
apex marketplace search database

# Install tool from marketplace
apex marketplace install postgres-admin-tool

# Update installed tools
apex marketplace update

# Publish tool
apex marketplace publish ./my-tool/
```

## Best Practices

### 1. Security Considerations

```typescript
// Implement proper permission checking
export class SecureCustomTool extends BaseTool {
  async execute(params: any) {
    // Always validate permissions first
    const permission = await this.validatePermissions(params);
    if (!permission.granted) {
      return this.error(`Access denied: ${permission.reason}`);
    }

    // Sanitize inputs
    const sanitizedParams = this.sanitizeInputs(params);

    // Log security events
    await this.logSecurityEvent({
      tool: this.metadata.id,
      operation: params.operation,
      user: this.context.user,
      timestamp: new Date()
    });

    // Execute with sandbox if needed
    return this.executeSandboxed(sanitizedParams);
  }
}
```

### 2. Error Handling

```typescript
// Implement comprehensive error handling
export class RobustCustomTool extends BaseTool {
  async execute(params: any) {
    try {
      const result = await this.performOperation(params);
      return this.success(result);
    } catch (error) {
      // Log error details
      console.error(`Tool ${this.metadata.id} failed:`, error);

      // Categorize error types
      if (error instanceof ValidationError) {
        return this.error(`Invalid parameters: ${error.message}`);
      }

      if (error instanceof NetworkError) {
        return this.error(`Network error: ${error.message}`, { retryable: true });
      }

      if (error instanceof PermissionError) {
        return this.error(`Permission denied: ${error.message}`);
      }

      // Generic error handling
      return this.error(`Operation failed: ${error.message}`);
    }
  }
}
```

### 3. Performance Optimization

```typescript
// Implement caching and optimization
export class OptimizedCustomTool extends BaseTool {
  private cache = new Map();

  async execute(params: any) {
    // Check cache first
    const cacheKey = this.generateCacheKey(params);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached)) {
      return this.success(cached.data, { fromCache: true });
    }

    // Execute operation
    const result = await this.performOperation(params);

    // Cache result if cacheable
    if (this.isCacheable(params, result)) {
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: this.getCacheTTL(params)
      });
    }

    return this.success(result);
  }
}
```

For more examples and advanced patterns, see:
- [Custom Tool Examples](./examples/custom-tools/)
- [MCP Integration Patterns](./examples/mcp-integration/)
- [Tool Composition Patterns](./examples/tool-composition/)