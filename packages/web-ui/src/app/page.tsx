import { Header } from '@/components/layout'
import { Card, CardHeader, CardContent } from '@/components/ui'

export default function DashboardPage() {
  return (
    <div className="p-8">
      <Header
        title="Dashboard"
        description="Overview of your APEX project and recent activity"
      />

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Active Tasks</h3>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-apex-500">0</div>
            <p className="text-sm text-foreground-secondary mt-1">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Completed Tasks</h3>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">0</div>
            <p className="text-sm text-foreground-secondary mt-1">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Total Cost</h3>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">$0.00</div>
            <p className="text-sm text-foreground-secondary mt-1">
              Lifetime usage
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Activity</h3>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-foreground-secondary">
              No recent activity
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
