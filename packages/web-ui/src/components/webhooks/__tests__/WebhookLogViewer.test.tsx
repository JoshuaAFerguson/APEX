/**
 * Tests for WebhookLogViewer component
 * Displays webhook delivery logs with filtering, pagination, and details
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebhookDeliveryLog } from '@apexcli/core';

interface WebhookLogViewerProps {
  webhookId: string;
  logs: WebhookDeliveryLog[];
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Mock delivery logs
const mockLogs: WebhookDeliveryLog[] = [
  {
    id: 'log-1',
    webhookId: 'webhook-1',
    eventType: 'task:completed',
    taskId: 'task-123',
    statusCode: 200,
    status: 'success',
    attemptNumber: 1,
    requestPayload: JSON.stringify({ event: 'task:completed', taskId: 'task-123' }),
    responseBody: JSON.stringify({ success: true, processed: true }),
    durationMs: 245,
    attemptedAt: new Date('2024-01-15T12:00:00Z'),
    resolvedIp: '192.168.1.100',
  },
  {
    id: 'log-2',
    webhookId: 'webhook-1',
    eventType: 'task:failed',
    taskId: 'task-456',
    statusCode: 500,
    status: 'failed',
    attemptNumber: 1,
    requestPayload: JSON.stringify({ event: 'task:failed', taskId: 'task-456' }),
    responseBody: JSON.stringify({ error: 'Internal Server Error' }),
    errorMessage: 'Server responded with 500',
    durationMs: 150,
    attemptedAt: new Date('2024-01-15T11:30:00Z'),
    nextRetryAt: new Date('2024-01-15T11:31:00Z'),
    resolvedIp: '192.168.1.101',
  },
  {
    id: 'log-3',
    webhookId: 'webhook-1',
    eventType: 'approval:required',
    taskId: 'task-789',
    statusCode: null,
    status: 'retrying',
    attemptNumber: 2,
    requestPayload: JSON.stringify({ event: 'approval:required', taskId: 'task-789' }),
    errorMessage: 'Connection timeout',
    durationMs: 30000,
    attemptedAt: new Date('2024-01-15T11:00:00Z'),
    nextRetryAt: new Date('2024-01-15T11:02:00Z'),
    resolvedIp: null,
  },
];

// Mock WebhookLogViewer component (to be implemented)
const WebhookLogViewer: React.FC<WebhookLogViewerProps> = ({
  webhookId,
  logs,
  isLoading = false,
  error = null,
  onRefresh,
  onLoadMore,
  hasMore = false,
}) => {
  const [selectedLog, setSelectedLog] = React.useState<WebhookDeliveryLog | null>(null);
  const [filters, setFilters] = React.useState({
    status: '',
    eventType: '',
    dateRange: '',
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'green';
      case 'failed': return 'red';
      case 'retrying': return 'yellow';
      case 'pending': return 'blue';
      default: return 'gray';
    }
  };

  if (error) {
    return (
      <div data-testid="error-state">
        <div role="alert">
          Error loading webhook logs: {error.message}
        </div>
        {onRefresh && (
          <button onClick={onRefresh} data-testid="retry-button">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div data-testid="webhook-log-viewer">
      <header>
        <h2>Webhook Delivery Logs</h2>
        {onRefresh && (
          <button onClick={onRefresh} disabled={isLoading} data-testid="refresh-button">
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </header>

      <div data-testid="log-filters">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          data-testid="status-filter"
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={filters.eventType}
          onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
          data-testid="event-type-filter"
        >
          <option value="">All Event Types</option>
          <option value="task:completed">Task Completed</option>
          <option value="task:failed">Task Failed</option>
          <option value="approval:required">Approval Required</option>
        </select>

        <select
          value={filters.dateRange}
          onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
          data-testid="date-range-filter"
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {isLoading && logs.length === 0 ? (
        <div data-testid="loading-state" role="status">
          Loading webhook logs...
        </div>
      ) : logs.length === 0 ? (
        <div data-testid="empty-state">
          <h3>No delivery logs</h3>
          <p>No webhook deliveries have been attempted yet.</p>
        </div>
      ) : (
        <div data-testid="logs-table">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Task ID</th>
                <th>Status</th>
                <th>Status Code</th>
                <th>Duration</th>
                <th>Attempt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} data-testid={`log-row-${log.id}`}>
                  <td data-testid={`timestamp-${log.id}`}>
                    {formatDate(log.attemptedAt)}
                  </td>
                  <td data-testid={`event-type-${log.id}`}>
                    {log.eventType}
                  </td>
                  <td data-testid={`task-id-${log.id}`}>
                    {log.taskId}
                  </td>
                  <td data-testid={`status-${log.id}`}>
                    <span style={{ color: getStatusColor(log.status) }}>
                      {log.status}
                    </span>
                  </td>
                  <td data-testid={`status-code-${log.id}`}>
                    {log.statusCode || '-'}
                  </td>
                  <td data-testid={`duration-${log.id}`}>
                    {log.durationMs ? `${log.durationMs}ms` : '-'}
                  </td>
                  <td data-testid={`attempt-${log.id}`}>
                    {log.attemptNumber}
                  </td>
                  <td data-testid={`actions-${log.id}`}>
                    <button
                      onClick={() => setSelectedLog(log)}
                      data-testid={`view-details-${log.id}`}
                    >
                      Details
                    </button>
                    {log.status === 'failed' && (
                      <button data-testid={`retry-${log.id}`}>
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && onLoadMore && (
            <div data-testid="load-more-section">
              <button
                onClick={onLoadMore}
                disabled={isLoading}
                data-testid="load-more-button"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}

      {selectedLog && (
        <div data-testid="log-details-modal">
          <div data-testid="modal-backdrop" onClick={() => setSelectedLog(null)} />
          <div data-testid="modal-content">
            <header>
              <h3>Delivery Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                data-testid="close-modal-button"
              >
                ×
              </button>
            </header>

            <div data-testid="log-details">
              <div>
                <h4>Basic Information</h4>
                <dl>
                  <dt>Log ID</dt>
                  <dd data-testid="detail-log-id">{selectedLog.id}</dd>
                  <dt>Event Type</dt>
                  <dd data-testid="detail-event-type">{selectedLog.eventType}</dd>
                  <dt>Task ID</dt>
                  <dd data-testid="detail-task-id">{selectedLog.taskId}</dd>
                  <dt>Status</dt>
                  <dd data-testid="detail-status">{selectedLog.status}</dd>
                  <dt>Status Code</dt>
                  <dd data-testid="detail-status-code">{selectedLog.statusCode || 'N/A'}</dd>
                  <dt>Attempt Number</dt>
                  <dd data-testid="detail-attempt">{selectedLog.attemptNumber}</dd>
                  <dt>Duration</dt>
                  <dd data-testid="detail-duration">{selectedLog.durationMs ? `${selectedLog.durationMs}ms` : 'N/A'}</dd>
                  <dt>Attempted At</dt>
                  <dd data-testid="detail-attempted-at">{formatDate(selectedLog.attemptedAt)}</dd>
                  {selectedLog.nextRetryAt && (
                    <>
                      <dt>Next Retry At</dt>
                      <dd data-testid="detail-next-retry">{formatDate(selectedLog.nextRetryAt)}</dd>
                    </>
                  )}
                  <dt>Resolved IP</dt>
                  <dd data-testid="detail-resolved-ip">{selectedLog.resolvedIp || 'N/A'}</dd>
                </dl>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <h4>Error Details</h4>
                  <pre data-testid="detail-error-message">{selectedLog.errorMessage}</pre>
                </div>
              )}

              <div>
                <h4>Request Payload</h4>
                <pre data-testid="detail-request-payload">
                  {selectedLog.requestPayload ?
                    JSON.stringify(JSON.parse(selectedLog.requestPayload), null, 2) :
                    'N/A'
                  }
                </pre>
              </div>

              {selectedLog.responseBody && (
                <div>
                  <h4>Response Body</h4>
                  <pre data-testid="detail-response-body">
                    {JSON.stringify(JSON.parse(selectedLog.responseBody), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div data-testid="modal-actions">
              <button
                onClick={() => setSelectedLog(null)}
                data-testid="close-details-button"
              >
                Close
              </button>
              {selectedLog.status === 'failed' && (
                <button data-testid="retry-from-details-button">
                  Retry Delivery
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

describe('WebhookLogViewer', () => {
  const mockOnRefresh = vi.fn();
  const mockOnLoadMore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders header and controls', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Webhook Delivery Logs')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      expect(screen.getByTestId('status-filter')).toBeInTheDocument();
      expect(screen.getByTestId('event-type-filter')).toBeInTheDocument();
      expect(screen.getByTestId('date-range-filter')).toBeInTheDocument();
    });

    it('renders logs table with data', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      expect(screen.getByTestId('logs-table')).toBeInTheDocument();
      expect(screen.getByTestId('log-row-log-1')).toBeInTheDocument();
      expect(screen.getByTestId('log-row-log-2')).toBeInTheDocument();
      expect(screen.getByTestId('log-row-log-3')).toBeInTheDocument();
    });

    it('displays log information correctly', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      // First log (success)
      expect(screen.getByTestId('event-type-log-1')).toHaveTextContent('task:completed');
      expect(screen.getByTestId('task-id-log-1')).toHaveTextContent('task-123');
      expect(screen.getByTestId('status-log-1')).toHaveTextContent('success');
      expect(screen.getByTestId('status-code-log-1')).toHaveTextContent('200');
      expect(screen.getByTestId('duration-log-1')).toHaveTextContent('245ms');
      expect(screen.getByTestId('attempt-log-1')).toHaveTextContent('1');

      // Second log (failed)
      expect(screen.getByTestId('event-type-log-2')).toHaveTextContent('task:failed');
      expect(screen.getByTestId('task-id-log-2')).toHaveTextContent('task-456');
      expect(screen.getByTestId('status-log-2')).toHaveTextContent('failed');
      expect(screen.getByTestId('status-code-log-2')).toHaveTextContent('500');

      // Third log (retrying)
      expect(screen.getByTestId('event-type-log-3')).toHaveTextContent('approval:required');
      expect(screen.getByTestId('status-log-3')).toHaveTextContent('retrying');
      expect(screen.getByTestId('status-code-log-3')).toHaveTextContent('-');
      expect(screen.getByTestId('attempt-log-3')).toHaveTextContent('2');
    });

    it('renders empty state when no logs', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[]}
        />
      );

      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No delivery logs')).toBeInTheDocument();
      expect(screen.getByText('No webhook deliveries have been attempted yet.')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[]}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Loading webhook logs...')).toBeInTheDocument();
    });

    it('renders error state', () => {
      const error = new Error('Failed to load logs');
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[]}
          error={error}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Error loading webhook logs: Failed to load logs')).toBeInTheDocument();
      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  describe('Filter Controls', () => {
    it('handles status filter changes', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const statusFilter = screen.getByTestId('status-filter');
      await user.selectOptions(statusFilter, 'success');

      expect(statusFilter).toHaveValue('success');
    });

    it('handles event type filter changes', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const eventTypeFilter = screen.getByTestId('event-type-filter');
      await user.selectOptions(eventTypeFilter, 'task:completed');

      expect(eventTypeFilter).toHaveValue('task:completed');
    });

    it('handles date range filter changes', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const dateRangeFilter = screen.getByTestId('date-range-filter');
      await user.selectOptions(dateRangeFilter, 'today');

      expect(dateRangeFilter).toHaveValue('today');
    });
  });

  describe('User Interactions', () => {
    it('handles refresh button click', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      await user.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('disables refresh button when loading', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
          isLoading={true}
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByTestId('refresh-button');
      expect(refreshButton).toBeDisabled();
      expect(refreshButton).toHaveTextContent('Refreshing...');
    });

    it('handles view details button click', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const viewDetailsButton = screen.getByTestId('view-details-log-1');
      await user.click(viewDetailsButton);

      expect(screen.getByTestId('log-details-modal')).toBeInTheDocument();
    });

    it('shows retry button for failed logs', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      // Failed log should have retry button
      expect(screen.getByTestId('retry-log-2')).toBeInTheDocument();

      // Success log should not have retry button
      expect(screen.queryByTestId('retry-log-1')).not.toBeInTheDocument();
    });

    it('handles load more button click', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
          onLoadMore={mockOnLoadMore}
          hasMore={true}
        />
      );

      const loadMoreButton = screen.getByTestId('load-more-button');
      await user.click(loadMoreButton);

      expect(mockOnLoadMore).toHaveBeenCalled();
    });

    it('disables load more button when loading', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
          onLoadMore={mockOnLoadMore}
          hasMore={true}
          isLoading={true}
        />
      );

      const loadMoreButton = screen.getByTestId('load-more-button');
      expect(loadMoreButton).toBeDisabled();
      expect(loadMoreButton).toHaveTextContent('Loading...');
    });
  });

  describe('Log Details Modal', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const viewDetailsButton = screen.getByTestId('view-details-log-1');
      await user.click(viewDetailsButton);
    });

    it('displays detailed log information', () => {
      expect(screen.getByTestId('detail-log-id')).toHaveTextContent('log-1');
      expect(screen.getByTestId('detail-event-type')).toHaveTextContent('task:completed');
      expect(screen.getByTestId('detail-task-id')).toHaveTextContent('task-123');
      expect(screen.getByTestId('detail-status')).toHaveTextContent('success');
      expect(screen.getByTestId('detail-status-code')).toHaveTextContent('200');
      expect(screen.getByTestId('detail-attempt')).toHaveTextContent('1');
      expect(screen.getByTestId('detail-duration')).toHaveTextContent('245ms');
      expect(screen.getByTestId('detail-resolved-ip')).toHaveTextContent('192.168.1.100');
    });

    it('displays request payload and response body', () => {
      expect(screen.getByTestId('detail-request-payload')).toBeInTheDocument();
      expect(screen.getByTestId('detail-response-body')).toBeInTheDocument();
    });

    it('handles modal close via close button', async () => {
      const user = userEvent.setup();
      const closeButton = screen.getByTestId('close-modal-button');
      await user.click(closeButton);

      expect(screen.queryByTestId('log-details-modal')).not.toBeInTheDocument();
    });

    it('handles modal close via backdrop click', async () => {
      const user = userEvent.setup();
      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(screen.queryByTestId('log-details-modal')).not.toBeInTheDocument();
    });

    it('handles modal close via details close button', async () => {
      const user = userEvent.setup();
      const closeButton = screen.getByTestId('close-details-button');
      await user.click(closeButton);

      expect(screen.queryByTestId('log-details-modal')).not.toBeInTheDocument();
    });

    it('shows error details for failed logs', async () => {
      const user = userEvent.setup();
      // Close current modal first
      await user.click(screen.getByTestId('close-modal-button'));

      // Open modal for failed log
      const viewDetailsButton = screen.getByTestId('view-details-log-2');
      await user.click(viewDetailsButton);

      expect(screen.getByTestId('detail-error-message')).toHaveTextContent('Server responded with 500');
    });

    it('shows next retry time for retrying logs', async () => {
      const user = userEvent.setup();
      // Close current modal first
      await user.click(screen.getByTestId('close-modal-button'));

      // Open modal for retrying log
      const viewDetailsButton = screen.getByTestId('view-details-log-3');
      await user.click(viewDetailsButton);

      expect(screen.getByTestId('detail-next-retry')).toBeInTheDocument();
    });

    it('shows retry button for failed logs in modal', async () => {
      const user = userEvent.setup();
      // Close current modal first
      await user.click(screen.getByTestId('close-modal-button'));

      // Open modal for failed log
      const viewDetailsButton = screen.getByTestId('view-details-log-2');
      await user.click(viewDetailsButton);

      expect(screen.getByTestId('retry-from-details-button')).toBeInTheDocument();
    });
  });

  describe('Date and Time Formatting', () => {
    it('formats timestamps correctly', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const timestamp = screen.getByTestId('timestamp-log-1');
      expect(timestamp).toHaveTextContent('Jan 15, 2024, 12:00:00 PM');
    });
  });

  describe('Status Visual Indicators', () => {
    it('applies correct colors to status indicators', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const successStatus = screen.getByTestId('status-log-1');
      const failedStatus = screen.getByTestId('status-log-2');
      const retryingStatus = screen.getByTestId('status-log-3');

      expect(successStatus.querySelector('span')).toHaveStyle({ color: 'green' });
      expect(failedStatus.querySelector('span')).toHaveStyle({ color: 'red' });
      expect(retryingStatus.querySelector('span')).toHaveStyle({ color: 'yellow' });
    });
  });

  describe('Accessibility', () => {
    it('has proper table structure', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('columnheader')).toHaveLength(8);
      expect(screen.getAllByRole('row')).toHaveLength(4); // 1 header + 3 data rows
    });

    it('has proper ARIA labels for loading state', () => {
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[]}
          isLoading={true}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has proper error announcements', () => {
      const error = new Error('Failed to load logs');
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[]}
          error={error}
        />
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('supports keyboard navigation in modal', async () => {
      const user = userEvent.setup();
      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={mockLogs}
        />
      );

      const viewDetailsButton = screen.getByTestId('view-details-log-1');
      await user.click(viewDetailsButton);

      const closeButton = screen.getByTestId('close-modal-button');
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByTestId('close-details-button')).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles logs with missing data gracefully', () => {
      const incompleteLog: WebhookDeliveryLog = {
        id: 'incomplete-log',
        webhookId: 'webhook-1',
        eventType: 'task:created',
        taskId: 'task-incomplete',
        statusCode: null,
        status: 'pending',
        attemptNumber: 1,
        attemptedAt: new Date(),
      };

      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[incompleteLog]}
        />
      );

      expect(screen.getByTestId('status-code-incomplete-log')).toHaveTextContent('-');
      expect(screen.getByTestId('duration-incomplete-log')).toHaveTextContent('-');
    });

    it('handles very long log data', () => {
      const longLog: WebhookDeliveryLog = {
        ...mockLogs[0],
        id: 'long-log',
        requestPayload: JSON.stringify({
          event: 'task:completed',
          data: 'A'.repeat(1000),
          metadata: {
            longField: 'B'.repeat(500),
          }
        }),
        responseBody: JSON.stringify({
          result: 'success',
          details: 'C'.repeat(800)
        }),
      };

      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={[longLog]}
        />
      );

      expect(screen.getByTestId('log-row-long-log')).toBeInTheDocument();
    });

    it('handles large number of logs efficiently', () => {
      const manyLogs = Array.from({ length: 100 }, (_, i) => ({
        ...mockLogs[0],
        id: `log-${i}`,
        attemptedAt: new Date(Date.now() - i * 1000),
      }));

      render(
        <WebhookLogViewer
          webhookId="webhook-1"
          logs={manyLogs}
        />
      );

      expect(screen.getAllByRole('row')).toHaveLength(101); // 100 data rows + 1 header
    });
  });
});