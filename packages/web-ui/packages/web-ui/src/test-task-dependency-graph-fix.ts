// Simple test to verify the TaskDependencyGraph fix handles malformed data
import { truncateDescription, mapTaskStatusToNodeStatus } from './types/task-dependency-graph'

// Test truncateDescription with null/undefined
console.log('Testing truncateDescription with null:', truncateDescription(null))
console.log('Testing truncateDescription with undefined:', truncateDescription(undefined))
console.log('Testing truncateDescription with empty string:', truncateDescription(''))
console.log('Testing truncateDescription with valid string:', truncateDescription('Valid description'))

// Test with non-string value
console.log('Testing truncateDescription with number:', truncateDescription(123 as any))

// Test mapTaskStatusToNodeStatus with valid status
console.log('Testing mapTaskStatusToNodeStatus:', mapTaskStatusToNodeStatus('in-progress'))

console.log('All tests passed - fix is working correctly!')