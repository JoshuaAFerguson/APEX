# ADR: APEX Config Validation for Doctor Command

## Status
Proposed

## Context

The `apex doctor` command needs comprehensive validation of the APEX configuration beyond the basic checks currently implemented in `doctor-handlers.ts`. The existing implementation only validates:
- Project name existence
- Project language specification

The task requires validation of:
- `.apex` directory structure
- `config.yaml` schema compliance
- Agent definition files (`.apex/agents/*.md`)
- Workflow definition files (`.apex/workflows/*.yaml`)
- Cross-reference validation (agents referenced in workflows exist, etc.)

This validation must integrate with the existing `loadConfig` infrastructure in `@apexcli/core` and return structured `DoctorCheckResult` outputs compatible with the existing doctor command framework.

## Decision

### Architecture Overview

We will implement a **modular validation architecture** with a central `ApexConfigValidator` class in `@apexcli/core` that orchestrates specialized validators for different aspects of the APEX configuration.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         apex doctor                                  │
│                     (CLI Handler Layer)                              │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ApexConfigValidator                               │
│                   (Orchestration Layer)                              │
│  - validateAll(): Promise<ApexConfigValidationResult>                │
│  - validateDirectory(): DirectoryValidationResult                    │
│  - validateConfig(): ConfigSchemaValidationResult                    │
│  - validateAgents(): AgentValidationResult                          │
│  - validateWorkflows(): WorkflowValidationResult                    │
│  - validateCrossReferences(): CrossReferenceValidationResult        │
└──────────┬────────────┬────────────┬───────────┬───────────────────┘
           │            │            │           │
           ▼            ▼            ▼           ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │Directory │  │ Schema   │  │  Agent   │  │  Workflow    │
    │Validator │  │Validator │  │Validator │  │  Validator   │
    └──────────┘  └──────────┘  └──────────┘  └──────────────┘
```

### Type Definitions

Add to `packages/core/src/types.ts`:

```typescript
// ============================================================================
// Config Validation Types
// ============================================================================

/**
 * Severity level for config validation issues
 */
export const ConfigValidationSeveritySchema = z.enum(['error', 'warning', 'info']);
export type ConfigValidationSeverity = z.infer<typeof ConfigValidationSeveritySchema>;

/**
 * A single configuration validation issue
 */
export const ConfigValidationIssueSchema = z.object({
  /** Unique code identifying this type of issue */
  code: z.string(),
  /** Human-readable message describing the issue */
  message: z.string(),
  /** Severity level */
  severity: ConfigValidationSeveritySchema,
  /** Path to the problematic config field (e.g., "project.name", "agents.developer") */
  path: z.string().optional(),
  /** File path where the issue was found */
  file: z.string().optional(),
  /** Line number in the file (1-indexed) */
  line: z.number().optional(),
  /** Suggested fix for the issue */
  suggestion: z.string().optional(),
});
export type ConfigValidationIssue = z.infer<typeof ConfigValidationIssueSchema>;

/**
 * Result of validating a specific aspect of APEX config
 */
export const ConfigValidationResultSchema = z.object({
  /** Whether validation passed (no errors) */
  isValid: z.boolean(),
  /** All issues found during validation */
  issues: z.array(ConfigValidationIssueSchema),
  /** Count of issues by severity */
  errorCount: z.number(),
  warningCount: z.number(),
  infoCount: z.number(),
});
export type ConfigValidationResult = z.infer<typeof ConfigValidationResultSchema>;

/**
 * Comprehensive validation result for all APEX config
 */
export const ApexConfigValidationResultSchema = z.object({
  /** Overall validity (no errors in any category) */
  isValid: z.boolean(),
  /** Directory structure validation */
  directory: ConfigValidationResultSchema,
  /** Config.yaml schema validation */
  config: ConfigValidationResultSchema,
  /** Agent definitions validation */
  agents: ConfigValidationResultSchema,
  /** Workflow definitions validation */
  workflows: ConfigValidationResultSchema,
  /** Cross-reference validation */
  crossReferences: ConfigValidationResultSchema,
  /** Aggregated totals */
  summary: z.object({
    totalIssues: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
    infoCount: z.number(),
  }),
  /** Duration of validation in milliseconds */
  durationMs: z.number(),
});
export type ApexConfigValidationResult = z.infer<typeof ApexConfigValidationResultSchema>;

/**
 * Options for config validation
 */
export const ConfigValidationOptionsSchema = z.object({
  /** Skip validation of agent definitions */
  skipAgents: z.boolean().default(false),
  /** Skip validation of workflow definitions */
  skipWorkflows: z.boolean().default(false),
  /** Skip cross-reference validation */
  skipCrossReferences: z.boolean().default(false),
  /** Additional directories to validate beyond defaults */
  additionalDirectories: z.array(z.string()).default([]),
  /** Whether to validate file permissions */
  checkPermissions: z.boolean().default(true),
});
export type ConfigValidationOptions = z.infer<typeof ConfigValidationOptionsSchema>;
```

### Validation Issue Codes

Define standard issue codes for consistency:

```typescript
// Directory validation codes
const DIRECTORY_CODES = {
  APEX_DIR_MISSING: 'APEX_DIR_MISSING',
  CONFIG_FILE_MISSING: 'CONFIG_FILE_MISSING',
  AGENTS_DIR_MISSING: 'AGENTS_DIR_MISSING',
  WORKFLOWS_DIR_MISSING: 'WORKFLOWS_DIR_MISSING',
  SKILLS_DIR_MISSING: 'SKILLS_DIR_MISSING',
  SCRIPTS_DIR_MISSING: 'SCRIPTS_DIR_MISSING',
  DIR_NOT_WRITABLE: 'DIR_NOT_WRITABLE',
  FILE_NOT_READABLE: 'FILE_NOT_READABLE',
} as const;

// Config schema validation codes
const CONFIG_CODES = {
  SCHEMA_VALIDATION_ERROR: 'SCHEMA_VALIDATION_ERROR',
  YAML_PARSE_ERROR: 'YAML_PARSE_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE',
  INVALID_FIELD_VALUE: 'INVALID_FIELD_VALUE',
  DEPRECATED_FIELD: 'DEPRECATED_FIELD',
  UNKNOWN_FIELD: 'UNKNOWN_FIELD',
} as const;

// Agent validation codes
const AGENT_CODES = {
  INVALID_FRONTMATTER: 'INVALID_FRONTMATTER',
  MISSING_AGENT_NAME: 'MISSING_AGENT_NAME',
  MISSING_AGENT_DESCRIPTION: 'MISSING_AGENT_DESCRIPTION',
  MISSING_AGENT_PROMPT: 'MISSING_AGENT_PROMPT',
  INVALID_TOOL_NAME: 'INVALID_TOOL_NAME',
  INVALID_MODEL_NAME: 'INVALID_MODEL_NAME',
  DUPLICATE_AGENT_NAME: 'DUPLICATE_AGENT_NAME',
  EMPTY_AGENT_FILE: 'EMPTY_AGENT_FILE',
} as const;

// Workflow validation codes
const WORKFLOW_CODES = {
  INVALID_WORKFLOW_YAML: 'INVALID_WORKFLOW_YAML',
  MISSING_WORKFLOW_NAME: 'MISSING_WORKFLOW_NAME',
  MISSING_WORKFLOW_STAGES: 'MISSING_WORKFLOW_STAGES',
  EMPTY_STAGES_ARRAY: 'EMPTY_STAGES_ARRAY',
  INVALID_STAGE_DEFINITION: 'INVALID_STAGE_DEFINITION',
  DUPLICATE_WORKFLOW_NAME: 'DUPLICATE_WORKFLOW_NAME',
  DUPLICATE_STAGE_NAME: 'DUPLICATE_STAGE_NAME',
  MISSING_STAGE_AGENT: 'MISSING_STAGE_AGENT',
} as const;

// Cross-reference validation codes
const XREF_CODES = {
  UNDEFINED_AGENT_REFERENCE: 'UNDEFINED_AGENT_REFERENCE',
  UNDEFINED_WORKFLOW_REFERENCE: 'UNDEFINED_WORKFLOW_REFERENCE',
  UNDEFINED_SKILL_REFERENCE: 'UNDEFINED_SKILL_REFERENCE',
  CIRCULAR_DEPENDENCY: 'CIRCULAR_DEPENDENCY',
  MISSING_DEFAULT_WORKFLOW: 'MISSING_DEFAULT_WORKFLOW',
} as const;
```

### ApexConfigValidator Class

Create new file `packages/core/src/validation/apex-config-validator.ts`:

```typescript
/**
 * @fileoverview ApexConfigValidator for comprehensive APEX configuration validation
 *
 * This module provides validation for:
 * - .apex directory structure
 * - config.yaml schema and semantics
 * - Agent definition files (markdown with YAML frontmatter)
 * - Workflow definition files (YAML)
 * - Cross-references between configuration elements
 */

import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  ApexConfigSchema,
  AgentDefinitionSchema,
  WorkflowDefinitionSchema,
  ConfigValidationResult,
  ConfigValidationIssue,
  ApexConfigValidationResult,
  ConfigValidationOptions,
  ConfigValidationOptionsSchema,
} from '../types.js';

export class ApexConfigValidator {
  private readonly projectPath: string;
  private readonly options: ConfigValidationOptions;
  private readonly apexDir: string;

  constructor(projectPath: string, options?: Partial<ConfigValidationOptions>) {
    this.projectPath = projectPath;
    this.options = ConfigValidationOptionsSchema.parse(options ?? {});
    this.apexDir = path.join(projectPath, '.apex');
  }

  /**
   * Run all validations and return comprehensive result
   */
  async validateAll(): Promise<ApexConfigValidationResult> {
    const startTime = Date.now();

    // Run validations in sequence (some depend on others)
    const directory = await this.validateDirectory();
    const config = await this.validateConfig();
    const agents = this.options.skipAgents
      ? this.createEmptyResult()
      : await this.validateAgents();
    const workflows = this.options.skipWorkflows
      ? this.createEmptyResult()
      : await this.validateWorkflows();
    const crossReferences = this.options.skipCrossReferences
      ? this.createEmptyResult()
      : await this.validateCrossReferences();

    const summary = {
      totalIssues:
        directory.issues.length +
        config.issues.length +
        agents.issues.length +
        workflows.issues.length +
        crossReferences.issues.length,
      errorCount:
        directory.errorCount +
        config.errorCount +
        agents.errorCount +
        workflows.errorCount +
        crossReferences.errorCount,
      warningCount:
        directory.warningCount +
        config.warningCount +
        agents.warningCount +
        workflows.warningCount +
        crossReferences.warningCount,
      infoCount:
        directory.infoCount +
        config.infoCount +
        agents.infoCount +
        workflows.infoCount +
        crossReferences.infoCount,
    };

    return {
      isValid: summary.errorCount === 0,
      directory,
      config,
      agents,
      workflows,
      crossReferences,
      summary,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Validate .apex directory structure
   */
  async validateDirectory(): Promise<ConfigValidationResult> {
    const issues: ConfigValidationIssue[] = [];

    // Check .apex directory exists
    const apexDirExists = await this.pathExists(this.apexDir);
    if (!apexDirExists) {
      issues.push({
        code: 'APEX_DIR_MISSING',
        message: '.apex directory not found',
        severity: 'error',
        path: '.apex',
        suggestion: 'Run "apex init" to initialize APEX in this project',
      });
      return this.createResult(issues);
    }

    // Check config.yaml exists
    const configPath = path.join(this.apexDir, 'config.yaml');
    if (!(await this.pathExists(configPath))) {
      issues.push({
        code: 'CONFIG_FILE_MISSING',
        message: 'config.yaml not found in .apex directory',
        severity: 'error',
        file: configPath,
        suggestion: 'Create .apex/config.yaml with required configuration',
      });
    }

    // Check optional directories (warnings if missing)
    const optionalDirs = [
      { name: 'agents', code: 'AGENTS_DIR_MISSING' },
      { name: 'workflows', code: 'WORKFLOWS_DIR_MISSING' },
    ];

    for (const { name, code } of optionalDirs) {
      const dirPath = path.join(this.apexDir, name);
      if (!(await this.pathExists(dirPath))) {
        issues.push({
          code,
          message: `${name} directory not found`,
          severity: 'info',
          path: `.apex/${name}`,
          suggestion: `Create .apex/${name}/ to define custom ${name}`,
        });
      }
    }

    // Check permissions if enabled
    if (this.options.checkPermissions) {
      try {
        await fs.access(this.apexDir, fs.constants.W_OK);
      } catch {
        issues.push({
          code: 'DIR_NOT_WRITABLE',
          message: '.apex directory is not writable',
          severity: 'warning',
          path: '.apex',
          suggestion: 'Check file permissions on .apex directory',
        });
      }
    }

    return this.createResult(issues);
  }

  /**
   * Validate config.yaml schema and contents
   */
  async validateConfig(): Promise<ConfigValidationResult> {
    const issues: ConfigValidationIssue[] = [];
    const configPath = path.join(this.apexDir, 'config.yaml');

    // Check if file exists
    if (!(await this.pathExists(configPath))) {
      // Already reported in directory validation
      return this.createResult(issues);
    }

    try {
      // Read and parse YAML
      const content = await fs.readFile(configPath, 'utf-8');
      let rawConfig: unknown;

      try {
        rawConfig = yaml.parse(content);
      } catch (parseError) {
        issues.push({
          code: 'YAML_PARSE_ERROR',
          message: `Invalid YAML syntax: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          severity: 'error',
          file: configPath,
          suggestion: 'Fix YAML syntax errors in config.yaml',
        });
        return this.createResult(issues);
      }

      // Validate against schema
      try {
        ApexConfigSchema.parse(rawConfig);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          for (const issue of zodError.issues) {
            issues.push({
              code: 'SCHEMA_VALIDATION_ERROR',
              message: issue.message,
              severity: 'error',
              path: issue.path.join('.'),
              file: configPath,
              suggestion: this.getSchemaFixSuggestion(issue),
            });
          }
        }
        return this.createResult(issues);
      }

      // Additional semantic validation
      const config = rawConfig as Record<string, unknown>;

      // Validate project section
      if (!config.project || typeof config.project !== 'object') {
        issues.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: 'project section is required',
          severity: 'error',
          path: 'project',
          file: configPath,
          suggestion: 'Add project: { name: "project-name", language: "typescript" }',
        });
      } else {
        const project = config.project as Record<string, unknown>;
        if (!project.name || typeof project.name !== 'string' || project.name.trim() === '') {
          issues.push({
            code: 'MISSING_REQUIRED_FIELD',
            message: 'project.name is required and must be non-empty',
            severity: 'error',
            path: 'project.name',
            file: configPath,
            suggestion: 'Set project.name to your project name',
          });
        }
      }

      // Validate autonomy limits are reasonable
      if (config.limits && typeof config.limits === 'object') {
        const limits = config.limits as Record<string, unknown>;
        if (typeof limits.maxCost === 'number' && limits.maxCost <= 0) {
          issues.push({
            code: 'INVALID_FIELD_VALUE',
            message: 'limits.maxCost must be positive',
            severity: 'warning',
            path: 'limits.maxCost',
            file: configPath,
            suggestion: 'Set limits.maxCost to a positive value (e.g., 10.0)',
          });
        }
      }

    } catch (error) {
      issues.push({
        code: 'FILE_NOT_READABLE',
        message: `Cannot read config.yaml: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        file: configPath,
        suggestion: 'Check file permissions and ensure config.yaml exists',
      });
    }

    return this.createResult(issues);
  }

  /**
   * Validate agent definition files
   */
  async validateAgents(): Promise<ConfigValidationResult> {
    const issues: ConfigValidationIssue[] = [];
    const agentsDir = path.join(this.apexDir, 'agents');

    if (!(await this.pathExists(agentsDir))) {
      return this.createResult(issues);
    }

    try {
      const files = await fs.readdir(agentsDir);
      const agentNames = new Set<string>();

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for empty file
        if (content.trim() === '') {
          issues.push({
            code: 'EMPTY_AGENT_FILE',
            message: `Agent file is empty: ${file}`,
            severity: 'error',
            file: filePath,
            suggestion: 'Add agent definition with YAML frontmatter and prompt',
          });
          continue;
        }

        // Parse frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!frontmatterMatch) {
          issues.push({
            code: 'INVALID_FRONTMATTER',
            message: `Invalid frontmatter format in ${file}`,
            severity: 'error',
            file: filePath,
            suggestion: 'Agent files must have YAML frontmatter between --- markers',
          });
          continue;
        }

        const [, frontmatter, body] = frontmatterMatch;

        try {
          const metadata = yaml.parse(frontmatter);

          // Validate required fields
          if (!metadata.name) {
            issues.push({
              code: 'MISSING_AGENT_NAME',
              message: `Missing name in agent definition: ${file}`,
              severity: 'error',
              file: filePath,
              path: 'name',
              suggestion: 'Add "name: agent-name" to frontmatter',
            });
          } else {
            // Check for duplicates
            if (agentNames.has(metadata.name)) {
              issues.push({
                code: 'DUPLICATE_AGENT_NAME',
                message: `Duplicate agent name: ${metadata.name}`,
                severity: 'error',
                file: filePath,
                path: 'name',
                suggestion: 'Each agent must have a unique name',
              });
            }
            agentNames.add(metadata.name);
          }

          if (!metadata.description) {
            issues.push({
              code: 'MISSING_AGENT_DESCRIPTION',
              message: `Missing description in agent: ${file}`,
              severity: 'warning',
              file: filePath,
              path: 'description',
              suggestion: 'Add "description: ..." to frontmatter',
            });
          }

          // Validate model if specified
          if (metadata.model) {
            const validModels = ['opus', 'sonnet', 'haiku'];
            if (!validModels.includes(metadata.model)) {
              issues.push({
                code: 'INVALID_MODEL_NAME',
                message: `Invalid model "${metadata.model}" in ${file}`,
                severity: 'error',
                file: filePath,
                path: 'model',
                suggestion: `Use one of: ${validModels.join(', ')}`,
              });
            }
          }

          // Check prompt body
          if (!body.trim()) {
            issues.push({
              code: 'MISSING_AGENT_PROMPT',
              message: `Missing prompt body in ${file}`,
              severity: 'warning',
              file: filePath,
              suggestion: 'Add agent prompt instructions after frontmatter',
            });
          }

          // Full schema validation
          try {
            const tools = typeof metadata.tools === 'string'
              ? metadata.tools.split(',').map((t: string) => t.trim())
              : metadata.tools;
            const skills = typeof metadata.skills === 'string'
              ? metadata.skills.split(',').map((s: string) => s.trim())
              : metadata.skills;

            AgentDefinitionSchema.parse({
              name: metadata.name,
              description: metadata.description,
              prompt: body.trim(),
              tools,
              model: metadata.model,
              skills,
            });
          } catch (zodError) {
            if (zodError instanceof z.ZodError) {
              for (const issue of zodError.issues) {
                issues.push({
                  code: 'SCHEMA_VALIDATION_ERROR',
                  message: `Agent validation error: ${issue.message}`,
                  severity: 'error',
                  file: filePath,
                  path: issue.path.join('.'),
                  suggestion: this.getSchemaFixSuggestion(issue),
                });
              }
            }
          }
        } catch (yamlError) {
          issues.push({
            code: 'INVALID_FRONTMATTER',
            message: `Invalid YAML in frontmatter: ${file}`,
            severity: 'error',
            file: filePath,
            suggestion: 'Fix YAML syntax in agent frontmatter',
          });
        }
      }
    } catch (error) {
      issues.push({
        code: 'FILE_NOT_READABLE',
        message: `Cannot read agents directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        path: '.apex/agents',
        suggestion: 'Check directory permissions',
      });
    }

    return this.createResult(issues);
  }

  /**
   * Validate workflow definition files
   */
  async validateWorkflows(): Promise<ConfigValidationResult> {
    const issues: ConfigValidationIssue[] = [];
    const workflowsDir = path.join(this.apexDir, 'workflows');

    if (!(await this.pathExists(workflowsDir))) {
      return this.createResult(issues);
    }

    try {
      const files = await fs.readdir(workflowsDir);
      const workflowNames = new Set<string>();

      for (const file of files) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

        const filePath = path.join(workflowsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');

        try {
          const rawWorkflow = yaml.parse(content);

          // Check required fields
          if (!rawWorkflow.name) {
            issues.push({
              code: 'MISSING_WORKFLOW_NAME',
              message: `Missing name in workflow: ${file}`,
              severity: 'error',
              file: filePath,
              path: 'name',
              suggestion: 'Add "name: workflow-name" to workflow definition',
            });
          } else {
            if (workflowNames.has(rawWorkflow.name)) {
              issues.push({
                code: 'DUPLICATE_WORKFLOW_NAME',
                message: `Duplicate workflow name: ${rawWorkflow.name}`,
                severity: 'error',
                file: filePath,
                path: 'name',
                suggestion: 'Each workflow must have a unique name',
              });
            }
            workflowNames.add(rawWorkflow.name);
          }

          if (!rawWorkflow.stages || !Array.isArray(rawWorkflow.stages)) {
            issues.push({
              code: 'MISSING_WORKFLOW_STAGES',
              message: `Missing stages array in workflow: ${file}`,
              severity: 'error',
              file: filePath,
              path: 'stages',
              suggestion: 'Add "stages:" array with at least one stage',
            });
          } else if (rawWorkflow.stages.length === 0) {
            issues.push({
              code: 'EMPTY_STAGES_ARRAY',
              message: `Empty stages array in workflow: ${file}`,
              severity: 'error',
              file: filePath,
              path: 'stages',
              suggestion: 'Add at least one stage to the workflow',
            });
          } else {
            // Validate each stage
            const stageNames = new Set<string>();
            for (let i = 0; i < rawWorkflow.stages.length; i++) {
              const stage = rawWorkflow.stages[i];
              const stagePath = `stages[${i}]`;

              if (!stage.name) {
                issues.push({
                  code: 'INVALID_STAGE_DEFINITION',
                  message: `Stage ${i} missing name in ${file}`,
                  severity: 'error',
                  file: filePath,
                  path: `${stagePath}.name`,
                  suggestion: 'Add "name:" to each stage',
                });
              } else {
                if (stageNames.has(stage.name)) {
                  issues.push({
                    code: 'DUPLICATE_STAGE_NAME',
                    message: `Duplicate stage name "${stage.name}" in ${file}`,
                    severity: 'error',
                    file: filePath,
                    path: `${stagePath}.name`,
                    suggestion: 'Each stage must have a unique name within the workflow',
                  });
                }
                stageNames.add(stage.name);
              }

              if (!stage.agent) {
                issues.push({
                  code: 'MISSING_STAGE_AGENT',
                  message: `Stage "${stage.name || i}" missing agent in ${file}`,
                  severity: 'error',
                  file: filePath,
                  path: `${stagePath}.agent`,
                  suggestion: 'Add "agent: agent-name" to each stage',
                });
              }
            }
          }

          // Full schema validation
          try {
            WorkflowDefinitionSchema.parse(rawWorkflow);
          } catch (zodError) {
            if (zodError instanceof z.ZodError) {
              for (const issue of zodError.issues) {
                // Avoid duplicate errors for issues we already reported
                const alreadyReported = issues.some(
                  i => i.file === filePath && i.path === issue.path.join('.')
                );
                if (!alreadyReported) {
                  issues.push({
                    code: 'SCHEMA_VALIDATION_ERROR',
                    message: issue.message,
                    severity: 'error',
                    file: filePath,
                    path: issue.path.join('.'),
                    suggestion: this.getSchemaFixSuggestion(issue),
                  });
                }
              }
            }
          }
        } catch (yamlError) {
          issues.push({
            code: 'INVALID_WORKFLOW_YAML',
            message: `Invalid YAML in workflow: ${file}`,
            severity: 'error',
            file: filePath,
            suggestion: 'Fix YAML syntax in workflow file',
          });
        }
      }
    } catch (error) {
      issues.push({
        code: 'FILE_NOT_READABLE',
        message: `Cannot read workflows directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
        path: '.apex/workflows',
        suggestion: 'Check directory permissions',
      });
    }

    return this.createResult(issues);
  }

  /**
   * Validate cross-references between config elements
   */
  async validateCrossReferences(): Promise<ConfigValidationResult> {
    const issues: ConfigValidationIssue[] = [];

    try {
      // Load all agents and workflows
      const agentsDir = path.join(this.apexDir, 'agents');
      const workflowsDir = path.join(this.apexDir, 'workflows');

      const agentNames = new Set<string>();
      const workflowNames = new Set<string>();

      // Collect agent names
      if (await this.pathExists(agentsDir)) {
        const files = await fs.readdir(agentsDir);
        for (const file of files) {
          if (!file.endsWith('.md')) continue;
          const content = await fs.readFile(path.join(agentsDir, file), 'utf-8');
          const match = content.match(/^---\n[\s\S]*?name:\s*(\S+)/m);
          if (match) {
            agentNames.add(match[1]);
          }
        }
      }

      // Add default/built-in agents
      const builtInAgents = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];
      builtInAgents.forEach(a => agentNames.add(a));

      // Validate workflow agent references
      if (await this.pathExists(workflowsDir)) {
        const files = await fs.readdir(workflowsDir);
        for (const file of files) {
          if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
          const filePath = path.join(workflowsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');

          try {
            const workflow = yaml.parse(content);
            if (workflow.name) {
              workflowNames.add(workflow.name);
            }

            if (workflow.stages && Array.isArray(workflow.stages)) {
              for (const stage of workflow.stages) {
                if (stage.agent && !agentNames.has(stage.agent)) {
                  issues.push({
                    code: 'UNDEFINED_AGENT_REFERENCE',
                    message: `Workflow references undefined agent: ${stage.agent}`,
                    severity: 'error',
                    file: filePath,
                    path: `stages.${stage.name}.agent`,
                    suggestion: `Create agent definition in .apex/agents/${stage.agent}.md or use a built-in agent`,
                  });
                }
              }
            }
          } catch {
            // YAML errors already reported in validateWorkflows
          }
        }
      }

      // Check config.yaml references to workflows
      const configPath = path.join(this.apexDir, 'config.yaml');
      if (await this.pathExists(configPath)) {
        try {
          const content = await fs.readFile(configPath, 'utf-8');
          const config = yaml.parse(content);

          // Check if default workflow exists
          if (config.defaultWorkflow && workflowNames.size > 0) {
            if (!workflowNames.has(config.defaultWorkflow)) {
              issues.push({
                code: 'UNDEFINED_WORKFLOW_REFERENCE',
                message: `Default workflow not found: ${config.defaultWorkflow}`,
                severity: 'warning',
                file: configPath,
                path: 'defaultWorkflow',
                suggestion: `Create workflow in .apex/workflows/${config.defaultWorkflow}.yaml`,
              });
            }
          }
        } catch {
          // Config errors already reported in validateConfig
        }
      }
    } catch (error) {
      issues.push({
        code: 'FILE_NOT_READABLE',
        message: `Error during cross-reference validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'warning',
        suggestion: 'Check file permissions and file integrity',
      });
    }

    return this.createResult(issues);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private createResult(issues: ConfigValidationIssue[]): ConfigValidationResult {
    return {
      isValid: !issues.some(i => i.severity === 'error'),
      issues,
      errorCount: issues.filter(i => i.severity === 'error').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      infoCount: issues.filter(i => i.severity === 'info').length,
    };
  }

  private createEmptyResult(): ConfigValidationResult {
    return {
      isValid: true,
      issues: [],
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
    };
  }

  private getSchemaFixSuggestion(issue: z.ZodIssue): string {
    switch (issue.code) {
      case 'invalid_type':
        return `Expected ${issue.expected}, got ${issue.received}`;
      case 'too_small':
        return `Value must have at least ${issue.minimum} ${issue.type === 'string' ? 'characters' : 'items'}`;
      case 'too_big':
        return `Value must have at most ${issue.maximum} ${issue.type === 'string' ? 'characters' : 'items'}`;
      case 'invalid_enum_value':
        return `Must be one of: ${issue.options?.join(', ')}`;
      default:
        return 'Check configuration schema for valid values';
    }
  }
}

/**
 * Convenience function to validate APEX configuration
 */
export async function validateApexConfig(
  projectPath: string,
  options?: Partial<ConfigValidationOptions>
): Promise<ApexConfigValidationResult> {
  const validator = new ApexConfigValidator(projectPath, options);
  return validator.validateAll();
}
```

### Integration with Doctor Command

Update `packages/cli/src/handlers/doctor-handlers.ts`:

```typescript
import {
  validateApexConfig,
  ConfigValidationIssue,
} from '@apexcli/core';

/**
 * Enhanced APEX configuration check using ApexConfigValidator
 */
async function checkApexConfigDetailed(ctx: CliContext): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];
  const start = Date.now();

  try {
    const validation = await validateApexConfig(ctx.cwd);

    // Convert validation results to DoctorCheckResult format
    const categories = [
      { key: 'directory', name: 'Directory Structure', category: 'config' as const },
      { key: 'config', name: 'Config Schema', category: 'config' as const },
      { key: 'agents', name: 'Agent Definitions', category: 'config' as const },
      { key: 'workflows', name: 'Workflow Definitions', category: 'config' as const },
      { key: 'crossReferences', name: 'Cross References', category: 'config' as const },
    ];

    for (const { key, name, category } of categories) {
      const result = validation[key as keyof typeof validation] as ConfigValidationResult;
      if (!result || typeof result !== 'object' || !('issues' in result)) continue;

      const check = createDoctorCheckResult({
        id: `apex-config-${key}`,
        name: `APEX ${name}`,
        category,
        description: `Validate ${name.toLowerCase()}`,
      });

      const hasErrors = result.errorCount > 0;
      const hasWarnings = result.warningCount > 0;

      results.push({
        ...check,
        status: hasErrors ? 'fail' : 'pass',
        severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'info',
        message: hasErrors
          ? `${result.errorCount} error(s) found in ${name.toLowerCase()}`
          : hasWarnings
          ? `${result.warningCount} warning(s) in ${name.toLowerCase()}`
          : `${name} validation passed`,
        suggestion: result.issues.length > 0
          ? result.issues[0].suggestion
          : undefined,
        details: {
          issues: result.issues,
          errorCount: result.errorCount,
          warningCount: result.warningCount,
          infoCount: result.infoCount,
        },
        durationMs: Date.now() - start,
      });
    }

    return results;
  } catch (error) {
    return [
      {
        ...createDoctorCheckResult({
          id: 'apex-config-validation',
          name: 'APEX Config Validation',
          category: 'config',
          description: 'Comprehensive config validation',
        }),
        status: 'fail',
        severity: 'error',
        message: `Config validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check .apex directory structure and file contents',
        durationMs: Date.now() - start,
      },
    ];
  }
}
```

### File Structure

```
packages/core/src/
├── validation/
│   ├── index.ts                    # Export all validators
│   ├── apex-config-validator.ts    # NEW: Main config validator
│   ├── mcp-config-validator.ts     # Existing MCP validator
│   └── syntax-validator.ts         # Existing syntax validator
├── types.ts                        # Add ConfigValidation* types
├── config.ts                       # Existing config loading
├── doctor-utils.ts                 # Existing doctor utilities
└── index.ts                        # Export new validator

packages/cli/src/handlers/
└── doctor-handlers.ts              # Integrate new validation
```

### Exports

Update `packages/core/src/index.ts`:
```typescript
export * from './validation/apex-config-validator.js';
export {
  ConfigValidationIssue,
  ConfigValidationResult,
  ApexConfigValidationResult,
  ConfigValidationOptions,
  // Schemas
  ConfigValidationIssueSchema,
  ConfigValidationResultSchema,
  ApexConfigValidationResultSchema,
  ConfigValidationOptionsSchema,
} from './types.js';
```

Update `packages/core/src/validation/index.ts`:
```typescript
export * from './apex-config-validator.js';
export * from './mcp-config-validator.js';
export * from './syntax-validator.js';
```

## Consequences

### Positive
- Comprehensive validation with detailed error messages
- Follows existing validation patterns (MCPConfigValidator)
- Modular design allows testing individual validators
- Structured results integrate with existing doctor framework
- Clear suggestions help users fix issues

### Negative
- Additional complexity in core package
- Need to maintain type definitions for new schemas
- Cross-reference validation requires loading all configs

### Neutral
- New test files required for validator
- Documentation needed for validation codes
- Users may see more validation warnings initially

## Implementation Plan

1. **Add type definitions** to `packages/core/src/types.ts`
2. **Create `ApexConfigValidator`** class in `packages/core/src/validation/`
3. **Add exports** to core package index files
4. **Update doctor-handlers.ts** to use new validator
5. **Add unit tests** for validation logic
6. **Update existing integration tests** if needed

## Test Strategy

1. **Unit tests** for each validation method
2. **Integration tests** with sample `.apex` directories
3. **Edge cases**: Empty files, missing directories, invalid YAML, circular references
4. **Regression tests**: Ensure existing doctor checks still work

## References

- Existing `MCPConfigValidator` pattern in `packages/core/src/validation/mcp-config-validator.ts`
- Doctor types ADR: `docs/adr/core-ADR-doctor-health-check-types.md`
- Config loading: `packages/core/src/config.ts`
- Doctor handlers: `packages/cli/src/handlers/doctor-handlers.ts`
