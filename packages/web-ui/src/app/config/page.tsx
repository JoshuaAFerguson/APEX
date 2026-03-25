'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import { getApiUrl, setApiUrl, clearApiUrl } from '@/lib/config'

type ConfigValue = string | number | boolean | string[] | Record<string, unknown> | null | undefined

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'tags'
  options?: string[]
  placeholder?: string
  description?: string
}

interface SectionDef {
  title: string
  path: string
  fields: FieldDef[]
}

const CONFIG_SECTIONS: SectionDef[] = [
  {
    title: 'Project',
    path: 'project',
    fields: [
      { key: 'name', label: 'Project Name', type: 'text', placeholder: 'my-project' },
      { key: 'testCommand', label: 'Test Command', type: 'text', placeholder: 'npm test' },
      { key: 'lintCommand', label: 'Lint Command', type: 'text', placeholder: 'npm run lint' },
      { key: 'buildCommand', label: 'Build Command', type: 'text', placeholder: 'npm run build' },
      { key: 'typecheckCommand', label: 'Typecheck Command', type: 'text', placeholder: 'npm run typecheck' },
    ],
  },
  {
    title: 'Autonomy',
    path: 'autonomy',
    fields: [
      { key: 'level', label: 'Autonomy Level', type: 'select', options: ['full-auto', 'review-before-commit', 'review-all'] },
      { key: 'rejectionBehavior', label: 'Rejection Behavior', type: 'select', options: ['abort', 'retry', 'skip'] },
    ],
  },
  // Agents section is rendered separately with dynamic agent list

  {
    title: 'Models',
    path: 'models',
    fields: [
      { key: 'planning', label: 'Planning Model', type: 'select', options: ['opus', 'sonnet', 'haiku'] },
      { key: 'implementation', label: 'Implementation Model', type: 'select', options: ['opus', 'sonnet', 'haiku'] },
      { key: 'review', label: 'Review Model', type: 'select', options: ['opus', 'sonnet', 'haiku'] },
    ],
  },
  {
    title: 'Providers',
    path: 'providers',
    fields: [
      { key: 'primary', label: 'Primary Provider', type: 'select', options: ['anthropic', 'openai', 'gemini', 'agnostic'] },
    ],
  },
  {
    title: 'Git',
    path: 'git',
    fields: [
      { key: 'branchPrefix', label: 'Branch Prefix', type: 'text', placeholder: 'apex/' },
      { key: 'commitFormat', label: 'Commit Format', type: 'select', options: ['conventional', 'simple'] },
      { key: 'defaultBranch', label: 'Default Branch', type: 'text', placeholder: 'main' },
      { key: 'autoPush', label: 'Auto Push', type: 'boolean' },
      { key: 'commitAfterSubtask', label: 'Commit After Subtask', type: 'boolean' },
      { key: 'pushAfterTask', label: 'Push After Task', type: 'boolean' },
      { key: 'createPR', label: 'Create PR', type: 'select', options: ['always', 'never', 'ask'] },
      { key: 'prDraft', label: 'Draft PRs', type: 'boolean' },
      { key: 'autoWorktree', label: 'Auto Worktree', type: 'boolean' },
    ],
  },
  {
    title: 'Limits',
    path: 'limits',
    fields: [
      { key: 'maxTokensPerTask', label: 'Max Tokens per Task', type: 'number', placeholder: '5000000' },
      { key: 'maxCostPerTask', label: 'Max Cost per Task ($)', type: 'number', placeholder: '25' },
      { key: 'maxExecutionTime', label: 'Max Execution Time (ms)', type: 'number', placeholder: '0', description: '0 = unlimited' },
      { key: 'maxFileChanges', label: 'Max File Changes', type: 'number', placeholder: '0', description: '0 = unlimited' },
      { key: 'dailyBudget', label: 'Daily Budget ($)', type: 'number', placeholder: '1000' },
      { key: 'maxTurns', label: 'Max Turns', type: 'number', placeholder: '1000' },
      { key: 'maxConcurrentTasks', label: 'Max Concurrent Tasks', type: 'number', placeholder: '3' },
      { key: 'maxRetries', label: 'Max Retries', type: 'number', placeholder: '20' },
      { key: 'retryDelayMs', label: 'Retry Delay (ms)', type: 'number', placeholder: '100000' },
      { key: 'retryBackoffFactor', label: 'Retry Backoff Factor', type: 'number', placeholder: '2' },
    ],
  },
  {
    title: 'API Server',
    path: 'api',
    fields: [
      { key: 'url', label: 'API URL', type: 'text', placeholder: 'http://localhost:4000' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '4000' },
      { key: 'autoStart', label: 'Auto Start', type: 'boolean' },
    ],
  },
  {
    title: 'Web UI',
    path: 'webUI',
    fields: [
      { key: 'port', label: 'Port', type: 'number', placeholder: '4001' },
      { key: 'autoStart', label: 'Auto Start', type: 'boolean' },
    ],
  },
  {
    title: 'Daemon',
    path: 'daemon',
    fields: [
      { key: 'pollInterval', label: 'Poll Interval (ms)', type: 'number', placeholder: '5000' },
      { key: 'autoStart', label: 'Auto Start', type: 'boolean' },
      { key: 'logLevel', label: 'Log Level', type: 'select', options: ['debug', 'info', 'warn', 'error'] },
      { key: 'installAsService', label: 'Install as Service', type: 'boolean' },
      { key: 'serviceName', label: 'Service Name', type: 'text', placeholder: 'apex-daemon' },
    ],
  },
  {
    title: 'Slack Integration',
    path: 'slack',
    fields: [
      { key: 'enabled', label: 'Enabled', type: 'boolean' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['socket', 'webhook'] },
      { key: 'defaultChannel', label: 'Default Channel', type: 'text', placeholder: '#apex' },
      { key: 'threadUpdates', label: 'Thread Updates', type: 'boolean' },
      { key: 'useBlocks', label: 'Use Block Kit', type: 'boolean' },
    ],
  },
  {
    title: 'Permissions',
    path: 'permissions',
    fields: [
      { key: 'preset', label: 'Preset', type: 'select', options: ['autonomous', 'standard', 'read-only', 'admin'] },
    ],
  },
]

function getNestedValue(obj: Record<string, unknown>, path: string, key: string): ConfigValue {
  const section = obj[path] as Record<string, unknown> | undefined
  if (!section) return undefined
  return section[key] as ConfigValue
}

function setNestedValue(obj: Record<string, unknown>, path: string, key: string, value: ConfigValue): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(obj))
  if (!clone[path]) clone[path] = {}
  ;(clone[path] as Record<string, unknown>)[key] = value
  return clone
}

function ConfigField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: ConfigValue
  onChange: (value: ConfigValue) => void
}) {
  const baseClass = 'w-full bg-background-tertiary px-3 py-2 rounded border border-border focus:border-apex-500 outline-none text-sm'

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-border accent-apex-600"
        />
        <span className="text-sm text-foreground">{field.label}</span>
      </label>
    )
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="text-sm text-foreground-secondary block mb-1">{field.label}</label>
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={baseClass}
        >
          <option value="">— not set —</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'tags') {
    const tags = Array.isArray(value) ? value : []
    return (
      <div>
        <label className="text-sm text-foreground-secondary block mb-1">{field.label}</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className="text-xs bg-apex-600/20 text-apex-400 px-2 py-1 rounded flex items-center gap-1">
              {tag}
              <button
                onClick={() => onChange(tags.filter((_, j) => j !== i))}
                className="hover:text-red-400 ml-1"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder={field.placeholder}
          className={baseClass}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
              onChange([...tags, e.currentTarget.value.trim()])
              e.currentTarget.value = ''
              e.preventDefault()
            }
          }}
        />
        <p className="text-xs text-foreground-secondary mt-1">Press Enter to add</p>
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div>
        <label className="text-sm text-foreground-secondary block mb-1">{field.label}</label>
        <input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={field.placeholder}
          className={baseClass}
        />
        {field.description && <p className="text-xs text-foreground-secondary mt-1">{field.description}</p>}
      </div>
    )
  }

  return (
    <div>
      <label className="text-sm text-foreground-secondary block mb-1">{field.label}</label>
      <input
        type="text"
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.placeholder}
        className={baseClass}
      />
      {field.description && <p className="text-xs text-foreground-secondary mt-1">{field.description}</p>}
    </div>
  )
}

export default function ConfigPage() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [originalConfig, setOriginalConfig] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [rawExpanded, setRawExpanded] = useState(false)
  const [allAgents, setAllAgents] = useState<Array<{ name: string; role?: string; description?: string }>>([])
  const [currentApiUrl, setCurrentApiUrl] = useState('')
  const [newApiUrl, setNewApiUrl] = useState('')

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getConfig()
      const configData = response as Record<string, unknown>
      setConfig(configData)
      setOriginalConfig(JSON.stringify(configData))
      // Fetch all available agents
      try {
        const agentsResp = await fetch(`${getApiUrl()}/agents`)
        if (agentsResp.ok) {
          const agents = await agentsResp.json()
          setAllAgents(Array.isArray(agents) ? agents : [])
        }
      } catch { /* agents list is optional */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setCurrentApiUrl(getApiUrl())
    setNewApiUrl(getApiUrl())
    loadConfig()
  }, [loadConfig])

  const hasChanges = config && JSON.stringify(config) !== originalConfig

  async function handleSave() {
    if (!config) return
    try {
      setSaving(true)
      setSaveMessage(null)
      // POST the config to the API
      const response = await fetch(`${getApiUrl()}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: 'Save failed' }))
        throw new Error(err.message || `HTTP ${response.status}`)
      }
      setOriginalConfig(JSON.stringify(config))
      setSaveMessage('Configuration saved successfully')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      setSaveMessage(`Error: ${err instanceof Error ? err.message : 'Save failed'}`)
    } finally {
      setSaving(false)
    }
  }

  function handleFieldChange(sectionPath: string, fieldKey: string, value: ConfigValue) {
    if (!config) return
    setConfig(setNestedValue(config, sectionPath, fieldKey, value))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="mb-6">
          <CardHeader><h2 className="font-semibold">API Connection</h2></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-foreground-secondary block mb-1">API URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiUrl}
                    onChange={(e) => setNewApiUrl(e.target.value)}
                    className="flex-1 bg-background-tertiary px-3 py-2 rounded border border-border focus:border-apex-500 outline-none"
                  />
                  <Button onClick={() => { setApiUrl(newApiUrl) }} disabled={newApiUrl === currentApiUrl}>Update</Button>
                  <Button variant="secondary" onClick={() => clearApiUrl()}>Reset</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={loadConfig}>Retry</Button>
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
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.startsWith('Error') ? 'text-red-500' : 'text-green-500'}`}>
              {saveMessage}
            </span>
          )}
          <Button onClick={loadConfig} variant="secondary">Refresh</Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* API Connection */}
      <Card className="mb-6">
        <CardHeader><h2 className="font-semibold">API Connection</h2></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="font-mono text-sm bg-background-tertiary px-3 py-2 rounded flex-1">
              {currentApiUrl}
            </div>
            <span className="text-green-500 text-sm">Connected</span>
          </div>
        </CardContent>
      </Card>

      {/* Agents Section */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold">Agents ({allAgents.length} available)</h2>
        </CardHeader>
        <CardContent>
          {allAgents.length === 0 ? (
            <p className="text-sm text-foreground-secondary">Loading agents...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAgents.map((agent) => {
                const enabledAgents = ((config?.agents as Record<string, unknown>)?.enabled as string[]) || []
                const isEnabled = enabledAgents.includes(agent.name)
                return (
                  <label
                    key={agent.name}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isEnabled
                        ? 'border-apex-600 bg-apex-600/10'
                        : 'border-border bg-background-tertiary hover:border-foreground-secondary'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => {
                        const current = [...enabledAgents]
                        if (isEnabled) {
                          handleFieldChange('agents', 'enabled', current.filter(a => a !== agent.name))
                        } else {
                          handleFieldChange('agents', 'enabled', [...current, agent.name])
                        }
                      }}
                      className="mt-1 w-4 h-4 rounded border-border accent-apex-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm capitalize">{agent.name}</div>
                      {agent.role && (
                        <div className="text-xs text-foreground-secondary truncate">{agent.role}</div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CONFIG_SECTIONS.map((section) => (
          <Card key={section.path}>
            <CardHeader>
              <h2 className="font-semibold">{section.title}</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <ConfigField
                    key={field.key}
                    field={field}
                    value={getNestedValue(config, section.path, field.key)}
                    onChange={(value) => handleFieldChange(section.path, field.key, value)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Raw Configuration — collapsed by default */}
      <Card className="mt-6">
        <CardHeader>
          <button
            onClick={() => setRawExpanded(!rawExpanded)}
            className="flex items-center gap-2 font-semibold w-full text-left"
          >
            <span className={`transition-transform ${rawExpanded ? 'rotate-90' : ''}`}>&#9654;</span>
            Raw Configuration (YAML)
          </button>
        </CardHeader>
        {rawExpanded && (
          <CardContent>
            <pre className="bg-background-tertiary p-4 rounded-lg overflow-x-auto text-sm max-h-96 overflow-y-auto">
              {JSON.stringify(config, null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
