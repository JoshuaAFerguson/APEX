"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolParameterSchema = exports.JSONSchemaTypeSchema = exports.ExtendedPermissionSchema = exports.ToolConfigSchema = exports.ToolPermissionConfigSchema = exports.SearchToolConfigSchema = exports.BrowserSessionConfigSchema = exports.BrowserToolOutputSchema = exports.ScreenshotComparisonResultSchema = exports.BrowserToolInputSchema = exports.HoverParamsSchema = exports.ScrollParamsSchema = exports.GetHtmlParamsSchema = exports.GetTextParamsSchema = exports.GetAttributeParamsSchema = exports.WaitForSelectorParamsSchema = exports.SubmitParamsSchema = exports.EvaluateParamsSchema = exports.CompareScreenshotParamsSchema = exports.ScreenshotParamsSchema = exports.TypeParamsSchema = exports.ClickParamsSchema = exports.NavigateParamsSchema = exports.ScrollOptionsSchema = exports.CompareScreenshotOptionsSchema = exports.WaitOptionsSchema = exports.ScreenshotOptionsSchema = exports.TypeOptionsSchema = exports.ClickOptionsSchema = exports.MouseButtonSchema = exports.ElementStateSchema = exports.BrowserOperationSchema = exports.BrowserErrorSchema = exports.ConsoleMessageSchema = exports.StackFrameSchema = exports.ConsoleSeveritySchema = exports.BrowserToolConfigSchema = exports.WebToolConfigSchema = exports.ShellToolConfigSchema = exports.FilesystemToolConfigSchema = exports.BaseToolPermissionConfigSchema = exports.DirectoryAccessConfigSchema = exports.PermissionQuerySchema = exports.PermissionSchema = exports.PermissionLevelSchema = exports.ToolPermissionSchema = exports.ToolCategorySchema = exports.AgentDefinitionSchema = exports.AgentToolSchema = exports.AgentModelSchema = void 0;
exports.AutoFixStageConfigSchema = exports.TypecheckConfigSchema = exports.PreEditValidationConfigSchema = exports.PreEditValidationModeSchema = exports.LinterConfigSchema = exports.LinterGlobalConfigSchema = exports.CustomLinterConfigSchema = exports.PrettierConfigSchema = exports.ESLintConfigSchema = exports.UIConfigSchema = exports.ModelsConfigSchema = exports.LimitsConfigSchema = exports.GitConfigSchema = exports.WorktreeConfigSchema = exports.WorktreeStatusSchema = exports.ProjectConfigSchema = exports.WorkflowDefinitionSchema = exports.IsolationConfigSchema = exports.WorkflowStageSchema = exports.WorkflowGateSchema = exports.AutonomyConfigSchema = exports.AgentAutonomyOverrideSchema = exports.RejectionBehaviorSchema = exports.TaskResourceLimitsSchema = exports.ApprovalGateSchema = exports.ApprovalCheckpointTypeSchema = exports.LegacyAutonomyLevelSchema = exports.AutonomyLevelSchema = exports.UndoOperationResultSchema = exports.UndoEventSchema = exports.UndoEventTypeSchema = exports.AliasParameterValidationResultSchema = exports.ExpandedToolAliasSchema = exports.ToolAliasConfigSchema = exports.ToolAliasSchema = exports.AliasParameterSchema = exports.AliasParameterTypeSchema = exports.ToolActionSnapshotSchema = exports.ToolActionRetentionConfigSchema = exports.ToolActionSchema = exports.FileSnapshotSchema = exports.ToolRegistryEntrySchema = exports.ToolExecutionSchema = exports.ToolInvocationSchema = exports.ToolResultSchema = exports.CustomToolConfigSchema = exports.CustomToolOutputParserSchema = exports.ToolDefinitionSchema = exports.ToolExampleSchema = exports.ToolParametersSchemaSchema = void 0;
exports.UnifiedToolRegistryEntrySchema = exports.MCPToolRegistryEntrySchema = exports.ToolSourceSchema = exports.ToolSourceTypeSchema = exports.MCPToolSchema = exports.MCPToolCapabilitiesSchema = exports.MCPToolSchemaSchema = exports.MCPConnectionEventSchema = exports.MCPConnectionEventTypeSchema = exports.MCPConnectionSchema = exports.MCPConnectionInfoSchema = exports.MCPConnectionStateSchema = exports.MCPInstallProgressSchema = exports.MCPInstallStageSchema = exports.MCPRegistryInstallationSchema = exports.MCPRegistryInstallConfigSchema = exports.MCPRegistryServerSchema = exports.MCPServerCategorySchema = exports.InstalledMCPServerSchema = exports.MCPInstallationSchema = exports.MCPInstallationStatusSchema = exports.MCPServerSchema = exports.MCPServerTemplateSchema = exports.MCPTemplateSchema = exports.MCPConfigSchema = exports.MCPToolsConfigSchema = exports.MCPMarketplaceSchema = exports.MCPMarketplaceSourceSchema = exports.MCPMarketplaceEntrySchema = exports.MCPServerConfigSchema = exports.MCPEnvironmentVarSchema = exports.MCPConnectionConfigSchema = exports.HealthReportSchema = exports.DoctorCheckResultSchema = exports.ToolchainCheckSchema = exports.CheckStatusSchema = exports.CheckSeveritySchema = exports.LoggingConfigSchema = exports.LogRotationConfigSchema = exports.LogLevelSchema = exports.DaemonConfigSchema = exports.StrategyWeightsSchema = exports.IdleTaskTypeSchema = exports.ServiceConfigSchema = exports.SecretScanningConfigSchema = exports.SecretScanningEnforcementModeSchema = exports.SecretScannerConfigSchema = exports.SecretDetectionBehaviorSchema = exports.SecretPatternSchema = exports.CodeQualityConfigSchema = void 0;
exports.TodoWriteInputSchema = exports.TodoSchema = exports.TodoItemSchema = exports.TodoStatusSchema = exports.IdleTaskSchema = exports.TaskTemplateSchema = exports.DocumentationAnalysisConfigSchema = exports.OutdatedDocsConfigSchema = exports.VisualComparisonEventDataSchema = exports.PermissionNotificationSchema = exports.ApprovalDecisionResponseSchema = exports.ApprovalDecisionRequestSchema = exports.ApprovalResolvedEventDataSchema = exports.ApprovalDeniedEventDataSchema = exports.ApprovalGrantedEventDataSchema = exports.ApprovalResponseEventDataSchema = exports.ApprovalRequiredEventDataSchema = exports.ApprovalStateSchema = exports.ApprovalResponseSchema = exports.ApprovalRequestSchema = exports.ApprovalActionSchema = exports.ApprovalStatusSchema = exports.GateStatusSchema = exports.WorkspaceConfigSchema = exports.WorkspaceDefaultsSchema = exports.ContainerDefaultsSchema = exports.WorkspaceStrategySchema = exports.IsolationModeSchema = exports.ContainerStatusSchema = exports.ContainerConfigSchema = exports.ContainerNetworkModeSchema = exports.ResourceLimitsSchema = exports.TaskEffortSchema = exports.TaskPrioritySchema = exports.TaskStatusSchema = exports.ApexConfigSchema = exports.ApiAuthConfigSchema = exports.SlackIntegrationConfigSchema = exports.VisualRegressionConfigSchema = exports.TDDModeConfigSchema = exports.MCPInstallProgressV050Schema = exports.MCPInstallationV050Schema = exports.MCPServerV050Schema = exports.MCPToolInvocationResponseSchema = exports.MCPToolResultContentSchema = exports.MCPToolResultContentTypeSchema = exports.MCPToolInvocationRequestSchema = exports.ToolDiscoveryEventSchema = exports.ToolDiscoveryEventTypeSchema = exports.ToolRegistryStateSchema = void 0;
exports.ToolHookConfigSchema = exports.ToolHookDefinitionSchema = exports.ToolHookTypeSchema = exports.HookConfigSchema = exports.HookHandlerSchema = exports.HookTypeSchema = exports.GuardrailEvaluationResultSchema = exports.GuardrailViolationSchema = exports.GuardrailConfigSchema = exports.SecretScanResultSchema = exports.SecretDetectionSchema = exports.EnforcementModeSchema = exports.PolicyCheckOptionsSchema = exports.PolicyCheckContextSchema = exports.PolicyCheckResultSchema = exports.PolicyCheckStatusSchema = exports.TaskPolicyCheckResultSchema = exports.PolicyViolationEventSchema = exports.PolicyValidationResultSchema = exports.PolicyViolationSchema = exports.LegacyPolicySchema = exports.PolicySchema = exports.ApprovalPolicySchema = exports.TestPolicySchema = exports.PathPolicySchema = exports.PolicyRuleSchema = exports.PolicySeveritySchema = exports.PolicyConfigSchema = exports.PolicyEnforcementModeSchema = exports.ApprovalRulesConfigSchema = exports.ApprovalRuleSchema = exports.ApprovalUrgencySchema = exports.ApprovalConditionSchema = exports.ApprovalOperationTypeSchema = exports.ApprovalConditionTypeSchema = exports.RequiredTestsConfigSchema = exports.TestRequirementRuleSchema = exports.TestEnforcementLevelSchema = exports.AllowedPathsConfigSchema = exports.PathAccessModeSchema = exports.PermissionsConfigSchema = exports.PERMISSION_PRESET_CONFIGS = exports.PermissionPresetConfigSchema = exports.ToolPermissionRuleSchema = exports.ALL_TOOLS = exports.WRITE_TOOLS = exports.READ_ONLY_TOOLS = exports.ToolPermissionBehaviorSchema = exports.PermissionPresetSchema = exports.TodoWriteOutputSchema = void 0;
exports.isBrowserPermissionDeniedError = exports.BrowserPermissionDeniedError = exports.PermissionChangeEventSchema = exports.PermissionDetailsSchema = exports.PermissionChangeTypeSchema = exports.TestReportSchema = exports.TestSummarySchema = exports.VisualRegressionSummarySchema = exports.TestResultSchema = exports.TestArtifactSchema = exports.TestVisualComparisonSchema = exports.ScreenshotResponseSchema = exports.ScreenshotElementRequestSchema = exports.ScreenshotFullPageRequestSchema = exports.ScreenshotViewportRequestSchema = exports.ToolErrorHookContextSchema = exports.ToolCompleteHookContextSchema = exports.ToolStartHookContextSchema = exports.CaptureRegionOptionsSchema = exports.CaptureElementOptionsSchema = exports.ScreenshotResultSchema = exports.ScreenshotOutputModeSchema = exports.ScreenshotFormatSchema = exports.ImageMetadataSchema = exports.ScreenshotComparisonOptionsSchema = exports.ApexRuleSchema = exports.RuleActionSchema = exports.RuleActionTypeSchema = exports.RuleConditionSchema = exports.RuleTriggerSchema = exports.RuleTriggerEventSchema = exports.AutoFixEventSchema = exports.AutoFixIssueDetailSchema = exports.AutoFixStatusSchema = exports.AutoFixEventTypeSchema = exports.AutoFixResultSchema = exports.AutoFixConfigSchema = exports.AuditLogEntrySchema = exports.AuditSeveritySchema = exports.AuditEventTypeSchema = exports.RepairLoopConfigSchema = exports.FixAttemptConfigSchema = exports.BackoffStrategySchema = exports.PostHookResultSchema = exports.BehaviorEventDataSchema = exports.BehaviorModeSchema = exports.PreHookResultSchema = exports.PreHookActionSchema = exports.PostHookContextSchema = exports.PreHookContextSchema = void 0;
exports.ProjectContextSchema = exports.TestFrameworkInfoSchema = exports.TestRunnerTypeSchema = exports.ConfigurationInfoSchema = exports.ConfigFileInfoSchema = exports.ConfigPurposeSchema = exports.ConfigFormatSchema = exports.FrameworkDetectionSchema = exports.FrameworkInfoSchema = exports.DetectionConfidenceSchema = exports.FrameworkCategorySchema = exports.ProjectStructureSchema = exports.ProjectEntrySchema = exports.ProjectEntryTypeSchema = exports.GitStatusSchema = exports.GitChangedFileSchema = exports.GitFileStatusSchema = exports.toBrowserPermissionDeniedError = void 0;
exports.migrateLegacyAutonomyLevel = migrateLegacyAutonomyLevel;
exports.getToolBehaviorForPreset = getToolBehaviorForPreset;
exports.isToolAllowedForPreset = isToolAllowedForPreset;
exports.isToolConfirmRequiredForPreset = isToolConfirmRequiredForPreset;
exports.isToolDeniedForPreset = isToolDeniedForPreset;
exports.getPresetConfig = getPresetConfig;
exports.isPermissionPreset = isPermissionPreset;
const zod_1 = require("zod");
// ============================================================================
// Agent Definitions
// ============================================================================
/**
 * Schema for defining which AI model an agent should use
 * @example
 * ```typescript
 * const model: AgentModel = 'sonnet';
 * const validModel = AgentModelSchema.parse('opus');
 * ```
 */
exports.AgentModelSchema = zod_1.z.enum(['opus', 'sonnet', 'haiku', 'inherit']);
/**
 * Schema for defining available tools that agents can use
 * @example
 * ```typescript
 * const tool: AgentTool = 'Read';
 * const validTool = AgentToolSchema.parse('WebFetch');
 * ```
 */
exports.AgentToolSchema = zod_1.z.enum([
    'Read',
    'Write',
    'Edit',
    'MultiEdit',
    'NotebookEdit',
    'Bash',
    'Grep',
    'Glob',
    'WebFetch',
    'WebSearch',
    'TodoWrite',
    'Browser',
]);
/**
 * Schema for defining an AI agent configuration including its capabilities and behavior
 * @example
 * ```typescript
 * const agent: AgentDefinition = {
 *   name: 'developer',
 *   description: 'Writes and reviews code',
 *   prompt: 'You are a senior software developer...',
 *   tools: ['Read', 'Write', 'Edit'],
 *   model: 'sonnet',
 *   skills: ['typescript', 'react']
 * };
 * ```
 */
exports.AgentDefinitionSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    prompt: zod_1.z.string(),
    tools: zod_1.z.array(zod_1.z.string()).optional(),
    model: exports.AgentModelSchema.optional().default('sonnet'),
    skills: zod_1.z.array(zod_1.z.string()).optional(),
});
// ============================================================================
// Tool Definitions
// ============================================================================
/**
 * Tool categories for organizing tools by function
 */
exports.ToolCategorySchema = zod_1.z.enum([
    'filesystem', // File reading/writing operations (Read, Write, Edit)
    'search', // Content/file searching (Grep, Glob)
    'shell', // Command execution (Bash)
    'web', // Web operations (WebFetch, WebSearch)
    'browser', // Browser automation (navigate, click, type, screenshot)
    'system', // System-level operations
    'custom', // User-defined tools
]);
/**
 * Permission levels required for tool execution
 */
exports.ToolPermissionSchema = zod_1.z.enum([
    'read', // Read-only access to files
    'write', // Write access to files
    'execute', // Execute commands/scripts
    'network', // Network access
    'admin', // Administrative operations
]);
// ============================================================================
// User Permission Management
// ============================================================================
/**
 * Permission level for user-granted tool permissions
 * - 'allow-always': Permanently allow the tool/scope combination
 * - 'allow-once': Allow for a single invocation only
 * - 'deny': Deny the tool/scope combination
 */
exports.PermissionLevelSchema = zod_1.z.enum([
    'allow-always', // Permanently allow the tool/scope combination
    'allow-once', // Allow for a single invocation only
    'deny', // Deny the tool/scope combination
]);
/**
 * A stored permission record for tool access
 * Tracks user decisions about whether agents can use specific tools
 */
exports.PermissionSchema = zod_1.z.object({
    /** Name of the tool this permission applies to */
    tool: zod_1.z.string().min(1, 'Tool name is required'),
    /** Optional scope to narrow the permission (e.g., file path pattern, command pattern) */
    scope: zod_1.z.string().optional(),
    /** The permission level granted */
    level: exports.PermissionLevelSchema,
    /** Optional expiration timestamp after which the permission is no longer valid */
    expiry: zod_1.z.date().optional(),
    /** Timestamp when the permission was created */
    createdAt: zod_1.z.date(),
});
/**
 * Query parameters for looking up permissions
 * Used to check if a permission exists for a specific tool/scope combination
 */
exports.PermissionQuerySchema = zod_1.z.object({
    /** Tool name to query permission for */
    tool: zod_1.z.string().min(1, 'Tool name is required'),
    /** Optional scope to narrow the query */
    scope: zod_1.z.string().optional(),
});
// ============================================================================
// Per-Tool Permission Configuration (v0.5.0)
// ============================================================================
/**
 * Directory access configuration for filesystem-related tools
 * Controls which directories a tool can access using allowlist/blocklist patterns
 */
exports.DirectoryAccessConfigSchema = zod_1.z.object({
    /** Paths that are explicitly allowed (glob patterns supported) */
    allowlist: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Paths that are explicitly blocked (glob patterns supported) */
    blocklist: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Whether to allow access to paths not in allowlist/blocklist
     * Default: false if allowlist is non-empty, true otherwise
     */
    defaultAllow: zod_1.z.boolean().optional(),
    /** Whether to resolve symlinks when checking paths (default: true) */
    resolveSymlinks: zod_1.z.boolean().optional().default(true),
    /** Maximum directory depth for recursive operations (0 = unlimited) */
    maxDepth: zod_1.z.number().int().min(0).optional().default(0),
});
/**
 * Base configuration shared by all tool permission configs
 * Contains common settings applicable to any tool type
 */
exports.BaseToolPermissionConfigSchema = zod_1.z.object({
    /** Whether the tool is enabled */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Maximum execution time in milliseconds (0 = no limit) */
    timeout: zod_1.z.number().int().min(0).optional().default(0),
    /** Whether to require confirmation before execution */
    requireConfirmation: zod_1.z.boolean().optional().default(false),
    /** Rate limiting: maximum calls per minute (0 = no limit) */
    rateLimitPerMinute: zod_1.z.number().int().min(0).optional().default(0),
    /** Custom metadata for the tool configuration */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Configuration for filesystem tools (Read, Write, Edit, Glob)
 * Extends base config with file-specific settings
 */
exports.FilesystemToolConfigSchema = exports.BaseToolPermissionConfigSchema.extend({
    /** Directory access control */
    directoryAccess: exports.DirectoryAccessConfigSchema.optional(),
    /** Maximum file size in bytes for read/write operations (0 = no limit) */
    maxFileSize: zod_1.z.number().int().min(0).optional().default(0),
    /** Allowed file extensions (empty = all allowed) */
    allowedExtensions: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Blocked file extensions */
    blockedExtensions: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
/**
 * Configuration for shell/command execution tools (Bash)
 * Extends base config with command-specific settings
 */
exports.ShellToolConfigSchema = exports.BaseToolPermissionConfigSchema.extend({
    /** Directory access control for working directory */
    directoryAccess: exports.DirectoryAccessConfigSchema.optional(),
    /** Command patterns to block (regex strings) */
    blockedCommands: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether to allow running commands as root/admin */
    allowElevatedPrivileges: zod_1.z.boolean().optional().default(false),
    /** Environment variables to inject */
    environment: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Working directory override */
    workingDirectory: zod_1.z.string().optional(),
});
/**
 * Configuration for web access tools (WebFetch, WebSearch)
 * Extends base config with network-specific settings
 */
exports.WebToolConfigSchema = exports.BaseToolPermissionConfigSchema.extend({
    /** Allowed domains for web access (empty = all allowed) */
    allowedDomains: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Blocked domains */
    blockedDomains: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Maximum response size in bytes */
    maxResponseSize: zod_1.z.number().int().min(0).optional().default(0),
    /** Whether to follow redirects */
    followRedirects: zod_1.z.boolean().optional().default(true),
    /** Custom headers to include in requests */
    headers: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
});
/**
 * Configuration for browser automation tools (Browser)
 * Extends base config with browser-specific settings
 */
exports.BrowserToolConfigSchema = exports.BaseToolPermissionConfigSchema.extend({
    /** Allowed domains for navigation (empty = all allowed) */
    allowedDomains: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Blocked domains */
    blockedDomains: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether to allow JavaScript execution via evaluate() */
    allowJavaScriptExecution: zod_1.z.boolean().optional(),
    /** Whether to allow form submissions */
    allowFormSubmission: zod_1.z.boolean().optional(),
    /** Maximum page load timeout in milliseconds */
    pageLoadTimeout: zod_1.z.number().int().min(0).optional(),
    /** Whether to allow file downloads */
    allowDownloads: zod_1.z.boolean().optional(),
    /** Whether to capture screenshots */
    allowScreenshots: zod_1.z.boolean().optional(),
    /** Whether to block popups/new windows */
    blockPopups: zod_1.z.boolean().optional(),
    /** Browser engine to use */
    engine: zod_1.z.enum(['chromium', 'firefox', 'webkit']).optional(),
    /** Browser automation backend */
    backend: zod_1.z.enum(['playwright', 'puppeteer']).optional(),
    /** Whether to run headless */
    headless: zod_1.z.boolean().optional(),
    /** User agent override */
    userAgent: zod_1.z.string().optional(),
    /** Viewport configuration */
    viewport: zod_1.z.object({
        width: zod_1.z.number().int().min(1),
        height: zod_1.z.number().int().min(1),
    }).optional(),
});
// ============================================================================
// Browser Automation Types
// ============================================================================
/**
 * Severity levels for console messages
 * Maps to browser console API levels
 */
exports.ConsoleSeveritySchema = zod_1.z.enum(['log', 'info', 'warn', 'error', 'debug', 'trace']);
/**
 * Stack frame representing a single frame in a stack trace
 * Used for error reporting and debugging in browser context
 */
exports.StackFrameSchema = zod_1.z.object({
    /** Function name or anonymous if not available */
    functionName: zod_1.z.string().optional(),
    /** Source file URL */
    url: zod_1.z.string(),
    /** Line number in the source file (1-based) */
    lineNumber: zod_1.z.number().int().min(1),
    /** Column number in the source file (1-based) */
    columnNumber: zod_1.z.number().int().min(1),
});
/**
 * Console message captured from browser context
 * Represents console.log/info/warn/error messages
 */
exports.ConsoleMessageSchema = zod_1.z.object({
    /** The severity level of the console message */
    severity: exports.ConsoleSeveritySchema,
    /** The message content */
    message: zod_1.z.string(),
    /** Timestamp when the message was logged */
    timestamp: zod_1.z.date(),
    /** Source URL where the message originated */
    sourceUrl: zod_1.z.string().optional(),
    /** Line number in source where the message originated */
    lineNumber: zod_1.z.number().int().min(1).optional(),
    /** Column number in source where the message originated */
    columnNumber: zod_1.z.number().int().min(1).optional(),
    /** Stack trace if available */
    stackTrace: zod_1.z.array(exports.StackFrameSchema).optional(),
});
/**
 * Browser error captured during page interaction
 * Represents JavaScript errors, network errors, etc.
 */
exports.BrowserErrorSchema = zod_1.z.object({
    /** Error name/type (e.g., 'TypeError', 'NetworkError') */
    name: zod_1.z.string(),
    /** Error message */
    message: zod_1.z.string(),
    /** Timestamp when the error occurred */
    timestamp: zod_1.z.date(),
    /** Source URL where the error originated */
    sourceUrl: zod_1.z.string().optional(),
    /** Line number where the error occurred */
    lineNumber: zod_1.z.number().int().min(1).optional(),
    /** Column number where the error occurred */
    columnNumber: zod_1.z.number().int().min(1).optional(),
    /** Stack trace for the error */
    stackTrace: zod_1.z.array(exports.StackFrameSchema).optional(),
});
// ============================================================================
// Browser Tool Operation Types
// ============================================================================
/**
 * Browser operations supported by the BrowserTool
 * Maps to MCP browser-tools operations
 */
exports.BrowserOperationSchema = zod_1.z.enum([
    'navigate', // Navigate to a URL
    'click', // Click on an element
    'type', // Type text into an element
    'screenshot', // Take a screenshot
    'compareScreenshot', // Compare screenshots for visual regression
    'evaluate', // Execute JavaScript in browser context
    'submit', // Submit a form
    'waitForSelector', // Wait for an element to appear
    'getAttribute', // Get element attribute value
    'getText', // Get element text content
    'getHtml', // Get element HTML content
    'scroll', // Scroll the page or element
    'hover', // Hover over an element
]);
/**
 * Element state for waitForSelector operation
 */
exports.ElementStateSchema = zod_1.z.enum([
    'attached', // Element is in DOM
    'detached', // Element is not in DOM
    'visible', // Element is visible
    'hidden', // Element is hidden
]);
/**
 * Mouse button for click operation
 */
exports.MouseButtonSchema = zod_1.z.enum(['left', 'right', 'middle']);
/**
 * Click options for the click operation
 */
exports.ClickOptionsSchema = zod_1.z.object({
    /** Mouse button to use for click (default: 'left') */
    button: exports.MouseButtonSchema.optional(),
    /** Number of clicks (default: 1, use 2 for double-click) */
    clickCount: zod_1.z.number().int().min(1).max(3).optional(),
    /** Delay between mousedown and mouseup in milliseconds */
    delay: zod_1.z.number().int().min(0).optional(),
    /** Position offset from element center */
    position: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
    }).optional(),
    /** Whether to force click even if element is hidden */
    force: zod_1.z.boolean().optional(),
}).strict();
/**
 * Type options for the type operation
 */
exports.TypeOptionsSchema = zod_1.z.object({
    /** Delay between key presses in milliseconds */
    delay: zod_1.z.number().int().min(0).optional(),
    /** Clear existing text before typing */
    clear: zod_1.z.boolean().optional(),
}).strict();
/**
 * Screenshot options for the screenshot operation
 */
exports.ScreenshotOptionsSchema = zod_1.z.object({
    /** Capture full page screenshot */
    fullPage: zod_1.z.boolean().optional(),
    /** Image format (default: 'png') */
    format: zod_1.z.enum(['png', 'jpeg']).optional(),
    /** Quality for jpeg format (0-100) */
    quality: zod_1.z.number().int().min(0).max(100).optional(),
    /** Omit background for transparent screenshots */
    omitBackground: zod_1.z.boolean().optional(),
}).strict();
/**
 * Wait options for waitForSelector operation
 */
exports.WaitOptionsSchema = zod_1.z.object({
    /** Maximum time to wait in milliseconds (default: 30000) */
    timeout: zod_1.z.number().int().min(0).optional(),
    /** Element state to wait for (default: 'visible') */
    state: exports.ElementStateSchema.optional(),
}).strict();
/**
 * Compare screenshot options for visual regression testing
 */
exports.CompareScreenshotOptionsSchema = zod_1.z.object({
    /** Pixel difference threshold (0-1, default: 0.01) */
    threshold: zod_1.z.number().min(0).max(1).optional(),
    /** Include anti-aliasing detection */
    includeAA: zod_1.z.boolean().optional(),
}).strict();
/**
 * Scroll options for the scroll operation
 */
exports.ScrollOptionsSchema = zod_1.z.object({
    /** Horizontal scroll offset */
    x: zod_1.z.number().optional(),
    /** Vertical scroll offset */
    y: zod_1.z.number().optional(),
    /** Scroll behavior */
    behavior: zod_1.z.enum(['auto', 'smooth']).optional(),
}).strict();
/**
 * Parameters for navigate operation
 */
exports.NavigateParamsSchema = zod_1.z.object({
    /** URL to navigate to */
    url: zod_1.z.string().url(),
    /** Wait until navigation condition (default: 'load') */
    waitUntil: zod_1.z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
    /** Navigation timeout in milliseconds */
    timeout: zod_1.z.number().int().min(0).optional(),
}).strict();
/**
 * Parameters for click operation
 */
exports.ClickParamsSchema = zod_1.z.object({
    /** CSS selector for the element to click */
    selector: zod_1.z.string().min(1),
    /** Click options */
    options: exports.ClickOptionsSchema.optional(),
}).strict();
/**
 * Parameters for type operation
 */
exports.TypeParamsSchema = zod_1.z.object({
    /** CSS selector for the input element */
    selector: zod_1.z.string().min(1),
    /** Text to type */
    text: zod_1.z.string(),
    /** Type options */
    options: exports.TypeOptionsSchema.optional(),
}).strict();
/**
 * Parameters for screenshot operation
 */
exports.ScreenshotParamsSchema = zod_1.z.object({
    /** CSS selector for element to screenshot (optional, defaults to page) */
    selector: zod_1.z.string().min(1).optional(),
    /** File path to save screenshot (optional, returns base64 if not provided) */
    path: zod_1.z.string().optional(),
    /** Screenshot options */
    options: exports.ScreenshotOptionsSchema.optional(),
}).strict();
/**
 * Parameters for compareScreenshot operation
 */
exports.CompareScreenshotParamsSchema = zod_1.z.object({
    /** Path to baseline screenshot */
    baseline: zod_1.z.string().min(1),
    /** Path to current screenshot (optional, takes new screenshot if not provided) */
    current: zod_1.z.string().optional(),
    /** Comparison options */
    options: exports.CompareScreenshotOptionsSchema.optional(),
}).strict();
/**
 * Parameters for evaluate operation
 */
exports.EvaluateParamsSchema = zod_1.z.object({
    /** JavaScript code to execute in browser context */
    script: zod_1.z.string().min(1),
    /** Arguments to pass to the script function */
    args: zod_1.z.array(zod_1.z.unknown()).optional(),
}).strict();
/**
 * Parameters for submit operation
 */
exports.SubmitParamsSchema = zod_1.z.object({
    /** CSS selector for the form or submit button */
    selector: zod_1.z.string().min(1),
}).strict();
/**
 * Parameters for waitForSelector operation
 */
exports.WaitForSelectorParamsSchema = zod_1.z.object({
    /** CSS selector to wait for */
    selector: zod_1.z.string().min(1),
    /** Wait options */
    options: exports.WaitOptionsSchema.optional(),
}).strict();
/**
 * Parameters for getAttribute operation
 */
exports.GetAttributeParamsSchema = zod_1.z.object({
    /** CSS selector for the element */
    selector: zod_1.z.string().min(1),
    /** Attribute name to get */
    attribute: zod_1.z.string().min(1),
}).strict();
/**
 * Parameters for getText operation
 */
exports.GetTextParamsSchema = zod_1.z.object({
    /** CSS selector for the element */
    selector: zod_1.z.string().min(1),
}).strict();
/**
 * Parameters for getHtml operation
 */
exports.GetHtmlParamsSchema = zod_1.z.object({
    /** CSS selector for the element */
    selector: zod_1.z.string().min(1),
    /** Whether to include outer HTML (default: true) */
    outer: zod_1.z.boolean().optional(),
}).strict();
/**
 * Parameters for scroll operation
 */
exports.ScrollParamsSchema = zod_1.z.object({
    /** CSS selector for element to scroll (optional, defaults to page) */
    selector: zod_1.z.string().min(1).optional(),
    /** Scroll options */
    options: exports.ScrollOptionsSchema.optional(),
}).strict();
/**
 * Parameters for hover operation
 */
exports.HoverParamsSchema = zod_1.z.object({
    /** CSS selector for the element to hover over */
    selector: zod_1.z.string().min(1),
    /** Position offset from element center */
    position: zod_1.z.object({
        x: zod_1.z.number(),
        y: zod_1.z.number(),
    }).optional(),
}).strict();
/**
 * Discriminated union of all browser operation parameters
 * Uses the 'operation' field as the discriminator
 */
exports.BrowserToolInputSchema = zod_1.z.discriminatedUnion('operation', [
    zod_1.z.object({ operation: zod_1.z.literal('navigate'), params: exports.NavigateParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('click'), params: exports.ClickParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('type'), params: exports.TypeParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('screenshot'), params: exports.ScreenshotParamsSchema.optional() }),
    zod_1.z.object({ operation: zod_1.z.literal('compareScreenshot'), params: exports.CompareScreenshotParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('evaluate'), params: exports.EvaluateParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('submit'), params: exports.SubmitParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('waitForSelector'), params: exports.WaitForSelectorParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('getAttribute'), params: exports.GetAttributeParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('getText'), params: exports.GetTextParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('getHtml'), params: exports.GetHtmlParamsSchema }),
    zod_1.z.object({ operation: zod_1.z.literal('scroll'), params: exports.ScrollParamsSchema.optional() }),
    zod_1.z.object({ operation: zod_1.z.literal('hover'), params: exports.HoverParamsSchema }),
]);
/**
 * Screenshot comparison result
 */
exports.ScreenshotComparisonResultSchema = zod_1.z.object({
    /** Similarity score between 0 (completely different) and 1 (identical) */
    similarity: zod_1.z.number().min(0).max(1),
    /** Number of different pixels */
    differentPixels: zod_1.z.number().int().min(0),
    /** Total number of pixels compared */
    totalPixels: zod_1.z.number().int().min(1),
    /** Whether the images pass the similarity threshold */
    isMatch: zod_1.z.boolean(),
    /** Path to diff image if generated */
    diffImagePath: zod_1.z.string().optional(),
    /** Dimensions of compared images */
    dimensions: zod_1.z.object({
        width: zod_1.z.number().int().min(0),
        height: zod_1.z.number().int().min(0),
    }),
});
/**
 * Output from the BrowserTool
 * Contains operation-specific results
 */
exports.BrowserToolOutputSchema = zod_1.z.object({
    /** Whether the operation succeeded */
    success: zod_1.z.boolean(),
    /** The operation that was executed */
    operation: exports.BrowserOperationSchema,
    /** Current page URL (after operation) */
    url: zod_1.z.string().optional(),
    /** Current page title */
    title: zod_1.z.string().optional(),
    /** Screenshot data (base64) or path */
    screenshot: zod_1.z.string().optional(),
    /** Screenshot comparison result */
    comparisonResult: exports.ScreenshotComparisonResultSchema.optional(),
    /** HTML content from getHtml operation */
    html: zod_1.z.string().optional(),
    /** Text content from getText operation */
    text: zod_1.z.string().optional(),
    /** Attribute value from getAttribute operation */
    attributeValue: zod_1.z.string().nullable().optional(),
    /** Result from evaluate operation */
    evaluationResult: zod_1.z.unknown().optional(),
    /** Operation duration in milliseconds */
    duration: zod_1.z.number().optional(),
    /** Error message if operation failed */
    error: zod_1.z.string().optional(),
    /** Console messages captured during operation */
    consoleMessages: zod_1.z.array(exports.ConsoleMessageSchema).optional(),
    /** Browser errors captured during operation */
    browserErrors: zod_1.z.array(exports.BrowserErrorSchema).optional(),
    /** Session ID for tracking browser resources */
    sessionId: zod_1.z.string().optional(),
    /** Whether operation was denied due to permissions */
    permissionDenied: zod_1.z.boolean().optional(),
    /** Additional metadata about the operation */
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
// ============================================================================
// Browser Session Types
// ============================================================================
/**
 * Configuration for browser sessions
 */
exports.BrowserSessionConfigSchema = zod_1.z.object({
    /** Browser type to use */
    browserType: zod_1.z.enum(['chromium', 'firefox', 'webkit']).optional().default('chromium'),
    /** Whether to run in headless mode */
    headless: zod_1.z.boolean().optional().default(true),
    /** Default timeout in milliseconds */
    timeout: zod_1.z.number().int().min(1000).optional().default(30000),
    /** Viewport configuration */
    viewport: zod_1.z.object({
        width: zod_1.z.number().int().min(100),
        height: zod_1.z.number().int().min(100),
    }).optional(),
    /** User agent string */
    userAgent: zod_1.z.string().optional(),
    /** Whether to ignore HTTPS errors */
    ignoreHTTPSErrors: zod_1.z.boolean().optional().default(false),
});
/**
 * Configuration for search tools (Grep)
 * Extends base config with search-specific settings
 */
exports.SearchToolConfigSchema = exports.BaseToolPermissionConfigSchema.extend({
    /** Directory access control for search scope */
    directoryAccess: exports.DirectoryAccessConfigSchema.optional(),
    /** Maximum number of results */
    maxResults: zod_1.z.number().int().min(1).optional().default(1000),
    /** File patterns to include in search */
    includePatterns: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** File patterns to exclude from search */
    excludePatterns: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
/**
 * Union of all tool-specific configuration schemas
 * Provides per-tool settings that control how tools operate
 */
exports.ToolPermissionConfigSchema = zod_1.z.union([
    exports.FilesystemToolConfigSchema,
    exports.ShellToolConfigSchema,
    exports.WebToolConfigSchema,
    exports.BrowserToolConfigSchema,
    exports.SearchToolConfigSchema,
    exports.BaseToolPermissionConfigSchema, // Fallback for generic tools
]);
/**
 * Per-tool configuration map for config.yaml
 */
exports.ToolConfigSchema = zod_1.z.record(exports.ToolPermissionConfigSchema).optional().default({});
/**
 * Extended permission schema with per-tool configuration
 * Adds tool-specific settings, grant metadata, and categorization
 */
exports.ExtendedPermissionSchema = exports.PermissionSchema.extend({
    /** Per-tool configuration settings */
    config: exports.ToolPermissionConfigSchema.optional(),
    /** Description of why this permission was granted */
    grantReason: zod_1.z.string().optional(),
    /** Who/what granted this permission (user, system, agent name) */
    grantedBy: zod_1.z.string().optional(),
    /** Tags for categorizing and filtering permissions */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
/**
 * JSON Schema type for tool parameters
 */
exports.JSONSchemaTypeSchema = zod_1.z.enum([
    'string',
    'number',
    'integer',
    'boolean',
    'object',
    'array',
    'null',
]);
exports.ToolParameterSchema = zod_1.z.lazy(() => zod_1.z.object({
    name: zod_1.z.string().min(1, 'Parameter name is required'),
    type: exports.JSONSchemaTypeSchema,
    description: zod_1.z.string().optional(),
    required: zod_1.z.boolean().optional(),
    default: zod_1.z.unknown().optional(),
    enum: zod_1.z.array(zod_1.z.unknown()).optional(),
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.lazy(() => exports.ToolParameterSchema)).optional(),
    items: zod_1.z.lazy(() => exports.ToolParameterSchema).optional(),
    minimum: zod_1.z.number().optional(),
    maximum: zod_1.z.number().optional(),
    minLength: zod_1.z.number().optional(),
    maxLength: zod_1.z.number().optional(),
    pattern: zod_1.z.string().optional(),
}));
/**
 * JSON Schema representation of tool parameters
 * Compatible with JSON Schema Draft 7 for tool parameter definitions
 */
exports.ToolParametersSchemaSchema = zod_1.z.object({
    /** JSON Schema type (typically 'object' for tool parameters) */
    type: zod_1.z.literal('object').default('object'),
    /** Object properties defining each parameter */
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.object({
        type: exports.JSONSchemaTypeSchema,
        description: zod_1.z.string().optional(),
        default: zod_1.z.unknown().optional(),
        enum: zod_1.z.array(zod_1.z.unknown()).optional(),
        properties: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        items: zod_1.z.unknown().optional(),
        minimum: zod_1.z.number().optional(),
        maximum: zod_1.z.number().optional(),
        minLength: zod_1.z.number().optional(),
        maxLength: zod_1.z.number().optional(),
        pattern: zod_1.z.string().optional(),
    })).optional().default({}),
    /** Array of required property names */
    required: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether additional properties are allowed */
    additionalProperties: zod_1.z.boolean().optional().default(false),
});
/**
 * Example usage for a tool
 */
exports.ToolExampleSchema = zod_1.z.object({
    /** Name/title of the example */
    name: zod_1.z.string().min(1),
    /** Description of what this example demonstrates */
    description: zod_1.z.string().optional(),
    /** Input parameters for the example */
    input: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Expected output (optional) */
    output: zod_1.z.unknown().optional(),
});
/**
 * Complete tool definition schema
 * Defines all metadata and configuration for a tool that agents can use
 */
exports.ToolDefinitionSchema = zod_1.z.object({
    /** Unique tool identifier */
    name: zod_1.z.string().min(1, 'Tool name is required').max(64, 'Tool name must be 64 characters or less'),
    /** Human-readable description of what the tool does */
    description: zod_1.z.string().min(1, 'Tool description is required'),
    /** JSON Schema definition for tool parameters */
    parameters: exports.ToolParametersSchemaSchema,
    /** Whether this tool performs dangerous operations requiring confirmation */
    dangerous: zod_1.z.boolean().default(false),
    /** Permission requirements for executing this tool */
    permissions: zod_1.z.array(exports.ToolPermissionSchema).default([]),
    /** Category for organizing and filtering tools */
    category: exports.ToolCategorySchema,
    /** Optional usage examples */
    examples: zod_1.z.array(exports.ToolExampleSchema).optional(),
    /** Deprecation notice if tool is deprecated */
    deprecated: zod_1.z.string().optional(),
    /** Version of the tool (semver) */
    version: zod_1.z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format').optional(),
    /** Whether the tool is enabled by default */
    enabled: zod_1.z.boolean().default(true),
    /** Tags for additional categorization */
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
// ============================================================================
// Custom Tool Configuration (v0.5.0)
// ============================================================================
/**
 * Output parser type for custom tools
 * Defines how custom tool output should be processed and formatted
 */
exports.CustomToolOutputParserSchema = zod_1.z.enum(['json', 'text', 'lines']);
exports.CustomToolConfigSchema = zod_1.z.object({
    /** Unique tool identifier */
    name: zod_1.z.string().min(1, 'Tool name is required').max(64, 'Tool name must be 64 characters or less'),
    /** Human-readable description of what the tool does */
    description: zod_1.z.string().min(1, 'Tool description is required'),
    /** Command to execute for the tool */
    command: zod_1.z.string().min(1, 'Command is required'),
    /** Command-line arguments for the tool */
    args: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** JSON Schema for tool parameters */
    parameters: exports.ToolParametersSchemaSchema.optional().default({
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
    }),
    /** How to parse tool output */
    outputParser: exports.CustomToolOutputParserSchema.optional().default('text'),
    /** Timeout for tool execution in milliseconds */
    timeoutMs: zod_1.z.number().int().min(1).optional().default(60000),
    /** Working directory for tool execution */
    workingDirectory: zod_1.z.string().optional(),
    /** Environment variables for tool execution */
    env: zod_1.z.record(zod_1.z.string()).optional(),
    /** Whether the tool is enabled */
    enabled: zod_1.z.boolean().optional().default(true),
});
/**
 * Result of a tool execution
 */
exports.ToolResultSchema = zod_1.z.object({
    /** Whether the tool execution was successful */
    success: zod_1.z.boolean(),
    /** The output data from the tool */
    output: zod_1.z.unknown().optional(),
    /** Error message if the execution failed */
    error: zod_1.z.string().optional(),
    /** Execution duration in milliseconds */
    duration: zod_1.z.number().min(0).optional(),
    /** Additional metadata about the execution */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Tool name that was executed */
    toolName: zod_1.z.string().optional(),
    /** Timestamp when the tool was invoked */
    invokedAt: zod_1.z.date().optional(),
    /** Timestamp when the tool completed */
    completedAt: zod_1.z.date().optional(),
});
/**
 * Tool invocation request
 */
exports.ToolInvocationSchema = zod_1.z.object({
    /** Tool to invoke */
    toolName: zod_1.z.string().min(1),
    /** Parameters to pass to the tool */
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Optional timeout in milliseconds */
    timeout: zod_1.z.number().min(0).optional(),
    /** Request ID for tracking */
    requestId: zod_1.z.string().optional(),
    /** Context about who/what is invoking the tool */
    context: zod_1.z.object({
        taskId: zod_1.z.string().optional(),
        agentName: zod_1.z.string().optional(),
        stageName: zod_1.z.string().optional(),
    }).optional(),
});
/**
 * Complete tool execution record with timing information
 * Tracks the full lifecycle of a tool execution from start to completion
 */
exports.ToolExecutionSchema = zod_1.z.object({
    /** Unique identifier for this tool execution */
    callId: zod_1.z.string().min(1),
    /** Name of the tool that was executed */
    toolName: zod_1.z.string().min(1),
    /** Input parameters passed to the tool */
    input: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** The task ID that initiated this tool execution */
    taskId: zod_1.z.string().optional(),
    /** Name of the agent that invoked the tool */
    agentName: zod_1.z.string().optional(),
    /** Workflow stage name when tool was invoked */
    stageName: zod_1.z.string().optional(),
    /** Timestamp when tool execution started */
    startTime: zod_1.z.date(),
    /** Timestamp when tool execution completed (if finished) */
    endTime: zod_1.z.date().optional(),
    /** Duration of execution in milliseconds (if completed) */
    duration: zod_1.z.number().min(0).optional(),
    /** Result of the tool execution (if completed) */
    result: zod_1.z.object({
        success: zod_1.z.boolean(),
        output: zod_1.z.unknown().optional(),
        error: zod_1.z.string().optional(),
    }).optional(),
    /** Error message if execution failed (top-level for easier access) */
    error: zod_1.z.string().optional(),
    /** Current status of the tool execution */
    status: zod_1.z.enum(['running', 'completed', 'failed']),
    /** Additional metadata about the execution */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Tool registry entry combining definition with runtime state
 */
exports.ToolRegistryEntrySchema = zod_1.z.object({
    /** The tool definition */
    definition: exports.ToolDefinitionSchema,
    /** Whether the tool is currently available */
    available: zod_1.z.boolean().default(true),
    /** Reason if the tool is unavailable */
    unavailableReason: zod_1.z.string().optional(),
    /** Last time the tool was invoked */
    lastInvoked: zod_1.z.date().optional(),
    /** Number of times the tool has been invoked */
    invocationCount: zod_1.z.number().min(0).default(0),
    /** Number of successful invocations */
    successCount: zod_1.z.number().min(0).default(0),
    /** Number of failed invocations */
    failureCount: zod_1.z.number().min(0).default(0),
});
// ============================================================================
// Tool Action Tracking Types (v0.5.0)
// ============================================================================
/**
 * File snapshot captured before tool modification
 * Stores the state of a file at a specific point in time for undo functionality
 */
exports.FileSnapshotSchema = zod_1.z.object({
    /** Unique identifier for this snapshot */
    id: zod_1.z.string().min(1),
    /** Absolute path to the file */
    filePath: zod_1.z.string().min(1),
    /** Content of the file at the time of snapshot */
    content: zod_1.z.string(),
    /** Checksum (hash) of the content for integrity verification */
    checksum: zod_1.z.string().min(1),
    /** File size in bytes */
    fileSize: zod_1.z.number().min(0),
    /** Last modified timestamp of the original file */
    lastModified: zod_1.z.date(),
    /** Timestamp when this snapshot was created */
    snapshotTime: zod_1.z.date(),
    /**
     * Whether the file existed before the snapshot was taken
     * Used for undo operations to know if a file should be deleted (if it didn't exist)
     * or restored to its previous content (if it did exist)
     */
    existed: zod_1.z.boolean().default(true),
    /** Optional metadata about the snapshot */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Tool action record for tracking tool executions with file changes
 * Extends ToolExecution with file modification tracking and undo capability
 */
exports.ToolActionSchema = zod_1.z.object({
    /** Unique identifier for this tool action */
    id: zod_1.z.string().min(1),
    /** The underlying tool execution record */
    execution: exports.ToolExecutionSchema,
    /** Files that were modified by this tool action */
    modifiedFiles: zod_1.z.array(zod_1.z.string()).default([]),
    /** File snapshots taken before modifications */
    beforeSnapshots: zod_1.z.array(exports.FileSnapshotSchema).default([]),
    /** File snapshots taken after modifications (for verification) */
    afterSnapshots: zod_1.z.array(exports.FileSnapshotSchema).default([]),
    /** Whether this action can be undone */
    canUndo: zod_1.z.boolean().default(true),
    /** Whether this action has been undone */
    wasUndone: zod_1.z.boolean().default(false),
    /** Timestamp when undo was performed (if applicable) */
    undoneAt: zod_1.z.date().optional(),
    /** Error message if undo failed */
    undoError: zod_1.z.string().optional(),
    /** Sequence number within the task for ordering */
    sequenceNumber: zod_1.z.number().min(0),
    /** Optional grouping identifier for related actions */
    actionGroup: zod_1.z.string().optional(),
});
/**
 * Configuration for tool action store retention policies
 */
exports.ToolActionRetentionConfigSchema = zod_1.z.object({
    /** Maximum number of tool actions to keep per task */
    maxActionsPerTask: zod_1.z.number().min(1).default(1000),
    /** Maximum age of tool actions in days before cleanup */
    maxAgeDays: zod_1.z.number().min(1).default(30),
    /** Whether to keep snapshots for undone actions */
    keepUndoneSnapshots: zod_1.z.boolean().default(false),
    /** Maximum total storage size for snapshots in MB */
    maxSnapshotStorageMB: zod_1.z.number().min(1).default(100),
});
// ============================================================================
// Tool Action Snapshot Types (v0.5.0)
// ============================================================================
/**
 * Represents a collection of file snapshots for a single tool action
 * Enables grouped undo operations by tracking all files modified by a tool
 */
exports.ToolActionSnapshotSchema = zod_1.z.object({
    /** Unique identifier for this action snapshot (typically same as the tool action ID) */
    actionId: zod_1.z.string().min(1),
    /** Name of the tool that performed the action (e.g., 'Write', 'Edit', 'Bash') */
    toolName: zod_1.z.string().min(1),
    /** File snapshots taken before the tool action was executed */
    snapshots: zod_1.z.array(exports.FileSnapshotSchema),
    /** Timestamp when this action snapshot was created */
    timestamp: zod_1.z.date(),
    /** Optional human-readable description of what the tool action did */
    description: zod_1.z.string().optional(),
    /** Whether this action snapshot can be used for undo operations */
    canUndo: zod_1.z.boolean().default(true),
});
// ============================================================================
// Tool Alias Definitions (v0.5.0)
// ============================================================================
/**
 * Parameter types supported by tool aliases
 */
exports.AliasParameterTypeSchema = zod_1.z.enum(['string', 'number', 'boolean']);
/**
 * Tool alias parameter definition
 * Defines a parameter that can be passed to a tool alias
 */
exports.AliasParameterSchema = zod_1.z.object({
    /** Parameter name */
    name: zod_1.z.string().min(1),
    /** Parameter type */
    type: exports.AliasParameterTypeSchema,
    /** Parameter description */
    description: zod_1.z.string().min(1),
    /** Default value for the parameter */
    default: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]).optional(),
    /** Allowed values for string parameters */
    values: zod_1.z.array(zod_1.z.string()).optional(),
    /** Whether the parameter is required */
    required: zod_1.z.boolean().optional().default(false),
});
/**
 * Tool alias definition schema
 * Defines a reusable tool configuration with parameterization
 */
exports.ToolAliasSchema = zod_1.z.object({
    /** Alias name */
    name: zod_1.z.string().min(1),
    /** Target tool name */
    tool: zod_1.z.string().min(1),
    /** Alias description */
    description: zod_1.z.string().min(1),
    /** Tool parameters with template placeholders */
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Default parameters for the tool */
    defaults: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Parameter templates with placeholder substitution */
    parameterTemplates: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Tool execution timeout in milliseconds */
    timeout: zod_1.z.number().positive().optional(),
    /** Whether to require confirmation before execution */
    requireConfirmation: zod_1.z.boolean().optional().default(false),
    /** Tags for organizing aliases */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether the alias is enabled */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Parameter definitions for template substitution */
    aliasParameters: zod_1.z.array(exports.AliasParameterSchema).optional().default([]),
});
/**
 * Tool alias configuration section in config.yaml
 */
exports.ToolAliasConfigSchema = zod_1.z.object({
    /** List of tool aliases */
    aliases: zod_1.z.array(exports.ToolAliasSchema).optional().default([]),
});
/**
 * Expanded tool alias result
 * Result of resolving an alias with parameters
 */
exports.ExpandedToolAliasSchema = zod_1.z.object({
    /** Original alias name */
    aliasName: zod_1.z.string(),
    /** Target tool name */
    tool: zod_1.z.string(),
    /** Resolved parameters after template substitution */
    parameters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Original alias definition */
    alias: exports.ToolAliasSchema,
});
/**
 * Tool alias validation result
 */
exports.AliasParameterValidationResultSchema = zod_1.z.object({
    /** Whether validation passed */
    valid: zod_1.z.boolean(),
    /** Validation errors if any */
    errors: zod_1.z.array(zod_1.z.string()).default([]),
    /** Sanitized parameter values */
    sanitizedParams: zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()])).optional(),
});
// ============================================================================
// Undo Event Types (v0.5.0)
// ============================================================================
/**
 * Types of undo/redo events that can occur in the system
 */
exports.UndoEventTypeSchema = zod_1.z.enum([
    'undo:requested', // User or system requested an undo operation
    'undo:started', // Undo operation has begun executing
    'undo:completed', // Undo operation completed successfully
    'undo:failed', // Undo operation failed
    'redo:requested', // User or system requested a redo operation
    'redo:started', // Redo operation has begun executing
    'redo:completed', // Redo operation completed successfully
    'redo:failed', // Redo operation failed
]);
/**
 * Event record for undo/redo operations
 * Tracks the lifecycle of undo operations for auditing and debugging
 */
exports.UndoEventSchema = zod_1.z.object({
    /** Unique identifier for this undo event */
    id: zod_1.z.string().min(1),
    /** Type of undo event */
    type: exports.UndoEventTypeSchema,
    /** ID of the task this undo event belongs to */
    taskId: zod_1.z.string().min(1),
    /** ID of the tool action being undone or redone */
    actionId: zod_1.z.string().min(1),
    /** ID of the tool action snapshot used for the operation (if applicable) */
    snapshotId: zod_1.z.string().optional(),
    /** Timestamp when this event occurred */
    timestamp: zod_1.z.date(),
    /** Absolute paths of files affected by the undo/redo operation */
    affectedFiles: zod_1.z.array(zod_1.z.string()).default([]),
    /** Error message if the operation failed */
    error: zod_1.z.string().optional(),
    /** Additional metadata about the operation */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Result of an undo or redo operation
 * Contains details about which files were restored and any failures
 */
exports.UndoOperationResultSchema = zod_1.z.object({
    /** Whether the overall undo operation succeeded */
    success: zod_1.z.boolean(),
    /** ID of the tool action that was undone */
    actionId: zod_1.z.string().min(1),
    /** Absolute paths of files that were successfully restored */
    restoredFiles: zod_1.z.array(zod_1.z.string()).default([]),
    /** Files that failed to restore with error details */
    failedFiles: zod_1.z.array(zod_1.z.object({
        /** Absolute path to the file that failed to restore */
        path: zod_1.z.string(),
        /** Error message describing why the restore failed */
        error: zod_1.z.string(),
    })).default([]),
    /** Timestamp when the undo operation completed */
    completedAt: zod_1.z.date(),
    /** Error message if the overall operation failed */
    error: zod_1.z.string().optional(),
});
// ============================================================================
// Autonomy Control Types
// ============================================================================
/**
 * Autonomy levels that control how much human oversight is required
 * - full-auto: Agent operates autonomously with no approval checkpoints
 * - review-before-commit: Agent pauses for human review before committing changes
 * - review-all: Agent pauses for human review at all major decision points
 */
exports.AutonomyLevelSchema = zod_1.z.enum([
    'full-auto',
    'review-before-commit',
    'review-all',
]);
/**
 * @deprecated Use AutonomyLevelSchema instead. This is kept for backward compatibility.
 * Maps legacy values to new autonomy levels:
 * - 'full' -> 'full-auto'
 * - 'review-before-commit' -> 'review-before-commit'
 * - 'review-before-merge' -> 'review-before-commit'
 * - 'manual' -> 'review-all'
 */
exports.LegacyAutonomyLevelSchema = zod_1.z.enum([
    'full',
    'review-before-commit',
    'review-before-merge',
    'manual',
]);
/**
 * Converts a legacy autonomy level to the new format
 */
function migrateLegacyAutonomyLevel(legacy) {
    switch (legacy) {
        case 'full':
            return 'full-auto';
        case 'review-before-commit':
        case 'review-before-merge':
            return 'review-before-commit';
        case 'manual':
            return 'review-all';
    }
}
/**
 * Types of approval checkpoints that can be configured
 * - before-commit: Requires approval before committing changes to version control
 * - before-deploy: Requires approval before deployment operations
 * - before-destructive: Requires approval before destructive operations (delete, overwrite)
 * - deployment: Requires approval for deployment operations
 * - custom: User-defined checkpoint with custom trigger condition
 */
exports.ApprovalCheckpointTypeSchema = zod_1.z.enum([
    'before-commit',
    'before-deploy',
    'before-destructive',
    'before-network',
    'before-file-write',
    'deployment',
    'custom',
]);
/**
 * Configuration for an approval gate (checkpoint)
 * Defines when and how approval is required during task execution
 */
exports.ApprovalGateSchema = zod_1.z.object({
    /** Unique identifier for this gate */
    id: zod_1.z.string().optional(),
    /** Type of checkpoint */
    type: exports.ApprovalCheckpointTypeSchema,
    /** Human-readable name for this gate */
    name: zod_1.z.string().optional(),
    /** Description of what this gate protects */
    description: zod_1.z.string().optional(),
    /** Whether this gate is required or can be skipped */
    required: zod_1.z.boolean().default(true),
    /** Custom trigger condition (for 'custom' type) - evaluated as expression */
    trigger: zod_1.z.string().optional(),
    /** List of approver identifiers (usernames, roles, or emails) */
    approvers: zod_1.z.array(zod_1.z.string()).optional(),
    /** Timeout in minutes before the gate auto-rejects (undefined = no timeout) */
    timeout: zod_1.z.number().min(1).optional(),
    /** Whether to auto-approve always (shortcut for simple gates) */
    autoApprove: zod_1.z.boolean().default(false),
    /** Whether to auto-approve if timeout is reached (default: false = auto-reject) */
    autoApproveOnTimeout: zod_1.z.boolean().default(false),
    /** Minimum number of approvals required (default: 1) */
    minApprovals: zod_1.z.number().min(1).default(1),
    /** Tags/labels for categorizing this gate */
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * Resource limits for task execution
 * Controls budget, token usage, time, and change scope
 */
exports.TaskResourceLimitsSchema = zod_1.z.object({
    /** Maximum cost in USD for this task (e.g., 10.0 for $10) */
    maxCost: zod_1.z.number().min(0).optional(),
    /** Maximum tokens that can be consumed (input + output) */
    maxTokens: zod_1.z.number().min(0).optional(),
    /** Maximum execution time in milliseconds */
    maxTimeMs: zod_1.z.number().min(0).optional(),
    /** Maximum number of files that can be created */
    maxFilesCreated: zod_1.z.number().min(0).optional(),
    /** Maximum number of files that can be modified */
    maxFilesModified: zod_1.z.number().min(0).optional(),
    /** Maximum number of files that can be deleted */
    maxFilesDeleted: zod_1.z.number().min(0).optional(),
    /** Maximum total lines of code that can be changed (added + removed) */
    maxLinesChanged: zod_1.z.number().min(0).optional(),
    /** Maximum number of API/agent turns */
    maxTurns: zod_1.z.number().min(1).optional(),
    /** Daily budget limit in USD (shared across all tasks) */
    dailyBudget: zod_1.z.number().min(0).optional(),
    /** Maximum concurrent tasks allowed */
    maxConcurrentTasks: zod_1.z.number().min(1).optional(),
});
/**
 * Behavior to take when an approval is rejected/denied
 * - 'skip': Skip the current action and continue to the next one
 * - 'abort': Terminate the entire task with 'rejected' status
 */
exports.RejectionBehaviorSchema = zod_1.z.enum([
    'skip',
    'abort',
]);
/**
 * Per-agent autonomy override settings
 * Allows configuring autonomy behavior for specific agents with more granular control
 * than just the autonomy level. Useful for giving different agents different
 * approval requirements, timeouts, and rejection behaviors.
 */
exports.AgentAutonomyOverrideSchema = zod_1.z.object({
    /** Autonomy level for this agent (overrides the global level) */
    level: exports.AutonomyLevelSchema.optional(),
    /** Approval timeout in minutes for this agent (overrides global approvalTimeout) */
    approvalTimeout: zod_1.z.number().min(1).optional(),
    /** Rejection behavior for this agent (overrides global rejectionBehavior) */
    rejectionBehavior: exports.RejectionBehaviorSchema.optional(),
    /** Approval gates specific to this agent (merged with global gates) */
    gates: zod_1.z.array(exports.ApprovalGateSchema).optional(),
});
/**
 * Autonomy configuration for a workflow or task
 * Combines autonomy level with approval gates and resource limits
 */
exports.AutonomyConfigSchema = zod_1.z.object({
    /** Base autonomy level */
    level: exports.AutonomyLevelSchema.default('review-before-commit'),
    /** Approval gates/checkpoints for this configuration */
    gates: zod_1.z.array(exports.ApprovalGateSchema).optional(),
    /** Resource limits for task execution */
    limits: exports.TaskResourceLimitsSchema.optional(),
    /** Per-stage autonomy overrides (stage name -> autonomy level) */
    stageOverrides: zod_1.z.record(zod_1.z.string(), exports.AutonomyLevelSchema).optional(),
    /**
     * Per-agent autonomy overrides
     * Can be either a simple autonomy level string or a full AgentAutonomyOverrideSchema
     * for more granular control. Examples:
     *   agentOverrides: { developer: 'supervised' }  // Simple level override
     *   agentOverrides: { developer: { level: 'supervised', approvalTimeout: 30 } }  // Full override
     */
    agentOverrides: zod_1.z.record(zod_1.z.string(), zod_1.z.union([exports.AutonomyLevelSchema, exports.AgentAutonomyOverrideSchema])).optional(),
    /** Behavior to take when an approval is rejected/denied */
    rejectionBehavior: exports.RejectionBehaviorSchema.default('abort'),
    /**
     * Global approval timeout in minutes
     * Default timeout for approval requests across all gates and agents.
     * Individual gates and agent overrides can specify their own timeouts.
     * If undefined, no global timeout is enforced (individual gate timeouts still apply).
     */
    approvalTimeout: zod_1.z.number().min(1).optional(),
});
// ============================================================================
// Workflow Definitions
// ============================================================================
/**
 * Schema for workflow approval gates
 * Defines checkpoints in workflows that require manual approval or automated validation
 * @example
 * ```typescript
 * const gate: WorkflowGate = {
 *   id: 'security-review',
 *   name: 'Security Review Gate',
 *   trigger: 'stage:implementation:completed',
 *   required: true,
 *   approvers: ['security-team@company.com']
 * };
 * ```
 */
/**
 * Schema defining an approval gate in the APEX workflow system
 * @description
 * Workflow gates provide a flexible mechanism for human or automated approval
 * before proceeding to subsequent stages. They act as critical checkpoints in the workflow,
 * allowing for:
 * - Governance and compliance enforcement
 * - Quality control and review processes
 * - Manual intervention and expert validation
 * - Conditional workflow progression
 *
 * @remarks
 * Gates can be:
 * - Mandatory (required: true) or optional
 * - Manually approved or auto-approved
 * - Triggered by specific workflow events
 * - Assigned to specific approvers or teams
 *
 * @example
 * ```typescript
 * const gate: WorkflowGate = {
 *   id: 'security-review',
 *   name: 'Security Review Gate',
 *   description: 'Mandatory security review before code deployment',
 *   trigger: 'stage:implementation:completed',
 *   required: true,
 *   autoApprove: false,
 *   approvers: ['security-team@company.com'],
 *   timeout: 1440,  // 24 hours to approve
 *   tags: ['security', 'compliance']
 * };
 * ```
 *
 * @see {@link WorkflowDefinition} for using gates in a complete workflow
 *
 * @property {string} id - Unique identifier for the gate
 * @property {string} [name] - Optional human-readable name
 * @property {string} [description] - Optional detailed description
 * @property {string} trigger - Event that triggers gate activation
 * @property {boolean} [required=true] - Whether gate is mandatory
 * @property {boolean} [autoApprove=false] - Automatically approve after timeout
 * @property {string[]} [approvers] - Authorized approvers
 * @property {number} [timeout] - Maximum approval time in minutes
 * @property {string[]} [tags] - Optional categorization tags
 *
 * @category Workflow
 * @category Governance
 */
exports.WorkflowGateSchema = zod_1.z.object({
    /** Unique identifier for this gate */
    id: zod_1.z.string(),
    /** Human-readable name for this gate (optional) */
    name: zod_1.z.string().optional(),
    /** Description of what this gate validates (optional) */
    description: zod_1.z.string().optional(),
    /** Event that triggers this gate (e.g., 'stage:planning:completed') */
    trigger: zod_1.z.string(),
    /** Whether this gate must be approved before proceeding (default: true) */
    required: zod_1.z.boolean().default(true),
    /** Whether to automatically approve without manual intervention (default: false) */
    autoApprove: zod_1.z.boolean().default(false),
    /** List of users/teams who can approve this gate (optional) */
    approvers: zod_1.z.array(zod_1.z.string()).optional(),
    /** Timeout in minutes before auto-approval or failure (optional) */
    timeout: zod_1.z.number().optional(),
    /** Tags for categorizing or filtering gates (optional) */
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * Schema for individual workflow stages
 * Defines a single step in a workflow that is executed by a specific agent
 * @example
 * ```typescript
 * const stage: WorkflowStage = {
 *   name: 'implementation',
 *   agent: 'developer',
 *   description: 'Write the implementation code',
 *   dependsOn: ['planning', 'architecture'],
 *   outputs: ['code_changes', 'test_results'],
 *   gate: 'code-review-gate'
 * };
 * ```
 */
/**
 * Schema defining a single stage in an APEX workflow
 * @description
 * Workflow stages represent individual steps in an automated process,
 * executed by specific agents with configurable dependencies, inputs,
 * and outputs.
 *
 * @remarks
 * Stages provide granular control over workflow execution through:
 * - Agent-specific task assignments
 * - Stage dependency management
 * - Parallel and sequential processing
 * - Conditional execution
 * - Retry mechanisms
 *
 * @example
 * ```typescript
 * const stage: WorkflowStage = {
 *   name: 'code-generation',
 *   agent: 'developer',
 *   description: 'Generate implementation code based on requirements',
 *   dependsOn: ['requirements-analysis'],
 *   parallel: false,
 *   inputs: ['requirements'],
 *   outputs: ['generated-code', 'implementation-notes'],
 *   condition: 'requirements.complexity < 5',
 *   gate: 'code-review-gate',
 *   maxRetries: 2
 * };
 * ```
 *
 * @see {@link WorkflowDefinition} for creating complete workflows
 * @see {@link WorkflowGate} for stage approval mechanisms
 *
 * @property {string} name - Unique stage name within the workflow
 * @property {string} agent - Agent type responsible for this stage
 * @property {string} [description] - Optional stage description
 * @property {string[]} [dependsOn] - Stages that must complete first
 * @property {boolean} [parallel=false] - Whether stage can run in parallel
 * @property {string[]} [inputs] - Expected input keys
 * @property {string[]} [outputs] - Produced output keys
 * @property {string} [condition] - Conditional execution expression
 * @property {string[]} [actions] - Commands or actions to perform
 * @property {string} [gate] - Approval gate to trigger after stage
 * @property {number} [maxRetries=2] - Maximum retry attempts on failure
 *
 * @category Workflow
 * @category Automation
 */
exports.WorkflowStageSchema = zod_1.z.object({
    /** Name of this stage (must be unique within workflow) */
    name: zod_1.z.string(),
    /** Agent type that will execute this stage */
    agent: zod_1.z.string(),
    /** Description of what this stage accomplishes (optional) */
    description: zod_1.z.string().optional(),
    /** Names of stages that must complete before this one (optional) */
    dependsOn: zod_1.z.array(zod_1.z.string()).optional(),
    /** Whether this stage can run in parallel with others (default: false) */
    parallel: zod_1.z.boolean().optional().default(false),
    /** List of input keys this stage expects from previous stages (optional) */
    inputs: zod_1.z.array(zod_1.z.string()).optional(),
    /** List of output keys this stage will provide to subsequent stages (optional) */
    outputs: zod_1.z.array(zod_1.z.string()).optional(),
    /** Conditional expression to determine if stage should run (optional) */
    condition: zod_1.z.string().optional(),
    /** List of actions or commands this stage should perform (optional) */
    actions: zod_1.z.array(zod_1.z.string()).optional(),
    /** ID of approval gate to trigger after this stage (optional) */
    gate: zod_1.z.string().nullable().optional(),
    /** Maximum number of retry attempts if stage fails (default: 2) */
    maxRetries: zod_1.z.number().optional().default(2),
});
/**
 * Isolation configuration schema for workflows
 * Defines how tasks should be isolated during execution
 */
/**
 * Schema defining task isolation configuration for APEX workflows
 * @description
 * Isolation configuration provides granular control over the
 * execution environment for workflow tasks, ensuring security,
 * resource management, and clean workflow execution.
 *
 * @remarks
 * Isolation modes offer different levels of environment separation:
 * - 'full': Complete containerization with strict resource boundaries
 * - 'worktree': Git-based workspace isolation
 * - 'shared': Minimal isolation, tasks share common environment
 *
 * Key features:
 * - Container configuration for full isolation
 * - Automatic workspace cleanup
 * - Preserving workspaces for debugging
 *
 * @example
 * ```typescript
 * const isolation: IsolationConfig = {
 *   mode: 'full',
 *   container: {
 *     image: 'apex-task-runner:latest',
 *     resources: {
 *       cpu: '2',
 *       memory: '4G'
 *     }
 *   },
 *   cleanupOnComplete: true,
 *   preserveOnFailure: false
 * };
 *
 * const gitIsolation: IsolationConfig = {
 *   mode: 'worktree',
 *   cleanupOnComplete: true
 * };
 * ```
 *
 * @see {@link WorkflowDefinition} for using isolation in workflows
 *
 * @property {string} mode - Isolation mode ('full', 'worktree', 'shared')
 * @property {Object} [container] - Container configuration for 'full' mode
 * @property {boolean} [cleanupOnComplete=true] - Cleanup workspace after task
 * @property {boolean} [preserveOnFailure=false] - Keep workspace on task failure
 *
 * @category Workflow
 * @category Security
 */
exports.IsolationConfigSchema = zod_1.z.object({
    /** Isolation mode for this workflow */
    mode: zod_1.z.lazy(() => exports.IsolationModeSchema),
    /** Container configuration for 'full' mode (optional) */
    container: zod_1.z.lazy(() => exports.ContainerConfigSchema).optional(),
    /** Whether to cleanup workspace after task completion (default: true) */
    cleanupOnComplete: zod_1.z.boolean().optional().default(true),
    /** Whether to preserve workspace on task failure (default: false) */
    preserveOnFailure: zod_1.z.boolean().optional().default(false),
});
/**
 * Schema for complete workflow definitions
 * Defines a multi-stage automated process with agents, dependencies, and approval gates
 * @example
 * ```typescript
 * const workflow: WorkflowDefinition = {
 *   name: 'feature-development',
 *   description: 'Full feature development lifecycle',
 *   trigger: ['feature:requested', 'pr:opened'],
 *   stages: [
 *     { name: 'planning', agent: 'planner' },
 *     { name: 'implementation', agent: 'developer', dependsOn: ['planning'] }
 *   ],
 *   gates: [{ id: 'security-review', trigger: 'stage:implementation:completed' }]
 * };
 * ```
 */
/**
 * Schema defining a complete workflow in the APEX system
 * @description
 * Workflow definitions provide a comprehensive blueprint for
 * automated, multi-stage processes with configurable stages,
 * gates, and isolation mechanisms.
 *
 * @remarks
 * Workflows enable complex process orchestration through:
 * - Declarative stage definitions
 * - Approval gate management
 * - Task isolation configuration
 * - Event-driven triggering
 * - Cross-stage dependency management
 *
 * @example
 * ```typescript
 * const workflow: WorkflowDefinition = {
 *   name: 'feature-development',
 *   description: 'End-to-end feature implementation workflow',
 *   trigger: ['feature:requested'],
 *   stages: [
 *     {
 *       name: 'requirements',
 *       agent: 'planner',
 *       description: 'Analyze and document feature requirements'
 *     },
 *     {
 *       name: 'implementation',
 *       agent: 'developer',
 *       dependsOn: ['requirements'],
 *       description: 'Implement feature based on requirements'
 *     }
 *   ],
 *   gates: [
 *     {
 *       id: 'code-review',
 *       name: 'Code Review Approval',
 *       trigger: 'stage:implementation:completed'
 *     }
 *   ],
 *   isolation: {
 *     mode: 'worktree',
 *     cleanupOnComplete: true
 *   }
 * };
 * ```
 *
 * @see {@link WorkflowStage} for stage configuration
 * @see {@link WorkflowGate} for approval gate configuration
 * @see {@link IsolationConfig} for task isolation settings
 *
 * @property {string} name - Unique workflow name
 * @property {string} description - What the workflow accomplishes
 * @property {string[]} [trigger] - Events that can initiate the workflow
 * @property {WorkflowStage[]} stages - Ordered list of stages to execute
 * @property {WorkflowGate[]} [gates] - Approval gates for workflow checkpoints
 * @property {IsolationConfig} [isolation] - Workflow execution environment settings
 *
 * @category Workflow
 * @category Automation
 */
exports.WorkflowDefinitionSchema = zod_1.z.object({
    /** Unique name for this workflow */
    name: zod_1.z.string(),
    /** Description of what this workflow accomplishes */
    description: zod_1.z.string(),
    /** Events that can trigger this workflow (optional) */
    trigger: zod_1.z.array(zod_1.z.string()).optional(),
    /** Ordered list of stages to execute in this workflow */
    stages: zod_1.z.array(exports.WorkflowStageSchema),
    /** Approval gates for this workflow (optional) */
    gates: zod_1.z.array(exports.WorkflowGateSchema).optional(),
    /** Task isolation configuration for this workflow (optional) */
    isolation: exports.IsolationConfigSchema.optional(),
});
// ============================================================================
// Project Configuration
// ============================================================================
/**
 * Schema for project-specific configuration settings that define build, test, and development commands
 * @example
 * ```typescript
 * const projectConfig: ProjectConfig = {
 *   name: 'my-app',
 *   language: 'typescript',
 *   framework: 'react',
 *   testCommand: 'npm test',
 *   buildCommand: 'npm run build'
 * };
 * ```
 */
exports.ProjectConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    language: zod_1.z.string().optional(),
    framework: zod_1.z.string().optional(),
    testCommand: zod_1.z.string().optional().default('npm test'),
    lintCommand: zod_1.z.string().optional().default('npm run lint'),
    buildCommand: zod_1.z.string().optional().default('npm run build'),
    typecheckCommand: zod_1.z.string().optional().default('npm run typecheck'),
});
// ============================================================================
// Git Worktree Configuration
// ============================================================================
/**
 * Status of a git worktree
 */
exports.WorktreeStatusSchema = zod_1.z.enum([
    'active', // Worktree is active and in use by a task
    'stale', // Worktree exists but may need cleanup (no active task)
    'locked', // Worktree is locked (in use by another process)
    'prunable', // Worktree can be safely removed
]);
/**
 * Configuration for git worktree management
 */
exports.WorktreeConfigSchema = zod_1.z.object({
    /** Base directory for worktrees (default: sibling to project root, e.g., ../.apex-worktrees) */
    baseDir: zod_1.z.string().optional(),
    /** Automatically cleanup worktree after task completion (default: true) */
    cleanupOnComplete: zod_1.z.boolean().optional().default(true),
    /** Maximum number of concurrent worktrees allowed (default: 5) */
    maxWorktrees: zod_1.z.number().min(1).optional().default(5),
    /** Number of days after which stale worktrees are auto-pruned (default: 7) */
    pruneStaleAfterDays: zod_1.z.number().min(1).optional().default(7),
    /** Whether to preserve worktree on task failure for debugging (default: false) */
    preserveOnFailure: zod_1.z.boolean().optional().default(false),
    /** Delay in milliseconds before cleaning up worktree (default: 0) */
    cleanupDelayMs: zod_1.z.number().min(0).optional().default(0),
});
// ============================================================================
// Git Configuration
// ============================================================================
/**
 * Schema for Git workflow automation settings including branching, commits, pull requests, and worktree management
 * @example
 * ```typescript
 * const gitConfig: GitConfig = {
 *   branchPrefix: 'apex/',
 *   commitFormat: 'conventional',
 *   autoPush: true,
 *   createPR: 'always',
 *   autoWorktree: false
 * };
 * ```
 */
exports.GitConfigSchema = zod_1.z.object({
    branchPrefix: zod_1.z.string().optional().default('apex/'),
    commitFormat: zod_1.z.enum(['conventional', 'simple']).optional().default('conventional'),
    autoPush: zod_1.z.boolean().optional().default(true),
    defaultBranch: zod_1.z.string().optional().default('main'),
    // New options for automatic git operations
    commitAfterSubtask: zod_1.z.boolean().optional().default(true), // Commit after each subtask completes
    pushAfterTask: zod_1.z.boolean().optional().default(true), // Push after parent task completes
    createPR: zod_1.z.enum(['always', 'never', 'ask']).optional().default('always'), // When to create PR
    prDraft: zod_1.z.boolean().optional().default(false), // Create PR as draft
    prLabels: zod_1.z.array(zod_1.z.string()).optional(), // Labels to add to PR
    prReviewers: zod_1.z.array(zod_1.z.string()).optional(), // Reviewers to request
    // Worktree isolation settings (v0.4.0)
    autoWorktree: zod_1.z.boolean().optional().default(false), // Enable automatic worktree creation for tasks
    worktree: exports.WorktreeConfigSchema.optional(), // Worktree configuration options
});
/**
 * Schema for execution limits and budgets to control resource usage and prevent runaway operations
 * @example
 * ```typescript
 * const limits: LimitsConfig = {
 *   maxTokensPerTask: 500000,
 *   maxCostPerTask: 10.0,
 *   dailyBudget: 100.0,
 *   maxConcurrentTasks: 3,
 *   maxRetries: 3
 * };
 * ```
 */
exports.LimitsConfigSchema = zod_1.z.object({
    maxTokensPerTask: zod_1.z.number().optional().default(500000),
    maxCostPerTask: zod_1.z.number().optional().default(10.0),
    maxExecutionTime: zod_1.z.number().optional().default(0),
    maxFileChanges: zod_1.z.number().optional().default(0),
    dailyBudget: zod_1.z.number().optional().default(100.0),
    maxTurns: zod_1.z.number().optional().default(100),
    maxConcurrentTasks: zod_1.z.number().optional().default(3),
    maxRetries: zod_1.z.number().optional().default(3),
    retryDelayMs: zod_1.z.number().optional().default(1000),
    retryBackoffFactor: zod_1.z.number().optional().default(2),
});
/**
 * Schema for AI model selection per workflow stage to optimize cost and performance for different task types
 * @example
 * ```typescript
 * const models: ModelsConfig = {
 *   planning: 'opus',      // Use powerful model for complex planning
 *   implementation: 'sonnet', // Balanced model for coding
 *   review: 'haiku'        // Fast model for code review
 * };
 * ```
 */
exports.ModelsConfigSchema = zod_1.z.object({
    planning: exports.AgentModelSchema.optional().default('opus'),
    implementation: exports.AgentModelSchema.optional().default('sonnet'),
    review: exports.AgentModelSchema.optional().default('haiku'),
});
/**
 * Schema for user interface behavior configuration including preview modes and automation settings
 * @example
 * ```typescript
 * const ui: UIConfig = {
 *   previewMode: true,
 *   previewConfidence: 0.7,
 *   autoExecuteHighConfidence: false,
 *   previewTimeout: 5000,
 *   diffPreview: true
 * };
 * ```
 */
exports.UIConfigSchema = zod_1.z.object({
    previewMode: zod_1.z.boolean().optional().default(true),
    previewConfidence: zod_1.z.number().min(0).max(1).optional().default(0.7),
    autoExecuteHighConfidence: zod_1.z.boolean().optional().default(false),
    previewTimeout: zod_1.z.number().min(1000).optional().default(5000),
    diffPreview: zod_1.z.boolean().optional().default(true),
});
// ============================================================================
// Linter Configuration
// ============================================================================
/**
 * ESLint-specific configuration options
 */
exports.ESLintConfigSchema = zod_1.z.object({
    /** Enable ESLint linting */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Path to ESLint configuration file (relative to project root) */
    configPath: zod_1.z.string().optional(),
    /** Array of file patterns to lint */
    include: zod_1.z.array(zod_1.z.string()).optional().default([
        'src/**/*.js',
        'src/**/*.jsx',
        'src/**/*.ts',
        'src/**/*.tsx',
        'lib/**/*.js',
        'lib/**/*.jsx',
        'lib/**/*.ts',
        'lib/**/*.tsx',
        '*.js',
        '*.jsx',
        '*.ts',
        '*.tsx'
    ]),
    /** Array of file patterns to exclude from linting */
    exclude: zod_1.z.array(zod_1.z.string()).optional().default([
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.d.ts'
    ]),
    /** Enable auto-fix for fixable issues */
    autoFix: zod_1.z.boolean().optional().default(false),
    /** Maximum number of warnings allowed before failing */
    maxWarnings: zod_1.z.number().optional().default(0),
    /** Custom ESLint CLI options */
    cliOptions: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Environment settings for ESLint */
    environments: zod_1.z.array(zod_1.z.enum([
        'browser',
        'node',
        'es6',
        'es2017',
        'es2018',
        'es2020',
        'es2021',
        'es2022',
        'worker',
        'serviceworker'
    ])).optional().default(['node', 'es2022']),
    /** Parser options for ESLint */
    parserOptions: zod_1.z.object({
        ecmaVersion: zod_1.z.union([
            zod_1.z.number(),
            zod_1.z.enum(['latest'])
        ]).optional().default('latest'),
        sourceType: zod_1.z.enum(['script', 'module']).optional().default('module'),
        ecmaFeatures: zod_1.z.object({
            jsx: zod_1.z.boolean().optional().default(false),
            globalReturn: zod_1.z.boolean().optional().default(false),
            impliedStrict: zod_1.z.boolean().optional().default(false)
        }).optional()
    }).optional(),
    /** Severity level for linting violations */
    severity: zod_1.z.enum(['error', 'warn', 'off']).optional().default('warn'),
});
/**
 * Prettier-specific configuration options
 */
exports.PrettierConfigSchema = zod_1.z.object({
    /** Enable Prettier formatting */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Path to Prettier configuration file (relative to project root) */
    configPath: zod_1.z.string().optional(),
    /** Array of file patterns to format */
    include: zod_1.z.array(zod_1.z.string()).optional().default([
        'src/**/*.js',
        'src/**/*.jsx',
        'src/**/*.ts',
        'src/**/*.tsx',
        'src/**/*.json',
        'src/**/*.md',
        'src/**/*.css',
        'src/**/*.scss',
        'src/**/*.less',
        'src/**/*.html',
        'lib/**/*.js',
        'lib/**/*.jsx',
        'lib/**/*.ts',
        'lib/**/*.tsx',
        '*.js',
        '*.jsx',
        '*.ts',
        '*.tsx',
        '*.json',
        '*.md'
    ]),
    /** Array of file patterns to exclude from formatting */
    exclude: zod_1.z.array(zod_1.z.string()).optional().default([
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml'
    ]),
    /** Enable auto-fix for formatting issues */
    autoFix: zod_1.z.boolean().optional().default(false),
    /** Prettier formatting options */
    options: zod_1.z.object({
        /** Print width for line wrapping */
        printWidth: zod_1.z.number().optional().default(80),
        /** Number of spaces per indentation level */
        tabWidth: zod_1.z.number().optional().default(2),
        /** Use tabs instead of spaces */
        useTabs: zod_1.z.boolean().optional().default(false),
        /** Add semicolons at the ends of statements */
        semi: zod_1.z.boolean().optional().default(true),
        /** Use single quotes instead of double quotes */
        singleQuote: zod_1.z.boolean().optional().default(true),
        /** Quote style for object properties */
        quoteProps: zod_1.z.enum(['as-needed', 'consistent', 'preserve']).optional().default('as-needed'),
        /** Use single quotes in JSX */
        jsxSingleQuote: zod_1.z.boolean().optional().default(true),
        /** Trailing commas */
        trailingComma: zod_1.z.enum(['all', 'es5', 'none']).optional().default('es5'),
        /** Spaces between brackets in object literals */
        bracketSpacing: zod_1.z.boolean().optional().default(true),
        /** Put > on the last line instead of at a new line */
        bracketSameLine: zod_1.z.boolean().optional().default(false),
        /** Arrow function parentheses */
        arrowParens: zod_1.z.enum(['always', 'avoid']).optional().default('avoid'),
        /** Line ending style */
        endOfLine: zod_1.z.enum(['lf', 'crlf', 'cr', 'auto']).optional().default('lf'),
        /** Embedded language formatting */
        embeddedLanguageFormatting: zod_1.z.enum(['auto', 'off']).optional().default('auto')
    }).optional(),
    /** Severity level for formatting violations */
    severity: zod_1.z.enum(['error', 'warn', 'off']).optional().default('warn'),
});
/**
 * Custom linter configuration for non-standard tools
 */
exports.CustomLinterConfigSchema = zod_1.z.object({
    /** Unique name for the custom linter */
    name: zod_1.z.string(),
    /** Enable this custom linter */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Command to run the linter */
    command: zod_1.z.string(),
    /** Command-line arguments for the linter */
    args: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Array of file patterns to lint */
    include: zod_1.z.array(zod_1.z.string()).optional().default(['**/*']),
    /** Array of file patterns to exclude from linting */
    exclude: zod_1.z.array(zod_1.z.string()).optional().default(['node_modules/**']),
    /** Enable auto-fix for this linter (if supported) */
    autoFix: zod_1.z.boolean().optional().default(false),
    /** Working directory for the linter command */
    workingDirectory: zod_1.z.string().optional(),
    /** Environment variables for the linter */
    environment: zod_1.z.record(zod_1.z.string()).optional(),
    /** Expected exit codes for success */
    successExitCodes: zod_1.z.array(zod_1.z.number()).optional().default([0]),
    /** Timeout for linter execution in milliseconds */
    timeoutMs: zod_1.z.number().optional().default(30000),
    /** Severity level for linter violations */
    severity: zod_1.z.enum(['error', 'warn', 'off']).optional().default('warn'),
    /** Description of what this linter does */
    description: zod_1.z.string().optional(),
});
/**
 * Global linter configuration options
 */
exports.LinterGlobalConfigSchema = zod_1.z.object({
    /** Enable linting globally */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Run linters before commits */
    runOnCommit: zod_1.z.boolean().optional().default(true),
    /** Run linters before pushes */
    runOnPush: zod_1.z.boolean().optional().default(false),
    /** Run linters on file save (if supported by IDE) */
    runOnSave: zod_1.z.boolean().optional().default(false),
    /** Run linters after tool-driven edits */
    runAfterEdit: zod_1.z.boolean().optional().default(true),
    /** Enable parallel execution of linters */
    parallel: zod_1.z.boolean().optional().default(true),
    /** Maximum number of linters to run concurrently */
    maxConcurrency: zod_1.z.number().optional().default(4),
    /** Fail fast on first linter error */
    failFast: zod_1.z.boolean().optional().default(false),
    /** Cache linter results to improve performance */
    cache: zod_1.z.boolean().optional().default(true),
    /** Cache directory (relative to project root) */
    cacheDirectory: zod_1.z.string().optional().default('.apex/cache/linters'),
    /** Default working directory for all linters */
    workingDirectory: zod_1.z.string().optional(),
    /** Global timeout for all linters in milliseconds */
    timeoutMs: zod_1.z.number().optional().default(60000),
});
/**
 * Complete linter configuration schema supporting ESLint, Prettier, and custom linters
 */
exports.LinterConfigSchema = zod_1.z.object({
    /** Global linter settings */
    global: exports.LinterGlobalConfigSchema.optional(),
    /** ESLint configuration */
    eslint: exports.ESLintConfigSchema.optional(),
    /** Prettier configuration */
    prettier: exports.PrettierConfigSchema.optional(),
    /** Custom linter configurations */
    custom: zod_1.z.array(exports.CustomLinterConfigSchema).optional().default([]),
    /** Linter execution order (names of linters) */
    order: zod_1.z.array(zod_1.z.string()).optional().default(['eslint', 'prettier']),
    /** Integration settings */
    integrations: zod_1.z.object({
        /** Pre-commit hook integration */
        preCommit: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            linters: zod_1.z.array(zod_1.z.string()).optional().default(['eslint', 'prettier']),
            autoFix: zod_1.z.boolean().optional().default(true),
            failOnError: zod_1.z.boolean().optional().default(true),
        }).optional(),
        /** CI/CD integration */
        ci: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            linters: zod_1.z.array(zod_1.z.string()).optional().default(['eslint', 'prettier']),
            autoFix: zod_1.z.boolean().optional().default(false),
            failOnError: zod_1.z.boolean().optional().default(true),
            uploadReports: zod_1.z.boolean().optional().default(false),
            reportFormat: zod_1.z.enum(['json', 'xml', 'sarif']).optional().default('json'),
        }).optional(),
        /** IDE integration */
        ide: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(true),
            autoFixOnSave: zod_1.z.boolean().optional().default(false),
            showInlineErrors: zod_1.z.boolean().optional().default(true),
            formatOnSave: zod_1.z.boolean().optional().default(false),
        }).optional(),
    }).optional(),
});
// ============================================================================
// Code Quality Configuration (v0.5.0)
// ============================================================================
exports.PreEditValidationModeSchema = zod_1.z.enum(['warn', 'block']);
exports.PreEditValidationConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional().default(false),
    mode: exports.PreEditValidationModeSchema.optional().default('warn'),
});
exports.TypecheckConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional().default(false),
    runAfterEdit: zod_1.z.boolean().optional().default(false),
    command: zod_1.z.string().optional(),
    timeoutMs: zod_1.z.number().optional().default(60000),
    failOnError: zod_1.z.boolean().optional().default(false),
});
/**
 * Auto-fix configuration for stage completion hooks
 */
exports.AutoFixStageConfigSchema = zod_1.z.object({
    /** Enable auto-fix after code generation stages */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Stage names that should trigger auto-fix (in addition to agent-based detection) */
    triggerStages: zod_1.z.array(zod_1.z.string()).optional().default(['implementation', 'testing', 'development', 'coding']),
    /** Agent names that should trigger auto-fix */
    triggerAgents: zod_1.z.array(zod_1.z.string()).optional().default(['developer', 'tester']),
    /** File extensions to process (others will be skipped) */
    fileExtensions: zod_1.z.array(zod_1.z.string()).optional().default(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rs']),
    /** Maximum number of files to process in one stage */
    maxFilesPerStage: zod_1.z.number().optional().default(50),
    /** Skip auto-fix if stage failed */
    skipOnStageFailure: zod_1.z.boolean().optional().default(true),
});
exports.CodeQualityConfigSchema = zod_1.z.object({
    preEditValidation: exports.PreEditValidationConfigSchema.optional(),
    typecheck: exports.TypecheckConfigSchema.optional(),
    /** Auto-fix configuration for stage completion (v0.5.0) */
    autoFix: exports.AutoFixStageConfigSchema.optional(),
});
// ============================================================================
// Secret Scanner Configuration
// ============================================================================
/**
 * Secret pattern definition for the scanner
 */
exports.SecretPatternSchema = zod_1.z.object({
    /** Human-readable name for the pattern */
    name: zod_1.z.string(),
    /** Regular expression pattern to match */
    pattern: zod_1.z.string(),
    /** Severity level of the finding */
    severity: zod_1.z.enum(['critical', 'high', 'medium', 'low']).optional().default('medium'),
    /** Description of what this pattern detects */
    description: zod_1.z.string().optional(),
});
/**
 * Behavior when secrets are detected in tool outputs.
 *
 * @remarks
 * Available behaviors:
 * - `'log'` - Log the finding without any user-visible warning
 * - `'warn'` - Display a warning to the user (default behavior)
 * - `'mask'` - Replace the detected secret with asterisks in output
 * - `'block'` - Block the operation and prevent output containing secrets
 *
 * @example
 * ```yaml
 * scanner:
 *   onSecretDetected: warn  # Default - shows warning but continues
 * ```
 */
exports.SecretDetectionBehaviorSchema = zod_1.z.enum(['log', 'warn', 'mask', 'block']);
/**
 * Configuration options for the SecretScanner.
 *
 * The SecretScanner detects sensitive information like API keys, passwords,
 * tokens, and other secrets in tool outputs. It can be configured to warn,
 * mask, or block operations when secrets are detected.
 *
 * @remarks
 * The scanner includes built-in patterns for common secret formats:
 * - AWS access keys and secret keys
 * - GitHub tokens
 * - Generic API keys
 * - Private keys (RSA, DSA, EC)
 * - Connection strings
 *
 * @example
 * ```yaml
 * # .apex/config.yaml
 * scanner:
 *   onSecretDetected: warn        # 'log' | 'warn' | 'mask' | 'block'
 *   maskSecrets: true             # Mask secrets in output
 *   includeBuiltInPatterns: true  # Use built-in detection patterns
 *   customPatterns:
 *     - name: "Internal API Key"
 *       pattern: "INTERNAL_[A-Z0-9]{32}"
 *       severity: high
 * ```
 */
exports.SecretScannerConfigSchema = zod_1.z.object({
    /**
     * Custom patterns to scan for in addition to built-in patterns.
     * Each pattern should have a name, regex pattern, and optional severity.
     */
    customPatterns: zod_1.z.array(exports.SecretPatternSchema).optional().default([]),
    /**
     * Whether to include built-in patterns for common secrets (default: true).
     * Set to false to only use custom patterns.
     */
    includeBuiltInPatterns: zod_1.z.boolean().optional().default(true),
    /**
     * Maximum line length to scan (default: 10000).
     * Lines longer than this are truncated to prevent performance issues.
     */
    maxLineLength: zod_1.z.number().optional().default(10000),
    /**
     * Whether to mask sensitive content in findings (default: true).
     * When true, detected secrets are replaced with asterisks in logs.
     */
    maskSecrets: zod_1.z.boolean().optional().default(true),
    /**
     * Number of characters to show before/after match for context (default: 20).
     * Helps identify the location of secrets without revealing full content.
     */
    contextLength: zod_1.z.number().optional().default(20),
    /**
     * Behavior when secrets are detected in tool outputs (default: 'warn').
     * - 'log': Silent logging only
     * - 'warn': Display warning to user (recommended default)
     * - 'mask': Replace secrets with asterisks in output
     * - 'block': Prevent operation from completing
     */
    onSecretDetected: exports.SecretDetectionBehaviorSchema.optional().default('warn'),
});
/**
 * Enforcement mode for secret scanning.
 *
 * @remarks
 * Available modes:
 * - `'warn'` - Log warnings when secrets are detected but allow operations to proceed
 * - `'block'` - Block operations when secrets are detected
 * - `'audit'` - Log detections for auditing purposes without blocking or warning
 *
 * @example
 * ```yaml
 * secretScanning:
 *   enforcementMode: warn  # Default - warns but doesn't block
 * ```
 */
exports.SecretScanningEnforcementModeSchema = zod_1.z.enum(['warn', 'block', 'audit']);
/**
 * Configuration for secret scanning in APEX.
 *
 * This configuration block provides a simplified interface for configuring
 * secret detection with enforcement mode control. It is designed to be
 * easy to configure in `.apex/config.yaml`.
 *
 * @remarks
 * The `secretScanning` config provides:
 * - An `enabled` flag to turn secret scanning on/off
 * - An `enforcementMode` to control behavior when secrets are detected
 * - A `customPatterns` array for defining project-specific secret patterns
 *
 * This is separate from the legacy `scanner` config and the comprehensive
 * `guardrails.secrets` config, providing a streamlined option for projects
 * that only need secret detection.
 *
 * @example
 * ```yaml
 * # .apex/config.yaml
 * secretScanning:
 *   enabled: true
 *   enforcementMode: warn    # 'warn' | 'block' | 'audit'
 *   customPatterns:
 *     - name: "Internal API Key"
 *       pattern: "INTERNAL_[A-Z0-9]{32}"
 *       severity: high
 *     - name: "Database Password"
 *       pattern: "DB_PASSWORD=[^\\s]+"
 *       severity: critical
 * ```
 */
exports.SecretScanningConfigSchema = zod_1.z.object({
    /**
     * Whether secret scanning is enabled (default: true).
     * When disabled, no secret detection will be performed.
     */
    enabled: zod_1.z.boolean().optional().default(true),
    /**
     * Enforcement mode for secret scanning (default: 'warn').
     * - 'warn': Log warnings when secrets are detected
     * - 'block': Block operations when secrets are detected
     * - 'audit': Log detections for auditing without blocking
     */
    enforcementMode: exports.SecretScanningEnforcementModeSchema.optional().default('warn'),
    /**
     * Custom patterns to scan for in addition to built-in patterns.
     * Each pattern should have a name, regex pattern, and optional severity.
     *
     * @example
     * ```yaml
     * customPatterns:
     *   - name: "Internal Token"
     *     pattern: "INT_TOKEN_[A-Z0-9]{24}"
     *     severity: high
     *     description: "Internal service token"
     * ```
     */
    customPatterns: zod_1.z.array(exports.SecretPatternSchema).optional().default([]),
    /**
     * Whether to include built-in patterns for common secrets (default: true).
     * Built-in patterns detect AWS keys, GitHub tokens, API keys, etc.
     * Set to false to only use custom patterns.
     */
    includeBuiltInPatterns: zod_1.z.boolean().optional().default(true),
    /**
     * Paths to exclude from secret scanning.
     * Glob patterns are supported.
     *
     * @example
     * ```yaml
     * excludePaths:
     *   - "*.test.ts"
     *   - "fixtures/**"
     *   - "__mocks__/**"
     * ```
     */
    excludePaths: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
exports.ServiceConfigSchema = zod_1.z.object({
    enableOnBoot: zod_1.z.boolean().optional().default(false),
});
// ============================================================================
// Idle Task Strategy Configuration
// ============================================================================
exports.IdleTaskTypeSchema = zod_1.z.enum([
    'maintenance',
    'refactoring',
    'docs',
    'tests',
]);
exports.StrategyWeightsSchema = zod_1.z.object({
    maintenance: zod_1.z.number().min(0).max(1).optional().default(0.25),
    refactoring: zod_1.z.number().min(0).max(1).optional().default(0.25),
    docs: zod_1.z.number().min(0).max(1).optional().default(0.25),
    tests: zod_1.z.number().min(0).max(1).optional().default(0.25),
});
exports.DaemonConfigSchema = zod_1.z.object({
    pollInterval: zod_1.z.number().optional().default(5000),
    autoStart: zod_1.z.boolean().optional().default(false),
    logLevel: zod_1.z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
    // v0.4.0 enhancements
    installAsService: zod_1.z.boolean().optional().default(false),
    serviceName: zod_1.z.string().optional().default('apex-daemon'),
    service: exports.ServiceConfigSchema.optional(),
    healthCheck: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        interval: zod_1.z.number().optional().default(30000), // 30 seconds
        timeout: zod_1.z.number().optional().default(5000), // 5 seconds
        retries: zod_1.z.number().optional().default(3),
    }).optional(),
    watchdog: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        restartDelay: zod_1.z.number().optional().default(5000), // 5 seconds
        maxRestarts: zod_1.z.number().optional().default(5),
        restartWindow: zod_1.z.number().optional().default(300000), // 5 minutes
    }).optional(),
    // Time-based usage management
    timeBasedUsage: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(false),
        dayModeHours: zod_1.z.array(zod_1.z.number().min(0).max(23)).optional().default([9, 10, 11, 12, 13, 14, 15, 16, 17]),
        nightModeHours: zod_1.z.array(zod_1.z.number().min(0).max(23)).optional().default([22, 23, 0, 1, 2, 3, 4, 5, 6]),
        dayModeCapacityThreshold: zod_1.z.number().min(0).max(1).optional().default(0.90),
        nightModeCapacityThreshold: zod_1.z.number().min(0).max(1).optional().default(0.96),
        dayModeThresholds: zod_1.z.object({
            maxTokensPerTask: zod_1.z.number().optional().default(100000),
            maxCostPerTask: zod_1.z.number().optional().default(5.0),
            maxConcurrentTasks: zod_1.z.number().optional().default(2),
        }).optional(),
        nightModeThresholds: zod_1.z.object({
            maxTokensPerTask: zod_1.z.number().optional().default(1000000),
            maxCostPerTask: zod_1.z.number().optional().default(20.0),
            maxConcurrentTasks: zod_1.z.number().optional().default(5),
        }).optional(),
    }).optional(),
    // Session recovery settings
    sessionRecovery: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        autoResume: zod_1.z.boolean().optional().default(true),
        checkpointInterval: zod_1.z.number().optional().default(60000), // 1 minute
        contextSummarizationThreshold: zod_1.z.number().optional().default(50), // messages
        maxResumeAttempts: zod_1.z.number().optional().default(3), // Maximum number of resume attempts before giving up
        contextWindowThreshold: zod_1.z.number().min(0).max(1).optional().default(0.8), // Percentage (0-1) of context window before summarization
    }).optional(),
    // Idle processing
    idleProcessing: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(false),
        idleThreshold: zod_1.z.number().optional().default(300000), // 5 minutes
        taskGenerationInterval: zod_1.z.number().optional().default(3600000), // 1 hour
        maxIdleTasks: zod_1.z.number().optional().default(3),
        strategyWeights: exports.StrategyWeightsSchema.optional(),
    }).optional(),
    // Orphan detection - detect and recover stuck in-progress tasks
    orphanDetection: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        stalenessThreshold: zod_1.z.number().optional().default(3600000), // 1 hour
        recoveryPolicy: zod_1.z.enum(['pending', 'fail', 'retry']).optional().default('pending'),
        periodicCheck: zod_1.z.boolean().optional().default(false),
        periodicCheckInterval: zod_1.z.number().optional().default(300000), // 5 minutes
    }).optional(),
    // Integrated services - API and Web UI
    services: zod_1.z.object({
        api: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(false),
            port: zod_1.z.number().optional().default(4000),
            host: zod_1.z.string().optional().default('localhost'),
        }).optional(),
        webui: zod_1.z.object({
            enabled: zod_1.z.boolean().optional().default(false),
            port: zod_1.z.number().optional().default(3000),
            host: zod_1.z.string().optional().default('localhost'),
        }).optional(),
    }).optional(),
    // Task restart behavior
    taskRestart: zod_1.z.object({
        // Only restart root parent tasks, let orchestrator manage children
        restartParentOnly: zod_1.z.boolean().optional().default(true),
    }).optional(),
});
// ============================================================================
// Logging Configuration (v0.6.0)
// ============================================================================
/**
 * Log level schema
 */
exports.LogLevelSchema = zod_1.z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
/**
 * Log rotation configuration for file-based logging
 */
exports.LogRotationConfigSchema = zod_1.z.object({
    /** Maximum file size before rotation (e.g., '10M', '100K', '1G') */
    maxSize: zod_1.z.string().regex(/^\d+[KMG]?$/i).optional().default('10M'),
    /** Number of rotated files to keep */
    maxFiles: zod_1.z.number().int().min(1).max(100).optional().default(5),
    /** Compress rotated files with gzip */
    compress: zod_1.z.boolean().optional().default(false),
});
/**
 * Logging configuration for APEX
 *
 * Controls logging behavior across all packages including:
 * - Log levels (global and per-package)
 * - Output format (JSON vs pretty-printed)
 * - File logging with rotation
 * - Sensitive field redaction
 *
 * @example
 * ```yaml
 * logging:
 *   level: info
 *   format: auto
 *   packageLevels:
 *     orchestrator: debug
 *   file:
 *     enabled: true
 *     path: .apex/apex.log
 *     rotation:
 *       maxSize: 10M
 *       maxFiles: 5
 * ```
 */
exports.LoggingConfigSchema = zod_1.z.object({
    /** Default log level for all packages */
    level: exports.LogLevelSchema.optional().default('info'),
    /** Output format: 'json' for production, 'pretty' for development, 'auto' to detect */
    format: zod_1.z.enum(['json', 'pretty', 'auto']).optional().default('auto'),
    /** Per-package log level overrides (e.g., { orchestrator: 'debug', api: 'warn' }) */
    packageLevels: zod_1.z.record(zod_1.z.string(), exports.LogLevelSchema).optional().default({}),
    /** File logging configuration */
    file: zod_1.z.object({
        /** Enable file logging */
        enabled: zod_1.z.boolean().optional().default(false),
        /** Log file path (relative to project root) */
        path: zod_1.z.string().optional().default('.apex/apex.log'),
        /** Rotation configuration */
        rotation: exports.LogRotationConfigSchema.optional(),
    }).optional(),
    /** Daemon-specific logging configuration */
    daemon: zod_1.z.object({
        /** Daemon log file path */
        path: zod_1.z.string().optional().default('.apex/daemon.log'),
        /** Rotation configuration for daemon logs */
        rotation: exports.LogRotationConfigSchema.optional(),
    }).optional(),
    /** Include timestamps in console output */
    timestamps: zod_1.z.boolean().optional().default(true),
    /** Include stack traces for errors */
    stackTraces: zod_1.z.boolean().optional().default(true),
    /** Fields to redact from logs (prevents leaking secrets) */
    redactFields: zod_1.z.array(zod_1.z.string()).optional().default([
        'password',
        'token',
        'secret',
        'apiKey',
        'authorization',
        'ANTHROPIC_API_KEY',
    ]),
});
// ============================================================================
// Doctor Health Check Types (v0.6.0)
// ============================================================================
/**
 * Severity levels for health check results
 * Used to indicate the impact of check failures
 * @example
 * ```typescript
 * const severity: CheckSeverity = 'error';
 * const validSeverity = CheckSeveritySchema.parse('warning');
 * ```
 */
exports.CheckSeveritySchema = zod_1.z.enum(['error', 'warning', 'info']);
/**
 * Result status for individual health checks
 * @example
 * ```typescript
 * const status: CheckStatus = 'pass';
 * const validStatus = CheckStatusSchema.parse('fail');
 * ```
 */
exports.CheckStatusSchema = zod_1.z.enum(['pass', 'fail', 'skip', 'unknown']);
/**
 * Information about a development toolchain tool
 * Captures version, location, and metadata for tools like node, npm, git
 * @example
 * ```typescript
 * const toolcheck: ToolchainCheck = {
 *   name: 'node',
 *   currentVersion: '18.17.0',
 *   requiredVersion: '16.0.0',
 *   required: true,
 *   path: '/usr/bin/node',
 *   metadata: { arch: 'x64' }
 * };
 * ```
 */
exports.ToolchainCheckSchema = zod_1.z.object({
    /** Name of the tool being checked (e.g., 'node', 'npm', 'git') */
    name: zod_1.z.string(),
    /** Current installed version, or null if not installed */
    currentVersion: zod_1.z.string().nullable(),
    /** Minimum required version */
    requiredVersion: zod_1.z.string().optional(),
    /** Whether this tool is required or optional */
    required: zod_1.z.boolean(),
    /** Path to the tool binary */
    path: zod_1.z.string().optional(),
    /** Additional metadata about the tool */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Result of a single diagnostic check performed by the doctor command
 * Contains all information needed to understand and act on the check result
 * @example
 * ```typescript
 * const checkResult: DoctorCheckResult = {
 *   id: 'node-version',
 *   name: 'Node.js Version Check',
 *   description: 'Verify Node.js meets minimum version requirements',
 *   category: 'toolchain',
 *   status: 'pass',
 *   severity: 'error',
 *   message: 'Node.js 18.17.0 meets requirement >= 16.0.0',
 *   toolchain: { name: 'node', currentVersion: '18.17.0', required: true },
 *   timestamp: new Date(),
 *   durationMs: 150
 * };
 * ```
 */
exports.DoctorCheckResultSchema = zod_1.z.object({
    /** Unique identifier for this check */
    id: zod_1.z.string(),
    /** Human-readable name of the check */
    name: zod_1.z.string(),
    /** Detailed description of what this check validates */
    description: zod_1.z.string(),
    /** Category of the check (e.g., 'toolchain', 'config', 'network') */
    category: zod_1.z.enum(['toolchain', 'config', 'network', 'permissions', 'environment']),
    /** Result status of the check */
    status: exports.CheckStatusSchema,
    /** Severity if the check failed */
    severity: exports.CheckSeveritySchema,
    /** Human-readable message explaining the result */
    message: zod_1.z.string(),
    /** Suggested fix if the check failed */
    suggestion: zod_1.z.string().optional(),
    /** Toolchain information if this is a toolchain check */
    toolchain: exports.ToolchainCheckSchema.optional(),
    /** Timestamp when the check was performed */
    timestamp: zod_1.z.date(),
    /** Duration of the check in milliseconds */
    durationMs: zod_1.z.number(),
    /** Additional details for debugging */
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Aggregated health report containing all check results and system information
 * Generated by the doctor command for comprehensive system diagnostics
 * @example
 * ```typescript
 * const report: HealthReport = {
 *   id: 'health-2024-01-15-123456',
 *   timestamp: new Date(),
 *   overallStatus: 'pass',
 *   summary: { total: 5, passed: 4, failed: 1, warnings: 0, skipped: 0 },
 *   checks: [checkResult1, checkResult2, ...],
 *   system: {
 *     platform: 'darwin',
 *     arch: 'arm64',
 *     nodeVersion: '18.17.0',
 *     cwd: '/Users/dev/project'
 *   },
 *   durationMs: 2500,
 *   apexVersion: '0.6.0'
 * };
 * ```
 */
exports.HealthReportSchema = zod_1.z.object({
    /** Unique identifier for this report */
    id: zod_1.z.string(),
    /** Timestamp when the report was generated */
    timestamp: zod_1.z.date(),
    /** Overall health status */
    overallStatus: exports.CheckStatusSchema,
    /** Summary counts */
    summary: zod_1.z.object({
        total: zod_1.z.number(),
        passed: zod_1.z.number(),
        failed: zod_1.z.number(),
        warnings: zod_1.z.number(),
        skipped: zod_1.z.number(),
    }),
    /** Individual check results */
    checks: zod_1.z.array(exports.DoctorCheckResultSchema),
    /** System information */
    system: zod_1.z.object({
        platform: zod_1.z.string(),
        arch: zod_1.z.string(),
        nodeVersion: zod_1.z.string(),
        cwd: zod_1.z.string(),
    }),
    /** Total duration of all checks in milliseconds */
    durationMs: zod_1.z.number(),
    /** APEX version that generated this report */
    apexVersion: zod_1.z.string(),
});
// ============================================================================
// MCP Configuration (v0.5.0)
// ============================================================================
/**
 * MCP Connection Configuration Schema (v0.5.0)
 * Configuration for MCP connection management including retry policies,
 * timeouts, connection pooling, and health check settings.
 *
 * Can be specified at the global level (mcp.connection) to apply to all servers,
 * or per-server (mcp.servers.<name>.connection) to override for specific servers.
 */
exports.MCPConnectionConfigSchema = zod_1.z.object({
    /**
     * Maximum number of retry attempts when a connection fails
     * Set to 0 for no retries
     * @default 3
     */
    maxRetries: zod_1.z.number().int().min(0).optional().default(3),
    /**
     * Initial delay between retry attempts in milliseconds
     * Subsequent retries may use exponential backoff based on backoffFactor
     * @default 1000
     */
    retryDelayMs: zod_1.z.number().int().min(0).optional().default(1000),
    /**
     * Backoff factor for exponential retry delay
     * Each retry delay = retryDelayMs * (backoffFactor ^ attemptNumber)
     * @default 2
     */
    backoffFactor: zod_1.z.number().min(1).optional().default(2),
    /**
     * Maximum retry delay in milliseconds (caps exponential backoff)
     * @default 30000
     */
    maxRetryDelayMs: zod_1.z.number().int().min(0).optional().default(30000),
    /**
     * Connection timeout in milliseconds
     * How long to wait for initial connection before timing out
     * @default 10000
     */
    connectionTimeoutMs: zod_1.z.number().int().min(0).optional().default(10000),
    /**
     * Request timeout in milliseconds
     * How long to wait for a response to an individual request
     * @default 30000
     */
    requestTimeoutMs: zod_1.z.number().int().min(0).optional().default(30000),
    /**
     * Idle timeout in milliseconds
     * How long a connection can be idle before being closed
     * Set to 0 for no idle timeout
     * @default 300000 (5 minutes)
     */
    idleTimeoutMs: zod_1.z.number().int().min(0).optional().default(300000),
    /**
     * Maximum number of concurrent connections to a single MCP server
     * Used for connection pooling
     * @default 1
     */
    poolSize: zod_1.z.number().int().min(1).max(100).optional().default(1),
    /**
     * Minimum number of connections to keep in the pool
     * These connections are kept alive even when idle
     * @default 0
     */
    poolMinSize: zod_1.z.number().int().min(0).optional().default(0),
    /**
     * Health check interval in milliseconds
     * How often to check if the connection is still alive
     * Set to 0 to disable health checks
     * @default 30000
     */
    healthCheckIntervalMs: zod_1.z.number().int().min(0).optional().default(30000),
    /**
     * Health check timeout in milliseconds
     * How long to wait for health check response before considering unhealthy
     * @default 5000
     */
    healthCheckTimeoutMs: zod_1.z.number().int().min(0).optional().default(5000),
    /**
     * Number of consecutive health check failures before marking connection unhealthy
     * @default 3
     */
    healthCheckFailureThreshold: zod_1.z.number().int().min(1).optional().default(3),
    /**
     * Whether to automatically reconnect when a connection is lost
     * @default true
     */
    autoReconnect: zod_1.z.boolean().optional().default(true),
    /**
     * Whether to enable keep-alive for the connection
     * @default true
     */
    keepAlive: zod_1.z.boolean().optional().default(true),
    /**
     * Keep-alive interval in milliseconds
     * How often to send keep-alive messages
     * @default 15000
     */
    keepAliveIntervalMs: zod_1.z.number().int().min(0).optional().default(15000),
    /**
     * Whether to enable heartbeat/ping-pong for health monitoring
     * When enabled, uses ping/pong instead of listTools() for health checks
     * @default true
     */
    heartbeatEnabled: zod_1.z.boolean().optional().default(true),
    /**
     * Heartbeat ping interval in milliseconds
     * How often to send ping messages for heartbeat health checks
     * Only used when heartbeatEnabled is true
     * @default 30000
     */
    heartbeatIntervalMs: zod_1.z.number().int().min(0).optional().default(30000),
});
/**
 * MCP Environment Variable Schema (v0.5.0)
 * Defines structured metadata for environment variables used by MCP servers.
 * Provides richer configuration than simple key-value pairs, including
 * descriptions, sensitivity flags, and required/optional status.
 *
 * @example
 * ```yaml
 * envVars:
 *   - name: OPENAI_API_KEY
 *     description: OpenAI API key for model access
 *     required: true
 *     sensitive: true
 *   - name: LOG_LEVEL
 *     description: Logging verbosity level
 *     required: false
 *     defaultValue: info
 * ```
 */
exports.MCPEnvironmentVarSchema = zod_1.z.object({
    /** Name of the environment variable (e.g., 'OPENAI_API_KEY') */
    name: zod_1.z.string().trim().min(1, 'Environment variable name is required'),
    /** Human-readable description of the variable's purpose */
    description: zod_1.z.string().optional(),
    /** Whether the variable is required for the server to function */
    required: zod_1.z.boolean().optional().default(false),
    /** Whether the variable contains sensitive data (API keys, passwords, tokens) */
    sensitive: zod_1.z.boolean().optional().default(false),
    /** Default value if not provided (ignored for required variables) */
    defaultValue: zod_1.z.string().optional(),
    /** Current value of the environment variable (may be masked if sensitive) */
    value: zod_1.z.string().optional(),
    /** Validation pattern for the variable value (regex string) */
    pattern: zod_1.z.string().optional(),
    /** Source of the variable value: 'config', 'env', 'user', 'default' */
    source: zod_1.z.enum(['config', 'env', 'user', 'default']).optional(),
});
/**
 * MCP Server configuration schema
 * Defines how to connect to and configure an individual MCP server
 */
exports.MCPServerConfigSchema = zod_1.z.object({
    /** Display name for the server */
    name: zod_1.z.string().trim().min(1),
    /** Connection type: stdio (subprocess), http, sse (server-sent events), or sdk (direct) */
    type: zod_1.z.enum(['stdio', 'http', 'sse', 'sdk']).optional().default('stdio'),
    /** Command to execute for stdio connections */
    command: zod_1.z.string().trim().min(1).optional(),
    /** Arguments to pass to the command */
    args: zod_1.z.array(zod_1.z.string()).optional(),
    /** Environment variables for the server process (simple key-value pairs) */
    env: zod_1.z.record(zod_1.z.string()).optional(),
    /** Structured environment variable definitions with metadata */
    envVars: zod_1.z.array(exports.MCPEnvironmentVarSchema).optional(),
    /** URL for http/sse connections */
    url: zod_1.z.string().trim().min(1).optional(),
    /** HTTP headers for http/sse connections */
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    /** Whether to start this server automatically when MCP is initialized */
    autoStart: zod_1.z.boolean().optional().default(false),
    /** List of capabilities this server provides */
    capabilities: zod_1.z.array(zod_1.z.string()).optional(),
    /** Per-server connection configuration (overrides global mcp.connection) */
    connection: exports.MCPConnectionConfigSchema.optional(),
});
/**
 * MCP Marketplace entry schema
 * Represents a server available for installation from a marketplace
 */
exports.MCPMarketplaceEntrySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().min(1),
    version: zod_1.z.string().min(1),
    author: zod_1.z.string().optional(),
    homepage: zod_1.z.string().optional(),
    repository: zod_1.z.string().optional(),
    installCommand: zod_1.z.string().optional(),
    serverConfig: exports.MCPServerConfigSchema,
    capabilities: zod_1.z.array(zod_1.z.string()).optional(),
    verified: zod_1.z.boolean().optional().default(false),
});
/**
 * MCP Marketplace source configuration
 * Configures where to discover available MCP servers
 */
exports.MCPMarketplaceSourceSchema = zod_1.z.object({
    url: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().optional().default(true),
    refreshIntervalMinutes: zod_1.z.number().min(1).optional().default(1440),
    allowUnverified: zod_1.z.boolean().optional().default(false),
});
/**
 * MCP Marketplace schema
 * Represents a complete marketplace containing multiple MCP server entries
 * and metadata about the marketplace itself
 */
exports.MCPMarketplaceSchema = zod_1.z.object({
    /** Marketplace metadata */
    name: zod_1.z.string().min(1, 'Marketplace name is required'),
    description: zod_1.z.string().optional(),
    version: zod_1.z.string().optional(),
    lastUpdated: zod_1.z.string().optional(),
    /** Array of available MCP server entries */
    servers: zod_1.z.array(exports.MCPMarketplaceEntrySchema),
    /** Marketplace source configuration */
    source: exports.MCPMarketplaceSourceSchema.optional(),
});
/**
 * MCP Tools Configuration Schema (v0.5.0)
 * Configuration for managing MCP tool discovery, caching, and access control.
 * Controls how tools from MCP servers are registered and made available to agents.
 */
exports.MCPToolsConfigSchema = zod_1.z.object({
    /** Whether to automatically discover tools from connected MCP servers */
    autoDiscovery: zod_1.z.boolean().optional().default(true),
    /** Whether to cache tool metadata for faster subsequent access */
    enableCaching: zod_1.z.boolean().optional().default(true),
    /** Cache TTL in seconds for tool metadata (default: 300 = 5 minutes) */
    cacheTtlSeconds: zod_1.z.number().min(0).optional().default(300),
    /** Maximum number of concurrent tool invocations across all MCP servers */
    maxConcurrentInvocations: zod_1.z.number().min(1).optional().default(10),
    /** Timeout in milliseconds for tool invocations (default: 30000 = 30 seconds) */
    invocationTimeoutMs: zod_1.z.number().min(1000).optional().default(30000),
    /** Whether to validate tool schemas before invocation */
    validateSchemas: zod_1.z.boolean().optional().default(true),
    /** Whitelist of tool names to allow (if specified, only these tools are accessible) */
    allowedTools: zod_1.z.array(zod_1.z.string()).optional(),
    /** Blacklist of tool names to deny (takes precedence over allowedTools) */
    deniedTools: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether to log tool invocations for debugging */
    enableLogging: zod_1.z.boolean().optional().default(false),
});
exports.MCPConfigSchema = zod_1.z.object({
    /** Whether MCP is enabled globally */
    enabled: zod_1.z.boolean().optional().default(true),
    /** MCP server configurations - supports both array and record formats */
    servers: zod_1.z.union([
        zod_1.z.record(exports.MCPServerConfigSchema),
        zod_1.z.array(exports.MCPServerConfigSchema)
    ]).optional().default({}),
    /** Marketplace source configuration for discovering MCP servers */
    marketplace: exports.MCPMarketplaceSourceSchema.optional(),
    /** Global connection configuration applied to all MCP servers unless overridden */
    connection: exports.MCPConnectionConfigSchema.optional(),
    /** Tools configuration for MCP tool management */
    tools: exports.MCPToolsConfigSchema.optional(),
});
/**
 * MCP Server Template schema
 * Represents a reusable template for configuring MCP servers.
 * Templates provide pre-configured defaults for common MCP servers,
 * including environment variable requirements and capability declarations.
 *
 * Used by the MCPConfigurator service to provide quick setup options
 * for popular MCP servers from the ecosystem.
 *
 * @example
 * ```yaml
 * templates:
 *   - id: filesystem
 *     name: Filesystem Server
 *     description: Read and write files, list directories
 *     package: '@modelcontextprotocol/server-filesystem'
 *     config:
 *       type: stdio
 *       command: npx
 *       args: ['-y', '@modelcontextprotocol/server-filesystem']
 *     capabilities: ['filesystem', 'read', 'write']
 *     verified: true
 *     defaultEnabled: true
 * ```
 */
exports.MCPTemplateSchema = zod_1.z.object({
    /** Unique identifier for the template (e.g., 'filesystem', 'github', 'postgres') */
    id: zod_1.z.string().trim().min(1, 'Template ID is required'),
    /** Human-readable display name for the template */
    name: zod_1.z.string().trim().min(1, 'Template name is required'),
    /** Description of what the MCP server does */
    description: zod_1.z.string().trim().min(1, 'Template description is required'),
    /** NPM package name for the MCP server (e.g., '@modelcontextprotocol/server-filesystem') */
    package: zod_1.z.string().trim().min(1, 'Package name is required'),
    /** Base server configuration with pre-filled defaults */
    config: exports.MCPServerConfigSchema.partial(),
    /** Environment variables required or used by this server template */
    envVars: zod_1.z.array(exports.MCPEnvironmentVarSchema).optional().default([]),
    /** Capabilities this server provides (e.g., ['filesystem', 'read', 'write']) */
    capabilities: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether this template is from a verified/official source */
    verified: zod_1.z.boolean().optional().default(false),
    /** Whether this server should be enabled by default when the template is applied */
    defaultEnabled: zod_1.z.boolean().optional().default(false),
    /** Optional category for grouping templates (e.g., 'database', 'api', 'filesystem') */
    category: zod_1.z.string().optional(),
    /** Optional tags for searchability */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Minimum required version of the MCP server package */
    minVersion: zod_1.z.string().optional(),
    /** Documentation URL for the MCP server */
    documentationUrl: zod_1.z.string().optional(),
    /** Repository URL for the MCP server source code */
    repositoryUrl: zod_1.z.string().optional(),
});
// Backwards compatibility alias for MCPServerTemplate
exports.MCPServerTemplateSchema = exports.MCPTemplateSchema;
/**
 * MCP Server definition schema
 * Represents an MCP server available for installation from a registry/marketplace
 * Contains package information and default configuration
 */
exports.MCPServerSchema = zod_1.z.object({
    /** Unique name identifier for the MCP server */
    name: zod_1.z.string().trim().min(1, 'MCP server name is required'),
    /** NPM package name or installation source */
    package: zod_1.z.string().trim().min(1, 'Package name is required'),
    /** Command to execute the MCP server (e.g., 'npx', 'node', path to binary) */
    command: zod_1.z.string().trim().min(1, 'Command is required'),
    /** Arguments to pass to the command */
    args: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Environment variables required by the server (simple key-value pairs) */
    env: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional().default({}),
    /** Structured environment variable definitions with metadata */
    envVars: zod_1.z.array(exports.MCPEnvironmentVarSchema).optional().default([]),
    /** Semantic version of the MCP server package */
    version: zod_1.z.string().trim().min(1, 'Version is required'),
});
/**
 * Installation status for MCP servers
 */
exports.MCPInstallationStatusSchema = zod_1.z.enum([
    'pending', // Installation has been requested but not started
    'installing', // Currently being installed
    'installed', // Successfully installed and ready
    'failed', // Installation failed
    'uninstalling', // Currently being uninstalled
    'uninstalled', // Has been uninstalled
]);
/**
 * MCP Installation schema
 * Represents an installed MCP server instance with tracking metadata
 */
exports.MCPInstallationSchema = zod_1.z.object({
    /** Unique identifier for this installation instance */
    id: zod_1.z.string().trim().min(1, 'Installation ID is required'),
    /** Reference to the MCPServer this installation is based on */
    serverId: zod_1.z.string().trim().min(1, 'Server ID is required'),
    /** Timestamp when the server was installed */
    installedAt: zod_1.z.date(),
    /** Current installation status */
    status: exports.MCPInstallationStatusSchema,
    /** Path to the installation's configuration file */
    configPath: zod_1.z.string().trim().min(1, 'Config path is required'),
});
/**
 * Installed MCP Server schema
 * Represents an MCP server that has been installed and configured,
 * combining server definition with installation configuration
 */
exports.InstalledMCPServerSchema = zod_1.z.object({
    /** Unique identifier for the installed server */
    id: zod_1.z.string().min(1, 'Server ID is required'),
    /** The base MCP server definition */
    server: exports.MCPServerSchema,
    /** Installation-specific configuration */
    config: exports.MCPServerConfigSchema,
    /** Current installation status */
    status: exports.MCPInstallationStatusSchema,
    /** When the server was installed */
    installedAt: zod_1.z.date(),
    /** When the server configuration was last updated */
    updatedAt: zod_1.z.date().optional(),
    /** Whether the server is currently enabled */
    enabled: zod_1.z.boolean().default(true),
    /** Installation metadata */
    installation: zod_1.z.object({
        /** Path where the server is installed */
        path: zod_1.z.string().optional(),
        /** Installation method used */
        method: zod_1.z.enum(['npm', 'yarn', 'pnpm', 'binary', 'docker']).optional(),
        /** Package version that was installed */
        installedVersion: zod_1.z.string().optional(),
    }).optional(),
});
// ============================================================================
// MCP Registry Types (v0.5.0)
// ============================================================================
/**
 * MCP Server Category Schema
 * Categories for organizing MCP servers in the registry/marketplace
 */
exports.MCPServerCategorySchema = zod_1.z.enum([
    'productivity', // Task management, notes, calendars
    'development', // Code tools, Git, CI/CD
    'communication', // Email, chat, notifications
    'data', // Databases, analytics, storage
    'ai', // AI/ML tools and integrations
    'automation', // Workflow automation, scripting
    'security', // Auth, encryption, scanning
    'monitoring', // Logging, metrics, alerting
    'integration', // Third-party API integrations
    'utility', // General-purpose utilities
    'other', // Uncategorized
]);
/**
 * MCP Registry Server Schema
 * Represents an MCP server as listed in a registry/marketplace
 * Contains metadata for discovery, installation, and categorization
 *
 * This differs from MCPServerSchema which represents runtime/execution configuration.
 * MCPRegistryServer is for marketplace listings; MCPServer is for running servers.
 */
exports.MCPRegistryServerSchema = zod_1.z.object({
    /** Unique identifier for the server in the registry */
    id: zod_1.z.string().min(1, 'Server ID is required'),
    /** Display name for the MCP server */
    name: zod_1.z.string().min(1, 'Server name is required'),
    /** Detailed description of the server's functionality */
    description: zod_1.z.string().min(1, 'Description is required'),
    /** Semantic version of the server */
    version: zod_1.z.string().min(1, 'Version is required'),
    /** Author or maintainer of the server */
    author: zod_1.z.string().optional(),
    /** URL to the source code repository (GitHub, GitLab, etc.) */
    repository: zod_1.z.string().url().optional(),
    /** List of tools provided by this MCP server */
    tools: zod_1.z.array(zod_1.z.string()).default([]),
    /** Categories for organizing and filtering servers */
    categories: zod_1.z.array(exports.MCPServerCategorySchema).default([]),
    /** Number of times this server has been installed */
    installCount: zod_1.z.number().int().min(0).default(0),
    /** Whether this server is verified/official */
    verified: zod_1.z.boolean().default(false),
    /** Optional homepage URL */
    homepage: zod_1.z.string().url().optional(),
    /** Optional license identifier (e.g., 'MIT', 'Apache-2.0') */
    license: zod_1.z.string().optional(),
    /** Optional keywords for search */
    keywords: zod_1.z.array(zod_1.z.string()).optional(),
    /** When the server was first published to the registry */
    publishedAt: zod_1.z.date().optional(),
    /** When the server was last updated in the registry */
    updatedAt: zod_1.z.date().optional(),
});
/**
 * MCP Registry Installation Config Schema
 * Configuration specific to an installed MCP server instance
 */
exports.MCPRegistryInstallConfigSchema = zod_1.z.object({
    /** Environment variables configured for this installation */
    env: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Custom arguments passed to the server */
    args: zod_1.z.array(zod_1.z.string()).optional(),
    /** Path to configuration file */
    configPath: zod_1.z.string().optional(),
    /** Whether the server should auto-start */
    autoStart: zod_1.z.boolean().optional().default(true),
    /** Custom name for this installation (allows multiple instances) */
    instanceName: zod_1.z.string().optional(),
});
/**
 * MCP Registry Installation Schema
 * Represents an installed MCP server from the registry
 * Tracks installation metadata and configuration
 */
exports.MCPRegistryInstallationSchema = zod_1.z.object({
    /** Reference to the MCPRegistryServer ID this installation is based on */
    serverId: zod_1.z.string().min(1, 'Server ID is required'),
    /** Timestamp when the server was installed */
    installedAt: zod_1.z.date(),
    /** Installation-specific configuration */
    config: exports.MCPRegistryInstallConfigSchema,
    /** Current installation status */
    status: exports.MCPInstallationStatusSchema,
    /** Unique installation instance ID (for multiple installations of same server) */
    installationId: zod_1.z.string().optional(),
    /** Version that was installed */
    installedVersion: zod_1.z.string().optional(),
    /** When the installation was last updated */
    updatedAt: zod_1.z.date().optional(),
    /** Error message if status is 'failed' */
    error: zod_1.z.string().optional(),
});
/**
 * MCP Install Progress Stage Schema
 * Represents the various stages during MCP server installation
 */
exports.MCPInstallStageSchema = zod_1.z.enum([
    'initializing', // Setting up installation environment
    'downloading', // Downloading package/binary
    'extracting', // Extracting downloaded files
    'installing', // Running installation commands
    'configuring', // Setting up configuration
    'verifying', // Verifying installation
    'completing', // Finalizing installation
    'completed', // Installation finished successfully
    'failed', // Installation failed
]);
/**
 * MCP Install Progress Schema
 * Tracks the progress of an MCP server installation
 * Used for real-time progress updates during installation
 */
exports.MCPInstallProgressSchema = zod_1.z.object({
    /** Reference to the server being installed */
    serverId: zod_1.z.string().min(1, 'Server ID is required'),
    /** Current installation stage */
    stage: exports.MCPInstallStageSchema,
    /** Progress percentage (0-100) */
    progress: zod_1.z.number().min(0).max(100),
    /** Human-readable status message */
    message: zod_1.z.string(),
    /** Timestamp of this progress update */
    timestamp: zod_1.z.date().optional(),
    /** Detailed log messages for this stage */
    logs: zod_1.z.array(zod_1.z.string()).optional(),
    /** Error details if stage is 'failed' */
    error: zod_1.z.object({
        code: zod_1.z.string().optional(),
        message: zod_1.z.string(),
        stack: zod_1.z.string().optional(),
    }).optional(),
    /** Estimated time remaining in seconds */
    estimatedTimeRemaining: zod_1.z.number().min(0).optional(),
    /** Bytes downloaded (for download stage) */
    bytesDownloaded: zod_1.z.number().min(0).optional(),
    /** Total bytes to download (for download stage) */
    totalBytes: zod_1.z.number().min(0).optional(),
});
// ============================================================================
// MCP Connection Management Types (v0.5.0)
// ============================================================================
/**
 * Connection state for an MCP server
 */
exports.MCPConnectionStateSchema = zod_1.z.enum([
    'disconnected', // Not connected
    'connecting', // Connection in progress
    'connected', // Connected and ready
    'reconnecting', // Attempting reconnection
    'error', // Error state
]);
/**
 * MCP Connection Info Schema
 * Represents runtime information about an active MCP connection,
 * including health status, performance metrics, and connection state.
 *
 * This is aliased as both MCPConnectionInfo and MCPConnection for backwards compatibility.
 */
exports.MCPConnectionInfoSchema = zod_1.z.object({
    /** Server identifier (config key name) */
    serverId: zod_1.z.string().trim().min(1),
    /** Server name from config */
    serverName: zod_1.z.string().trim().min(1),
    /** Server configuration */
    config: exports.MCPServerConfigSchema,
    /** Current connection state */
    state: exports.MCPConnectionStateSchema,
    /** When the connection was established */
    connectedAt: zod_1.z.date().optional(),
    /** When the connection was last active */
    lastActivityAt: zod_1.z.date().optional(),
    /** Number of reconnection attempts */
    reconnectAttempts: zod_1.z.number().int().min(0).default(0),
    /** Last error if in error state */
    lastError: zod_1.z.string().optional(),
    /** Health check status */
    health: zod_1.z.object({
        /** Whether the connection is considered healthy */
        healthy: zod_1.z.boolean().default(true),
        /** Timestamp of the last successful health check */
        lastCheckAt: zod_1.z.date().optional(),
        /** Timestamp of the last successful health check */
        lastSuccessAt: zod_1.z.date().optional(),
        /** Number of consecutive health check failures */
        consecutiveFailures: zod_1.z.number().int().min(0).default(0),
        /** Last health check latency in milliseconds */
        latencyMs: zod_1.z.number().int().min(0).optional(),
        /** Average latency over recent health checks */
        avgLatencyMs: zod_1.z.number().min(0).optional(),
        /** Health check error message if unhealthy */
        errorMessage: zod_1.z.string().optional(),
    }).optional(),
    /** Connection pool status (if pooling is enabled) */
    pool: zod_1.z.object({
        /** Current number of active connections in the pool */
        activeConnections: zod_1.z.number().int().min(0).default(0),
        /** Number of idle connections in the pool */
        idleConnections: zod_1.z.number().int().min(0).default(0),
        /** Total number of connections created */
        totalConnections: zod_1.z.number().int().min(0).default(0),
        /** Number of pending connection requests */
        pendingRequests: zod_1.z.number().int().min(0).default(0),
    }).optional(),
    /** Connection metrics */
    metrics: zod_1.z.object({
        /** Total number of requests made through this connection */
        totalRequests: zod_1.z.number().int().min(0).default(0),
        /** Number of successful requests */
        successfulRequests: zod_1.z.number().int().min(0).default(0),
        /** Number of failed requests */
        failedRequests: zod_1.z.number().int().min(0).default(0),
        /** Total bytes sent */
        bytesSent: zod_1.z.number().int().min(0).default(0),
        /** Total bytes received */
        bytesReceived: zod_1.z.number().int().min(0).default(0),
        /** Connection uptime in milliseconds */
        uptimeMs: zod_1.z.number().int().min(0).default(0),
    }).optional(),
});
// Backwards compatibility aliases
exports.MCPConnectionSchema = exports.MCPConnectionInfoSchema;
/**
 * Connection event types
 */
exports.MCPConnectionEventTypeSchema = zod_1.z.enum([
    'connected',
    'disconnected',
    'error',
    'reconnecting',
]);
/**
 * Connection event data
 */
exports.MCPConnectionEventSchema = zod_1.z.object({
    type: exports.MCPConnectionEventTypeSchema,
    serverId: zod_1.z.string().trim().min(1),
    serverName: zod_1.z.string().trim().min(1),
    previousState: exports.MCPConnectionStateSchema,
    newState: exports.MCPConnectionStateSchema,
    timestamp: zod_1.z.date(),
    message: zod_1.z.string().optional(),
    error: zod_1.z.any().optional(), // Error objects can't be easily validated with Zod
});
// ============================================================================
// MCP Tool Types (v0.5.0)
// ============================================================================
/**
 * JSON Schema for MCP tool parameters
 * Follows the JSON Schema Draft 7 specification as used by MCP protocol.
 * Provides a complete schema definition for tool input validation.
 */
exports.MCPToolSchemaSchema = zod_1.z.object({
    /** JSON Schema type (typically 'object' for tool parameters) */
    type: zod_1.z.literal('object').default('object'),
    /** Human-readable title for the schema */
    title: zod_1.z.string().optional(),
    /** Description of what the parameters represent */
    description: zod_1.z.string().optional(),
    /** Object properties defining each parameter */
    properties: zod_1.z
        .record(zod_1.z.string(), zod_1.z.object({
        type: exports.JSONSchemaTypeSchema,
        description: zod_1.z.string().optional(),
        default: zod_1.z.unknown().optional(),
        enum: zod_1.z.array(zod_1.z.unknown()).optional(),
        const: zod_1.z.unknown().optional(),
        properties: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
        items: zod_1.z.unknown().optional(),
        minimum: zod_1.z.number().optional(),
        maximum: zod_1.z.number().optional(),
        minLength: zod_1.z.number().optional(),
        maxLength: zod_1.z.number().optional(),
        minItems: zod_1.z.number().optional(),
        maxItems: zod_1.z.number().optional(),
        pattern: zod_1.z.string().optional(),
        format: zod_1.z.string().optional(),
        oneOf: zod_1.z.array(zod_1.z.unknown()).optional(),
        anyOf: zod_1.z.array(zod_1.z.unknown()).optional(),
        allOf: zod_1.z.array(zod_1.z.unknown()).optional(),
    }))
        .optional()
        .default({}),
    /** Array of required property names */
    required: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether additional properties are allowed */
    additionalProperties: zod_1.z.boolean().optional().default(false),
    /** JSON Schema version identifier */
    $schema: zod_1.z.string().optional(),
});
/**
 * Tool capability flags indicating what operations a tool supports
 */
exports.MCPToolCapabilitiesSchema = zod_1.z.object({
    /** Whether the tool supports streaming responses */
    streaming: zod_1.z.boolean().optional().default(false),
    /** Whether the tool can be cancelled mid-execution */
    cancellable: zod_1.z.boolean().optional().default(false),
    /** Whether the tool supports progress reporting */
    progressReporting: zod_1.z.boolean().optional().default(false),
    /** Whether the tool is idempotent (safe to retry) */
    idempotent: zod_1.z.boolean().optional().default(false),
    /** Whether the tool has side effects */
    hasSideEffects: zod_1.z.boolean().optional().default(true),
});
/**
 * MCP Tool definition schema
 * Represents a tool exposed by an MCP server with full metadata.
 * This is the canonical representation of tools discovered from MCP servers.
 */
exports.MCPToolSchema = zod_1.z.object({
    /** Unique tool name within the MCP server namespace */
    name: zod_1.z.string().min(1, 'Tool name is required'),
    /** Human-readable description of what the tool does */
    description: zod_1.z.string().optional(),
    /** JSON Schema for the tool's input parameters */
    inputSchema: exports.MCPToolSchemaSchema,
    /** JSON Schema for the tool's output (optional, for documentation) */
    outputSchema: exports.MCPToolSchemaSchema.optional(),
    /** ID of the MCP server providing this tool */
    serverId: zod_1.z.string().min(1, 'Server ID is required'),
    /** Display name of the MCP server */
    serverName: zod_1.z.string().optional(),
    /** Tool capabilities and features */
    capabilities: exports.MCPToolCapabilitiesSchema.optional(),
    /** Whether the tool is currently available */
    available: zod_1.z.boolean().default(true),
    /** Reason if the tool is unavailable */
    unavailableReason: zod_1.z.string().optional(),
    /** Tool version (if provided by MCP server) */
    version: zod_1.z.string().optional(),
    /** Tags for categorization and filtering */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Deprecation notice if tool is deprecated */
    deprecated: zod_1.z.string().optional(),
    /** When this tool definition was last updated */
    updatedAt: zod_1.z.date().optional(),
});
/**
 * Source type for tools in the registry
 */
exports.ToolSourceTypeSchema = zod_1.z.enum([
    'builtin', // Built-in APEX tools (Read, Write, Bash, etc.)
    'custom', // User-defined custom tools from config
    'mcp', // Tools provided by MCP servers
    'plugin', // Tools from plugins (future)
]);
/**
 * Tool source information tracking where a tool came from
 */
exports.ToolSourceSchema = zod_1.z.object({
    /** Type of tool source */
    type: exports.ToolSourceTypeSchema,
    /** Source identifier (server ID for MCP, config path for custom) */
    sourceId: zod_1.z.string().optional(),
    /** Human-readable source name */
    sourceName: zod_1.z.string().optional(),
    /** When the tool was registered from this source */
    registeredAt: zod_1.z.date(),
    /** Version of the tool from this source */
    version: zod_1.z.string().optional(),
});
/**
 * Extended tool registry entry for MCP tools
 * Extends the base ToolRegistryEntry with MCP-specific metadata
 */
exports.MCPToolRegistryEntrySchema = zod_1.z.object({
    /** The MCP tool definition */
    tool: exports.MCPToolSchema,
    /** Source information */
    source: exports.ToolSourceSchema,
    /** Whether the tool is currently available */
    available: zod_1.z.boolean().default(true),
    /** Reason if the tool is unavailable */
    unavailableReason: zod_1.z.string().optional(),
    /** Last time the tool was invoked */
    lastInvoked: zod_1.z.date().optional(),
    /** Number of times the tool has been invoked */
    invocationCount: zod_1.z.number().min(0).default(0),
    /** Number of successful invocations */
    successCount: zod_1.z.number().min(0).default(0),
    /** Number of failed invocations */
    failureCount: zod_1.z.number().min(0).default(0),
    /** Average execution time in milliseconds */
    avgExecutionTimeMs: zod_1.z.number().min(0).optional(),
    /** Permission configuration for this tool */
    permissionConfig: exports.ToolPermissionConfigSchema.optional(),
});
/**
 * Unified tool registry entry that can represent any tool type
 * Provides a consistent interface for all tools regardless of source
 */
exports.UnifiedToolRegistryEntrySchema = zod_1.z.object({
    /** Unique identifier for the registry entry (tool name + source) */
    id: zod_1.z.string().min(1),
    /** Tool name */
    name: zod_1.z.string().min(1),
    /** Tool description */
    description: zod_1.z.string().optional(),
    /** Source information */
    source: exports.ToolSourceSchema,
    /** JSON Schema for input parameters */
    inputSchema: exports.MCPToolSchemaSchema,
    /** Whether the tool is currently available */
    available: zod_1.z.boolean().default(true),
    /** Reason if unavailable */
    unavailableReason: zod_1.z.string().optional(),
    /** Tool capabilities */
    capabilities: exports.MCPToolCapabilitiesSchema.optional(),
    /** Runtime statistics */
    stats: zod_1.z
        .object({
        lastInvoked: zod_1.z.date().optional(),
        invocationCount: zod_1.z.number().min(0).default(0),
        successCount: zod_1.z.number().min(0).default(0),
        failureCount: zod_1.z.number().min(0).default(0),
        avgExecutionTimeMs: zod_1.z.number().min(0).optional(),
        lastErrorMessage: zod_1.z.string().optional(),
        lastErrorAt: zod_1.z.date().optional(),
    })
        .optional(),
    /** Permission configuration */
    permissionConfig: exports.ToolPermissionConfigSchema.optional(),
    /** Version */
    version: zod_1.z.string().optional(),
    /** Tags */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Deprecation notice */
    deprecated: zod_1.z.string().optional(),
    /** When the entry was last updated */
    updatedAt: zod_1.z.date().optional(),
});
/**
 * Tool registry state snapshot
 * Represents the complete state of all registered tools
 */
exports.ToolRegistryStateSchema = zod_1.z.object({
    /** All registered tools keyed by their unique ID */
    tools: zod_1.z.record(zod_1.z.string(), exports.UnifiedToolRegistryEntrySchema),
    /** Tools grouped by source type */
    bySource: zod_1.z.object({
        builtin: zod_1.z.array(zod_1.z.string()).default([]),
        custom: zod_1.z.array(zod_1.z.string()).default([]),
        mcp: zod_1.z.array(zod_1.z.string()).default([]),
        plugin: zod_1.z.array(zod_1.z.string()).default([]),
    }),
    /** Tools grouped by MCP server ID */
    byMCPServer: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())).default({}),
    /** Last time the registry was updated */
    lastUpdated: zod_1.z.date(),
    /** Total number of registered tools */
    totalCount: zod_1.z.number().int().min(0),
    /** Number of available tools */
    availableCount: zod_1.z.number().int().min(0),
});
/**
 * Tool discovery event types
 */
exports.ToolDiscoveryEventTypeSchema = zod_1.z.enum([
    'tool_registered', // New tool added to registry
    'tool_unregistered', // Tool removed from registry
    'tool_updated', // Tool metadata updated
    'tool_available', // Tool became available
    'tool_unavailable', // Tool became unavailable
    'server_tools_refreshed', // All tools from a server were refreshed
]);
/**
 * Tool discovery event data
 */
exports.ToolDiscoveryEventSchema = zod_1.z.object({
    /** Event type */
    type: exports.ToolDiscoveryEventTypeSchema,
    /** Tool ID affected */
    toolId: zod_1.z.string().min(1),
    /** Tool name */
    toolName: zod_1.z.string().min(1),
    /** Source of the tool */
    source: exports.ToolSourceSchema,
    /** When the event occurred */
    timestamp: zod_1.z.date(),
    /** Previous state (for updates) */
    previousState: exports.UnifiedToolRegistryEntrySchema.optional(),
    /** New state (for registrations and updates) */
    newState: exports.UnifiedToolRegistryEntrySchema.optional(),
    /** Additional event context */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * MCP tool invocation request
 */
exports.MCPToolInvocationRequestSchema = zod_1.z.object({
    /** Tool name to invoke */
    toolName: zod_1.z.string().min(1),
    /** MCP server ID */
    serverId: zod_1.z.string().min(1),
    /** Tool arguments */
    arguments: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).default({}),
    /** Request ID for correlation */
    requestId: zod_1.z.string().optional(),
    /** Timeout in milliseconds */
    timeoutMs: zod_1.z.number().int().min(0).optional(),
    /** Whether to stream the response */
    stream: zod_1.z.boolean().optional().default(false),
});
/**
 * MCP tool invocation result content types
 */
exports.MCPToolResultContentTypeSchema = zod_1.z.enum([
    'text', // Plain text content
    'image', // Base64 encoded image
    'resource', // Resource reference
    'error', // Error content
]);
/**
 * MCP tool result content item
 */
exports.MCPToolResultContentSchema = zod_1.z.object({
    /** Content type */
    type: exports.MCPToolResultContentTypeSchema,
    /** Text content (for text type) */
    text: zod_1.z.string().optional(),
    /** Image data (base64) for image type */
    data: zod_1.z.string().optional(),
    /** MIME type for image/resource */
    mimeType: zod_1.z.string().optional(),
    /** Resource URI for resource type */
    uri: zod_1.z.string().optional(),
    /** Error message for error type */
    error: zod_1.z.string().optional(),
});
/**
 * MCP tool invocation response
 */
exports.MCPToolInvocationResponseSchema = zod_1.z.object({
    /** Request ID for correlation */
    requestId: zod_1.z.string().optional(),
    /** Whether the invocation was successful */
    success: zod_1.z.boolean(),
    /** Result content array */
    content: zod_1.z.array(exports.MCPToolResultContentSchema).default([]),
    /** Whether this is a partial/streaming response */
    isPartial: zod_1.z.boolean().optional().default(false),
    /** Error details if failed */
    error: zod_1.z
        .object({
        code: zod_1.z.string().optional(),
        message: zod_1.z.string(),
        details: zod_1.z.unknown().optional(),
    })
        .optional(),
    /** Execution metrics */
    metrics: zod_1.z
        .object({
        startedAt: zod_1.z.date(),
        completedAt: zod_1.z.date().optional(),
        durationMs: zod_1.z.number().int().min(0).optional(),
    })
        .optional(),
});
// ============================================================================
// MCP Types for v0.5.0 Feature Development
// ============================================================================
// These types satisfy the acceptance criteria requirements:
// - MCPServer (id, name, description, version, author, repository, tools, categories, installCount, verified)
// - MCPInstallation (serverId, installedAt, config, status)
// - MCPInstallProgress (serverId, stage, progress, message)
/**
 * MCPServer Schema for v0.5.0 feature development
 * Contains all required fields: id, name, description, version, author, repository, tools, categories, installCount, verified
 */
exports.MCPServerV050Schema = zod_1.z.object({
    /** Unique identifier for the MCP server */
    id: zod_1.z.string().min(1, 'Server ID is required'),
    /** Display name for the MCP server */
    name: zod_1.z.string().min(1, 'Server name is required'),
    /** Detailed description of the server's functionality */
    description: zod_1.z.string().min(1, 'Description is required'),
    /** Semantic version of the server */
    version: zod_1.z.string().min(1, 'Version is required'),
    /** Author or maintainer of the server */
    author: zod_1.z.string().optional(),
    /** URL to the source code repository (must be http or https) */
    repository: zod_1.z.string().url().refine((url) => url.startsWith('http://') || url.startsWith('https://'), { message: 'Repository URL must use http or https protocol' }).optional(),
    /** List of tools provided by this MCP server */
    tools: zod_1.z.array(zod_1.z.string()).default([]),
    /** Categories for organizing servers */
    categories: zod_1.z.array(exports.MCPServerCategorySchema).default([]),
    /** Number of times this server has been installed */
    installCount: zod_1.z.number().int().min(0).default(0),
    /** Whether this server is verified/official */
    verified: zod_1.z.boolean().default(false),
});
/**
 * MCPInstallation Schema for v0.5.0 feature development
 * Contains all required fields: serverId, installedAt, config, status
 */
exports.MCPInstallationV050Schema = zod_1.z.object({
    /** Reference to the MCP server ID */
    serverId: zod_1.z.string().min(1, 'Server ID is required'),
    /** Timestamp when the server was installed */
    installedAt: zod_1.z.date(),
    /** Installation-specific configuration */
    config: exports.MCPServerConfigSchema,
    /** Current installation status */
    status: exports.MCPInstallationStatusSchema,
});
/**
 * MCPInstallProgress Schema for v0.5.0 feature development
 * Contains all required fields: serverId, stage, progress, message
 */
exports.MCPInstallProgressV050Schema = zod_1.z.object({
    /** Reference to the server being installed */
    serverId: zod_1.z.string().min(1, 'Server ID is required'),
    /** Current installation stage */
    stage: exports.MCPInstallStageSchema,
    /** Progress percentage (0-100) */
    progress: zod_1.z.number().min(0).max(100),
    /** Human-readable status message */
    message: zod_1.z.string(),
});
// ============================================================================
// TDD Mode Configuration (v0.5.0)
// ============================================================================
exports.TDDModeConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().optional().default(false),
    testCommand: zod_1.z.string().optional().default('npm test'),
    watchMode: zod_1.z.boolean().optional().default(false),
    maxIterations: zod_1.z.number().int().min(1).optional().default(5),
    regressionGuard: zod_1.z.boolean().optional().default(true),
});
// ============================================================================
// Visual Regression Configuration (v0.5.0)
// ============================================================================
/**
 * Configuration for visual regression testing with screenshot comparison
 *
 * This configuration controls how visual regression tests are executed,
 * including similarity thresholds, diff highlighting, and snapshot management.
 */
exports.VisualRegressionConfigSchema = zod_1.z.object({
    /** Enable visual regression testing (default: false) */
    enabled: zod_1.z.boolean().optional().default(false),
    /**
     * Similarity threshold for comparison (0-1, where 1 is exact match).
     * A value of 0.99 means 99% of pixels must match for the comparison to pass.
     * Default: 0.99
     */
    threshold: zod_1.z.number().min(0).max(1).optional().default(0.99),
    /**
     * Color for highlighting different pixels in diff image.
     * Format: [r, g, b] values 0-255.
     * Default: [255, 0, 255] (magenta)
     */
    diffColor: zod_1.z.tuple([
        zod_1.z.number().min(0).max(255),
        zod_1.z.number().min(0).max(255),
        zod_1.z.number().min(0).max(255)
    ]).optional().default([255, 0, 255]),
    /**
     * Directory for storing baseline snapshots (relative to project root).
     * Default: '.apex/snapshots'
     */
    snapshotDir: zod_1.z.string().optional().default('.apex/snapshots'),
    /**
     * Whether to fail the test/comparison when mismatch is detected.
     * Default: true
     */
    failOnMismatch: zod_1.z.boolean().optional().default(true),
    /** Whether to include alpha channel in comparison (default: false) */
    includeAlpha: zod_1.z.boolean().optional().default(false),
    /** Whether to output diff image (default: false) */
    outputDiff: zod_1.z.boolean().optional().default(false),
    /** Path to save diff image (required if outputDiff is true) */
    diffOutputPath: zod_1.z.string().optional(),
});
/**
 * Slack integration configuration (v0.7.0)
 */
exports.SlackIntegrationConfigSchema = zod_1.z.object({
    /** Enable Slack integration */
    enabled: zod_1.z.boolean().optional().default(false),
    /** Socket mode app-level token (xapp-...) */
    appToken: zod_1.z.string().optional(),
    /** Bot token (xoxb-...) */
    botToken: zod_1.z.string().optional(),
    /** Signing secret (required for HTTP mode, optional for socket mode) */
    signingSecret: zod_1.z.string().optional(),
    /** Slack mode (socket is recommended for local/dev) */
    mode: zod_1.z.enum(['socket']).optional().default('socket'),
    /** Default channel for notifications and command responses */
    defaultChannel: zod_1.z.string().optional().default('#apex'),
    /** Additional notification channels */
    notificationChannels: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Enable thread updates for task progress */
    threadUpdates: zod_1.z.boolean().optional().default(true),
    /** Use Block Kit for responses */
    useBlocks: zod_1.z.boolean().optional().default(true),
});
/**
 * Schema for API authentication configuration
 * Controls access to the APEX REST API and WebSocket endpoints
 */
exports.ApiAuthConfigSchema = zod_1.z.object({
    /** Whether API authentication is enabled */
    enabled: zod_1.z.boolean().optional().default(false),
    /** Array of valid API keys for authenticating requests */
    apiKeys: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
/**
 * Main configuration schema for APEX project settings, defining all aspects of the AI development platform
 * including project setup, agent behavior, resource limits, integrations, and workflow automation
 * @example
 * ```typescript
 * const apexConfig: ApexConfig = {
 *   version: '1.0',
 *   project: { name: 'my-app', language: 'typescript' },
 *   models: { planning: 'opus', implementation: 'sonnet' },
 *   git: { branchPrefix: 'apex/', autoPush: true },
 *   limits: { maxTokensPerTask: 500000, dailyBudget: 100.0 },
 *   ui: { previewMode: true, diffPreview: true }
 * };
 * ```
 */
exports.ApexConfigSchema = zod_1.z.object({
    version: zod_1.z.string().default('1.0'),
    project: exports.ProjectConfigSchema,
    autonomy: exports.AutonomyConfigSchema.optional(),
    agents: zod_1.z
        .object({
        enabled: zod_1.z.array(zod_1.z.string()).optional(),
        disabled: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .optional(),
    models: exports.ModelsConfigSchema.optional(),
    gates: zod_1.z.array(exports.WorkflowGateSchema).optional(),
    git: exports.GitConfigSchema.optional(),
    limits: exports.LimitsConfigSchema.optional(),
    api: zod_1.z
        .object({
        url: zod_1.z.string().optional().default('http://localhost:3000'),
        port: zod_1.z.number().optional().default(3000),
        autoStart: zod_1.z.boolean().optional().default(false),
        /** Authentication configuration for API access control */
        auth: exports.ApiAuthConfigSchema.optional(),
    })
        .optional(),
    ui: exports.UIConfigSchema.optional(),
    webUI: zod_1.z
        .object({
        port: zod_1.z.number().optional().default(3001),
        autoStart: zod_1.z.boolean().optional().default(false),
    })
        .optional(),
    /** Linter configuration for code quality enforcement (v0.5.0) */
    linter: exports.LinterConfigSchema.optional(),
    /** Code quality automation configuration (v0.5.0) */
    codeQuality: exports.CodeQualityConfigSchema.optional(),
    /** Secret scanner configuration for detecting sensitive information (v0.5.0) */
    scanner: exports.SecretScannerConfigSchema.optional(),
    /** Secret scanning configuration with enforcement mode control (v0.5.0) */
    secretScanning: exports.SecretScanningConfigSchema.optional(),
    daemon: exports.DaemonConfigSchema.optional(),
    /** Logging configuration for structured logging across all packages (v0.6.0) */
    logging: exports.LoggingConfigSchema.optional(),
    documentation: zod_1.z.lazy(() => exports.DocumentationAnalysisConfigSchema).optional(),
    workspace: zod_1.z.lazy(() => exports.WorkspaceDefaultsSchema).optional(),
    /** Permission preset configuration for tool access control (v0.5.0) */
    permissions: zod_1.z.lazy(() => exports.PermissionsConfigSchema).optional(),
    /** Policy-as-code configuration for governance and compliance (v0.5.0) */
    policy: zod_1.z.lazy(() => exports.PolicyConfigSchema).optional(),
    /** Array of policy definitions for enhanced governance (v0.5.0) */
    policies: zod_1.z.lazy(() => zod_1.z.array(exports.PolicySchema)).optional().default([]),
    /** Tool action tracking and retention configuration (v0.5.0) */
    toolActionRetention: exports.ToolActionRetentionConfigSchema.optional(),
    /** Hook configuration for custom lifecycle events (v0.5.0) */
    hooks: zod_1.z.lazy(() => zod_1.z.array(exports.HookConfigSchema)).optional().default([]),
    /** Tool hook configuration for pre/post tool execution hooks (v0.5.0) */
    toolHooks: zod_1.z.lazy(() => exports.ToolHookConfigSchema).optional(),
    /** Per-tool configuration overrides */
    tools: exports.ToolConfigSchema.optional(),
    /** Custom tool definitions (v0.5.0) */
    customTools: zod_1.z.array(exports.CustomToolConfigSchema).optional().default([]),
    /** MCP server configuration and marketplace settings (v0.5.0) */
    mcp: exports.MCPConfigSchema.optional(),
    /** TDD mode configuration for test-first workflows (v0.5.0) */
    tdd: exports.TDDModeConfigSchema.optional(),
    /** Visual regression configuration for screenshot comparison testing (v0.5.0) */
    visualRegression: exports.VisualRegressionConfigSchema.optional(),
    /** Slack integration configuration (v0.7.0) */
    slack: exports.SlackIntegrationConfigSchema.optional(),
    /** Project-specific rules defined in .apexrules (v0.4.0) */
    projectRules: zod_1.z.lazy(() => zod_1.z.array(exports.ApexRuleSchema)).optional().default([]),
    /** Unified guardrails configuration for policies, secrets, and access control (v0.5.0) */
    guardrails: zod_1.z.lazy(() => exports.GuardrailConfigSchema).optional(),
    /** Tool aliases for reusable tool configurations (v0.5.0) */
    aliases: zod_1.z.array(exports.ToolAliasSchema).optional().default([]),
    /** Self-repair loop configuration for autonomous error recovery (v0.5.0) */
    repair: zod_1.z.lazy(() => exports.RepairLoopConfigSchema).optional(),
});
// ============================================================================
// Task Management
// ============================================================================
/**
 * Schema for task execution status tracking throughout the APEX workflow lifecycle
 * @example
 * ```typescript
 * const status: TaskStatus = 'pending';
 * const validStatus = TaskStatusSchema.parse('in-progress');
 *
 * // Task progression example:
 * // pending → queued → planning → in-progress → completed
 * // or: pending → queued → planning → in-progress → paused → in-progress → completed
 * ```
 */
exports.TaskStatusSchema = zod_1.z.enum([
    'pending', // Task created but not yet queued
    'queued', // Task ready for execution
    'planning', // Agent is planning implementation approach
    'in-progress', // Task actively being executed
    'waiting-approval', // Task requires user approval (deprecated, use 'awaiting-approval')
    'awaiting-approval', // Task requires user approval to continue
    'paused', // Task execution paused (rate limits, manual pause, etc.)
    'completed', // Task successfully finished
    'failed', // Task execution failed
    'cancelled', // Task was cancelled by user or system
]);
/**
 * Schema for task priority levels affecting execution order and resource allocation
 * @example
 * ```typescript
 * const priority: TaskPriority = 'normal';
 * const validPriority = TaskPrioritySchema.parse('urgent');
 *
 * // Priority affects task queue ordering:
 * // urgent > high > normal > low
 * ```
 */
exports.TaskPrioritySchema = zod_1.z.enum([
    'low', // Low priority, executed when resources available
    'normal', // Default priority for most tasks
    'high', // High priority, prioritized over normal/low
    'urgent', // Highest priority, executed immediately when possible
]);
/**
 * Schema for estimated task effort/complexity levels used for planning and resource allocation
 * @example
 * ```typescript
 * const effort: TaskEffort = 'medium';
 * const validEffort = TaskEffortSchema.parse('large');
 *
 * // Effort levels roughly correspond to:
 * // xs: <1 hour, small: 1-4 hours, medium: 4-8 hours, large: 1-2 days, xl: 2+ days
 * ```
 */
exports.TaskEffortSchema = zod_1.z.enum([
    'xs', // Extra small: minimal effort, quick fixes
    'small', // Small: simple features or bug fixes
    'medium', // Medium: moderate complexity features
    'large', // Large: complex features or refactoring
    'xl', // Extra large: major features or architectural changes
]);
// ============================================================================
// v0.4.0 - New Types for Enhanced Features
// ============================================================================
// ============================================================================
// Container Configuration Types (v0.4.0)
// ============================================================================
/**
 * Resource limits for container execution
 * Defines CPU and memory constraints for containerized workspaces
 */
exports.ResourceLimitsSchema = zod_1.z.object({
    /** CPU limit in cores (e.g., 0.5 for half a core, 2 for 2 cores) */
    cpu: zod_1.z.number().min(0.1).max(64).optional(),
    /** Memory limit with unit suffix (e.g., "256m", "1g", "2048m") */
    memory: zod_1.z.string().regex(/^\d+[kmgKMG]?$/).optional(),
    /** Memory reservation (soft limit) with unit suffix */
    memoryReservation: zod_1.z.string().regex(/^\d+[kmgKMG]?$/).optional(),
    /** Maximum memory swap with unit suffix */
    memorySwap: zod_1.z.string().regex(/^\d+[kmgKMG]?$/).optional(),
    /** CPU shares for relative weighting (1024 = 1 share) */
    cpuShares: zod_1.z.number().min(2).max(262144).optional(),
    /** Number of PIDs allowed in the container */
    pidsLimit: zod_1.z.number().min(1).optional(),
});
/**
 * Network mode for container networking configuration
 */
exports.ContainerNetworkModeSchema = zod_1.z.enum([
    'bridge', // Default Docker bridge network
    'host', // Use host networking (shares host network namespace)
    'none', // No networking
    'container', // Share networking with another container
]);
/**
 * Container configuration schema for workspace isolation
 * Defines all settings for running tasks in containerized environments
 */
exports.ContainerConfigSchema = zod_1.z.object({
    /** Docker/OCI image to use (e.g., "node:20-alpine", "python:3.11-slim") */
    image: zod_1.z.string()
        .min(1, 'Container image cannot be empty')
        .regex(/^[a-z0-9][a-z0-9\-._]*([\/][a-z0-9][a-z0-9\-._]*)*(:[\w][\w.-]*)?$/i, 'Invalid container image format. Use format: [registry/]name[:tag]'),
    /** Path to Dockerfile for building custom images (relative to build context) */
    dockerfile: zod_1.z.string().min(1).optional(),
    /** Build context path for Docker image builds (defaults to current directory) */
    buildContext: zod_1.z.string().min(1).optional(),
    /** Custom tag for built images (e.g., "my-app:latest") */
    imageTag: zod_1.z.string().min(1).optional(),
    /** Volume mounts mapping host paths to container paths */
    volumes: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Environment variables to set in the container */
    environment: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Resource limits for the container */
    resourceLimits: exports.ResourceLimitsSchema.optional(),
    /** Network mode for container networking */
    networkMode: exports.ContainerNetworkModeSchema.optional().default('bridge'),
    /** Working directory inside the container */
    workingDir: zod_1.z.string().optional(),
    /** User to run as inside the container (e.g., "1000:1000", "node") */
    user: zod_1.z.string().optional(),
    /** Additional container labels for identification */
    labels: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Entrypoint override for the container */
    entrypoint: zod_1.z.array(zod_1.z.string()).optional(),
    /** Command to run in the container */
    command: zod_1.z.array(zod_1.z.string()).optional(),
    /** Whether to remove the container after it stops */
    autoRemove: zod_1.z.boolean().optional().default(true),
    /** Whether to run in privileged mode (use with caution) */
    privileged: zod_1.z.boolean().optional().default(false),
    /** Security options for the container */
    securityOpts: zod_1.z.array(zod_1.z.string()).optional(),
    /** Capabilities to add to the container */
    capAdd: zod_1.z.array(zod_1.z.string()).optional(),
    /** Capabilities to drop from the container */
    capDrop: zod_1.z.array(zod_1.z.string()).optional(),
    /** Whether to automatically install dependencies (defaults to true) */
    autoDependencyInstall: zod_1.z.boolean().optional().default(true),
    /** Custom command to install dependencies (overrides default detection) */
    customInstallCommand: zod_1.z.string().optional(),
    /** Whether to use frozen lockfile installation (npm ci, yarn --frozen-lockfile, etc.) */
    useFrozenLockfile: zod_1.z.boolean().optional().default(true),
    /** Timeout for dependency installation in milliseconds */
    installTimeout: zod_1.z.number().positive().optional(),
    /** Number of retry attempts for dependency installation on failure */
    installRetries: zod_1.z.number().int().min(0).optional(),
});
/**
 * Status of a running container
 */
exports.ContainerStatusSchema = zod_1.z.enum([
    'created', // Container created but not started
    'running', // Container is running
    'paused', // Container is paused
    'restarting', // Container is restarting
    'removing', // Container is being removed
    'exited', // Container has exited
    'dead', // Container is dead (failed to stop cleanly)
]);
/**
 * Task isolation mode enumeration
 * - 'full': Full isolation with container + worktree
 * - 'worktree': Git worktree isolation only (no container)
 * - 'shared': Shared workspace with current directory (current behavior)
 */
exports.IsolationModeSchema = zod_1.z.enum(['full', 'worktree', 'shared']);
/**
 * Workspace isolation strategy enumeration
 */
exports.WorkspaceStrategySchema = zod_1.z.enum(['worktree', 'container', 'directory', 'none']);
/**
 * Default container configuration schema for workspace settings
 * Provides project-wide defaults that can be overridden per-task
 */
exports.ContainerDefaultsSchema = zod_1.z.object({
    /** Default Docker/OCI image to use for container workspaces */
    image: zod_1.z.string()
        .min(1, 'Container image cannot be empty')
        .regex(/^[a-z0-9][a-z0-9\-._]*([\/][a-z0-9][a-z0-9\-._]*)*(:[\w][\w.-]*)?$/i, 'Invalid container image format. Use format: [registry/]name[:tag]')
        .optional(),
    /** Default resource limits for containers */
    resourceLimits: exports.ResourceLimitsSchema.optional(),
    /** Default network mode for container networking */
    networkMode: exports.ContainerNetworkModeSchema.optional(),
    /** Default environment variables to set in containers */
    environment: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    /** Whether to automatically remove containers after they stop (default: true) */
    autoRemove: zod_1.z.boolean().optional().default(true),
    /** Default timeout for dependency installation in milliseconds */
    installTimeout: zod_1.z.number().positive().optional(),
    /** Default number of retry attempts for dependency installation on failure */
    installRetries: zod_1.z.number().int().min(0).optional(),
});
/**
 * Workspace defaults configuration schema for project-level settings
 * Defines default workspace isolation behavior and container settings
 */
exports.WorkspaceDefaultsSchema = zod_1.z.object({
    /** Default isolation strategy for tasks (default: 'none') */
    defaultStrategy: exports.WorkspaceStrategySchema.optional().default('none'),
    /** Whether to cleanup workspace after task completion (default: true) */
    cleanupOnComplete: zod_1.z.boolean().optional().default(true),
    /** Default container configuration for container-based workspaces */
    container: exports.ContainerDefaultsSchema.optional(),
});
/**
 * Workspace isolation configuration schema for tasks
 */
exports.WorkspaceConfigSchema = zod_1.z.object({
    /** Isolation strategy */
    strategy: exports.WorkspaceStrategySchema,
    /** Path to workspace (for worktree/directory strategies) */
    path: zod_1.z.string().optional(),
    /** Container configuration (for container strategy) */
    container: exports.ContainerConfigSchema.optional(),
    /** Whether to cleanup workspace after task completion */
    cleanup: zod_1.z.boolean(),
    /** Whether to preserve workspace on task failure */
    preserveOnFailure: zod_1.z.boolean().optional().default(false),
});
// ============================================================================
// Gate Management
// ============================================================================
exports.GateStatusSchema = zod_1.z.enum(['pending', 'approved', 'rejected', 'skipped', 'timeout']);
// ============================================================================
// Approval State Types (v0.5.0)
// ============================================================================
/**
 * Status values for approval state
 * - pending: Awaiting approval decision
 * - approved: Approval granted
 * - denied: Approval denied/rejected
 */
exports.ApprovalStatusSchema = zod_1.z.enum(['pending', 'approved', 'denied']);
/**
 * Approval actions that can be taken on an approval request
 * - approve: Grant approval to proceed
 * - deny: Deny approval and block proceeding
 * - request-info: Request more information before deciding
 */
exports.ApprovalActionSchema = zod_1.z.enum(['approve', 'deny', 'request-info']);
/**
 * Approval request data structure
 * Represents a request for approval with all necessary context
 */
exports.ApprovalRequestSchema = zod_1.z.object({
    /** Unique identifier for this approval request (new field) */
    requestId: zod_1.z.string().min(1).optional(),
    /** ID of the task requiring approval */
    taskId: zod_1.z.string().min(1, 'Task ID is required'),
    /** Description of what this approval is for */
    description: zod_1.z.string().optional(),
    /** Impact on resources (e.g., high, medium, low) */
    resourceImpact: zod_1.z.string().optional(),
    /** Reason for requiring approval */
    reason: zod_1.z.string().optional(),
    // Legacy fields for backward compatibility
    /** Unique identifier for this approval request (legacy field - use requestId) */
    id: zod_1.z.string().min(1, 'Approval ID is required'),
    /** Name of the gate/checkpoint requiring approval */
    gateName: zod_1.z.string().min(1, 'Gate name is required'),
    /** Type of approval checkpoint */
    gateType: exports.ApprovalCheckpointTypeSchema,
    /** Who can approve this request (list of usernames, emails, or roles) */
    approvers: zod_1.z.array(zod_1.z.string()).optional(),
    /** Minimum number of approvals required */
    minApprovals: zod_1.z.number().int().min(1).optional().default(1),
    /** When the approval was requested */
    requestedAt: zod_1.z.date(),
    /** Timeout in minutes (undefined = no timeout) */
    timeoutMinutes: zod_1.z.number().min(1).optional(),
    /** When the approval will expire */
    expiresAt: zod_1.z.date().optional(),
    /** Current workflow stage */
    stage: zod_1.z.string().optional(),
    /** Agent that triggered the approval request */
    agent: zod_1.z.string().optional(),
    /** Additional context about what is being approved */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Summary of changes or actions pending approval */
    changesSummary: zod_1.z.string().optional(),
    /** Files affected by the pending changes */
    affectedFiles: zod_1.z.array(zod_1.z.string()).optional(),
    /** Priority of the approval request */
    priority: zod_1.z.string().optional(),
    /** Additional metadata about the approval request */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Approval response data structure
 * Represents a response to an approval request with decision and context
 */
exports.ApprovalResponseSchema = zod_1.z.object({
    /** Unique identifier for this approval request (new field) */
    requestId: zod_1.z.string().min(1).optional(),
    /** ID of the task that received the approval response */
    taskId: zod_1.z.string().min(1, 'Task ID is required'),
    /** Response status (approved, denied, info-requested) */
    response: zod_1.z.enum(['approved', 'denied', 'info-requested']).optional(),
    /** Optional message explaining the decision */
    message: zod_1.z.string().optional(),
    // Legacy fields for backward compatibility
    /** Unique identifier for this approval request (legacy field - use requestId) */
    approvalId: zod_1.z.string().min(1, 'Approval ID is required'),
    /** Name of the gate/checkpoint */
    gateName: zod_1.z.string().min(1, 'Gate name is required'),
    /** Action taken (approve, deny, request-info) */
    action: exports.ApprovalActionSchema,
    /** Who provided the response */
    approver: zod_1.z.string().min(1, 'Approver is required'),
    /** Comment or reason for the decision */
    comment: zod_1.z.string().optional(),
    /** Reason for the decision */
    reason: zod_1.z.string().optional(),
    /** Timestamp when the response was provided */
    timestamp: zod_1.z.date(),
    /** Timestamp when the approval was originally requested */
    requestedAt: zod_1.z.date().optional(),
    /** Duration in milliseconds between request and response */
    responseTimeMs: zod_1.z.number().int().min(0).optional(),
    /** Current workflow stage */
    stage: zod_1.z.string().optional(),
    /** Agent that handled the approval */
    agent: zod_1.z.string().optional(),
    /** Priority of the approval response */
    priority: zod_1.z.string().optional(),
    /** Additional context */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Additional metadata */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Number of approvals received so far */
    approvalsReceived: zod_1.z.number().int().min(0).optional(),
    /** Number of approvals required */
    approvalsRequired: zod_1.z.number().int().min(1).optional().default(1),
    /** Whether this response resolves the approval requirement */
    resolved: zod_1.z.boolean().optional().default(false),
});
/**
 * Approval state representing the current state of an approval request
 * Tracks the decision, who made it, when, and additional context
 */
exports.ApprovalStateSchema = zod_1.z.object({
    /** Unique identifier for this approval request */
    id: zod_1.z.string().min(1, 'Approval ID is required'),
    /** ID of the associated task */
    taskId: zod_1.z.string().min(1, 'Task ID is required'),
    /** Name of the gate/checkpoint this approval is for */
    gateName: zod_1.z.string().min(1, 'Gate name is required'),
    /** Current status of the approval */
    status: exports.ApprovalStatusSchema,
    /** Who provided the approval/denial decision (username, email, or identifier) */
    approver: zod_1.z.string().optional(),
    /** When the approval was requested */
    requestedAt: zod_1.z.date(),
    /** When the approval was responded to (approved or denied) */
    respondedAt: zod_1.z.date().optional(),
    /** Comment or reason provided with the decision */
    comment: zod_1.z.string().optional(),
    /** Additional context about the approval request */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Stage in the workflow where approval was requested */
    stage: zod_1.z.string().optional(),
    /** Agent that triggered the approval request */
    agent: zod_1.z.string().optional(),
    /** Number of approvals received (for multi-approval gates) */
    approvalsReceived: zod_1.z.number().int().min(0).optional(),
    /** Number of approvals required */
    approvalsRequired: zod_1.z.number().int().min(1).optional(),
    /** Timeout configuration (in minutes, undefined = no timeout) */
    timeoutMinutes: zod_1.z.number().min(1).optional(),
    /** When the approval will timeout (calculated from requestedAt + timeoutMinutes) */
    expiresAt: zod_1.z.date().optional(),
});
/**
 * Event data for 'approval-required' event
 * Emitted when a task reaches an approval gate and requires human approval
 */
exports.ApprovalRequiredEventDataSchema = zod_1.z.object({
    /** Unique identifier for this approval request */
    approvalId: zod_1.z.string().min(1),
    /** ID of the task requiring approval */
    taskId: zod_1.z.string().min(1),
    /** Name of the gate/checkpoint requiring approval */
    gateName: zod_1.z.string().min(1),
    /** Type of approval checkpoint */
    gateType: exports.ApprovalCheckpointTypeSchema,
    /** Description of what this approval is for */
    description: zod_1.z.string().optional(),
    /** Who can approve this request (list of usernames, emails, or roles) */
    approvers: zod_1.z.array(zod_1.z.string()).optional(),
    /** Minimum number of approvals required */
    minApprovals: zod_1.z.number().int().min(1).optional().default(1),
    /** Timeout in minutes (undefined = no timeout) */
    timeoutMinutes: zod_1.z.number().min(1).optional(),
    /** When the approval will expire */
    expiresAt: zod_1.z.date().optional(),
    /** Current workflow stage */
    stage: zod_1.z.string().optional(),
    /** Agent that triggered the approval request */
    agent: zod_1.z.string().optional(),
    /** Timestamp when approval was requested */
    timestamp: zod_1.z.date(),
    /** Additional context about what is being approved */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Summary of changes or actions pending approval */
    changesSummary: zod_1.z.string().optional(),
    /** Files affected by the pending changes */
    affectedFiles: zod_1.z.array(zod_1.z.string()).optional(),
    /** Whether this is a blocking gate (task cannot proceed without approval) */
    blocking: zod_1.z.boolean().optional().default(true),
    /** URL for the approval interface (generated from apiUrl config) */
    approvalUrl: zod_1.z.string().url().optional(),
});
/**
 * Event data for 'gate:approved' and 'gate:rejected' events
 * Emitted when an approval request receives a response
 */
exports.ApprovalResponseEventDataSchema = zod_1.z.object({
    /** Unique identifier for this approval request */
    approvalId: zod_1.z.string().min(1),
    /** ID of the task that received the approval response */
    taskId: zod_1.z.string().min(1),
    /** Name of the gate/checkpoint */
    gateName: zod_1.z.string().min(1),
    /** Type of approval checkpoint */
    gateType: exports.ApprovalCheckpointTypeSchema,
    /** Whether the request was approved or denied */
    approved: zod_1.z.boolean(),
    /** Who provided the approval/denial decision */
    approver: zod_1.z.string().min(1, 'Approver is required'),
    /** Comment or reason for the decision */
    comment: zod_1.z.string().optional(),
    /** Timestamp when the response was provided */
    timestamp: zod_1.z.date(),
    /** Timestamp when the approval was originally requested */
    requestedAt: zod_1.z.date(),
    /** Duration in milliseconds between request and response */
    responseTimeMs: zod_1.z.number().int().min(0).optional(),
    /** Current workflow stage */
    stage: zod_1.z.string().optional(),
    /** Number of approvals received so far */
    approvalsReceived: zod_1.z.number().int().min(0).optional(),
    /** Number of approvals required */
    approvalsRequired: zod_1.z.number().int().min(1).optional(),
    /** Whether all required approvals have been received */
    allApprovalsReceived: zod_1.z.boolean().optional(),
    /** Additional context about the approval response */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Event data for when an approval has been granted
 */
exports.ApprovalGrantedEventDataSchema = zod_1.z.object({
    /** Unique identifier for the approval request that was granted */
    approvalId: zod_1.z.string().min(1),
    /** ID of the task associated with the approval */
    taskId: zod_1.z.string().min(1),
    /** Who granted the approval */
    approver: zod_1.z.string().min(1),
    /** Optional comment from the approver */
    comment: zod_1.z.string().optional(),
    /** Timestamp when the approval was granted */
    timestamp: zod_1.z.date(),
});
/**
 * Event data for when an approval has been denied
 */
exports.ApprovalDeniedEventDataSchema = zod_1.z.object({
    /** Unique identifier for the approval request that was denied */
    approvalId: zod_1.z.string().min(1),
    /** ID of the task associated with the approval */
    taskId: zod_1.z.string().min(1),
    /** Who denied the approval */
    approver: zod_1.z.string().min(1),
    /** Reason for denying the approval */
    reason: zod_1.z.string().min(1, 'Reason is required for denial'),
    /** Timestamp when the approval was denied */
    timestamp: zod_1.z.date(),
});
/**
 * Event data for when an approval has been fully resolved
 * Emitted when an approval request reaches a final state (approved, denied, or timeout)
 */
exports.ApprovalResolvedEventDataSchema = zod_1.z.object({
    /** Unique identifier for the approval request that was resolved */
    approvalId: zod_1.z.string().min(1),
    /** ID of the task associated with the approval */
    taskId: zod_1.z.string().min(1),
    /** Name of the gate/checkpoint */
    gateName: zod_1.z.string().min(1),
    /** Final resolution status */
    resolution: zod_1.z.enum(['approved', 'denied', 'timeout', 'cancelled']),
    /** Who provided the final resolution (if applicable) */
    resolvedBy: zod_1.z.string().optional(),
    /** Final comment or reason for the resolution */
    comment: zod_1.z.string().optional(),
    /** Timestamp when the approval was resolved */
    timestamp: zod_1.z.date(),
    /** Timestamp when the approval was originally requested */
    requestedAt: zod_1.z.date(),
    /** Total duration in milliseconds from request to resolution */
    totalDurationMs: zod_1.z.number().int().min(0).optional(),
    /** Number of approvals received (for multi-approval gates) */
    approvalsReceived: zod_1.z.number().int().min(0).optional(),
    /** Number of approvals required */
    approvalsRequired: zod_1.z.number().int().min(1).optional().default(1),
});
/**
 * Request to submit an approval decision
 */
exports.ApprovalDecisionRequestSchema = zod_1.z.object({
    /** ID of the approval request to respond to */
    approvalId: zod_1.z.string().min(1, 'Approval ID is required'),
    /** Who is making the decision */
    approver: zod_1.z.string().min(1, 'Approver is required'),
    /** Decision: approved, denied, or info-requested (derived from approved if not set) */
    decision: zod_1.z.enum(['approved', 'denied', 'info-requested']).optional(),
    /** Whether the request is approved */
    approved: zod_1.z.boolean(),
    /** Optional comments explaining the decision */
    comments: zod_1.z.string().optional(),
    /** Legacy singular comment field */
    comment: zod_1.z.string().optional(),
}).transform(data => ({
    ...data,
    decision: data.decision || (data.approved ? 'approved' : 'denied'),
    comments: data.comments || data.comment,
}));
/**
 * Response after submitting an approval decision
 */
exports.ApprovalDecisionResponseSchema = zod_1.z.object({
    /** Whether the decision was successfully recorded */
    success: zod_1.z.boolean(),
    /** Updated approval state after the decision */
    approvalState: exports.ApprovalStateSchema.optional(),
    /** Error message if the decision failed */
    error: zod_1.z.string().optional(),
    /** Whether the task will now proceed (all approvals received) */
    willProceed: zod_1.z.boolean().optional(),
    /** Whether the task will now proceed (alias) */
    taskWillProceed: zod_1.z.boolean().optional(),
});
// ============================================================================
// Permission Notification Types (v0.5.0)
// ============================================================================
/**
 * Schema for permission notification data
 * Used for real-time notifications about permission changes and status
 */
exports.PermissionNotificationSchema = zod_1.z.object({
    /** Unique identifier for this notification */
    id: zod_1.z.string().min(1),
    /** Type of permission notification */
    type: zod_1.z.enum([
        'permission:requested',
        'permission:granted',
        'permission:denied',
        'dangerous:detected',
        'dangerous:confirmed',
        'dangerous:blocked'
    ]),
    /** Task ID associated with this notification */
    taskId: zod_1.z.string().min(1),
    /** Agent that triggered this notification */
    agent: zod_1.z.string().min(1),
    /** Tool involved in the permission change */
    tool: zod_1.z.string().min(1),
    /** Optional scope/context (e.g., file path, command pattern) */
    scope: zod_1.z.string().optional(),
    /** Human-readable title for the notification */
    title: zod_1.z.string().min(1),
    /** Detailed message describing the permission event */
    message: zod_1.z.string().min(1),
    /** Severity level for UI display */
    severity: zod_1.z.enum(['info', 'warning', 'error', 'critical']).default('info'),
    /** Whether this notification requires immediate user attention */
    requiresAction: zod_1.z.boolean().default(false),
    /** Available actions user can take (e.g., ['approve', 'deny', 'view_details']) */
    actions: zod_1.z.array(zod_1.z.string()).default([]),
    /** Additional metadata for the notification */
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    /** Timestamp when the notification was created */
    timestamp: zod_1.z.date(),
    /** Expiration timestamp (optional) */
    expiresAt: zod_1.z.date().optional(),
    /** Whether this notification has been read/acknowledged */
    acknowledged: zod_1.z.boolean().default(false)
});
// ============================================================================
// Visual Comparison Event Data Types (v0.5.0)
// ============================================================================
/**
 * Event data for visual comparison results
 * Emitted when compareScreenshot() completes with comparison result
 */
exports.VisualComparisonEventDataSchema = zod_1.z.object({
    /** Unique test/comparison identifier */
    testId: zod_1.z.string().min(1),
    /** Path to baseline image */
    baseline: zod_1.z.string().min(1),
    /** Path to actual (current) image or base64 data URI */
    actual: zod_1.z.string().min(1),
    /** Path to diff image (if generated) */
    diffImage: zod_1.z.string().optional(),
    /** Percentage of pixels that differ (0-100) */
    diffPercentage: zod_1.z.number().min(0).max(100),
    /** Threshold percentage for acceptable difference (0-100) */
    threshold: zod_1.z.number().min(0).max(100),
    /** Whether the comparison passed (diffPercentage <= threshold) */
    passed: zod_1.z.boolean(),
    /** Task ID associated with this comparison */
    taskId: zod_1.z.string().optional(),
    /** Timestamp when comparison occurred */
    timestamp: zod_1.z.date(),
    /** URL of the page being compared (if applicable) */
    pageUrl: zod_1.z.string().optional(),
    /** Selector if element-specific comparison */
    selector: zod_1.z.string().optional(),
});
// ============================================================================
// Enhanced Documentation Analysis Types (v0.4.0)
// ============================================================================
/**
 * Configuration for outdated documentation detection
 */
exports.OutdatedDocsConfigSchema = zod_1.z.object({
    /** Number of days after which a TODO comment is considered outdated */
    todoAgeThresholdDays: zod_1.z.number().min(1).optional().default(30),
    /** Array of regex patterns for detecting version references in documentation */
    versionCheckPatterns: zod_1.z.array(zod_1.z.string()).optional().default([
        'v\\d+\\.\\d+\\.\\d+',
        'version\\s+\\d+\\.\\d+',
        '\\d+\\.\\d+\\s+release',
        'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
    ]),
    /** Whether deprecated APIs require migration documentation */
    deprecationRequiresMigration: zod_1.z.boolean().optional().default(true),
    /** Whether to enable cross-reference validation between documentation and code */
    crossReferenceEnabled: zod_1.z.boolean().optional().default(true),
});
/**
 * Configuration wrapper for documentation analysis settings
 */
exports.DocumentationAnalysisConfigSchema = zod_1.z.object({
    /** Enable documentation analysis features */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Configuration for outdated documentation detection */
    outdatedDocs: exports.OutdatedDocsConfigSchema.optional(),
    /** Configuration for JSDoc analysis (existing functionality) */
    jsdocAnalysis: zod_1.z.object({
        enabled: zod_1.z.boolean().optional().default(true),
        requirePublicExports: zod_1.z.boolean().optional().default(true),
        checkReturnTypes: zod_1.z.boolean().optional().default(true),
        checkParameterTypes: zod_1.z.boolean().optional().default(true),
    }).optional(),
    /** Configuration for README section analysis */
    readmeSections: zod_1.z.object({
        /** Enable README section analysis */
        enabled: zod_1.z.boolean().optional().default(true),
        /** Required sections that must be present */
        required: zod_1.z.array(zod_1.z.string()).optional().default(['title', 'description', 'installation', 'usage']),
        /** Recommended sections that should be present */
        recommended: zod_1.z.array(zod_1.z.string()).optional().default(['api', 'contributing', 'license']),
        /** Optional sections that are nice to have */
        optional: zod_1.z.array(zod_1.z.string()).optional().default(['testing', 'troubleshooting', 'faq', 'changelog']),
        /** Custom section definitions with their detection patterns */
        customSections: zod_1.z.record(zod_1.z.object({
            /** Display name for the section */
            displayName: zod_1.z.string(),
            /** Priority level for this section */
            priority: zod_1.z.enum(['required', 'recommended', 'optional']),
            /** Keywords or patterns to detect this section */
            indicators: zod_1.z.array(zod_1.z.string()),
            /** Description of what this section should contain */
            description: zod_1.z.string(),
        })).optional().default({}),
    }).optional(),
});
// ============================================================================
// Task Template Types
// ============================================================================
exports.TaskTemplateSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string().min(1, 'Template name is required').max(100, 'Template name must be 100 characters or less'),
    description: zod_1.z.string().min(1, 'Template description is required'),
    workflow: zod_1.z.string().min(1, 'Workflow is required'),
    priority: exports.TaskPrioritySchema.default('normal'),
    effort: exports.TaskEffortSchema.default('medium'),
    acceptanceCriteria: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).default([]),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
});
// ============================================================================
// Idle Task Types (v0.4.0)
// ============================================================================
exports.IdleTaskSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: exports.IdleTaskTypeSchema,
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    priority: exports.TaskPrioritySchema,
    estimatedEffort: exports.TaskEffortSchema,
    suggestedWorkflow: zod_1.z.string(),
    rationale: zod_1.z.string(),
    createdAt: zod_1.z.date(),
    implemented: zod_1.z.boolean().default(false),
    implementedTaskId: zod_1.z.string().optional(),
});
// ============================================================================
// Todo Management Types (TodoWrite Tool)
// ============================================================================
/**
 * Todo status enumeration
 * Represents the current state of a todo item
 */
exports.TodoStatusSchema = zod_1.z.enum(['pending', 'in_progress', 'completed']);
/**
 * Individual todo item (input format for TodoWrite tool)
 * Minimal representation used when creating/updating todos
 */
exports.TodoItemSchema = zod_1.z.object({
    /** Display content describing the task in imperative form (e.g., "Run tests") */
    content: zod_1.z.string().min(1, 'Todo content is required'),
    /** Current status of the todo */
    status: exports.TodoStatusSchema,
    /** Present continuous form for active display (e.g., "Running tests") */
    activeForm: zod_1.z.string().min(1, 'Active form is required'),
});
/**
 * Full todo with metadata (used internally)
 * Complete representation with database fields and timestamps
 */
exports.TodoSchema = zod_1.z.object({
    /** Unique identifier for this todo */
    id: zod_1.z.string().min(1),
    /** Display content describing the task */
    content: zod_1.z.string().min(1),
    /** Current status */
    status: exports.TodoStatusSchema,
    /** Present continuous form for active display */
    activeForm: zod_1.z.string().min(1),
    /** Associated task ID (if any) */
    taskId: zod_1.z.string().optional(),
    /** Order/position in the list */
    orderIndex: zod_1.z.number().int().min(0),
    /** When the todo was created */
    createdAt: zod_1.z.date(),
    /** When the todo was last updated */
    updatedAt: zod_1.z.date(),
    /** When the todo was completed (if completed) */
    completedAt: zod_1.z.date().optional(),
});
/**
 * TodoWrite tool input schema
 * Contains the complete updated todo list
 */
exports.TodoWriteInputSchema = zod_1.z.object({
    /** The complete updated todo list */
    todos: zod_1.z.array(exports.TodoItemSchema),
});
/**
 * TodoWrite tool output schema
 * Summary information about the updated todo list
 */
exports.TodoWriteOutputSchema = zod_1.z.object({
    /** Whether the operation was successful */
    success: zod_1.z.boolean(),
    /** Total number of todos */
    todosCount: zod_1.z.number().int().min(0),
    /** Number of pending todos */
    pendingCount: zod_1.z.number().int().min(0),
    /** Number of in-progress todos */
    inProgressCount: zod_1.z.number().int().min(0),
    /** Number of completed todos */
    completedCount: zod_1.z.number().int().min(0),
    /** The complete updated todo list with metadata */
    todos: zod_1.z.array(exports.TodoSchema),
});
// ============================================================================
// Permission Presets (v0.5.0)
// ============================================================================
/**
 * Permission preset enumeration
 * Defines predefined permission configurations for agent tool access:
 * - 'autonomous': All tools allowed without confirmation (full autonomy)
 * - 'review-all': All tools require user confirmation before execution
 * - 'read-only': Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)
 */
exports.PermissionPresetSchema = zod_1.z.enum([
    'autonomous', // All tools allowed without confirmation
    'review-all', // All tools require confirmation before execution
    'read-only', // Only read-only tools allowed
]);
/**
 * Tool permission behavior for a specific tool
 * - 'allow': Tool is allowed without confirmation
 * - 'confirm': Tool requires user confirmation before execution
 * - 'deny': Tool is not allowed
 */
exports.ToolPermissionBehaviorSchema = zod_1.z.enum([
    'allow', // Tool is allowed without confirmation
    'confirm', // Tool requires user confirmation
    'deny', // Tool is not allowed
]);
/**
 * Read-only tools that don't modify the filesystem or execute commands
 * These tools are safe to use in read-only mode
 */
exports.READ_ONLY_TOOLS = [
    'Read',
    'Grep',
    'Glob',
    'WebFetch',
    'WebSearch',
];
/**
 * Write/execute tools that can modify the filesystem or execute commands
 * These tools require elevated permissions in restricted modes
 */
exports.WRITE_TOOLS = [
    'Write',
    'Edit',
    'MultiEdit',
    'NotebookEdit',
    'Bash',
    'TodoWrite',
];
/**
 * All available tools combining read-only and write tools
 */
exports.ALL_TOOLS = [...exports.READ_ONLY_TOOLS, ...exports.WRITE_TOOLS];
/**
 * Tool permission rule schema
 * Defines the permission behavior for a specific tool or tool pattern
 */
exports.ToolPermissionRuleSchema = zod_1.z.object({
    /** Tool name or pattern (supports wildcards like 'Web*') */
    tool: zod_1.z.string().min(1, 'Tool name is required'),
    /** Permission behavior for this tool */
    behavior: exports.ToolPermissionBehaviorSchema,
    /** Optional scope restriction (e.g., file path pattern for file tools) */
    scope: zod_1.z.string().optional(),
    /** Optional reason for this permission rule */
    reason: zod_1.z.string().optional(),
});
/**
 * Permission preset configuration schema
 * Defines the complete permission configuration for a preset
 */
exports.PermissionPresetConfigSchema = zod_1.z.object({
    /** Name of the preset */
    name: exports.PermissionPresetSchema,
    /** Human-readable description of what this preset allows */
    description: zod_1.z.string(),
    /** Default behavior for tools not explicitly listed */
    defaultBehavior: exports.ToolPermissionBehaviorSchema,
    /** Specific tool permission rules (overrides default behavior) */
    rules: zod_1.z.array(exports.ToolPermissionRuleSchema).optional().default([]),
    /** Whether this preset allows creating new files */
    allowFileCreation: zod_1.z.boolean().default(false),
    /** Whether this preset allows executing shell commands */
    allowShellExecution: zod_1.z.boolean().default(false),
    /** Whether this preset allows network access */
    allowNetworkAccess: zod_1.z.boolean().default(true),
});
/**
 * Predefined permission preset configurations
 * These are the built-in presets that can be used out of the box
 */
exports.PERMISSION_PRESET_CONFIGS = {
    /**
     * Autonomous preset: All tools allowed without confirmation
     * Use when you want agents to operate with full autonomy
     */
    autonomous: {
        name: 'autonomous',
        description: 'All tools allowed without confirmation. Agents operate with full autonomy.',
        defaultBehavior: 'allow',
        rules: [],
        allowFileCreation: true,
        allowShellExecution: true,
        allowNetworkAccess: true,
    },
    /**
     * Review-all preset: All tools require confirmation
     * Use when you want to review every tool invocation before execution
     */
    'review-all': {
        name: 'review-all',
        description: 'All tools require user confirmation before execution.',
        defaultBehavior: 'confirm',
        rules: [],
        allowFileCreation: true,
        allowShellExecution: true,
        allowNetworkAccess: true,
    },
    /**
     * Read-only preset: Only read-only tools allowed
     * Use when you want agents to only observe without making changes
     */
    'read-only': {
        name: 'read-only',
        description: 'Only read-only tools allowed. No file modifications or command execution.',
        defaultBehavior: 'deny',
        rules: [
            { tool: 'Read', behavior: 'allow' },
            { tool: 'Grep', behavior: 'allow' },
            { tool: 'Glob', behavior: 'allow' },
            { tool: 'WebFetch', behavior: 'allow' },
            { tool: 'WebSearch', behavior: 'allow' },
        ],
        allowFileCreation: false,
        allowShellExecution: false,
        allowNetworkAccess: true,
    },
};
/**
 * Helper function to get the permission behavior for a tool given a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns The permission behavior for the tool
 */
function getToolBehaviorForPreset(preset, toolName) {
    const config = exports.PERMISSION_PRESET_CONFIGS[preset];
    // Check for specific rule for this tool
    const rule = config.rules?.find(r => r.tool === toolName);
    if (rule) {
        return rule.behavior;
    }
    // Return default behavior
    return config.defaultBehavior;
}
/**
 * Helper function to check if a tool is allowed (without confirmation) for a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns True if the tool is allowed without confirmation
 */
function isToolAllowedForPreset(preset, toolName) {
    return getToolBehaviorForPreset(preset, toolName) === 'allow';
}
/**
 * Helper function to check if a tool requires confirmation for a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns True if the tool requires confirmation
 */
function isToolConfirmRequiredForPreset(preset, toolName) {
    return getToolBehaviorForPreset(preset, toolName) === 'confirm';
}
/**
 * Helper function to check if a tool is denied for a preset
 * @param preset - The permission preset to use
 * @param toolName - The name of the tool to check
 * @returns True if the tool is denied
 */
function isToolDeniedForPreset(preset, toolName) {
    return getToolBehaviorForPreset(preset, toolName) === 'deny';
}
/**
 * Helper function to get the preset configuration
 * @param preset - The permission preset name
 * @returns The full preset configuration
 */
function getPresetConfig(preset) {
    return exports.PERMISSION_PRESET_CONFIGS[preset];
}
/**
 * Type guard to check if a string is a valid PermissionPreset
 * @param value - The value to check
 * @returns True if the value is a valid PermissionPreset
 */
function isPermissionPreset(value) {
    return exports.PermissionPresetSchema.safeParse(value).success;
}
/**
 * Permissions configuration schema for ApexConfig
 * Defines the permission preset and optional custom rules for tool access control
 */
exports.PermissionsConfigSchema = zod_1.z.object({
    /**
     * Permission preset to use for tool access control
     * - 'autonomous': All tools allowed without confirmation (full autonomy)
     * - 'review-all': All tools require user confirmation before execution (default)
     * - 'read-only': Only read-only tools allowed (Read, Grep, Glob, WebFetch, WebSearch)
     */
    preset: exports.PermissionPresetSchema.optional().default('review-all'),
    /**
     * Custom per-tool permission rules that override the preset defaults
     * Use this to fine-tune permissions for specific tools while using a preset as the base
     */
    customRules: zod_1.z.array(exports.ToolPermissionRuleSchema).optional().default([]),
});
// ============================================================================
// Policy-as-Code Configuration (v0.5.0)
// ============================================================================
/**
 * Path access mode for policy enforcement
 * - 'allowlist': Only paths matching the patterns are allowed (deny by default)
 * - 'blocklist': Paths matching the patterns are blocked (allow by default)
 */
exports.PathAccessModeSchema = zod_1.z.enum(['allowlist', 'blocklist']);
/**
 * Configuration for allowed filesystem paths in policy-as-code
 * Uses glob patterns to define which paths agents can access
 */
exports.AllowedPathsConfigSchema = zod_1.z.object({
    /**
     * Access control mode
     * - 'allowlist': Only explicitly allowed paths are accessible (default)
     * - 'blocklist': All paths are accessible except explicitly blocked ones
     */
    mode: exports.PathAccessModeSchema.optional().default('allowlist'),
    /**
     * Glob patterns for paths that are allowed
     * Examples: ['src/**', 'tests/**', '*.md', 'package.json']
     * When mode is 'allowlist', only these paths are accessible
     * When mode is 'blocklist', these patterns are ignored
     */
    allow: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Glob patterns for paths that are blocked
     * Examples: ['node_modules/**', '.env*', '**\/*.key', 'secrets/**']
     * These take precedence over allow patterns in allowlist mode
     * When mode is 'blocklist', these paths are blocked
     */
    block: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Sensitive file patterns that always require confirmation
     * Examples: ['.env*', '**\/config.json', '**\/*.secret']
     * Access to these files will prompt for human approval even if otherwise allowed
     */
    sensitivePatterns: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Whether to follow symlinks when validating paths (default: false for security)
     */
    followSymlinks: zod_1.z.boolean().optional().default(false),
    /**
     * Maximum depth for recursive operations (0 = unlimited, default: 10)
     */
    maxDepth: zod_1.z.number().int().min(0).optional().default(10),
});
/**
 * Test requirement enforcement level
 * - 'none': No test requirements enforced
 * - 'warn': Warn when test requirements are not met but allow proceeding
 * - 'require': Block operations when test requirements are not met
 */
exports.TestEnforcementLevelSchema = zod_1.z.enum(['none', 'warn', 'require']);
/**
 * A single test requirement rule
 * Defines when tests are required and what tests should exist
 */
exports.TestRequirementRuleSchema = zod_1.z.object({
    /**
     * Name/identifier for this rule
     */
    name: zod_1.z.string().min(1, 'Rule name is required'),
    /**
     * Description of what this rule enforces
     */
    description: zod_1.z.string().optional(),
    /**
     * Glob patterns for source files that trigger this rule
     * Examples: ['src/**\/*.ts', 'lib/**\/*.js']
     * When any of these files are modified, the rule is evaluated
     */
    sourcePatterns: zod_1.z.array(zod_1.z.string()).min(1, 'At least one source pattern is required'),
    /**
     * Glob patterns for test files that satisfy this rule
     * Examples: ['tests/**\/*.test.ts', '**\/*.spec.js']
     * At least one matching test file must exist for modified source files
     */
    testPatterns: zod_1.z.array(zod_1.z.string()).min(1, 'At least one test pattern is required'),
    /**
     * Naming convention for mapping source files to test files
     * Variables: {filename}, {basename}, {ext}, {dir}
     * Example: '{dir}/__tests__/{basename}.test.ts' means src/utils.ts -> src/__tests__/utils.test.ts
     */
    testNamingConvention: zod_1.z.string().optional(),
    /**
     * Minimum test coverage percentage required (0-100)
     * Set to 0 to disable coverage requirement
     */
    minCoverage: zod_1.z.number().min(0).max(100).optional().default(0),
    /**
     * Enforcement level for this specific rule (overrides global setting)
     */
    enforcement: exports.TestEnforcementLevelSchema.optional(),
    /**
     * Whether tests must pass before changes can be committed
     */
    mustPass: zod_1.z.boolean().optional().default(true),
    /**
     * Whether this rule is enabled (default: true)
     */
    enabled: zod_1.z.boolean().optional().default(true),
    /**
     * Tags for categorizing rules (e.g., 'unit', 'integration', 'e2e')
     */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
/**
 * Configuration for required tests in policy-as-code
 * Defines rules for when and what tests are required
 */
exports.RequiredTestsConfigSchema = zod_1.z.object({
    /**
     * Global enforcement level for test requirements
     * Can be overridden per-rule
     */
    enforcement: exports.TestEnforcementLevelSchema.optional().default('warn'),
    /**
     * Individual test requirement rules
     */
    rules: zod_1.z.array(exports.TestRequirementRuleSchema).optional().default([]),
    /**
     * Command to run tests (defaults to project.testCommand or 'npm test')
     */
    testCommand: zod_1.z.string().optional(),
    /**
     * Command to generate coverage report
     */
    coverageCommand: zod_1.z.string().optional(),
    /**
     * Path to coverage report file (for parsing coverage data)
     */
    coverageReportPath: zod_1.z.string().optional(),
    /**
     * File patterns to exclude from test requirements
     * Examples: ['**\/*.d.ts', '**\/index.ts', 'types/**']
     */
    excludePatterns: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Whether to block commits when test requirements are not met
     * Only applies when enforcement is 'require'
     */
    blockOnFailure: zod_1.z.boolean().optional().default(true),
});
/**
 * Condition type for approval rules
 * - 'file-pattern': Triggered by file path patterns
 * - 'content-pattern': Triggered by content/code patterns (regex)
 * - 'operation': Triggered by specific operations (e.g., 'delete', 'create')
 * - 'cost-threshold': Triggered when estimated cost exceeds threshold
 * - 'token-threshold': Triggered when token usage exceeds threshold
 * - 'custom': Custom expression-based condition
 */
exports.ApprovalConditionTypeSchema = zod_1.z.enum([
    'file-pattern',
    'content-pattern',
    'operation',
    'cost-threshold',
    'token-threshold',
    'custom',
]);
/**
 * Operation types that can trigger approval
 */
exports.ApprovalOperationTypeSchema = zod_1.z.enum([
    'create',
    'modify',
    'delete',
    'execute',
    'deploy',
    'commit',
    'push',
    'merge',
]);
/**
 * A single approval condition that triggers human review
 */
exports.ApprovalConditionSchema = zod_1.z.object({
    /**
     * Type of condition
     */
    type: exports.ApprovalConditionTypeSchema,
    /**
     * Description of what this condition checks for
     */
    description: zod_1.z.string().optional(),
    /**
     * Patterns to match (interpretation depends on type)
     * - file-pattern: Glob patterns for file paths
     * - content-pattern: Regex patterns for file content
     * - operation: Not used (use 'operations' field instead)
     * - cost-threshold: Not used (use 'threshold' field instead)
     * - token-threshold: Not used (use 'threshold' field instead)
     * - custom: Not used (use 'expression' field instead)
     */
    patterns: zod_1.z.array(zod_1.z.string()).optional(),
    /**
     * Operations that trigger this condition (for 'operation' type)
     */
    operations: zod_1.z.array(exports.ApprovalOperationTypeSchema).optional(),
    /**
     * Numeric threshold value (for threshold-based conditions)
     * - cost-threshold: Maximum cost in USD before requiring approval
     * - token-threshold: Maximum tokens before requiring approval
     */
    threshold: zod_1.z.number().min(0).optional(),
    /**
     * Custom expression for evaluation (for 'custom' type)
     * Can reference variables like: {cost}, {tokens}, {files}, {operation}
     */
    expression: zod_1.z.string().optional(),
});
/**
 * Approval urgency level affecting timeout behavior
 * - 'low': Long timeout (24h), can be auto-approved
 * - 'normal': Standard timeout (1h)
 * - 'high': Short timeout (15m), must be reviewed promptly
 * - 'critical': Very short timeout (5m), blocks everything until resolved
 */
exports.ApprovalUrgencySchema = zod_1.z.enum(['low', 'normal', 'high', 'critical']);
/**
 * A single approval rule defining when human approval is required
 */
exports.ApprovalRuleSchema = zod_1.z.object({
    /**
     * Unique identifier for this rule
     */
    id: zod_1.z.string().min(1, 'Rule ID is required'),
    /**
     * Human-readable name for this rule
     */
    name: zod_1.z.string().min(1, 'Rule name is required'),
    /**
     * Description of what this rule protects and why approval is needed
     */
    description: zod_1.z.string().optional(),
    /**
     * Whether this rule is enabled (default: true)
     */
    enabled: zod_1.z.boolean().optional().default(true),
    /**
     * Conditions that trigger this approval rule (ANY match triggers)
     * Use multiple conditions to create OR logic
     */
    conditions: zod_1.z.array(exports.ApprovalConditionSchema).min(1, 'At least one condition is required'),
    /**
     * Whether ALL conditions must match (default: false = ANY condition triggers)
     */
    requireAllConditions: zod_1.z.boolean().optional().default(false),
    /**
     * Urgency level affecting timeout and notification behavior
     */
    urgency: exports.ApprovalUrgencySchema.optional().default('normal'),
    /**
     * Specific approvers required (usernames, emails, or roles)
     * If empty, any authorized user can approve
     */
    approvers: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Minimum number of approvals required (default: 1)
     */
    minApprovals: zod_1.z.number().int().min(1).optional().default(1),
    /**
     * Timeout in minutes before the request expires
     * Default varies by urgency: low=1440, normal=60, high=15, critical=5
     */
    timeoutMinutes: zod_1.z.number().int().min(1).optional(),
    /**
     * Action to take on timeout
     * - 'reject': Reject the operation (default for high/critical)
     * - 'approve': Auto-approve (only for 'low' urgency)
     * - 'escalate': Escalate to higher authority
     */
    timeoutAction: zod_1.z.enum(['reject', 'approve', 'escalate']).optional().default('reject'),
    /**
     * Message template shown to approvers
     * Can use variables: {operation}, {files}, {cost}, {agent}, {task}
     */
    messageTemplate: zod_1.z.string().optional(),
    /**
     * Tags for categorizing and filtering rules
     */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Priority when multiple rules match (higher = evaluated first)
     */
    priority: zod_1.z.number().int().min(0).optional().default(0),
});
/**
 * Configuration for approval rules in policy-as-code
 * Defines conditions that require human approval before proceeding
 */
exports.ApprovalRulesConfigSchema = zod_1.z.object({
    /**
     * Whether approval rules are enabled (default: true)
     */
    enabled: zod_1.z.boolean().optional().default(true),
    /**
     * Individual approval rules
     */
    rules: zod_1.z.array(exports.ApprovalRuleSchema).optional().default([]),
    /**
     * Default timeout in minutes for rules without explicit timeout
     */
    defaultTimeoutMinutes: zod_1.z.number().int().min(1).optional().default(60),
    /**
     * Default action when approval request times out
     */
    defaultTimeoutAction: zod_1.z.enum(['reject', 'approve', 'escalate']).optional().default('reject'),
    /**
     * Global approvers who can approve any request
     */
    globalApprovers: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Whether to send notifications for approval requests
     */
    notificationsEnabled: zod_1.z.boolean().optional().default(true),
    /**
     * Notification channels configuration
     */
    notificationChannels: zod_1.z.object({
        /** Slack webhook URL for notifications */
        slack: zod_1.z.string().optional(),
        /** Email addresses for notifications */
        email: zod_1.z.array(zod_1.z.string()).optional(),
        /** Custom webhook URL for notifications */
        webhook: zod_1.z.string().optional(),
    }).optional(),
    /**
     * Whether to log all approval decisions for audit
     */
    auditLog: zod_1.z.boolean().optional().default(true),
    /**
     * Path to store audit logs (relative to .apex directory)
     */
    auditLogPath: zod_1.z.string().optional().default('approval-audit.log'),
});
/**
 * Policy enforcement mode
 * - 'strict': All policy violations block operations
 * - 'warn': Policy violations generate warnings but don't block
 * - 'audit': Policy violations are logged but operations proceed silently
 * - 'disabled': Policy checks are disabled
 */
exports.PolicyEnforcementModeSchema = zod_1.z.enum(['strict', 'warn', 'audit', 'disabled']);
/**
 * Complete policy-as-code configuration
 * Combines allowed paths, required tests, and approval rules for comprehensive policy control
 */
exports.PolicyConfigSchema = zod_1.z.object({
    /**
     * Schema version for policy configuration (for migration support)
     */
    version: zod_1.z.string().optional().default('1.0'),
    /**
     * Human-readable name for this policy
     */
    name: zod_1.z.string().optional(),
    /**
     * Description of what this policy enforces
     */
    description: zod_1.z.string().optional(),
    /**
     * Global enforcement mode for all policy rules
     */
    enforcement: exports.PolicyEnforcementModeSchema.optional().default('warn'),
    /**
     * Filesystem path access control configuration
     * Controls which paths agents can read from and write to
     */
    allowedPaths: exports.AllowedPathsConfigSchema.optional(),
    /**
     * Required tests configuration
     * Ensures code changes have corresponding tests
     */
    requiredTests: exports.RequiredTestsConfigSchema.optional(),
    /**
     * Approval rules configuration
     * Defines conditions that require human approval
     */
    approvalRules: exports.ApprovalRulesConfigSchema.optional(),
    /**
     * Whether this policy is enabled (default: true)
     */
    enabled: zod_1.z.boolean().optional().default(true),
    /**
     * Tags for categorizing policies
     */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /**
     * Custom metadata for extensibility
     */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// ============================================================================
// Policy Types - Core Domain Types
// ============================================================================
/**
 * Severity level schema for policy rules and violations
 */
exports.PolicySeveritySchema = zod_1.z.enum(['low', 'medium', 'high', 'critical']);
/**
 * Base policy rule definition with condition, action, and severity
 */
exports.PolicyRuleSchema = zod_1.z.object({
    /** Unique identifier for this rule */
    id: zod_1.z.string(),
    /** Human-readable name for this rule */
    name: zod_1.z.string(),
    /** Description of what this rule enforces */
    description: zod_1.z.string().optional(),
    /** Condition that triggers this rule (as a string expression or pattern) */
    condition: zod_1.z.string(),
    /** Action to take when condition is met */
    action: zod_1.z.enum(['allow', 'deny', 'warn', 'require_approval']),
    /** Severity level of this rule */
    severity: exports.PolicySeveritySchema,
    /** Whether this rule is enabled */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Enforcement mode for this specific rule */
    enforcement: exports.PolicyEnforcementModeSchema.optional(),
    /** Tags for categorizing this rule */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Custom metadata for this rule */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Path policy rule for filesystem access control
 */
exports.PathPolicySchema = exports.PolicyRuleSchema.extend({
    /** Type discriminator */
    type: zod_1.z.literal('path'),
    /** Path configuration for this rule */
    config: exports.AllowedPathsConfigSchema,
});
/**
 * Test policy rule for test requirements
 */
exports.TestPolicySchema = exports.PolicyRuleSchema.extend({
    /** Type discriminator */
    type: zod_1.z.literal('test'),
    /** Test configuration for this rule */
    config: exports.RequiredTestsConfigSchema,
});
/**
 * Approval policy rule for human approval requirements
 */
exports.ApprovalPolicySchema = exports.PolicyRuleSchema.extend({
    /** Type discriminator */
    type: zod_1.z.literal('approval'),
    /** Approval configuration for this rule */
    config: exports.ApprovalRulesConfigSchema,
});
/**
 * Policy definition with id, name, rules, and severity levels
 */
exports.PolicySchema = zod_1.z.object({
    /** Unique identifier for this policy */
    id: zod_1.z.string(),
    /** Human-readable name for this policy */
    name: zod_1.z.string(),
    /** Description of what this policy enforces */
    description: zod_1.z.string().optional(),
    /** Array of policy rules that define the policy behavior */
    rules: zod_1.z.array(exports.PolicyRuleSchema),
    /** Severity levels configuration for this policy */
    severityLevels: zod_1.z.object({
        /** Default severity for violations */
        default: exports.PolicySeveritySchema,
        /** Override severity levels for specific rule types */
        overrides: zod_1.z.record(zod_1.z.string(), exports.PolicySeveritySchema).optional(),
    }).optional(),
    /** Whether this policy is enabled */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Global enforcement mode for this policy */
    enforcement: exports.PolicyEnforcementModeSchema.optional().default('warn'),
    /** Version of this policy for change tracking */
    version: zod_1.z.string().optional(),
    /** Tags for categorizing this policy */
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Metadata for this policy */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Timestamp when policy was created */
    createdAt: zod_1.z.date().optional(),
    /** Timestamp when policy was last updated */
    updatedAt: zod_1.z.date().optional(),
});
/**
 * Legacy policy types for backward compatibility
 * Union type for all policy rule types
 */
exports.LegacyPolicySchema = zod_1.z.discriminatedUnion('type', [
    exports.PathPolicySchema,
    exports.TestPolicySchema,
    exports.ApprovalPolicySchema,
]);
/**
 * Policy violation details
 */
exports.PolicyViolationSchema = zod_1.z.object({
    /** Unique identifier for this violation */
    id: zod_1.z.string(),
    /** The policy rule that was violated */
    rule: zod_1.z.string(),
    /** Human-readable message describing the violation */
    message: zod_1.z.string(),
    /** Severity of the violation */
    severity: exports.PolicySeveritySchema,
    /** Whether this violation blocks further execution */
    blocking: zod_1.z.boolean(),
    /** Type of policy that was violated */
    policyType: zod_1.z.enum(['path', 'test', 'approval']).optional(),
    /** Detailed description of the violation */
    description: zod_1.z.string().optional(),
    /** Resource or context that triggered the violation */
    resource: zod_1.z.string().optional(),
    /** Additional context about the violation */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Timestamp when the violation occurred */
    timestamp: zod_1.z.date(),
    /** Whether this violation was resolved */
    resolved: zod_1.z.boolean().optional().default(false),
    /** Timestamp when the violation was resolved */
    resolvedAt: zod_1.z.date().optional(),
    /** How the violation was resolved */
    resolution: zod_1.z.string().optional(),
});
/**
 * Policy validation result with passed status and violations array
 */
exports.PolicyValidationResultSchema = zod_1.z.object({
    /** Whether the validation passed overall */
    passed: zod_1.z.boolean(),
    /** Array of policy violations found during validation */
    violations: zod_1.z.array(exports.PolicyViolationSchema),
    /** Timestamp when validation was performed */
    validatedAt: zod_1.z.date().optional(),
    /** Additional context about the validation */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Policy violation event for real-time notifications
 */
exports.PolicyViolationEventSchema = zod_1.z.object({
    /** Event type */
    type: zod_1.z.literal('policy_violation'),
    /** Event ID */
    id: zod_1.z.string(),
    /** Timestamp when the event occurred */
    timestamp: zod_1.z.date(),
    /** The policy violation that triggered this event */
    violation: exports.PolicyViolationSchema,
    /** Task ID associated with this violation */
    taskId: zod_1.z.string().optional(),
    /** Agent ID that triggered this violation */
    agentId: zod_1.z.string().optional(),
    /** Workflow ID associated with this violation */
    workflowId: zod_1.z.string().optional(),
    /** Additional event metadata */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Task-level policy check result
 * Captures the outcome of policy evaluation for a task
 */
exports.TaskPolicyCheckResultSchema = zod_1.z.object({
    /** Whether the policy check passed overall */
    passed: zod_1.z.boolean(),
    /** Whether the task was blocked due to policy violations */
    blocked: zod_1.z.boolean(),
    /** Number of violations found */
    violationCount: zod_1.z.number().int().min(0),
    /** List of policy violations */
    violations: zod_1.z.array(exports.PolicyViolationSchema),
    /** Timestamp when the policy check was performed */
    checkedAt: zod_1.z.date(),
    /** Policy name/configuration used */
    policyName: zod_1.z.string().optional(),
    /** Enforcement mode that was applied */
    enforcementMode: exports.PolicyEnforcementModeSchema.optional(),
});
// ============================================================================
// Policy Engine Types (v0.5.0)
// ============================================================================
/**
 * Policy check decision status
 * - 'allow': The policy check passed and the action is permitted
 * - 'deny': The policy check failed and the action is blocked
 *
 * @remarks
 * This is the primary decision outcome from a policy check.
 * Unlike boolean passed/blocked fields, this provides a clear semantic status.
 */
exports.PolicyCheckStatusSchema = zod_1.z.enum(['allow', 'deny']);
/**
 * Result of a policy check operation.
 * Contains the allow/deny decision, any violations found, and the enforcement mode applied.
 *
 * @remarks
 * This is the standard result type returned by the PolicyEngine.checkPolicy() method.
 * It provides a complete picture of the policy evaluation including:
 * - The final decision (allow/deny)
 * - All violations that were detected
 * - The enforcement mode that was applied
 * - Optional metadata for debugging and auditing
 *
 * @example
 * ```typescript
 * const result: PolicyCheckResult = {
 *   status: 'deny',
 *   violations: [{
 *     id: 'v-123',
 *     rule: 'no-secrets-in-code',
 *     message: 'API key detected in source file',
 *     severity: 'critical',
 *     blocking: true,
 *     timestamp: new Date(),
 *   }],
 *   enforcementMode: 'strict',
 *   checkedAt: new Date(),
 * };
 * ```
 */
exports.PolicyCheckResultSchema = zod_1.z.object({
    /** The policy check decision: allow or deny */
    status: exports.PolicyCheckStatusSchema,
    /** Array of policy violations detected during the check */
    violations: zod_1.z.array(exports.PolicyViolationSchema),
    /** The enforcement mode that was applied during this check */
    enforcementMode: exports.PolicyEnforcementModeSchema,
    /** Timestamp when the policy check was performed */
    checkedAt: zod_1.z.date(),
    /** Name of the policy or policy set that was evaluated */
    policyName: zod_1.z.string().optional(),
    /** ID of the policy or policy set that was evaluated */
    policyId: zod_1.z.string().optional(),
    /** Number of rules evaluated */
    rulesEvaluated: zod_1.z.number().int().min(0).optional(),
    /** Number of rules that passed */
    rulesPassed: zod_1.z.number().int().min(0).optional(),
    /** Number of rules that failed */
    rulesFailed: zod_1.z.number().int().min(0).optional(),
    /** Duration of the policy check in milliseconds */
    durationMs: zod_1.z.number().int().min(0).optional(),
    /** Additional context or metadata about the check */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Context provided to the policy engine for evaluation.
 * Contains all relevant information about the action being checked.
 *
 * @remarks
 * This context object provides the PolicyEngine with everything it needs
 * to evaluate policies against a specific action or request.
 */
exports.PolicyCheckContextSchema = zod_1.z.object({
    /** The action being performed (e.g., 'file_write', 'command_execute', 'api_call') */
    action: zod_1.z.string(),
    /** Resource being accessed (e.g., file path, API endpoint, command) */
    resource: zod_1.z.string().optional(),
    /** Agent performing the action */
    agentId: zod_1.z.string().optional(),
    /** Task context */
    taskId: zod_1.z.string().optional(),
    /** Workflow stage */
    stage: zod_1.z.string().optional(),
    /** Tool being used */
    toolName: zod_1.z.string().optional(),
    /** Tool arguments */
    toolArguments: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** File paths involved in the action */
    filePaths: zod_1.z.array(zod_1.z.string()).optional(),
    /** Content being written or modified (for content scanning) */
    content: zod_1.z.string().optional(),
    /** User or session identifier */
    userId: zod_1.z.string().optional(),
    /** Additional context data */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Options for policy check operations
 */
exports.PolicyCheckOptionsSchema = zod_1.z.object({
    /** Override the default enforcement mode for this check */
    enforcementMode: exports.PolicyEnforcementModeSchema.optional(),
    /** Specific policy IDs to evaluate (if not specified, all applicable policies are checked) */
    policyIds: zod_1.z.array(zod_1.z.string()).optional(),
    /** Whether to continue checking after first violation (default: true) */
    continueOnViolation: zod_1.z.boolean().optional().default(true),
    /** Maximum violations to report (0 = unlimited) */
    maxViolations: zod_1.z.number().int().min(0).optional().default(0),
    /** Whether to include non-blocking violations in the result */
    includeWarnings: zod_1.z.boolean().optional().default(true),
    /** Timeout for policy evaluation in milliseconds */
    timeoutMs: zod_1.z.number().int().min(0).optional(),
});
// ============================================================================
// Guardrails System Types
// ============================================================================
/**
 * Enforcement mode for guardrails (simplified from PolicyEnforcementMode).
 * - 'warn': Violations generate warnings but don't block operations
 * - 'block': Violations block operations immediately
 * - 'audit': Violations are logged for analysis but operations proceed
 *
 * @remarks
 * This is the recommended enforcement mode schema for guardrails.
 * For backward compatibility, PolicyEnforcementModeSchema is also available.
 */
exports.EnforcementModeSchema = zod_1.z.enum(['warn', 'block', 'audit']);
/**
 * Individual secret detection result.
 * Represents a single detected secret in content.
 *
 * @remarks
 * This schema captures the result of scanning content for secrets.
 * It includes information about what was detected, where it was found,
 * and the severity of the finding.
 */
exports.SecretDetectionSchema = zod_1.z.object({
    /** Unique identifier for this detection */
    id: zod_1.z.string(),
    /** The pattern that matched (from SecretPattern) */
    patternName: zod_1.z.string(),
    /** Type of secret detected (e.g., 'api_key', 'password', 'token') */
    secretType: zod_1.z.string(),
    /** Severity of the finding */
    severity: zod_1.z.enum(['critical', 'high', 'medium', 'low']),
    /** File path where the secret was detected (if applicable) */
    filePath: zod_1.z.string().optional(),
    /** Line number where the secret was found (1-based) */
    lineNumber: zod_1.z.number().int().positive().optional(),
    /** Column number where the secret starts (1-based) */
    columnNumber: zod_1.z.number().int().positive().optional(),
    /** The matched content (masked for security) */
    maskedMatch: zod_1.z.string(),
    /** Context around the detection (with secret masked) */
    context: zod_1.z.string().optional(),
    /** Timestamp when the detection occurred */
    detectedAt: zod_1.z.date(),
    /** Whether this detection has been acknowledged/resolved */
    acknowledged: zod_1.z.boolean().optional().default(false),
    /** Reason for acknowledgment (if acknowledged) */
    acknowledgmentReason: zod_1.z.string().optional(),
});
/**
 * Result of a secret scan operation.
 * Aggregates all detections from scanning content.
 */
exports.SecretScanResultSchema = zod_1.z.object({
    /** Whether any secrets were detected */
    hasSecrets: zod_1.z.boolean(),
    /** Number of secrets detected */
    count: zod_1.z.number().int().min(0),
    /** List of individual detections */
    detections: zod_1.z.array(exports.SecretDetectionSchema),
    /** Content that was scanned (identifier or description) */
    scannedContent: zod_1.z.string().optional(),
    /** Timestamp when the scan was performed */
    scannedAt: zod_1.z.date(),
    /** Duration of the scan in milliseconds */
    scanDurationMs: zod_1.z.number().optional(),
});
/**
 * Unified guardrails configuration schema.
 * Brings together all guardrail-related settings including policies,
 * secret scanning, and enforcement modes.
 *
 * @remarks
 * This is the top-level configuration for the guardrails system.
 * It can be included in the main ApexConfig to enable guardrails.
 *
 * @example
 * ```yaml
 * # .apex/config.yaml
 * guardrails:
 *   enabled: true
 *   enforcement: warn
 *   policies:
 *     enabled: true
 *     enforcement: warn
 *   secrets:
 *     enabled: true
 *     enforcement: block
 *     onDetection: mask
 *   reporting:
 *     enabled: true
 *     format: json
 * ```
 */
exports.GuardrailConfigSchema = zod_1.z.object({
    /** Whether guardrails are enabled globally */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Global enforcement mode for all guardrails */
    enforcement: exports.EnforcementModeSchema.optional().default('warn'),
    /**
     * Policy enforcement configuration
     */
    policies: zod_1.z.object({
        /** Whether policy enforcement is enabled */
        enabled: zod_1.z.boolean().optional().default(true),
        /** Enforcement mode for policy violations */
        enforcement: exports.EnforcementModeSchema.optional(),
        /** Path to policy files or directory */
        policyPath: zod_1.z.string().optional(),
        /** Inline policy rules */
        rules: zod_1.z.array(exports.PolicyRuleSchema).optional().default([]),
    }).optional(),
    /**
     * Secret detection configuration
     */
    secrets: zod_1.z.object({
        /** Whether secret detection is enabled */
        enabled: zod_1.z.boolean().optional().default(true),
        /** Enforcement mode for secret detections */
        enforcement: exports.EnforcementModeSchema.optional(),
        /** Behavior when secrets are detected */
        onDetection: exports.SecretDetectionBehaviorSchema.optional().default('warn'),
        /** Include built-in secret patterns */
        includeBuiltInPatterns: zod_1.z.boolean().optional().default(true),
        /** Custom secret patterns to detect */
        customPatterns: zod_1.z.array(exports.SecretPatternSchema).optional().default([]),
        /** Paths to exclude from secret scanning */
        excludePaths: zod_1.z.array(zod_1.z.string()).optional().default([]),
        /** File patterns to exclude from scanning */
        excludePatterns: zod_1.z.array(zod_1.z.string()).optional().default([]),
    }).optional(),
    /**
     * Reporting configuration for guardrail violations
     */
    reporting: zod_1.z.object({
        /** Whether reporting is enabled */
        enabled: zod_1.z.boolean().optional().default(true),
        /** Report format */
        format: zod_1.z.enum(['json', 'text', 'sarif']).optional().default('json'),
        /** Output path for reports */
        outputPath: zod_1.z.string().optional(),
        /** Whether to include context in reports */
        includeContext: zod_1.z.boolean().optional().default(true),
        /** Maximum violations to include in report */
        maxViolations: zod_1.z.number().int().positive().optional(),
    }).optional(),
    /**
     * Path access control configuration
     */
    pathAccess: zod_1.z.object({
        /** Whether path access control is enabled */
        enabled: zod_1.z.boolean().optional().default(true),
        /** Enforcement mode for path access violations */
        enforcement: exports.EnforcementModeSchema.optional(),
        /** Allowed paths configuration */
        config: exports.AllowedPathsConfigSchema.optional(),
    }).optional(),
    /**
     * Custom metadata for guardrails
     */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Guardrail violation event (extends policy violation with guardrail context)
 */
exports.GuardrailViolationSchema = zod_1.z.object({
    /** Unique identifier for this violation */
    id: zod_1.z.string(),
    /** Type of guardrail that was violated */
    guardrailType: zod_1.z.enum(['policy', 'secret', 'path', 'custom']),
    /** The specific rule or pattern that was violated */
    rule: zod_1.z.string(),
    /** Human-readable message describing the violation */
    message: zod_1.z.string(),
    /** Severity of the violation */
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']),
    /** Enforcement mode that applies to this violation */
    enforcement: exports.EnforcementModeSchema,
    /** Whether this violation blocks further execution */
    blocking: zod_1.z.boolean(),
    /** Resource or context that triggered the violation */
    resource: zod_1.z.string().optional(),
    /** File path associated with the violation */
    filePath: zod_1.z.string().optional(),
    /** Line number where the violation occurred */
    lineNumber: zod_1.z.number().int().positive().optional(),
    /** Additional context about the violation */
    context: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Timestamp when the violation occurred */
    timestamp: zod_1.z.date(),
    /** Task ID associated with this violation */
    taskId: zod_1.z.string().optional(),
    /** Agent ID that triggered this violation */
    agentId: zod_1.z.string().optional(),
});
/**
 * Result of guardrail evaluation
 */
exports.GuardrailEvaluationResultSchema = zod_1.z.object({
    /** Whether the evaluation passed (no blocking violations) */
    passed: zod_1.z.boolean(),
    /** Whether execution was blocked */
    blocked: zod_1.z.boolean(),
    /** Total number of violations */
    violationCount: zod_1.z.number().int().min(0),
    /** Violations by severity */
    violationsBySeverity: zod_1.z.object({
        critical: zod_1.z.number().int().min(0),
        high: zod_1.z.number().int().min(0),
        medium: zod_1.z.number().int().min(0),
        low: zod_1.z.number().int().min(0),
    }),
    /** List of all violations */
    violations: zod_1.z.array(exports.GuardrailViolationSchema),
    /** Secret scan results (if applicable) */
    secretScanResult: exports.SecretScanResultSchema.optional(),
    /** Policy check result (if applicable) */
    policyCheckResult: exports.TaskPolicyCheckResultSchema.optional(),
    /** Timestamp when evaluation was performed */
    evaluatedAt: zod_1.z.date(),
    /** Duration of evaluation in milliseconds */
    evaluationDurationMs: zod_1.z.number().optional(),
});
// ============================================================================
// Hook Configuration
// ============================================================================
/**
 * Hook types that define when hooks are triggered
 */
exports.HookTypeSchema = zod_1.z.enum([
    'before-task', // Triggered before a task starts
    'after-task', // Triggered after a task completes
    'before-stage', // Triggered before a workflow stage starts
    'after-stage', // Triggered after a workflow stage completes
    'before-commit', // Triggered before code is committed
    'after-commit', // Triggered after code is committed
    'before-push', // Triggered before code is pushed
    'after-push', // Triggered after code is pushed
    'on-error', // Triggered when an error occurs
    'on-success', // Triggered on successful completion
]);
/**
 * Hook handler configuration
 * Can be either a file path or inline code
 */
exports.HookHandlerSchema = zod_1.z.union([
    // File path to script
    zod_1.z.object({
        type: zod_1.z.literal('file'),
        path: zod_1.z.string().min(1, 'Handler file path is required'),
        args: zod_1.z.array(zod_1.z.string()).optional(),
    }),
    // Inline script content
    zod_1.z.object({
        type: zod_1.z.literal('inline'),
        code: zod_1.z.string().min(1, 'Handler code is required'),
        language: zod_1.z.enum(['bash', 'javascript', 'typescript']).optional().default('bash'),
    }),
]);
/**
 * Hook configuration schema
 * Defines when and how hooks are executed
 */
exports.HookConfigSchema = zod_1.z.object({
    /** Unique name for the hook */
    name: zod_1.z.string().min(1, 'Hook name is required'),
    /** Hook type defining when it's triggered */
    type: exports.HookTypeSchema,
    /** Hook handler configuration */
    handler: exports.HookHandlerSchema,
    /** Priority for hook execution order (higher = earlier) */
    priority: zod_1.z.number().int().optional().default(100),
    /** Whether this hook is enabled */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Optional description of what this hook does */
    description: zod_1.z.string().optional(),
    /** Optional conditions for hook execution */
    conditions: zod_1.z.object({
        /** Only run for specific workflow stages */
        stages: zod_1.z.array(zod_1.z.string()).optional(),
        /** Only run for specific agents */
        agents: zod_1.z.array(zod_1.z.string()).optional(),
        /** Only run for specific file patterns */
        filePatterns: zod_1.z.array(zod_1.z.string()).optional(),
        /** Environment variables that must be set */
        env: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    }).optional(),
    /** Hook timeout in milliseconds */
    timeoutMs: zod_1.z.number().int().min(1000).optional().default(30000),
    /** Whether hook failure should fail the operation */
    failOnError: zod_1.z.boolean().optional().default(true),
});
// ============================================================================
// Tool Hook Configuration (v0.5.0)
// ============================================================================
// Tool hooks are triggered before (pre) and after (post) tool executions,
// allowing interception, modification, or cancellation of tool calls.
/**
 * Tool hook type enum - defines when the hook is triggered relative to tool execution
 * - 'pre': Triggered before a tool executes, can modify arguments or cancel
 * - 'post': Triggered after a tool executes, receives the result
 */
exports.ToolHookTypeSchema = zod_1.z.enum([
    'pre', // Before tool execution - can modify args or cancel
    'post', // After tool execution - receives result
]);
/**
 * Tool hook definition schema
 * Defines a hook that runs before or after tool execution
 */
exports.ToolHookDefinitionSchema = zod_1.z.object({
    /** Unique name for this hook */
    name: zod_1.z.string().min(1, 'Hook name is required'),
    /** Whether this is a pre or post execution hook */
    type: exports.ToolHookTypeSchema,
    /** Path to the handler module/script */
    handlerPath: zod_1.z.string().min(1, 'Handler path is required'),
    /** Priority for hook execution order (higher = earlier, default: 100) */
    priority: zod_1.z.number().int().optional().default(100),
    /** Whether this hook is enabled (default: true) */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Optional description of what this hook does */
    description: zod_1.z.string().optional(),
    /** Tool names this hook applies to (empty = all tools) */
    tools: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Hook timeout in milliseconds (default: 30000) */
    timeoutMs: zod_1.z.number().int().min(100).optional().default(30000),
    /** Whether hook failure should fail the tool execution (default: true for pre, false for post) */
    failOnError: zod_1.z.boolean().optional(),
});
/**
 * Tool hook configuration for config.yaml
 * Contains arrays of pre and post tool hooks
 */
exports.ToolHookConfigSchema = zod_1.z.object({
    /** Pre-execution hooks that run before tools */
    pre: zod_1.z.array(exports.ToolHookDefinitionSchema).optional().default([]),
    /** Post-execution hooks that run after tools */
    post: zod_1.z.array(exports.ToolHookDefinitionSchema).optional().default([]),
    /** Global setting to enable/disable all tool hooks */
    enabled: zod_1.z.boolean().optional().default(true),
    /** Default timeout for all hooks in milliseconds */
    defaultTimeoutMs: zod_1.z.number().int().min(100).optional().default(30000),
});
/**
 * Context provided to pre-execution hooks
 * Contains information available before tool execution
 */
exports.PreHookContextSchema = zod_1.z.object({
    /** Name of the tool being invoked */
    toolName: zod_1.z.string(),
    /** Arguments being passed to the tool */
    arguments: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Unique identifier for this tool invocation */
    invocationId: zod_1.z.string(),
    /** Task ID that initiated this tool call (if any) */
    taskId: zod_1.z.string().optional(),
    /** Agent name that is invoking the tool (if any) */
    agentName: zod_1.z.string().optional(),
    /** Workflow stage when tool was invoked (if any) */
    stageName: zod_1.z.string().optional(),
    /** Timestamp when the tool invocation was requested */
    timestamp: zod_1.z.date(),
});
/**
 * Context provided to post-execution hooks
 * Contains information available after tool execution including the result
 */
exports.PostHookContextSchema = zod_1.z.object({
    /** Name of the tool that was invoked */
    toolName: zod_1.z.string(),
    /** Arguments that were passed to the tool */
    arguments: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Unique identifier for this tool invocation */
    invocationId: zod_1.z.string(),
    /** Task ID that initiated this tool call (if any) */
    taskId: zod_1.z.string().optional(),
    /** Agent name that invoked the tool (if any) */
    agentName: zod_1.z.string().optional(),
    /** Workflow stage when tool was invoked (if any) */
    stageName: zod_1.z.string().optional(),
    /** Timestamp when the tool invocation was requested */
    timestamp: zod_1.z.date(),
    /** Result from the tool execution */
    result: zod_1.z.object({
        /** Whether the tool execution was successful */
        success: zod_1.z.boolean(),
        /** Output data from the tool (if successful) */
        output: zod_1.z.unknown().optional(),
        /** Error message (if failed) */
        error: zod_1.z.string().optional(),
        /** Execution duration in milliseconds */
        duration: zod_1.z.number().optional(),
    }),
});
/**
 * Pre-hook action type - what action the hook wants to take
 * - 'continue': Proceed with tool execution using original or modified arguments
 * - 'modify': Proceed with tool execution using modified arguments (requires modifiedArguments)
 * - 'cancel': Cancel the tool execution entirely
 */
exports.PreHookActionSchema = zod_1.z.enum([
    'continue', // Proceed with original arguments
    'modify', // Proceed with modified arguments
    'cancel', // Cancel tool execution
]);
/**
 * Result returned from a pre-execution hook
 * Determines whether and how tool execution should proceed
 */
exports.PreHookResultSchema = zod_1.z.object({
    /** Action to take after hook execution */
    action: exports.PreHookActionSchema,
    /** Modified arguments when action is 'modify' */
    modifiedArguments: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Reason for the action (especially useful for 'cancel') */
    reason: zod_1.z.string().optional(),
    /** Custom result to return when action is 'cancel' */
    cancelResult: zod_1.z.object({
        success: zod_1.z.boolean(),
        output: zod_1.z.unknown().optional(),
        error: zod_1.z.string().optional(),
    }).optional(),
    /** Additional metadata from the hook */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Behavior mode for configurable tool hook actions
 * - 'warn': Emit event and pass output through unchanged
 * - 'block': Emit event and block/return error
 * - 'redact': Replace sensitive content with [REDACTED] placeholders
 */
exports.BehaviorModeSchema = zod_1.z.enum([
    'warn', // Emit event, pass through unchanged
    'block', // Emit event, block output with error
    'redact', // Replace secrets with [REDACTED]
]);
/**
 * Event data for behavior mode actions
 * Emitted when warn, block, or redact behaviors are triggered
 */
exports.BehaviorEventDataSchema = zod_1.z.object({
    /** Type of behavior that was triggered */
    behaviorMode: exports.BehaviorModeSchema,
    /** Tool name that triggered the behavior */
    toolName: zod_1.z.string(),
    /** Reason why the behavior was triggered */
    reason: zod_1.z.string(),
    /** Original tool output (may be redacted for security) */
    originalOutput: zod_1.z.unknown().optional(),
    /** Modified output (for redact mode) */
    modifiedOutput: zod_1.z.unknown().optional(),
    /** Timestamp when behavior was triggered */
    timestamp: zod_1.z.date(),
    /** Task ID associated with this behavior */
    taskId: zod_1.z.string().optional(),
    /** Additional context or metadata */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Result returned from a post-execution hook
 * Can optionally modify the result before it's returned
 */
exports.PostHookResultSchema = zod_1.z.object({
    /** Whether to modify the original result */
    modifyResult: zod_1.z.boolean().optional().default(false),
    /** Modified result (if modifyResult is true) */
    modifiedResult: zod_1.z.object({
        success: zod_1.z.boolean(),
        output: zod_1.z.unknown().optional(),
        error: zod_1.z.string().optional(),
    }).optional(),
    /** Behavior mode to apply to the result */
    behaviorMode: exports.BehaviorModeSchema.optional(),
    /** Reason for applying behavior mode */
    behaviorReason: zod_1.z.string().optional(),
    /** Additional metadata from the hook */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// ============================================================================
// Error Tracking and Fix Attempts (v0.5.0)
// ============================================================================
/**
 * Backoff strategy for retry delays
 */
exports.BackoffStrategySchema = zod_1.z.enum([
    'none', // No delay between attempts
    'constant', // Fixed delay (e.g., 5s every time)
    'linear', // Linearly increasing delay (e.g., 5s, 10s, 15s)
    'exponential', // Exponentially increasing delay (e.g., 5s, 10s, 20s, 40s)
]);
/**
 * Configuration for fix attempt tracking
 */
exports.FixAttemptConfigSchema = zod_1.z.object({
    /** Maximum attempts per unique error (default: 3) */
    maxAttemptsPerError: zod_1.z.number().min(1).max(20).default(3),
    /** Maximum total fix attempts per task (default: 10) */
    maxTotalAttempts: zod_1.z.number().min(1).max(100).default(10),
    /** Backoff strategy for retries (default: 'exponential') */
    backoffStrategy: exports.BackoffStrategySchema.default('exponential'),
    /** Base delay in milliseconds for backoff (default: 1000) */
    baseDelayMs: zod_1.z.number().min(0).max(60000).default(1000),
    /** Maximum delay in milliseconds (default: 30000) */
    maxDelayMs: zod_1.z.number().min(0).max(300000).default(30000),
    /** Whether to consider similar errors as the same (default: true) */
    groupSimilarErrors: zod_1.z.boolean().default(true),
    /** Similarity threshold for error grouping (0-1, default: 0.8) */
    similarityThreshold: zod_1.z.number().min(0).max(1).default(0.8),
});
// ============================================================================
// Self-Repair Loop Configuration (v0.5.0)
// ============================================================================
/**
 * Configuration for the autonomous self-repair loop.
 * When a workflow stage fails, the repair loop diagnoses the error,
 * generates a fix, applies it, and validates the result.
 */
exports.RepairLoopConfigSchema = zod_1.z.object({
    /** Whether the self-repair loop is enabled (default: true) */
    enabled: zod_1.z.boolean().default(true),
    /** Fix attempt configuration (retry limits, backoff, similarity) */
    fixAttempts: exports.FixAttemptConfigSchema.default({}),
    /** Maximum total repair time per stage in milliseconds (default: 300000 = 5 min) */
    maxRepairTimeMs: zod_1.z.number().min(0).default(300000),
    /** Maximum cost in USD for repair attempts per stage (default: 2.0) */
    maxRepairCostPerStage: zod_1.z.number().min(0).default(2.0),
    /** Model to use for diagnosis queries (default: 'sonnet') */
    diagnosisModel: exports.AgentModelSchema.default('sonnet'),
    /** Model to use for repair agent queries (default: 'sonnet') */
    repairModel: exports.AgentModelSchema.default('sonnet'),
    /** Whether to capture file snapshots before/after each repair attempt (default: true) */
    captureSnapshots: zod_1.z.boolean().default(true),
    /** Whether to re-run the failed stage as validation after each fix (default: true) */
    validateAfterFix: zod_1.z.boolean().default(true),
    /** Error categories that the repair loop should NOT attempt to fix */
    skipCategories: zod_1.z.array(zod_1.z.string()).default(['permission', 'network', 'config']),
    /** Whether to attempt repair on stages that ran in parallel (default: true) */
    repairParallelStages: zod_1.z.boolean().default(true),
    /** Maximum number of files modifiable in a single repair cycle (default: 10) */
    maxFilesPerRepair: zod_1.z.number().min(1).default(10),
});
// ============================================================================
// Audit Log Types (v0.5.0)
// ============================================================================
/**
 * Audit log event types for tracking significant system events
 */
exports.AuditEventTypeSchema = zod_1.z.enum([
    // Task lifecycle events
    'task.created',
    'task.started',
    'task.completed',
    'task.failed',
    'task.cancelled',
    'task.paused',
    'task.resumed',
    'task.trashed',
    'task.restored',
    'task.archived',
    // Agent events
    'agent.started',
    'agent.completed',
    'agent.failed',
    'agent.handoff',
    // Approval events
    'approval.requested',
    'approval.granted',
    'approval.denied',
    'approval.timeout',
    // Configuration events
    'config.updated',
    'permission.granted',
    'permission.revoked',
    // Tool events
    'tool.executed',
    'tool.undone',
    // Security events
    'security.policy_violation',
    'security.rate_limited',
]);
/**
 * Severity levels for audit log entries
 */
exports.AuditSeveritySchema = zod_1.z.enum(['debug', 'info', 'warn', 'error', 'critical']);
/**
 * Audit log entry schema for tracking significant system events
 * Provides comprehensive context for compliance, debugging, and security monitoring
 */
exports.AuditLogEntrySchema = zod_1.z.object({
    /** Unique identifier for the audit log entry */
    id: zod_1.z.string().min(1),
    /** Associated task ID (optional - some events are system-wide) */
    taskId: zod_1.z.string().optional(),
    /** Type of event being logged */
    eventType: exports.AuditEventTypeSchema,
    /** Severity level of the event */
    severity: exports.AuditSeveritySchema,
    /** ISO 8601 timestamp when the event occurred */
    timestamp: zod_1.z.date(),
    /** Actor that triggered the event (user, agent, system) */
    actor: zod_1.z.string(),
    /** Human-readable description of the event */
    message: zod_1.z.string(),
    /** Stage during which the event occurred (if applicable) */
    stage: zod_1.z.string().optional(),
    /** Agent that was active when the event occurred (if applicable) */
    agent: zod_1.z.string().optional(),
    /** Structured metadata about the event (JSON serialized in DB) */
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
    /** Previous state before the event (for state changes) */
    previousState: zod_1.z.string().optional(),
    /** New state after the event (for state changes) */
    newState: zod_1.z.string().optional(),
    /** Duration of the operation in milliseconds (if applicable) */
    durationMs: zod_1.z.number().optional(),
    /** Whether the event was successful */
    success: zod_1.z.boolean().default(true),
    /** Error details if the event represents a failure */
    error: zod_1.z.string().optional(),
    /** Correlation ID for linking related events */
    correlationId: zod_1.z.string().optional(),
    /** Session ID for grouping events within a session */
    sessionId: zod_1.z.string().optional(),
});
// ============================================================================
// AutoFix Configuration and Events
// ============================================================================
/**
 * Configuration for auto-fix functionality
 * Controls which types of fixes can be automatically applied
 */
exports.AutoFixConfigSchema = zod_1.z.object({
    /** Whether auto-fix functionality is enabled globally */
    enabled: zod_1.z.boolean().optional().default(false),
    /** Configuration for syntax error fixes */
    syntax: zod_1.z.object({
        /** Whether to automatically fix syntax errors */
        enabled: zod_1.z.boolean().optional().default(false),
        /** Types of syntax errors to auto-fix */
        types: zod_1.z.array(zod_1.z.enum(['missing_semicolons', 'missing_brackets', 'indentation', 'quotes'])).optional().default([]),
    }).optional(),
    /** Configuration for import/require fixes */
    imports: zod_1.z.object({
        /** Whether to automatically fix import/require statements */
        enabled: zod_1.z.boolean().optional().default(false),
        /** Whether to add missing imports */
        addMissing: zod_1.z.boolean().optional().default(false),
        /** Whether to remove unused imports */
        removeUnused: zod_1.z.boolean().optional().default(false),
        /** Whether to sort imports */
        sort: zod_1.z.boolean().optional().default(false),
    }).optional(),
});
/**
 * Result of an auto-fix operation
 * Contains information about what was fixed and the outcome
 */
exports.AutoFixResultSchema = zod_1.z.object({
    /** Unique identifier for this auto-fix operation */
    id: zod_1.z.string().min(1),
    /** ID of the task this auto-fix belongs to */
    taskId: zod_1.z.string().min(1),
    /** Absolute path of the file that was fixed */
    filePath: zod_1.z.string().min(1),
    /** Type of fix that was applied */
    fixType: zod_1.z.enum(['syntax', 'imports', 'formatting']),
    /** Whether the fix was successful */
    success: zod_1.z.boolean(),
    /** Detailed description of what was fixed */
    description: zod_1.z.string(),
    /** Number of issues that were fixed */
    issuesFixed: zod_1.z.number().min(0).default(0),
    /** Error message if the fix failed */
    error: zod_1.z.string().optional(),
    /** Timestamp when the fix was applied */
    timestamp: zod_1.z.date(),
    /** Original file content before the fix */
    originalContent: zod_1.z.string().optional(),
    /** File content after the fix */
    fixedContent: zod_1.z.string().optional(),
    /** Additional metadata about the fix operation */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Event types for auto-fix operations
 */
exports.AutoFixEventTypeSchema = zod_1.z.enum([
    'auto-fix-start', // Auto-fix operation began
    'auto-fix-progress', // Auto-fix operation progress update
    'auto-fix-complete', // Auto-fix operation completed successfully
    'auto-fix-error', // Auto-fix operation failed
]);
/**
 * Status types for auto-fix operations
 */
exports.AutoFixStatusSchema = zod_1.z.enum([
    'running', // Auto-fix operation is in progress
    'success', // Auto-fix operation completed successfully
    'failed', // Auto-fix operation failed
]);
/**
 * Details of an issue that was fixed during auto-fix
 */
exports.AutoFixIssueDetailSchema = zod_1.z.object({
    /** Type of issue that was fixed */
    type: zod_1.z.string(),
    /** Description of the issue */
    description: zod_1.z.string(),
    /** File path where the issue was found */
    filePath: zod_1.z.string(),
    /** Line number where the issue was found (optional) */
    line: zod_1.z.number().optional(),
    /** Column number where the issue was found (optional) */
    column: zod_1.z.number().optional(),
    /** Severity of the issue */
    severity: zod_1.z.enum(['error', 'warning', 'info']).optional(),
});
/**
 * Event record for auto-fix operations
 * Tracks the lifecycle of auto-fix operations for auditing and debugging
 */
exports.AutoFixEventSchema = zod_1.z.object({
    /** Unique identifier for this auto-fix event */
    id: zod_1.z.string().min(1),
    /** Type of auto-fix event */
    eventType: exports.AutoFixEventTypeSchema,
    /** ID of the task this auto-fix event belongs to */
    taskId: zod_1.z.string().min(1),
    /** List of files that were modified during this auto-fix operation */
    filesModified: zod_1.z.array(zod_1.z.string()),
    /** Array of issues that were fixed with detailed information */
    issuesFixed: zod_1.z.array(exports.AutoFixIssueDetailSchema),
    /** Current iteration number in the auto-fix process */
    iterationCount: zod_1.z.number().min(0),
    /** Total number of iterations planned for this auto-fix process */
    totalIterations: zod_1.z.number().min(1),
    /** Currently active file being processed */
    currentFile: zod_1.z.string(),
    /** Current status of the auto-fix operation */
    status: exports.AutoFixStatusSchema,
    /** Timestamp when this event occurred */
    timestamp: zod_1.z.date(),
    /** Error message if the operation failed */
    error: zod_1.z.string().optional(),
    /** Additional metadata about the operation */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.RuleTriggerEventSchema = zod_1.z.enum(['task.start', 'task.update', 'tool.use', 'git.commit', 'git.push', 'agent.thought']);
exports.RuleTriggerSchema = zod_1.z.object({
    event: exports.RuleTriggerEventSchema,
    toolName: zod_1.z.string().optional(), // For tool.use event
    // Add other event-specific fields as needed
});
exports.RuleConditionSchema = zod_1.z.object({
    expression: zod_1.z.string(),
});
exports.RuleActionTypeSchema = zod_1.z.enum(['block', 'warn', 'inject_prompt']);
exports.RuleActionSchema = zod_1.z.object({
    type: exports.RuleActionTypeSchema,
    message: zod_1.z.string().optional(),
    prompt: zod_1.z.string().optional(),
});
exports.ApexRuleSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    trigger: exports.RuleTriggerSchema,
    condition: exports.RuleConditionSchema.optional(),
    action: exports.RuleActionSchema,
    enabled: zod_1.z.boolean().optional().default(true),
});
// ============================================================================
// Screenshot Comparison
// ============================================================================
/** Legacy alias for backward compatibility */
exports.ScreenshotComparisonOptionsSchema = exports.VisualRegressionConfigSchema;
/**
 * Image metadata for screenshot comparison
 */
exports.ImageMetadataSchema = zod_1.z.object({
    /** Image width in pixels */
    width: zod_1.z.number().min(1),
    /** Image height in pixels */
    height: zod_1.z.number().min(1),
    /** Number of color channels (3 for RGB, 4 for RGBA) */
    channels: zod_1.z.number().min(3).max(4),
    /** File path or identifier */
    path: zod_1.z.string(),
});
// ----------------------------------------------------------------------------
// Screenshot Capture Options & Results
// ----------------------------------------------------------------------------
/**
 * Supported screenshot image formats
 */
exports.ScreenshotFormatSchema = zod_1.z.enum(['png', 'jpeg']);
/**
 * Screenshot output mode - determines how the screenshot is returned
 */
exports.ScreenshotOutputModeSchema = zod_1.z.enum(['buffer', 'file']);
/**
 * Result of a screenshot capture operation
 * Contains either the image buffer or file path, along with dimensions
 */
exports.ScreenshotResultSchema = zod_1.z.object({
    /** Image data as a Buffer (present when output mode is 'buffer') */
    buffer: zod_1.z.instanceof(Buffer).optional(),
    /** File path where screenshot was saved (present when output mode is 'file') */
    path: zod_1.z.string().optional(),
    /** Width of the captured screenshot in pixels */
    width: zod_1.z.number().int().min(1),
    /** Height of the captured screenshot in pixels */
    height: zod_1.z.number().int().min(1),
    /** Format of the captured image */
    format: exports.ScreenshotFormatSchema.optional(),
    /** Timestamp when the screenshot was captured */
    capturedAt: zod_1.z.date().optional(),
}).refine((data) => data.buffer !== undefined || data.path !== undefined, { message: 'Either buffer or path must be provided' });
/**
 * Options for capturing a screenshot of a specific element
 * Extends base screenshot options with element selector
 */
exports.CaptureElementOptionsSchema = exports.ScreenshotOptionsSchema.extend({
    /** CSS selector for the element to capture */
    selector: zod_1.z.string().min(1, 'Selector is required'),
    /** Padding around the element in pixels (default: 0) */
    padding: zod_1.z.number().int().min(0).optional().default(0),
});
/**
 * Options for capturing a screenshot of a specific viewport region
 */
exports.CaptureRegionOptionsSchema = exports.ScreenshotOptionsSchema.extend({
    /** X coordinate of the region's top-left corner */
    x: zod_1.z.number().int().min(0),
    /** Y coordinate of the region's top-left corner */
    y: zod_1.z.number().int().min(0),
    /** Width of the region to capture */
    width: zod_1.z.number().int().min(1),
    /** Height of the region to capture */
    height: zod_1.z.number().int().min(1),
});
// ============================================================================
// Tool Execution Hooks
// ============================================================================
/**
 * Context provided to onToolStart hooks
 * Contains information available at tool execution start
 */
exports.ToolStartHookContextSchema = zod_1.z.object({
    /** Name of the tool being executed */
    toolName: zod_1.z.string().min(1),
    /** Input parameters passed to the tool */
    input: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Unique identifier for this tool call */
    callId: zod_1.z.string().min(1),
    /** Task ID that initiated this tool call */
    taskId: zod_1.z.string().min(1),
    /** Timestamp when the tool execution started */
    timestamp: zod_1.z.date(),
    /** Agent name executing the tool (if available) */
    agentName: zod_1.z.string().optional(),
    /** Workflow stage name (if available) */
    stageName: zod_1.z.string().optional(),
});
/**
 * Context provided to onToolComplete hooks
 * Contains full execution details including result
 */
exports.ToolCompleteHookContextSchema = zod_1.z.object({
    /** Name of the tool that was executed */
    toolName: zod_1.z.string().min(1),
    /** Input parameters that were passed to the tool */
    input: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Unique identifier for this tool call */
    callId: zod_1.z.string().min(1),
    /** Task ID that initiated this tool call */
    taskId: zod_1.z.string().min(1),
    /** Timestamp when the tool execution completed */
    timestamp: zod_1.z.date(),
    /** Result of the tool execution */
    result: zod_1.z.object({
        success: zod_1.z.boolean(),
        output: zod_1.z.unknown().optional(),
        error: zod_1.z.string().optional(),
    }),
    /** Timing information */
    timing: zod_1.z.object({
        startTime: zod_1.z.date(),
        endTime: zod_1.z.date(),
        duration: zod_1.z.number().min(0),
    }),
    /** Agent name that executed the tool (if available) */
    agentName: zod_1.z.string().optional(),
    /** Workflow stage name (if available) */
    stageName: zod_1.z.string().optional(),
});
/**
 * Context provided to onToolError hooks
 * Focused on error details for failed tool executions
 */
exports.ToolErrorHookContextSchema = zod_1.z.object({
    /** Name of the tool that failed */
    toolName: zod_1.z.string().min(1),
    /** Input parameters that were passed to the tool */
    input: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()),
    /** Unique identifier for this tool call */
    callId: zod_1.z.string().min(1),
    /** Task ID that initiated this tool call */
    taskId: zod_1.z.string().min(1),
    /** Timestamp when the error occurred */
    timestamp: zod_1.z.date(),
    /** Error message describing the failure */
    error: zod_1.z.string().min(1),
    /** Timing information (if available) */
    timing: zod_1.z.object({
        startTime: zod_1.z.date(),
        endTime: zod_1.z.date(),
        duration: zod_1.z.number().min(0),
    }).optional(),
    /** Agent name that executed the tool (if available) */
    agentName: zod_1.z.string().optional(),
    /** Workflow stage name (if available) */
    stageName: zod_1.z.string().optional(),
});
// ============================================================================
// Screenshot API Types (v0.5.0)
// ============================================================================
/**
 * Screenshot API request for viewport capture
 */
exports.ScreenshotViewportRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    format: zod_1.z.enum(['png', 'jpeg']).optional(),
    quality: zod_1.z.number().min(0).max(100).optional(),
    omitBackground: zod_1.z.boolean().optional(),
    viewport: zod_1.z.object({
        width: zod_1.z.number().min(100).max(4000),
        height: zod_1.z.number().min(100).max(4000),
    }).optional(),
    savePath: zod_1.z.string().optional(),
});
/**
 * Screenshot API request for full page capture
 */
exports.ScreenshotFullPageRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    format: zod_1.z.enum(['png', 'jpeg']).optional(),
    quality: zod_1.z.number().min(0).max(100).optional(),
    omitBackground: zod_1.z.boolean().optional(),
    viewport: zod_1.z.object({
        width: zod_1.z.number().min(100).max(4000),
        height: zod_1.z.number().min(100).max(4000),
    }).optional(),
    savePath: zod_1.z.string().optional(),
});
/**
 * Screenshot API request for element capture
 */
exports.ScreenshotElementRequestSchema = zod_1.z.object({
    url: zod_1.z.string().url(),
    selector: zod_1.z.string().min(1),
    format: zod_1.z.enum(['png', 'jpeg']).optional(),
    quality: zod_1.z.number().min(0).max(100).optional(),
    omitBackground: zod_1.z.boolean().optional(),
    timeout: zod_1.z.number().min(1000).max(60000).optional(),
    viewport: zod_1.z.object({
        width: zod_1.z.number().min(100).max(4000),
        height: zod_1.z.number().min(100).max(4000),
    }).optional(),
    savePath: zod_1.z.string().optional(),
});
/**
 * Screenshot API response
 */
exports.ScreenshotResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    format: zod_1.z.string().optional(),
    duration: zod_1.z.number().min(0).optional(),
    filePath: zod_1.z.string().optional(),
    dimensions: zod_1.z.object({
        width: zod_1.z.number().min(1),
        height: zod_1.z.number().min(1),
    }).optional(),
    error: zod_1.z.string().optional(),
});
// ----------------------------------------------------------------------------
// Test Report Types
// ----------------------------------------------------------------------------
/**
 * Visual comparison information for test reports
 */
exports.TestVisualComparisonSchema = zod_1.z.object({
    /** Path to baseline image */
    baseline: zod_1.z.string().optional(),
    /** Path to actual image */
    actual: zod_1.z.string().optional(),
    /** Percentage of pixels that differ (0-100) */
    diffPercentage: zod_1.z.number().min(0).max(100),
    /** Threshold percentage for acceptable difference (0-100) */
    threshold: zod_1.z.number().min(0).max(100),
    /** Whether the comparison passed */
    passed: zod_1.z.boolean(),
    /** Path to diff image if generated */
    diffImage: zod_1.z.string().optional(),
    /** Timestamp when comparison occurred */
    timestamp: zod_1.z.date().optional(),
    /** URL of the page being compared (if applicable) */
    pageUrl: zod_1.z.string().optional(),
    /** CSS selector if element-specific comparison */
    selector: zod_1.z.string().optional(),
});
/**
 * Test artifact information
 */
exports.TestArtifactSchema = zod_1.z.object({
    /** Type of artifact */
    type: zod_1.z.enum(['screenshot', 'diff', 'log', 'video', 'trace']),
    /** File path to the artifact */
    path: zod_1.z.string().min(1),
    /** Test ID this artifact belongs to */
    testId: zod_1.z.string().min(1),
    /** Human-readable description of the artifact */
    description: zod_1.z.string().min(1),
    /** Size of the artifact file in bytes */
    size: zod_1.z.number().min(0).optional(),
    /** MIME type of the artifact */
    mimeType: zod_1.z.string().optional(),
});
/**
 * Individual test result information
 */
exports.TestResultSchema = zod_1.z.object({
    /** Unique identifier for the test */
    testId: zod_1.z.string().min(1),
    /** Name or title of the test */
    name: zod_1.z.string().min(1),
    /** Test category */
    category: zod_1.z.enum(['functional', 'visual', 'integration', 'unit', 'e2e', 'performance']),
    /** Test execution status */
    status: zod_1.z.enum(['passed', 'failed', 'skipped', 'pending']),
    /** Execution time in milliseconds */
    executionTime: zod_1.z.number().min(0),
    /** Visual comparison data if this is a visual test */
    visualComparison: exports.TestVisualComparisonSchema.optional(),
    /** Error details if the test failed */
    errorDetails: zod_1.z.string().optional(),
    /** Stack trace if the test failed */
    stackTrace: zod_1.z.string().optional(),
    /** Tags associated with the test */
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
/**
 * Visual regression summary statistics
 */
exports.VisualRegressionSummarySchema = zod_1.z.object({
    /** Total number of visual comparisons performed */
    totalComparisons: zod_1.z.number().min(0),
    /** Number of comparisons that passed */
    passedComparisons: zod_1.z.number().min(0),
    /** Number of comparisons that failed */
    failedComparisons: zod_1.z.number().min(0),
    /** Average difference percentage across all comparisons */
    averageDiffPercentage: zod_1.z.number().min(0).max(100),
    /** Number of comparisons that exceeded threshold */
    thresholdViolations: zod_1.z.number().min(0),
    /** Number of diff images generated */
    diffImageCount: zod_1.z.number().min(0),
    /** Most significant regression (highest diff percentage) */
    maxDiffPercentage: zod_1.z.number().min(0).max(100).optional(),
    /** Baseline coverage percentage */
    baselineCoverage: zod_1.z.number().min(0).max(100).optional(),
});
/**
 * Test execution summary statistics
 */
exports.TestSummarySchema = zod_1.z.object({
    /** Name of the test suite */
    testSuite: zod_1.z.string().min(1),
    /** Total number of tests executed */
    totalTests: zod_1.z.number().min(0),
    /** Number of tests that passed */
    passedTests: zod_1.z.number().min(0),
    /** Number of tests that failed */
    failedTests: zod_1.z.number().min(0),
    /** Number of tests that were skipped */
    skippedTests: zod_1.z.number().min(0),
    /** Number of tests that are pending */
    pendingTests: zod_1.z.number().min(0).optional(),
    /** Pass rate as a percentage (0-100) */
    passRate: zod_1.z.number().min(0).max(100),
    /** Total execution time in milliseconds */
    executionTime: zod_1.z.number().min(0),
    /** Timestamp when the test execution started */
    timestamp: zod_1.z.date(),
    /** Environment where tests were executed */
    environment: zod_1.z.string().optional(),
    /** Version of the application under test */
    version: zod_1.z.string().optional(),
});
/**
 * Comprehensive test execution report
 * Includes summary statistics, visual regression data, detailed test results, and artifacts
 */
exports.TestReportSchema = zod_1.z.object({
    /** Unique identifier for this test report */
    reportId: zod_1.z.string().min(1),
    /** Task ID associated with this test execution */
    taskId: zod_1.z.string().min(1).optional(),
    /** Name of the agent that generated this report */
    agentName: zod_1.z.string().min(1).optional(),
    /** Test execution summary */
    summary: exports.TestSummarySchema,
    /** Visual regression testing summary (if any visual tests were run) */
    visualRegression: exports.VisualRegressionSummarySchema.optional(),
    /** Array of visual comparison results */
    visualComparisons: zod_1.z.array(exports.TestVisualComparisonSchema).optional(),
    /** Detailed results for each test */
    testResults: zod_1.z.array(exports.TestResultSchema),
    /** Test artifacts (screenshots, diff images, logs, etc.) */
    artifacts: zod_1.z.array(exports.TestArtifactSchema),
    /** Additional metadata about the test execution */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    /** Timestamp when the report was generated */
    generatedAt: zod_1.z.date(),
    /** Version of the test report schema */
    schemaVersion: zod_1.z.string().optional().default('1.0.0'),
});
// ============================================================================
// Permission Change Event Types (v0.5.0)
// ============================================================================
/**
 * Valid permission change types that can occur in the system
 */
exports.PermissionChangeTypeSchema = zod_1.z.enum([
    'granted', // Permission was granted to an agent
    'revoked', // Permission was revoked from an agent
    'modified' // Permission settings were modified
]);
/**
 * Details about the permission that was changed
 */
exports.PermissionDetailsSchema = zod_1.z.object({
    /** The tool category affected by this permission change */
    category: exports.ToolCategorySchema,
    /** The specific permission level that was changed */
    permission: exports.ToolPermissionSchema,
    /** Previous permission level (null for newly granted permissions) */
    previousLevel: exports.PermissionLevelSchema.nullable(),
    /** New permission level (null for revoked permissions) */
    newLevel: exports.PermissionLevelSchema.nullable(),
    /** Optional reason for the permission change */
    reason: zod_1.z.string().trim().optional(),
    /** Agent that was affected by this permission change */
    agentName: zod_1.z.string().trim().min(1).optional(),
    /** Task ID associated with this permission change, if any */
    taskId: zod_1.z.string().trim().min(1).optional()
});
/**
 * Event emitted when permission settings change in the system
 */
exports.PermissionChangeEventSchema = zod_1.z.object({
    /** Type of permission change that occurred */
    changeType: exports.PermissionChangeTypeSchema,
    /** Details about the permission that was changed */
    permission: exports.PermissionDetailsSchema,
    /** When this permission change occurred */
    timestamp: zod_1.z.date(),
    /** Human-readable message describing the change and any required actions */
    message: zod_1.z.string().trim().min(1),
    /** Optional metadata about the change context */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
});
var browser_permission_denied_error_js_1 = require("./tools/browser/browser-permission-denied-error.js");
Object.defineProperty(exports, "BrowserPermissionDeniedError", { enumerable: true, get: function () { return browser_permission_denied_error_js_1.BrowserPermissionDeniedError; } });
Object.defineProperty(exports, "isBrowserPermissionDeniedError", { enumerable: true, get: function () { return browser_permission_denied_error_js_1.isBrowserPermissionDeniedError; } });
Object.defineProperty(exports, "toBrowserPermissionDeniedError", { enumerable: true, get: function () { return browser_permission_denied_error_js_1.toBrowserPermissionDeniedError; } });
// ============================================================================
// Project Context Types (v0.6.0)
// ============================================================================
/**
 * Git file status indicator
 * Represents the state of a file in a git repository
 * - 'M': Modified - file has been changed
 * - 'A': Added - file is staged for addition
 * - 'D': Deleted - file is staged for deletion
 * - 'R': Renamed - file has been renamed
 * - 'C': Copied - file has been copied
 * - 'U': Unmerged - file has merge conflicts
 * - '?': Untracked - file is not tracked by git
 * - '!': Ignored - file is ignored by git
 */
exports.GitFileStatusSchema = zod_1.z.enum(['M', 'A', 'D', 'R', 'C', 'U', '?', '!']);
/**
 * Represents a file change in a git repository with its status
 */
exports.GitChangedFileSchema = zod_1.z.object({
    /** Relative path to the file from the repository root */
    path: zod_1.z.string().min(1),
    /** Git status indicator for this file */
    status: exports.GitFileStatusSchema,
    /** Original path if the file was renamed (only present for renames) */
    oldPath: zod_1.z.string().optional(),
});
/**
 * Git repository status information
 * Provides comprehensive information about the current state of a git repository
 * including branch info, tracking status, and file changes
 *
 * @example
 * ```typescript
 * const status: GitStatus = {
 *   isRepository: true,
 *   branch: 'feature/new-feature',
 *   remoteBranch: 'origin/feature/new-feature',
 *   ahead: 2,
 *   behind: 0,
 *   staged: [{ path: 'src/index.ts', status: 'M' }],
 *   unstaged: [{ path: 'README.md', status: 'M' }],
 *   untracked: ['temp.log'],
 *   hasConflicts: false,
 *   isDirty: true,
 *   lastCommitHash: 'abc1234',
 *   lastCommitMessage: 'Add new feature'
 * };
 * ```
 */
exports.GitStatusSchema = zod_1.z.object({
    /** Whether the path is a git repository */
    isRepository: zod_1.z.boolean(),
    /** Current branch name (null if in detached HEAD state) */
    branch: zod_1.z.string().nullable(),
    /** Remote tracking branch (if any) */
    remoteBranch: zod_1.z.string().nullable().optional(),
    /** Number of commits ahead of the remote tracking branch */
    ahead: zod_1.z.number().int().min(0).optional().default(0),
    /** Number of commits behind the remote tracking branch */
    behind: zod_1.z.number().int().min(0).optional().default(0),
    /** Files staged for commit */
    staged: zod_1.z.array(exports.GitChangedFileSchema).optional().default([]),
    /** Files with unstaged changes */
    unstaged: zod_1.z.array(exports.GitChangedFileSchema).optional().default([]),
    /** Untracked files (paths relative to repository root) */
    untracked: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether there are merge conflicts */
    hasConflicts: zod_1.z.boolean().optional().default(false),
    /** Whether the working directory has any changes (staged, unstaged, or untracked) */
    isDirty: zod_1.z.boolean().optional().default(false),
    /** Hash of the last commit (short SHA) */
    lastCommitHash: zod_1.z.string().optional(),
    /** Message of the last commit */
    lastCommitMessage: zod_1.z.string().optional(),
    /** Timestamp of the last commit */
    lastCommitTimestamp: zod_1.z.date().optional(),
    /** Total number of stashes */
    stashCount: zod_1.z.number().int().min(0).optional().default(0),
    /** List of configured remotes */
    remotes: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        url: zod_1.z.string(),
    })).optional().default([]),
});
// ============================================================================
// Project Structure Types (v0.6.0)
// ============================================================================
/**
 * Entry type in project structure
 */
exports.ProjectEntryTypeSchema = zod_1.z.enum(['file', 'directory']);
/**
 * Represents a single entry (file or directory) in the project structure
 */
exports.ProjectEntrySchema = zod_1.z.object({
    /** Name of the file or directory */
    name: zod_1.z.string().min(1),
    /** Relative path from project root */
    path: zod_1.z.string().min(1),
    /** Whether this is a file or directory */
    type: exports.ProjectEntryTypeSchema,
    /** Size in bytes (for files only) */
    size: zod_1.z.number().int().min(0).optional(),
    /** Last modified timestamp */
    modifiedAt: zod_1.z.date().optional(),
    /** Child entries (for directories only) */
    children: zod_1.z.lazy(() => zod_1.z.array(exports.ProjectEntrySchema)).optional(),
});
/**
 * Project structure information
 * Provides an overview of the project's directory layout and key files
 *
 * @example
 * ```typescript
 * const structure: ProjectStructure = {
 *   root: '/path/to/project',
 *   totalFiles: 150,
 *   totalDirectories: 25,
 *   entries: [...],
 *   hasPackageJson: true,
 *   hasGitIgnore: true,
 *   maxDepthScanned: 3
 * };
 * ```
 */
exports.ProjectStructureSchema = zod_1.z.object({
    /** Absolute path to the project root */
    root: zod_1.z.string().min(1),
    /** Total number of files in the scanned structure */
    totalFiles: zod_1.z.number().int().min(0).optional().default(0),
    /** Total number of directories in the scanned structure */
    totalDirectories: zod_1.z.number().int().min(0).optional().default(0),
    /** Hierarchical list of project entries */
    entries: zod_1.z.array(exports.ProjectEntrySchema).optional().default([]),
    /** Key configuration/manifest files detected at the root */
    rootFiles: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Common project directories detected (src, lib, test, etc.) */
    commonDirectories: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether a package.json exists */
    hasPackageJson: zod_1.z.boolean().optional().default(false),
    /** Whether a .gitignore exists */
    hasGitIgnore: zod_1.z.boolean().optional().default(false),
    /** Whether a README file exists */
    hasReadme: zod_1.z.boolean().optional().default(false),
    /** Whether a LICENSE file exists */
    hasLicense: zod_1.z.boolean().optional().default(false),
    /** Maximum directory depth that was scanned */
    maxDepthScanned: zod_1.z.number().int().min(0).optional(),
    /** Directories that were excluded from scanning */
    excludedDirectories: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Timestamp when the structure was scanned */
    scannedAt: zod_1.z.date().optional(),
});
// ============================================================================
// Framework Detection Types (v0.6.0)
// ============================================================================
/**
 * Framework category classification
 */
exports.FrameworkCategorySchema = zod_1.z.enum([
    'frontend', // Frontend frameworks (React, Vue, Angular, etc.)
    'backend', // Backend frameworks (Express, Fastify, NestJS, etc.)
    'fullstack', // Full-stack frameworks (Next.js, Nuxt, etc.)
    'testing', // Testing frameworks (Jest, Mocha, Vitest, etc.)
    'build', // Build tools (Webpack, Vite, Rollup, etc.)
    'mobile', // Mobile frameworks (React Native, Flutter, etc.)
    'desktop', // Desktop frameworks (Electron, Tauri, etc.)
    'other', // Other/unclassified frameworks
]);
/**
 * Framework detection confidence level
 */
exports.DetectionConfidenceSchema = zod_1.z.enum([
    'high', // Framework explicitly declared in manifest
    'medium', // Framework detected via dependencies
    'low', // Framework inferred from file patterns
]);
/**
 * Information about a detected framework or library
 *
 * @example
 * ```typescript
 * const framework: FrameworkInfo = {
 *   name: 'React',
 *   version: '18.2.0',
 *   category: 'frontend',
 *   confidence: 'high',
 *   detectedVia: 'package.json dependency',
 *   language: 'typescript',
 *   configFiles: ['tsconfig.json', 'vite.config.ts']
 * };
 * ```
 */
exports.FrameworkInfoSchema = zod_1.z.object({
    /** Framework or library name */
    name: zod_1.z.string().min(1),
    /** Detected version (if available) */
    version: zod_1.z.string().optional(),
    /** Framework category */
    category: exports.FrameworkCategorySchema,
    /** How confident the detection is */
    confidence: exports.DetectionConfidenceSchema.optional().default('medium'),
    /** How the framework was detected */
    detectedVia: zod_1.z.string().optional(),
    /** Primary programming language */
    language: zod_1.z.string().optional(),
    /** Related configuration files found */
    configFiles: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Whether this is a dev dependency */
    isDevDependency: zod_1.z.boolean().optional().default(false),
    /** Additional metadata about the framework */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
/**
 * Schema for framework detection results
 * Identifies frameworks and libraries used in the project
 *
 * @example
 * ```typescript
 * const detection: FrameworkDetection = {
 *   primary: { name: 'React', version: '18.2.0', category: 'frontend' },
 *   frameworks: [
 *     { name: 'React', version: '18.2.0', category: 'frontend' },
 *     { name: 'TypeScript', version: '5.0.0', category: 'language' }
 *   ],
 *   primaryLanguage: 'typescript',
 *   languages: [
 *     { name: 'TypeScript', extensions: ['.ts', '.tsx'], percentage: 85 },
 *     { name: 'JavaScript', extensions: ['.js', '.jsx'], percentage: 15 }
 *   ],
 *   runtime: 'node',
 *   packageManager: 'npm'
 * };
 * ```
 */
exports.FrameworkDetectionSchema = zod_1.z.object({
    /** Primary framework (highest confidence) */
    primary: exports.FrameworkInfoSchema.optional(),
    /** All detected frameworks */
    frameworks: zod_1.z.array(exports.FrameworkInfoSchema),
    /** Primary programming language */
    primaryLanguage: zod_1.z.string().optional(),
    /** All detected languages */
    languages: zod_1.z.array(zod_1.z.object({
        /** Language name */
        name: zod_1.z.string(),
        /** File extensions associated with this language */
        extensions: zod_1.z.array(zod_1.z.string()),
        /** Percentage of files using this language */
        percentage: zod_1.z.number().min(0).max(100),
    })),
    /** Runtime environment (node, browser, deno, bun, etc.) */
    runtime: zod_1.z.string().optional(),
    /** Package manager detected */
    packageManager: zod_1.z.string().optional(),
    /** Error message if detection failed */
    error: zod_1.z.string().optional(),
});
// ============================================================================
// Configuration Detection Types (v0.6.0)
// ============================================================================
/**
 * Configuration file format
 */
exports.ConfigFormatSchema = zod_1.z.enum([
    'json',
    'yaml',
    'toml',
    'javascript',
    'typescript',
    'ini',
    'env',
    'xml',
    'other',
]);
/**
 * Configuration file purpose/category
 */
exports.ConfigPurposeSchema = zod_1.z.enum([
    'package-manager', // package.json, Cargo.toml, etc.
    'typescript', // tsconfig.json
    'linting', // eslint, prettier, etc.
    'testing', // jest.config, vitest.config, etc.
    'build', // webpack.config, vite.config, etc.
    'ci-cd', // .github/workflows, .gitlab-ci, etc.
    'containerization', // Dockerfile, docker-compose, etc.
    'environment', // .env files
    'git', // .gitignore, .gitattributes
    'editor', // .editorconfig, .vscode
    'documentation', // README, CHANGELOG
    'security', // .npmrc, .nvmrc
    'other',
]);
/**
 * Schema for individual configuration file info used in the project context analyzer
 *
 * @example
 * ```typescript
 * const configFile: ConfigFileInfo = {
 *   name: 'tsconfig.json',
 *   path: 'tsconfig.json',
 *   type: 'typescript',
 *   exists: true,
 *   description: 'TypeScript compiler configuration'
 * };
 * ```
 */
exports.ConfigFileInfoSchema = zod_1.z.object({
    /** Configuration file name */
    name: zod_1.z.string(),
    /** File path relative to project root */
    path: zod_1.z.string(),
    /** Configuration type/purpose */
    type: zod_1.z.enum([
        'package',
        'typescript',
        'eslint',
        'prettier',
        'babel',
        'webpack',
        'vite',
        'rollup',
        'jest',
        'vitest',
        'docker',
        'ci',
        'git',
        'editor',
        'environment',
        'other',
    ]),
    /** Whether the file exists */
    exists: zod_1.z.boolean(),
    /** Brief description of what this config controls */
    description: zod_1.z.string().optional(),
});
/**
 * Information about a detected configuration file
 *
 * @example
 * ```typescript
 * const config: ConfigurationInfo = {
 *   name: 'tsconfig.json',
 *   path: 'tsconfig.json',
 *   format: 'json',
 *   purpose: 'typescript',
 *   isValid: true,
 *   keySettings: {
 *     strict: true,
 *     target: 'ES2022'
 *   }
 * };
 * ```
 */
exports.ConfigurationInfoSchema = zod_1.z.object({
    /** Configuration file name */
    name: zod_1.z.string().min(1),
    /** Relative path from project root */
    path: zod_1.z.string().min(1),
    /** File format */
    format: exports.ConfigFormatSchema,
    /** Configuration purpose/category */
    purpose: exports.ConfigPurposeSchema,
    /** Whether the configuration file is syntactically valid */
    isValid: zod_1.z.boolean().optional().default(true),
    /** Validation error message if not valid */
    validationError: zod_1.z.string().optional(),
    /** Key settings extracted from the configuration (sanitized, no secrets) */
    keySettings: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    /** Whether this config extends another configuration */
    extends: zod_1.z.string().optional(),
    /** Size in bytes */
    size: zod_1.z.number().int().min(0).optional(),
    /** Last modified timestamp */
    modifiedAt: zod_1.z.date().optional(),
    /** Additional metadata */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// ============================================================================
// Test Framework Detection Types (v0.6.0)
// ============================================================================
/**
 * Test runner type classification
 */
exports.TestRunnerTypeSchema = zod_1.z.enum([
    'unit', // Unit testing (Jest, Mocha, Vitest)
    'integration', // Integration testing
    'e2e', // End-to-end testing (Playwright, Cypress)
    'component', // Component testing
    'visual', // Visual regression testing
    'performance', // Performance/load testing
    'accessibility', // Accessibility testing
    'other',
]);
/**
 * Information about a detected test framework
 *
 * @example
 * ```typescript
 * const testFramework: TestFrameworkInfo = {
 *   name: 'vitest',
 *   version: '1.2.0',
 *   type: 'unit',
 *   configFile: 'vitest.config.ts',
 *   testPatterns: ['**\/*.test.ts', '**\/*.spec.ts'],
 *   testDirectory: 'src/__tests__',
 *   runCommand: 'npm test',
 *   coverageEnabled: true
 * };
 * ```
 */
exports.TestFrameworkInfoSchema = zod_1.z.object({
    /** Test framework name */
    name: zod_1.z.string().min(1),
    /** Detected version (if available) */
    version: zod_1.z.string().optional(),
    /** Type of testing this framework handles */
    type: exports.TestRunnerTypeSchema,
    /** Configuration file path (if detected) */
    configFile: zod_1.z.string().optional(),
    /** File patterns used to identify test files */
    testPatterns: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Primary test directory (if detected) */
    testDirectory: zod_1.z.string().optional(),
    /** Command to run tests */
    runCommand: zod_1.z.string().optional(),
    /** Whether code coverage is configured */
    coverageEnabled: zod_1.z.boolean().optional().default(false),
    /** Coverage tool used (istanbul, c8, etc.) */
    coverageTool: zod_1.z.string().optional(),
    /** Whether watch mode is available */
    watchModeAvailable: zod_1.z.boolean().optional().default(false),
    /** Related plugins/extensions detected */
    plugins: zod_1.z.array(zod_1.z.string()).optional().default([]),
    /** Number of test files detected */
    testFileCount: zod_1.z.number().int().min(0).optional(),
    /** Detected assertion library (if different from test runner) */
    assertionLibrary: zod_1.z.string().optional(),
    /** Detected mocking library (if any) */
    mockingLibrary: zod_1.z.string().optional(),
    /** Additional metadata */
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
// ============================================================================
// Aggregate Project Context Type (v0.6.0)
// ============================================================================
/**
 * Comprehensive project context combining all detection results
 * This is the main type used for providing context to AI agents
 *
 * @example
 * ```typescript
 * const context: ProjectContext = {
 *   gitStatus: { ... },
 *   structure: { ... },
 *   frameworks: [{ name: 'React', ... }],
 *   configurations: [{ name: 'tsconfig.json', ... }],
 *   testFrameworks: [{ name: 'vitest', ... }],
 *   detectedAt: new Date()
 * };
 * ```
 */
exports.ProjectContextSchema = zod_1.z.object({
    /** Git repository status (if applicable) */
    gitStatus: exports.GitStatusSchema.optional(),
    /** Project directory structure */
    structure: exports.ProjectStructureSchema.optional(),
    /** Detected frameworks and libraries */
    frameworks: zod_1.z.array(exports.FrameworkInfoSchema).optional().default([]),
    /** Detected configuration files */
    configurations: zod_1.z.array(exports.ConfigurationInfoSchema).optional().default([]),
    /** Detected test frameworks */
    testFrameworks: zod_1.z.array(exports.TestFrameworkInfoSchema).optional().default([]),
    /** When the context was detected/generated */
    detectedAt: zod_1.z.date().optional(),
    /** Errors encountered during detection */
    errors: zod_1.z.array(zod_1.z.object({
        component: zod_1.z.string(),
        message: zod_1.z.string(),
    })).optional().default([]),
});
//# sourceMappingURL=types.js.map