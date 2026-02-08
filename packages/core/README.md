# @apexcli/core

Core types, configuration, and utilities for the APEX platform.

## Overview

This package provides the foundational building blocks for APEX:

- **Type Definitions** - Zod schemas and TypeScript types for tasks, agents, workflows, and more
- **Configuration Loading** - Parse and validate `.apex/config.yaml` files
- **Utility Functions** - Common helpers for formatting, validation, and data manipulation

## Installation

```bash
npm install @apexcli/core
```

## Usage

### Types

```typescript
import {
  Task,
  TaskSchema,
  Agent,
  AgentSchema,
  Workflow,
  WorkflowSchema,
  ApexConfig
} from '@apexcli/core';

// Validate task data
const task = TaskSchema.parse({
  id: 'task_123',
  description: 'Implement feature X',
  status: 'pending',
  // ...
});
```

### Configuration

```typescript
import { loadConfig, loadAgents, loadWorkflows } from '@apexcli/core';

// Load project configuration
const config = await loadConfig('/path/to/project');

// Load agent definitions
const agents = await loadAgents('/path/to/project/.apex/agents');

// Load workflow definitions
const workflows = await loadWorkflows('/path/to/project/.apex/workflows');
```

### Utilities

```typescript
import {
  formatDuration,
  formatElapsed,
  formatTokens,
  formatCost,
  calculateCost,
  generateTaskId,
  generateBranchName,
  slugify,
  retry,
  truncate,
  deepMerge,
  safeJsonParse,
  extractCodeBlocks
} from '@apexcli/core';

// Format a duration in milliseconds
formatDuration(3600000); // "1h"
formatElapsed(new Date('2023-01-01'), new Date('2023-01-01T00:02:30')); // "2m 30s"

// Format token count and cost
formatTokens(1500); // "1,500"
formatCost(0.045); // "$0.0450"
calculateCost(1000, 500); // 0.045 (based on Claude Sonnet 4 pricing)

// Generate IDs and names
generateTaskId(); // "task_abc123_def456"
generateBranchName('apex/', 'task_123', 'Add user auth'); // "apex/123-add-user-auth"
slugify('Hello World!'); // "hello-world"

// Utilities
retry(() => fetchData(), { maxAttempts: 3 }); // Exponential backoff retry
truncate('Long text...', 50, '...'); // "Long text..."
deepMerge(obj1, obj2); // Deep merge objects
safeJsonParse('{"key": "value"}', {}); // Parse JSON with fallback
extractCodeBlocks(markdown); // Extract code blocks from markdown
```

### Tool Output Utilities

```typescript
import {
  truncateToolOutput,
  type TruncateOptions,
  type TruncateResult
} from '@apexcli/core';

// Basic truncation
const result = truncateToolOutput('Very long output...', { maxLength: 100 });
console.log(result.output); // Truncated string
console.log(result.truncated); // true if truncated
console.log(result.originalLength); // Original length
console.log(result.truncatedLength); // Final length

// Advanced truncation options
const advancedResult = truncateToolOutput(longJsonOutput, {
  maxLength: 5000,
  suffix: '... [output truncated]',
  preserveJson: true, // Preserve JSON structure when possible
  wordBoundary: true // Truncate at word boundaries when possible
});

// JSON-aware truncation preserves structure
const jsonData = JSON.stringify({ users: [/*...lots of data...*/] });
const jsonResult = truncateToolOutput(jsonData, {
  maxLength: 1000,
  preserveJson: true
});
// Result will be valid JSON with truncation indicators
```

### Logger System

```typescript
import {
  Logger,
  createPackageLogger,
  createComponentLogger,
  createTaskLogger,
  type LogLevel,
  type LoggerContext
} from '@apexcli/core';

// Get singleton logger instance
const logger = Logger.getInstance();
logger.info('Application started');

// Create package-specific logger
const cliLogger = createPackageLogger('cli');
cliLogger.debug('Processing command', { command: 'init' });

// Create component-specific logger
const daemonLogger = createComponentLogger('orchestrator', 'daemon');
daemonLogger.warn('High memory usage', { memory: '512MB' });

// Create task-scoped logger
const taskLogger = createTaskLogger('task_123');
taskLogger.error('Task failed', new Error('Network timeout'));

// Child loggers with custom context
const userLogger = logger.child({
  userId: '12345',
  sessionId: 'abc-def-ghi'
});
userLogger.info('User action', { action: 'login' });
```

### Container and Environment Utilities

```typescript
import {
  detectContainerRuntime,
  ContainerManager,
  ContainerHealthMonitor,
  ImageBuilder,
  detectPackageManager,
  detectEnvironment,
  type ContainerRuntime,
  type ContainerConfig,
  type HealthCheck,
  type BuildConfig,
  type PackageManager,
  type Environment
} from '@apexcli/core';

// Detect container runtime
const runtime = await detectContainerRuntime();
console.log(runtime); // 'docker', 'podman', 'containerd', or null

// Container management
const manager = new ContainerManager();
const container = await manager.create({
  image: 'node:18',
  command: ['npm', 'test'],
  workingDir: '/app'
});
await manager.start(container.id);

// Health monitoring
const monitor = new ContainerHealthMonitor();
await monitor.startMonitoring(container.id, {
  interval: 30000,
  timeout: 10000,
  retries: 3
});

// Image building
const builder = new ImageBuilder();
await builder.build({
  dockerfilePath: './Dockerfile',
  context: '.',
  tags: ['myapp:latest']
});

// Package manager detection
const pkgManager = detectPackageManager('/path/to/project');
console.log(pkgManager); // 'npm', 'yarn', 'pnpm', or null

// Environment detection
const env = detectEnvironment();
console.log(env.type); // 'development', 'production', 'test'
console.log(env.isContainer); // boolean
console.log(env.ci); // CI provider name or null
```

### Security and Validation Utilities

```typescript
import {
  scanForSecrets,
  validateDirectoryAccess,
  detectDangerousOperation,
  formatError,
  ApexError,
  type SecretMatch,
  type DirectoryAccessResult,
  type DangerousOperationResult
} from '@apexcli/core';

// Secret scanning
const secrets = scanForSecrets('API_KEY=sk_1234567890abcdef');
console.log(secrets);
// [{ type: 'api_key', match: 'sk_1234567890abcdef', startIndex: 8, endIndex: 25 }]

// Directory access validation
const access = validateDirectoryAccess('/some/path');
console.log(access);
// { hasAccess: true, isWritable: true, exists: true, error: null }

// Dangerous operation detection
const operation = detectDangerousOperation('rm -rf /');
console.log(operation);
// { isDangerous: true, severity: 'high', reason: 'Recursive deletion of root directory' }

// Error formatting
const formattedError = formatError(new Error('Something went wrong'), {
  includeStack: true,
  colorize: true
});

// Custom APEX errors
throw new ApexError('Task failed', 'TASK_EXECUTION_ERROR', {
  taskId: 'task_123',
  step: 'validation'
});
```

### Connection and Health Utilities

```typescript
import {
  ExponentialBackoff,
  ConnectionHealth,
  HealthMetrics,
  type ExponentialBackoffConfig,
  type ConnectionHealthConfig,
  type HealthMetricsData,
  type JitterStrategy,
  type ReconnectionState
} from '@apexcli/core';

// Exponential backoff for retries
const backoff = new ExponentialBackoff({
  baseDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30000,
  maxRetries: 5,
  jitterStrategy: 'equal'
});

backoff.on('retry', ({ attempt, delayMs }) => {
  console.log(`Retry attempt ${attempt} after ${delayMs}ms`);
});

await backoff.retry(async () => {
  // Your connection logic here
  const response = await fetch('/api/endpoint');
  if (!response.ok) throw new Error('Request failed');
  return response.json();
});

// Connection health monitoring
const health = new ConnectionHealth({
  checkInterval: 30000,
  timeout: 5000,
  maxFailures: 3
});

health.on('statusChange', ({ status, error }) => {
  console.log(`Connection status: ${status}`, error);
});

await health.start();

// Health metrics collection
const metrics = new HealthMetrics();
metrics.recordLatency('api_request', 250);
metrics.recordCounter('requests_total', 1, { endpoint: '/api/users' });
metrics.recordGauge('memory_usage', process.memoryUsage().heapUsed);

const report = metrics.getSnapshot();
console.log(report); // Current metrics snapshot
```

### Screenshot and Comparison Utilities

```typescript
import {
  ScreenshotComparator,
  type ComparisonOptions,
  type ComparisonResult,
  type DiffPixelData
} from '@apexcli/core';

// Screenshot comparison
const comparator = new ScreenshotComparator();

const result = await comparator.compare(
  '/path/to/baseline.png',
  '/path/to/current.png',
  {
    threshold: 0.1, // 10% difference threshold
    outputDiffPath: '/path/to/diff.png',
    includeAA: false // Anti-aliasing detection
  }
);

console.log(result);
// {
//   match: false,
//   diffPixels: 1250,
//   totalPixels: 100000,
//   diffPercentage: 1.25,
//   threshold: 0.1,
//   diffPath: '/path/to/diff.png'
// }
```

### Syntax Highlighting

```typescript
import {
  highlightCode,
  type SupportedLanguage,
  type HighlightOptions
} from '@apexcli/core';

// Highlight code for terminal output
const highlighted = highlightCode(
  'function hello() { return "world"; }',
  'javascript',
  { theme: 'dark', lineNumbers: true }
);

console.log(highlighted); // ANSI colored output for terminal
```

### Semantic Versioning Utilities

```typescript
import {
  parseSemver,
  compareVersions,
  isPreRelease,
  getUpdateType,
  type SemVer,
  type UpdateType
} from '@apexcli/core';

// Parse semantic version strings
const version = parseSemver('1.2.3-alpha.1+build.123');
console.log(version);
// {
//   major: 1,
//   minor: 2,
//   patch: 3,
//   prerelease: ['alpha', '1'],
//   build: ['build', '123'],
//   raw: '1.2.3-alpha.1+build.123'
// }

// Compare versions (-1, 0, 1)
compareVersions('1.0.0', '2.0.0'); // -1 (first is older)
compareVersions('2.0.0', '1.0.0'); // 1 (first is newer)
compareVersions('1.0.0', '1.0.0'); // 0 (equal)

// Handle prerelease versions
compareVersions('1.0.0-alpha', '1.0.0'); // -1 (prerelease < stable)
compareVersions('1.0.0-alpha', '1.0.0-beta'); // -1 (alpha < beta)

// Check if version is prerelease
isPreRelease('1.0.0'); // false
isPreRelease('1.0.0-alpha'); // true
isPreRelease('1.0.0-beta.1'); // true
isPreRelease('1.0.0+build.123'); // false (build metadata ≠ prerelease)

// Determine update type between versions
getUpdateType('1.0.0', '2.0.0'); // 'major'
getUpdateType('1.0.0', '1.1.0'); // 'minor'
getUpdateType('1.0.0', '1.0.1'); // 'patch'
getUpdateType('1.0.0-alpha', '1.0.0'); // 'prerelease'
getUpdateType('1.0.0', '1.0.0'); // 'none'
getUpdateType('2.0.0', '1.0.0'); // 'downgrade'
```

### Conventional Commits

```typescript
import {
  parseConventionalCommit,
  createConventionalCommit,
  COMMIT_TYPES,
  suggestCommitType,
  type ConventionalCommit,
  type CommitType
} from '@apexcli/core';

// Parse conventional commit messages
const commit = parseConventionalCommit('feat(auth): add OAuth login\n\nSupports Google and GitHub');
console.log(commit);
// {
//   type: 'feat',
//   scope: 'auth',
//   description: 'add OAuth login',
//   body: 'Supports Google and GitHub',
//   breaking: false
// }

// Parse breaking changes
parseConventionalCommit('feat!: remove deprecated API');
// { type: 'feat', description: 'remove deprecated API', breaking: true }

// Create conventional commit messages
createConventionalCommit('fix', 'resolve login issue');
// "fix: resolve login issue"

createConventionalCommit('feat', 'add dark mode', {
  scope: 'ui',
  body: 'Includes system preference detection',
  breaking: false
});
// "feat(ui): add dark mode\n\nIncludes system preference detection"

createConventionalCommit('refactor', 'update API', { breaking: true });
// "refactor!: update API"

// Available commit types
console.log(COMMIT_TYPES.feat);
// { title: 'Features', emoji: '✨', description: 'New features' }

// Suggest commit type based on changed files
suggestCommitType(['src/auth.test.ts', 'src/login.test.ts']); // 'test'
suggestCommitType(['README.md', 'docs/api.md']); // 'docs'
suggestCommitType(['src/api.ts', 'src/utils.ts']); // 'feat'
```

### Git Utilities

```typescript
import {
  detectConflicts,
  suggestConflictResolution,
  formatConflictReport,
  parseGitLog,
  groupCommitsByType,
  generateChangelogMarkdown,
  type ConflictInfo,
  type ConflictSuggestion,
  type GitLogEntry
} from '@apexcli/core';

// Detect merge conflicts in file content
const fileContent = `
function hello() {
<<<<<<< HEAD
  console.log("Hello from main");
=======
  console.log("Hello from feature");
>>>>>>> feature-branch
}
`;

const conflicts = detectConflicts(fileContent, 'src/hello.ts');
console.log(conflicts);
// {
//   file: 'src/hello.ts',
//   conflictMarkers: [{
//     startLine: 3,
//     endLine: 7,
//     currentContent: '  console.log("Hello from main");',
//     incomingContent: '  console.log("Hello from feature");'
//   }],
//   baseBranch: 'HEAD',
//   incomingBranch: 'feature-branch'
// }

// Get resolution suggestions
const suggestions = suggestConflictResolution(conflicts.conflictMarkers[0]);
console.log(suggestions[0]);
// {
//   type: 'keep-current',
//   description: 'Keep current changes',
//   resolvedContent: '  console.log("Hello from main");',
//   confidence: 'medium',
//   reason: 'Current changes include modifications'
// }

// Format conflict report
const report = formatConflictReport([conflicts]);
console.log(report);
// "Found 1 file(s) with conflicts:
//  📄 src/hello.ts
//     Branches: HEAD ← feature-branch
//     Conflicts: 1
//  ..."

// Parse git log output
const logOutput = `commit abc123
Author: John Doe <john@example.com>
Date: Mon Jan 1 12:00:00 2023

feat(auth): add OAuth support

commit def456
Author: Jane Smith <jane@example.com>
Date: Mon Jan 1 11:00:00 2023

fix: resolve login bug`;

const entries = parseGitLog(logOutput);
console.log(entries[0]);
// {
//   hash: 'abc123',
//   shortHash: 'abc123',
//   author: 'John Doe <john@example.com>',
//   date: Date('2023-01-01T12:00:00'),
//   message: 'feat(auth): add OAuth support',
//   conventional: { type: 'feat', scope: 'auth', description: 'add OAuth support', breaking: false }
// }

// Group commits by type for changelog
const groups = groupCommitsByType(entries);
console.log(groups);
// [
//   { type: 'feat', title: 'Features', commits: [...] },
//   { type: 'fix', title: 'Bug Fixes', commits: [...] }
// ]

// Generate changelog markdown
const changelog = generateChangelogMarkdown('1.2.0', new Date(), groups, {
  includeHashes: true,
  repoUrl: 'https://github.com/user/repo'
});
console.log(changelog);
// ## [1.2.0] - 2023-01-01
//
// ### ✨ Features
// - **auth:** add OAuth support ([abc123](https://github.com/user/repo/commit/abc123))
//
// ### 🐛 Bug Fixes
// - resolve login bug ([def456](https://github.com/user/repo/commit/def456))
```

### Tools Module

The `@apexcli/core/tools` module provides foundational abstractions for building custom tools:

```typescript
import {
  BaseTool,
  ToolRegistry,
  ToolInterface,
  getToolRegistry,
  registerTool,
  type ToolExecutionContext,
  type ToolInputType,
  type ToolOutputType
} from '@apexcli/core/tools';

// Create a custom tool
class MyCustomTool extends BaseTool<{ input: string }, { output: string }> {
  name = 'my-custom-tool';
  description = 'A custom tool example';

  async execute(
    input: { input: string },
    context: ToolExecutionContext
  ): Promise<{ output: string }> {
    return { output: `Processed: ${input.input}` };
  }
}

// Register the tool
const registry = getToolRegistry();
await registry.register(new MyCustomTool());

// Use the tool
const result = await registry.execute('my-custom-tool', { input: 'Hello' });
console.log(result.output); // "Processed: Hello"
```

#### Built-in Tools

```typescript
import {
  // Filesystem tools
  ReadTool, EditTool, GlobTool,
  createReadTool, createEditTool, createGlobTool,

  // Shell tools
  BashTool, BackgroundTaskManager,
  createBashTool,

  // Search tools
  GrepTool,

  // Web tools
  WebSearchTool,
  createWebSearchTool,

  // Browser tools
  BrowserTool
} from '@apexcli/core/tools';

// Use built-in filesystem tools
const readTool = createReadTool();
const content = await readTool.execute({ filePath: '/path/to/file.txt' });

const editTool = createEditTool();
await editTool.execute({
  filePath: '/path/to/file.txt',
  oldString: 'old content',
  newString: 'new content'
});

const globTool = createGlobTool();
const files = await globTool.execute({ pattern: '**/*.ts' });

// Use shell tools
const bashTool = createBashTool();
const output = await bashTool.execute({ command: 'ls -la' });

// Use search tools
const grepTool = new GrepTool();
const matches = await grepTool.execute({
  pattern: 'function',
  path: '/path/to/search'
});

// Use web tools
const webSearchTool = createWebSearchTool();
const results = await webSearchTool.execute({ query: 'APEX AI platform' });
```

#### Tool Registration

```typescript
import {
  registerFilesystemTools,
  registerShellTools,
  registerSearchTools,
  registerWebTools
} from '@apexcli/core/tools';

// Register all built-in tools
await registerFilesystemTools();
await registerShellTools();
await registerSearchTools();
await registerWebTools();

// Now all tools are available in the registry
const registry = getToolRegistry();
const allTools = registry.getAllTools();
console.log(allTools.map(tool => tool.name));
```

## Key Types

| Type | Description |
|------|-------------|
| `Task` | A unit of work with status, agent, and workflow |
| `Agent` | AI agent definition with capabilities and prompts |
| `Workflow` | Multi-stage development workflow |
| `ApexConfig` | Project configuration schema |
| `TaskStatus` | Task lifecycle states |

## Related Packages

- [@apexcli/orchestrator](https://www.npmjs.com/package/@apexcli/orchestrator) - Task execution engine
- [@apexcli/cli](https://www.npmjs.com/package/@apexcli/cli) - Command-line interface
- [@apexcli/api](https://www.npmjs.com/package/@apexcli/api) - REST API server

## License

MIT
