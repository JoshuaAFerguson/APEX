'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { cn, truncateId } from '@/lib/utils'
import {
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'
import type { Task, TaskStatus } from '@apexcli/core'

/**
 * Represents a node in the subtask tree hierarchy
 */
export interface SubtaskTreeNode {
  id: string;
  description: string;
  status: TaskStatus;
  children: SubtaskTreeNode[];
  // Optional metadata
  progress?: number;
  createdAt?: Date;
  estimatedDuration?: number;
}

/**
 * Props for the SubtaskTree component
 */
export interface SubtaskTreeProps {
  /** The task ID to load subtasks for */
  taskId: string;

  /** Pre-loaded subtask tree (optional - will fetch if not provided) */
  tree?: SubtaskTreeNode;

  /** Maximum depth to render (default: 10, 0 = unlimited) */
  maxDepth?: number;

  /** Whether nodes start collapsed (default: false) */
  defaultCollapsed?: boolean;

  /** Initial set of node IDs that should be collapsed */
  initialCollapsedIds?: Set<string>;

  /** Callback when collapse state changes */
  onToggleCollapse?: (nodeId: string, collapsed: boolean) => void;

  /** Callback when a subtask is clicked (default: navigates to task page) */
  onSubtaskClick?: (subtaskId: string) => void;

  /** Whether keyboard navigation is enabled (default: true) */
  enableKeyboardNav?: boolean;

  /** Optional CSS class for the container */
  className?: string;

  /** Loading state indicator */
  loading?: boolean;

  /** Error message to display */
  error?: string | null;
}

/**
 * Tree line characters for visual hierarchy
 */
const TREE_CHARS = {
  vertical: '│',      // Continuing vertical line
  branch: '├─',       // Branch with sibling below
  lastBranch: '└─',   // Last branch (no sibling below)
  empty: '  ',        // Empty space for alignment
} as const

/**
 * Build tree from flat task array using parentTaskId relationships
 *
 * Algorithm:
 * 1. Create map of taskId -> task for O(1) lookups
 * 2. Identify root nodes (tasks with matching parentTaskId to current taskId)
 * 3. Recursively build children using subtaskIds array
 * 4. Sort children by creation date (oldest first)
 */
function buildSubtaskTree(
  tasks: Task[],
  rootTaskId: string
): SubtaskTreeNode | null {
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function buildNode(taskId: string): SubtaskTreeNode | null {
    const task = taskMap.get(taskId);
    if (!task) return null;

    return {
      id: task.id,
      description: task.description,
      status: task.status,
      children: (task.subtaskIds || [])
        .map(buildNode)
        .filter((n): n is SubtaskTreeNode => n !== null)
        .sort((a, b) => {
          // Sort by creation date if available, otherwise by id
          const aDate = tasks.find(t => t.id === a.id)?.createdAt
          const bDate = tasks.find(t => t.id === b.id)?.createdAt
          if (aDate && bDate) {
            return new Date(aDate).getTime() - new Date(bDate).getTime()
          }
          return a.id.localeCompare(b.id)
        }),
      progress: undefined, // Progress not available in current Task type
      createdAt: task.createdAt,
    };
  }

  return buildNode(rootTaskId);
}

/**
 * Flatten tree to get visible nodes for keyboard navigation
 */
function flattenVisibleNodes(
  tree: SubtaskTreeNode | null,
  collapsedNodes: Set<string>,
  maxDepth: number,
  currentDepth = 0
): Array<{ node: SubtaskTreeNode; depth: number }> {
  if (!tree || currentDepth > maxDepth) return [];

  const result: Array<{ node: SubtaskTreeNode; depth: number }> = [
    { node: tree, depth: currentDepth }
  ];

  // Only include children if node is not collapsed and within maxDepth
  if (!collapsedNodes.has(tree.id) && tree.children.length > 0 && currentDepth < maxDepth) {
    tree.children.forEach(child => {
      result.push(...flattenVisibleNodes(child, collapsedNodes, maxDepth, currentDepth + 1));
    });
  }

  return result;
}

/**
 * Hook for keyboard navigation
 */
function useKeyboardNavigation(
  visibleNodes: Array<{ node: SubtaskTreeNode; depth: number }>,
  focusedId: string | null,
  collapsedNodes: Set<string>,
  onFocusChange: (id: string | null) => void,
  onToggle: (id: string) => void,
  onNavigate: (id: string) => void,
  enabled: boolean,
  tree: SubtaskTreeNode | null
) {
  const findParentNode = useCallback((targetId: string): SubtaskTreeNode | null => {
    if (!tree) return null;

    function searchNode(node: SubtaskTreeNode, parent: SubtaskTreeNode | null = null): SubtaskTreeNode | null {
      if (node.id === targetId) return parent;

      for (const child of node.children) {
        const found = searchNode(child, node);
        if (found) return found;
      }
      return null;
    }

    return searchNode(tree);
  }, [tree]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedId || visibleNodes.length === 0) return;

      const currentIndex = visibleNodes.findIndex(item => item.node.id === focusedId);
      if (currentIndex === -1) return;

      const currentNode = visibleNodes[currentIndex].node;
      let handled = false;

      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          if (currentIndex > 0) {
            onFocusChange(visibleNodes[currentIndex - 1].node.id);
            handled = true;
          }
          break;

        case 'ArrowDown':
        case 'j':
          if (currentIndex < visibleNodes.length - 1) {
            onFocusChange(visibleNodes[currentIndex + 1].node.id);
            handled = true;
          }
          break;

        case 'ArrowLeft':
        case 'h':
          if (!collapsedNodes.has(currentNode.id) && currentNode.children.length > 0) {
            onToggle(currentNode.id);
          } else {
            const parent = findParentNode(currentNode.id);
            if (parent) {
              onFocusChange(parent.id);
            }
          }
          handled = true;
          break;

        case 'ArrowRight':
        case 'l':
          if (collapsedNodes.has(currentNode.id) && currentNode.children.length > 0) {
            onToggle(currentNode.id);
          } else if (!collapsedNodes.has(currentNode.id) && currentNode.children.length > 0) {
            onFocusChange(currentNode.children[0].id);
          }
          handled = true;
          break;

        case 'Enter':
        case ' ':
          if (currentNode.children.length > 0) {
            onToggle(currentNode.id);
          } else {
            onNavigate(currentNode.id);
          }
          handled = true;
          break;

        case 'g':
          if (visibleNodes.length > 0) {
            onFocusChange(visibleNodes[0].node.id);
            handled = true;
          }
          break;

        case 'G':
          if (visibleNodes.length > 0) {
            onFocusChange(visibleNodes[visibleNodes.length - 1].node.id);
            handled = true;
          }
          break;
      }

      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visibleNodes, focusedId, collapsedNodes, enabled, onFocusChange, onToggle, onNavigate, findParentNode]);
}

/**
 * SubtaskTree component displays subtasks in a hierarchical tree structure
 */
export function SubtaskTree({
  taskId,
  tree: propsTree,
  maxDepth = 10,
  defaultCollapsed = false,
  initialCollapsedIds = new Set(),
  onToggleCollapse,
  onSubtaskClick,
  enableKeyboardNav = true,
  className,
  loading: propsLoading,
  error: propsError,
}: SubtaskTreeProps) {
  const router = useRouter()
  const [fetchedTasks, setFetchedTasks] = useState<Task[]>([])
  const [tree, setTree] = useState<SubtaskTreeNode | null>(propsTree || null)
  const [loading, setLoading] = useState(propsLoading || false)
  const [error, setError] = useState<string | null>(propsError || null)

  // State for collapsed nodes
  const [collapsedNodes, setCollapsedNodes] = useState(() => {
    if (defaultCollapsed && tree) {
      // If defaultCollapsed is true, start with all nodes that have children collapsed
      const getNodeIds = (node: SubtaskTreeNode): string[] => {
        const ids = node.children.length > 0 ? [node.id] : [];
        node.children.forEach(child => ids.push(...getNodeIds(child)));
        return ids;
      };
      return new Set(getNodeIds(tree));
    }
    return new Set(initialCollapsedIds);
  });

  // State for focused node (keyboard navigation)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(tree?.id || null)

  // Fetch subtasks if tree not provided
  useEffect(() => {
    if (propsTree || propsLoading !== undefined) return;

    async function fetchSubtasks() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.getSubtasks(taskId);
        setFetchedTasks(response.subtasks);

        // Build tree from flat task array
        const builtTree = buildSubtaskTree(response.subtasks, taskId);
        setTree(builtTree);

        // Set initial focus to root
        if (builtTree) {
          setFocusedNodeId(builtTree.id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subtasks');
      } finally {
        setLoading(false);
      }
    }

    fetchSubtasks();
  }, [taskId, propsTree, propsLoading]);

  // Update tree when propsTree changes
  useEffect(() => {
    if (propsTree) {
      setTree(propsTree);
      setFocusedNodeId(propsTree.id);
    }
  }, [propsTree]);

  // Memoized visible nodes computation
  const visibleNodes = useMemo(() => {
    return flattenVisibleNodes(tree, collapsedNodes, maxDepth);
  }, [tree, collapsedNodes, maxDepth]);

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

  // Handle node click
  const handleNodeClick = useCallback((nodeId: string) => {
    if (onSubtaskClick) {
      onSubtaskClick(nodeId);
    } else {
      router.push(`/tasks/${nodeId}`);
    }
  }, [onSubtaskClick, router]);

  // Handle retry
  const handleRetry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.getSubtasks(taskId);
      setFetchedTasks(response.subtasks);

      const builtTree = buildSubtaskTree(response.subtasks, taskId);
      setTree(builtTree);

      if (builtTree) {
        setFocusedNodeId(builtTree.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Set up keyboard navigation
  useKeyboardNavigation(
    visibleNodes,
    focusedNodeId,
    collapsedNodes,
    setFocusedNodeId,
    toggleCollapse,
    handleNodeClick,
    enableKeyboardNav,
    tree
  );

  // Loading state
  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 py-4', className)}>
        <Spinner size="sm" />
        <span className="text-sm text-foreground-secondary">Loading subtasks...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('text-sm text-red-500 py-2', className)}>
        <div className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={handleRetry}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!tree || tree.children.length === 0) {
    return (
      <div className={cn('text-sm text-foreground-secondary py-4 text-center', className)}>
        No subtasks found
      </div>
    );
  }

  return (
    <div
      className={cn('subtask-tree', className)}
      role="tree"
      aria-label="Subtask tree"
      aria-activedescendant={focusedNodeId || undefined}
      tabIndex={0}
    >
      <SubtaskTreeNode
        node={tree}
        depth={0}
        maxDepth={maxDepth}
        isLast={true}
        prefix=""
        collapsedNodes={collapsedNodes}
        toggleCollapse={toggleCollapse}
        focusedNodeId={focusedNodeId}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}

/**
 * Props for the SubtaskTreeNode component
 */
interface SubtaskTreeNodeProps {
  node: SubtaskTreeNode;
  depth: number;
  maxDepth: number;
  isLast: boolean;
  prefix: string;
  collapsedNodes: Set<string>;
  toggleCollapse: (nodeId: string) => void;
  focusedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

/**
 * Memoized SubtaskTreeNode component for recursive rendering
 */
const SubtaskTreeNode = React.memo<SubtaskTreeNodeProps>(function SubtaskTreeNode({
  node,
  depth,
  maxDepth,
  isLast,
  prefix,
  collapsedNodes,
  toggleCollapse,
  focusedNodeId,
  onNodeClick,
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = collapsedNodes.has(node.id);
  const isFocused = focusedNodeId === node.id;

  // Tree line characters
  const connector = isLast ? TREE_CHARS.lastBranch : TREE_CHARS.branch;
  const childPrefix = prefix + (isLast ? TREE_CHARS.empty + TREE_CHARS.empty : TREE_CHARS.vertical + ' ');

  // Node classes
  const nodeClasses = cn(
    // Base styles
    'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
    'transition-colors duration-150',
    // Interactive states
    'hover:bg-background-secondary',
    // Focus state (keyboard nav)
    isFocused && 'bg-apex-950/50 ring-1 ring-apex-500',
  );

  const handleNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick(node.id);
  };

  const handleExpanderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      toggleCollapse(node.id);
    }
  };

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        aria-selected={isFocused}
        aria-level={depth + 1}
        id={`subtask-${node.id}`}
        className={nodeClasses}
        onClick={handleNodeClick}
      >
        {/* Tree structure prefix */}
        {depth > 0 && (
          <span className="text-foreground-secondary font-mono text-sm select-none">
            {prefix}{connector}
          </span>
        )}

        {/* Expand/collapse control */}
        {hasChildren ? (
          <button
            onClick={handleExpanderClick}
            className="flex items-center justify-center w-4 h-4 text-foreground-secondary hover:text-foreground transition-colors"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {/* Status badge */}
        <Badge status={node.status} className="text-xs" />

        {/* Task description */}
        <span className="text-sm flex-1 min-w-0 truncate">
          {node.description}
        </span>

        {/* Task ID */}
        <span className="text-xs text-foreground-secondary font-mono">
          {truncateId(node.id, 8)}
        </span>

        {/* Collapsed children count */}
        {hasChildren && isCollapsed && (
          <span className="text-xs text-foreground-secondary">
            ({node.children.length} {node.children.length === 1 ? 'subtask' : 'subtasks'})
          </span>
        )}
      </div>

      {/* Render children if not collapsed and within depth limit */}
      {hasChildren && !isCollapsed && depth < maxDepth && (
        <div>
          {node.children.map((child, index) => (
            <SubtaskTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              isLast={index === node.children.length - 1}
              prefix={childPrefix}
              collapsedNodes={collapsedNodes}
              toggleCollapse={toggleCollapse}
              focusedNodeId={focusedNodeId}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}

      {/* Max depth indicator */}
      {hasChildren && !isCollapsed && depth >= maxDepth && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground-secondary italic">
          <span className="font-mono text-sm">
            {childPrefix}{TREE_CHARS.lastBranch}
          </span>
          <span>... {node.children.length} more subtasks (max depth reached)</span>
        </div>
      )}

      {/* Collapsed indicator */}
      {hasChildren && isCollapsed && (
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground-secondary italic">
          <span className="font-mono text-sm">
            {childPrefix}{TREE_CHARS.lastBranch}
          </span>
          <span>
            {node.children.length} subtask{node.children.length === 1 ? '' : 's'} (collapsed)
          </span>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparison for memoization
  return (
    prev.node.id === next.node.id &&
    prev.node.status === next.node.status &&
    prev.node.description === next.node.description &&
    prev.focusedNodeId === next.focusedNodeId &&
    prev.collapsedNodes.has(prev.node.id) === next.collapsedNodes.has(next.node.id) &&
    prev.depth === next.depth &&
    prev.isLast === next.isLast
  );
});

export default SubtaskTree;