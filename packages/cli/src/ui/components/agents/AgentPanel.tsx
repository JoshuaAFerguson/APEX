import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { DisplayMode } from '@apexcli/core';
import { useStdoutDimensions, type Breakpoint } from '../../hooks/index.js';
import { useAgentHandoff } from '../../hooks/useAgentHandoff.js';
import { useElapsedTime } from '../../hooks/useElapsedTime.js';
import { HandoffIndicator } from './HandoffIndicator.js';
import { ProgressBar } from '../ProgressIndicators.js';
import { ParallelExecutionView, ParallelAgent } from './ParallelExecutionView.js';
import { VerboseAgentRow } from './VerboseAgentRow.js';
import { AgentThoughts } from '../AgentThoughts.js';

export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date; // When the agent started working
  // Verbose mode debug fields
  debugInfo?: {
    tokensUsed?: { input: number; output: number };
    stageStartedAt?: Date;
    lastToolCall?: string;
    turnCount?: number;
    errorCount?: number;
    thinking?: string;
  };
}

/**
 * Responsive configuration interface
 */
interface ResponsiveAgentConfig {
  // Layout control
  useCompactLayout: boolean;
  showBorder: boolean;
  showTitle: boolean;

  // Agent display
  agentNameMaxLength: number;
  showStage: boolean;
  showElapsedTime: boolean;
  abbreviateNames: boolean;

  // Progress display
  showProgressBars: boolean;
  progressBarWidth: number;
  showProgressInline: boolean;

  // Parallel execution
  showParallelSection: boolean;
  showParallelDetails: boolean;
  maxParallelAgentsVisible: number;

  // Thoughts/Debug display
  showThoughtsPreview: boolean;
  thoughtsMaxLength: number;
}

export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
  useDetailedParallelView?: boolean;
  displayMode?: DisplayMode;
  showThoughts?: boolean;
  width?: number; // Explicit width override for testing
}

const agentColors: Record<string, string> = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};

const statusIcons: Record<AgentInfo['status'], string> = {
  active: '⚡',
  waiting: '○',
  completed: '✓',
  idle: '·',
  parallel: '⟂',
};

/**
 * Agent name abbreviation mapping
 */
const AGENT_ABBREVIATIONS: Record<string, string> = {
  planner: 'plan',
  architect: 'arch',
  developer: 'dev',
  reviewer: 'rev',
  tester: 'test',
  devops: 'ops',
};

/**
 * Responsive configurations by breakpoint
 */
const RESPONSIVE_CONFIGS: Record<Breakpoint, ResponsiveAgentConfig> = {
  narrow: {
    useCompactLayout: true,
    showBorder: false,
    showTitle: false,
    agentNameMaxLength: 6,
    showStage: false,
    showElapsedTime: true,
    abbreviateNames: true,
    showProgressBars: false,
    progressBarWidth: 0,
    showProgressInline: true,  // Show as "65%" inline
    showParallelSection: false,
    showParallelDetails: false,
    maxParallelAgentsVisible: 2,
    showThoughtsPreview: false,
    thoughtsMaxLength: 0,
  },

  compact: {
    useCompactLayout: true,
    showBorder: false,
    showTitle: false,
    agentNameMaxLength: 10,
    showStage: false,
    showElapsedTime: true,
    abbreviateNames: false,
    showProgressBars: false,
    progressBarWidth: 0,
    showProgressInline: true,
    showParallelSection: true,
    showParallelDetails: false,
    maxParallelAgentsVisible: 3,
    showThoughtsPreview: false,
    thoughtsMaxLength: 0,
  },

  normal: {
    useCompactLayout: false,
    showBorder: true,
    showTitle: true,
    agentNameMaxLength: 16,
    showStage: true,
    showElapsedTime: true,
    abbreviateNames: false,
    showProgressBars: true,
    progressBarWidth: 30,
    showProgressInline: false,
    showParallelSection: true,
    showParallelDetails: true,
    maxParallelAgentsVisible: 5,
    showThoughtsPreview: true,
    thoughtsMaxLength: 80,
  },

  wide: {
    useCompactLayout: false,
    showBorder: true,
    showTitle: true,
    agentNameMaxLength: 24,
    showStage: true,
    showElapsedTime: true,
    abbreviateNames: false,
    showProgressBars: true,
    progressBarWidth: 40,
    showProgressInline: false,
    showParallelSection: true,
    showParallelDetails: true,
    maxParallelAgentsVisible: 10,
    showThoughtsPreview: true,
    thoughtsMaxLength: 150,
  },
};

/**
 * Get responsive configuration based on terminal breakpoint
 */
function getResponsiveConfig(
  breakpoint: Breakpoint,
  agentCount: number,
  width: number
): ResponsiveAgentConfig {
  const base = RESPONSIVE_CONFIGS[breakpoint];

  // Dynamic adjustments based on agent count
  if (agentCount > 5 && breakpoint === 'normal') {
    // Force compact layout for many agents in normal terminal
    return { ...base, useCompactLayout: true };
  }

  // Adjust agent name length based on available width and agent count
  if (base.useCompactLayout) {
    const availablePerAgent = Math.floor(width / agentCount) - 8; // icon + elapsed + separator
    const adjustedNameLength = Math.max(4, Math.min(base.agentNameMaxLength, availablePerAgent));
    return { ...base, agentNameMaxLength: adjustedNameLength };
  }

  return base;
}

/**
 * Truncate or abbreviate agent name based on config
 */
function formatAgentName(
  name: string,
  config: ResponsiveAgentConfig
): string {
  if (config.abbreviateNames && AGENT_ABBREVIATIONS[name]) {
    return AGENT_ABBREVIATIONS[name];
  }

  if (name.length > config.agentNameMaxLength) {
    return name.slice(0, config.agentNameMaxLength - 2) + '..';
  }

  return name;
}

export function AgentPanel({
  agents,
  currentAgent,
  compact = false,
  showParallel = false,
  parallelAgents = [],
  useDetailedParallelView = false,
  displayMode = 'normal',
  showThoughts = false,
  width: explicitWidth,
}: AgentPanelProps): React.ReactElement {
  // Get terminal dimensions
  const { width: terminalWidth, breakpoint } = useStdoutDimensions();
  const width = explicitWidth ?? terminalWidth;

  // Get responsive configuration
  const config = useMemo(
    () => getResponsiveConfig(breakpoint, agents.length, width),
    [breakpoint, agents.length, width]
  );

  // Use handoff animation hook
  const handoffState = useAgentHandoff(currentAgent);

  // Determine effective display mode
  const effectiveDisplayMode = useMemo(() => {
    // Verbose mode always respected
    if (displayMode === 'verbose') return 'verbose';

    // Explicit compact prop or displayMode
    if (compact || displayMode === 'compact') return 'compact';

    // Auto-compact based on responsive config
    if (config.useCompactLayout) return 'compact';

    return 'normal';
  }, [displayMode, compact, config.useCompactLayout]);

  // Render compact layout
  if (effectiveDisplayMode === 'compact') {
    return (
      <CompactAgentPanel
        agents={agents}
        currentAgent={currentAgent}
        config={config}
        handoffState={handoffState}
        showParallel={showParallel}
        parallelAgents={parallelAgents}
      />
    );
  }

  // Render detailed layout (normal/verbose)
  return (
    <DetailedAgentPanel
      agents={agents}
      currentAgent={currentAgent}
      config={config}
      handoffState={handoffState}
      showParallel={showParallel}
      parallelAgents={parallelAgents}
      useDetailedParallelView={useDetailedParallelView}
      displayMode={effectiveDisplayMode}
      showThoughts={showThoughts}
    />
  );
}

/**
 * CompactAgentPanel interfaces and component
 */
interface CompactAgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  config: ResponsiveAgentConfig;
  handoffState: any; // HandoffAnimationState type
  showParallel: boolean;
  parallelAgents: AgentInfo[];
}

function CompactAgentPanel({
  agents,
  currentAgent,
  config,
  handoffState,
  showParallel,
  parallelAgents,
}: CompactAgentPanelProps): React.ReactElement {
  return (
    <Box>
      {agents.map((agent, index) => {
        const shouldShowElapsed = config.showElapsedTime &&
          agent.status === 'active' && agent.startedAt;
        const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

        const displayName = formatAgentName(agent.name, config);
        const color = agent.name === currentAgent
          ? (agent.status === 'parallel' ? 'cyan' : agentColors[agent.name])
          : 'gray';

        return (
          <React.Fragment key={agent.name}>
            <Text color={color}>
              {statusIcons[agent.status]}
              {displayName}
              {config.showProgressInline && agent.progress !== undefined &&
                agent.progress > 0 && agent.progress < 100 &&
                ` ${agent.progress}%`}
              {shouldShowElapsed && `[${elapsedTime}]`}
            </Text>
            {index < agents.length - 1 && <Text color="gray"> | </Text>}
          </React.Fragment>
        );
      })}

      {/* Compact parallel agents display */}
      {showParallel && config.showParallelSection && parallelAgents.length > 1 && (
        <>
          <Text color="gray"> | </Text>
          <Text color="cyan">⟂</Text>
          {parallelAgents.slice(0, config.maxParallelAgentsVisible).map((agent, index) => (
            <React.Fragment key={agent.name}>
              <Text color="cyan">
                {formatAgentName(agent.name, config)}
              </Text>
              {index < Math.min(parallelAgents.length, config.maxParallelAgentsVisible) - 1 &&
                <Text color="cyan">,</Text>}
            </React.Fragment>
          ))}
          {parallelAgents.length > config.maxParallelAgentsVisible && (
            <Text color="cyan">+{parallelAgents.length - config.maxParallelAgentsVisible}</Text>
          )}
        </>
      )}

      {/* Handoff animation */}
      <HandoffIndicator
        animationState={handoffState}
        agentColors={agentColors}
        compact={true}
      />
    </Box>
  );
}

/**
 * DetailedAgentPanel interfaces and component
 */
interface DetailedAgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  config: ResponsiveAgentConfig;
  handoffState: any; // HandoffAnimationState type
  showParallel: boolean;
  parallelAgents: AgentInfo[];
  useDetailedParallelView: boolean;
  displayMode: DisplayMode;
  showThoughts: boolean;
}

function DetailedAgentPanel({
  agents,
  currentAgent,
  config,
  handoffState,
  showParallel,
  parallelAgents,
  useDetailedParallelView,
  displayMode,
  showThoughts,
}: DetailedAgentPanelProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle={config.showBorder ? "round" : undefined} borderColor="gray" paddingX={config.showBorder ? 1 : 0}>
      {config.showTitle && (
        <Text color="cyan" bold>
          Active Agents
        </Text>
      )}

      {/* Handoff animation */}
      <HandoffIndicator
        animationState={handoffState}
        agentColors={agentColors}
        compact={false}
      />

      <Box marginTop={1} flexDirection="column">
        {agents.map(agent => (
          <React.Fragment key={agent.name}>
            {displayMode === 'verbose' ? (
              <VerboseAgentRow
                agent={agent}
                isActive={agent.name === currentAgent}
                color={agentColors[agent.name] || 'white'}
              />
            ) : (
              <ResponsiveAgentRow
                agent={agent}
                isActive={agent.name === currentAgent}
                config={config}
              />
            )}

            {/* Thoughts preview */}
            {showThoughts && config.showThoughtsPreview &&
              agent.debugInfo?.thinking && (
                <Box marginTop={1}>
                  <AgentThoughts
                    thinking={agent.debugInfo.thinking.slice(0, config.thoughtsMaxLength)}
                    agent={agent.name}
                    displayMode={displayMode}
                  />
                </Box>
              )}
          </React.Fragment>
        ))}
      </Box>

      {/* Parallel execution section */}
      {showParallel && config.showParallelSection && parallelAgents.length > 1 && (
        config.showParallelDetails && useDetailedParallelView ? (
          <ParallelExecutionView
            agents={parallelAgents.slice(0, config.maxParallelAgentsVisible).map(agent => ({
              name: agent.name,
              status: agent.status,
              stage: agent.stage,
              progress: agent.progress,
              startedAt: agent.startedAt,
            }))}
            compact={false}
          />
        ) : (
          <ResponsiveParallelSection
            agents={parallelAgents}
            config={config}
            showThoughts={showThoughts}
            displayMode={displayMode}
          />
        )
      )}
    </Box>
  );
}

/**
 * ResponsiveAgentRow interfaces and component
 */
interface ResponsiveAgentRowProps {
  agent: AgentInfo;
  isActive: boolean;
  config: ResponsiveAgentConfig;
}

function ResponsiveAgentRow({
  agent,
  isActive,
  config,
}: ResponsiveAgentRowProps): React.ReactElement {
  const color = agentColors[agent.name] || 'white';
  const finalColor = agent.status === 'parallel' ? 'cyan' : color;

  const shouldShowElapsed = config.showElapsedTime &&
    agent.status === 'active' && agent.startedAt;
  const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

  const shouldShowProgressBar = config.showProgressBars &&
    (agent.status === 'active' || agent.status === 'parallel') &&
    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

  const displayName = formatAgentName(agent.name, config);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isActive ? finalColor : 'gray'}>
          {statusIcons[agent.status]}{' '}
        </Text>
        <Text color={isActive ? finalColor : 'gray'} bold={isActive}>
          {displayName}
        </Text>
        {config.showStage && agent.stage && (
          <Text color="gray" dimColor>
            {' '}({agent.stage})
          </Text>
        )}
        {shouldShowElapsed && (
          <Text color="gray" dimColor>
            {' '}[{elapsedTime}]
          </Text>
        )}
        {/* Inline progress for non-progress-bar modes */}
        {config.showProgressInline && !shouldShowProgressBar &&
          agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && (
            <Text color="gray" dimColor>
              {' '}{agent.progress}%
            </Text>
          )}
      </Box>
      {shouldShowProgressBar && (
        <Box marginLeft={2} marginTop={1}>
          <ProgressBar
            progress={agent.progress!}
            width={config.progressBarWidth}
            showPercentage={true}
            color={finalColor}
            animated={false}
          />
        </Box>
      )}
    </Box>
  );
}

/**
 * ResponsiveParallelSection interfaces and component
 */
interface ResponsiveParallelSectionProps {
  agents: AgentInfo[];
  config: ResponsiveAgentConfig;
  showThoughts: boolean;
  displayMode: DisplayMode;
}

function ResponsiveParallelSection({
  agents,
  config,
  showThoughts,
  displayMode,
}: ResponsiveParallelSectionProps): React.ReactElement {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text color="cyan" bold>
        <Text>⟂ Parallel Execution</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        {agents.slice(0, config.maxParallelAgentsVisible).map(agent => {
          // Track elapsed time for parallel agents with a start time
          const shouldShowElapsed = config.showElapsedTime &&
            agent.status === 'parallel' && agent.startedAt;
          const elapsedTime = useElapsedTime(shouldShowElapsed ? agent.startedAt : null);

          // Show progress bar for parallel agents with progress between 0-100 (exclusive)
          const shouldShowProgressBar = config.showProgressBars &&
            agent.status === 'parallel' &&
            agent.progress !== undefined && agent.progress > 0 && agent.progress < 100;

          const displayName = formatAgentName(agent.name, config);

          return (
            <React.Fragment key={agent.name}>
              <Box flexDirection="column" marginBottom={1}>
                <Box>
                  <Text color="cyan">
                    ⟂{' '}
                  </Text>
                  <Text color="cyan" bold>
                    {displayName}
                  </Text>
                  {config.showStage && agent.stage && (
                    <Text color="gray" dimColor>
                      {' '}({agent.stage})
                    </Text>
                  )}
                  {shouldShowElapsed && (
                    <Text color="gray" dimColor>
                      {' '}[{elapsedTime}]
                    </Text>
                  )}
                  {/* Inline progress for non-progress-bar modes */}
                  {config.showProgressInline && !shouldShowProgressBar &&
                    agent.progress !== undefined && agent.progress > 0 && agent.progress < 100 && (
                      <Text color="gray" dimColor>
                        {' '}{agent.progress}%
                      </Text>
                    )}
                </Box>
                {shouldShowProgressBar && (
                  <Box marginLeft={2} marginTop={1}>
                    <ProgressBar
                      progress={agent.progress!}
                      width={config.progressBarWidth}
                      showPercentage={true}
                      color="cyan"
                      animated={false}
                    />
                  </Box>
                )}
              </Box>
              {/* Conditionally render AgentThoughts for parallel agents */}
              {showThoughts && config.showThoughtsPreview && agent.debugInfo?.thinking && (
                <Box marginTop={1} marginBottom={1}>
                  <AgentThoughts
                    thinking={agent.debugInfo.thinking.slice(0, config.thoughtsMaxLength)}
                    agent={agent.name}
                    displayMode={displayMode}
                  />
                </Box>
              )}
            </React.Fragment>
          );
        })}
        {agents.length > config.maxParallelAgentsVisible && (
          <Box marginTop={1}>
            <Text color="cyan" dimColor>
              +{agents.length - config.maxParallelAgentsVisible} more agents...
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

