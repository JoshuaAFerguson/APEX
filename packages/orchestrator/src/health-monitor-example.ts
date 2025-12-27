/**
 * Example usage of HealthMonitor class
 * This demonstrates how to integrate HealthMonitor with DaemonRunner
 */
import { HealthMonitor } from './health-monitor';
import { DaemonRunner } from './runner';

// Example 1: Basic usage for health monitoring
function basicHealthMonitorUsage() {
  const healthMonitor = new HealthMonitor();

  // Simulate health checks
  healthMonitor.performHealthCheck(true);  // Successful check
  healthMonitor.performHealthCheck(false); // Failed check
  healthMonitor.performHealthCheck(true);  // Successful check

  // Record some restart events
  healthMonitor.recordRestart('crash', 1, false);
  healthMonitor.recordRestart('oom', 137, false);
  healthMonitor.recordRestart('watchdog', undefined, true);

  // Get basic health report
  const report = healthMonitor.getHealthReport();
  console.log('Health Report:', {
    uptime: report.uptime,
    healthChecks: {
      passed: report.healthChecksPassed,
      failed: report.healthChecksFailed,
    },
    memory: report.memoryUsage,
    restarts: report.restartHistory.length,
  });
}

// Example 2: Integration with DaemonRunner
async function healthMonitorWithDaemonRunner() {
  const healthMonitor = new HealthMonitor({ maxRestartHistorySize: 20 });

  // Initialize DaemonRunner
  const daemonRunner = new DaemonRunner({
    projectPath: '/path/to/project',
    pollIntervalMs: 5000,
  });

  try {
    await daemonRunner.start();

    // Simulate periodic health checks
    setInterval(() => {
      try {
        // Perform health checks (e.g., check memory usage, connectivity)
        const metrics = daemonRunner.getMetrics();
        const isHealthy = metrics.isRunning && !metrics.isPaused;

        healthMonitor.performHealthCheck(isHealthy);

        // Get comprehensive health report with daemon metrics
        const healthReport = healthMonitor.getHealthReport(daemonRunner);

        // Log health status
        console.log('System Health:', {
          healthy: isHealthy,
          uptime: `${Math.floor(healthReport.uptime / 1000)}s`,
          tasksActive: healthReport.taskCounts.active,
          tasksProcessed: healthReport.taskCounts.processed,
          memoryUsedMB: Math.round(healthReport.memoryUsage.heapUsed / 1024 / 1024),
          recentRestarts: healthReport.restartHistory.length,
        });

        // Check for memory pressure
        const memoryUsageMB = healthReport.memoryUsage.heapUsed / 1024 / 1024;
        if (memoryUsageMB > 1000) { // 1GB threshold
          console.warn('High memory usage detected:', memoryUsageMB, 'MB');
        }

      } catch (error) {
        console.error('Health check failed:', error);
        healthMonitor.performHealthCheck(false);
      }
    }, 30000); // Check every 30 seconds

  } catch (error) {
    console.error('Failed to start daemon runner:', error);
    healthMonitor.recordRestart('startup-failure', 1, false);
  }
}

// Example 3: Health monitoring for API endpoints
function createHealthEndpoint(healthMonitor: HealthMonitor, daemonRunner?: DaemonRunner) {
  return {
    '/health': () => {
      const report = healthMonitor.getHealthReport(daemonRunner);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: report.uptime,
        memory: {
          heapUsedMB: Math.round(report.memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(report.memoryUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(report.memoryUsage.rss / 1024 / 1024),
        },
        tasks: report.taskCounts,
        healthChecks: {
          passed: report.healthChecksPassed,
          failed: report.healthChecksFailed,
          lastCheck: report.lastHealthCheck,
        },
        restarts: {
          total: report.restartHistory.length,
          hasWatchdogRestarts: healthMonitor.hasWatchdogRestarts(),
          recent: report.restartHistory.slice(0, 3), // Last 3 restarts
        },
      };
    },

    '/health/detailed': () => {
      return healthMonitor.getHealthReport(daemonRunner);
    },
  };
}

export {
  basicHealthMonitorUsage,
  healthMonitorWithDaemonRunner,
  createHealthEndpoint,
};