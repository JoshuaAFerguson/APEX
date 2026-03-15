/**
 * ProjectHealthPanel Component Examples
 *
 * This file demonstrates how to use the ProjectHealthPanel component
 * with various data scenarios as specified in the acceptance criteria.
 */

'use client'

import React, { useState } from 'react'
import { ProjectHealthPanel } from '../ProjectHealthPanel'
import {
  generateMockHealthMetrics,
  generateWarningMockMetrics,
  generateCriticalMockMetrics,
  type ProjectHealthMetrics,
} from '@/types/project-health'

/**
 * Example usage of ProjectHealthPanel component demonstrating:
 *
 * Acceptance Criteria:
 * - Displays project health status with visual indicators (healthy/warning/critical) ✓
 * - Shows metrics like success rate, average duration, and system health ✓
 * - Component renders correctly with mock data and real API data ✓
 */
export function ProjectHealthPanelExamples() {
  const [currentScenario, setCurrentScenario] = useState<'healthy' | 'warning' | 'critical' | 'loading' | 'error'>('healthy')
  const [showDetails, setShowDetails] = useState(false)
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h')

  // Example 1: Healthy system with mock data
  const healthyMetrics = generateMockHealthMetrics()

  // Example 2: Warning system with mock data
  const warningMetrics = generateWarningMockMetrics()

  // Example 3: Critical system with mock data
  const criticalMetrics = generateCriticalMockMetrics()

  // Example 4: Simulated real API data
  const realApiData: ProjectHealthMetrics = {
    status: 'healthy',
    successRate: 97.2,
    averageDurationMs: 1850,
    systemHealth: 94.5,
    tasks: {
      activeTasks: 2,
      pendingTasks: 8,
      completedTasks: 156,
      failedTasks: 3,
    },
    connection: {
      isConnected: true,
      latencyMs: 32,
      averageLatencyMs: 45,
      reconnectAttempts: 0,
      connectedSince: new Date(Date.now() - 7200000), // 2 hours ago
    },
    lastUpdated: new Date(),
  }

  const handleRefresh = () => {
    console.log('Refreshing health metrics...')
    // In a real app, this would trigger an API call
  }

  const handleStatusChange = (status: string) => {
    console.log('Health status changed to:', status)
    // In a real app, this could trigger notifications or alerts
  }

  const getCurrentMetrics = () => {
    switch (currentScenario) {
      case 'healthy':
        return healthyMetrics
      case 'warning':
        return warningMetrics
      case 'critical':
        return criticalMetrics
      case 'loading':
        return undefined
      case 'error':
        return undefined
      default:
        return healthyMetrics
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          ProjectHealthPanel Component Examples
        </h1>
        <p className="text-foreground-secondary">
          Demonstrating health status visualization with visual indicators and metrics
        </p>
      </div>

      {/* Controls */}
      <div className="bg-background-tertiary p-4 rounded-lg space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Demo Controls</h2>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Scenario:</label>
            <select
              value={currentScenario}
              onChange={(e) => setCurrentScenario(e.target.value as any)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="healthy">Healthy System</option>
              <option value="warning">Warning System</option>
              <option value="critical">Critical System</option>
              <option value="loading">Loading State</option>
              <option value="error">Error State</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Show Details:</label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
                className="mr-2"
              />
              <span className="text-foreground">Task Breakdown</span>
            </label>
          </div>
        </div>
      </div>

      {/* Main Component Demo */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Current Scenario: {currentScenario.charAt(0).toUpperCase() + currentScenario.slice(1)}
        </h2>

        <ProjectHealthPanel
          metrics={getCurrentMetrics()}
          isLoading={currentScenario === 'loading'}
          error={currentScenario === 'error' ? new Error('Failed to fetch health data from API') : null}
          timeRange={timeRange}
          showDetails={showDetails}
          showConnectionStatus={true}
          onRefresh={handleRefresh}
          onStatusChange={handleStatusChange}
        />
      </div>

      {/* Static Examples */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-foreground">Static Examples</h2>

        <div className="grid gap-6 lg:grid-cols-1">
          {/* Example 1: Healthy System */}
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Example 1: Healthy System (Mock Data)</h3>
            <ProjectHealthPanel
              metrics={healthyMetrics}
              timeRange="1h"
              showDetails={false}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Example 2: Warning System */}
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Example 2: Warning System (Mock Data)</h3>
            <ProjectHealthPanel
              metrics={warningMetrics}
              timeRange="6h"
              showDetails={true}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Example 3: Critical System */}
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Example 3: Critical System (Mock Data)</h3>
            <ProjectHealthPanel
              metrics={criticalMetrics}
              timeRange="24h"
              showDetails={false}
              onRefresh={handleRefresh}
            />
          </div>

          {/* Example 4: Real API Data Structure */}
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">Example 4: Real API Data Structure</h3>
            <ProjectHealthPanel
              metrics={realApiData}
              timeRange="1h"
              showDetails={true}
              showConnectionStatus={true}
              onRefresh={handleRefresh}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </div>

      {/* Usage Code Examples */}
      <div className="bg-background-tertiary p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-4">Usage Examples</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-2">Basic Usage with Mock Data:</h4>
            <pre className="bg-background p-3 rounded border text-foreground-secondary overflow-x-auto">
{`import { ProjectHealthPanel, generateMockHealthMetrics } from '@/components/dashboard';

function MyDashboard() {
  const metrics = generateMockHealthMetrics();
  return <ProjectHealthPanel metrics={metrics} />;
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">With Real-time Data:</h4>
            <pre className="bg-background p-3 rounded border text-foreground-secondary overflow-x-auto">
{`import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates';
import { ProjectHealthPanel } from '@/components/dashboard';

function DashboardWithRealData() {
  const { state } = useRealtimeUpdates({ includeHealth: true });

  return (
    <ProjectHealthPanel
      metrics={transformHealthMetrics(state.health)}
      isLoading={state.isConnecting}
      error={state.error}
      onRefresh={() => state.reconnect()}
    />
  );
}`}
            </pre>
          </div>

          <div>
            <h4 className="font-medium text-foreground mb-2">Full Featured Example:</h4>
            <pre className="bg-background p-3 rounded border text-foreground-secondary overflow-x-auto">
{`<ProjectHealthPanel
  metrics={healthMetrics}
  timeRange="24h"
  showDetails={true}
  showConnectionStatus={true}
  onRefresh={handleRefresh}
  onStatusChange={(status) => console.log('Status:', status)}
  thresholds={{
    successRateWarning: 95,
    successRateCritical: 80,
  }}
/>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectHealthPanelExamples