/**
 * Example demonstrating responsive behavior of ErrorDisplay components
 *
 * This file shows how the components adapt to different terminal widths.
 * Used for manual testing and verification.
 */

import React from 'react';
import { ErrorDisplay, ErrorSummary, ValidationError } from '../ErrorDisplay';

// Example error data
const sampleError = "Unable to authenticate with the API. The provided credentials appear to be invalid or expired.";

const sampleSuggestions = [
  {
    title: 'Check API Key',
    description: 'Verify that your API key is correct and hasn\'t expired. Check your configuration file.',
    command: 'apex config get api.key',
    priority: 'high' as const,
  },
  {
    title: 'Network Connection',
    description: 'Ensure you have a stable internet connection and can reach the API endpoint.',
    priority: 'medium' as const,
  },
];

const sampleContext = {
  endpoint: 'https://api.anthropic.com/v1/messages',
  statusCode: 401,
  timestamp: '2023-12-17T10:30:45Z',
  requestId: 'req_abc123def456ghi789',
};

const sampleErrors = [
  {
    id: '1',
    message: 'Authentication failed: Invalid API key provided in the request headers',
    timestamp: new Date('2023-12-17T10:30:00Z'),
    severity: 'error' as const,
    resolved: false,
  },
  {
    id: '2',
    message: 'Rate limit exceeded: Too many requests sent in the last minute, please slow down',
    timestamp: new Date('2023-12-17T10:28:00Z'),
    severity: 'warning' as const,
    resolved: true,
  },
  {
    id: '3',
    message: 'Network timeout: Request took too long to complete, check your connection',
    timestamp: new Date('2023-12-17T10:25:00Z'),
    severity: 'error' as const,
    resolved: false,
  },
];

/**
 * Test ErrorDisplay at different widths
 */
export function ErrorDisplayResponsiveExample() {
  return (
    <div>
      <h2>ErrorDisplay - Wide Terminal (160+ cols)</h2>
      <ErrorDisplay
        error={sampleError}
        suggestions={sampleSuggestions}
        context={sampleContext}
        width={160}
      />

      <h2>ErrorDisplay - Normal Terminal (100 cols)</h2>
      <ErrorDisplay
        error={sampleError}
        suggestions={sampleSuggestions}
        context={sampleContext}
        width={100}
      />

      <h2>ErrorDisplay - Compact Terminal (70 cols)</h2>
      <ErrorDisplay
        error={sampleError}
        suggestions={sampleSuggestions}
        context={sampleContext}
        width={70}
      />

      <h2>ErrorDisplay - Narrow Terminal (45 cols)</h2>
      <ErrorDisplay
        error={sampleError}
        suggestions={sampleSuggestions}
        context={sampleContext}
        width={45}
      />
    </div>
  );
}

/**
 * Test ErrorSummary at different widths
 */
export function ErrorSummaryResponsiveExample() {
  return (
    <div>
      <h2>ErrorSummary - Wide Terminal (160+ cols)</h2>
      <ErrorSummary
        errors={sampleErrors}
        showTimestamps={true}
        width={160}
      />

      <h2>ErrorSummary - Normal Terminal (100 cols)</h2>
      <ErrorSummary
        errors={sampleErrors}
        showTimestamps={true}
        width={100}
      />

      <h2>ErrorSummary - Compact Terminal (70 cols)</h2>
      <ErrorSummary
        errors={sampleErrors}
        showTimestamps={true}
        width={70}
      />

      <h2>ErrorSummary - Narrow Terminal (45 cols)</h2>
      <ErrorSummary
        errors={sampleErrors}
        showTimestamps={true}
        width={45}
      />
    </div>
  );
}

/**
 * Test ValidationError at different widths
 */
export function ValidationErrorResponsiveExample() {
  const longValue = "this-is-a-very-long-field-value-that-should-be-truncated-appropriately-based-on-terminal-width";
  const longErrors = [
    "Field must be between 3 and 20 characters long, but the provided value exceeds the maximum allowed length",
    "Field cannot contain special characters like dashes, underscores, or spaces - please use only alphanumeric characters",
  ];
  const longSuggestions = [
    "Try using a shorter value that fits within the 20 character limit while still being descriptive",
    "Remove any special characters and use only letters and numbers for better compatibility",
  ];

  return (
    <div>
      <h2>ValidationError - Wide Terminal (160+ cols)</h2>
      <ValidationError
        field="username"
        value={longValue}
        errors={longErrors}
        suggestions={longSuggestions}
        width={160}
      />

      <h2>ValidationError - Normal Terminal (100 cols)</h2>
      <ValidationError
        field="username"
        value={longValue}
        errors={longErrors}
        suggestions={longSuggestions}
        width={100}
      />

      <h2>ValidationError - Compact Terminal (70 cols)</h2>
      <ValidationError
        field="username"
        value={longValue}
        errors={longErrors}
        suggestions={longSuggestions}
        width={70}
      />

      <h2>ValidationError - Narrow Terminal (45 cols)</h2>
      <ValidationError
        field="username"
        value={longValue}
        errors={longErrors}
        suggestions={longSuggestions}
        width={45}
      />
    </div>
  );
}

/**
 * Demonstrates the responsive behavior matrix from ADR-029
 */
export function ResponsiveBehaviorMatrix() {
  const testMessage = "This is a test message to demonstrate truncation behavior across different terminal widths";

  return (
    <div>
      <h2>Responsive Behavior Matrix (from ADR-029)</h2>

      <h3>Narrow (&lt;60 cols) - Abbreviated timestamps, heavy truncation</h3>
      <ErrorSummary
        errors={[{
          id: '1',
          message: testMessage,
          timestamp: new Date(),
          severity: 'error' as const,
          resolved: false,
        }]}
        showTimestamps={true}
        width={50}
      />

      <h3>Compact (60-100 cols) - Full timestamps, moderate truncation</h3>
      <ErrorSummary
        errors={[{
          id: '1',
          message: testMessage,
          timestamp: new Date(),
          severity: 'error' as const,
          resolved: false,
        }]}
        showTimestamps={true}
        width={80}
      />

      <h3>Normal (100-160 cols) - Full timestamps, light truncation</h3>
      <ErrorSummary
        errors={[{
          id: '1',
          message: testMessage,
          timestamp: new Date(),
          severity: 'error' as const,
          resolved: false,
        }]}
        showTimestamps={true}
        width={120}
      />

      <h3>Wide (≥160 cols) - Full timestamps, no truncation</h3>
      <ErrorSummary
        errors={[{
          id: '1',
          message: testMessage,
          timestamp: new Date(),
          severity: 'error' as const,
          resolved: false,
        }]}
        showTimestamps={true}
        width={180}
      />
    </div>
  );
}