#!/usr/bin/env node

/**
 * Example usage of Docker events monitoring in ContainerManager
 *
 * This example demonstrates how to:
 * 1. Start Docker events monitoring
 * 2. Listen for container died events
 * 3. Filter for APEX-managed containers
 * 4. Handle cleanup when containers exit unexpectedly
 */

import { ContainerManager } from '../container-manager';
import { ContainerConfigSchema } from '../types';

async function main() {
  const containerManager = new ContainerManager();

  console.log('Starting Docker events monitoring example...\n');

  // Set up event listeners before starting monitoring
  containerManager.on('container:died', (event) => {
    console.log('🔴 Container died:', {
      containerId: event.containerId,
      taskId: event.taskId,
      exitCode: event.exitCode,
      signal: event.signal,
      oomKilled: event.oomKilled,
      timestamp: event.timestamp.toISOString()
    });

    if (event.oomKilled) {
      console.log('⚠️  Container was killed due to out of memory');
    }

    if (event.taskId) {
      console.log(`📋 Associated with task: ${event.taskId}`);
      // Here you could trigger task cleanup or retry logic
    }
  });

  containerManager.on('container:lifecycle', (event, operation) => {
    console.log(`📝 Container lifecycle event: ${operation} for ${event.containerId}`);
  });

  // Start monitoring with custom options
  try {
    await containerManager.startEventsMonitoring({
      namePrefix: 'apex',
      eventTypes: ['die', 'start', 'stop'], // Monitor container lifecycle events
      labelFilters: {
        'apex.managed': 'true' // Only monitor APEX-managed containers
      }
    });

    console.log('✅ Docker events monitoring started');
    console.log('Monitoring configuration:', containerManager.getMonitoringOptions());
    console.log('\nWaiting for container events... (Press Ctrl+C to stop)\n');

    // Example: Create and run a test container that will exit
    console.log('Creating example container for testing...');

    const testConfig = ContainerConfigSchema.parse({
      image: 'alpine:latest',
      command: ['sh', '-c', 'echo "Hello from APEX container"; sleep 2; exit 1'],
      autoRemove: true,
      labels: {
        'apex.managed': 'true',
        'apex.task.id': 'example-task-123'
      }
    });

    const result = await containerManager.createContainer({
      config: testConfig,
      taskId: 'example-task-123',
      autoStart: true
    });

    if (result.success) {
      console.log(`✅ Created test container: ${result.containerId}`);
      console.log('Container will exit after 2 seconds and trigger a "died" event\n');
    } else {
      console.log('❌ Failed to create test container:', result.error);
    }

  } catch (error) {
    console.error('❌ Failed to start Docker events monitoring:', error);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Stopping Docker events monitoring...');

    try {
      await containerManager.stopEventsMonitoring();
      console.log('✅ Docker events monitoring stopped');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error stopping monitoring:', error);
      process.exit(1);
    }
  });

  // Keep the process running
  setInterval(() => {
    if (containerManager.isEventsMonitoringActive()) {
      process.stdout.write('.');
    } else {
      console.log('\n⚠️  Monitoring stopped unexpectedly');
    }
  }, 5000);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Example failed:', error);
    process.exit(1);
  });
}

export { main };