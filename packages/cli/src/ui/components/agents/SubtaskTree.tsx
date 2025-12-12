import React from 'react';
import { Box, Text } from 'ink';

export interface SubtaskNode {
  id: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  children?: SubtaskNode[];
}

export interface SubtaskTreeProps {
  task: SubtaskNode;
  maxDepth?: number;
  collapsed?: boolean;
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
  collapsed = false,
}: SubtaskTreeProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <SubtaskNodeRow node={task} depth={0} maxDepth={maxDepth} isLast={true} />
    </Box>
  );
}

function SubtaskNodeRow({
  node,
  depth,
  maxDepth,
  isLast,
  prefix = '',
}: {
  node: SubtaskNode;
  depth: number;
  maxDepth: number;
  isLast: boolean;
  prefix?: string;
}): React.ReactElement {
  const { icon, color } = statusIcons[node.status];
  const connector = isLast ? '└── ' : '├── ';
  const childPrefix = prefix + (isLast ? '    ' : '│   ');

  const truncatedDesc = node.description.length > 50
    ? node.description.slice(0, 47) + '...'
    : node.description;

  return (
    <>
      <Box>
        <Text color="gray">{prefix}{depth > 0 ? connector : ''}</Text>
        <Text color={color}>[{icon}]</Text>
        <Text color={node.status === 'in-progress' ? 'white' : 'gray'}>
          {' '}{truncatedDesc}
        </Text>
      </Box>

      {node.children && depth < maxDepth && (
        <>
          {node.children.map((child, index) => (
            <SubtaskNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              maxDepth={maxDepth}
              isLast={index === node.children!.length - 1}
              prefix={childPrefix}
            />
          ))}
        </>
      )}

      {node.children && depth >= maxDepth && node.children.length > 0 && (
        <Box>
          <Text color="gray">{childPrefix}└── </Text>
          <Text color="gray" italic>
            ... {node.children.length} more subtasks
          </Text>
        </Box>
      )}
    </>
  );
}