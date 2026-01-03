import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { DisplayMode, Task } from '@apexcli/core';
import { formatDuration } from '@apexcli/core';

export interface ApprovalGateRequest {
  /** Unique identifier for this gate */
  id: string;
  /** Type of approval gate */
  gateName: string;
  /** Task requesting approval */
  task: Task;
  /** Current stage or operation */
  stage?: string;
  /** Agent requesting approval */
  agent?: string;
  /** Context about what needs approval */
  context?: string;
  /** When approval was requested */
  requestedAt: Date;
  /** Optional timeout for auto-denial */
  timeout?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface ApprovalGateProps {
  /** The approval request */
  request: ApprovalGateRequest;
  /** Callback when user makes a decision */
  onDecision: (requestId: string, approved: boolean, comment?: string) => void;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Whether to auto-focus the gate */
  autoFocus?: boolean;
  /** Whether to show detailed information */
  showDetails?: boolean;
}

/**
 * Get gate type description and color
 */
function getGateInfo(gateName: string): { description: string; color: string; icon: string } {
  switch (gateName) {
    case 'before-commit':
      return {
        description: 'Code commit approval',
        color: 'yellow',
        icon: '📤',
      };
    case 'before-destructive':
      return {
        description: 'Destructive operation approval',
        color: 'red',
        icon: '⚠️',
      };
    case 'before-network':
      return {
        description: 'Network operation approval',
        color: 'cyan',
        icon: '🌐',
      };
    case 'before-file-write':
      return {
        description: 'File modification approval',
        color: 'blue',
        icon: '📝',
      };
    case 'review-all':
      return {
        description: 'General operation approval',
        color: 'magenta',
        icon: '👀',
      };
    default:
      return {
        description: 'Operation approval',
        color: 'white',
        icon: '✋',
      };
  }
}

/**
 * ApprovalGate component for requesting user authorization for autonomous operations
 */
export function ApprovalGate({
  request,
  onDecision,
  displayMode = 'normal',
  autoFocus = true,
  showDetails = true,
}: ApprovalGateProps): React.ReactElement {
  const [selectedOption, setSelectedOption] = useState<number>(0); // Default to "Approve"
  const [isActive, setIsActive] = useState(autoFocus);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const gateInfo = getGateInfo(request.gateName);
  const options = [
    { key: 'A', label: 'Approve', value: true, color: 'green' },
    { key: 'D', label: 'Deny', value: false, color: 'red' },
  ];

  // Update elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeElapsed(Date.now() - request.requestedAt.getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [request.requestedAt]);

  // Handle timeout
  useEffect(() => {
    if (request.timeout && timeElapsed >= request.timeout) {
      onDecision(request.id, false, 'Auto-denied due to timeout');
      setIsActive(false);
    }
  }, [request.timeout, timeElapsed, request.id, onDecision]);

  useInput((input, key) => {
    if (!isActive) return;

    if (key.leftArrow || key.upArrow) {
      setSelectedOption(Math.max(0, selectedOption - 1));
    } else if (key.rightArrow || key.downArrow) {
      setSelectedOption(Math.min(options.length - 1, selectedOption + 1));
    } else if (key.return) {
      const selectedValue = options[selectedOption].value;
      onDecision(request.id, selectedValue);
      setIsActive(false);
    } else if (key.escape) {
      onDecision(request.id, false, 'Cancelled by user');
      setIsActive(false);
    } else {
      // Handle direct key selection
      const optionIndex = options.findIndex(opt => opt.key.toLowerCase() === input.toLowerCase());
      if (optionIndex >= 0) {
        onDecision(request.id, options[optionIndex].value);
        setIsActive(false);
      }
    }
  });

  // Compact mode: single line approval
  if (displayMode === 'compact') {
    return (
      <Box gap={1} borderStyle="single" borderColor={gateInfo.color} paddingX={1}>
        <Text color={gateInfo.color}>{gateInfo.icon}</Text>
        <Text color="white" bold>Approval Required</Text>
        <Text color="gray">{request.gateName}</Text>
        <Text color="gray">
          [{options.map(opt => `${opt.key}=${opt.label}`).join('|')}]
        </Text>
        {request.timeout && (
          <Text color="yellow">
            {Math.max(0, Math.ceil((request.timeout - timeElapsed) / 1000))}s
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={gateInfo.color}
      paddingX={1}
      paddingY={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={gateInfo.color}>
          {gateInfo.icon} Approval Gate
        </Text>
        <Text color="gray">
          {formatDuration(timeElapsed)}
        </Text>
      </Box>

      {/* Gate information */}
      <Box flexDirection="column" marginBottom={1}>
        <Box gap={2}>
          <Text color="white" bold>Gate:</Text>
          <Text color={gateInfo.color}>{gateInfo.description}</Text>
        </Box>
        <Box gap={2}>
          <Text color="white" bold>Task:</Text>
          <Text color="cyan">{request.task.description}</Text>
        </Box>
        {request.stage && (
          <Box gap={2}>
            <Text color="white" bold>Stage:</Text>
            <Text color="gray">{request.stage}</Text>
          </Box>
        )}
        {request.agent && (
          <Box gap={2}>
            <Text color="white" bold>Agent:</Text>
            <Text color="magenta">{request.agent}</Text>
          </Box>
        )}
      </Box>

      {/* Context and details */}
      {showDetails && (
        <Box flexDirection="column" marginBottom={1}>
          {request.context && (
            <Box gap={2}>
              <Text color="white" bold>Context:</Text>
              <Text color="gray" wrap="wrap">{request.context}</Text>
            </Box>
          )}

          {request.metadata && Object.keys(request.metadata).length > 0 && (
            <>
              <Box marginTop={1}><Text color="white" bold>Details:</Text></Box>
              {Object.entries(request.metadata).map(([key, value]) => (
                <Box key={key} gap={2} marginLeft={2}>
                  <Text color="gray">{key}:</Text>
                  <Text color="white">
                    {typeof value === 'string' ? value : JSON.stringify(value)}
                  </Text>
                </Box>
              ))}
            </>
          )}
        </Box>
      )}

      {/* Timeout warning */}
      {request.timeout && (
        <Box marginBottom={1} paddingX={1} borderColor="yellow" borderStyle="round">
          <Text color="yellow">
            ⏰ Auto-deny in {Math.max(0, Math.ceil((request.timeout - timeElapsed) / 1000))} seconds
          </Text>
        </Box>
      )}

      {/* Options */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}><Text color="white" bold>Choose your decision:</Text></Box>
        {options.map((option, index) => (
          <Box key={option.value.toString()} gap={1} marginLeft={1}>
            <Text color={selectedOption === index ? 'white' : 'gray'}>
              {selectedOption === index ? '▶' : ' '}
            </Text>
            <Text
              color={selectedOption === index ? option.color : 'gray'}
              bold={selectedOption === index}
            >
              [{option.key}] {option.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Help text */}
      <Box borderTop={true} paddingTop={1}>
        <Text color="gray" dimColor>
          ↑↓/←→: Navigate • Enter: Confirm • Esc: Deny • A/D: Direct selection
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Approval queue for displaying multiple pending approvals
 */
export interface ApprovalQueueProps {
  /** Pending approval requests */
  requests: ApprovalGateRequest[];
  /** Callback when user makes a decision */
  onDecision: (requestId: string, approved: boolean, comment?: string) => void;
  /** Display mode */
  displayMode?: DisplayMode;
  /** Maximum requests to display */
  maxRequests?: number;
}

export function ApprovalQueue({
  requests,
  onDecision,
  displayMode = 'normal',
  maxRequests = 3,
}: ApprovalQueueProps): React.ReactElement {
  const [currentIndex, setCurrentIndex] = useState(0);
  const displayRequests = requests.slice(0, maxRequests);

  useInput((input, key) => {
    if (requests.length === 0) return;

    if (key.pageUp && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (key.pageDown && currentIndex < displayRequests.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  });

  if (requests.length === 0) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray" dimColor>No pending approvals</Text>
      </Box>
    );
  }

  // Compact mode: list view
  if (displayMode === 'compact') {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="yellow">
        <Box justifyContent="space-between" paddingX={1} borderBottom={true}>
          <Text bold color="yellow">Approval Queue</Text>
          <Text color="gray">{requests.length} pending</Text>
        </Box>

        <Box flexDirection="column" paddingX={1} paddingY={1}>
          {displayRequests.map((request, index) => (
            <ApprovalGate
              key={request.id}
              request={request}
              onDecision={onDecision}
              displayMode="compact"
              autoFocus={index === currentIndex}
              showDetails={false}
            />
          ))}

          {requests.length > maxRequests && (
            <Box marginTop={1}>
              <Text color="gray" dimColor>
                ... and {requests.length - maxRequests} more pending
              </Text>
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // Normal/verbose mode: focus on current request
  const currentRequest = displayRequests[currentIndex];

  return (
    <Box flexDirection="column">
      {/* Queue header */}
      <Box justifyContent="space-between" marginBottom={1} paddingX={1}>
        <Text bold color="yellow">
          Approval Queue ({currentIndex + 1}/{displayRequests.length})
        </Text>
        {displayRequests.length > 1 && (
          <Text color="gray" dimColor>
            PgUp/PgDn: Navigate queue
          </Text>
        )}
      </Box>

      {/* Current request */}
      <ApprovalGate
        request={currentRequest}
        onDecision={onDecision}
        displayMode={displayMode}
        autoFocus={true}
        showDetails={true}
      />

      {/* Queue summary */}
      {displayRequests.length > 1 && (
        <Box marginTop={1} paddingX={1} borderTop={true}>
          <Text color="gray" dimColor>
            Other pending: {displayRequests.slice(0, currentIndex)
              .concat(displayRequests.slice(currentIndex + 1))
              .map(req => getGateInfo(req.gateName).icon)
              .join(' ')
            }
          </Text>
        </Box>
      )}
    </Box>
  );
}

export default ApprovalGate;