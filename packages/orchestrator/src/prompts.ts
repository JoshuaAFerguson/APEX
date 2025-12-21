import type { AgentDefinition as SDKAgentDefinition } from '@anthropic-ai/claude-agent-sdk';
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
} from '@apexcli/core';

/**
 * Parsed decomposition request from planner output
 */
export interface DecompositionRequest {
  shouldDecompose: boolean;
  subtasks: SubtaskDefinition[];
  strategy: SubtaskStrategy;
  reason?: string;
}

export interface PromptContext {
  config: ReturnType<typeof getEffectiveConfig>;
  workflow: WorkflowDefinition;
  task: Task;
  agents: Record<string, AgentDefinition>;
}

/**
 * Build the orchestrator system prompt
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
3. **Test before completing**: Always run tests before marking implementation complete
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
    case 'full':
      return 'You have full autonomy. Execute the entire workflow without waiting for approvals.';
    case 'review-before-commit':
      return 'Pause before each git commit to allow human review. Show the diff and wait for approval.';
    case 'review-before-merge':
      return 'Execute freely but create a PR for human review before merging. Do not auto-merge.';
    case 'manual':
      return 'Pause at each major stage for human approval. Wait for explicit go-ahead before proceeding.';
    default:
      return 'Follow standard workflow with appropriate checkpoints.';
  }
}

/**
 * Build agent definitions for the Claude Agent SDK
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
 * Build a summary prompt for workflow completion
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

export interface StagePromptContext {
  task: Task;
  stage: WorkflowStage;
  agent: AgentDefinition;
  workflow: WorkflowDefinition;
  config: ReturnType<typeof getEffectiveConfig>;
  previousStageResults: Map<string, StageResult>;
}

/**
 * Build a focused prompt for a specific workflow stage
 * This replaces the monolithic orchestrator prompt with targeted agent prompts
 */
export function buildStagePrompt(context: StagePromptContext): string {
  const { task, stage, agent, workflow, config, previousStageResults } = context;

  // Get inputs from previous stages
  const inputs = getStageInputs(stage, previousStageResults);

  // Format previous stage summaries for context
  const previousWork = formatPreviousStages(stage, workflow, previousStageResults);

  return `# ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)} Agent - ${stage.name} Stage

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

## Instructions
1. Focus ONLY on your assigned stage: **${stage.name}**
2. Do not attempt work belonging to other stages
3. When complete, provide a clear summary of what you accomplished
4. List any files created or modified
5. If you identify issues for later stages, note them but don't act on them

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
 * Build a specialized prompt for the planning stage
 * Includes instructions for task decomposition when appropriate
 */
export function buildPlannerStagePrompt(context: StagePromptContext): string {
  const { task, stage, agent, workflow, config, previousStageResults } = context;

  return `# ${agent.name.charAt(0).toUpperCase() + agent.name.slice(1)} Agent - Planning Stage

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
}

/**
 * Parse the planner's output to extract decomposition request
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
 * Check if a stage is a planning stage that supports decomposition
 */
export function isPlanningStage(stage: WorkflowStage): boolean {
  return stage.name === 'planning' || stage.name === 'plan' || stage.agent === 'planner';
}

/**
 * Build a resume prompt that combines context summary with original task for session resume
 *
 * @param task - The task being resumed
 * @param checkpoint - The checkpoint data containing stage and conversation state
 * @param contextSummary - A summarized version of the prior conversation context
 * @returns A formatted prompt section explaining the resume context
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
 * Build a prompt for the orchestrator to coordinate stages
 * Used when deciding what to do next or handling errors
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
