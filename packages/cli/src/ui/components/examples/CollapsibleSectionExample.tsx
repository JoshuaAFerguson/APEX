import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { CollapsibleSection } from '../CollapsibleSection.js';

/**
 * Example demonstrating various uses of the CollapsibleSection component
 */
export function CollapsibleSectionExample() {
  const [controlledState, setControlledState] = useState(false);

  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">CollapsibleSection Component Examples</Text>

      {/* Basic Usage */}
      <CollapsibleSection title="Basic Section">
        <Text>This is a basic collapsible section with default settings.</Text>
        <Text>Click on the header to toggle the content visibility.</Text>
      </CollapsibleSection>

      {/* Dimmed Secondary Section */}
      <CollapsibleSection
        title="Debug Information"
        dimmed
        defaultCollapsed={true}
      >
        <Text>This section uses dimmed styling for secondary content.</Text>
        <Text>It starts collapsed by default.</Text>
        <Text>Debug level: verbose</Text>
        <Text>Memory usage: 45MB</Text>
      </CollapsibleSection>

      {/* Controlled State */}
      <CollapsibleSection
        title="Controlled Section"
        collapsed={!controlledState}
        onToggle={(collapsed) => setControlledState(!collapsed)}
      >
        <Text>This section is controlled externally.</Text>
        <Text>State: {controlledState ? 'expanded' : 'collapsed'}</Text>
      </CollapsibleSection>

      {/* With Header Extra Content */}
      <CollapsibleSection
        title="Activity Log"
        headerExtra={<Text color="yellow">[5 entries]</Text>}
      >
        <Text>2023-01-01 10:00 - Task started</Text>
        <Text>2023-01-01 10:05 - Processing data</Text>
        <Text>2023-01-01 10:10 - Validation complete</Text>
        <Text>2023-01-01 10:15 - Results saved</Text>
        <Text>2023-01-01 10:20 - Task completed</Text>
      </CollapsibleSection>

      {/* Compact Display Mode */}
      <CollapsibleSection
        title="Configuration Settings with a Very Long Title"
        displayMode="compact"
        borderStyle="round"
      >
        <Text>This section uses compact display mode.</Text>
        <Text>Long titles are abbreviated in compact mode.</Text>
        <Text>api_key: ****</Text>
        <Text>timeout: 30s</Text>
      </CollapsibleSection>

      {/* Verbose Display Mode */}
      <CollapsibleSection
        title="System Status"
        displayMode="verbose"
        borderStyle="double"
        borderColor="green"
      >
        <Text>This section uses verbose display mode.</Text>
        <Text>It shows additional state information in the header.</Text>
        <Text>CPU: 25%</Text>
        <Text>Memory: 60%</Text>
        <Text>Disk: 80%</Text>
        <Text>Network: Active</Text>
      </CollapsibleSection>

      {/* No Arrow Indicator */}
      <CollapsibleSection
        title="Plain Section"
        showArrow={false}
        borderStyle="none"
      >
        <Text>This section has no arrow indicator and no border.</Text>
        <Text>Useful for cleaner, minimalist layouts.</Text>
      </CollapsibleSection>

      {/* Custom Toggle Key */}
      <CollapsibleSection
        title="Custom Key Section"
        toggleKey="x"
        allowKeyboardToggle={true}
      >
        <Text>This section can be toggled with the 'x' key.</Text>
        <Text>Try pressing 'x' when this component has focus.</Text>
        <Text>Note: Keyboard interaction depends on focus management.</Text>
      </CollapsibleSection>

      <Text color="gray" dimColor>
        Demo completed. Each section above demonstrates different features:
        basic usage, dimmed styling, controlled state, header extras,
        display modes, custom styling, and keyboard interaction.
      </Text>
    </Box>
  );
}

export default CollapsibleSectionExample;