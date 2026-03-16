/**
 * Tests for WebhookForm component
 * Form for creating and editing webhook configurations
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WebhookSubscription } from '@apexcli/core';

interface WebhookFormProps {
  webhook?: Partial<WebhookSubscription>;
  onSubmit: (data: Partial<WebhookSubscription>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

// Mock WebhookForm component (to be implemented)
const WebhookForm: React.FC<WebhookFormProps> = ({ webhook, onSubmit, onCancel, isLoading = false }) => {
  const [formData, setFormData] = React.useState({
    name: webhook?.name || '',
    url: webhook?.url || '',
    secret: webhook?.secret || '',
    enabled: webhook?.enabled ?? true,
    events: webhook?.events || [],
    taskFilters: webhook?.taskFilters || [],
    workflowFilters: webhook?.workflowFilters || [],
    headers: webhook?.headers || {},
    retry: webhook?.retry || {
      maxAttempts: 5,
      initialDelayMs: 1000,
      maxDelayMs: 300000,
      backoffMultiplier: 2,
    },
    timeoutMs: webhook?.timeoutMs || 30000,
    contentType: webhook?.contentType || 'application/json',
    description: webhook?.description || '',
    tags: webhook?.tags || [],
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URL is required';
    } else if (!formData.url.startsWith('https://')) {
      newErrors.url = 'URL must use HTTPS';
    }

    if (formData.secret && (formData.secret.length < 16 || formData.secret.length > 256)) {
      newErrors.secret = 'Secret must be between 16 and 256 characters';
    }

    if (formData.timeoutMs < 1000 || formData.timeoutMs > 300000) {
      newErrors.timeoutMs = 'Timeout must be between 1000 and 300000 milliseconds';
    }

    if (formData.retry.maxAttempts < 0 || formData.retry.maxAttempts > 10) {
      newErrors['retry.maxAttempts'] = 'Max attempts must be between 0 and 10';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrors({ submit: 'Failed to save webhook' });
    }
  };

  const availableEvents = [
    'task:created',
    'task:started',
    'task:completed',
    'task:failed',
    'task:paused',
    'approval:required',
    'approval:granted',
    'approval:denied',
    'gate:required',
    'gate:approved',
    'gate:rejected',
  ];

  return (
    <form onSubmit={handleSubmit} data-testid="webhook-form">
      <div>
        <h2>{webhook ? 'Edit Webhook' : 'Create New Webhook'}</h2>
      </div>

      {errors.submit && (
        <div role="alert" data-testid="form-error">
          {errors.submit}
        </div>
      )}

      <div>
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter webhook name"
          data-testid="name-input"
          required
        />
        {errors.name && (
          <span data-testid="name-error" role="alert">{errors.name}</span>
        )}
      </div>

      <div>
        <label htmlFor="url">URL *</label>
        <input
          id="url"
          type="url"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          placeholder="https://api.example.com/webhook"
          data-testid="url-input"
          required
        />
        {errors.url && (
          <span data-testid="url-error" role="alert">{errors.url}</span>
        )}
      </div>

      <div>
        <label htmlFor="secret">Secret</label>
        <input
          id="secret"
          type="password"
          value={formData.secret}
          onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
          placeholder="Optional secret for HMAC signature"
          data-testid="secret-input"
        />
        {errors.secret && (
          <span data-testid="secret-error" role="alert">{errors.secret}</span>
        )}
        <small>Used to generate HMAC-SHA256 signature for webhook verification</small>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            data-testid="enabled-checkbox"
          />
          Enable webhook
        </label>
      </div>

      <div>
        <label>Event Types</label>
        <div data-testid="events-checkboxes">
          {availableEvents.map((event) => (
            <label key={event}>
              <input
                type="checkbox"
                checked={formData.events.includes(event)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      events: [...formData.events, event],
                    });
                  } else {
                    setFormData({
                      ...formData,
                      events: formData.events.filter((e) => e !== event),
                    });
                  }
                }}
                data-testid={`event-${event}`}
              />
              {event}
            </label>
          ))}
        </div>
        <small>Leave empty to subscribe to all events</small>
      </div>

      <div>
        <label htmlFor="task-filters">Task Filters</label>
        <textarea
          id="task-filters"
          value={formData.taskFilters.join('\n')}
          onChange={(e) => setFormData({
            ...formData,
            taskFilters: e.target.value.split('\n').filter(line => line.trim()),
          })}
          placeholder="task-id-prefix-*&#10;specific-task-id"
          data-testid="task-filters-input"
          rows={3}
        />
        <small>One filter per line. Use * for wildcards.</small>
      </div>

      <div>
        <label htmlFor="workflow-filters">Workflow Filters</label>
        <textarea
          id="workflow-filters"
          value={formData.workflowFilters.join('\n')}
          onChange={(e) => setFormData({
            ...formData,
            workflowFilters: e.target.value.split('\n').filter(line => line.trim()),
          })}
          placeholder="feature&#10;bugfix&#10;hotfix"
          data-testid="workflow-filters-input"
          rows={3}
        />
        <small>One workflow per line</small>
      </div>

      <div>
        <label htmlFor="headers">Custom Headers</label>
        <textarea
          id="headers"
          value={Object.entries(formData.headers).map(([key, value]) => `${key}: ${value}`).join('\n')}
          onChange={(e) => {
            const headers: Record<string, string> = {};
            e.target.value.split('\n').forEach(line => {
              const [key, ...valueParts] = line.split(':');
              if (key && valueParts.length) {
                headers[key.trim()] = valueParts.join(':').trim();
              }
            });
            setFormData({ ...formData, headers });
          }}
          placeholder="Authorization: Bearer token&#10;X-Custom-Header: value"
          data-testid="headers-input"
          rows={3}
        />
        <small>One header per line in format "Key: Value"</small>
      </div>

      <div>
        <label htmlFor="timeout">Timeout (ms)</label>
        <input
          id="timeout"
          type="number"
          min="1000"
          max="300000"
          value={formData.timeoutMs}
          onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) || 30000 })}
          data-testid="timeout-input"
        />
        {errors.timeoutMs && (
          <span data-testid="timeout-error" role="alert">{errors.timeoutMs}</span>
        )}
      </div>

      <div>
        <label htmlFor="content-type">Content Type</label>
        <select
          id="content-type"
          value={formData.contentType}
          onChange={(e) => setFormData({ ...formData, contentType: e.target.value as any })}
          data-testid="content-type-select"
        >
          <option value="application/json">application/json</option>
          <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
        </select>
      </div>

      <fieldset>
        <legend>Retry Configuration</legend>

        <div>
          <label htmlFor="max-attempts">Max Attempts</label>
          <input
            id="max-attempts"
            type="number"
            min="0"
            max="10"
            value={formData.retry.maxAttempts}
            onChange={(e) => setFormData({
              ...formData,
              retry: { ...formData.retry, maxAttempts: parseInt(e.target.value) || 5 },
            })}
            data-testid="max-attempts-input"
          />
          {errors['retry.maxAttempts'] && (
            <span data-testid="max-attempts-error" role="alert">{errors['retry.maxAttempts']}</span>
          )}
        </div>

        <div>
          <label htmlFor="initial-delay">Initial Delay (ms)</label>
          <input
            id="initial-delay"
            type="number"
            min="100"
            max="60000"
            value={formData.retry.initialDelayMs}
            onChange={(e) => setFormData({
              ...formData,
              retry: { ...formData.retry, initialDelayMs: parseInt(e.target.value) || 1000 },
            })}
            data-testid="initial-delay-input"
          />
        </div>

        <div>
          <label htmlFor="max-delay">Max Delay (ms)</label>
          <input
            id="max-delay"
            type="number"
            min="1000"
            max="3600000"
            value={formData.retry.maxDelayMs}
            onChange={(e) => setFormData({
              ...formData,
              retry: { ...formData.retry, maxDelayMs: parseInt(e.target.value) || 300000 },
            })}
            data-testid="max-delay-input"
          />
        </div>

        <div>
          <label htmlFor="backoff-multiplier">Backoff Multiplier</label>
          <input
            id="backoff-multiplier"
            type="number"
            min="1"
            max="5"
            step="0.1"
            value={formData.retry.backoffMultiplier}
            onChange={(e) => setFormData({
              ...formData,
              retry: { ...formData.retry, backoffMultiplier: parseFloat(e.target.value) || 2 },
            })}
            data-testid="backoff-multiplier-input"
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description of this webhook"
          data-testid="description-input"
          rows={3}
          maxLength={500}
        />
        <small>{formData.description.length}/500 characters</small>
      </div>

      <div>
        <label htmlFor="tags">Tags</label>
        <input
          id="tags"
          type="text"
          value={formData.tags.join(', ')}
          onChange={(e) => setFormData({
            ...formData,
            tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean),
          })}
          placeholder="production, alerts, notifications"
          data-testid="tags-input"
        />
        <small>Comma-separated tags for organization</small>
      </div>

      <div data-testid="form-actions">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          data-testid="cancel-button"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          data-testid="submit-button"
        >
          {isLoading ? 'Saving...' : webhook ? 'Update Webhook' : 'Create Webhook'}
        </button>
      </div>
    </form>
  );
};

describe('WebhookForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('renders create mode correctly', () => {
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByText('Create New Webhook')).toBeInTheDocument();
      expect(screen.getByTestId('name-input')).toHaveValue('');
      expect(screen.getByTestId('url-input')).toHaveValue('');
      expect(screen.getByTestId('enabled-checkbox')).toBeChecked();
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Create Webhook');
    });

    it('renders edit mode with existing data', () => {
      const existingWebhook: Partial<WebhookSubscription> = {
        name: 'Existing Webhook',
        url: 'https://api.example.com/existing',
        secret: 'existing-secret-key',
        enabled: false,
        events: ['task:completed', 'task:failed'],
        description: 'Existing webhook description',
        tags: ['production', 'alerts'],
        timeoutMs: 45000,
        contentType: 'application/x-www-form-urlencoded',
      };

      render(<WebhookForm webhook={existingWebhook} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByText('Edit Webhook')).toBeInTheDocument();
      expect(screen.getByTestId('name-input')).toHaveValue('Existing Webhook');
      expect(screen.getByTestId('url-input')).toHaveValue('https://api.example.com/existing');
      expect(screen.getByTestId('secret-input')).toHaveValue('existing-secret-key');
      expect(screen.getByTestId('enabled-checkbox')).not.toBeChecked();
      expect(screen.getByTestId('description-input')).toHaveValue('Existing webhook description');
      expect(screen.getByTestId('tags-input')).toHaveValue('production, alerts');
      expect(screen.getByTestId('timeout-input')).toHaveValue(45000);
      expect(screen.getByTestId('content-type-select')).toHaveValue('application/x-www-form-urlencoded');
      expect(screen.getByTestId('submit-button')).toHaveTextContent('Update Webhook');
    });

    it('renders all form fields', () => {
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByTestId('name-input')).toBeInTheDocument();
      expect(screen.getByTestId('url-input')).toBeInTheDocument();
      expect(screen.getByTestId('secret-input')).toBeInTheDocument();
      expect(screen.getByTestId('enabled-checkbox')).toBeInTheDocument();
      expect(screen.getByTestId('events-checkboxes')).toBeInTheDocument();
      expect(screen.getByTestId('task-filters-input')).toBeInTheDocument();
      expect(screen.getByTestId('workflow-filters-input')).toBeInTheDocument();
      expect(screen.getByTestId('headers-input')).toBeInTheDocument();
      expect(screen.getByTestId('timeout-input')).toBeInTheDocument();
      expect(screen.getByTestId('content-type-select')).toBeInTheDocument();
      expect(screen.getByTestId('max-attempts-input')).toBeInTheDocument();
      expect(screen.getByTestId('initial-delay-input')).toBeInTheDocument();
      expect(screen.getByTestId('max-delay-input')).toBeInTheDocument();
      expect(screen.getByTestId('backoff-multiplier-input')).toBeInTheDocument();
      expect(screen.getByTestId('description-input')).toBeInTheDocument();
      expect(screen.getByTestId('tags-input')).toBeInTheDocument();
    });

    it('renders all event type checkboxes', () => {
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const expectedEvents = [
        'task:created',
        'task:started',
        'task:completed',
        'task:failed',
        'task:paused',
        'approval:required',
        'approval:granted',
        'approval:denied',
        'gate:required',
        'gate:approved',
        'gate:rejected',
      ];

      expectedEvents.forEach(event => {
        expect(screen.getByTestId(`event-${event}`)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('validates required fields', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('name-error')).toHaveTextContent('Name is required');
        expect(screen.getByTestId('url-error')).toHaveTextContent('URL is required');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates URL must be HTTPS', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(screen.getByTestId('name-input'), 'Test Webhook');
      await user.type(screen.getByTestId('url-input'), 'http://insecure.example.com');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('url-error')).toHaveTextContent('URL must use HTTPS');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates secret length', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(screen.getByTestId('name-input'), 'Test Webhook');
      await user.type(screen.getByTestId('url-input'), 'https://api.example.com/webhook');
      await user.type(screen.getByTestId('secret-input'), 'short'); // Too short

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('secret-error')).toHaveTextContent('Secret must be between 16 and 256 characters');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates timeout range', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(screen.getByTestId('name-input'), 'Test Webhook');
      await user.type(screen.getByTestId('url-input'), 'https://api.example.com/webhook');
      await user.clear(screen.getByTestId('timeout-input'));
      await user.type(screen.getByTestId('timeout-input'), '500'); // Too low

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('timeout-error')).toHaveTextContent('Timeout must be between 1000 and 300000 milliseconds');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('validates retry max attempts range', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(screen.getByTestId('name-input'), 'Test Webhook');
      await user.type(screen.getByTestId('url-input'), 'https://api.example.com/webhook');
      await user.clear(screen.getByTestId('max-attempts-input'));
      await user.type(screen.getByTestId('max-attempts-input'), '15'); // Too high

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('max-attempts-error')).toHaveTextContent('Max attempts must be between 0 and 10');
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Form Interactions', () => {
    it('handles name input changes', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByTestId('name-input');
      await user.type(nameInput, 'My Webhook');

      expect(nameInput).toHaveValue('My Webhook');
    });

    it('handles URL input changes', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const urlInput = screen.getByTestId('url-input');
      await user.type(urlInput, 'https://api.example.com/webhook');

      expect(urlInput).toHaveValue('https://api.example.com/webhook');
    });

    it('handles enabled checkbox toggle', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const enabledCheckbox = screen.getByTestId('enabled-checkbox');
      expect(enabledCheckbox).toBeChecked();

      await user.click(enabledCheckbox);
      expect(enabledCheckbox).not.toBeChecked();

      await user.click(enabledCheckbox);
      expect(enabledCheckbox).toBeChecked();
    });

    it('handles event type selection', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const taskCompletedCheckbox = screen.getByTestId('event-task:completed');
      const taskFailedCheckbox = screen.getByTestId('event-task:failed');

      expect(taskCompletedCheckbox).not.toBeChecked();
      expect(taskFailedCheckbox).not.toBeChecked();

      await user.click(taskCompletedCheckbox);
      expect(taskCompletedCheckbox).toBeChecked();

      await user.click(taskFailedCheckbox);
      expect(taskFailedCheckbox).toBeChecked();

      // Uncheck one
      await user.click(taskCompletedCheckbox);
      expect(taskCompletedCheckbox).not.toBeChecked();
      expect(taskFailedCheckbox).toBeChecked();
    });

    it('handles task filters input', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const taskFiltersInput = screen.getByTestId('task-filters-input');
      await user.type(taskFiltersInput, 'task-prefix-*\nspecific-task-id\nanother-filter');

      expect(taskFiltersInput).toHaveValue('task-prefix-*\nspecific-task-id\nanother-filter');
    });

    it('handles workflow filters input', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const workflowFiltersInput = screen.getByTestId('workflow-filters-input');
      await user.type(workflowFiltersInput, 'feature\nbugfix\nhotfix');

      expect(workflowFiltersInput).toHaveValue('feature\nbugfix\nhotfix');
    });

    it('handles custom headers input', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const headersInput = screen.getByTestId('headers-input');
      await user.type(headersInput, 'Authorization: Bearer token123\nX-Custom-Header: custom-value');

      expect(headersInput).toHaveValue('Authorization: Bearer token123\nX-Custom-Header: custom-value');
    });

    it('handles content type selection', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const contentTypeSelect = screen.getByTestId('content-type-select');
      expect(contentTypeSelect).toHaveValue('application/json');

      await user.selectOptions(contentTypeSelect, 'application/x-www-form-urlencoded');
      expect(contentTypeSelect).toHaveValue('application/x-www-form-urlencoded');
    });

    it('handles retry configuration changes', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const maxAttemptsInput = screen.getByTestId('max-attempts-input');
      const initialDelayInput = screen.getByTestId('initial-delay-input');
      const maxDelayInput = screen.getByTestId('max-delay-input');
      const backoffMultiplierInput = screen.getByTestId('backoff-multiplier-input');

      await user.clear(maxAttemptsInput);
      await user.type(maxAttemptsInput, '3');
      expect(maxAttemptsInput).toHaveValue(3);

      await user.clear(initialDelayInput);
      await user.type(initialDelayInput, '2000');
      expect(initialDelayInput).toHaveValue(2000);

      await user.clear(maxDelayInput);
      await user.type(maxDelayInput, '120000');
      expect(maxDelayInput).toHaveValue(120000);

      await user.clear(backoffMultiplierInput);
      await user.type(backoffMultiplierInput, '1.5');
      expect(backoffMultiplierInput).toHaveValue(1.5);
    });

    it('handles tags input', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const tagsInput = screen.getByTestId('tags-input');
      await user.type(tagsInput, 'production, alerts, notifications');

      expect(tagsInput).toHaveValue('production, alerts, notifications');
    });

    it('tracks description character count', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const descriptionInput = screen.getByTestId('description-input');
      await user.type(descriptionInput, 'This is a test description');

      expect(screen.getByText('26/500 characters')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('submits valid form data', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Fill in required fields
      await user.type(screen.getByTestId('name-input'), 'Test Webhook');
      await user.type(screen.getByTestId('url-input'), 'https://api.example.com/webhook');

      // Select some events
      await user.click(screen.getByTestId('event-task:completed'));
      await user.click(screen.getByTestId('event-task:failed'));

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Test Webhook',
          url: 'https://api.example.com/webhook',
          secret: '',
          enabled: true,
          events: ['task:completed', 'task:failed'],
          taskFilters: [],
          workflowFilters: [],
          headers: {},
          retry: {
            maxAttempts: 5,
            initialDelayMs: 1000,
            maxDelayMs: 300000,
            backoffMultiplier: 2,
          },
          timeoutMs: 30000,
          contentType: 'application/json',
          description: '',
          tags: [],
        });
      });
    });

    it('handles submission errors', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValue(new Error('Submission failed'));
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      await user.type(screen.getByTestId('name-input'), 'Test Webhook');
      await user.type(screen.getByTestId('url-input'), 'https://api.example.com/webhook');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('form-error')).toHaveTextContent('Failed to save webhook');
      });
    });

    it('shows loading state during submission', async () => {
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} isLoading={true} />);

      const submitButton = screen.getByTestId('submit-button');
      const cancelButton = screen.getByTestId('cancel-button');

      expect(submitButton).toHaveTextContent('Saving...');
      expect(submitButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Form Cancellation', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByLabelText('Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('URL *')).toBeInTheDocument();
      expect(screen.getByLabelText('Secret')).toBeInTheDocument();
      expect(screen.getByLabelText('Enable webhook')).toBeInTheDocument();
      expect(screen.getByLabelText('Event Types')).toBeInTheDocument();
    });

    it('has proper error announcements', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('name-error')).toHaveAttribute('role', 'alert');
        expect(screen.getByTestId('url-error')).toHaveAttribute('role', 'alert');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      const nameInput = screen.getByTestId('name-input');
      nameInput.focus();
      expect(nameInput).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByTestId('url-input')).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByTestId('secret-input')).toHaveFocus();
    });

    it('has fieldset for retry configuration', () => {
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      expect(screen.getByRole('group', { name: 'Retry Configuration' })).toBeInTheDocument();
    });
  });

  describe('Complex Data Handling', () => {
    it('handles complex form data submission', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValue(undefined);
      render(<WebhookForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);

      // Fill in all fields with complex data
      await user.type(screen.getByTestId('name-input'), 'Complex Webhook');
      await user.type(screen.getByTestId('url-input'), 'https://api.example.com/webhook/complex');
      await user.type(screen.getByTestId('secret-input'), 'very-secret-key-16-characters');
      await user.click(screen.getByTestId('enabled-checkbox')); // Disable

      // Select multiple events
      await user.click(screen.getByTestId('event-task:completed'));
      await user.click(screen.getByTestId('event-approval:required'));

      // Add filters
      await user.type(screen.getByTestId('task-filters-input'), 'important-*\nurgent-task-*');
      await user.type(screen.getByTestId('workflow-filters-input'), 'feature\nbugfix');

      // Add custom headers
      await user.type(screen.getByTestId('headers-input'), 'Authorization: Bearer abc123\nX-Custom: value');

      // Modify retry config
      await user.clear(screen.getByTestId('max-attempts-input'));
      await user.type(screen.getByTestId('max-attempts-input'), '3');

      // Add description and tags
      await user.type(screen.getByTestId('description-input'), 'Complex webhook for testing');
      await user.type(screen.getByTestId('tags-input'), 'complex, testing, automated');

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          name: 'Complex Webhook',
          url: 'https://api.example.com/webhook/complex',
          secret: 'very-secret-key-16-characters',
          enabled: false,
          events: ['task:completed', 'approval:required'],
          taskFilters: ['important-*', 'urgent-task-*'],
          workflowFilters: ['feature', 'bugfix'],
          headers: {
            'Authorization': 'Bearer abc123',
            'X-Custom': 'value',
          },
          retry: {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 300000,
            backoffMultiplier: 2,
          },
          timeoutMs: 30000,
          contentType: 'application/json',
          description: 'Complex webhook for testing',
          tags: ['complex', 'testing', 'automated'],
        });
      });
    });
  });
});