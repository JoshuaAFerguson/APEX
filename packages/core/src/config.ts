import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  ApexConfig,
  ApexConfigSchema,
  AutonomyConfig,
  AgentDefinition,
  AgentDefinitionSchema,
  WorkflowDefinition,
  WorkflowDefinitionSchema,
  PermissionsConfig,
  PolicyConfig,
  Policy,
  LinterConfig,
  HookConfig,
  HookConfigSchema,
  ToolHookConfigSchema,
  SecretScannerConfig,
  SecretScanningConfig,
  ToolAlias,
  ToolAliasSchema,
  VisualRegressionConfig,
  MCPConfig,
  MCPConfigSchema,
  MCPServerConfig,
} from './types';
import { containerRuntime, ContainerRuntimeType } from './container-runtime';
import { normalizePath } from './path-utils';

const APEX_DIR = '.apex';
const CONFIG_FILE = 'config.yaml';
const AGENTS_DIR = 'agents';
const WORKFLOWS_DIR = 'workflows';
const SKILLS_DIR = 'skills';
const SCRIPTS_DIR = 'scripts';
const TOOLS_DIR = 'tools';

/**
 * Container workspace validation error types
 */
export interface ContainerValidationError {
  type: 'missing_runtime' | 'missing_image' | 'runtime_not_functional';
  message: string;
  suggestion?: string;
}

/**
 * Container workspace validation warning types
 */
export interface ContainerValidationWarning {
  type: 'no_image_specified';
  message: string;
  suggestion?: string;
}

/**
 * Container workspace validation result
 */
export interface ContainerValidationResult {
  valid: boolean;
  errors: ContainerValidationError[];
  warnings: ContainerValidationWarning[];
}

/**
 * Check if APEX is initialized in the given directory
 */
export async function isApexInitialized(projectPath: string): Promise<boolean> {
  const apexDir = normalizePath(path.join(projectPath, APEX_DIR));
  try {
    await fs.access(apexDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate container workspace configuration
 */
export async function validateContainerWorkspaceConfig(config: ApexConfig): Promise<ContainerValidationResult> {
  const result: ContainerValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Only validate if workspace configuration exists
  if (!config.workspace) {
    return result;
  }

  const workspace = config.workspace;
  const isContainerStrategy = workspace.defaultStrategy === 'container';

  // Check if container strategy is used but no runtime is available
  if (isContainerStrategy) {
    try {
      const availableRuntimes = await containerRuntime.detectRuntimes();
      const functionalRuntimes = availableRuntimes.filter(r => r.available);

      if (functionalRuntimes.length === 0) {
        result.valid = false;
        result.errors.push({
          type: 'missing_runtime',
          message: 'Container workspace strategy is selected but no container runtime (Docker/Podman) is available.',
          suggestion: 'Please install Docker or Podman, or change the workspace strategy to "worktree", "directory", or "none".',
        });
      }
    } catch (error) {
      result.valid = false;
      result.errors.push({
        type: 'runtime_not_functional',
        message: `Failed to detect container runtime: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: 'Please check your container runtime installation and ensure it is functional.',
      });
    }

    // Check if container strategy is used but no image is specified in defaults
    if (!workspace.container?.image) {
      result.warnings.push({
        type: 'no_image_specified',
        message: 'Container workspace strategy is selected but no default container image is specified.',
        suggestion: 'Consider setting workspace.container.image to a default image like "node:20-alpine" or "ubuntu:latest" for better task execution reliability.',
      });
    }
  }

  return result;
}

/**
 * Load the APEX configuration from a project
 */
export async function loadConfig(projectPath: string): Promise<ApexConfig> {
  const configPath = normalizePath(path.join(projectPath, APEX_DIR, CONFIG_FILE));
  const hooksPath = normalizePath(path.join(projectPath, APEX_DIR, 'hooks.yaml'));

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const rawConfig = yaml.parse(content);
    const config = ApexConfigSchema.parse(rawConfig);

    // Load tool hooks from .apex/hooks.yaml if present (overrides config.yaml)
    try {
      const hooksContent = await fs.readFile(hooksPath, 'utf-8');
      const hooksRaw = yaml.parse(hooksContent);
      const toolHooks = ToolHookConfigSchema.parse(hooksRaw);
      config.toolHooks = toolHooks;
    } catch (hookError) {
      if ((hookError as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to load tool hooks: ${hookError}`);
      }
    }

    // Load and merge tool aliases from config.yaml and .apex/tools/ directory
    try {
      const mergedAliases = await getMergedAliases(projectPath, config.aliases);
      // Convert merged aliases back to array format for storage in config
      config.aliases = Object.values(mergedAliases);
    } catch (aliasError) {
      throw new Error(`Failed to load tool aliases: ${aliasError}`);
    }

    // Validate container workspace configuration
    const containerValidation = await validateContainerWorkspaceConfig(config);

    // Throw error if validation fails with critical issues
    if (!containerValidation.valid) {
      const errorMessages = containerValidation.errors.map(error => {
        let message = error.message;
        if (error.suggestion) {
          message += `\n  Suggestion: ${error.suggestion}`;
        }
        return message;
      });

      throw new Error(`Container workspace configuration validation failed:\n${errorMessages.join('\n')}`);
    }

    // Log warnings if any (though we can't use console.warn in a library, we'll add them to the error if needed)
    if (containerValidation.warnings.length > 0) {
      const warningMessages = containerValidation.warnings.map(warning => {
        let message = warning.message;
        if (warning.suggestion) {
          message += `\n  Suggestion: ${warning.suggestion}`;
        }
        return message;
      });

      // For now, we'll include warnings in a special property on the config
      // In a future update, this could be handled by a logging system
      Object.defineProperty(config, '_containerWarnings', {
        value: warningMessages,
        enumerable: false,
        writable: false,
      });
    }

    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`APEX not initialized in ${projectPath}. Run 'apex init' first.`);
    }
    throw new Error(`Failed to load APEX config: ${error}`);
  }
}

/**
 * Save the APEX configuration
 */
export async function saveConfig(projectPath: string, config: ApexConfig): Promise<void> {
  const configPath = normalizePath(path.join(projectPath, APEX_DIR, CONFIG_FILE));
  const content = yaml.stringify(config, { indent: 2 });
  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Load all agent definitions from the project
 */
export async function loadAgents(
  projectPath: string
): Promise<Record<string, AgentDefinition>> {
  const agentsDir = normalizePath(path.join(projectPath, APEX_DIR, AGENTS_DIR));
  const agents: Record<string, AgentDefinition> = {};

  try {
    const files = await fs.readdir(agentsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = normalizePath(path.join(agentsDir, file));
      const content = await fs.readFile(filePath, 'utf-8');
      const agent = parseAgentMarkdown(content);

      if (agent) {
        agents[agent.name] = agent;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return agents;
}

/**
 * Parse agent definition from markdown with YAML frontmatter
 */
export function parseAgentMarkdown(content: string): AgentDefinition | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return null;
  }

  const [, frontmatter, body] = frontmatterMatch;
  const metadata = yaml.parse(frontmatter);

  // Parse tools from comma-separated string if needed
  let tools = metadata.tools;
  if (typeof tools === 'string') {
    tools = tools.split(',').map((t: string) => t.trim());
  }

  // Parse skills from comma-separated string if needed
  let skills = metadata.skills;
  if (typeof skills === 'string') {
    skills = skills.split(',').map((s: string) => s.trim());
  }

  const agentDef = {
    name: metadata.name,
    description: metadata.description,
    prompt: body.trim(),
    tools,
    model: metadata.model,
    skills,
  };

  return AgentDefinitionSchema.parse(agentDef);
}

/**
 * Load all workflow definitions from the project
 */
export async function loadWorkflows(
  projectPath: string
): Promise<Record<string, WorkflowDefinition>> {
  const workflowsDir = normalizePath(path.join(projectPath, APEX_DIR, WORKFLOWS_DIR));
  const workflows: Record<string, WorkflowDefinition> = {};

  try {
    const files = await fs.readdir(workflowsDir);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      const filePath = normalizePath(path.join(workflowsDir, file));
      const content = await fs.readFile(filePath, 'utf-8');
      const workflow = WorkflowDefinitionSchema.parse(yaml.parse(content));
      workflows[workflow.name] = workflow;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return workflows;
}

/**
 * Load a specific workflow by name
 */
export async function loadWorkflow(
  projectPath: string,
  workflowName: string
): Promise<WorkflowDefinition | null> {
  const workflows = await loadWorkflows(projectPath);
  return workflows[workflowName] || null;
}

/**
 * Load all tool aliases from the .apex/tools/ directory
 */
export async function loadToolAliases(
  projectPath: string
): Promise<Record<string, ToolAlias>> {
  const toolsDir = normalizePath(path.join(projectPath, APEX_DIR, TOOLS_DIR));
  const aliases: Record<string, ToolAlias> = {};

  try {
    const files = await fs.readdir(toolsDir);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      const filePath = normalizePath(path.join(toolsDir, file));
      const content = await fs.readFile(filePath, 'utf-8');
      const alias = ToolAliasSchema.parse(yaml.parse(content));
      aliases[alias.name] = alias;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return aliases;
}

/**
 * Get merged tool aliases from both config.yaml and .apex/tools/ directory
 * File-based aliases take precedence over config.yaml aliases
 */
export async function getMergedAliases(
  projectPath: string,
  configAliases: ToolAlias[] = []
): Promise<Record<string, ToolAlias>> {
  // Load aliases from .apex/tools/ directory
  const fileBasedAliases = await loadToolAliases(projectPath);

  // Create a merged collection, starting with config.yaml aliases
  const mergedAliases: Record<string, ToolAlias> = {};

  // First, add aliases from config.yaml
  for (const alias of configAliases) {
    mergedAliases[alias.name] = alias;
  }

  // Then, add/override with file-based aliases (these take precedence)
  for (const [name, alias] of Object.entries(fileBasedAliases)) {
    mergedAliases[name] = alias;
  }

  return mergedAliases;
}

/**
 * Get the path to a skill directory
 */
export function getSkillPath(projectPath: string, skillName: string): string {
  return normalizePath(path.join(projectPath, APEX_DIR, SKILLS_DIR, skillName, 'SKILL.md'));
}

/**
 * Load a skill's content
 */
export async function loadSkill(projectPath: string, skillName: string): Promise<string | null> {
  const skillPath = getSkillPath(projectPath, skillName);

  try {
    return await fs.readFile(skillPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Get the scripts directory path
 */
export function getScriptsDir(projectPath: string): string {
  return normalizePath(path.join(projectPath, APEX_DIR, SCRIPTS_DIR));
}

/**
 * List available scripts
 */
export async function listScripts(projectPath: string): Promise<string[]> {
  const scriptsDir = getScriptsDir(projectPath);

  try {
    const files = await fs.readdir(scriptsDir);
    return files.filter((f) => f.endsWith('.sh') || f.endsWith('.js') || f.endsWith('.ts'));
  } catch {
    return [];
  }
}

/**
 * Load MCP server configurations from config
 */
export function getMCPServers(config: ApexConfig): Record<string, MCPServerConfig> {
  return config.mcp?.servers || {};
}

/**
 * Get MCP configuration with defaults applied
 */
export function getMCPConfig(config: ApexConfig): MCPConfig {
  return {
    enabled: config.mcp?.enabled ?? true,
    servers: config.mcp?.servers || {},
    marketplace: config.mcp?.marketplace,
    connection: config.mcp?.connection,
    tools: config.mcp?.tools,
  };
}

/**
 * Check if MCP is enabled in the configuration
 */
export function isMCPEnabled(config: ApexConfig): boolean {
  return config.mcp?.enabled ?? true;
}

/**
 * Initialize APEX in a project directory
 */
export async function initializeApex(
  projectPath: string,
  options: {
    projectName: string;
    language?: string;
    framework?: string;
  }
): Promise<void> {
  const apexDir = normalizePath(path.join(projectPath, APEX_DIR));

  // Create directory structure
  await fs.mkdir(normalizePath(path.join(apexDir, AGENTS_DIR)), { recursive: true });
  await fs.mkdir(normalizePath(path.join(apexDir, WORKFLOWS_DIR)), { recursive: true });
  await fs.mkdir(normalizePath(path.join(apexDir, SKILLS_DIR)), { recursive: true });
  await fs.mkdir(normalizePath(path.join(apexDir, SCRIPTS_DIR)), { recursive: true });
  await fs.mkdir(normalizePath(path.join(apexDir, TOOLS_DIR)), { recursive: true });

  // Create default config - use schema.parse() to apply defaults
  const defaultConfig = ApexConfigSchema.parse({
    version: '1.0',
    project: {
      name: options.projectName,
      language: options.language,
      framework: options.framework,
    },
    autonomy: {
      level: 'review-before-commit',
      gates: [
        {
          type: 'before-commit',
          name: 'Code Review Gate',
          description: 'Requires approval before committing code changes',
          required: true,
        },
      ],
      limits: {
        maxCost: 10.0,
        maxTokens: 500000,
        maxTurns: 100,
        dailyBudget: 100.0,
        maxConcurrentTasks: 3,
      },
    },
    agents: {
      enabled: ['planner', 'architect', 'developer', 'reviewer', 'tester'],
    },
    models: {
      planning: 'opus',
      implementation: 'sonnet',
      review: 'haiku',
    },
    git: {
      branchPrefix: 'apex/',
      commitFormat: 'conventional',
      autoPush: true,
      defaultBranch: 'main',
    },
    limits: {
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      dailyBudget: 100.0,
      maxTurns: 100,
      maxConcurrentTasks: 3,
    },
    workspace: {
      defaultStrategy: 'none',
      cleanupOnComplete: true,
      container: {
        networkMode: 'bridge',
        autoRemove: true,
        resourceLimits: {
          cpu: 1,
          memory: '512m',
        },
      },
    },
    permissions: {
      preset: 'review-all',
    },
    policy: {
      enforcement: 'warn',
      allowedPaths: {
        mode: 'allowlist',
        allow: [
          'src/**',
          'lib/**',
          'tests/**',
          '*.md',
          '*.json',
          '*.js',
          '*.ts',
          '*.jsx',
          '*.tsx',
          'package.json',
          'tsconfig.json'
        ],
        block: [
          'node_modules/**',
          '.git/**',
          '**/*.log'
        ],
        sensitivePatterns: [
          '.env*',
          '**/*.key',
          '**/*.secret'
        ]
      },
      enabled: true
    },
    linter: {
      global: {
        enabled: true,
        runOnCommit: true,
        runOnPush: false,
        parallel: true,
        cache: true,
      },
      eslint: {
        enabled: true,
        autoFix: false,
        severity: 'warn',
      },
      prettier: {
        enabled: true,
        autoFix: false,
        severity: 'warn',
      },
      integrations: {
        preCommit: {
          enabled: true,
          linters: ['eslint', 'prettier'],
          autoFix: true,
          failOnError: true,
        },
        ci: {
          enabled: true,
          linters: ['eslint', 'prettier'],
          autoFix: false,
          failOnError: true,
        },
        ide: {
          enabled: true,
          autoFixOnSave: false,
          showInlineErrors: true,
          formatOnSave: false,
        },
      },
    },
    secretScanning: {
      enabled: true,
      enforcementMode: 'warn',
      customPatterns: [],
      includeBuiltInPatterns: true,
      excludePaths: [],
    },
    tdd: {
      enabled: false,
      testCommand: 'npm test',
      watchMode: false,
      maxIterations: 5,
      regressionGuard: true,
    },
    mcp: {
      enabled: true,
      servers: {},
      connection: {
        maxRetries: 3,
        retryDelayMs: 1000,
        connectionTimeoutMs: 10000,
        requestTimeoutMs: 30000,
        autoReconnect: true,
      },
    },
  });

  await saveConfig(projectPath, defaultConfig);

  // Copy template files if they exist
  await copyTemplateFiles(projectPath);
}

/**
 * Copy template files to project .apex directory
 */
async function copyTemplateFiles(projectPath: string): Promise<void> {
  const apexDir = normalizePath(path.join(projectPath, APEX_DIR));

  // Find the template directory - it could be in node_modules or the package directory
  const possibleTemplatePaths = [
    path.resolve(__dirname, '..', 'templates'), // Local development
    path.resolve(process.cwd(), 'node_modules', '@apexcli', 'core', 'templates'), // Installed package
    path.resolve(__dirname, 'templates'), // If built/distributed differently
  ];

  let templateDir: string | null = null;

  for (const templatePath of possibleTemplatePaths) {
    try {
      await fs.access(templatePath);
      templateDir = templatePath;
      break;
    } catch {
      // Directory doesn't exist, try next one
    }
  }

  if (!templateDir) {
    console.warn('Warning: Template directory not found. Skipping template file copying.');
    return;
  }

  // Copy agent templates
  try {
    const agentTemplatesDir = normalizePath(path.join(templateDir, 'agents'));
    const targetAgentsDir = normalizePath(path.join(apexDir, AGENTS_DIR));
    await copyDirectory(agentTemplatesDir, targetAgentsDir);
  } catch (error) {
    console.warn('Warning: Could not copy agent templates:', (error as Error).message);
  }

  // Copy workflow templates
  try {
    const workflowTemplatesDir = normalizePath(path.join(templateDir, 'workflows'));
    const targetWorkflowsDir = normalizePath(path.join(apexDir, WORKFLOWS_DIR));
    await copyDirectory(workflowTemplatesDir, targetWorkflowsDir);
  } catch (error) {
    console.warn('Warning: Could not copy workflow templates:', (error as Error).message);
  }
}

/**
 * Recursively copy a directory
 */
async function copyDirectory(source: string, destination: string): Promise<void> {
  try {
    await fs.access(source);
  } catch {
    return; // Source doesn't exist
  }

  await fs.mkdir(destination, { recursive: true });

  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = normalizePath(path.join(source, entry.name));
    const destPath = normalizePath(path.join(destination, entry.name));

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Get effective configuration by merging defaults with project config
 *
 * This function ensures all optional fields have default values, including:
 * - Policy configuration with sensible defaults for file access, test requirements, and approval rules
 * - Workspace, permissions, limits, and other configuration sections
 */
export function getEffectiveConfig(config: ApexConfig): Required<ApexConfig> {
  return {
    version: config.version,
    project: {
      name: config.project.name,
      language: config.project.language,
      framework: config.project.framework,
      testCommand: config.project.testCommand || 'npm test',
      lintCommand: config.project.lintCommand || 'npm run lint',
      buildCommand: config.project.buildCommand || 'npm run build',
      typecheckCommand: config.project.typecheckCommand || 'npm run typecheck',
    },
    autonomy: {
      level: config.autonomy?.level || 'review-before-commit',
      rejectionBehavior: config.autonomy?.rejectionBehavior || 'abort',
      gates: config.autonomy?.gates || [],
      limits: config.autonomy?.limits,
      stageOverrides: config.autonomy?.stageOverrides || {},
      agentOverrides: config.autonomy?.agentOverrides || {},
    },
    agents: {
      enabled: config.agents?.enabled || [],
      disabled: config.agents?.disabled || [],
    },
    models: {
      planning: config.models?.planning || 'opus',
      implementation: config.models?.implementation || 'sonnet',
      review: config.models?.review || 'haiku',
    },
    gates: config.gates || [],
    git: {
      branchPrefix: config.git?.branchPrefix || 'apex/',
      commitFormat: config.git?.commitFormat || 'conventional',
      autoPush: config.git?.autoPush ?? true,
      defaultBranch: config.git?.defaultBranch || 'main',
      commitAfterSubtask: config.git?.commitAfterSubtask ?? true,
      pushAfterTask: config.git?.pushAfterTask ?? true,
      createPR: config.git?.createPR || 'always',
      prDraft: config.git?.prDraft ?? false,
      prLabels: config.git?.prLabels,
      prReviewers: config.git?.prReviewers,
      autoWorktree: config.git?.autoWorktree ?? false,
      worktree: config.git?.worktree,
    },
    limits: {
      maxTokensPerTask: config.limits?.maxTokensPerTask || 500000,
      maxCostPerTask: config.limits?.maxCostPerTask || 10.0,
      maxExecutionTime: config.limits?.maxExecutionTime ?? 0,
      maxFileChanges: config.limits?.maxFileChanges ?? 0,
      dailyBudget: config.limits?.dailyBudget || 100.0,
      maxTurns: config.limits?.maxTurns || 100,
      maxConcurrentTasks: config.limits?.maxConcurrentTasks || 3,
      maxRetries: config.limits?.maxRetries ?? 3,
      retryDelayMs: config.limits?.retryDelayMs ?? 1000,
      retryBackoffFactor: config.limits?.retryBackoffFactor ?? 2,
    },
    api: {
      url: config.api?.url || 'http://localhost:3000',
      port: config.api?.port || 3000,
      autoStart: config.api?.autoStart ?? false,
    },
    ui: {
      previewMode: config.ui?.previewMode ?? true,
      previewConfidence: config.ui?.previewConfidence ?? 0.7,
      autoExecuteHighConfidence: config.ui?.autoExecuteHighConfidence ?? false,
      previewTimeout: config.ui?.previewTimeout ?? 5000,
      diffPreview: config.ui?.diffPreview ?? true,
    },
    webUI: {
      port: config.webUI?.port || 3001,
      autoStart: config.webUI?.autoStart ?? false,
    },
    daemon: {
      pollInterval: config.daemon?.pollInterval ?? 5000,
      autoStart: config.daemon?.autoStart ?? false,
      logLevel: config.daemon?.logLevel || 'info',
      installAsService: config.daemon?.installAsService ?? false,
      serviceName: config.daemon?.serviceName || 'apex-daemon',
      service: config.daemon?.service,
      healthCheck: config.daemon?.healthCheck,
      watchdog: config.daemon?.watchdog,
      timeBasedUsage: config.daemon?.timeBasedUsage,
      sessionRecovery: config.daemon?.sessionRecovery,
      idleProcessing: config.daemon?.idleProcessing,
      orphanDetection: config.daemon?.orphanDetection,
      services: config.daemon?.services,
      taskRestart: config.daemon?.taskRestart,
    },
    documentation: {
      enabled: config.documentation?.enabled ?? true,
      outdatedDocs: config.documentation?.outdatedDocs,
      jsdocAnalysis: config.documentation?.jsdocAnalysis,
    },
    workspace: {
      defaultStrategy: config.workspace?.defaultStrategy || 'none',
      cleanupOnComplete: config.workspace?.cleanupOnComplete ?? true,
      container: {
        image: config.workspace?.container?.image,
        resourceLimits: config.workspace?.container?.resourceLimits,
        networkMode: config.workspace?.container?.networkMode || 'bridge',
        environment: config.workspace?.container?.environment,
        autoRemove: config.workspace?.container?.autoRemove ?? true,
        installTimeout: config.workspace?.container?.installTimeout,
      },
    },
    permissions: {
      preset: config.permissions?.preset || 'review-all',
      customRules: config.permissions?.customRules || [],
    },
    policy: {
      version: config.policy?.version || '1.0',
      name: config.policy?.name,
      description: config.policy?.description,
      enforcement: config.policy?.enforcement || 'warn',
      allowedPaths: {
        mode: config.policy?.allowedPaths?.mode || 'allowlist',
        allow: config.policy?.allowedPaths?.allow || [
          'src/**',
          'lib/**',
          'tests/**',
          '*.md',
          '*.json',
          '*.js',
          '*.ts',
          '*.jsx',
          '*.tsx',
          'package.json',
          'tsconfig.json',
          'jest.config.*',
          'webpack.config.*',
          'vite.config.*',
          'rollup.config.*'
        ],
        block: config.policy?.allowedPaths?.block || [
          'node_modules/**',
          '.git/**',
          '**/*.log',
          '**/*.tmp',
          'coverage/**',
          'dist/**',
          'build/**'
        ],
        sensitivePatterns: config.policy?.allowedPaths?.sensitivePatterns || [
          '.env*',
          '**/*.key',
          '**/*.pem',
          '**/*.p12',
          '**/*.secret',
          '**/secrets/**',
          '**/.aws/**',
          '**/.ssh/**'
        ],
        followSymlinks: config.policy?.allowedPaths?.followSymlinks ?? false,
        maxDepth: config.policy?.allowedPaths?.maxDepth ?? 10,
      },
      requiredTests: {
        enforcement: config.policy?.requiredTests?.enforcement || 'warn',
        rules: config.policy?.requiredTests?.rules || [],
        testCommand: config.policy?.requiredTests?.testCommand,
        coverageCommand: config.policy?.requiredTests?.coverageCommand,
        coverageReportPath: config.policy?.requiredTests?.coverageReportPath,
        excludePatterns: config.policy?.requiredTests?.excludePatterns || [
          '**/*.d.ts',
          '**/*.config.*',
          '**/index.ts',
          '**/index.js'
        ],
        blockOnFailure: config.policy?.requiredTests?.blockOnFailure ?? true,
      },
      approvalRules: {
        enabled: config.policy?.approvalRules?.enabled ?? true,
        rules: config.policy?.approvalRules?.rules || [],
        defaultTimeoutMinutes: config.policy?.approvalRules?.defaultTimeoutMinutes ?? 60,
        defaultTimeoutAction: config.policy?.approvalRules?.defaultTimeoutAction || 'reject',
        globalApprovers: config.policy?.approvalRules?.globalApprovers || [],
        notificationsEnabled: config.policy?.approvalRules?.notificationsEnabled ?? true,
        notificationChannels: {
          slack: config.policy?.approvalRules?.notificationChannels?.slack,
          email: config.policy?.approvalRules?.notificationChannels?.email,
          webhook: config.policy?.approvalRules?.notificationChannels?.webhook,
        },
        auditLog: config.policy?.approvalRules?.auditLog ?? true,
        auditLogPath: config.policy?.approvalRules?.auditLogPath || 'approval-audit.log',
      },
      enabled: config.policy?.enabled ?? true,
      tags: config.policy?.tags || [],
      metadata: config.policy?.metadata || {},
    },
    codeQuality: {
      preEditValidation: {
        enabled: config.codeQuality?.preEditValidation?.enabled ?? false,
        mode: config.codeQuality?.preEditValidation?.mode || 'warn',
      },
      typecheck: {
        enabled: config.codeQuality?.typecheck?.enabled ?? false,
        runAfterEdit: config.codeQuality?.typecheck?.runAfterEdit ?? false,
        command: config.codeQuality?.typecheck?.command || config.project.typecheckCommand || 'npm run typecheck',
        timeoutMs: config.codeQuality?.typecheck?.timeoutMs ?? 60000,
        failOnError: config.codeQuality?.typecheck?.failOnError ?? false,
      },
    },
    linter: {
      global: {
        enabled: config.linter?.global?.enabled ?? true,
        runOnCommit: config.linter?.global?.runOnCommit ?? true,
        runOnPush: config.linter?.global?.runOnPush ?? false,
        runOnSave: config.linter?.global?.runOnSave ?? false,
        runAfterEdit: config.linter?.global?.runAfterEdit ?? false,
        parallel: config.linter?.global?.parallel ?? true,
        maxConcurrency: config.linter?.global?.maxConcurrency ?? 4,
        failFast: config.linter?.global?.failFast ?? false,
        cache: config.linter?.global?.cache ?? true,
        cacheDirectory: config.linter?.global?.cacheDirectory || '.apex/cache/linters',
        workingDirectory: config.linter?.global?.workingDirectory,
        timeoutMs: config.linter?.global?.timeoutMs ?? 60000,
      },
      eslint: {
        enabled: config.linter?.eslint?.enabled ?? true,
        configPath: config.linter?.eslint?.configPath,
        include: config.linter?.eslint?.include || [
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
        ],
        exclude: config.linter?.eslint?.exclude || [
          'node_modules/**',
          'dist/**',
          'build/**',
          'coverage/**',
          '*.d.ts'
        ],
        autoFix: config.linter?.eslint?.autoFix ?? false,
        maxWarnings: config.linter?.eslint?.maxWarnings ?? 0,
        cliOptions: config.linter?.eslint?.cliOptions || [],
        environments: config.linter?.eslint?.environments || ['node', 'es2022'],
        parserOptions: config.linter?.eslint?.parserOptions,
        severity: config.linter?.eslint?.severity || 'warn',
      },
      prettier: {
        enabled: config.linter?.prettier?.enabled ?? true,
        configPath: config.linter?.prettier?.configPath,
        include: config.linter?.prettier?.include || [
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
        ],
        exclude: config.linter?.prettier?.exclude || [
          'node_modules/**',
          'dist/**',
          'build/**',
          'coverage/**',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml'
        ],
        autoFix: config.linter?.prettier?.autoFix ?? false,
        options: config.linter?.prettier?.options,
        severity: config.linter?.prettier?.severity || 'warn',
      },
      custom: config.linter?.custom || [],
      order: config.linter?.order || ['eslint', 'prettier'],
      integrations: {
        preCommit: {
          enabled: config.linter?.integrations?.preCommit?.enabled ?? true,
          linters: config.linter?.integrations?.preCommit?.linters || ['eslint', 'prettier'],
          autoFix: config.linter?.integrations?.preCommit?.autoFix ?? true,
          failOnError: config.linter?.integrations?.preCommit?.failOnError ?? true,
        },
        ci: {
          enabled: config.linter?.integrations?.ci?.enabled ?? true,
          linters: config.linter?.integrations?.ci?.linters || ['eslint', 'prettier'],
          autoFix: config.linter?.integrations?.ci?.autoFix ?? false,
          failOnError: config.linter?.integrations?.ci?.failOnError ?? true,
          uploadReports: config.linter?.integrations?.ci?.uploadReports ?? false,
          reportFormat: config.linter?.integrations?.ci?.reportFormat || 'json',
        },
        ide: {
          enabled: config.linter?.integrations?.ide?.enabled ?? true,
          autoFixOnSave: config.linter?.integrations?.ide?.autoFixOnSave ?? false,
          showInlineErrors: config.linter?.integrations?.ide?.showInlineErrors ?? true,
          formatOnSave: config.linter?.integrations?.ide?.formatOnSave ?? false,
        },
      },
    },
    /**
     * Secret scanner configuration for detecting sensitive information in tool outputs.
     * The scanner can detect API keys, passwords, tokens, and other secrets.
     * Default behavior is 'warn' which logs warnings but doesn't block execution.
     */
    scanner: {
      customPatterns: config.scanner?.customPatterns || [],
      includeBuiltInPatterns: config.scanner?.includeBuiltInPatterns ?? true,
      maxLineLength: config.scanner?.maxLineLength ?? 10000,
      maskSecrets: config.scanner?.maskSecrets ?? true,
      contextLength: config.scanner?.contextLength ?? 20,
      onSecretDetected: config.scanner?.onSecretDetected || 'warn',
    },
    /**
     * Secret scanning configuration with enforcement mode control.
     * Provides a simplified interface for configuring secret detection.
     */
    secretScanning: {
      enabled: config.secretScanning?.enabled ?? true,
      enforcementMode: config.secretScanning?.enforcementMode || 'warn',
      customPatterns: config.secretScanning?.customPatterns || [],
      includeBuiltInPatterns: config.secretScanning?.includeBuiltInPatterns ?? true,
      excludePaths: config.secretScanning?.excludePaths || [],
    },
    toolActionRetention: {
      maxActionsPerTask: config.toolActionRetention?.maxActionsPerTask ?? 1000,
      maxAgeDays: config.toolActionRetention?.maxAgeDays ?? 30,
      keepUndoneSnapshots: config.toolActionRetention?.keepUndoneSnapshots ?? false,
      maxSnapshotStorageMB: config.toolActionRetention?.maxSnapshotStorageMB ?? 100,
    },
    policies: config.policies || [],
    projectRules: config.projectRules || [],
    hooks: config.hooks || [],
    toolHooks: config.toolHooks ? {
      pre: config.toolHooks.pre || [],
      post: config.toolHooks.post || [],
      enabled: config.toolHooks.enabled ?? true,
      defaultTimeoutMs: config.toolHooks.defaultTimeoutMs ?? 30000,
    } : {
      pre: [],
      post: [],
      enabled: true,
      defaultTimeoutMs: 30000,
    },
    tools: config.tools || {},
    customTools: config.customTools || [],
    mcp: config.mcp ? {
      enabled: config.mcp.enabled ?? true,
      servers: config.mcp.servers || {},
      marketplace: config.mcp.marketplace ? {
        url: config.mcp.marketplace.url,
        enabled: config.mcp.marketplace.enabled ?? true,
        refreshIntervalMinutes: config.mcp.marketplace.refreshIntervalMinutes ?? 1440,
        allowUnverified: config.mcp.marketplace.allowUnverified ?? false,
      } : undefined,
      connection: config.mcp.connection ? {
        maxRetries: config.mcp.connection.maxRetries ?? 3,
        retryDelayMs: config.mcp.connection.retryDelayMs ?? 1000,
        backoffFactor: config.mcp.connection.backoffFactor ?? 2,
        maxRetryDelayMs: config.mcp.connection.maxRetryDelayMs ?? 30000,
        connectionTimeoutMs: config.mcp.connection.connectionTimeoutMs ?? 10000,
        requestTimeoutMs: config.mcp.connection.requestTimeoutMs ?? 30000,
        idleTimeoutMs: config.mcp.connection.idleTimeoutMs ?? 300000,
        poolSize: config.mcp.connection.poolSize ?? 1,
        poolMinSize: config.mcp.connection.poolMinSize ?? 0,
        healthCheckIntervalMs: config.mcp.connection.healthCheckIntervalMs ?? 30000,
        healthCheckTimeoutMs: config.mcp.connection.healthCheckTimeoutMs ?? 5000,
        healthCheckFailureThreshold: config.mcp.connection.healthCheckFailureThreshold ?? 3,
        autoReconnect: config.mcp.connection.autoReconnect ?? true,
        keepAlive: config.mcp.connection.keepAlive ?? true,
        keepAliveIntervalMs: config.mcp.connection.keepAliveIntervalMs ?? 15000,
        heartbeatEnabled: config.mcp.connection.heartbeatEnabled ?? true,
        heartbeatIntervalMs: config.mcp.connection.heartbeatIntervalMs ?? 30000,
      } : undefined,
    } : {
      enabled: true,
      servers: {},
      marketplace: undefined,
      connection: undefined,
    },
    tdd: config.tdd ? {
      enabled: config.tdd.enabled ?? false,
      testCommand: config.tdd.testCommand || config.project.testCommand || 'npm test',
      watchMode: config.tdd.watchMode ?? false,
      maxIterations: config.tdd.maxIterations ?? 5,
      regressionGuard: config.tdd.regressionGuard ?? true,
    } : {
      enabled: false,
      testCommand: config.project.testCommand || 'npm test',
      watchMode: false,
      maxIterations: 5,
      regressionGuard: true,
    },
    visualRegression: config.visualRegression ? {
      enabled: config.visualRegression.enabled ?? false,
      threshold: config.visualRegression.threshold ?? 0.99,
      diffColor: config.visualRegression.diffColor ?? [255, 0, 255],
      snapshotDir: config.visualRegression.snapshotDir || '.apex/snapshots',
      failOnMismatch: config.visualRegression.failOnMismatch ?? true,
      includeAlpha: config.visualRegression.includeAlpha ?? false,
      outputDiff: config.visualRegression.outputDiff ?? false,
      diffOutputPath: config.visualRegression.diffOutputPath,
    } : {
      enabled: false,
      threshold: 0.99,
      diffColor: [255, 0, 255] as [number, number, number],
      snapshotDir: '.apex/snapshots',
      failOnMismatch: true,
      includeAlpha: false,
      outputDiff: false,
      diffOutputPath: undefined,
    },
    guardrails: config.guardrails ? {
      enabled: config.guardrails.enabled ?? true,
      enforcement: config.guardrails.enforcement || 'warn',
      policies: config.guardrails.policies,
      secrets: config.guardrails.secrets,
      reporting: config.guardrails.reporting,
      pathAccess: config.guardrails.pathAccess,
      metadata: config.guardrails.metadata || {},
    } : {
      enabled: true,
      enforcement: 'warn',
      policies: undefined,
      secrets: undefined,
      reporting: undefined,
      pathAccess: undefined,
      metadata: {},
    },
    aliases: config.aliases || [],
    logging: config.logging ? {
      level: config.logging.level || 'info',
      format: config.logging.format || 'auto',
      packageLevels: config.logging.packageLevels || {},
      file: config.logging.file,
      daemon: config.logging.daemon,
      timestamps: config.logging.timestamps ?? true,
      stackTraces: config.logging.stackTraces ?? true,
      redactFields: config.logging.redactFields || ['password', 'token', 'secret', 'apiKey', 'authorization'],
    } : {
      level: 'info',
      format: 'auto',
      packageLevels: {},
      file: undefined,
      daemon: undefined,
      timestamps: true,
      stackTraces: true,
      redactFields: ['password', 'token', 'secret', 'apiKey', 'authorization'],
    },
  };
}
