import React from 'react';
import { Box, Text } from 'ink';

export interface ServicesPanelProps {
  apiUrl?: string;
  webUrl?: string;
}

export function ServicesPanel({ apiUrl, webUrl }: ServicesPanelProps): React.ReactElement | null {
  // Don't render if no services are running
  if (!apiUrl && !webUrl) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
      marginBottom={1}
    >
      <Text color="green" bold>
        Services Running
      </Text>
      {apiUrl && (
        <Text>
          <Text color="gray">API: </Text>
          <Text color="cyan">{apiUrl}</Text>
        </Text>
      )}
      {webUrl && (
        <Text>
          <Text color="gray">Web: </Text>
          <Text color="cyan">{webUrl}</Text>
        </Text>
      )}
    </Box>
  );
}
