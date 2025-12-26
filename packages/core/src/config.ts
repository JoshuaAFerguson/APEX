import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  ApexConfig,
  ApexConfigSchema,
  AgentDefinition,
  AgentDefinitionSchema,
  WorkflowDefinition,
  WorkflowDefinitionSchema,
} from './types';
import { containerRuntime, ContainerRuntimeType } from './container-runtime';

const APEX_DIR = '.apex';
const CONFIG_FILE = 'config.yaml';
const AGENTS_DIR = 'agents';
const WORKFLOWS_DIR = 'workflows';
const SKILLS_DIR = 'skills';
const SCRIPTS_DIR = 'scripts';

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
  const apexDir = path.join(projectPath, APEX_DIR);
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
  const configPath = path.join(projectPath, APEX_DIR, CONFIG_FILE);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const rawConfig = yaml.parse(content);
    const config = ApexConfigSchema.parse(rawConfig);

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
  const configPath = path.join(projectPath, APEX_DIR, CONFIG_FILE);
  const content = yaml.stringify(config, { indent: 2 });
  await fs.writeFile(configPath, content, 'utf-8');
}

/**
 * Load all agent definitions from the project
 */
export async function loadAgents(
  projectPath: string
): Promise<Record<string, AgentDefinition>> {
  const agentsDir = path.join(projectPath, APEX_DIR, AGENTS_DIR);
  const agents: Record<string, AgentDefinition> = {};

  try {
    const files = await fs.readdir(agentsDir);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(agentsDir, file);
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
  const workflowsDir = path.join(projectPath, APEX_DIR, WORKFLOWS_DIR);
  const workflows: Record<string, WorkflowDefinition> = {};

  try {
    const files = await fs.readdir(workflowsDir);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      const filePath = path.join(workflowsDir, file);
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
 * Get the path to a skill directory
 */
export function getSkillPath(projectPath: string, skillName: string): string {
  return path.join(projectPath, APEX_DIR, SKILLS_DIR, skillName, 'SKILL.md');
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
  return path.join(projectPath, APEX_DIR, SCRIPTS_DIR);
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
  const apexDir = path.join(projectPath, APEX_DIR);

  // Create directory structure
  await fs.mkdir(path.join(apexDir, AGENTS_DIR), { recursive: true });
  await fs.mkdir(path.join(apexDir, WORKFLOWS_DIR), { recursive: true });
  await fs.mkdir(path.join(apexDir, SKILLS_DIR), { recursive: true });
  await fs.mkdir(path.join(apexDir, SCRIPTS_DIR), { recursive: true });

  // Create default config - use schema.parse() to apply defaults
  const defaultConfig = ApexConfigSchema.parse({
    version: '1.0',
    project: {
      name: options.projectName,
      language: options.language,
      framework: options.framework,
    },
    autonomy: {
      default: 'review-before-merge',
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
  });

  await saveConfig(projectPath, defaultConfig);
}

/**
 * Get effective configuration by merging defaults with project config
 */
export function getEffectiveConfig(config: ApexConfig): Required<ApexConfig> {
  return {
    version: config.version,
    project: config.project,
    autonomy: {
      default: config.autonomy?.default || 'review-before-merge',
      overrides: config.autonomy?.overrides || {},
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
    },
    limits: {
      maxTokensPerTask: config.limits?.maxTokensPerTask || 500000,
      maxCostPerTask: config.limits?.maxCostPerTask || 10.0,
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
  };
}
