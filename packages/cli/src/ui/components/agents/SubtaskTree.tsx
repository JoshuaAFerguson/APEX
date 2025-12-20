import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';

export interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
  // New fields for progress/timing
  progress?: number;          // 0-100 percentage (optional)
  startedAt?: Date;           // When the subtask started (for elapsed time)
  estimatedDuration?: number; // Estimated duration in ms (for progress estimation)
}

export interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  defaultCollapsed?: boolean;          // Initial collapsed state for all nodes
  initialCollapsedIds?: Set<string>;   // Specific nodes to start collapsed
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;
  showProgress?: boolean;              // Show progress indicators (default: true)
  showElapsedTime?: boolean;           // Show elapsed time (default: true)
  interactive?: boolean;               // Enable keyboard/click interaction (default: true)
  focusedNodeId?: string;              // Externally controlled focus
  onFocusChange?: (nodeId: string | null) => void;
}

const statusIcons: Record<SubtaskNode['status'], { icon: string; color: string }> = {
  pending: { icon: '○', color: 'gray' },
  'in-progress': { icon: '●', color: 'blue' },
  completed: { icon: '✓', color: 'green' },
  failed: { icon: '✗', color: 'red' },
};

export function SubtaskTree({
  task,
  maxDepth = 3,
  defaultCollapsed = false,
  initialCollapsedIds = new Set(),
  onToggleCollapse,
  showProgress = true,
  showElapsedTime = true,
  interactive = true,
  focusedNodeId,
  onFocusChange,
}: SubtaskTreeProps): React.ReactElement {
  // State for collapsed nodes
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(() => {
    if (defaultCollapsed) {
      // If defaultCollapsed is true, start with all nodes that have children collapsed
      const getNodeIds = (node: SubtaskNode): string[] => {
        const ids = node.children && node.children.length > 0 ? [node.id] : [];
        if (node.children) {
          node.children.forEach(child => ids.push(...getNodeIds(child)));
        }
        return ids;
      };
      return new Set(getNodeIds(task));
    }
    return new Set(initialCollapsedIds);
  });

  // State for focused node (internal if not externally controlled)
  const [internalFocusedId, setInternalFocusedId] = useState<string | null>(task.id);
  const currentFocusedId = focusedNodeId ?? internalFocusedId;

  // Create flat list of visible nodes for keyboard navigation
  const visibleNodes = useMemo(() => {
    const flattenNodes = (node: SubtaskNode, depth: number): Array<{ node: SubtaskNode; depth: number }> => {
      const result = [{ node, depth }];

      // Only include children if node is not collapsed and within maxDepth
      if (!collapsedNodes.has(node.id) && node.children && depth < maxDepth) {
        node.children.forEach(child => {
          result.push(...flattenNodes(child, depth + 1));
        });
      }

      return result;
    };

    return flattenNodes(task, 0);
  }, [task, collapsedNodes, maxDepth]);

  // Toggle collapse state
  const toggleCollapse = useCallback((nodeId: string) => {
    const wasCollapsed = collapsedNodes.has(nodeId);
    const newCollapsedNodes = new Set(collapsedNodes);

    if (wasCollapsed) {
      newCollapsedNodes.delete(nodeId);
    } else {
      newCollapsedNodes.add(nodeId);
    }

    setCollapsedNodes(newCollapsedNodes);
    onToggleCollapse?.(nodeId, !wasCollapsed);
  }, [collapsedNodes, onToggleCollapse]);

  // Handle focus change
  const handleFocusChange = useCallback((nodeId: string | null) => {
    if (focusedNodeId === undefined) {
      setInternalFocusedId(nodeId);
    }
    onFocusChange?.(nodeId);
  }, [focusedNodeId, onFocusChange]);

  // Keyboard input handling
  useInput((input, key) => {
    if (!interactive || !currentFocusedId) return;

    const currentIndex = visibleNodes.findIndex(item => item.node.id === currentFocusedId);
    if (currentIndex === -1) return;

    const currentNode = visibleNodes[currentIndex].node;

    if (key.upArrow || input === 'k') {
      // Move to previous node
      if (currentIndex > 0) {
        handleFocusChange(visibleNodes[currentIndex - 1].node.id);
      }
    } else if (key.downArrow || input === 'j') {
      // Move to next node
      if (currentIndex < visibleNodes.length - 1) {
        handleFocusChange(visibleNodes[currentIndex + 1].node.id);
      }
    } else if (input === ' ' || key.return) {
      // Toggle collapse/expand
      if (currentNode.children && currentNode.children.length > 0) {
        toggleCollapse(currentNode.id);
      }
    } else if (key.leftArrow || input === 'h') {
      // Collapse current node or move to parent
      if (!collapsedNodes.has(currentNode.id) && currentNode.children && currentNode.children.length > 0) {
        toggleCollapse(currentNode.id);
      } else {
        // Find parent node
        const parentNode = findParentNode(task, currentNode.id);
        if (parentNode) {
          handleFocusChange(parentNode.id);
        }
      }
    } else if (key.rightArrow || input === 'l') {
      // Expand current node or move to first child
      if (collapsedNodes.has(currentNode.id) && currentNode.children && currentNode.children.length > 0) {
        toggleCollapse(currentNode.id);
      } else if (!collapsedNodes.has(currentNode.id) && currentNode.children && currentNode.children.length > 0) {
        handleFocusChange(currentNode.children[0].id);
      }
    } else if (input === 'g') {
      // Move to first node (vim-style 'gg')
      if (visibleNodes.length > 0) {
        handleFocusChange(visibleNodes[0].node.id);
      }
    } else if (input === 'G') {
      // Move to last node (vim-style 'G')
      if (visibleNodes.length > 0) {
        handleFocusChange(visibleNodes[visibleNodes.length - 1].node.id);
      }
    }
  }, { isActive: interactive });

  return (
    <Box flexDirection="column">
      <SubtaskNodeRow
        node={task}
        depth={0}
        maxDepth={maxDepth}
        isLast={true}
        collapsedNodes={collapsedNodes}
        toggleCollapse={toggleCollapse}
        focusedNodeId={currentFocusedId}
        showProgress={showProgress}
        showElapsedTime={showElapsedTime}
      />
    </Box>
  );
}

// Helper function to find parent node
function findParentNode(root: SubtaskNode, targetId: string, parent: SubtaskNode | null = null): SubtaskNode | null {
  if (root.id === targetId) {
    return parent;
  }

  if (root.children) {
    for (const child of root.children) {
      const found = findParentNode(child, targetId, root);
      if (found) return found;
    }
  }

  return null;
}

// Enhanced SubtaskNodeRow component with memoization
const SubtaskNodeRow = React.memo(function SubtaskNodeRow({
  node,
  depth,
  maxDepth,
  isLast,
  prefix = '',
  collapsedNodes,
  toggleCollapse,
  focusedNodeId,
  showProgress,
  showElapsedTime,
}: {
  node: SubtaskNode;
  depth: number;
  maxDepth: number;
  isLast: boolean;
  prefix?: string;
  collapsedNodes: Set<string>;
  toggleCollapse: (nodeId: string) => void;
  focusedNodeId: string | null;
  showProgress: boolean;
  showElapsedTime: boolean;
}): React.ReactElement {
  const { icon, color } = statusIcons[node.status];
  const connector = isLast ? '└── ' : '├── ';
  const childPrefix = prefix + (isLast ? '    ' : '│   ');

  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsedNodes.has(node.id);
  const isFocused = focusedNodeId === node.id;
  const isInProgress = node.status === 'in-progress';

  // Get elapsed time for in-progress tasks
  const elapsedTime = useElapsedTime(isInProgress ? node.startedAt : null, 1000);

  // Collapse/expand indicator
  const collapseIndicator = hasChildren ? (isCollapsed ? '▶' : '▼') : ' ';

  // Children count when collapsed
  const childrenCount = hasChildren && isCollapsed ? ` (${node.children!.length})` : '';

  // Truncate description (adjust length based on additional content)
  const baseLength = 40;
  const adjustedLength = baseLength - (showProgress && isInProgress && node.progress !== undefined ? 15 : 0) - (showElapsedTime && isInProgress ? 10 : 0);
  const truncatedDesc = node.description.length > adjustedLength
    ? node.description.slice(0, adjustedLength - 3) + '...'
    : node.description;

  // Focus indicator - wrap description in brackets when focused
  const displayDesc = isFocused ? `⟨${truncatedDesc}⟩` : truncatedDesc;

  return (
    <>
      <Box>
        {/* Tree structure and collapse indicator */}
        <Text color="gray">{prefix}{depth > 0 ? connector : ''}</Text>
        {hasChildren && (
          <Text color="cyan">{collapseIndicator} </Text>
        )}
        {!hasChildren && depth > 0 && (
          <Text color="gray">  </Text>
        )}

        {/* Status icon */}
        <Text color={color}>[{icon}]</Text>

        {/* Description with focus highlighting */}
        <Text
          color={isFocused ? 'white' : (isInProgress ? 'white' : 'gray')}
          backgroundColor={isFocused ? 'blue' : undefined}
          inverse={isFocused}
        >
          {' '}{displayDesc}{childrenCount}
        </Text>

        {/* Progress indicator for in-progress tasks */}
        {showProgress && isInProgress && node.progress !== undefined && (
          <Box marginLeft={1}>
            <Text color="cyan">
              {/* Compact progress bar using block characters */}
              {Array.from({ length: 10 }, (_, i) => {
                const threshold = ((i + 1) / 10) * 100;
                return node.progress! >= threshold ? '█' : '░';
              }).join('')}
            </Text>
            <Text color="gray"> {Math.round(node.progress)}%</Text>
          </Box>
        )}

        {/* Elapsed time for in-progress tasks */}
        {showElapsedTime && isInProgress && node.startedAt && (
          <Box marginLeft={1}>
            <Text color="gray">⏱ {elapsedTime}</Text>
          </Box>
        )}
      </Box>

      {/* Render children if not collapsed and within maxDepth */}
      {hasChildren && !isCollapsed && depth < maxDepth && (
        <>
          {node.children!.map((child, index) => (
            <SubtaskNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              isLast={index === node.children!.length - 1}
              prefix={childPrefix}
              collapsedNodes={collapsedNodes}
              toggleCollapse={toggleCollapse}
              focusedNodeId={focusedNodeId}
              showProgress={showProgress}
              showElapsedTime={showElapsedTime}
            />
          ))}
        </>
      )}

      {/* Depth overflow indicator */}
      {hasChildren && !isCollapsed && depth >= maxDepth && node.children!.length > 0 && (
        <Box>
          <Text color="gray">{childPrefix}└── </Text>
          <Text color="gray" italic>
            ... {node.children!.length} more subtasks (max depth reached)
          </Text>
        </Box>
      )}

      {/* Collapsed children indicator */}
      {hasChildren && isCollapsed && (
        <Box>
          <Text color="gray">{childPrefix}└── </Text>
          <Text color="gray" italic>
            {node.children!.length} subtask{node.children!.length === 1 ? '' : 's'} (collapsed)
          </Text>
        </Box>
      )}
    </>
  );
});