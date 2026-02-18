#!/usr/bin/env node

/**
 * Demo script to showcase the ErrorFormatter functionality
 * This is not a test, but a visual demonstration of error formatting
 */

import {
  ErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  formatError,
  parseTypeScriptErrors,
} from '../ErrorFormatter.js';

console.log('='.repeat(60));
console.log('ErrorFormatter Demo');
console.log('='.repeat(60));
console.log();

// Create formatters with different verbosity levels
const minimalFormatter = new ErrorFormatter(ErrorVerbosity.MINIMAL);
const normalFormatter = new ErrorFormatter(ErrorVerbosity.NORMAL);
const verboseFormatter = new ErrorFormatter(ErrorVerbosity.VERBOSE);

// Demo 1: Simple error formatting
console.log('1. Simple Error Formatting:');
console.log('');
console.log(formatError.validation('Invalid email address format provided'));
console.log();

// Demo 2: Error with context
console.log('2. Error with Context:');
console.log('');
const context: ErrorContext = {
  file: '/src/controllers/UserController.ts',
  line: 42,
  column: 15,
  function: 'validateUserInput',
  description: 'Email validation failed during user registration'
};

console.log(formatError.validation('Email format validation failed', context));
console.log();

// Demo 3: Error with suggestions
console.log('3. Error with Suggestions:');
console.log('');
const suggestions: ErrorSuggestion[] = [
  {
    title: 'Check email format',
    description: 'Ensure email follows the pattern: user@domain.com',
  },
  {
    title: 'Verify email regex',
    description: 'Update the regex pattern to handle edge cases',
    command: 'npm install validator && import { isEmail } from "validator"'
  },
  {
    title: 'Add better error messages',
    description: 'Provide specific feedback about what part of the email is invalid'
  }
];

console.log(formatError.validation('Email validation failed', context, suggestions));
console.log();

// Demo 4: Different error types
console.log('4. Different Error Types:');
console.log('');

console.log('System Error:');
console.log(formatError.system('Database connection pool exhausted'));
console.log();

console.log('Network Error:');
console.log(formatError.network('Request timeout after 30 seconds', {
  description: 'API call to https://api.example.com/users failed'
}));
console.log();

console.log('Config Error:');
console.log(formatError.config('Missing required environment variable', {
  description: 'DATABASE_URL is not defined'
}, [{
  title: 'Set environment variable',
  description: 'Add DATABASE_URL to your .env file',
  command: 'echo "DATABASE_URL=postgresql://localhost:5432/mydb" >> .env'
}]));
console.log();

console.log('Filesystem Error:');
console.log(formatError.filesystem('Permission denied', {
  file: '/var/log/app.log',
  description: 'Cannot write to log file'
}, [{
  title: 'Fix file permissions',
  description: 'Change file permissions to allow write access',
  command: 'sudo chmod 666 /var/log/app.log'
}]));
console.log();

// Demo 5: Error from JavaScript Error object
console.log('5. Error from JavaScript Error Object (Verbose Mode):');
console.log('');

const jsError = new Error('Cannot read property "name" of undefined');
jsError.stack = `TypeError: Cannot read property 'name' of undefined
    at validateUser (/src/validators/user.ts:15:20)
    at UserController.register (/src/controllers/UserController.ts:42:15)
    at Layer.handle [as handle_request] (/node_modules/express/lib/router/layer.js:95:5)
    at next (/node_modules/express/lib/router/route.js:137:13)`;

console.log(verboseFormatter.formatFromError(
  jsError,
  ErrorType.APPLICATION,
  {
    file: '/src/validators/user.ts',
    line: 15,
    column: 20,
    function: 'validateUser',
    description: 'User object was null or undefined during validation'
  },
  [{
    title: 'Add null check',
    description: 'Check if user object exists before accessing properties',
    command: 'if (!user) { throw new Error("User object is required"); }'
  }, {
    title: 'Use optional chaining',
    description: 'Use the ?. operator to safely access object properties',
    command: 'const name = user?.name || "Unknown";'
  }]
));
console.log();

// Demo 6: Multiple errors
console.log('6. Multiple Errors:');
console.log('');

const multipleErrors = [
  {
    type: ErrorType.VALIDATION,
    message: 'Email field is required',
    context: { file: 'user-form.ts', line: 10 }
  },
  {
    type: ErrorType.VALIDATION,
    message: 'Password must be at least 8 characters',
    context: { file: 'user-form.ts', line: 15 }
  },
  {
    type: ErrorType.VALIDATION,
    message: 'Phone number format is invalid',
    context: { file: 'user-form.ts', line: 20 }
  }
];

console.log(normalFormatter.formatMultiple(multipleErrors));
console.log();

// Demo 7: Verbosity comparison
console.log('7. Verbosity Comparison:');
console.log('');

const complexError = {
  type: ErrorType.APPLICATION,
  message: 'Failed to process user data',
  context: {
    file: '/src/services/UserService.ts',
    line: 120,
    column: 8,
    function: 'processUserData',
    description: 'Error during data transformation'
  },
  suggestions: [{
    title: 'Check data format',
    description: 'Verify input data matches expected schema',
    command: 'npm run validate-schema'
  }],
  originalError: jsError
};

console.log('Minimal verbosity:');
console.log(minimalFormatter.format(complexError));
console.log();

console.log('Normal verbosity:');
console.log(normalFormatter.format(complexError));
console.log();

console.log('Verbose verbosity:');
console.log(verboseFormatter.format(complexError));
console.log();

// Demo 8: TypeScript Error Parsing
console.log('8. TypeScript Error Parsing:');
console.log('');

const tscOutput = `src/types/User.ts(42,15): error TS2339: Property 'username' does not exist on type 'UserData'.
src/utils/helper.ts:25:8 - error TS2304: Cannot find name 'UnknownInterface'.
src/components/App.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;

console.log('Raw tsc output:');
console.log(tscOutput);
console.log();

const parsedErrors = parseTypeScriptErrors(tscOutput);
console.log(`Parsed ${parsedErrors.length} TypeScript errors:`);
console.log();

console.log(normalFormatter.formatMultiple(parsedErrors));
console.log();

console.log('='.repeat(60));
console.log('Demo Complete');
console.log('='.repeat(60));