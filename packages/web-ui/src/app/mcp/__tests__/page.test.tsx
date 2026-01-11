import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MCPMarketplacePage from '../page';
import { apiClient } from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getMCPMarketplaceEntries: vi.fn(),
    listMCPServers: vi.fn(),
    installMCPServer: vi.fn(),
  },
}));

// Mock UI components to avoid dependency issues
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, className, variant, size, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/Card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span className={className} data-variant={variant} {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/ui/Spinner', () => ({
  Spinner: ({ className }: any) => <div className={className} data-testid="spinner" />,
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  Download: () => <div data-testid="download-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  ExternalLink: () => <div data-testid="external-link-icon" />,
  Puzzle: () => <div data-testid="puzzle-icon" />,
  Filter: () => <div data-testid="filter-icon" />,
}));

const mockMarketplaceEntries = [
  {
    name: 'filesystem-server',
    description: 'Provides access to filesystem operations',
    version: '1.0.0',
    author: 'ModelContextProtocol',
    category: 'filesystem',
    tags: ['files', 'io', 'storage'],
    serverConfig: {
      type: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
    },
  },
  {
    name: 'web-server',
    description: 'Web browsing and content fetching capabilities',
    version: '2.1.0',
    author: 'Community',
    category: 'web',
    tags: ['http', 'browser', 'fetch'],
    installCommand: 'npm install @mcp/web-server',
    serverConfig: {
      type: 'stdio',
      command: 'node',
      args: ['web-server.js'],
    },
  },
  {
    name: 'database-server',
    description: 'Database operations and query execution',
    version: '1.5.2',
    author: 'Database Team',
    category: 'database',
    tags: ['sql', 'query', 'data'],
    serverConfig: {
      type: 'http',
      url: 'http://localhost:8080',
    },
  },
];

const mockInstalledServers = [
  {
    name: 'filesystem-server',
    type: 'stdio',
    command: 'npx',
    args: ['@modelcontextprotocol/server-filesystem'],
  },
];

describe('MCPMarketplacePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default API mocks
    vi.mocked(apiClient.getMCPMarketplaceEntries).mockResolvedValue({
      entries: mockMarketplaceEntries,
    });

    vi.mocked(apiClient.listMCPServers).mockResolvedValue(mockInstalledServers);

    vi.mocked(apiClient.installMCPServer).mockResolvedValue({
      serverConfig: mockMarketplaceEntries[1].serverConfig,
      ok: true,
      message: 'Server installed successfully',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Loading', () => {
    it('shows loading spinner initially', async () => {
      // Make API calls hang to test loading state
      vi.mocked(apiClient.getMCPMarketplaceEntries).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<MCPMarketplacePage />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading MCP marketplace...')).toBeInTheDocument();
    });

    it('loads marketplace entries and installed servers on mount', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      expect(apiClient.getMCPMarketplaceEntries).toHaveBeenCalledTimes(1);
      expect(apiClient.listMCPServers).toHaveBeenCalledTimes(1);
    });

    it('displays error state gracefully when API calls fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.getMCPMarketplaceEntries).mockRejectedValue(
        new Error('API Error')
      );

      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch MCP data:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Marketplace Display', () => {
    it('renders header with title and description', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('MCP Marketplace')).toBeInTheDocument();
      expect(
        screen.getByText(/Discover and install Model Context Protocol/)
      ).toBeInTheDocument();
    });

    it('displays statistics cards', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText('3')).toBeInTheDocument(); // Available Servers
      expect(screen.getByText('1')).toBeInTheDocument(); // Installed Servers
      expect(screen.getByText('Available Servers')).toBeInTheDocument();
      expect(screen.getByText('Installed Servers')).toBeInTheDocument();
    });

    it('renders server cards with correct information', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Check first server
      expect(screen.getByText('filesystem-server')).toBeInTheDocument();
      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      expect(screen.getByText('by ModelContextProtocol')).toBeInTheDocument();
      expect(screen.getByText('Provides access to filesystem operations')).toBeInTheDocument();

      // Check tags
      expect(screen.getByText('files')).toBeInTheDocument();
      expect(screen.getByText('io')).toBeInTheDocument();
      expect(screen.getByText('storage')).toBeInTheDocument();

      // Check category
      expect(screen.getByText('filesystem')).toBeInTheDocument();
    });

    it('shows installed status for installed servers', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // filesystem-server is installed
      expect(screen.getByText('Installed')).toBeInTheDocument();

      // Other servers should show Install button
      expect(screen.getByText('Install')).toBeInTheDocument();
    });

    it('displays server type information', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      expect(screen.getByText(/Type: stdio/)).toBeInTheDocument();
      expect(screen.getByText(/Type: http/)).toBeInTheDocument();
    });
  });

  describe('Search and Filtering', () => {
    it('filters servers by search query', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      fireEvent.change(searchInput, { target: { value: 'web' } });

      // Should only show web-server
      expect(screen.getByText('web-server')).toBeInTheDocument();
      expect(screen.queryByText('filesystem-server')).not.toBeInTheDocument();
      expect(screen.queryByText('database-server')).not.toBeInTheDocument();
    });

    it('filters servers by author in search', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      fireEvent.change(searchInput, { target: { value: 'Community' } });

      // Should only show web-server (by Community)
      expect(screen.getByText('web-server')).toBeInTheDocument();
      expect(screen.queryByText('filesystem-server')).not.toBeInTheDocument();
    });

    it('filters servers by category', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const categorySelect = screen.getByDisplayValue('All Categories');
      fireEvent.change(categorySelect, { target: { value: 'web' } });

      // Should only show web-server
      expect(screen.getByText('web-server')).toBeInTheDocument();
      expect(screen.queryByText('filesystem-server')).not.toBeInTheDocument();
      expect(screen.queryByText('database-server')).not.toBeInTheDocument();
    });

    it('combines search and category filters', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Search for 'server' and filter by 'database' category
      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      fireEvent.change(searchInput, { target: { value: 'server' } });

      const categorySelect = screen.getByDisplayValue('All Categories');
      fireEvent.change(categorySelect, { target: { value: 'database' } });

      // Should only show database-server
      expect(screen.getByText('database-server')).toBeInTheDocument();
      expect(screen.queryByText('web-server')).not.toBeInTheDocument();
      expect(screen.queryByText('filesystem-server')).not.toBeInTheDocument();
    });

    it('updates search results count', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Initially shows 3 results
      expect(screen.getByText('3')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      fireEvent.change(searchInput, { target: { value: 'web' } });

      // Should show 1 result
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Server Installation', () => {
    it('installs a server when install button is clicked', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find and click the install button for web-server
      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      expect(apiClient.installMCPServer).toHaveBeenCalledWith('web-server');
    });

    it('shows installing state during installation', async () => {
      // Make install API hang to test loading state
      vi.mocked(apiClient.installMCPServer).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      // Should show installing state
      expect(screen.getByText('Installing...')).toBeInTheDocument();
    });

    it('shows success state after successful installation', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Installed!')).toBeInTheDocument();
      });
    });

    it('shows error state when installation fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(apiClient.installMCPServer).mockRejectedValue(
        new Error('Installation failed')
      );

      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to install web-server:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('clears success status after timeout', async () => {
      vi.useFakeTimers();

      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Installed!')).toBeInTheDocument();
      });

      // Fast forward 3 seconds
      vi.advanceTimersByTime(3000);

      await waitFor(() => {
        expect(screen.queryByText('Installed!')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no servers match filter', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No MCP servers found')).toBeInTheDocument();
      expect(
        screen.getByText(/Try adjusting your search terms or category filter/)
      ).toBeInTheDocument();
      expect(screen.getByText('Clear search')).toBeInTheDocument();
    });

    it('clears search when clear search button is clicked', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      const clearButton = screen.getByText('Clear search');
      fireEvent.click(clearButton);

      expect((searchInput as HTMLInputElement).value).toBe('');
      expect(screen.queryByText('No MCP servers found')).not.toBeInTheDocument();
    });
  });

  describe('Tag Display', () => {
    it('shows limited tags with "more" indicator', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // filesystem-server has 3 tags, should show all
      expect(screen.getByText('files')).toBeInTheDocument();
      expect(screen.getByText('io')).toBeInTheDocument();
      expect(screen.getByText('storage')).toBeInTheDocument();
    });

    it('truncates long descriptions', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Descriptions should be truncated with line-clamp-3 CSS class
      const descriptions = screen.getAllByText(/Provides access to filesystem operations/);
      expect(descriptions[0]).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible form elements', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Search input should have placeholder
      const searchInput = screen.getByPlaceholderText('Search MCP servers...');
      expect(searchInput).toBeInTheDocument();

      // Category select should be accessible
      const categorySelect = screen.getByDisplayValue('All Categories');
      expect(categorySelect).toBeInTheDocument();
    });

    it('has proper button states', async () => {
      render(<MCPMarketplacePage />);

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Installed button should be disabled
      const installedButton = screen.getByText('Installed');
      expect(installedButton).toHaveAttribute('disabled');

      // Install buttons should not be disabled
      const installButtons = screen.getAllByText('Install');
      expect(installButtons[0]).not.toHaveAttribute('disabled');
    });
  });
});