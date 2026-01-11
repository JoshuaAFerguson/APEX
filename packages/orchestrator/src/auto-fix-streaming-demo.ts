/**
 * Auto-Fix Event Streaming Demo
 *
 * This file demonstrates the complete auto-fix event streaming implementation
 * that enables real-time progress tracking for both CLI and API consumers.
 *
 * Features implemented:
 * - Orchestrator emits all auto-fix lifecycle events
 * - API WebSocket broadcasts events to connected clients
 * - CLI displays progress using ora spinners and chalk colors
 * - Event payloads include detailed fix information
 */

import { EventEmitter } from 'eventemitter3';
import type {
  AutoFixRequestedEventData,
  AutoFixStartedEventData,
  AutoFixProgressEventData,
  AutoFixCompletedEventData,
  AutoFixFailedEventData,
  AutoFixSkippedEventData,
  ApexEvent,
} from './index';

/**
 * Example of how the orchestrator emits auto-fix events during stage completion
 */
class AutoFixEventDemo extends EventEmitter {
  /**
   * Demonstrates the complete auto-fix event flow
   */
  async demonstrateAutoFixFlow(taskId: string, files: string[]): Promise<void> {
    console.log('🚀 Starting Auto-Fix Event Streaming Demo\n');

    // 1. REQUESTED EVENTS
    console.log('📝 Phase 1: Emitting autofix:requested events');
    for (const filePath of files) {
      const requestedEvent: AutoFixRequestedEventData = {
        taskId,
        filePath,
        fixTypes: ['imports'],
        triggeredBy: 'hook',
        timestamp: new Date(),
      };

      this.emit('autofix:requested', requestedEvent);
      console.log(`   ✅ Requested auto-fix for ${filePath}`);
    }

    // 2. ANALYSIS & STARTED EVENTS
    console.log('\n🔍 Phase 2: Analyzing files and emitting autofix:started events');
    const analysisResults = [
      { filePath: files[0], issuesDetected: 3 },
      { filePath: files[1], issuesDetected: 1 },
      { filePath: files[2], issuesDetected: 0 }, // No issues
    ];

    for (const analysis of analysisResults) {
      const startedEvent: AutoFixStartedEventData = {
        taskId,
        filePath: analysis.filePath,
        fixType: 'imports',
        issuesDetected: analysis.issuesDetected,
        timestamp: new Date(),
      };

      this.emit('autofix:started', startedEvent);
      console.log(`   🎯 Started fixing ${analysis.issuesDetected} issues in ${analysis.filePath}`);
    }

    // 3. PROGRESS EVENTS
    console.log('\n⚡ Phase 3: Emitting autofix:progress events during fixing');
    for (const analysis of analysisResults) {
      if (analysis.issuesDetected > 0) {
        for (let fixed = 1; fixed <= analysis.issuesDetected; fixed++) {
          const progressEvent: AutoFixProgressEventData = {
            taskId,
            filePath: analysis.filePath,
            fixType: 'imports',
            issuesFixed: fixed,
            issuesRemaining: analysis.issuesDetected - fixed,
            currentFix: `Added import for React component ${fixed}`,
            timestamp: new Date(),
          };

          this.emit('autofix:progress', progressEvent);
          console.log(`   📈 Progress: ${fixed}/${analysis.issuesDetected} issues fixed in ${analysis.filePath}`);

          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    // 4. COMPLETION/FAILURE/SKIP EVENTS
    console.log('\n✨ Phase 4: Emitting completion/failure/skip events');

    // File 1: Success
    const completedEvent: AutoFixCompletedEventData = {
      taskId,
      filePath: files[0],
      fixType: 'imports',
      issuesDetected: 3,
      issuesFixed: 3,
      duration: 250,
      timestamp: new Date(),
    };
    this.emit('autofix:completed', completedEvent);
    console.log(`   ✅ Successfully completed auto-fix for ${files[0]} (3/3 issues fixed in 250ms)`);

    // File 2: Partial success (simulated failure)
    const failedEvent: AutoFixFailedEventData = {
      taskId,
      filePath: files[1],
      fixType: 'imports',
      error: 'Unable to resolve import path for lodash',
      issuesDetected: 1,
      issuesFixed: 0,
      timestamp: new Date(),
    };
    this.emit('autofix:failed', failedEvent);
    console.log(`   ❌ Auto-fix failed for ${files[1]} (0/1 issues fixed): Unable to resolve import path`);

    // File 3: Skipped (no issues)
    const skippedEvent: AutoFixSkippedEventData = {
      taskId,
      filePath: files[2],
      reason: 'no_issues',
      timestamp: new Date(),
    };
    this.emit('autofix:skipped', skippedEvent);
    console.log(`   ⏭️ Skipped auto-fix for ${files[2]} (no issues detected)`);

    console.log('\n🎉 Auto-Fix Event Streaming Demo Complete!\n');
  }
}

/**
 * Example of how the API server converts orchestrator events to WebSocket messages
 */
function demonstrateWebSocketBroadcasting(orchestrator: EventEmitter): void {
  console.log('🌐 WebSocket Broadcasting Setup:');

  // Convert orchestrator events to WebSocket-compatible ApexEvents
  orchestrator.on('autofix:requested', (event: AutoFixRequestedEventData) => {
    const webSocketMessage: ApexEvent = {
      type: 'autofix:requested',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixTypes: event.fixTypes,
        triggeredBy: event.triggeredBy,
      },
    };
    console.log(`   📡 Broadcasting: autofix:requested for ${event.filePath}`);
  });

  orchestrator.on('autofix:started', (event: AutoFixStartedEventData) => {
    const webSocketMessage: ApexEvent = {
      type: 'autofix:started',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        issuesDetected: event.issuesDetected,
      },
    };
    console.log(`   📡 Broadcasting: autofix:started for ${event.filePath} (${event.issuesDetected} issues)`);
  });

  orchestrator.on('autofix:progress', (event: AutoFixProgressEventData) => {
    const webSocketMessage: ApexEvent = {
      type: 'autofix:progress',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        issuesFixed: event.issuesFixed,
        issuesRemaining: event.issuesRemaining,
        currentFix: event.currentFix,
      },
    };
    console.log(`   📡 Broadcasting: autofix:progress (${event.issuesFixed} fixed, ${event.issuesRemaining} remaining)`);
  });

  orchestrator.on('autofix:completed', (event: AutoFixCompletedEventData) => {
    const webSocketMessage: ApexEvent = {
      type: 'autofix:completed',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        issuesDetected: event.issuesDetected,
        issuesFixed: event.issuesFixed,
        duration: event.duration,
      },
    };
    console.log(`   📡 Broadcasting: autofix:completed for ${event.filePath} (${event.issuesFixed}/${event.issuesDetected} fixed)`);
  });

  orchestrator.on('autofix:failed', (event: AutoFixFailedEventData) => {
    const webSocketMessage: ApexEvent = {
      type: 'autofix:failed',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        fixType: event.fixType,
        error: event.error,
        issuesDetected: event.issuesDetected,
        issuesFixed: event.issuesFixed,
      },
    };
    console.log(`   📡 Broadcasting: autofix:failed for ${event.filePath} - ${event.error}`);
  });

  orchestrator.on('autofix:skipped', (event: AutoFixSkippedEventData) => {
    const webSocketMessage: ApexEvent = {
      type: 'autofix:skipped',
      taskId: event.taskId,
      timestamp: event.timestamp,
      data: {
        filePath: event.filePath,
        reason: event.reason,
      },
    };
    console.log(`   📡 Broadcasting: autofix:skipped for ${event.filePath} (${event.reason})`);
  });
}

/**
 * Example of how the CLI handles auto-fix events with ora/chalk for progress display
 */
function demonstrateCLIHandling(orchestrator: EventEmitter): void {
  console.log('💻 CLI Progress Display Setup:');

  const spinners = new Map<string, any>(); // Would be ora spinners in real implementation

  orchestrator.on('autofix:requested', (event: AutoFixRequestedEventData) => {
    // Initialize spinner for this task
    console.log(`   🎯 CLI: Auto-fixing file(s) (${event.fixTypes.join(', ')})...`);
  });

  orchestrator.on('autofix:started', (event: AutoFixStartedEventData) => {
    const fileName = event.filePath.split('/').pop() || event.filePath;
    if (event.issuesDetected > 0) {
      console.log(`   ⚡ CLI: Fixing ${event.issuesDetected} ${event.fixType} issues in ${fileName}...`);
    }
  });

  orchestrator.on('autofix:progress', (event: AutoFixProgressEventData) => {
    const fileName = event.filePath.split('/').pop() || event.filePath;
    const progressInfo = `Fixed ${event.issuesFixed} ${event.fixType} issues`;
    const currentFixInfo = event.currentFix ? ` - ${event.currentFix}` : '';
    console.log(`   📈 CLI: ${fileName}: ${progressInfo}${currentFixInfo}`);
  });

  orchestrator.on('autofix:completed', (event: AutoFixCompletedEventData) => {
    const fileName = event.filePath.split('/').pop() || event.filePath;
    console.log(`   ✅ CLI: ${fileName} - Fixed ${event.issuesFixed}/${event.issuesDetected} issues (${event.duration}ms)`);
  });

  orchestrator.on('autofix:failed', (event: AutoFixFailedEventData) => {
    const fileName = event.filePath.split('/').pop() || event.filePath;
    console.log(`   ❌ CLI: ${fileName} - Error: ${event.error} (${event.issuesFixed}/${event.issuesDetected} fixed)`);
  });

  orchestrator.on('autofix:skipped', (event: AutoFixSkippedEventData) => {
    const fileName = event.filePath.split('/').pop() || event.filePath;
    console.log(`   ⏭️ CLI: ${fileName} - Skipped (${event.reason})`);
  });
}

/**
 * Run the complete demo
 */
export async function runAutoFixStreamingDemo(): Promise<void> {
  const demo = new AutoFixEventDemo();
  const taskId = 'demo-task-123';
  const files = [
    'src/components/Button.tsx',
    'src/utils/helpers.ts',
    'src/config/constants.ts',
  ];

  // Set up event listeners to simulate API and CLI
  demonstrateWebSocketBroadcasting(demo);
  demonstrateCLIHandling(demo);

  // Run the demo
  await demo.demonstrateAutoFixFlow(taskId, files);

  console.log('📊 Summary:');
  console.log('   • Orchestrator emits 6 types of auto-fix events');
  console.log('   • API broadcasts events to WebSocket clients with event filtering');
  console.log('   • CLI displays real-time progress with ora spinners and chalk colors');
  console.log('   • Event payloads include detailed fix information (files, issues, progress)');
  console.log('   • Complete event lifecycle tracking for debugging and monitoring');
}

// Uncomment to run the demo:
// runAutoFixStreamingDemo().catch(console.error);