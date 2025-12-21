import React from 'react';
import { Box, Text } from 'ink';
import { useStdoutDimensions } from '../hooks/useStdoutDimensions.js';

export interface BannerProps {
  version: string;
  projectPath?: string;
  initialized?: boolean;
}

/**
 * Banner display mode type based on terminal width
 */
type BannerDisplayMode = 'text-only' | 'compact' | 'full';

/**
 * Breakpoint constants for Banner responsive layout
 */
const BANNER_BREAKPOINTS = {
  FULL_ART_MIN: 60,      // Show full ASCII art
  COMPACT_MIN: 40,       // Show compact text box
  // < 40: Text-only mode
} as const;

/**
 * Determine display mode based on terminal width
 */
function getDisplayMode(width: number): BannerDisplayMode {
  if (width >= BANNER_BREAKPOINTS.FULL_ART_MIN) return 'full';
  if (width >= BANNER_BREAKPOINTS.COMPACT_MIN) return 'compact';
  return 'text-only';
}

/**
 * Helper to truncate long paths for compact display
 */
function truncatePath(path: string, maxLen: number): string {
  if (path.length <= maxLen) return path;
  if (maxLen <= 3) return '.'.repeat(Math.max(0, maxLen));
  const parts = path.split('/');
  // Keep last few segments with ellipsis
  let result = '.../' + parts.slice(-2).join('/');
  if (result.length > maxLen) {
    result = '...' + path.slice(-(maxLen - 3));
  }
  if (result.length > maxLen) {
    result = result.slice(0, maxLen);
  }
  return result;
}

/**
 * Full ASCII art banner component (for wide terminals >= 60 columns)
 */
const FullAsciiArt: React.FC = () => {
  const asciiArt = `
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝`;

  return <Text color="cyan">{asciiArt}</Text>;
};

/**
 * Compact text box banner (for mid-size terminals 40-59 columns)
 */
const CompactBanner: React.FC = () => (
  <Box flexDirection="column">
    <Text color="cyan">┌─────────────────┐</Text>
    <Text color="cyan">│   ◆ APEX ◆     │</Text>
    <Text color="cyan">└─────────────────┘</Text>
  </Box>
);

/**
 * Text-only minimal banner (for narrow terminals < 40 columns)
 */
const TextOnlyBanner: React.FC<{ version: string }> = ({ version }) => (
  <Text>
    <Text color="cyan" bold>◆ APEX</Text>
    <Text color="gray"> v{version}</Text>
  </Text>
);

/**
 * Version line component with responsive text
 */
interface VersionLineProps {
  version: string;
  compact?: boolean;
}

const VersionLine: React.FC<VersionLineProps> = ({ version, compact = false }) => {
  if (compact) return null; // Version already shown in text-only banner

  return (
    <>
      <Text color="gray">  Autonomous Product Engineering eXecutor</Text>
      <Text color="gray" dimColor>
        {'  '}v{version}
      </Text>
    </>
  );
};

/**
 * Status line component with responsive layout
 */
interface StatusLineProps {
  initialized: boolean;
  projectPath?: string;
  compact?: boolean;
  width: number;
}

const StatusLine: React.FC<StatusLineProps> = ({
  initialized,
  projectPath,
  compact = false,
  width,
}) => {
  if (initialized && projectPath) {
    return compact ? (
      <Text>
        <Text color="green">✓ </Text>
        <Text color="cyan">{truncatePath(projectPath, Math.max(15, width - 10))}</Text>
      </Text>
    ) : (
      <Box marginTop={1}>
        <Text color="green">✓ </Text>
        <Text>Initialized in </Text>
        <Text color="cyan">{projectPath}</Text>
      </Box>
    );
  }

  return compact ? (
    <Text color="yellow">! Run /init</Text>
  ) : (
    <Box marginTop={1}>
      <Text color="yellow">! </Text>
      <Text color="gray">Not initialized. Run </Text>
      <Text color="cyan">/init</Text>
      <Text color="gray"> to get started.</Text>
    </Box>
  );
};

/**
 * Responsive Banner component that adapts display based on terminal width
 *
 * Displays:
 * - Full ASCII art (>= 60 columns)
 * - Compact text box (40-59 columns)
 * - Text-only minimal (< 40 columns)
 */
export function Banner({
  version,
  projectPath,
  initialized = false,
}: BannerProps): React.ReactElement {
  const { width } = useStdoutDimensions();
  const displayMode = getDisplayMode(width);
  const isTextOnly = displayMode === 'text-only';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {displayMode === 'full' && <FullAsciiArt />}
      {displayMode === 'compact' && <CompactBanner />}
      {displayMode === 'text-only' && <TextOnlyBanner version={version} />}

      <VersionLine version={version} compact={isTextOnly} />
      <StatusLine
        initialized={initialized}
        projectPath={projectPath}
        compact={isTextOnly}
        width={width}
      />
    </Box>
  );
}
