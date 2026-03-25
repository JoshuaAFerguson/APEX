'use client'

import { Card } from '@/components/ui/Card'

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
      <p className="text-foreground-secondary">
        Task statistics, cost reports, and performance metrics.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-foreground-secondary mb-2">Coming in v0.7.1</h3>
          <p className="text-foreground-secondary text-sm">
            Daily reports, weekly digests, JSONL export, task statistics,
            cost reports, and custom report builder.
          </p>
        </Card>
      </div>
    </div>
  )
}
