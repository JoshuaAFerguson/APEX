import inquirer from 'inquirer';
import chalk from 'chalk';
import { ApprovalRequiredEventData, ApprovalResponse } from '@apexcli/core';

/**
 * Options for the approval prompt
 */
export interface ApprovalPromptOptions {
  /** Event data from the approval:required event */
  eventData: ApprovalRequiredEventData;
  /** Callback function to handle user selection */
  onSelection: (response: ApprovalResponse) => Promise<void>;
}

/**
 * Displays a formatted approval prompt showing task description, resource impact,
 * and reason for approval request. Presents three options: Approve, Deny, Request More Info.
 */
export async function showApprovalPrompt(options: ApprovalPromptOptions): Promise<void> {
  const { eventData, onSelection } = options;

  console.log(); // Add spacing

  // Display approval header
  console.log(chalk.cyan('🚪 ') + chalk.bold.white('Approval Required'));
  console.log(chalk.gray('─'.repeat(80)));

  // Display task information
  if (eventData.description) {
    console.log(chalk.white('Description: ') + chalk.gray(eventData.description));
  }

  console.log(chalk.white('Task ID: ') + chalk.yellow(eventData.taskId));
  console.log(chalk.white('Gate: ') + chalk.cyan(eventData.gateName));

  if (eventData.stage) {
    console.log(chalk.white('Stage: ') + chalk.cyan(eventData.stage));
  }

  if (eventData.agent) {
    console.log(chalk.white('Agent: ') + chalk.magenta(eventData.agent));
  }

  // Display resource impact information
  if (eventData.affectedFiles && eventData.affectedFiles.length > 0) {
    console.log(chalk.white('\n📁 Affected Files:'));
    eventData.affectedFiles.slice(0, 5).forEach(file => {
      console.log(chalk.gray(`  • ${file}`));
    });
    if (eventData.affectedFiles.length > 5) {
      console.log(chalk.gray(`  ... and ${eventData.affectedFiles.length - 5} more files`));
    }
  }

  // Display changes summary
  if (eventData.changesSummary) {
    console.log(chalk.white('\n📝 Changes Summary:'));
    console.log(chalk.gray(eventData.changesSummary));
  }

  // Display additional context
  if (eventData.context && Object.keys(eventData.context).length > 0) {
    console.log(chalk.white('\n🔍 Context:'));
    Object.entries(eventData.context).forEach(([key, value]) => {
      console.log(chalk.gray(`  ${key}: ${String(value)}`));
    });
  }

  // Display timeout information
  if (eventData.timeoutMinutes || eventData.expiresAt) {
    console.log(chalk.white('\n⏰ Timeout:'));
    if (eventData.timeoutMinutes) {
      console.log(chalk.gray(`  ${eventData.timeoutMinutes} minutes from request`));
    }
    if (eventData.expiresAt) {
      const timeLeft = eventData.expiresAt.getTime() - Date.now();
      if (timeLeft > 0) {
        const minutesLeft = Math.floor(timeLeft / (1000 * 60));
        console.log(chalk.gray(`  Expires in ${minutesLeft} minutes`));
      } else {
        console.log(chalk.red('  ⚠️ Already expired'));
      }
    }
  }

  console.log(chalk.gray('─'.repeat(80)));
  console.log(); // Add spacing

  // Present the three options
  const prompt = await inquirer.prompt([
    {
      type: 'list',
      name: 'decision',
      message: 'How would you like to respond to this approval request?',
      choices: [
        {
          name: chalk.green('✅ Approve - Allow the operation to proceed'),
          value: 'approve',
          short: 'Approve'
        },
        {
          name: chalk.red('❌ Deny - Block the operation from proceeding'),
          value: 'deny',
          short: 'Deny'
        },
        {
          name: chalk.yellow('📝 Request More Info - Ask for additional details'),
          value: 'info',
          short: 'Request More Info'
        }
      ],
      default: 'approve'
    }
  ]);

  // Handle the user's decision
  let response: ApprovalResponse;
  const timestamp = new Date();
  const responseTimeMs = timestamp.getTime() - eventData.timestamp.getTime();

  switch (prompt.decision) {
    case 'approve':
      response = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'approved',
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'approve',
        approver: 'cli-user', // Could be made configurable
        timestamp,
        requestedAt: eventData.timestamp,
        responseTimeMs,
        stage: eventData.stage,
        approvalsReceived: 1,
        approvalsRequired: eventData.minApprovals || 1,
        resolved: true
      };

      console.log(chalk.green('\n✅ Approval granted. Task will continue...'));
      break;

    case 'deny':
      // Get reason for denial
      const denialPrompt = await inquirer.prompt([
        {
          type: 'input',
          name: 'reason',
          message: 'Please provide a reason for denial (optional):',
        }
      ]);

      response = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'denied',
        message: denialPrompt.reason || undefined,
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'deny',
        approver: 'cli-user',
        comment: denialPrompt.reason || undefined,
        timestamp,
        requestedAt: eventData.timestamp,
        responseTimeMs,
        stage: eventData.stage,
        approvalsReceived: 0,
        approvalsRequired: eventData.minApprovals || 1,
        resolved: true
      };

      console.log(chalk.red('\n❌ Approval denied. Task will be blocked.'));
      break;

    case 'info':
      // Get the information request
      const infoPrompt = await inquirer.prompt([
        {
          type: 'input',
          name: 'infoRequest',
          message: 'What additional information do you need?',
          validate: (input: string) => input.trim().length > 0 || 'Please specify what information you need'
        }
      ]);

      response = {
        requestId: eventData.approvalId,
        taskId: eventData.taskId,
        response: 'info-requested',
        message: infoPrompt.infoRequest,
        approvalId: eventData.approvalId,
        gateName: eventData.gateName,
        action: 'request-info',
        approver: 'cli-user',
        comment: infoPrompt.infoRequest,
        timestamp,
        requestedAt: eventData.timestamp,
        responseTimeMs,
        stage: eventData.stage,
        approvalsReceived: 0,
        approvalsRequired: eventData.minApprovals || 1,
        resolved: false
      };

      console.log(chalk.yellow('\n📝 Information requested. Waiting for response...'));
      break;

    default:
      throw new Error(`Unexpected decision: ${prompt.decision}`);
  }

  console.log(); // Add spacing

  // Call the callback with the response
  await onSelection(response);
}

/**
 * Prompts the user for additional information when handling an 'info-requested' response
 */
export async function promptForAdditionalInfo(
  originalRequest: ApprovalRequiredEventData,
  infoRequest: string
): Promise<string> {
  console.log(); // Add spacing

  console.log(chalk.yellow('📝 Additional Information Requested'));
  console.log(chalk.gray('─'.repeat(80)));
  console.log(chalk.white('Task: ') + chalk.yellow(originalRequest.taskId));
  console.log(chalk.white('Gate: ') + chalk.cyan(originalRequest.gateName));
  console.log(chalk.white('Request: ') + chalk.gray(infoRequest));
  console.log(chalk.gray('─'.repeat(80)));
  console.log();

  const prompt = await inquirer.prompt([
    {
      type: 'input',
      name: 'additionalInfo',
      message: 'Please provide the additional information:',
      validate: (input: string) => input.trim().length > 0 || 'Please provide the requested information'
    }
  ]);

  console.log(chalk.green('\n✅ Additional information provided.'));
  console.log(); // Add spacing

  return prompt.additionalInfo;
}