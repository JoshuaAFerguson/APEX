/**
 * Prompt Builders for Self-Repair Loop
 *
 * Constructs structured prompts for the diagnosis and repair agent invocations.
 * Separates prompt engineering from loop mechanics for maintainability.
 *
 * @module repair-loop/repair-prompts
 */

import type { FixAttempt, Task } from '@apexcli/core';
import type {
  ClassifiedError,
  RepairDiagnosis,
  RepairFixPlan,
  RepairContext,
} from './repair-types.js';
import type { RepairTerminationReason } from './repair-events.js';

// ============================================================================
// Prompt Context Types
// ============================================================================

export interface DiagnosisPromptContext {
  task: Task;
  stageName: string;
  stageAgent: string;
  errors: ClassifiedError[];
  previousAttempts: FixAttempt[];
  stageOutput: string[];
  fileContents: Record<string, string>;
  acceptanceCriteria?: string;
}

export interface RepairPromptContext extends DiagnosisPromptContext {
  diagnosis: RepairDiagnosis;
  fixPlan: RepairFixPlan;
  maxFilesPerRepair: number;
}

export interface EscalationPromptContext {
  task: Task;
  stageName: string;
  errors: ClassifiedError[];
  previousAttempts: FixAttempt[];
  terminationReason: RepairTerminationReason;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build the prompt for the diagnosis step. Asks Claude to identify root cause
 * and suggest fix approaches, given error context and previous failed attempts.
 */
export function buildDiagnosisPrompt(ctx: DiagnosisPromptContext): string {
  const sections: string[] = [];

  sections.push('# Error Diagnosis');
  sections.push('');
  sections.push(`You are diagnosing a failure in the "${ctx.stageName}" stage (agent: ${ctx.stageAgent}).`);
  sections.push('');

  // Error details
  sections.push('## Error Details');
  sections.push('');
  for (const err of ctx.errors) {
    const location = [
      err.fingerprint.filePath,
      err.fingerprint.line ? `:${err.fingerprint.line}` : '',
      err.fingerprint.column ? `:${err.fingerprint.column}` : '',
    ].join('');

    sections.push(`- **[${err.category}]** ${err.fingerprint.message}`);
    if (location) sections.push(`  Location: \`${location}\``);
    if (err.fingerprint.code) sections.push(`  Code: \`${err.fingerprint.code}\``);
    sections.push(`  Severity: ${err.severity} | Recoverable: ${err.isRecoverable}`);
    sections.push('');
  }

  // Stage output (truncated to last ~100 lines)
  if (ctx.stageOutput.length > 0) {
    sections.push('## Stage Output (Last Run)');
    sections.push('');
    const truncated = ctx.stageOutput.slice(-100);
    if (ctx.stageOutput.length > 100) {
      sections.push(`[...truncated ${ctx.stageOutput.length - 100} earlier lines...]`);
    }
    sections.push('```');
    sections.push(truncated.join('\n'));
    sections.push('```');
    sections.push('');
  }

  // Relevant file contents
  const fileEntries = Object.entries(ctx.fileContents);
  if (fileEntries.length > 0) {
    sections.push('## Relevant File Contents');
    sections.push('');
    for (const [filePath, content] of fileEntries.slice(0, 5)) {
      sections.push(`### \`${filePath}\``);
      sections.push('```');
      // Truncate to ~200 lines around error location
      const lines = content.split('\n');
      if (lines.length > 200) {
        sections.push(lines.slice(0, 200).join('\n'));
        sections.push(`\n[...${lines.length - 200} more lines...]`);
      } else {
        sections.push(content);
      }
      sections.push('```');
      sections.push('');
    }
  }

  // Previous failed attempts (critical for avoiding repeated mistakes)
  if (ctx.previousAttempts.length > 0) {
    sections.push('## Previous Fix Attempts (DO NOT REPEAT THESE)');
    sections.push('');
    for (const attempt of ctx.previousAttempts) {
      const status = attempt.result.resolved ? 'RESOLVED' : 'FAILED';
      sections.push(`- **Attempt #${attempt.attemptNumber}**: "${attempt.approach}" → ${status}`);
      if (attempt.result.reason) {
        sections.push(`  Reason: ${attempt.result.reason}`);
      }
      if (attempt.result.newErrors && attempt.result.newErrors.length > 0) {
        sections.push(`  New errors introduced: ${attempt.result.newErrors.map(e => e.message).join('; ')}`);
      }
      sections.push('');
    }
  }

  // Task context
  sections.push('## Task Context');
  sections.push('');
  sections.push(`- **Task**: ${ctx.task.description}`);
  if (ctx.acceptanceCriteria) {
    sections.push(`- **Acceptance Criteria**: ${ctx.acceptanceCriteria}`);
  }
  sections.push(`- **Stage**: ${ctx.stageName}`);
  sections.push(`- **Agent**: ${ctx.stageAgent}`);
  sections.push('');

  // Instructions
  sections.push('## Instructions');
  sections.push('');
  sections.push('1. Identify the ROOT CAUSE of the failure (not just the symptom)');
  sections.push('2. Consider if this is related to a previous failed fix attempt');
  sections.push('3. Suggest 2-3 distinct approaches to fix the issue (ranked by confidence)');
  sections.push('4. Mark `requiresHumanInput: true` if the error requires information you cannot determine (missing credentials, ambiguous requirements, external service configuration)');
  sections.push('');
  sections.push('Respond with ONLY a JSON object in this exact format:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "rootCause": "Clear explanation of why the error occurs",');
  sections.push('  "errorCategory": "type|syntax|test|lint|build|dependency|runtime",');
  sections.push('  "affectedFiles": ["path/to/file1.ts", "path/to/file2.ts"],');
  sections.push('  "suggestedApproaches": [');
  sections.push('    "Most confident fix approach (1-2 sentences)",');
  sections.push('    "Alternative approach if first fails",');
  sections.push('    "Last resort approach"');
  sections.push('  ],');
  sections.push('  "confidence": 0.85,');
  sections.push('  "requiresHumanInput": false');
  sections.push('}');
  sections.push('```');

  return sections.join('\n');
}

/**
 * Build the prompt for the repair agent. Provides the fix plan, file contents,
 * and anti-patterns to avoid, then asks the agent to apply the fix.
 */
export function buildRepairPrompt(ctx: RepairPromptContext): string {
  const sections: string[] = [];

  sections.push(`# Self-Repair: Apply Fix`);
  sections.push('');
  sections.push(`You are fixing a failure in the "${ctx.stageName}" stage.`);
  sections.push('');

  // Diagnosis context
  sections.push('## Diagnosis');
  sections.push('');
  sections.push(`**Root cause**: ${ctx.diagnosis.rootCause}`);
  sections.push(`**Category**: ${ctx.diagnosis.errorCategory}`);
  sections.push(`**Confidence**: ${(ctx.diagnosis.confidence * 100).toFixed(0)}%`);
  sections.push('');

  // Fix plan
  sections.push('## Fix Plan');
  sections.push('');
  sections.push(`**Approach**: ${ctx.fixPlan.approach}`);
  sections.push('');
  sections.push('**Steps**:');
  for (let i = 0; i < ctx.fixPlan.steps.length; i++) {
    sections.push(`${i + 1}. ${ctx.fixPlan.steps[i]}`);
  }
  sections.push('');
  sections.push(`**Expected outcome**: ${ctx.fixPlan.expectedOutcome}`);
  sections.push('');

  // Files to modify (with contents)
  sections.push('## Files to Modify');
  sections.push('');
  for (const filePath of ctx.fixPlan.filesToModify) {
    sections.push(`### \`${filePath}\``);
    const content = ctx.fileContents[filePath];
    if (content) {
      sections.push('```');
      const lines = content.split('\n');
      if (lines.length > 300) {
        sections.push(lines.slice(0, 300).join('\n'));
        sections.push(`\n[...${lines.length - 300} more lines...]`);
      } else {
        sections.push(content);
      }
      sections.push('```');
    } else {
      sections.push('*(file contents not available — read it first)*');
    }
    sections.push('');
  }

  // Constraints
  sections.push('## Constraints');
  sections.push('');
  sections.push(`- ONLY modify the files listed above (maximum ${ctx.maxFilesPerRepair} files)`);
  sections.push('- Make MINIMAL, targeted changes — do not refactor unrelated code');
  sections.push('- Do NOT introduce new dependencies without clear justification');
  sections.push('- Preserve existing code style and conventions');
  sections.push('- After making changes, run the build/test command to verify the fix works');
  sections.push('');

  // Anti-patterns from previous failed attempts
  if (ctx.previousAttempts.length > 0) {
    sections.push('## Anti-Patterns (Previously Failed Approaches — DO NOT USE)');
    sections.push('');
    for (const attempt of ctx.previousAttempts) {
      if (!attempt.result.resolved) {
        sections.push(`- ❌ "${attempt.approach}" — failed: ${attempt.result.reason || 'did not resolve the error'}`);
      }
    }
    sections.push('');
  }

  // Task context
  sections.push('## Task Context');
  sections.push('');
  sections.push(`Task: ${ctx.task.description}`);
  if (ctx.acceptanceCriteria) {
    sections.push(`Acceptance criteria: ${ctx.acceptanceCriteria}`);
  }
  sections.push('');
  sections.push('Apply the fix now. Focus on resolving the specific error identified in the diagnosis.');

  return sections.join('\n');
}

/**
 * Build the prompt for generating an escalation report. Called when the repair
 * loop terminates without resolving the issue.
 */
export function buildEscalationPrompt(ctx: EscalationPromptContext): string {
  const sections: string[] = [];

  sections.push('# Generate Escalation Report');
  sections.push('');
  sections.push(`The self-repair loop for stage "${ctx.stageName}" has terminated.`);
  sections.push(`**Reason**: ${formatTerminationReason(ctx.terminationReason)}`);
  sections.push('');

  // Error summary
  sections.push('## Errors Encountered');
  sections.push('');
  for (const err of ctx.errors) {
    sections.push(`- [${err.category}] ${err.fingerprint.message}`);
    if (err.fingerprint.filePath) sections.push(`  File: ${err.fingerprint.filePath}`);
  }
  sections.push('');

  // Attempts history
  if (ctx.previousAttempts.length > 0) {
    sections.push('## Fix Attempts Made');
    sections.push('');
    for (const attempt of ctx.previousAttempts) {
      const status = attempt.result.resolved ? 'RESOLVED' : 'FAILED';
      sections.push(`### Attempt #${attempt.attemptNumber}: ${status}`);
      sections.push(`- Approach: ${attempt.approach}`);
      sections.push(`- Outcome: ${attempt.result.reason || (attempt.result.success ? 'Applied successfully but did not resolve' : 'Failed to apply')}`);
      if (attempt.result.newErrors && attempt.result.newErrors.length > 0) {
        sections.push(`- New errors: ${attempt.result.newErrors.map(e => e.message).join('; ')}`);
      }
      sections.push('');
    }
  }

  // Task context
  sections.push('## Task');
  sections.push('');
  sections.push(`${ctx.task.description}`);
  sections.push('');

  // Instructions
  sections.push('## Instructions');
  sections.push('');
  sections.push('Generate a concise escalation report in this JSON format:');
  sections.push('```json');
  sections.push('{');
  sections.push('  "summary": "1-2 sentence summary of the problem",');
  sections.push('  "rootCauseAnalysis": "Best understanding of why the error persists",');
  sections.push('  "suggestedActions": ["Action the human operator should take", "..."]');
  sections.push('}');
  sections.push('```');

  return sections.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

function formatTerminationReason(reason: RepairTerminationReason): string {
  switch (reason) {
    case 'max_attempts': return 'Maximum repair attempts reached';
    case 'loop_detected': return 'Repetitive error pattern detected (loop)';
    case 'budget_exceeded': return 'Repair cost budget exceeded';
    case 'timeout': return 'Repair time limit reached';
    case 'unrecoverable': return 'Error classified as unrecoverable';
    case 'escalated': return 'Escalated to human operator';
    case 'resolved': return 'Resolved (this should not appear in escalation)';
    default: return reason;
  }
}
