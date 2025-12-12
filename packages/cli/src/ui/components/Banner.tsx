import React from 'react';
import { Box, Text } from 'ink';

export interface BannerProps {
  version: string;
  projectPath?: string;
  initialized?: boolean;
}

export function Banner({
  version,
  projectPath,
  initialized = false,
}: BannerProps): React.ReactElement {
  const asciiArt = `
   █████╗ ██████╗ ███████╗██╗  ██╗
  ██╔══██╗██╔══██╗██╔════╝╚██╗██╔╝
  ███████║██████╔╝█████╗   ╚███╔╝
  ██╔══██║██╔═══╝ ██╔══╝   ██╔██╗
  ██║  ██║██║     ███████╗██╔╝ ██╗
  ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝`;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan">{asciiArt}</Text>
      <Text color="gray">  Autonomous Product Engineering eXecutor</Text>
      <Text color="gray" dimColor>
        {'  '}v{version}
      </Text>

      {initialized && projectPath && (
        <Box marginTop={1}>
          <Text color="green">✓ </Text>
          <Text>Initialized in </Text>
          <Text color="cyan">{projectPath}</Text>
        </Box>
      )}

      {!initialized && (
        <Box marginTop={1}>
          <Text color="yellow">! </Text>
          <Text color="gray">Not initialized. Run </Text>
          <Text color="cyan">/init</Text>
          <Text color="gray"> to get started.</Text>
        </Box>
      )}
    </Box>
  );
}
