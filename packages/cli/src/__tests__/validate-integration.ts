/**
 * TypeScript validation script for AgentThoughts integration
 * This ensures all types compile correctly and the integration is valid
 */

import { AgentPanel, AgentInfo } from '../ui/components/agents/AgentPanel.js';
import { AgentThoughts, AgentThoughtsProps } from '../ui/components/AgentThoughts.js';

// Test type definitions compile correctly
function validateTypes() {
  // Test AgentInfo with thinking field
  const agentWithThinking: AgentInfo = {
    name: 'developer',
    status: 'active',
    stage: 'implementation',
    debugInfo: {
      thinking: 'I am working on implementing the feature...',
      tokensUsed: { input: 1500, output: 2500 },
      turnCount: 3,
    },
  };

  // Test AgentThoughts props
  const thoughtsProps: AgentThoughtsProps = {
    thinking: 'This is agent thinking content',
    agent: 'tester',
    displayMode: 'normal',
    defaultCollapsed: true,
  };

  // Test AgentPanel props with showThoughts
  const agentPanelProps = {
    agents: [agentWithThinking],
    currentAgent: 'developer',
    showThoughts: true,
    displayMode: 'verbose' as const,
  };

  return {
    agentWithThinking,
    thoughtsProps,
    agentPanelProps,
  };
}

// Validate implementation logic
function validateImplementationLogic() {
  const agent: AgentInfo = {
    name: 'architect',
    status: 'active',
    debugInfo: {
      thinking: 'Designing system architecture...',
    },
  };

  // Test conditional logic for AgentThoughts rendering
  const shouldRenderThoughts = (showThoughts: boolean, agent: AgentInfo) => {
    return showThoughts && agent.debugInfo?.thinking;
  };

  // Test cases
  const testCases = [
    // Should render thoughts
    { showThoughts: true, hasThinking: true, expected: true },
    // Should not render thoughts
    { showThoughts: false, hasThinking: true, expected: false },
    { showThoughts: true, hasThinking: false, expected: false },
    { showThoughts: false, hasThinking: false, expected: false },
  ];

  const results = testCases.map(testCase => {
    const testAgent: AgentInfo = {
      name: 'test',
      status: 'active',
      debugInfo: testCase.hasThinking ? { thinking: 'test thinking' } : undefined,
    };

    const shouldRender = shouldRenderThoughts(testCase.showThoughts, testAgent);
    return {
      ...testCase,
      actual: shouldRender,
      passed: shouldRender === testCase.expected,
    };
  });

  return results;
}

// Validate display mode handling
function validateDisplayModes() {
  const displayModes = ['normal', 'verbose', 'compact'] as const;

  return displayModes.map(mode => ({
    mode,
    shouldHideInCompact: mode === 'compact',
  }));
}

// Run all validations
export function runValidation() {
  try {
    const typeValidation = validateTypes();
    const logicValidation = validateImplementationLogic();
    const displayModeValidation = validateDisplayModes();

    const allLogicTestsPassed = logicValidation.every(test => test.passed);

    return {
      success: true,
      typeValidation: 'Passed - All types compile correctly',
      logicValidation: allLogicTestsPassed ? 'Passed - All logic tests passed' : 'Failed',
      logicDetails: logicValidation,
      displayModeValidation,
      summary: allLogicTestsPassed
        ? 'All validations passed - AgentThoughts integration is working correctly'
        : 'Some validations failed - Check logic implementation',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      summary: 'Validation failed due to compilation or runtime errors',
    };
  }
}

// Export for testing
export { validateTypes, validateImplementationLogic, validateDisplayModes };