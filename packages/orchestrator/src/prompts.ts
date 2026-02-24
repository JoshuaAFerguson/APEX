import type { AgentDefinition as SDKAgentDefinition, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  WorkflowStage,
  Task,
  StageResult,
  SubtaskDefinition,
  SubtaskStrategy,
  TaskCheckpoint,
  getEffectiveConfig,
  MultimodalContext,
} from '@apexcli/core';
import type { ImageBlockParam } from './tools/multimodal-input-handler';

// ============================================================================
// Multimodal Prompt Support Types
// ============================================================================

/**
 * Text block for multimodal content as expected by Claude SDK
 */
export interface TextBlockParam {
  type: 'text';
  text: string;
}

/**
 * Content block for multimodal prompts - can be text or image
 */
export type ContentBlockParam = TextBlockParam | ImageBlockParam;

/**
 * Result of multimodal prompt building with both text and structured content
 */
export interface MultimodalPromptResult {
  /** Simple text prompt for backward compatibility */
  textPrompt: string;
  /** Structured content for Claude SDK multimodal support */
  contentBlocks: ContentBlockParam[];
  /** Whether the prompt contains multimodal content */
  hasMultimodalContent: boolean;
}

/**
 * Parsed decomposition request from planner output containing subtask breakdown details.
 *
 * Used when the planner determines that a complex task should be decomposed into smaller,
 * manageable subtasks that can be executed independently or in dependency order.
 *
 * @example
 * ```typescript
 * const decomposition: DecompositionRequest = {
 *   shouldDecompose: true,
 *   subtasks: [
 *     {
 *       description: "Create user model",
 *       acceptanceCriteria: "Model validates email format",
 *       workflow: "feature"
 *     }
 *   ],
 *   strategy: "sequential",
 *   reason: "Task involves multiple components requiring separate implementation"
 * };
 * ```
 */
export interface DecompositionRequest {
  /** Whether the task should be decomposed into subtasks */
  shouldDecompose: boolean;
  /** Array of subtask definitions to be created */
  subtasks: SubtaskDefinition[];
  /** Execution strategy for the subtasks (sequential, parallel, or dependency-based) */
  strategy: SubtaskStrategy;
  /** Optional explanation for why decomposition was chosen */
  reason?: string;
}

/**
 * Context data required for building orchestrator prompts.
 *
 * Contains all necessary configuration and state information needed to generate
 * appropriate prompts for the APEX orchestrator and agents.
 *
 * @example
 * ```typescript
 * const context: PromptContext = {
 *   config: getEffectiveConfig('/project/path'),
 *   workflow: {
 *     name: 'feature',
 *     description: 'Feature development workflow',
 *     stages: [...]
 *   },
 *   task: {
 *     id: 'task-123',
 *     description: 'Add user authentication',
 *     status: 'running'
 *   },
 *   agents: {
 *     developer: { name: 'developer', description: '...' }
 *   }
 * };
 * ```
 */
export interface PromptContext {
  /** Effective configuration for the current project */
  config: ReturnType<typeof getEffectiveConfig>;
  /** Workflow definition containing stages and their configurations */
  workflow: WorkflowDefinition;
  /** Current task being executed */
  task: Task;
  /** Available agents mapped by name */
  agents: Record<string, AgentDefinition>;
}

// ============================================================================
// Multimodal Prompt Helper Functions
// ============================================================================

/**
 * Build multimodal content from text and optional images
 *
 * @param textContent - The text content for the prompt
 * @param images - Optional array of ImageBlockParam structures
 * @returns MultimodalPromptResult with both text and content blocks
 *
 * @example
 * ```typescript
 * const result = buildMultimodalContent(
 *   "Implement the login screen based on this design:",
 *   [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: '...' } }]
 * );
 *
 * // For simple text-only prompts
 * if (!result.hasMultimodalContent) {
 *   return query({ prompt: result.textPrompt, options });
 * }
 *
 * // For multimodal prompts
 * const userMessage: SDKUserMessage = {
 *   type: 'user',
 *   message: { role: 'user', content: result.contentBlocks },
 *   parent_tool_use_id: null,
 *   session_id: 'session-id'
 * };
 * return query({ prompt: [userMessage], options });
 * ```
 */
export function buildMultimodalContent(
  textContent: string,
  images?: ImageBlockParam[]
): MultimodalPromptResult {
  const contentBlocks: ContentBlockParam[] = [];

  // Add text block
  if (textContent.trim()) {
    contentBlocks.push({
      type: 'text',
      text: textContent,
    });
  }

  // Add image blocks if provided
  if (images && images.length > 0) {
    contentBlocks.push(...images);
  }

  const hasMultimodalContent = images && images.length > 0;

  return {
    textPrompt: textContent,
    contentBlocks,
    hasMultimodalContent,
  };
}

/**
 * Extract images from multimodal context for prompt building
 *
 * @param multimodalContext - The processed multimodal context from a task
 * @returns Array of ImageBlockParam structures ready for Claude SDK
 *
 * @example
 * ```typescript
 * const task: Task = {
 *   // ... other fields
 *   multimodalContext: {
 *     inputs: [
 *       {
 *         input: { type: 'image', mediaType: 'image/png', data: '...' },
 *         status: 'completed',
 *         extractedContent: { text: 'Login screen mockup' }
 *       }
 *     ]
 *   }
 * };
 *
 * const images = extractImagesFromMultimodalContext(task.multimodalContext);
 * console.log(images); // [{ type: 'image', source: { ... } }]
 * ```
 */
export function extractImagesFromMultimodalContext(
  multimodalContext?: MultimodalContext
): ImageBlockParam[] {
  if (!multimodalContext || !multimodalContext.inputs) {
    return [];
  }

  const imageBlocks: ImageBlockParam[] = [];

  for (const processedInput of multimodalContext.inputs) {
    if (processedInput.status === 'completed' && processedInput.input.type === 'image') {
      const imageInput = processedInput.input as any; // Type assertion needed due to union type

      if (imageInput.data && imageInput.mediaType) {
        // Convert from MultimodalInput format to Claude SDK format
        const imageBlock: ImageBlockParam = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: imageInput.mediaType as ImageBlockParam['source']['media_type'],
            data: imageInput.data,
          },
        };
        imageBlocks.push(imageBlock);
      }
    }
  }

  return imageBlocks;
}

/**
 * Build multimodal context description for inclusion in text prompts
 *
 * @param multimodalContext - The processed multimodal context from a task
 * @returns Human-readable description of the multimodal content
 *
 * @example
 * ```typescript
 * const description = buildMultimodalContextDescription(task.multimodalContext);
 * console.log(description);
 * // "This task includes 2 images, 1 web page, and 1 design mockup for context and reference."
 * ```
 */
export function buildMultimodalContextDescription(
  multimodalContext?: MultimodalContext
): string {
  if (!multimodalContext || !multimodalContext.inputCounts) {
    return '';
  }

  const { inputCounts, contextSummary } = multimodalContext;
  const { images, webPages, designMockups } = inputCounts;

  if (images === 0 && webPages === 0 && designMockups === 0) {
    return '';
  }

  // Use the contextSummary if available, otherwise build from counts
  if (contextSummary) {
    return `\n\n## Multimodal Context\n${contextSummary}`;
  }

  const parts: string[] = [];
  if (images > 0) {
    parts.push(`${images} image${images !== 1 ? 's' : ''}`);
  }
  if (webPages > 0) {
    parts.push(`${webPages} web page${webPages !== 1 ? 's' : ''}`);
  }
  if (designMockups > 0) {
    parts.push(`${designMockups} design mockup${designMockups !== 1 ? 's' : ''}`);
  }

  return `\n\n## Multimodal Context\nThis task includes ${parts.join(', ')} for context and reference.`;
}

/**
 * Build the main orchestrator system prompt for multi-agent coordination.
 *
 * Creates a comprehensive prompt that provides the orchestrator with project context,
 * available agents, workflow stages, and coordination protocols. Includes autonomy
 * instructions, git workflow guidelines, and validation requirements.
 *
 * @param context - Complete prompt context including config, workflow, task and agents
 * @returns Formatted system prompt string for the orchestrator
 *
 * @example
 * ```typescript
 * const context: PromptContext = {
 *   config: getEffectiveConfig('/project'),
 *   workflow: { name: 'feature', stages: [...] },
 *   task: { id: 'task-123', description: 'Add authentication' },
 *   agents: { developer: {...}, tester: {...} }
 * };
 *
 * const prompt = buildOrchestratorPrompt(context);
 * console.log(prompt); // "You are the APEX Orchestrator..."
 * ```
 */
export function buildOrchestratorPrompt(context: PromptContext): string {
  const { config, workflow, task, agents } = context;

  const agentList = Object.entries(agents)
    .map(([name, agent]) => `  - **${name}**: ${agent.description}`)
    .join('\n');

  const stageList = workflow.stages
    .map((s) => `  ${s.name} (${s.agent})${s.parallel ? ' [parallel]' : ''}`)
    .join('\n');

  const availableScripts = `
  - ./scripts/lint.sh - Run linting
  - ./scripts/test.sh - Run test suite  
  - ./scripts/build.sh - Build the project
  - ./scripts/typecheck.sh - Type checking (if applicable)`;

  return `You are the APEX Orchestrator - an AI system managing a team of specialized development agents.

## Project Context
- **Project**: ${config.project.name}
${config.project.language ? `- **Language**: ${config.project.language}` : ''}
${config.project.framework ? `- **Framework**: ${config.project.framework}` : ''}
- **Autonomy Level**: ${task.autonomy}

## Your Team (Native Subagents)
${agentList}

## Current Workflow: ${workflow.name}
${workflow.description}

### Stages:
${stageList}

## Task Details
- **Task ID**: ${task.id}
- **Branch**: ${task.branchName || 'TBD'}
- **Status**: ${task.status}

## Coordination Protocol

### Updating Status
Use curl to update task status (agents should do this at key milestones):
\`\`\`bash
curl -X POST "$APEX_API/tasks/$APEX_TASK_ID/status" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "STATUS", "stage": "STAGE_NAME", "message": "Optional message"}'
\`\`\`

Valid statuses: planning, in-progress, waiting-approval, completed, failed

### Logging Progress
\`\`\`bash
curl -X POST "$APEX_API/tasks/$APEX_TASK_ID/log" \\
  -H "Content-Type: application/json" \\
  -d '{"level": "info", "message": "Description of what was done"}'
\`\`\`

### Git Workflow
1. Create feature branch: \`git checkout -b ${config.git.branchPrefix}${task.id}-<slug>\`
2. Make commits using conventional format: \`git commit -m "feat: description"\`
3. Push changes: \`git push -u origin HEAD\`
4. Create PR when ready: \`gh pr create --fill\`

### Commit Message Format (${config.git.commitFormat})
- \`feat:\` New feature
- \`fix:\` Bug fix
- \`docs:\` Documentation
- \`refactor:\` Code refactoring
- \`test:\` Adding tests
- \`chore:\` Maintenance

## Available Scripts
${availableScripts}

## Rules
1. **Delegate appropriately**: Use the right subagent for each task
2. **Follow workflow stages**: Execute stages in order, respect dependencies
3. **CRITICAL - Validate before completing**:
   - Run \`npm run build\` and ensure it passes with NO errors
   - Run \`npm run test\` and ensure ALL tests pass
   - If build or tests fail, FIX THE ISSUES before completing
   - Do NOT commit or push broken code under any circumstances
   - Loop until build and tests pass - this is non-negotiable
4. **Commit incrementally**: Make logical, atomic commits
5. **Stay within budget**: Current limit is ${config.limits.maxTokensPerTask.toLocaleString()} tokens
6. **Be concise**: Minimize unnecessary output to conserve tokens

## Autonomy Level: ${task.autonomy}
${getAutonomyInstructions(task.autonomy)}

Begin by analyzing the task and creating a plan.`;
}

/**
 * Get instructions based on autonomy level
 */
function getAutonomyInstructions(autonomy: Task['autonomy']): string {
  switch (autonomy) {
    case 'full-auto':
      return 'You have full autonomy. Execute the entire workflow without waiting for approvals.';
    case 'review-before-commit':
      return 'Pause before each git commit to allow human review. Show the diff and wait for approval.';
    case 'review-all':
      return 'Pause at each major stage for human approval. Wait for explicit go-ahead before proceeding.';
    default:
      return 'Follow standard workflow with appropriate checkpoints.';
  }
}

/**
 * Build agent definitions for the Claude Agent SDK format.
 *
 * Converts APEX agent definitions to the format expected by the Claude Agent SDK,
 * including enhanced prompts with APEX integration instructions, filtering by
 * enabled/disabled agents, and model type conversion.
 *
 * @param agents - Record of available agents keyed by name
 * @param config - Effective configuration containing agent enable/disable settings
 * @returns Agent definitions in Claude Agent SDK format
 *
 * @example
 * ```typescript
 * const agents = {
 *   developer: {
 *     name: 'developer',
 *     description: 'Writes code',
 *     prompt: 'You are a developer...',
 *     tools: ['Read', 'Write'],
 *     model: 'sonnet'
 *   }
 * };
 * const config = getEffectiveConfig('/project');
 * const sdkAgents = buildAgentDefinitions(agents, config);
 * // Returns: { developer: { description: '...', prompt: '...', tools: [...] } }
 * ```
 */
export function buildAgentDefinitions(
  agents: Record<string, AgentDefinition>,
  config: ReturnType<typeof getEffectiveConfig>
): Record<string, SDKAgentDefinition> {
  const result: Record<string, SDKAgentDefinition> = {};

  for (const [name, agent] of Object.entries(agents)) {
    // Skip disabled agents
    if (config.agents.disabled?.includes(name)) continue;

    // Only include enabled agents (if specified)
    if (config.agents.enabled && config.agents.enabled.length > 0 && !config.agents.enabled.includes(name)) continue;

    // Enhance the agent prompt with APEX-specific instructions
    const enhancedPrompt = `${agent.prompt}

## APEX Integration
- Update status: \`curl -X POST "$APEX_API/tasks/$APEX_TASK_ID/status" -H "Content-Type: application/json" -d '{"status": "in-progress", "stage": "${name}"}'\`
- Log progress: \`curl -X POST "$APEX_API/tasks/$APEX_TASK_ID/log" -H "Content-Type: application/json" -d '{"level": "info", "agent": "${name}", "message": "..."}'\`
- Environment: APEX_TASK_ID, APEX_PROJECT, APEX_BRANCH are available`;

    // Convert our model type to SDK model type
    const sdkModel = agent.model as SDKAgentDefinition['model'];

    result[name] = {
      description: agent.description,
      prompt: enhancedPrompt,
      tools: agent.tools,
      model: sdkModel,
    };
  }

  return result;
}

/**
 * Build a completion summary for finished workflow tasks.
 *
 * Generates a formatted summary containing task details, execution metrics,
 * token usage statistics, estimated costs, and any artifacts created during execution.
 *
 * @param task - Completed task with usage statistics and artifacts
 * @returns Formatted completion summary string
 *
 * @example
 * ```typescript
 * const task: Task = {
 *   id: 'task-123',
 *   description: 'Add user authentication',
 *   status: 'completed',
 *   createdAt: new Date('2024-01-01'),
 *   completedAt: new Date('2024-01-01T01:00:00'),
 *   usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500, estimatedCost: 0.02 },
 *   artifacts: [{ name: 'auth.ts', type: 'file' }]
 * };
 *
 * const summary = buildCompletionSummary(task);
 * // Returns formatted summary with duration, usage stats, and artifacts
 * ```
 */
export function buildCompletionSummary(task: Task): string {
  return `
## Task Completion Summary

**Task**: ${task.description}
**Status**: ${task.status}
**Duration**: ${formatDuration(task.createdAt, task.completedAt || new Date())}

### Token Usage
- Input: ${task.usage.inputTokens.toLocaleString()}
- Output: ${task.usage.outputTokens.toLocaleString()}
- Total: ${task.usage.totalTokens.toLocaleString()}
- Estimated Cost: $${task.usage.estimatedCost.toFixed(4)}

### Artifacts Created
${task.artifacts.map((a) => `- ${a.name} (${a.type})`).join('\n') || 'None'}

${task.error ? `### Error\n${task.error}` : ''}
`;
}

/**
 * Format duration between two dates
 */
function formatDuration(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ============================================================================
// Stage-Specific Prompts for Multi-Agent Orchestration
// ============================================================================

/**
 * Context data required for building stage-specific prompts.
 *
 * Contains all information needed to generate targeted prompts for specific workflow stages,
 * including context from previous stages and agent-specific configuration.
 *
 * @example
 * ```typescript
 * const stageContext: StagePromptContext = {
 *   task: { id: 'task-123', description: 'Build feature' },
 *   stage: { name: 'implementation', agent: 'developer' },
 *   agent: { name: 'developer', description: 'Writes code' },
 *   workflow: { name: 'feature', stages: [...] },
 *   config: getEffectiveConfig('/project'),
 *   previousStageResults: new Map([
 *     ['planning', { status: 'completed', summary: 'Plan created' }]
 *   ])
 * };
 * ```
 */
export interface StagePromptContext {
  /** Current task being executed */
  task: Task;
  /** Current workflow stage */
  stage: WorkflowStage;
  /** Agent assigned to execute this stage */
  agent: AgentDefinition;
  /** Complete workflow definition */
  workflow: WorkflowDefinition;
  /** Effective configuration for the project */
  config: ReturnType<typeof getEffectiveConfig>;
  /** Results from previously completed stages */
  previousStageResults: Map<string, StageResult>;
}

/**
 * Build a focused prompt for a specific workflow stage.
 *
 * Creates targeted prompts for individual agents working on specific workflow stages.
 * Includes stage context, inputs from previous stages, expected outputs, and agent-specific
 * instructions. Replaces monolithic orchestrator prompts with focused agent guidance.
 *
 * @param context - Complete stage context including task, agent, workflow, and previous results
 * @returns Formatted stage-specific prompt string for the assigned agent
 *
 * @example
 * ```typescript
 * const stageContext: StagePromptContext = {
 *   task: { id: 'task-123', description: 'Add auth' },
 *   stage: { name: 'implementation', agent: 'developer' },
 *   agent: { name: 'developer', description: 'Writes code' },
 *   workflow: { name: 'feature', stages: [...] },
 *   config: getEffectiveConfig('/project'),
 *   previousStageResults: new Map([['planning', { status: 'completed', summary: '...' }]])
 * };
 *
 * const prompt = buildStagePrompt(stageContext);
 * // Returns: "# Developer Agent - implementation Stage\nYou are the **developer** agent..."
 * ```
 */
export function buildStagePrompt(context: StagePromptContext): string {
  // For backward compatibility, return the text prompt from the multimodal result
  const result = buildStagePromptMultimodal(context);
  return result.textPrompt;
}

/**
 * Build a focused multimodal prompt for a specific workflow stage.
 *
 * Creates targeted prompts for individual agents working on specific workflow stages.
 * Supports both text and multimodal content including images from the task's multimodal context.
 * This is the new multimodal-aware version of buildStagePrompt.
 *
 * @param context - Complete stage context including task, agent, workflow, and previous results
 * @returns MultimodalPromptResult with both text and structured content for Claude SDK
 *
 * @example
 * ```typescript
 * const stageContext: StagePromptContext = {
 *   task: {
 *     id: 'task-123',
 *     description: 'Add auth',
 *     multimodalContext: { inputs: [...] } // Contains processed images
 *   },
 *   stage: { name: 'implementation', agent: 'developer' },
 *   agent: { name: 'developer', description: 'Writes code' },
 *   workflow: { name: 'feature', stages: [...] },
 *   config: getEffectiveConfig('/project'),
 *   previousStageResults: new Map([['planning', { status: 'completed', summary: '...' }]])
 * };
 *
 * const result = buildStagePromptMultimodal(stageContext);
 * if (result.hasMultimodalContent) {
 *   // Use multimodal API
 *   const userMessage = { content: result.contentBlocks, ... };
 * } else {
 *   // Use text-only API
 *   const prompt = result.textPrompt;
 * }
 * ```
 */
export function buildStagePromptMultimodal(context: StagePromptContext): MultimodalPromptResult {
  const { task, stage, agent, workflow, config, previousStageResults } = context;

  // Get inputs from previous stages
  const inputs = getStageInputs(stage, previousStageResults);

  // Format previous stage summaries for context
  const previousWork = formatPreviousStages(stage, workflow, previousStageResults);

  // Build multimodal context description
  const multimodalDescription = buildMultimodalContextDescription(task.multimodalContext);

  // Build the text content for the prompt
  const textContent = `# ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)} Agent - ${stage.name} Stage

You are the **${agent.name}** agent working on the **${stage.name}** stage of a ${workflow.name} workflow.

## Your Role
${agent.description}

## Task Overview
${task.description}
${task.acceptanceCriteria ? `\n### Acceptance Criteria\n${task.acceptanceCriteria}` : ''}

## Your Stage: ${stage.name}
${stage.description || `Execute the ${stage.name} stage of the workflow`}

${inputs ? `## Inputs from Previous Stages\n${inputs}\n` : ''}
${previousWork ? `## Previous Work Completed\n${previousWork}\n` : ''}
## Expected Outputs
${formatExpectedOutputs(stage)}

## Project Context
- **Project**: ${config.project.name}
${config.project.language ? `- **Language**: ${config.project.language}` : ''}
${config.project.framework ? `- **Framework**: ${config.project.framework}` : ''}
- **Branch**: ${task.branchName || 'main'}
${multimodalDescription}

## Instructions
1. Focus ONLY on your assigned stage: **${stage.name}**
2. Do not attempt work belonging to other stages
3. **CRITICAL: Before completing, you MUST verify**:
   - Run \`npm run build\` - must pass with NO errors
   - Run \`npm run test\` - ALL tests must pass
   - If either fails, FIX THE ISSUES before marking complete
   - Never complete a stage with broken code or failing tests
4. When complete, provide a clear summary of what you accomplished
5. List any files created or modified
6. If you identify issues for later stages, note them but don't act on them

${agent.prompt}

## Output Format
When you complete your work, end with a structured summary:

\`\`\`
### Stage Summary: ${stage.name}
**Status**: completed | failed
**Summary**: <Brief description of what was accomplished>
**Files Modified**: <List of files created/modified>
**Outputs**: <Key outputs for next stages>
**Notes for Next Stages**: <Any important context>
\`\`\`

Begin your work on the ${stage.name} stage now.`;

  // Extract images from multimodal context
  const images = extractImagesFromMultimodalContext(task.multimodalContext);

  // Build multimodal content
  return buildMultimodalContent(textContent, images);
}

/**
 * Get formatted inputs from previous stages based on dependencies
 */
function getStageInputs(
  stage: WorkflowStage,
  previousResults: Map<string, StageResult>
): string | null {
  if (!stage.dependsOn || stage.dependsOn.length === 0) {
    return null;
  }

  const inputs: string[] = [];

  for (const depName of stage.dependsOn) {
    const result = previousResults.get(depName);
    if (result && result.status === 'completed') {
      inputs.push(`### From ${depName} stage (${result.agent}):`);
      inputs.push(`**Summary**: ${result.summary}`);

      if (Object.keys(result.outputs).length > 0) {
        inputs.push(`**Outputs**:`);
        for (const [key, value] of Object.entries(result.outputs)) {
          const valueStr = typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2);
          inputs.push(`- ${key}: ${valueStr.substring(0, 500)}${valueStr.length > 500 ? '...' : ''}`);
        }
      }

      if (result.artifacts.length > 0) {
        inputs.push(`**Files**: ${result.artifacts.join(', ')}`);
      }
      inputs.push('');
    }
  }

  return inputs.length > 0 ? inputs.join('\n') : null;
}

/**
 * Format previous stages that have completed
 */
function formatPreviousStages(
  currentStage: WorkflowStage,
  workflow: WorkflowDefinition,
  previousResults: Map<string, StageResult>
): string | null {
  const completed: string[] = [];

  for (const stage of workflow.stages) {
    if (stage.name === currentStage.name) break;

    const result = previousResults.get(stage.name);
    if (result) {
      completed.push(`- **${stage.name}** (${result.agent}): ${result.status} - ${result.summary.substring(0, 100)}${result.summary.length > 100 ? '...' : ''}`);
    }
  }

  return completed.length > 0 ? completed.join('\n') : null;
}

/**
 * Format expected outputs for a stage
 */
function formatExpectedOutputs(stage: WorkflowStage): string {
  if (!stage.outputs || stage.outputs.length === 0) {
    return 'Complete your assigned work for this stage.';
  }

  return stage.outputs.map(output => `- **${output}**: Provide this in your summary`).join('\n');
}

/**
 * Build a specialized prompt for the planning stage with decomposition support.
 *
 * Creates targeted prompts for planner agents that include comprehensive instructions
 * for task analysis and decomposition. Provides guidelines for when to decompose
 * complex tasks into manageable subtasks with different execution strategies.
 *
 * @param context - Stage context containing task, agent, workflow and configuration
 * @returns Formatted planning stage prompt with decomposition instructions
 *
 * @example
 * ```typescript
 * const plannerContext: StagePromptContext = {
 *   task: { description: 'Implement full user management system' },
 *   stage: { name: 'planning', agent: 'planner' },
 *   agent: { name: 'planner', description: 'Plans implementation' },
 *   workflow: { name: 'feature', stages: [...] },
 *   config: getEffectiveConfig('/project'),
 *   previousStageResults: new Map()
 * };
 *
 * const prompt = buildPlannerStagePrompt(plannerContext);
 * // Returns planning prompt with decomposition instructions and format requirements
 * ```
 */
export function buildPlannerStagePrompt(context: StagePromptContext): string {
  // For backward compatibility, return the text prompt from the multimodal result
  const result = buildPlannerStagePromptMultimodal(context);
  return result.textPrompt;
}

/**
 * Build a specialized multimodal prompt for the planning stage with decomposition support.
 *
 * Creates targeted prompts for planner agents that include comprehensive instructions
 * for task analysis and decomposition. Supports multimodal content including images
 * for visual context when planning implementations.
 *
 * @param context - Stage context containing task, agent, workflow and configuration
 * @returns MultimodalPromptResult with planning stage prompt and optional images
 *
 * @example
 * ```typescript
 * const plannerContext: StagePromptContext = {
 *   task: {
 *     description: 'Implement full user management system',
 *     multimodalContext: { inputs: [{ type: 'image', ... }] }
 *   },
 *   stage: { name: 'planning', agent: 'planner' },
 *   agent: { name: 'planner', description: 'Plans implementation' },
 *   workflow: { name: 'feature', stages: [...] },
 *   config: getEffectiveConfig('/project'),
 *   previousStageResults: new Map()
 * };
 *
 * const result = buildPlannerStagePromptMultimodal(plannerContext);
 * // Returns planning prompt with decomposition instructions and optional design images
 * ```
 */
export function buildPlannerStagePromptMultimodal(context: StagePromptContext): MultimodalPromptResult {
  const { task, stage, agent, workflow, config, previousStageResults } = context;

  // Build multimodal context description
  const multimodalDescription = buildMultimodalContextDescription(task.multimodalContext);

  const textContent = `# ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)} Agent - Planning Stage

You are the **${agent.name}** agent responsible for planning the implementation of a task.

## Your Role
${agent.description}

## Task to Plan
${task.description}
${task.acceptanceCriteria ? `\n### Acceptance Criteria\n${task.acceptanceCriteria}` : ''}

## Project Context
- **Project**: ${config.project.name}
${config.project.language ? `- **Language**: ${config.project.language}` : ''}
${config.project.framework ? `- **Framework**: ${config.project.framework}` : ''}
- **Workflow**: ${workflow.name}
${multimodalDescription}

## CRITICAL: Task Analysis and Decomposition

**IMPORTANT**: Most tasks should be DECOMPOSED into subtasks. Only truly simple tasks (single function, minor bug fix, small config change) should skip decomposition.

### You MUST DECOMPOSE if the task:
- References a ROADMAP, epic, or multi-item list
- Involves multiple features or components
- Spans different areas (backend + frontend + tests + docs)
- Would require more than ~500 lines of code changes
- Contains words like "implement", "add all", "complete", "full"

### Decomposition Format (REQUIRED for complex tasks):

\`\`\`decompose
{
  "reason": "Brief explanation of why decomposition is needed",
  "strategy": "sequential|parallel|dependency-based",
  "subtasks": [
    {
      "description": "Clear, specific subtask description",
      "acceptanceCriteria": "How to verify this subtask is complete",
      "workflow": "feature",
      "dependsOn": []
    },
    {
      "description": "Another subtask",
      "acceptanceCriteria": "Verification criteria",
      "dependsOn": ["Clear, specific subtask description"]
    }
  ]
}
\`\`\`

### Decomposition Strategies:
- **sequential**: Subtasks must run in order (most common)
- **parallel**: Independent subtasks can run simultaneously
- **dependency-based**: Subtasks run when their explicit dependencies complete

### Only for SIMPLE tasks (rare):
If the task is truly simple (single small change):
- Create a brief implementation plan
- Do NOT use the decompose block

${agent.prompt}

## Output Format

If NOT decomposing (simple task):
\`\`\`
### Planning Summary
**Approach**: <High-level approach>
**Key Files**: <Files to modify>
**Steps**:
1. Step one
2. Step two
...
**Risks**: <Any concerns>
\`\`\`

If DECOMPOSING (complex task):
1. First provide a brief analysis explaining why decomposition is appropriate
2. Then include the decompose block with your subtask definitions
3. The system will create subtasks and execute them according to the strategy

Begin your analysis now.`;

  // Extract images from multimodal context
  const images = extractImagesFromMultimodalContext(task.multimodalContext);

  // Build multimodal content
  return buildMultimodalContent(textContent, images);
}

/**
 * Parse the planner's output to extract decomposition request details.
 *
 * Analyzes planner output for decomposition blocks, validates the JSON structure,
 * and returns a structured decomposition request with subtasks and execution strategy.
 * Falls back to no decomposition if parsing fails or format is invalid.
 *
 * @param output - Raw output text from the planner agent
 * @returns Parsed decomposition request with validation and normalization applied
 *
 * @example
 * ```typescript
 * const plannerOutput = `
 * \`\`\`decompose
 * {
 *   "reason": "Complex feature needs breakdown",
 *   "strategy": "sequential",
 *   "subtasks": [
 *     { "description": "Create models", "acceptanceCriteria": "Models validate input" },
 *     { "description": "Build API", "dependsOn": ["Create models"] }
 *   ]
 * }
 * \`\`\`
 * `;
 *
 * const request = parseDecompositionRequest(plannerOutput);
 * // Returns: { shouldDecompose: true, subtasks: [...], strategy: 'sequential' }
 * ```
 */
export function parseDecompositionRequest(output: string): DecompositionRequest {
  const decomposeMatch = output.match(/```decompose\s*([\s\S]*?)```/);

  if (!decomposeMatch) {
    return {
      shouldDecompose: false,
      subtasks: [],
      strategy: 'sequential',
    };
  }

  try {
    const jsonStr = decomposeMatch[1].trim();
    const parsed = JSON.parse(jsonStr);

    // Validate the structure
    if (!parsed.subtasks || !Array.isArray(parsed.subtasks) || parsed.subtasks.length === 0) {
      return {
        shouldDecompose: false,
        subtasks: [],
        strategy: 'sequential',
      };
    }

    // Validate and normalize subtasks
    const subtasks: SubtaskDefinition[] = parsed.subtasks.map((s: Record<string, unknown>) => ({
      description: String(s.description || ''),
      acceptanceCriteria: s.acceptanceCriteria ? String(s.acceptanceCriteria) : undefined,
      workflow: s.workflow ? String(s.workflow) : undefined,
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(String) : undefined,
    })).filter((s: SubtaskDefinition) => s.description.length > 0);

    if (subtasks.length === 0) {
      return {
        shouldDecompose: false,
        subtasks: [],
        strategy: 'sequential',
      };
    }

    // Validate strategy
    const validStrategies: SubtaskStrategy[] = ['sequential', 'parallel', 'dependency-based'];
    const strategy = validStrategies.includes(parsed.strategy)
      ? parsed.strategy as SubtaskStrategy
      : 'sequential';

    return {
      shouldDecompose: true,
      subtasks,
      strategy,
      reason: parsed.reason ? String(parsed.reason) : undefined,
    };
  } catch {
    // JSON parsing failed, no decomposition
    return {
      shouldDecompose: false,
      subtasks: [],
      strategy: 'sequential',
    };
  }
}

/**
 * Check if a stage is a planning stage that supports task decomposition.
 *
 * Identifies planning stages by checking stage name or agent type to determine
 * if the stage should support task decomposition functionality.
 *
 * @param stage - Workflow stage to check for planning capabilities
 * @returns True if the stage is a planning stage that supports decomposition
 *
 * @example
 * ```typescript
 * const planningStage: WorkflowStage = { name: 'planning', agent: 'planner' };
 * const devStage: WorkflowStage = { name: 'implementation', agent: 'developer' };
 *
 * isPlanningStage(planningStage); // true
 * isPlanningStage(devStage); // false
 * ```
 */
export function isPlanningStage(stage: WorkflowStage): boolean {
  return stage.name === 'planning' || stage.name === 'plan' || stage.agent === 'planner';
}

/**
 * Check if a stage is a code generation stage that should trigger auto-fix.
 *
 * Identifies stages that write, modify, or generate code files by examining
 * the agent type, stage outputs, and stage names. Used to determine when
 * automatic code quality fixes should be applied after stage completion.
 *
 * @param stage - Workflow stage to check for code generation capabilities
 * @returns True if the stage generates code and should trigger auto-fix processes
 *
 * @example
 * ```typescript
 * const devStage: WorkflowStage = { name: 'implementation', agent: 'developer' };
 * const testStage: WorkflowStage = { name: 'testing', agent: 'tester' };
 * const planStage: WorkflowStage = { name: 'planning', agent: 'planner' };
 *
 * isCodeGenerationStage(devStage); // true (developer agent generates code)
 * isCodeGenerationStage(testStage); // true (tester agent writes test files)
 * isCodeGenerationStage(planStage); // false (planner doesn't generate code)
 * ```
 */
export function isCodeGenerationStage(stage: WorkflowStage): boolean {
  // Check by agent name - these agents typically generate code
  if (stage.agent === 'developer' || stage.agent === 'tester') {
    return true;
  }

  // Check by stage outputs - stages that produce code artifacts
  if (stage.outputs) {
    const codeOutputTypes = ['code_changes', 'test_files', 'implementation', 'files_modified'];
    const hasCodeOutput = stage.outputs.some(output =>
      codeOutputTypes.some(type => output.toLowerCase().includes(type.toLowerCase()))
    );
    if (hasCodeOutput) {
      return true;
    }
  }

  // Check by stage name patterns - configurable list of stage names that generate code
  const codeStageNames = ['implementation', 'testing', 'development', 'coding', 'build'];
  if (codeStageNames.includes(stage.name.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Build a resume prompt that combines context summary with original task for session resume.
 *
 * Creates a comprehensive resume context that helps agents understand what was previously
 * accomplished, key decisions made, and where to continue work. Includes checkpoint timing
 * information and extracted accomplishments and decisions from prior context.
 *
 * @param task - The task being resumed with description and current state
 * @param checkpoint - The checkpoint data containing stage and conversation state
 * @param contextSummary - A summarized version of the prior conversation context
 * @returns A formatted prompt section explaining the resume context
 *
 * @example
 * ```typescript
 * const task: Task = { id: 'task-123', description: 'Add authentication' };
 * const checkpoint: TaskCheckpoint = {
 *   createdAt: new Date('2024-01-01T10:00:00'),
 *   stage: 'implementation',
 *   stageIndex: 1
 * };
 * const contextSummary = "Created user model and validation logic...";
 *
 * const resumePrompt = buildResumePrompt(task, checkpoint, contextSummary);
 * // Returns formatted resume context with accomplishments and next steps
 * ```
 */
export function buildResumePrompt(
  task: Task,
  checkpoint: TaskCheckpoint,
  contextSummary: string
): string {
  const resumeTimestamp = new Date().toISOString();
  const checkpointAge = new Date().getTime() - checkpoint.createdAt.getTime();
  const formattedAge = formatDuration(checkpoint.createdAt, new Date());

  // Extract key decisions and accomplishments from the context summary
  const accomplishments = extractAccomplishments(contextSummary);
  const keyDecisions = extractKeyDecisions(contextSummary);

  return `## 🔄 SESSION RESUME CONTEXT

**Resuming Task**: ${task.description}
**Last Checkpoint**: ${checkpoint.createdAt.toISOString()} (${formattedAge} ago)
**Resume Point**: Stage "${checkpoint.stage || 'unknown'}" (index ${checkpoint.stageIndex})
**Resume Time**: ${resumeTimestamp}

### Prior Context Summary
${contextSummary}

### What Was Accomplished
${accomplishments.length > 0
  ? accomplishments.map(item => `- ${item}`).join('\n')
  : '- No specific accomplishments identified in prior context'
}

### Key Decisions Made
${keyDecisions.length > 0
  ? keyDecisions.map(item => `- ${item}`).join('\n')
  : '- No significant decisions identified in prior context'
}

### What Happens Next
You are resuming work from where the previous session left off. Use the context above to understand:
1. What has already been completed
2. What decisions were made and why
3. What the next logical steps should be

**Important**: This is a continuation of previous work, not a fresh start. Build upon the existing context and avoid repeating completed work.

---
`;
}

/**
 * Extract accomplishments from context summary using pattern matching
 * Looks for common patterns that indicate completed work
 *
 * @param contextSummary - The summarized context to analyze
 * @returns Array of accomplishment strings
 */
function extractAccomplishments(contextSummary: string): string[] {
  const accomplishments: string[] = [];
  const lines = contextSummary.split('\n');

  // Patterns that typically indicate accomplishments
  const accomplishmentPatterns = [
    /(?:completed|finished|implemented|created|built|added|fixed|updated|wrote|generated|developed)\s+(.+)/i,
    /(?:successfully|✓|✅)\s*(.+)/i,
    /(?:done|ready|finished):\s*(.+)/i,
    /(?:^|\s+)-\s*(.+(?:completed|implemented|created|built|added|fixed|updated|wrote|generated|developed).+)/i
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of accomplishmentPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const accomplishment = match[1].trim();
        if (accomplishment.length > 10 && accomplishment.length < 200) {
          accomplishments.push(accomplishment);
          break; // Only match first pattern per line
        }
      }
    }
  }

  // Remove duplicates and limit to most recent 5
  return [...new Set(accomplishments)].slice(0, 5);
}

/**
 * Extract key decisions from context summary using pattern matching
 * Looks for common patterns that indicate important decisions
 *
 * @param contextSummary - The summarized context to analyze
 * @returns Array of key decision strings
 */
function extractKeyDecisions(contextSummary: string): string[] {
  const decisions: string[] = [];
  const lines = contextSummary.split('\n');

  // Patterns that typically indicate decisions
  const decisionPatterns = [
    /(?:decided|chose|selected|opted|determined)\s+(?:to\s+)?(.+)/i,
    /(?:decision|approach|strategy|method):\s*(.+)/i,
    /(?:using|will use|plan to use)\s+(.+)/i,
    /(?:architecture|design|pattern):\s*(.+)/i,
    /(?:because|since|due to)\s+(.+)/i
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of decisionPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        const decision = match[1].trim();
        if (decision.length > 10 && decision.length < 200) {
          decisions.push(decision);
          break; // Only match first pattern per line
        }
      }
    }
  }

  // Remove duplicates and limit to most recent 5
  return [...new Set(decisions)].slice(0, 5);
}

/**
 * Build a prompt for the orchestrator to coordinate workflow stages.
 *
 * Creates coordination prompts used when deciding what to do next in a workflow
 * or handling stage failures. Provides current workflow state, stage status,
 * and decision options for the orchestrator to choose the next action.
 *
 * @param task - Current task being executed
 * @param workflow - Workflow definition with stages and description
 * @param completedStages - Map of completed stages with their results
 * @param currentStage - Optional currently executing stage
 * @param error - Optional error message from failed stage
 * @returns Formatted coordination prompt with stage status and decision options
 *
 * @example
 * ```typescript
 * const task: Task = { id: 'task-123', description: 'Add feature' };
 * const workflow: WorkflowDefinition = { name: 'feature', stages: [...] };
 * const completedStages = new Map([
 *   ['planning', { status: 'completed', summary: 'Plan ready' }]
 * ]);
 * const currentStage: WorkflowStage = { name: 'implementation', agent: 'developer' };
 *
 * const prompt = buildCoordinatorPrompt(task, workflow, completedStages, currentStage);
 * // Returns prompt with workflow status and coordination options
 * ```
 */
export function buildCoordinatorPrompt(
  task: Task,
  workflow: WorkflowDefinition,
  completedStages: Map<string, StageResult>,
  currentStage?: WorkflowStage,
  error?: string
): string {
  const stageStatus = workflow.stages.map(s => {
    const result = completedStages.get(s.name);
    if (result) {
      return `- ${s.name}: ${result.status}`;
    } else if (currentStage?.name === s.name) {
      return `- ${s.name}: IN PROGRESS`;
    } else {
      return `- ${s.name}: pending`;
    }
  }).join('\n');

  return `# Workflow Coordination

## Task: ${task.description}

## Workflow: ${workflow.name}
${workflow.description}

## Stage Status
${stageStatus}

${error ? `## Error in Current Stage\n${error}\n` : ''}

## Decision Required
Based on the current state, determine the next action:
1. Continue to next stage
2. Retry failed stage
3. Skip optional stage
4. Mark workflow complete
5. Mark workflow failed

Provide your decision and reasoning.`;
}
