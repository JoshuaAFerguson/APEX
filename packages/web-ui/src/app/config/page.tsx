'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { formatCost } from '@/lib/utils'
import { getApiUrl, setApiUrl, clearApiUrl } from '@/lib/config'

// Use a more flexible type to match actual API response
interface ConfigResponse {
  version?: string
  project?: {
    name?: string
    language?: string
    framework?: string
    testCommand?: string
    lintCommand?: string
    buildCommand?: string
  }
  autonomy?: {
    default?: string
  }
  agents?: {
    enabled?: string[]
  }
  models?: {
    planning?: string
    implementation?: string
    review?: string
  }
  git?: {
    branchPrefix?: string
    commitFormat?: string
    autoPush?: boolean
    defaultBranch?: string
  }
  limits?: {
    maxTokensPerTask?: number
    maxCostPerTask?: number
    dailyBudget?: number
    maxTurns?: number
    maxConcurrentTasks?: number
    maxRetries?: number
  }
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentApiUrl, setCurrentApiUrl] = useState('')
  const [newApiUrl, setNewApiUrl] = useState('')

  useEffect(() => {
    // Get current API URL on mount
    setCurrentApiUrl(getApiUrl())
    setNewApiUrl(getApiUrl())
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getConfig()
      setConfig(response as ConfigResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  function handleApiUrlChange() {
    if (newApiUrl && newApiUrl !== currentApiUrl) {
      setApiUrl(newApiUrl)
      // Page will reload automatically
    }
  }

  function handleResetApiUrl() {
    clearApiUrl()
    // Page will reload automatically
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold">API Connection</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-foreground-secondary block mb-1">
                  Current API URL
                </label>
                <div className="font-mono text-sm bg-background-tertiary px-3 py-2 rounded">
                  {currentApiUrl}
                </div>
              </div>
              <div>
                <label className="text-sm text-foreground-secondary block mb-1">
                  Change API URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiUrl}
                    onChange={(e) => setNewApiUrl(e.target.value)}
                    className="flex-1 bg-background-tertiary px-3 py-2 rounded border border-border focus:border-apex-500 outline-none"
                    placeholder="http://localhost:3000"
                  />
                  <Button onClick={handleApiUrlChange} disabled={newApiUrl === currentApiUrl}>
                    Update
                  </Button>
                  <Button variant="secondary" onClick={handleResetApiUrl}>
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <p className="text-foreground-secondary text-sm mb-4">
                Make sure the APEX API server is running. Update the API URL above if needed.
              </p>
              <code className="bg-background-tertiary px-3 py-1 rounded text-sm">
                apex serve
              </code>
              <div className="mt-4">
                <Button onClick={loadConfig}>Retry</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Configuration</h1>
        <Button onClick={loadConfig}>Refresh</Button>
      </div>

      {/* API Connection Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold">API Connection</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-foreground-secondary block mb-1">
                Current API URL
              </label>
              <div className="flex items-center gap-2">
                <div className="font-mono text-sm bg-background-tertiary px-3 py-2 rounded flex-1">
                  {currentApiUrl}
                </div>
                <span className="text-green-500 text-sm">Connected</span>
              </div>
            </div>
            <div>
              <label className="text-sm text-foreground-secondary block mb-1">
                Change API URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newApiUrl}
                  onChange={(e) => setNewApiUrl(e.target.value)}
                  className="flex-1 bg-background-tertiary px-3 py-2 rounded border border-border focus:border-apex-500 outline-none"
                  placeholder="http://localhost:3000"
                />
                <Button onClick={handleApiUrlChange} disabled={newApiUrl === currentApiUrl}>
                  Update
                </Button>
                <Button variant="secondary" onClick={handleResetApiUrl}>
                  Reset
                </Button>
              </div>
              <p className="text-xs text-foreground-secondary mt-1">
                Changing the URL will reload the page
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Info */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Project</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-foreground-secondary">Name</dt>
                <dd className="font-medium">{config.project?.name || 'N/A'}</dd>
              </div>
              {config.project?.language && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Language</dt>
                  <dd className="font-medium">{config.project.language}</dd>
                </div>
              )}
              {config.project?.framework && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Framework</dt>
                  <dd className="font-medium">{config.project.framework}</dd>
                </div>
              )}
              {config.project?.testCommand && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Test Command</dt>
                  <dd className="font-medium font-mono text-sm">{config.project.testCommand}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Limits */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Limits</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {config.limits?.maxCostPerTask !== undefined && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Max Cost per Task</dt>
                  <dd className="font-medium">{formatCost(config.limits.maxCostPerTask)}</dd>
                </div>
              )}
              {config.limits?.dailyBudget !== undefined && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Daily Budget</dt>
                  <dd className="font-medium">{formatCost(config.limits.dailyBudget)}</dd>
                </div>
              )}
              {config.limits?.maxTurns !== undefined && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Max Turns</dt>
                  <dd className="font-medium">{config.limits.maxTurns}</dd>
                </div>
              )}
              {config.limits?.maxConcurrentTasks !== undefined && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Max Concurrent Tasks</dt>
                  <dd className="font-medium">{config.limits.maxConcurrentTasks}</dd>
                </div>
              )}
              {config.limits?.maxTokensPerTask !== undefined && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Max Tokens per Task</dt>
                  <dd className="font-medium">{config.limits.maxTokensPerTask.toLocaleString()}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Git */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Git</h2>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {config.git?.branchPrefix && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Branch Prefix</dt>
                  <dd className="font-medium font-mono text-sm">{config.git.branchPrefix}</dd>
                </div>
              )}
              {config.git?.commitFormat && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Commit Format</dt>
                  <dd className="font-medium">{config.git.commitFormat}</dd>
                </div>
              )}
              {config.git?.defaultBranch && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Default Branch</dt>
                  <dd className="font-medium font-mono text-sm">{config.git.defaultBranch}</dd>
                </div>
              )}
              {config.git?.autoPush !== undefined && (
                <div>
                  <dt className="text-sm text-foreground-secondary">Auto Push</dt>
                  <dd className="font-medium">{config.git.autoPush ? 'Yes' : 'No'}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Models */}
        {config.models && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Models</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {config.models.planning && (
                  <div>
                    <dt className="text-sm text-foreground-secondary">Planning</dt>
                    <dd className="font-medium">{config.models.planning}</dd>
                  </div>
                )}
                {config.models.implementation && (
                  <div>
                    <dt className="text-sm text-foreground-secondary">Implementation</dt>
                    <dd className="font-medium">{config.models.implementation}</dd>
                  </div>
                )}
                {config.models.review && (
                  <div>
                    <dt className="text-sm text-foreground-secondary">Review</dt>
                    <dd className="font-medium">{config.models.review}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Autonomy */}
        {config.autonomy && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Autonomy</h2>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-foreground-secondary">Default Level</dt>
                  <dd className="font-medium">{config.autonomy.default || 'N/A'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Enabled Agents */}
        {config.agents?.enabled && config.agents.enabled.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Enabled Agents</h2>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {config.agents.enabled.map((agent) => (
                  <span
                    key={agent}
                    className="text-sm bg-background-tertiary px-3 py-1 rounded capitalize"
                  >
                    {agent}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Raw JSON */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold">Raw Configuration</h2>
        </CardHeader>
        <CardContent>
          <pre className="bg-background-tertiary p-4 rounded-lg overflow-x-auto text-sm">
            {JSON.stringify(config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
