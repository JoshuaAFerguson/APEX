import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { z } from 'zod';
import {
  ApexConfigSchema,
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  DoctorCheckResult,
} from './types';
import { createDoctorCheckResult } from './doctor-utils';
import {
  loadConfig,
  loadAgents,
  loadWorkflows,
  parseAgentMarkdown,
  isApexInitialized
} from './config';
import { normalizePath } from './path-utils';

// ============================================================================
// Constants
// ============================================================================

const APEX_DIR = '.apex';
const CONFIG_FILE = 'config.yaml';
const AGENTS_DIR = 'agents';
const WORKFLOWS_DIR = 'workflows';
const SKILLS_DIR = 'skills';
const SCRIPTS_DIR = 'scripts';
const TOOLS_DIR = 'tools';

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation result for a specific aspect of APEX configuration
 */
export interface ConfigValidationResult {
  /** Whether this aspect is valid */
  valid: boolean;
  /** List of validation errors found */
  errors: ConfigValidationError[];
  /** List of validation warnings found */
  warnings: ConfigValidationWarning[];
  /** Optional additional details about the validation */
  details?: Record<string, any>;
}

/**
 * Represents a validation error in APEX configuration
 */
export interface ConfigValidationError {
  /** The type/category of validation error */
  type: string;
  /** Human-readable error message */
  message: string;
  /** Optional file path where the error occurred */
  filePath?: string;
  /** Optional suggestion for fixing the error */
  suggestion?: string;
}

/**
 * Represents a validation warning in APEX configuration
 */
export interface ConfigValidationWarning {
  /** The type/category of validation warning */
  type: string;
  /** Human-readable warning message */
  message: string;
  /** Optional file path where the warning occurred */
  filePath?: string;
  /** Optional suggestion for addressing the warning */
  suggestion?: string;
}

/**
 * Complete APEX configuration validation result
 */
export interface ApexConfigValidationResult {
  /** Overall validation status */
  valid: boolean;
  /** Directory structure validation */
  directory: ConfigValidationResult;
  /** Config.yaml validation */
  config: ConfigValidationResult;
  /** Agent definitions validation */
  agents: ConfigValidationResult;
  /** Workflow definitions validation */
  workflows: ConfigValidationResult;
  /** Summary of all issues found */
  summary: {
    totalErrors: number;
    totalWarnings: number;
    criticalIssues: string[];
  };
}

// ============================================================================
// Directory Structure Validation
// ============================================================================

/**
 * Validates the .apex directory structure exists and is properly set up
 */
export async function validateApexDirectoryStructure(projectPath: string): Promise<ConfigValidationResult> {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: {}
  };

  const apexDir = normalizePath(path.join(projectPath, APEX_DIR));

  // Check if .apex directory exists
  try {
    const stats = await fs.stat(apexDir);
    if (!stats.isDirectory()) {
      result.valid = false;
      result.errors.push({
        type: 'invalid_apex_directory',
        message: '.apex exists but is not a directory',
        filePath: apexDir,
        suggestion: 'Remove the .apex file and run "apex init" to initialize APEX properly'
      });
      return result;
    }
    result.details.apexDirExists = true;
  } catch (error) {
    result.valid = false;
    result.errors.push({
      type: 'missing_apex_directory',
      message: '.apex directory does not exist',
      filePath: apexDir,
      suggestion: 'Run "apex init" to initialize APEX in this project'
    });
    return result;
  }

  // Check for required subdirectories
  const requiredDirs = [
    { name: AGENTS_DIR, required: false, description: 'agent definitions' },
    { name: WORKFLOWS_DIR, required: false, description: 'workflow definitions' },
    { name: SKILLS_DIR, required: false, description: 'reusable skills' },
    { name: SCRIPTS_DIR, required: false, description: 'automation scripts' },
    { name: TOOLS_DIR, required: false, description: 'tool aliases' }
  ];

  const existingDirs: string[] = [];
  const missingDirs: string[] = [];

  for (const dir of requiredDirs) {
    const dirPath = normalizePath(path.join(apexDir, dir.name));
    try {
      const stats = await fs.stat(dirPath);
      if (stats.isDirectory()) {
        existingDirs.push(dir.name);
      } else {
        result.warnings.push({
          type: 'invalid_subdirectory',
          message: `${dir.name} exists but is not a directory`,
          filePath: dirPath,
          suggestion: `Remove the ${dir.name} file and let APEX create the directory as needed`
        });
      }
    } catch (error) {
      if (dir.required) {
        result.valid = false;
        result.errors.push({
          type: 'missing_required_directory',
          message: `Required directory ${dir.name} is missing`,
          filePath: dirPath,
          suggestion: `Create the ${dir.name} directory for ${dir.description}`
        });
      } else {
        missingDirs.push(dir.name);
      }
    }
  }

  result.details.existingDirectories = existingDirs;
  result.details.missingDirectories = missingDirs;

  // Add informational warning about missing optional directories
  if (missingDirs.length > 0) {
    result.warnings.push({
      type: 'missing_optional_directories',
      message: `Optional directories not found: ${missingDirs.join(', ')}`,
      suggestion: 'These directories will be created automatically when needed'
    });
  }

  return result;
}

// ============================================================================
// Config.yaml Validation
// ============================================================================

/**
 * Validates the main config.yaml file structure and content
 */
export async function validateApexConfigFile(projectPath: string): Promise<ConfigValidationResult> {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: {}
  };

  const configPath = normalizePath(path.join(projectPath, APEX_DIR, CONFIG_FILE));

  // Check if config file exists
  try {
    await fs.access(configPath);
    result.details.configFileExists = true;
  } catch (error) {
    result.valid = false;
    result.errors.push({
      type: 'missing_config_file',
      message: 'config.yaml file is missing',
      filePath: configPath,
      suggestion: 'Run "apex init" to create a default configuration file'
    });
    return result;
  }

  // Attempt to read and parse the config file
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    result.details.configFileReadable = true;

    // Parse YAML
    let rawConfig: any;
    try {
      rawConfig = yaml.parse(configContent);
      result.details.yamlValid = true;
    } catch (yamlError) {
      result.valid = false;
      result.errors.push({
        type: 'invalid_yaml',
        message: `Invalid YAML syntax: ${yamlError instanceof Error ? yamlError.message : 'Unknown YAML error'}`,
        filePath: configPath,
        suggestion: 'Fix the YAML syntax errors in config.yaml'
      });
      return result;
    }

    // Validate against schema
    try {
      const config = ApexConfigSchema.parse(rawConfig);
      result.details.schemaValid = true;
      result.details.configSummary = {
        projectName: config.project.name,
        language: config.project.language,
        framework: config.project.framework,
        autonomyLevel: config.autonomy?.level,
        enabledAgents: config.agents?.enabled?.length || 0
      };

      // Additional semantic validation
      validateConfigSemantics(config, result);

    } catch (schemaError) {
      result.valid = false;

      if (schemaError instanceof z.ZodError) {
        // Convert Zod errors to user-friendly messages
        for (const issue of schemaError.errors) {
          const fieldPath = issue.path.join('.');
          result.errors.push({
            type: 'schema_validation_error',
            message: `Invalid configuration at '${fieldPath}': ${issue.message}`,
            filePath: configPath,
            suggestion: getConfigFieldSuggestion(fieldPath, issue.code)
          });
        }
      } else {
        result.errors.push({
          type: 'schema_validation_error',
          message: `Configuration validation failed: ${schemaError instanceof Error ? schemaError.message : 'Unknown validation error'}`,
          filePath: configPath,
          suggestion: 'Check the configuration against the APEX schema requirements'
        });
      }
    }

  } catch (readError) {
    result.valid = false;
    result.errors.push({
      type: 'config_read_error',
      message: `Cannot read config file: ${readError instanceof Error ? readError.message : 'Unknown read error'}`,
      filePath: configPath,
      suggestion: 'Check file permissions and ensure the config file is not corrupted'
    });
  }

  return result;
}

/**
 * Performs additional semantic validation on the parsed config
 */
function validateConfigSemantics(config: any, result: ConfigValidationResult): void {
  // Check for common configuration issues

  // Validate project settings
  if (!config.project?.name?.trim()) {
    result.warnings.push({
      type: 'missing_project_name',
      message: 'Project name is empty or missing',
      suggestion: 'Set a meaningful project name in project.name'
    });
  }

  if (!config.project?.language) {
    result.warnings.push({
      type: 'missing_language',
      message: 'Project language is not specified',
      suggestion: 'Set the primary programming language in project.language'
    });
  }

  // Validate autonomy settings
  if (config.autonomy?.limits?.maxCostPerTask && config.autonomy?.limits?.maxCostPerTask < 0.1) {
    result.warnings.push({
      type: 'low_cost_limit',
      message: 'Maximum cost per task is set very low (< $0.10)',
      suggestion: 'Consider increasing maxCostPerTask to allow for meaningful AI operations'
    });
  }

  // Validate enabled agents
  if (config.agents?.enabled && config.agents.enabled.length === 0) {
    result.warnings.push({
      type: 'no_agents_enabled',
      message: 'No agents are enabled',
      suggestion: 'Enable at least one agent (e.g., planner, developer) in agents.enabled'
    });
  }

  // Validate model assignments
  if (config.models?.planning === config.models?.implementation &&
      config.models?.implementation === config.models?.review) {
    result.warnings.push({
      type: 'same_model_all_stages',
      message: 'All workflow stages use the same model',
      suggestion: 'Consider using different models for planning (opus), implementation (sonnet), and review (haiku) for better cost/performance balance'
    });
  }
}

/**
 * Provides helpful suggestions for common config field validation errors
 */
function getConfigFieldSuggestion(fieldPath: string, errorCode: string): string {
  const suggestions: Record<string, string> = {
    'project.name': 'Set a descriptive project name (e.g., "my-web-app")',
    'project.language': 'Specify the primary language (e.g., "typescript", "javascript", "python")',
    'autonomy.level': 'Use one of: "full-autonomy", "review-before-commit", "review-before-major-changes", or "review-all"',
    'agents.enabled': 'Provide an array of agent names (e.g., ["planner", "developer", "reviewer"])',
    'models.planning': 'Use "opus", "sonnet", or "haiku"',
    'models.implementation': 'Use "opus", "sonnet", or "haiku"',
    'models.review': 'Use "opus", "sonnet", or "haiku"',
    'git.branchPrefix': 'Set a prefix for branches (e.g., "feature/", "apex/")',
    'limits.maxCostPerTask': 'Set a positive number for maximum cost (e.g., 10.0)',
    'limits.maxTokensPerTask': 'Set a positive integer for maximum tokens (e.g., 500000)'
  };

  return suggestions[fieldPath] || 'Check the APEX configuration documentation for valid values';
}

// ============================================================================
// Agent Definitions Validation
// ============================================================================

/**
 * Validates all agent definition files in .apex/agents/
 */
export async function validateAgentDefinitions(projectPath: string): Promise<ConfigValidationResult> {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: { validAgents: [], invalidAgents: [], totalFiles: 0 }
  };

  const agentsDir = normalizePath(path.join(projectPath, APEX_DIR, AGENTS_DIR));

  // Check if agents directory exists
  try {
    await fs.access(agentsDir);
  } catch (error) {
    // Not an error - agents directory is optional
    result.warnings.push({
      type: 'missing_agents_directory',
      message: 'agents directory does not exist',
      suggestion: 'Create .apex/agents/ directory and add agent definition files (.md)'
    });
    return result;
  }

  // Read all .md files in the agents directory
  try {
    const files = await fs.readdir(agentsDir);
    const mdFiles = files.filter(file => file.endsWith('.md'));
    result.details.totalFiles = mdFiles.length;

    if (mdFiles.length === 0) {
      result.warnings.push({
        type: 'no_agent_files',
        message: 'No agent definition files (.md) found in agents directory',
        suggestion: 'Add agent definition files with YAML frontmatter and markdown content'
      });
      return result;
    }

    // Validate each agent file
    for (const file of mdFiles) {
      const filePath = normalizePath(path.join(agentsDir, file));
      await validateSingleAgentFile(filePath, result);
    }

  } catch (error) {
    result.errors.push({
      type: 'agents_directory_read_error',
      message: `Cannot read agents directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      filePath: agentsDir,
      suggestion: 'Check directory permissions'
    });
    result.valid = false;
  }

  return result;
}

/**
 * Validates a single agent definition file
 */
async function validateSingleAgentFile(filePath: string, result: ConfigValidationResult): Promise<void> {
  const fileName = path.basename(filePath);

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Try to parse the agent markdown
    try {
      const agent = parseAgentMarkdown(content);

      if (!agent) {
        result.errors.push({
          type: 'invalid_agent_format',
          message: `Agent file ${fileName} does not have valid YAML frontmatter`,
          filePath,
          suggestion: 'Add YAML frontmatter with agent metadata (name, description, tools, etc.)'
        });
        (result.details.invalidAgents as string[]).push(fileName);
        return;
      }

      // Additional validation
      if (!agent.name.trim()) {
        result.errors.push({
          type: 'missing_agent_name',
          message: `Agent ${fileName} has empty or missing name`,
          filePath,
          suggestion: 'Set a unique agent name in the frontmatter'
        });
        (result.details.invalidAgents as string[]).push(fileName);
        return;
      }

      if (!agent.description?.trim()) {
        result.warnings.push({
          type: 'missing_agent_description',
          message: `Agent ${agent.name} has no description`,
          filePath,
          suggestion: 'Add a description explaining what this agent does'
        });
      }

      if (!agent.tools || agent.tools.length === 0) {
        result.warnings.push({
          type: 'no_agent_tools',
          message: `Agent ${agent.name} has no tools defined`,
          filePath,
          suggestion: 'Define tools this agent can use (e.g., Read, Write, Edit, Bash)'
        });
      }

      if (!agent.prompt?.trim()) {
        result.errors.push({
          type: 'missing_agent_prompt',
          message: `Agent ${agent.name} has no prompt/instructions`,
          filePath,
          suggestion: 'Add markdown content with detailed instructions for this agent'
        });
        (result.details.invalidAgents as string[]).push(fileName);
        return;
      }

      (result.details.validAgents as string[]).push(agent.name);

    } catch (parseError) {
      result.errors.push({
        type: 'agent_parse_error',
        message: `Failed to parse agent file ${fileName}: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
        filePath,
        suggestion: 'Check YAML frontmatter syntax and markdown formatting'
      });
      (result.details.invalidAgents as string[]).push(fileName);
      result.valid = false;
    }

  } catch (readError) {
    result.errors.push({
      type: 'agent_file_read_error',
      message: `Cannot read agent file ${fileName}: ${readError instanceof Error ? readError.message : 'Unknown error'}`,
      filePath,
      suggestion: 'Check file permissions and encoding'
    });
    (result.details.invalidAgents as string[]).push(fileName);
    result.valid = false;
  }
}

// ============================================================================
// Workflow Definitions Validation
// ============================================================================

/**
 * Validates all workflow definition files in .apex/workflows/
 */
export async function validateWorkflowDefinitions(projectPath: string): Promise<ConfigValidationResult> {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    details: { validWorkflows: [], invalidWorkflows: [], totalFiles: 0 }
  };

  const workflowsDir = normalizePath(path.join(projectPath, APEX_DIR, WORKFLOWS_DIR));

  // Check if workflows directory exists
  try {
    await fs.access(workflowsDir);
  } catch (error) {
    // Not an error - workflows directory is optional
    result.warnings.push({
      type: 'missing_workflows_directory',
      message: 'workflows directory does not exist',
      suggestion: 'Create .apex/workflows/ directory and add workflow definition files (.yaml)'
    });
    return result;
  }

  // Read all .yaml/.yml files in the workflows directory
  try {
    const files = await fs.readdir(workflowsDir);
    const yamlFiles = files.filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
    result.details.totalFiles = yamlFiles.length;

    if (yamlFiles.length === 0) {
      result.warnings.push({
        type: 'no_workflow_files',
        message: 'No workflow definition files (.yaml/.yml) found in workflows directory',
        suggestion: 'Add workflow definition files with stage definitions'
      });
      return result;
    }

    // Validate each workflow file
    for (const file of yamlFiles) {
      const filePath = normalizePath(path.join(workflowsDir, file));
      await validateSingleWorkflowFile(filePath, result);
    }

  } catch (error) {
    result.errors.push({
      type: 'workflows_directory_read_error',
      message: `Cannot read workflows directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
      filePath: workflowsDir,
      suggestion: 'Check directory permissions'
    });
    result.valid = false;
  }

  return result;
}

/**
 * Validates a single workflow definition file
 */
async function validateSingleWorkflowFile(filePath: string, result: ConfigValidationResult): Promise<void> {
  const fileName = path.basename(filePath);

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Parse YAML
    let rawWorkflow: any;
    try {
      rawWorkflow = yaml.parse(content);
    } catch (yamlError) {
      result.errors.push({
        type: 'invalid_workflow_yaml',
        message: `Invalid YAML syntax in ${fileName}: ${yamlError instanceof Error ? yamlError.message : 'Unknown YAML error'}`,
        filePath,
        suggestion: 'Fix the YAML syntax errors'
      });
      (result.details.invalidWorkflows as string[]).push(fileName);
      result.valid = false;
      return;
    }

    // Validate against workflow schema
    try {
      const workflow = WorkflowDefinitionSchema.parse(rawWorkflow);

      // Additional semantic validation
      if (!workflow.stages || workflow.stages.length === 0) {
        result.errors.push({
          type: 'no_workflow_stages',
          message: `Workflow ${workflow.name} has no stages defined`,
          filePath,
          suggestion: 'Add at least one stage to the workflow'
        });
        (result.details.invalidWorkflows as string[]).push(fileName);
        result.valid = false;
        return;
      }

      // Check for duplicate stage names within the workflow
      const stageNames = workflow.stages.map(stage => stage.name);
      const duplicateNames = stageNames.filter((name, index) => stageNames.indexOf(name) !== index);
      if (duplicateNames.length > 0) {
        result.errors.push({
          type: 'duplicate_stage_names',
          message: `Workflow ${workflow.name} has duplicate stage names: ${duplicateNames.join(', ')}`,
          filePath,
          suggestion: 'Ensure all stage names are unique within the workflow'
        });
        (result.details.invalidWorkflows as string[]).push(fileName);
        result.valid = false;
        return;
      }

      // Check for stages without agents
      for (const stage of workflow.stages) {
        if (!stage.agent) {
          result.warnings.push({
            type: 'stage_no_agent',
            message: `Stage '${stage.name}' in workflow ${workflow.name} has no agent specified`,
            filePath,
            suggestion: 'Assign an agent to this stage or mark it as manual'
          });
        }
      }

      (result.details.validWorkflows as string[]).push(workflow.name);

    } catch (schemaError) {
      result.errors.push({
        type: 'workflow_schema_error',
        message: `Workflow ${fileName} validation failed: ${schemaError instanceof Error ? schemaError.message : 'Schema validation error'}`,
        filePath,
        suggestion: 'Check the workflow definition against the APEX workflow schema'
      });
      (result.details.invalidWorkflows as string[]).push(fileName);
      result.valid = false;
    }

  } catch (readError) {
    result.errors.push({
      type: 'workflow_file_read_error',
      message: `Cannot read workflow file ${fileName}: ${readError instanceof Error ? readError.message : 'Unknown error'}`,
      filePath,
      suggestion: 'Check file permissions and encoding'
    });
    (result.details.invalidWorkflows as string[]).push(fileName);
    result.valid = false;
  }
}

// ============================================================================
// Complete Configuration Validation
// ============================================================================

/**
 * Performs comprehensive validation of the entire APEX configuration
 * Returns structured results with all validation findings
 */
export async function validateApexConfiguration(projectPath: string): Promise<ApexConfigValidationResult> {
  // Check if APEX is initialized
  const isInitialized = await isApexInitialized(projectPath);
  if (!isInitialized) {
    return {
      valid: false,
      directory: {
        valid: false,
        errors: [{
          type: 'not_initialized',
          message: 'APEX is not initialized in this directory',
          suggestion: 'Run "apex init" to initialize APEX'
        }],
        warnings: []
      },
      config: { valid: false, errors: [], warnings: [] },
      agents: { valid: false, errors: [], warnings: [] },
      workflows: { valid: false, errors: [], warnings: [] },
      summary: {
        totalErrors: 1,
        totalWarnings: 0,
        criticalIssues: ['APEX not initialized']
      }
    };
  }

  // Run all validation checks in parallel
  const [directoryResult, configResult, agentsResult, workflowsResult] = await Promise.all([
    validateApexDirectoryStructure(projectPath),
    validateApexConfigFile(projectPath),
    validateAgentDefinitions(projectPath),
    validateWorkflowDefinitions(projectPath)
  ]);

  // Calculate summary
  const totalErrors = directoryResult.errors.length +
                     configResult.errors.length +
                     agentsResult.errors.length +
                     workflowsResult.errors.length;

  const totalWarnings = directoryResult.warnings.length +
                       configResult.warnings.length +
                       agentsResult.warnings.length +
                       workflowsResult.warnings.length;

  const criticalIssues: string[] = [];
  if (!directoryResult.valid) criticalIssues.push('Directory structure issues');
  if (!configResult.valid) criticalIssues.push('Configuration file issues');
  if (!agentsResult.valid) criticalIssues.push('Agent definition issues');
  if (!workflowsResult.valid) criticalIssues.push('Workflow definition issues');

  const overallValid = directoryResult.valid && configResult.valid && agentsResult.valid && workflowsResult.valid;

  return {
    valid: overallValid,
    directory: directoryResult,
    config: configResult,
    agents: agentsResult,
    workflows: workflowsResult,
    summary: {
      totalErrors,
      totalWarnings,
      criticalIssues
    }
  };
}

// ============================================================================
// Doctor Command Integration Helper
// ============================================================================

/**
 * Converts APEX configuration validation results into a DoctorCheckResult
 * for integration with the existing doctor command infrastructure
 */
export function createApexConfigValidationCheck(
  projectPath: string,
  validationResult: ApexConfigValidationResult
): DoctorCheckResult {
  const start = Date.now();

  const check = createDoctorCheckResult({
    id: 'apex-config-validation',
    name: 'APEX Configuration Validation',
    category: 'config',
    description: 'Comprehensive validation of .apex directory structure, config.yaml, agent definitions, and workflow definitions'
  });

  const status = validationResult.valid ? 'pass' : 'fail';
  const severity = validationResult.summary.criticalIssues.length > 0 ? 'error' :
                  validationResult.summary.totalErrors > 0 ? 'warning' : 'info';

  // Create detailed message
  let message = '';
  if (validationResult.valid) {
    message = 'APEX configuration is valid and complete';

    // Add summary of what was validated
    const details = [];
    if (validationResult.directory.details?.existingDirectories?.length) {
      details.push(`${validationResult.directory.details.existingDirectories.length} directories`);
    }
    if (validationResult.agents.details?.validAgents?.length) {
      details.push(`${validationResult.agents.details.validAgents.length} agents`);
    }
    if (validationResult.workflows.details?.validWorkflows?.length) {
      details.push(`${validationResult.workflows.details.validWorkflows.length} workflows`);
    }

    if (details.length > 0) {
      message += ` (${details.join(', ')})`;
    }
  } else {
    message = `APEX configuration has ${validationResult.summary.totalErrors} error(s)`;
    if (validationResult.summary.totalWarnings > 0) {
      message += ` and ${validationResult.summary.totalWarnings} warning(s)`;
    }
  }

  // Create suggestion from critical issues
  let suggestion: string | undefined;
  if (validationResult.summary.criticalIssues.length > 0) {
    suggestion = `Address critical issues: ${validationResult.summary.criticalIssues.join(', ')}`;
  } else if (validationResult.summary.totalWarnings > 0) {
    suggestion = 'Consider addressing the warnings for improved configuration';
  }

  return {
    ...check,
    status,
    severity,
    message,
    suggestion,
    details: {
      validation: validationResult,
      summary: {
        valid: validationResult.valid,
        totalErrors: validationResult.summary.totalErrors,
        totalWarnings: validationResult.summary.totalWarnings,
        criticalIssues: validationResult.summary.criticalIssues
      }
    },
    durationMs: Date.now() - start
  };
}