/**
 * Example usage of the useStdoutDimensions hook
 *
 * This file demonstrates different ways to use the hook for responsive terminal UI.
 * It's not part of the build output, just for documentation purposes.
 */

import React from 'react';
import { Text, Box } from 'ink';
import { useStdoutDimensions } from '../useStdoutDimensions.js';

/**
 * Basic responsive component that adapts to terminal width
 */
export function ResponsiveStatusBar() {
  const { width, breakpoint } = useStdoutDimensions();

  if (breakpoint === 'narrow') {
    return (
      <Box width={width} borderStyle="single">
        <Text>Status: OK</Text>
      </Box>
    );
  }

  if (breakpoint === 'wide') {
    return (
      <Box width={width} borderStyle="double" padding={1}>
        <Text>System Status: All services operational ✓</Text>
        <Text> Terminal: {width}x</Text>
      </Box>
    );
  }

  // Normal breakpoint
  return (
    <Box width={width} borderStyle="single">
      <Text>Status: Operational ({width} cols)</Text>
    </Box>
  );
}

/**
 * Component that uses custom thresholds for different layouts
 */
export function CustomLayoutComponent() {
  const { width, height, breakpoint, isAvailable } = useStdoutDimensions({
    narrowThreshold: 80,
    wideThreshold: 140,
    fallbackWidth: 100,
    fallbackHeight: 30
  });

  const status = isAvailable ? "Live" : "Fallback";

  return (
    <Box width={width} height={height} flexDirection="column" borderStyle="round">
      <Text>Layout: {breakpoint} | Size: {width}x{height} | Mode: {status}</Text>

      {breakpoint === 'narrow' && (
        <Box flexDirection="column">
          <Text>• Compact mode</Text>
          <Text>• Essential info only</Text>
        </Box>
      )}

      {breakpoint === 'normal' && (
        <Box flexDirection="column">
          <Text>• Standard layout</Text>
          <Text>• Balanced information density</Text>
        </Box>
      )}

      {breakpoint === 'wide' && (
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="column" flex={1}>
            <Text>• Full feature layout</Text>
            <Text>• Side panels available</Text>
          </Box>
          <Box flexDirection="column" flex={1}>
            <Text>• Extra details</Text>
            <Text>• Rich formatting</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

/**
 * Progress bar that adapts its width to terminal size
 */
export function AdaptiveProgressBar({ progress }: { progress: number }) {
  const { width, breakpoint } = useStdoutDimensions();

  // Reserve space for brackets, percentage, and padding
  const availableWidth = Math.max(10, width - 10);
  const filledWidth = Math.floor((progress / 100) * availableWidth);
  const emptyWidth = availableWidth - filledWidth;

  const bar = '█'.repeat(filledWidth) + '░'.repeat(emptyWidth);
  const percentage = `${progress.toFixed(1)}%`;

  if (breakpoint === 'narrow') {
    // Show minimal progress in narrow mode
    return <Text>{percentage}</Text>;
  }

  return (
    <Text>
      [{bar}] {percentage}
    </Text>
  );
}

/**
 * Data table that adjusts column count based on terminal width
 */
export function ResponsiveDataTable({ data }: { data: Array<{ id: string; name: string; status: string; details: string }> }) {
  const { breakpoint, width } = useStdoutDimensions();

  const showId = breakpoint !== 'narrow';
  const showDetails = breakpoint === 'wide';

  return (
    <Box flexDirection="column" width={width}>
      <Box borderStyle="single" paddingX={1}>
        <Text weight="bold">
          {showId && "ID".padEnd(8)}
          {"Name".padEnd(20)}
          {"Status".padEnd(12)}
          {showDetails && "Details"}
        </Text>
      </Box>

      {data.map((row, index) => (
        <Box key={row.id} paddingX={1}>
          <Text>
            {showId && row.id.padEnd(8)}
            {row.name.padEnd(20)}
            {row.status.padEnd(12)}
            {showDetails && row.details}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Example usage with fallback handling
 */
export function FallbackAwareComponent() {
  const { width, height, isAvailable, breakpoint } = useStdoutDimensions({
    fallbackWidth: 120,
    fallbackHeight: 30
  });

  return (
    <Box flexDirection="column">
      <Text color={isAvailable ? "green" : "yellow"}>
        Terminal detection: {isAvailable ? "Active" : "Fallback mode"}
      </Text>

      <Text>
        Dimensions: {width}x{height} ({breakpoint})
      </Text>

      {!isAvailable && (
        <Text color="dim">
          Using fallback dimensions. Actual terminal may differ.
        </Text>
      )}
    </Box>
  );
}