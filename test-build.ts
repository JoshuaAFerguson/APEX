// Simple test file to check basic imports
import { ResourceLimits } from './packages/cli/src/ui/components/status/ResourceUsageDisplay.js';
import { UsageLevel } from './packages/cli/src/ui/components/status/useLimitColors.js';

const limits: ResourceLimits = {
  maxTokens: 1000,
  maxCost: 5.0
};

const level: UsageLevel = 'safe';

console.log('Basic import test passed', limits, level);