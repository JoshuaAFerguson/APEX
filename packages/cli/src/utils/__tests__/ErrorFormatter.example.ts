/**
 * Example usage of ErrorFormatter for CLI error display
 */

import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  formatError,
} from '../ErrorFormatter.js';

// Example 1: Quick error formatting
console.log('\n=== Quick Error Formatting ===');
console.log(formatError.validation('Invalid email format'));
console.log(formatError.filesystem('File not found'));
console.log(formatError.network('Connection timeout'));

// Example 2: Error with context
console.log('\n=== Error with Context ===');
console.log(formatError.config('Missing API configuration', {
  file: '/config/app.yaml',
  line: 15,
  function: 'loadConfig',
  description: 'API_KEY environment variable not found'
}));

// Example 3: Error with suggestions
console.log('\n=== Error with Suggestions ===');
console.log(formatError.system('Database connection failed', undefined, [
  {
    title: 'Check database server',
    description: 'Ensure the database server is running',
    command: 'docker ps | grep postgres'
  },
  {
    title: 'Verify connection string',
    description: 'Check DATABASE_URL in your environment'
  }
]));

// Example 4: Multiple errors
console.log('\n=== Multiple Errors ===');
const formatter = new ErrorFormatter(ErrorVerbosity.NORMAL);
const errors = [
  { type: ErrorType.VALIDATION, message: 'Email is required' },
  { type: ErrorType.VALIDATION, message: 'Password too short' }
];
console.log(formatter.formatMultiple(errors));