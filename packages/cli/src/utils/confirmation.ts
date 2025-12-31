import inquirer from 'inquirer';
import chalk from 'chalk';
import { ApexConfig, AutonomyLevel } from '@apexcli/core';

/**
 * Types of dangerous operations that may require confirmation
 */
export enum DangerousOperation {
  CANCEL_TASK = 'cancel_task',
  TRASH_TASK = 'trash_task',
  EMPTY_TRASH = 'empty_trash',
  MERGE_TASK = 'merge_task',
  DELETE_TEMPLATE = 'delete_template',
  UNARCHIVE_TASK = 'unarchive_task'
}

/**
 * Configuration for a dangerous operation warning
 */
interface OperationWarning {
  operation: DangerousOperation;
  title: string;
  description: string;
  consequenceLevel: 'low' | 'medium' | 'high';
  irreversible: boolean;
}

/**
 * Configuration for different dangerous operations
 */
const OPERATION_CONFIGS: Record<DangerousOperation, OperationWarning> = {
  [DangerousOperation.CANCEL_TASK]: {
    operation: DangerousOperation.CANCEL_TASK,
    title: 'Cancel Running Task',
    description: 'This will terminate the currently running task and any partial progress will be lost.',
    consequenceLevel: 'medium',
    irreversible: false
  },
  [DangerousOperation.TRASH_TASK]: {
    operation: DangerousOperation.TRASH_TASK,
    title: 'Move Task to Trash',
    description: 'This will move the task to trash. You can restore it later if needed.',
    consequenceLevel: 'low',
    irreversible: false
  },
  [DangerousOperation.EMPTY_TRASH]: {
    operation: DangerousOperation.EMPTY_TRASH,
    title: 'Empty Trash (Permanent Deletion)',
    description: 'This will permanently delete all tasks in trash. This action cannot be undone.',
    consequenceLevel: 'high',
    irreversible: true
  },
  [DangerousOperation.MERGE_TASK]: {
    operation: DangerousOperation.MERGE_TASK,
    title: 'Merge Task Branch',
    description: 'This will merge the task branch into the main branch. Git history will be modified.',
    consequenceLevel: 'medium',
    irreversible: false
  },
  [DangerousOperation.DELETE_TEMPLATE]: {
    operation: DangerousOperation.DELETE_TEMPLATE,
    title: 'Delete Task Template',
    description: 'This will permanently delete the task template. This action cannot be undone.',
    consequenceLevel: 'high',
    irreversible: true
  },
  [DangerousOperation.UNARCHIVE_TASK]: {
    operation: DangerousOperation.UNARCHIVE_TASK,
    title: 'Unarchive Task',
    description: 'This will restore the archived task to active state and may affect workspace organization.',
    consequenceLevel: 'low',
    irreversible: false
  }
};

/**
 * Options for confirmation prompts
 */
interface ConfirmationOptions {
  /** Additional context to display to the user */
  context?: string;
  /** Resource identifier (e.g., task ID, template name) */
  resourceId?: string;
  /** Resource description for better context */
  resourceDescription?: string;
  /** Force confirmation even in autonomous mode */
  forceConfirmation?: boolean;
}

/**
 * Determines if a confirmation prompt should be shown based on autonomy level
 * and operation type
 */
export function shouldShowConfirmation(
  operation: DangerousOperation,
  autonomyLevel: AutonomyLevel,
  options: ConfirmationOptions = {}
): boolean {
  // Always show confirmation if explicitly forced
  if (options.forceConfirmation) {
    return true;
  }

  const config = OPERATION_CONFIGS[operation];

  switch (autonomyLevel) {
    case 'full':
      // In full autonomy mode, only show confirmation for irreversible high-consequence operations
      return config.irreversible && config.consequenceLevel === 'high';

    case 'review-before-commit':
      // Show confirmation for medium and high consequence operations
      return config.consequenceLevel === 'medium' || config.consequenceLevel === 'high';

    case 'review-before-merge':
      // Show confirmation for high consequence operations and merges
      return config.consequenceLevel === 'high' || operation === DangerousOperation.MERGE_TASK;

    case 'manual':
      // Always show confirmation in manual mode
      return true;

    default:
      // Default to showing confirmation for unknown autonomy levels
      return true;
  }
}

/**
 * Shows a confirmation prompt for a dangerous operation
 * Returns true if the user confirms, false if they decline
 */
export async function confirmDangerousOperation(
  operation: DangerousOperation,
  options: ConfirmationOptions = {}
): Promise<boolean> {
  const config = OPERATION_CONFIGS[operation];

  console.log(); // Add spacing

  // Display warning box with appropriate styling based on consequence level
  const warningColor = config.consequenceLevel === 'high' ? 'red' :
                      config.consequenceLevel === 'medium' ? 'yellow' : 'cyan';

  console.log(chalk[warningColor](`⚠️  ${config.title}`));
  console.log(chalk.gray(config.description));

  if (config.irreversible) {
    console.log(chalk.red('🚨 This action is irreversible!'));
  }

  // Show additional context if provided
  if (options.context) {
    console.log(chalk.gray(`Context: ${options.context}`));
  }

  // Show resource details if provided
  if (options.resourceId) {
    console.log(chalk.gray(`Resource: ${options.resourceId}`));
  }

  if (options.resourceDescription) {
    console.log(chalk.gray(`Description: ${options.resourceDescription}`));
  }

  console.log(); // Add spacing

  // Create the confirmation prompt
  const prompt = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to proceed with this ${operation.replace('_', ' ')}?`,
      default: false // Default to false for safety
    }
  ]);

  return prompt.confirmed;
}

/**
 * Convenience function that combines autonomy checking and confirmation prompting
 * Returns true if the operation should proceed, false otherwise
 */
export async function requestConfirmation(
  operation: DangerousOperation,
  autonomyLevel: AutonomyLevel,
  options: ConfirmationOptions = {}
): Promise<boolean> {
  // Check if confirmation is needed based on autonomy level
  if (!shouldShowConfirmation(operation, autonomyLevel, options)) {
    return true; // Proceed without confirmation
  }

  // Show confirmation prompt
  return await confirmDangerousOperation(operation, options);
}

/**
 * Shows an operation cancelled message
 */
export function showOperationCancelled(operation: DangerousOperation): void {
  const config = OPERATION_CONFIGS[operation];
  console.log(chalk.yellow(`❌ ${config.title} cancelled by user.`));
}