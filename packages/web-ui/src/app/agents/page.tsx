'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { apiClient } from '@/lib/api-client'
import type { AgentDefinition } from '@apexcli/core'

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  async function loadAgents() {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.listAgents() as
        | AgentDefinition[]
        | { agents: Record<string, AgentDefinition> }
      // API returns { agents: Record<string, AgentDefinition> }
      // Convert to array
      let agentsArray: AgentDefinition[]
      if (Array.isArray(response)) {
        agentsArray = response
      } else if (response && typeof response === 'object' && 'agents' in response) {
        agentsArray = Object.values(response.agents)
      } else {
        agentsArray = Object.values(response as Record<string, AgentDefinition>)
      }
      setAgents(agentsArray)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
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

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <p className="text-foreground-secondary text-sm mb-4">
                Make sure the APEX API server is running:
              </p>
              <code className="bg-background-tertiary px-3 py-1 rounded text-sm">
                apex serve --port 3002
              </code>
              <div className="mt-4">
                <Button onClick={loadAgents}>Retry</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const modelColors: Record<string, 'default' | 'info' | 'warning'> = {
    opus: 'warning',
    sonnet: 'info',
    haiku: 'default',
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agents</h1>
        <Button onClick={loadAgents}>Refresh</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <Card key={agent.name}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <h3 className="font-medium capitalize">{agent.name}</h3>
                <Badge variant={modelColors[agent.model] || 'default'}>
                  {agent.model}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground-secondary mb-3">
                {agent.description}
              </p>
              {agent.tools && agent.tools.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="text-xs bg-background-tertiary px-2 py-1 rounded"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
