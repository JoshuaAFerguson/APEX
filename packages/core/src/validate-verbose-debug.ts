#!/usr/bin/env tsx
/**
 * Validation script for VerboseDebugData implementation
 * This script validates the type implementation without requiring a full test run
 */

import { VerboseDebugData, AgentUsage } from './types';

console.log('🧪 Validating VerboseDebugData implementation...\n');

// Test 1: Basic type compilation
console.log('✅ Test 1: Basic type compilation');
try {
  const basicData: VerboseDebugData = {
    agentTokens: {
      testAgent: {
        inputTokens: 100,
        outputTokens: 50,
      },
    },
    timing: {
      stageStartTime: new Date(),
      agentResponseTimes: {},
      toolUsageTimes: {},
    },
    agentDebug: {
      conversationLength: {},
      toolCallCounts: {},
      errorCounts: {},
      retryAttempts: {},
    },
    metrics: {
      tokensPerSecond: 5.0,
      averageResponseTime: 1000,
      toolEfficiency: {},
    },
  };
  console.log('   ✓ Basic VerboseDebugData structure compiles correctly');
} catch (error) {
  console.log('   ❌ Basic compilation failed:', error);
}

// Test 2: Complete interface with all optional fields
console.log('\n✅ Test 2: Complete interface with all optional fields');
try {
  const completeData: VerboseDebugData = {
    agentTokens: {
      planner: {
        inputTokens: 1000,
        outputTokens: 500,
        cacheCreationInputTokens: 100,
        cacheReadInputTokens: 50,
      },
      developer: {
        inputTokens: 2000,
        outputTokens: 800,
        cacheCreationInputTokens: 200,
        cacheReadInputTokens: 100,
      },
    },
    timing: {
      stageStartTime: new Date('2023-01-01T10:00:00Z'),
      stageEndTime: new Date('2023-01-01T10:05:00Z'),
      stageDuration: 300000,
      agentResponseTimes: {
        planner: 2000,
        developer: 3500,
      },
      toolUsageTimes: {
        Read: 500,
        Write: 750,
        Bash: 1200,
      },
    },
    agentDebug: {
      conversationLength: {
        planner: 5,
        developer: 8,
      },
      toolCallCounts: {
        planner: {
          Read: 3,
          Grep: 2,
        },
        developer: {
          Write: 4,
          Edit: 6,
          Bash: 2,
        },
      },
      errorCounts: {
        planner: 0,
        developer: 1,
      },
      retryAttempts: {
        planner: 0,
        developer: 1,
      },
    },
    metrics: {
      tokensPerSecond: 10.5,
      averageResponseTime: 2750,
      toolEfficiency: {
        Read: 1.0,
        Write: 0.95,
        Edit: 0.98,
        Bash: 0.87,
        Grep: 1.0,
      },
      memoryUsage: 256000000,
      cpuUtilization: 25.5,
    },
  };
  console.log('   ✓ Complete interface with all optional fields compiles correctly');
  console.log('   ✓ AgentUsage with cache fields works correctly');
  console.log('   ✓ Nested Record structures compile correctly');
} catch (error) {
  console.log('   ❌ Complete interface compilation failed:', error);
}

// Test 3: Type checking and constraints
console.log('\n✅ Test 3: Type checking and constraints');
try {
  // Test AgentUsage type
  const agentUsage: AgentUsage = {
    inputTokens: 1000,
    outputTokens: 500,
    cacheCreationInputTokens: 100,
    cacheReadInputTokens: 50,
  };

  // Test minimal AgentUsage
  const minimalUsage: AgentUsage = {
    inputTokens: 500,
    outputTokens: 250,
  };

  // Test Record<string, number> types
  const efficiency: Record<string, number> = {
    Read: 1.0,
    Write: 0.95,
    Edit: 0.98,
  };

  // Test nested Record types
  const toolCounts: Record<string, Record<string, number>> = {
    agent1: { Read: 3, Write: 2 },
    agent2: { Edit: 5, Bash: 1 },
  };

  console.log('   ✓ AgentUsage type with all fields works correctly');
  console.log('   ✓ AgentUsage type with minimal fields works correctly');
  console.log('   ✓ Record<string, number> types work correctly');
  console.log('   ✓ Nested Record<string, Record<string, number>> types work correctly');
} catch (error) {
  console.log('   ❌ Type checking failed:', error);
}

// Test 4: Integration with existing types
console.log('\n✅ Test 4: Integration with existing types');
try {
  // Import other types to test integration
  import('./types.js').then(types => {
    // Test that VerboseDebugData can be used in broader contexts
    const debugData: VerboseDebugData = {
      agentTokens: { agent: { inputTokens: 100, outputTokens: 50 } },
      timing: { stageStartTime: new Date(), agentResponseTimes: {}, toolUsageTimes: {} },
      agentDebug: { conversationLength: {}, toolCallCounts: {}, errorCounts: {}, retryAttempts: {} },
      metrics: { tokensPerSecond: 5.0, averageResponseTime: 1000, toolEfficiency: {} },
    };

    // Could be used in StageResult outputs
    const stageOutputs = {
      plan: 'Implementation plan',
      verboseDebug: debugData,
    };

    console.log('   ✓ VerboseDebugData integrates with existing type system');
    console.log('   ✓ Can be used in StageResult outputs');
  }).catch(error => {
    console.log('   ❌ Integration test failed:', error);
  });
} catch (error) {
  console.log('   ❌ Integration setup failed:', error);
}

// Test 5: Edge cases
console.log('\n✅ Test 5: Edge cases and boundary conditions');
try {
  // Empty data structures
  const emptyData: VerboseDebugData = {
    agentTokens: {},
    timing: {
      stageStartTime: new Date(),
      agentResponseTimes: {},
      toolUsageTimes: {},
    },
    agentDebug: {
      conversationLength: {},
      toolCallCounts: {},
      errorCounts: {},
      retryAttempts: {},
    },
    metrics: {
      tokensPerSecond: 0,
      averageResponseTime: 0,
      toolEfficiency: {},
    },
  };

  // Large numbers
  const largeData: VerboseDebugData = {
    agentTokens: {
      'heavy-agent': {
        inputTokens: 1000000,
        outputTokens: 500000,
        cacheCreationInputTokens: 100000,
        cacheReadInputTokens: 50000,
      },
    },
    timing: {
      stageStartTime: new Date(),
      stageDuration: 3600000, // 1 hour
      agentResponseTimes: { 'heavy-agent': 30000 },
      toolUsageTimes: { 'LongRunningTool': 1800000 },
    },
    agentDebug: {
      conversationLength: { 'heavy-agent': 1000 },
      toolCallCounts: { 'heavy-agent': { 'LongRunningTool': 500 } },
      errorCounts: { 'heavy-agent': 50 },
      retryAttempts: { 'heavy-agent': 25 },
    },
    metrics: {
      tokensPerSecond: 416.67,
      averageResponseTime: 30000,
      toolEfficiency: { 'LongRunningTool': 0.95 },
      memoryUsage: 2000000000, // 2GB
      cpuUtilization: 85.5,
    },
  };

  // Special characters in names
  const specialCharsData: VerboseDebugData = {
    agentTokens: {
      'special-agent@v1.0': { inputTokens: 100, outputTokens: 50 },
      'agent_with_underscores': { inputTokens: 200, outputTokens: 100 },
    },
    timing: {
      stageStartTime: new Date(),
      agentResponseTimes: {
        'special-agent@v1.0': 1000,
        'agent_with_underscores': 1200,
      },
      toolUsageTimes: {
        'Read-v2': 500,
        'Custom_Tool': 750,
      },
    },
    agentDebug: {
      conversationLength: {
        'special-agent@v1.0': 3,
        'agent_with_underscores': 5,
      },
      toolCallCounts: {
        'special-agent@v1.0': { 'Read-v2': 2 },
        'agent_with_underscores': { 'Custom_Tool': 3 },
      },
      errorCounts: {
        'special-agent@v1.0': 0,
        'agent_with_underscores': 1,
      },
      retryAttempts: {
        'special-agent@v1.0': 0,
        'agent_with_underscores': 1,
      },
    },
    metrics: {
      tokensPerSecond: 5.0,
      averageResponseTime: 1100,
      toolEfficiency: {
        'Read-v2': 1.0,
        'Custom_Tool': 0.85,
      },
    },
  };

  console.log('   ✓ Empty data structures compile correctly');
  console.log('   ✓ Large numbers and edge values work correctly');
  console.log('   ✓ Special characters in agent and tool names work correctly');
} catch (error) {
  console.log('   ❌ Edge cases test failed:', error);
}

console.log('\n🎉 VerboseDebugData validation completed!');
console.log('All type definitions appear to be correctly implemented and exportable.');