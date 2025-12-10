import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  getEffectiveConfig,
} from '@apex/core';

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
): Record<string, { description: string; prompt: string; tools?: string[]; model?: string }> {
  const result: Record<string, { description: string; prompt: string; tools?: string[]; model?: string }> = {};

  for (const [name, agent] of Object.entries(agents)) {
    // Skip disabled agents
    if (config.agents.disabled.includes(name)) continue;

    // Only include enabled agents (if specified)
    if (config.agents.enabled.length > 0 && !config.agents.enabled.includes(name)) continue;

    // Enhance the agent prompt with APEX-specific instructions
    const enhancedPrompt = `${agent.prompt}

## APEX Integration
- Update status: \`curl -X POST "$APEX_API/tasks/$APEX_TASK_ID/status" -H "Content-Type: application/json" -d '{"status": "in-progress", "stage": "${name}"}'\`
- Log progress: \`curl -X POST "$APEX_API/tasks/$APEX_TASK_ID/log" -H "Content-Type: application/json" -d '{"level": "info", "agent": "${name}", "message": "..."}'\`
- Environment: APEX_TASK_ID, APEX_PROJECT, APEX_BRANCH are available`;

    result[name] = {
      description: agent.description,
      prompt: enhancedPrompt,
      tools: agent.tools,
      model: agent.model,
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
