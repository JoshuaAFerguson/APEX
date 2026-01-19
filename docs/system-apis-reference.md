# APEX System APIs Reference

This document provides detailed API reference for APEX's core systems: Tools, Permissions, and Browser Automation.

## 🔧 Tools System APIs

### Core Tool Interfaces

#### BaseTool Abstract Class
```typescript
export abstract class BaseTool {
  static readonly metadata: ToolMetadata;

  constructor(
    protected permissionManager: PermissionManager,
    protected config?: any
  ) {}

  abstract execute(params: any): Promise<ToolResult>;

  protected async checkPermission(
    scope?: string,
    context?: any
  ): Promise<ToolPermissionResult>;

  protected success(data: any, metadata?: any): ToolResult;
  protected error(message: string, metadata?: any): ToolResult;
}
```

#### Tool Metadata Interface
```typescript
export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  permissions: ToolPermission[];
  category: ToolCategory;
  schemas?: {
    input?: JSONSchema;
    output?: JSONSchema;
  };
}
```

#### Tool Result Interface
```typescript
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration?: number;
    fromCache?: boolean;
    permissionUsed?: string;
    [key: string]: any;
  };
}
```

### Tool Registry API

#### Registration Methods
```typescript
export class ToolRegistry {
  static register(toolClass: typeof BaseTool, config?: any): void;
  static unregister(toolId: string): void;
  static get(toolId: string): BaseTool | undefined;
  static list(): ToolMetadata[];
  static listByCategory(category: ToolCategory): ToolMetadata[];
  static isEnabled(toolId: string): boolean;
  static setEnabled(toolId: string, enabled: boolean): void;
}
```

#### Discovery API
```typescript
export interface ToolDiscoveryService {
  discoverTools(): Promise<ToolMetadata[]>;
  validateTool(toolId: string): Promise<ValidationResult>;
  installTool(toolId: string, source: ToolSource): Promise<InstallResult>;
  uninstallTool(toolId: string): Promise<boolean>;
}
```

### MCP Integration APIs

#### MCP Connection Manager
```typescript
export interface MCPConnectionManager {
  // Server management
  connect(serverId: string): Promise<MCPConnection>;
  disconnect(serverId: string): Promise<void>;
  reconnect(serverId: string): Promise<MCPConnection>;

  // Discovery
  discoverServers(): MCPServerConfig[];
  discoverTools(serverId?: string): Promise<MCPToolInfo[]>;

  // Tool execution
  executeTool(
    serverId: string,
    toolName: string,
    params: any
  ): Promise<MCPToolResult>;

  // Health monitoring
  checkHealth(serverId: string): Promise<HealthCheckResult>;
  getConnectionStatus(serverId: string): MCPConnectionState;

  // Event handling
  on<K extends keyof MCPConnectionManagerEvents>(
    event: K,
    listener: MCPConnectionManagerEvents[K]
  ): void;
}
```

#### MCP Server Configuration
```typescript
export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  environment?: Record<string, string>;
  timeout?: number;
  autoRestart?: boolean;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}
```

#### MCP Tool Information
```typescript
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
  outputSchema?: JSONSchema;
  serverId: string;
  serverName: string;
}
```

### Tool Execution API

#### Tool Executor Interface
```typescript
export interface ToolExecutor {
  execute(
    toolId: string,
    params: any,
    context?: ExecutionContext
  ): Promise<ToolResult>;

  canExecute(
    toolId: string,
    params: any,
    context?: ExecutionContext
  ): Promise<boolean>;

  getExecutionHistory(): ExecutionRecord[];
  clearExecutionHistory(): void;
}
```

#### Execution Context
```typescript
export interface ExecutionContext {
  userId?: string;
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  workspaceRoot?: string;
  environment?: Record<string, string>;
  permissions?: Permission[];
}
```

## 🛡️ Permissions System APIs

### Permission Manager API

#### Core Permission Methods
```typescript
export interface PermissionManager {
  // Permission checking
  checkToolPermission(query: PermissionQuery): Promise<ToolPermissionResult>;
  checkFileAccess(path: string, operation: FileOperation): Promise<boolean>;
  checkCommandPermission(command: string): Promise<boolean>;
  checkDomainPermission(domain: string): Promise<boolean>;

  // Permission granting
  grantPermission(
    tool: string,
    level: PermissionLevel,
    scope?: string,
    expiry?: Date
  ): Promise<void>;

  denyPermission(tool: string, scope?: string): Promise<void>;

  revokePermission(tool: string, scope?: string): Promise<void>;

  // Permission querying
  getPermissions(tool?: string): Promise<Permission[]>;
  hasPermission(tool: string, scope?: string): Promise<boolean>;

  // Session management
  getSessionStatus(): PermissionSession;
  resetSession(): Promise<void>;
  extendSession(duration: number): Promise<void>;
}
```

#### Permission Query Interface
```typescript
export interface PermissionQuery {
  tool: string;
  scope?: string;
  operation?: string;
  context?: {
    filePath?: string;
    command?: string;
    domain?: string;
    [key: string]: any;
  };
}
```

#### Permission Result Interface
```typescript
export interface ToolPermissionResult {
  granted: boolean;
  level?: PermissionLevel;
  reason?: string;
  scope?: string;
  expiry?: Date;
  needsConfirmation?: boolean;
  metadata?: Record<string, any>;
}
```

### Permission Configuration APIs

#### Directory Access Configuration
```typescript
export interface DirectoryAccessConfig {
  allowlist: string[];
  blocklist: string[];
  defaultAllow?: boolean;
  resolveSymlinks?: boolean;
  maxDepth?: number;
}

export interface DirectoryAccessChecker {
  isPathAllowed(path: string): boolean;
  isPathBlocked(path: string): boolean;
  validatePath(path: string): ValidationResult;
  getEffectivePermissions(path: string): PathPermissions;
}
```

#### Permission Preset API
```typescript
export interface PermissionPreset {
  name: string;
  description: string;
  permissions: Record<string, PermissionLevel>;
  directoryAccess?: DirectoryAccessConfig;
  apply(manager: PermissionManager): Promise<void>;
}

export interface PermissionPresetManager {
  getPreset(name: string): PermissionPreset | undefined;
  applyPreset(name: string): Promise<void>;
  createCustomPreset(name: string, preset: PermissionPreset): void;
  listPresets(): PermissionPreset[];
}
```

### Permission Events API

#### Event Interfaces
```typescript
export interface PermissionEvent {
  timestamp: Date;
  type: PermissionEventType;
  tool: string;
  scope?: string;
  level?: PermissionLevel;
  reason?: string;
  context?: any;
  userId?: string;
  sessionId: string;
}

export type PermissionEventType =
  | 'permission:requested'
  | 'permission:granted'
  | 'permission:denied'
  | 'permission:revoked'
  | 'permission:expired'
  | 'session:created'
  | 'session:expired'
  | 'session:reset';
```

#### Event Emitter Interface
```typescript
export interface PermissionEventEmitter {
  on(event: PermissionEventType, listener: (event: PermissionEvent) => void): void;
  off(event: PermissionEventType, listener: (event: PermissionEvent) => void): void;
  emit(event: PermissionEventType, data: Omit<PermissionEvent, 'timestamp'>): void;
}
```

### Permission Storage API

#### Permission Store Interface
```typescript
export interface PermissionStore {
  // CRUD operations
  store(permission: Permission): Promise<void>;
  retrieve(tool: string, scope?: string): Promise<Permission | null>;
  update(permission: Permission): Promise<void>;
  delete(tool: string, scope?: string): Promise<void>;

  // Bulk operations
  list(tool?: string): Promise<Permission[]>;
  clear(tool?: string): Promise<void>;

  // Session management
  storeSession(session: PermissionSession): Promise<void>;
  retrieveSession(sessionId: string): Promise<PermissionSession | null>;
  clearExpiredSessions(): Promise<void>;
}
```

## 🌐 Browser Automation APIs

### Browser Tool API

#### Core Browser Interface
```typescript
export interface BrowserTool {
  // Navigation
  navigate(params: BrowserNavigateParams): Promise<BrowserOperationResult>;

  // Interaction
  click(params: BrowserClickParams): Promise<BrowserOperationResult>;
  type(params: BrowserTypeParams): Promise<BrowserOperationResult>;
  scroll(params: BrowserScrollParams): Promise<BrowserOperationResult>;
  hover(params: BrowserHoverParams): Promise<BrowserOperationResult>;

  // Form operations
  submit(params: BrowserSubmitParams): Promise<BrowserOperationResult>;

  // Information extraction
  getText(params: BrowserGetTextParams): Promise<BrowserTextResult>;
  getAttribute(params: BrowserGetAttributeParams): Promise<BrowserAttributeResult>;
  getHtml(params?: BrowserGetHtmlParams): Promise<BrowserHtmlResult>;

  // Screenshot operations
  screenshot(params: BrowserScreenshotParams): Promise<BrowserScreenshotResult>;
  compareScreenshot(params: BrowserCompareParams): Promise<BrowserCompareResult>;

  // Advanced operations
  evaluate(params: BrowserEvaluateParams): Promise<BrowserEvaluateResult>;
  waitForSelector(params: BrowserWaitParams): Promise<BrowserOperationResult>;
}
```

#### Browser Operation Parameters
```typescript
export interface BrowserNavigateParams {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface BrowserClickParams {
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface BrowserTypeParams {
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface BrowserScreenshotParams {
  filename?: string;
  fullPage?: boolean;
  selector?: string;
  viewport?: { width: number; height: number };
  quality?: number;
}

export interface BrowserEvaluateParams {
  expression: string;
  args?: any[];
}
```

#### Browser Result Interfaces
```typescript
export interface BrowserOperationResult {
  success: boolean;
  error?: string;
  data?: any;
  metadata?: {
    duration: number;
    url?: string;
    timestamp: Date;
  };
}

export interface BrowserScreenshotResult extends BrowserOperationResult {
  path?: string;
  buffer?: Buffer;
  dimensions?: {
    width: number;
    height: number;
  };
}

export interface BrowserCompareResult extends BrowserOperationResult {
  identical: boolean;
  difference?: number;
  diffPath?: string;
  threshold: number;
}
```

### Browser Manager API

#### Browser Session Management
```typescript
export interface BrowserManager {
  // Session lifecycle
  createSession(config?: BrowserSessionConfig): Promise<BrowserSession>;
  getSession(sessionId: string): BrowserSession | undefined;
  closeSession(sessionId: string): Promise<void>;
  closeAllSessions(): Promise<void>;

  // Browser control
  launchBrowser(engine: BrowserEngine, options?: LaunchOptions): Promise<Browser>;
  closeBrowser(browserId: string): Promise<void>;

  // Health monitoring
  getSessionHealth(sessionId: string): BrowserSessionHealth;
  cleanupStoppedSessions(): Promise<void>;
}
```

#### Browser Session Interface
```typescript
export interface BrowserSession {
  id: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  config: BrowserSessionConfig;
  createdAt: Date;
  lastUsed: Date;

  // Operations
  navigate(url: string, options?: NavigateOptions): Promise<void>;
  screenshot(options?: ScreenshotOptions): Promise<Buffer>;
  close(): Promise<void>;

  // State
  isActive(): boolean;
  getCurrentUrl(): string;
  getTitle(): Promise<string>;
}
```

### Console Monitoring API

#### Console Stream Interface
```typescript
export interface BrowserConsoleStream {
  // Event handling
  on(event: 'message', listener: (message: BrowserConsoleMessage) => void): void;
  on(event: 'error', listener: (error: BrowserRuntimeError) => void): void;

  // Stream control
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;

  // Configuration
  setLogLevel(level: ConsoleLogLevel): void;
  setFilter(filter: ConsoleMessageFilter): void;

  // Data access
  getMessages(): BrowserConsoleMessage[];
  getErrors(): BrowserRuntimeError[];
  clear(): void;
}
```

#### Console Message Interfaces
```typescript
export interface BrowserConsoleMessage {
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

export interface BrowserRuntimeError {
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  timestamp: Date;
}

export type ConsoleLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';
```

### Visual Testing API

#### Screenshot Comparison
```typescript
export interface VisualComparer {
  compare(
    baseline: Buffer | string,
    current: Buffer | string,
    options?: CompareOptions
  ): Promise<CompareResult>;

  generateDiff(
    baseline: Buffer | string,
    current: Buffer | string,
    outputPath: string,
    options?: DiffOptions
  ): Promise<void>;
}

export interface CompareOptions {
  threshold?: number;
  includeAA?: boolean;
  alpha?: number;
  diffColor?: [number, number, number];
}

export interface CompareResult {
  identical: boolean;
  difference: number;
  diffPixels: number;
  totalPixels: number;
  dimensions: {
    width: number;
    height: number;
  };
}
```

#### Visual Regression Testing
```typescript
export interface VisualRegressionTester {
  captureBaseline(
    testId: string,
    selector?: string,
    options?: ScreenshotOptions
  ): Promise<void>;

  compareWithBaseline(
    testId: string,
    selector?: string,
    options?: CompareOptions
  ): Promise<CompareResult>;

  updateBaseline(
    testId: string,
    selector?: string,
    options?: ScreenshotOptions
  ): Promise<void>;

  getTestHistory(testId: string): Promise<TestHistoryEntry[]>;
}
```

## 🔗 Integration APIs

### Cross-System Event Bus

#### Event Bus Interface
```typescript
export interface SystemEventBus {
  // Event emission
  emit(event: string, data: any): void;

  // Event listening
  on(event: string, listener: (data: any) => void): void;
  off(event: string, listener: (data: any) => void): void;
  once(event: string, listener: (data: any) => void): void;

  // Event filtering
  filter(filter: EventFilter): SystemEventBus;

  // Lifecycle
  start(): void;
  stop(): void;
  getEventHistory(): EventRecord[];
}
```

#### System Events
```typescript
export interface SystemEvent {
  type: string;
  source: 'tools' | 'permissions' | 'browser' | 'mcp';
  timestamp: Date;
  data: any;
  metadata?: {
    userId?: string;
    sessionId?: string;
    taskId?: string;
  };
}
```

### Configuration Management API

#### Configuration Manager
```typescript
export interface ConfigurationManager {
  // Configuration loading
  loadConfig(path?: string): Promise<ApexConfig>;
  saveConfig(config: ApexConfig, path?: string): Promise<void>;

  // Configuration validation
  validateConfig(config: ApexConfig): ValidationResult;

  // Dynamic updates
  updateConfig(updates: Partial<ApexConfig>): Promise<void>;
  watchConfig(callback: (config: ApexConfig) => void): () => void;

  // Environment management
  getEnvironment(): string;
  setEnvironment(env: string): void;
  getEnvironmentConfig(env: string): Partial<ApexConfig>;
}
```

### Health Monitoring API

#### System Health Monitor
```typescript
export interface SystemHealthMonitor {
  // Overall health
  getSystemHealth(): Promise<SystemHealthStatus>;

  // Component health
  getToolsHealth(): Promise<ComponentHealthStatus>;
  getPermissionsHealth(): Promise<ComponentHealthStatus>;
  getBrowserHealth(): Promise<ComponentHealthStatus>;
  getMCPHealth(): Promise<ComponentHealthStatus>;

  // Health checks
  runHealthCheck(): Promise<HealthCheckReport>;
  scheduleHealthCheck(interval: number): void;

  // Monitoring
  startMonitoring(): void;
  stopMonitoring(): void;
  getHealthHistory(): HealthRecord[];
}
```

This API reference provides comprehensive documentation for integrating with and extending APEX's core systems. Each interface is designed to be type-safe and provides clear contracts for system interaction.