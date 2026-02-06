# Tool System

## Overview

APEX v0.5.0 introduces a comprehensive tool system that provides complete Claude Code tool parity plus advanced features like browser automation, permission controls, and extensibility. The tool system includes built-in tools, custom tool support, and Model Context Protocol (MCP) integration for unlimited extensibility.

## Built-in Tools (Claude Code Parity)

APEX includes all essential development tools with enhanced capabilities and permission controls:

### File Operations

#### Read Tool
Read file contents with line numbers and syntax highlighting.

```typescript
// Read a file
const result = await apex.tools.read({
  file_path: 'src/components/Button.tsx',
  limit: 100,        // Optional: limit to first 100 lines
  offset: 0          // Optional: start from line 0
});

// Read with context
const contextResult = await apex.tools.read({
  file_path: 'src/utils/helpers.ts',
  limit: 50,
  offset: 100       // Start from line 100
});
```

**Features:**
- Syntax highlighting for 50+ languages
- Line number display
- Support for large files with pagination
- Binary file detection and handling
- Permission-controlled access

#### Write Tool
Create new files with content validation and safety checks.

```typescript
// Write a new file
const result = await apex.tools.write({
  file_path: 'src/components/NewComponent.tsx',
  content: `import React from 'react';

export const NewComponent: React.FC = () => {
  return <div>Hello World</div>;
};
`
});

// Write with encoding specification
const encodedResult = await apex.tools.write({
  file_path: 'data/config.json',
  content: JSON.stringify(config, null, 2),
  encoding: 'utf8'
});
```

**Features:**
- Automatic parent directory creation
- File encoding detection and conversion
- Content validation and linting
- Backup creation before write
- Permission checks for path access

#### Edit Tool
Perform surgical edits with old_string/new_string replacements.

```typescript
// Single edit operation
const result = await apex.tools.edit({
  file_path: 'src/config/database.ts',
  old_string: 'const maxConnections = 10;',
  new_string: 'const maxConnections = 20;'
});

// Replace all occurrences
const replaceAllResult = await apex.tools.edit({
  file_path: 'src/utils/logger.ts',
  old_string: 'console.log',
  new_string: 'logger.info',
  replace_all: true
});
```

**Features:**
- Exact string matching for precision
- Replace all occurrences option
- Diff preview before applying changes
- Automatic indentation preservation
- Undo capability for reversing edits

#### MultiEdit Tool
Perform multiple edits in a single atomic operation.

```typescript
// Multiple edits in one operation
const result = await apex.tools.multiEdit({
  file_path: 'src/components/App.tsx',
  edits: [
    {
      old_string: 'import { Component } from "react";',
      new_string: 'import React, { Component } from "react";'
    },
    {
      old_string: 'class App extends Component {',
      new_string: 'class App extends React.Component {'
    },
    {
      old_string: 'export default App;',
      new_string: 'export default App;\nexport { App };'
    }
  ]
});
```

**Features:**
- Atomic operations (all edits succeed or fail together)
- Conflict detection between edits
- Batch validation and preview
- Single undo point for all changes

### System Commands

#### Bash Tool
Execute shell commands with safety controls and output capture.

```typescript
// Basic command execution
const result = await apex.tools.bash({
  command: 'npm install lodash',
  description: 'Install lodash dependency'
});

// Command with working directory
const testResult = await apex.tools.bash({
  command: 'npm test -- --coverage',
  cwd: '/project/frontend',
  timeout: 300000,  // 5 minute timeout
  description: 'Run frontend tests with coverage'
});

// Background process
const serverResult = await apex.tools.bash({
  command: 'npm start',
  run_in_background: true,
  description: 'Start development server'
});
```

**Features:**
- Command validation and safety checks
- Output streaming and capture
- Working directory specification
- Timeout controls
- Background process management
- Permission-based command filtering

**Safety Controls:**
- Blocked dangerous commands (rm -rf /, sudo operations)
- Path traversal protection
- Environment variable sanitization
- Resource usage limits

### Code Search and Discovery

#### Glob Tool
Fast file pattern matching for code discovery.

```typescript
// Find TypeScript files
const tsFiles = await apex.tools.glob({
  pattern: '**/*.ts',
  path: 'src'  // Optional: search in specific directory
});

// Find test files
const testFiles = await apex.tools.glob({
  pattern: '**/*.{test,spec}.{ts,js}'
});

// Find configuration files
const configFiles = await apex.tools.glob({
  pattern: '*.{json,yaml,toml}',
  path: '.'
});
```

**Features:**
- High-performance pattern matching
- Recursive directory traversal
- Multiple pattern support with braces
- Results sorted by modification time
- Path filtering and exclusions

#### Grep Tool
Content search with powerful regex support powered by ripgrep.

```typescript
// Basic content search
const results = await apex.tools.grep({
  pattern: 'function.*useState',
  output_mode: 'content'  // Show matching lines
});

// Search in specific file types
const reactHooks = await apex.tools.grep({
  pattern: 'use[A-Z][a-zA-Z]*',
  type: 'js',           // Search only JavaScript files
  output_mode: 'files_with_matches'
});

// Search with context lines
const errorHandling = await apex.tools.grep({
  pattern: 'catch.*Error',
  glob: '**/*.ts',
  '-B': 2,              // 2 lines before
  '-A': 3,              // 3 lines after
  output_mode: 'content'
});

// Case-insensitive search
const apiCalls = await apex.tools.grep({
  pattern: 'api\\..*\\(',
  '-i': true,           // Case insensitive
  head_limit: 50        // Limit to first 50 results
});
```

**Features:**
- Full regex pattern support
- Context lines (before/after)
- File type filtering
- Case sensitivity control
- Result limiting and pagination
- Multiple output modes

### Web Operations

#### WebFetch Tool
Fetch and analyze web content with AI processing.

```typescript
// Fetch and analyze webpage
const result = await apex.tools.webFetch({
  url: 'https://api.github.com/repos/microsoft/vscode',
  prompt: 'Extract key information about this repository including stars, forks, and main language'
});

// Fetch API data
const apiData = await apex.tools.webFetch({
  url: 'https://jsonplaceholder.typicode.com/users',
  prompt: 'Analyze the user data structure and provide a summary'
});

// Fetch with custom headers
const secureData = await apex.tools.webFetch({
  url: 'https://api.internal.com/data',
  prompt: 'Extract the relevant metrics from this API response',
  headers: {
    'Authorization': 'Bearer ${API_TOKEN}',
    'Content-Type': 'application/json'
  }
});
```

**Features:**
- AI-powered content analysis
- Custom headers and authentication
- HTML to markdown conversion
- Rate limiting and timeout controls
- Response caching
- Domain-based access controls

#### WebSearch Tool
Search the web for information with AI-powered result analysis.

```typescript
// Basic web search
const results = await apex.tools.webSearch({
  query: 'TypeScript React best practices 2024',
  max_results: 10
});

// Domain-specific search
const techNews = await apex.tools.webSearch({
  query: 'JavaScript performance optimization',
  allowed_domains: ['developer.mozilla.org', 'web.dev', 'javascript.info'],
  max_results: 5
});

// Search with blocked domains
const cleanResults = await apex.tools.webSearch({
  query: 'Node.js security vulnerabilities',
  blocked_domains: ['ads.example.com', 'spam.site'],
  max_results: 15
});
```

**Features:**
- Real-time web search capability
- Domain filtering (allow/block lists)
- Result ranking and relevance scoring
- Source attribution and links
- Search result summarization

### Browser Automation

#### Browser Tool
Headless browser automation for testing and web interaction.

```typescript
// Navigate to a page
const navResult = await apex.tools.browser({
  operation: 'navigate',
  params: {
    url: 'https://localhost:3000/login',
    waitUntil: 'networkidle'
  }
});

// Click an element
const clickResult = await apex.tools.browser({
  operation: 'click',
  params: {
    selector: '#login-button',
    button: 'left'
  }
});

// Type text
const typeResult = await apex.tools.browser({
  operation: 'type',
  params: {
    selector: 'input[name="username"]',
    text: 'testuser'
  }
});

// Take screenshot
const screenshotResult = await apex.tools.browser({
  operation: 'screenshot',
  params: {
    filename: 'login-page.png',
    fullPage: true
  }
});

// Visual comparison
const compareResult = await apex.tools.browser({
  operation: 'compareScreenshot',
  params: {
    baseline: 'baseline.png',
    current: 'current.png',
    threshold: 0.1
  }
});
```

**Features:**
- Multi-browser support (Chromium, Firefox, WebKit)
- Interactive operations (click, type, scroll, hover)
- Screenshot capture and visual regression testing
- Element inspection and content extraction
- Form automation and submission
- Console log capture and error detection

### Development Tools

#### NotebookEdit Tool
Edit Jupyter notebooks with cell-level operations.

```typescript
// Add a new code cell
const result = await apex.tools.notebookEdit({
  file_path: 'analysis/data-exploration.ipynb',
  operation: 'add_cell',
  cell_type: 'code',
  content: `
import pandas as pd
import matplotlib.pyplot as plt

# Load and analyze data
df = pd.read_csv('data.csv')
df.head()
`,
  position: 3  // Insert at position 3
});

// Edit existing cell
const editResult = await apex.tools.notebookEdit({
  file_path: 'analysis/data-exploration.ipynb',
  operation: 'edit_cell',
  cell_index: 2,
  content: `
# Updated analysis
df.describe()
df.info()
`
});

// Delete cell
const deleteResult = await apex.tools.notebookEdit({
  file_path: 'analysis/data-exploration.ipynb',
  operation: 'delete_cell',
  cell_index: 5
});
```

**Features:**
- Cell-level editing operations
- Support for code, markdown, and raw cells
- Notebook metadata preservation
- Output clearing and management
- Kernel execution state handling

#### TodoWrite Tool
Manage task lists and project tracking.

```typescript
// Create task list
const result = await apex.tools.todoWrite({
  todos: [
    {
      content: 'Implement user authentication',
      status: 'pending',
      activeForm: 'Implementing user authentication'
    },
    {
      content: 'Add input validation',
      status: 'in_progress',
      activeForm: 'Adding input validation'
    },
    {
      content: 'Write unit tests',
      status: 'completed',
      activeForm: 'Writing unit tests'
    }
  ]
});

// Update task status
const updateResult = await apex.tools.todoWrite({
  todos: [
    {
      content: 'Implement user authentication',
      status: 'completed',
      activeForm: 'Implementing user authentication'
    },
    {
      content: 'Add input validation',
      status: 'completed',
      activeForm: 'Adding input validation'
    },
    {
      content: 'Deploy to staging',
      status: 'in_progress',
      activeForm: 'Deploying to staging'
    }
  ]
});
```

**Features:**
- Task status tracking (pending, in_progress, completed)
- Progress monitoring and reporting
- Task dependencies and priorities
- Time tracking and estimates
- Team collaboration features

## Tool Configuration

### Global Tool Settings

```yaml
# .apex/config.yaml
tools:
  # Enable/disable individual tools
  enabled:
    - read
    - write
    - edit
    - bash
    - browser
    - webFetch
    - webSearch
    - glob
    - grep
    - notebookEdit
    - todoWrite

  # Global tool timeouts
  timeout: 30000      # Default 30 second timeout

  # Output formatting
  formatting:
    syntaxHighlighting: true
    lineNumbers: true
    diffView: true
    wordWrap: true

  # Safety controls
  safety:
    validatePaths: true
    blockDangerous: true
    requireConfirmation: []  # Tools requiring confirmation
    dryRunMode: false       # Preview changes without executing
```

### Per-Tool Configuration

```yaml
tools:
  bash:
    timeout: 300000       # 5 minute timeout for commands
    allowedCommands:
      - 'npm *'
      - 'git *'
      - 'node *'
      - 'python *'
    blockedCommands:
      - 'rm -rf /'
      - 'sudo *'
      - 'dd if=*'
    workingDirectory: '/project'
    environment:
      NODE_ENV: 'development'
      CI: 'false'

  browser:
    engine: 'chromium'    # chromium, firefox, webkit
    headless: true
    timeout: 30000
    viewport:
      width: 1920
      height: 1080
    allowedDomains:
      - 'localhost'
      - '*.local'
      - 'staging.example.com'
    blockedDomains:
      - '*.onion'
      - 'malicious.site'

  webFetch:
    timeout: 30000
    maxRetries: 3
    allowedDomains:
      - 'github.com'
      - 'api.github.com'
      - 'docs.example.com'
    headers:
      'User-Agent': 'APEX/1.0'

  file:
    maxFileSize: 10485760  # 10MB limit
    backupOnEdit: true
    allowedExtensions:
      - '.js'
      - '.ts'
      - '.tsx'
      - '.jsx'
      - '.md'
      - '.json'
      - '.yaml'
    blockedExtensions:
      - '.exe'
      - '.bin'
      - '.so'
```

## Permission Integration

### Tool-Specific Permissions

```yaml
permissions:
  tools:
    bash:
      requireConfirmation: true
      allowedOperations:
        - 'build'
        - 'test'
        - 'install'
      blockedOperations:
        - 'system'
        - 'network'

    browser:
      requireConfirmation: false
      allowedOperations:
        - 'navigate'
        - 'click'
        - 'type'
        - 'screenshot'
      elevatedOperations:
        - 'evaluate'      # Requires explicit approval
        - 'submit'        # Requires explicit approval

    file:
      allowedPaths:
        - 'src/**'
        - 'test/**'
        - 'docs/**'
      blockedPaths:
        - 'node_modules/**'
        - '.git/**'
        - 'dist/**'
      requireConfirmation:
        - 'config/**'
        - '*.env*'

    webFetch:
      requireConfirmation: true
      allowedDomains:
        - 'api.github.com'
        - 'docs.*.com'
      blockedDomains:
        - '*.onion'
        - 'malicious.*'
```

### Permission Workflows

```typescript
// Check tool permission before execution
const permission = await apex.permissions.checkToolPermission({
  tool: 'bash',
  operation: 'execute',
  context: {
    command: 'npm install express',
    workingDir: '/project'
  }
});

if (permission.granted) {
  const result = await apex.tools.bash({
    command: 'npm install express'
  });
} else {
  console.log(`Permission denied: ${permission.reason}`);

  // Request permission
  const approval = await apex.permissions.requestApproval({
    tool: 'bash',
    operation: 'execute',
    context: { command: 'npm install express' },
    reason: 'Install required dependency for authentication feature'
  });

  if (approval.granted) {
    const result = await apex.tools.bash({
      command: 'npm install express'
    });
  }
}
```

## Tool Execution Patterns

### Sequential Execution

```typescript
// Chain tool operations
const workflow = async () => {
  // Read current configuration
  const config = await apex.tools.read({
    file_path: 'package.json'
  });

  // Modify package.json
  const updatedConfig = await apex.tools.edit({
    file_path: 'package.json',
    old_string: '"version": "1.0.0"',
    new_string: '"version": "1.1.0"'
  });

  // Install dependencies
  const install = await apex.tools.bash({
    command: 'npm install'
  });

  // Run tests
  const tests = await apex.tools.bash({
    command: 'npm test'
  });

  // Build application
  const build = await apex.tools.bash({
    command: 'npm run build'
  });

  return { config, updatedConfig, install, tests, build };
};
```

### Parallel Execution

```typescript
// Run multiple operations concurrently
const parallelWorkflow = async () => {
  const [lintResults, testResults, typeCheck] = await Promise.all([
    apex.tools.bash({ command: 'npm run lint' }),
    apex.tools.bash({ command: 'npm test' }),
    apex.tools.bash({ command: 'npm run type-check' })
  ]);

  return { lintResults, testResults, typeCheck };
};
```

### Conditional Execution

```typescript
// Execute tools based on conditions
const conditionalWorkflow = async () => {
  // Check if package.json exists
  const packageExists = await apex.tools.glob({
    pattern: 'package.json'
  });

  if (packageExists.length > 0) {
    // Install dependencies
    await apex.tools.bash({
      command: 'npm install'
    });
  } else {
    // Initialize new project
    await apex.tools.bash({
      command: 'npm init -y'
    });
  }

  // Check if tests exist
  const testFiles = await apex.tools.glob({
    pattern: '**/*.{test,spec}.{js,ts}'
  });

  if (testFiles.length > 0) {
    // Run existing tests
    await apex.tools.bash({
      command: 'npm test'
    });
  } else {
    // Create basic test structure
    await apex.tools.write({
      file_path: 'src/__tests__/index.test.js',
      content: 'describe("Basic test", () => { it("should pass", () => { expect(true).toBe(true); }); });'
    });
  }
};
```

## Error Handling and Recovery

### Robust Error Handling

```typescript
// Handle tool execution errors gracefully
const robustExecution = async (tool: string, params: any) => {
  try {
    const result = await apex.tools[tool](params);

    if (!result.success) {
      console.error(`Tool ${tool} failed:`, result.error);

      // Attempt recovery based on error type
      if (result.error.includes('permission denied')) {
        // Request permission
        const permission = await apex.permissions.requestApproval({
          tool,
          operation: 'execute',
          context: params,
          reason: 'Required for operation completion'
        });

        if (permission.granted) {
          // Retry operation
          return await apex.tools[tool](params);
        }
      }

      if (result.error.includes('timeout')) {
        // Retry with longer timeout
        return await apex.tools[tool]({
          ...params,
          timeout: params.timeout * 2
        });
      }

      throw new Error(`Tool execution failed: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`Unexpected error in tool ${tool}:`, error);
    throw error;
  }
};
```

### Automatic Retry Logic

```typescript
// Implement retry logic for transient failures
const retryableExecution = async (tool: string, params: any, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apex.tools[tool](params);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Check if error is retryable
      if (isRetryableError(result.error)) {
        console.log(`Tool ${tool} failed (attempt ${attempt}), retrying...`);

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
        );

        continue;
      } else {
        // Non-retryable error, fail immediately
        throw new Error(result.error);
      }
    } catch (error) {
      lastError = error.message;

      if (attempt === maxRetries) {
        throw new Error(`Tool ${tool} failed after ${maxRetries} attempts: ${lastError}`);
      }

      console.log(`Tool ${tool} error (attempt ${attempt}), retrying...`);
      await new Promise(resolve =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt - 1))
      );
    }
  }

  throw new Error(`Tool ${tool} failed after ${maxRetries} attempts: ${lastError}`);
};

const isRetryableError = (error: string): boolean => {
  const retryablePatterns = [
    'network error',
    'timeout',
    'connection refused',
    'temporary failure',
    'rate limit'
  ];

  return retryablePatterns.some(pattern =>
    error.toLowerCase().includes(pattern)
  );
};
```

## Best Practices

### 1. Tool Selection

```typescript
// Choose the right tool for the task
const bestPractices = {
  // File operations
  readFile: 'Use Read tool for viewing file contents',
  createFile: 'Use Write tool for new files',
  modifyFile: 'Use Edit tool for precise changes',
  batchEdit: 'Use MultiEdit for multiple changes',

  // Code discovery
  findFiles: 'Use Glob tool for pattern-based file search',
  searchContent: 'Use Grep tool for content-based search',

  // System operations
  buildProject: 'Use Bash tool for build commands',
  runTests: 'Use Bash tool with proper timeout',

  // Web operations
  fetchData: 'Use WebFetch for API calls and data retrieval',
  searchInfo: 'Use WebSearch for research and documentation',

  // Browser automation
  userTesting: 'Use Browser tool for UI interaction testing',
  visualRegression: 'Use Browser tool screenshot comparison',

  // Development workflows
  taskTracking: 'Use TodoWrite for project management',
  notebookWork: 'Use NotebookEdit for data science workflows'
};
```

### 2. Performance Optimization

```typescript
// Optimize tool usage for better performance
const performanceOptimizations = {
  // Use appropriate limits
  readLargeFiles: async () => {
    return await apex.tools.read({
      file_path: 'large-file.txt',
      limit: 100,        // Read first 100 lines
      offset: 0
    });
  },

  // Parallel operations when possible
  parallelSearch: async () => {
    const [jsFiles, tsFiles, testFiles] = await Promise.all([
      apex.tools.glob({ pattern: '**/*.js' }),
      apex.tools.glob({ pattern: '**/*.ts' }),
      apex.tools.glob({ pattern: '**/*.test.*' })
    ]);

    return { jsFiles, tsFiles, testFiles };
  },

  // Efficient content search
  efficientSearch: async () => {
    return await apex.tools.grep({
      pattern: 'function.*useState',
      type: 'js',              // Filter by file type
      head_limit: 50,          // Limit results
      output_mode: 'files_with_matches'  // Just file names
    });
  },

  // Browser automation optimization
  fastBrowser: async () => {
    return await apex.tools.browser({
      operation: 'navigate',
      params: {
        url: 'https://example.com',
        waitUntil: 'domcontentloaded'  // Don't wait for all resources
      }
    });
  }
};
```

### 3. Security Considerations

```typescript
// Implement security best practices
const securityBestPractices = {
  // Validate inputs
  validateBashCommands: async (command: string) => {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /sudo\s+/,
      /dd\s+if=/,
      /:\(\)\{.*\}\;/  // Fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Dangerous command detected: ${command}`);
      }
    }

    return await apex.tools.bash({ command });
  },

  // Sanitize file paths
  sanitizePath: (path: string) => {
    // Prevent path traversal
    const normalized = path.replace(/\.\./g, '').replace(/\/+/g, '/');

    if (normalized !== path) {
      throw new Error(`Potentially dangerous path: ${path}`);
    }

    return normalized;
  },

  // Restrict web access
  secureWebFetch: async (url: string) => {
    const allowedDomains = ['github.com', 'api.github.com', 'docs.example.com'];
    const urlObj = new URL(url);

    if (!allowedDomains.includes(urlObj.hostname)) {
      throw new Error(`Domain not allowed: ${urlObj.hostname}`);
    }

    return await apex.tools.webFetch({ url });
  }
};
```

## CLI Tool Management

### Tool Information

```bash
# List available tools
apex tools list

# List enabled tools only
apex tools list --enabled

# Get tool information
apex tools info bash
apex tools info --all

# Check tool permissions
apex tools permissions browser
```

### Tool Configuration

```bash
# Enable/disable tools
apex tools enable browser
apex tools disable webSearch

# Configure tool settings
apex config set tools.bash.timeout 600000
apex config set tools.browser.headless false

# Validate tool configuration
apex config validate tools
```

### Tool Testing

```bash
# Test tool functionality
apex tools test read --params '{"file_path": "package.json"}'
apex tools test bash --params '{"command": "echo hello"}'

# Dry run mode
apex tools test --dry-run write --params '{"file_path": "test.txt", "content": "test"}'
```

## Integration Examples

### Complete Workflow Example

```typescript
// Full development workflow using multiple tools
const developmentWorkflow = async (feature: string) => {
  // 1. Create feature branch
  await apex.tools.bash({
    command: `git checkout -b feature/${feature}`
  });

  // 2. Find relevant files
  const componentFiles = await apex.tools.glob({
    pattern: 'src/components/**/*.{tsx,ts}'
  });

  // 3. Search for similar patterns
  const patterns = await apex.tools.grep({
    pattern: 'useState|useEffect',
    type: 'js',
    output_mode: 'files_with_matches'
  });

  // 4. Read existing component for reference
  const existingComponent = await apex.tools.read({
    file_path: componentFiles[0]
  });

  // 5. Create new component
  await apex.tools.write({
    file_path: `src/components/${feature}/${feature}.tsx`,
    content: generateComponentTemplate(feature)
  });

  // 6. Add tests
  await apex.tools.write({
    file_path: `src/components/${feature}/${feature}.test.tsx`,
    content: generateTestTemplate(feature)
  });

  // 7. Run tests
  const testResult = await apex.tools.bash({
    command: 'npm test',
    timeout: 300000
  });

  // 8. Take screenshot of component
  await apex.tools.browser({
    operation: 'navigate',
    params: { url: `http://localhost:3000/components/${feature}` }
  });

  await apex.tools.browser({
    operation: 'screenshot',
    params: { filename: `${feature}-component.png` }
  });

  // 9. Commit changes
  await apex.tools.bash({
    command: `git add . && git commit -m "feat: add ${feature} component"`
  });

  return {
    component: `src/components/${feature}/${feature}.tsx`,
    tests: testResult.success,
    screenshot: `${feature}-component.png`
  };
};
```

---

## Related Documentation

- [v0.5.0 Features Guide](./v050-features.md) - Complete overview of v0.5.0 capabilities
- [Browser Automation](./browser-automation.md) - Detailed browser tool usage and configuration
- [Permission System](./permission-system.md) - Tool permission controls and security
- [Tool Extensions](./tool-extensions.md) - Custom tools and MCP integration
- [Configuration Guide](./configuration.md) - Tool configuration and setup
- [API Reference](./api-reference.md) - Programmatic tool usage and integration