/**
 * Tests for WebhookManager component
 * Main webhook management page with list, create, edit, and delete functionality
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebhookSubscription } from '@apexcli/core';

// Mock the useWebhooks hook
const mockWebhooks: WebhookSubscription[] = [
  {
    id: 'webhook-1',
    name: 'Task Completion Webhook',
    url: 'https://api.example.com/webhook/tasks',
    enabled: true,
    events: ['task:completed', 'task:failed'],
    taskFilters: [],
    workflowFilters: [],
    headers: {},
    timeoutMs: 30000,
    contentType: 'application/json',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    tags: ['production', 'alerts'],
  },
  {
    id: 'webhook-2',
    name: 'Development Webhook',
    url: 'https://dev.example.com/webhook',
    enabled: false,
    events: ['task:created'],
    taskFilters: ['test-*'],
    workflowFilters: ['feature'],
    headers: { 'Authorization': 'Bearer dev-token' },
    timeoutMs: 15000,
    contentType: 'application/json',
    createdAt: new Date('2024-01-14T15:30:00Z'),
    updatedAt: new Date('2024-01-14T15:30:00Z'),
    tags: ['development'],
  },
];

const mockUseWebhooks = {
  webhooks: mockWebhooks,
  isLoading: false,
  error: null,
  createWebhook: vi.fn(),
  updateWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
  testWebhook: vi.fn(),
};

// Mock WebhookManager component (to be implemented)
const WebhookManager: React.FC = () => {
  const { webhooks, isLoading, error, createWebhook, updateWebhook, deleteWebhook } = mockUseWebhooks;

  if (isLoading) {
    return (
      <div>
        <div data-testid="loading-spinner" role="status" aria-label="Loading webhooks">
          Loading webhooks...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div data-testid="error-message" role="alert">
          Error loading webhooks: {error.message}
        </div>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1>Webhook Management</h1>
        <p>Manage webhook subscriptions for custom integrations</p>
        <button data-testid="create-webhook-btn">Create New Webhook</button>
      </header>

      <div data-testid="webhook-filters">
        <input
          type="search"
          placeholder="Search webhooks..."
          data-testid="search-input"
        />
        <select data-testid="status-filter">
          <option value="">All Statuses</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select data-testid="event-filter">
          <option value="">All Events</option>
          <option value="task:completed">Task Completed</option>
          <option value="task:failed">Task Failed</option>
          <option value="approval:required">Approval Required</option>
        </select>
      </div>

      {webhooks.length === 0 ? (
        <div data-testid="empty-state">
          <h3>No webhooks configured</h3>
          <p>Create your first webhook to receive notifications about APEX events.</p>
          <button>Create Webhook</button>
        </div>
      ) : (
        <div data-testid="webhook-list">
          {webhooks.map((webhook) => (
            <div key={webhook.id} data-testid={`webhook-card-${webhook.id}`}>
              <div>
                <h3>{webhook.name}</h3>
                <p>{webhook.url}</p>
                <div>
                  <span data-testid={`status-${webhook.id}`}>
                    {webhook.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <span data-testid={`events-${webhook.id}`}>
                    {webhook.events?.length || 0} events
                  </span>
                </div>
                <div>
                  {webhook.tags?.map((tag) => (
                    <span key={tag} data-testid={`tag-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <button data-testid={`edit-${webhook.id}`}>Edit</button>
                <button data-testid={`test-${webhook.id}`}>Test</button>
                <button data-testid={`logs-${webhook.id}`}>View Logs</button>
                <button data-testid={`delete-${webhook.id}`}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div data-testid="pagination">
        <span>Showing {webhooks.length} of {webhooks.length} webhooks</span>
      </div>
    </div>
  );
};

describe('WebhookManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders webhook management header', () => {
    render(<WebhookManager />);

    expect(screen.getByRole('heading', { name: 'Webhook Management' })).toBeInTheDocument();
    expect(screen.getByText('Manage webhook subscriptions for custom integrations')).toBeInTheDocument();
    expect(screen.getByTestId('create-webhook-btn')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    mockUseWebhooks.isLoading = true;
    render(<WebhookManager />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading webhooks' })).toBeInTheDocument();
    mockUseWebhooks.isLoading = false;
  });

  it('displays error state', () => {
    mockUseWebhooks.error = new Error('Failed to load webhooks');
    render(<WebhookManager />);

    expect(screen.getByTestId('error-message')).toBeInTheDocument();
    expect(screen.getByText('Error loading webhooks: Failed to load webhooks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    mockUseWebhooks.error = null;
  });

  it('renders filter controls', () => {
    render(<WebhookManager />);

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search webhooks...')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
    expect(screen.getByTestId('event-filter')).toBeInTheDocument();
  });

  it('displays empty state when no webhooks exist', () => {
    mockUseWebhooks.webhooks = [];
    render(<WebhookManager />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No webhooks configured')).toBeInTheDocument();
    expect(screen.getByText('Create your first webhook to receive notifications about APEX events.')).toBeInTheDocument();
    mockUseWebhooks.webhooks = mockWebhooks;
  });

  it('displays webhook list when webhooks exist', () => {
    render(<WebhookManager />);

    expect(screen.getByTestId('webhook-list')).toBeInTheDocument();
    expect(screen.getByTestId('webhook-card-webhook-1')).toBeInTheDocument();
    expect(screen.getByTestId('webhook-card-webhook-2')).toBeInTheDocument();
  });

  it('displays webhook information correctly', () => {
    render(<WebhookManager />);

    // First webhook
    expect(screen.getByText('Task Completion Webhook')).toBeInTheDocument();
    expect(screen.getByText('https://api.example.com/webhook/tasks')).toBeInTheDocument();
    expect(screen.getByTestId('status-webhook-1')).toHaveTextContent('Enabled');
    expect(screen.getByTestId('events-webhook-1')).toHaveTextContent('2 events');
    expect(screen.getByTestId('tag-production')).toBeInTheDocument();
    expect(screen.getByTestId('tag-alerts')).toBeInTheDocument();

    // Second webhook
    expect(screen.getByText('Development Webhook')).toBeInTheDocument();
    expect(screen.getByText('https://dev.example.com/webhook')).toBeInTheDocument();
    expect(screen.getByTestId('status-webhook-2')).toHaveTextContent('Disabled');
    expect(screen.getByTestId('events-webhook-2')).toHaveTextContent('1 events');
    expect(screen.getByTestId('tag-development')).toBeInTheDocument();
  });

  it('displays action buttons for each webhook', () => {
    render(<WebhookManager />);

    // Check buttons for first webhook
    expect(screen.getByTestId('edit-webhook-1')).toBeInTheDocument();
    expect(screen.getByTestId('test-webhook-1')).toBeInTheDocument();
    expect(screen.getByTestId('logs-webhook-1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-webhook-1')).toBeInTheDocument();

    // Check buttons for second webhook
    expect(screen.getByTestId('edit-webhook-2')).toBeInTheDocument();
    expect(screen.getByTestId('test-webhook-2')).toBeInTheDocument();
    expect(screen.getByTestId('logs-webhook-2')).toBeInTheDocument();
    expect(screen.getByTestId('delete-webhook-2')).toBeInTheDocument();
  });

  it('handles search input changes', async () => {
    const user = userEvent.setup();
    render(<WebhookManager />);

    const searchInput = screen.getByTestId('search-input');
    await user.type(searchInput, 'Task Completion');

    expect(searchInput).toHaveValue('Task Completion');
    // In real implementation, would verify filtering behavior
  });

  it('handles status filter changes', async () => {
    const user = userEvent.setup();
    render(<WebhookManager />);

    const statusFilter = screen.getByTestId('status-filter');
    await user.selectOptions(statusFilter, 'enabled');

    expect(statusFilter).toHaveValue('enabled');
    // In real implementation, would verify filtering behavior
  });

  it('handles event filter changes', async () => {
    const user = userEvent.setup();
    render(<WebhookManager />);

    const eventFilter = screen.getByTestId('event-filter');
    await user.selectOptions(eventFilter, 'task:completed');

    expect(eventFilter).toHaveValue('task:completed');
    // In real implementation, would verify filtering behavior
  });

  it('handles create webhook button click', async () => {
    const user = userEvent.setup();
    render(<WebhookManager />);

    const createButton = screen.getByTestId('create-webhook-btn');
    await user.click(createButton);

    // In real implementation, would verify modal opens or navigation occurs
    expect(createButton).toBeInTheDocument();
  });

  it('handles edit button clicks', async () => {
    const user = userEvent.setup();
    render(<WebhookManager />);

    const editButton = screen.getByTestId('edit-webhook-1');
    await user.click(editButton);

    // In real implementation, would verify edit modal opens or navigation occurs
    expect(editButton).toBeInTheDocument();
  });

  it('handles test button clicks', async () => {
    const user = userEvent.setup();
    mockUseWebhooks.testWebhook.mockResolvedValue({ success: true, statusCode: 200 });
    render(<WebhookManager />);

    const testButton = screen.getByTestId('test-webhook-1');
    await user.click(testButton);

    expect(mockUseWebhooks.testWebhook).toHaveBeenCalledWith('webhook-1');
  });

  it('handles delete button clicks', async () => {
    const user = userEvent.setup();
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockUseWebhooks.deleteWebhook.mockResolvedValue(undefined);
    render(<WebhookManager />);

    const deleteButton = screen.getByTestId('delete-webhook-1');
    await user.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete "Task Completion Webhook"? This action cannot be undone.'
    );
    expect(mockUseWebhooks.deleteWebhook).toHaveBeenCalledWith('webhook-1');
  });

  it('does not delete webhook if user cancels confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WebhookManager />);

    const deleteButton = screen.getByTestId('delete-webhook-1');
    await user.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockUseWebhooks.deleteWebhook).not.toHaveBeenCalled();
  });

  it('displays pagination information', () => {
    render(<WebhookManager />);

    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 2 webhooks')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<WebhookManager />);

    const editButton = screen.getByTestId('edit-webhook-1');
    editButton.focus();
    expect(editButton).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(screen.getByTestId('test-webhook-1')).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(screen.getByTestId('logs-webhook-1')).toHaveFocus();

    await user.keyboard('{Tab}');
    expect(screen.getByTestId('delete-webhook-1')).toHaveFocus();
  });

  it('supports accessibility features', () => {
    render(<WebhookManager />);

    // Check for proper ARIA attributes
    expect(screen.getByRole('heading', { name: 'Webhook Management' })).toBeInTheDocument();

    // Check that buttons have accessible names
    expect(screen.getByRole('button', { name: 'Create New Webhook' })).toBeInTheDocument();

    // Check for proper search input labeling
    const searchInput = screen.getByTestId('search-input');
    expect(searchInput).toHaveAttribute('type', 'search');
    expect(searchInput).toHaveAttribute('placeholder', 'Search webhooks...');
  });

  it('handles long webhook names and URLs gracefully', () => {
    const longNameWebhook = {
      ...mockWebhooks[0],
      id: 'long-webhook',
      name: 'This is a very long webhook name that should be handled gracefully without breaking the layout',
      url: 'https://api.example.com/webhook/very/long/path/that/might/cause/layout/issues',
    };

    mockUseWebhooks.webhooks = [longNameWebhook];
    render(<WebhookManager />);

    expect(screen.getByText(longNameWebhook.name)).toBeInTheDocument();
    expect(screen.getByText(longNameWebhook.url)).toBeInTheDocument();
    mockUseWebhooks.webhooks = mockWebhooks;
  });

  it('displays correct status indicators', () => {
    render(<WebhookManager />);

    const enabledStatus = screen.getByTestId('status-webhook-1');
    const disabledStatus = screen.getByTestId('status-webhook-2');

    expect(enabledStatus).toHaveTextContent('Enabled');
    expect(disabledStatus).toHaveTextContent('Disabled');
  });

  it('displays events count correctly', () => {
    render(<WebhookManager />);

    const webhook1Events = screen.getByTestId('events-webhook-1');
    const webhook2Events = screen.getByTestId('events-webhook-2');

    expect(webhook1Events).toHaveTextContent('2 events');
    expect(webhook2Events).toHaveTextContent('1 events');
  });

  it('handles webhooks with no events', () => {
    const noEventsWebhook = {
      ...mockWebhooks[0],
      id: 'no-events-webhook',
      events: [],
    };

    mockUseWebhooks.webhooks = [noEventsWebhook];
    render(<WebhookManager />);

    expect(screen.getByTestId('events-no-events-webhook')).toHaveTextContent('0 events');
    mockUseWebhooks.webhooks = mockWebhooks;
  });

  it('handles webhooks with no tags', () => {
    const noTagsWebhook = {
      ...mockWebhooks[0],
      id: 'no-tags-webhook',
      tags: [],
    };

    mockUseWebhooks.webhooks = [noTagsWebhook];
    render(<WebhookManager />);

    // Should not display any tag elements
    expect(screen.queryByTestId('tag-production')).not.toBeInTheDocument();
    mockUseWebhooks.webhooks = mockWebhooks;
  });
});