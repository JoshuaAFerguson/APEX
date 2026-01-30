'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import {
  Search,
  Download,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Puzzle,
  Filter
} from 'lucide-react'

interface MCPMarketplaceEntry {
  name: string
  description: string
  version: string
  author?: string
  category?: string
  tags?: string[]
  installCommand?: string
  serverConfig: {
    type: string
    command?: string
    args?: string[]
    env?: Record<string, string>
    url?: string
  }
}

interface MCPServerStatus {
  name: string
  status: 'installed' | 'installing' | 'error'
}

export default function MCPMarketplacePage() {
  const [entries, setEntries] = useState<MCPMarketplaceEntry[]>([])
  const [installedServers, setInstalledServers] = useState<MCPServerStatus[]>([])
  const [categories, setCategories] = useState<Array<{ name: string; count: number }>>([])
  const [recommendations, setRecommendations] = useState<{
    essential: MCPMarketplaceEntry[];
    recommended: MCPMarketplaceEntry[];
    optional: MCPMarketplaceEntry[];
  }>({ essential: [], recommended: [], optional: [] })
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showFeatured, setShowFeatured] = useState(false)
  const [installationStatus, setInstallationStatus] = useState<Record<string, 'installing' | 'success' | 'error'>>({})
  const [autoConfigureLoading, setAutoConfigureLoading] = useState(false)

  // Fetch marketplace entries and installed servers
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Fetch marketplace entries and installed servers in parallel
        const [marketplaceResponse, serversResponse, categoriesResponse, recommendationsResponse] = await Promise.all([
          apiClient.getMCPMarketplaceEntries({
            category: selectedCategory !== 'all' ? selectedCategory : undefined,
            search: searchQuery || undefined,
            featured: showFeatured || undefined,
            verified: true
          }),
          apiClient.listMCPServers(),
          apiClient.getMCPMarketplaceCategories(),
          apiClient.getMCPRecommendations()
        ])

        setEntries(marketplaceResponse.entries as MCPMarketplaceEntry[])
        setInstalledServers(serversResponse.map(server => ({
          name: server.name!,
          status: 'installed' as const
        })))
        setCategories(categoriesResponse.categories as Array<{ name: string; count: number }>)
        setRecommendations(recommendationsResponse as {
          essential: MCPMarketplaceEntry[];
          recommended: MCPMarketplaceEntry[];
          optional: MCPMarketplaceEntry[];
        })
      } catch (error) {
        console.error('Failed to fetch MCP data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [selectedCategory, searchQuery, showFeatured])

  // Install an MCP server
  const handleInstall = async (serverName: string) => {
    try {
      setInstallationStatus(prev => ({ ...prev, [serverName]: 'installing' }))

      await apiClient.installMCPServer(serverName)

      // Update installed servers list
      setInstalledServers(prev => [
        ...prev.filter(s => s.name !== serverName),
        { name: serverName, status: 'installed' }
      ])

      setInstallationStatus(prev => ({ ...prev, [serverName]: 'success' }))

      // Clear success status after 3 seconds
      setTimeout(() => {
        setInstallationStatus(prev => {
          const { [serverName]: _, ...rest } = prev
          return rest
        })
      }, 3000)
    } catch (error) {
      console.error(`Failed to install ${serverName}:`, error)
      setInstallationStatus(prev => ({ ...prev, [serverName]: 'error' }))

      // Clear error status after 5 seconds
      setTimeout(() => {
        setInstallationStatus(prev => {
          const { [serverName]: _, ...rest } = prev
          return rest
        })
      }, 5000)
    }
  }

  // Auto-configure development tools
  const handleAutoConfig = async (preset: 'development' | 'productivity' | 'devops' | 'all') => {
    try {
      setAutoConfigureLoading(true)

      const options = preset === 'all'
        ? { developmentTools: true, productivityTools: true, devopsTools: true }
        : preset === 'development'
        ? { developmentTools: true }
        : preset === 'productivity'
        ? { productivityTools: true }
        : { devopsTools: true }

      const result = await apiClient.autoConfigureMCPTools(options)

      if (result.ok) {
        // Refresh the installed servers list
        const serversResponse = await apiClient.listMCPServers()
        setInstalledServers(serversResponse.map(server => ({
          name: server.name!,
          status: 'installed' as const
        })))

        console.log(`Auto-configuration completed: ${result.configured.length} servers configured`)
      }
    } catch (error) {
      console.error('Auto-configuration failed:', error)
    } finally {
      setAutoConfigureLoading(false)
    }
  }

  // Filter entries - no additional filtering needed since it's done at API level
  const filteredEntries = entries

  // Get category options for filter
  const categoryOptions = [
    { name: 'all', count: entries.length },
    ...categories.slice(0, 10) // Limit to top 10 categories
  ]

  // Check if a server is installed
  const isInstalled = (serverName: string) =>
    installedServers.some(s => s.name === serverName)

  // Get installation status for a server
  const getInstallationStatus = (serverName: string) =>
    installationStatus[serverName]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
        <span className="ml-2">Loading MCP marketplace...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Puzzle className="w-8 h-8 text-apex-600" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">MCP Marketplace</h1>
          <p className="text-foreground-secondary">
            Discover and install Model Context Protocol (MCP) servers to extend APEX capabilities
          </p>
        </div>
      </div>

      {/* Auto-Configuration Section */}
      <div className="bg-gradient-to-r from-apex-50 to-blue-50 dark:from-apex-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-apex-200 dark:border-apex-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Quick Setup</h2>
            <p className="text-sm text-foreground-secondary">
              Auto-configure essential tools for your development workflow in one click.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleAutoConfig('development')}
              disabled={autoConfigureLoading}
              variant="secondary"
              size="sm"
            >
              {autoConfigureLoading ? <Spinner className="w-4 h-4 mr-2" /> : null}
              Development Tools
            </Button>
            <Button
              onClick={() => handleAutoConfig('productivity')}
              disabled={autoConfigureLoading}
              variant="secondary"
              size="sm"
            >
              Productivity Tools
            </Button>
            <Button
              onClick={() => handleAutoConfig('all')}
              disabled={autoConfigureLoading}
              className="bg-apex-600 hover:bg-apex-700"
            >
              Configure All
            </Button>
          </div>
        </div>

        {/* Recommendations */}
        {(recommendations.essential.length > 0 || recommendations.recommended.length > 0) && (
          <div className="mt-4 pt-4 border-t border-apex-200 dark:border-apex-800">
            <div className="flex gap-4 text-sm">
              {recommendations.essential.length > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-foreground-secondary">
                    {recommendations.essential.length} essential tools recommended
                  </span>
                </div>
              )}
              {recommendations.recommended.length > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-foreground-secondary">
                    {recommendations.recommended.length} tools recommended for your project
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground-tertiary w-4 h-4" />
          <input
            type="text"
            placeholder="Search MCP servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-apex-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-tertiary" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-apex-500"
          >
            {categoryOptions.map(category => (
              <option key={category.name} value={category.name}>
                {category.name === 'all' ? 'All Categories' : `${category.name} (${category.count})`}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant={showFeatured ? "primary" : "secondary"}
          size="sm"
          onClick={() => setShowFeatured(!showFeatured)}
        >
          Featured Only
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-apex-100 dark:bg-apex-900 rounded-lg">
              <Puzzle className="w-5 h-5 text-apex-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{entries.length}</p>
              <p className="text-sm text-foreground-secondary">Available Servers</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{installedServers.length}</p>
              <p className="text-sm text-foreground-secondary">Installed Servers</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{filteredEntries.length}</p>
              <p className="text-sm text-foreground-secondary">Search Results</p>
            </div>
          </div>
        </Card>
      </div>

      {/* MCP Server Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEntries.map((entry) => {
          const installed = isInstalled(entry.name)
          const status = getInstallationStatus(entry.name)

          return (
            <Card key={entry.name} className="p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{entry.name}</h3>
                  <p className="text-sm text-foreground-secondary">v{entry.version}</p>
                  {entry.author && (
                    <p className="text-xs text-foreground-tertiary">by {entry.author}</p>
                  )}
                </div>

                {installed && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-foreground-secondary line-clamp-3">
                {entry.description}
              </p>

              {/* Tags */}
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entry.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="default" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {entry.tags.length > 3 && (
                    <Badge variant="default" className="text-xs">
                      +{entry.tags.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              {/* Category */}
              {entry.category && (
                <Badge variant="info" className="w-fit">
                  {entry.category}
                </Badge>
              )}

              {/* Server Type */}
              <div className="text-xs text-foreground-tertiary">
                Type: {entry.serverConfig.type}
                {entry.serverConfig.command && ` • Command: ${entry.serverConfig.command}`}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {installed ? (
                  <Button variant="secondary" className="flex-1" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Installed
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleInstall(entry.name)}
                    disabled={status === 'installing'}
                    className="flex-1"
                  >
                    {status === 'installing' ? (
                      <>
                        <Spinner className="w-4 h-4 mr-2" />
                        Installing...
                      </>
                    ) : status === 'success' ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Installed!
                      </>
                    ) : status === 'error' ? (
                      <>
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Error
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Install
                      </>
                    )}
                  </Button>
                )}

                <Button variant="secondary" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredEntries.length === 0 && !loading && (
        <div className="text-center py-12">
          <Puzzle className="w-12 h-12 text-foreground-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No MCP servers found</h3>
          <p className="text-foreground-secondary mb-4">
            Try adjusting your search terms or category filter.
          </p>
          {searchQuery && (
            <Button variant="secondary" onClick={() => setSearchQuery('')}>
              Clear search
            </Button>
          )}
        </div>
      )}
    </div>
  )
}