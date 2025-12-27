import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { DaemonRunner, DaemonRunnerOptions } from './runner';
import { ServiceManager, ServiceManagerOptions } from './service-manager';
import { UsageManager } from './usage-manager';
import { SessionManager } from './session-manager';
import { WorkspaceManager } from './workspace-manager';
import { InteractionManager } from './interaction-manager';
import { IdleProcessor } from './idle-processor';
import { ThoughtCaptureManager } from './thought-capture';
import { TaskStore } from './store';
import { ApexOrchestrator, TasksAutoResumedEvent, TaskSessionResumedEvent } from './index';
import { CapacityMonitor, CapacityRestoredEvent } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { HealthMonitor } from './health-monitor';
import {
  DaemonConfig,
  DaemonConfigSchema,
  LimitsConfig,
  LimitsConfigSchema,
  ApexConfig,
  ApexConfigSchema,
  Task,
} from '@apexcli/core';

export interface EnhancedDaemonEvents {
  'daemon:started': () => void;
  'daemon:stopped': () => void;
  'daemon:error': (error: Error) => void;
  'service:installed': () => void;
  'service:uninstalled': () => void;
  'usage:mode-changed': (mode: string) => void;
  'session:recovered': (taskId: string) => void;
  'workspace:created': (taskId: string, workspacePath: string) => void;
  'workspace:cleaned': (taskId: string) => void;
  'idle:suggestion': (suggestion: any) => void;
  'thought:captured': (thought: any) => void;
  'interaction:received': (interaction: any) => void;

  // Capacity events forwarded from CapacityMonitor
  'capacity:restored': (event: CapacityRestoredEvent) => void;

  // Auto-resume event forwarded from orchestrator/DaemonRunner
  'tasks:auto-resumed': (event: TasksAutoResumedEvent) => void;

  // Task session resumed event forwarded from orchestrator
  'task:session-resumed': (event: TaskSessionResumedEvent) => void;
}

/**
 * Enhanced daemon with v0.4.0 "Sleepless Mode & Autonomy" features
 */
export class EnhancedDaemon extends EventEmitter<EnhancedDaemonEvents> {
  private daemonRunner!: DaemonRunner;
  private serviceManager!: ServiceManager;
  private usageManager!: UsageManager;
  private sessionManager!: SessionManager;
  private workspaceManager!: WorkspaceManager;
  private interactionManager!: InteractionManager;
  private idleProcessor!: IdleProcessor;
  private thoughtCapture!: ThoughtCaptureManager;
  private capacityMonitor!: CapacityMonitor;
  private healthMonitor!: HealthMonitor;

  private orchestrator: ApexOrchestrator;
  private store: TaskStore;
  private config: ApexConfig;
  private projectPath: string;

  private isRunning = false;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private watchdogEnabled = false;
  private restartCount = 0;
  private lastRestart = 0;

  constructor(projectPath: string, config?: ApexConfig) {
    super();
    this.projectPath = projectPath;
    this.config = config ?? this.loadConfigSync();

    // Initialize core components
    this.store = new TaskStore(projectPath);
    this.orchestrator = new ApexOrchestrator({
      projectPath,
    });

    // Initialize enhanced components
    this.initializeComponents();
    this.setupEventHandlers();
  }

  /**
   * Start the enhanced daemon
   */
  async start(): Promise<void> {
    try {
      // Initialize all components
      await this.store.initialize();
      await this.orchestrator.initialize();
      await this.sessionManager.initialize();
      await this.workspaceManager.initialize();
      await this.thoughtCapture.initialize();

      // Start daemon runner
      await this.daemonRunner.start();

      // Start idle processing
      await this.idleProcessor.start();

      // Start capacity monitoring
      this.capacityMonitor.start();

      // Setup health monitoring
      this.setupHealthMonitoring();

      // Setup watchdog if enabled
      this.setupWatchdog();

      this.isRunning = true;
      this.emit('daemon:started');

      console.log('🚀 Enhanced APEX Daemon started with v0.4.0 features');
      this.logFeatureStatus();

    } catch (error) {
      this.emit('daemon:error', error as Error);
      throw error;
    }
  }

  /**
   * Stop the enhanced daemon
   */
  async stop(): Promise<void> {
    try {
      this.isRunning = false;

      // Stop capacity monitoring
      this.capacityMonitor.stop();

      // Clear health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Stop daemon runner
      await this.daemonRunner.stop();

      // Cleanup workspaces if needed
      await this.cleanupOnStop();

      this.emit('daemon:stopped');
      console.log('🛑 Enhanced APEX Daemon stopped');

    } catch (error) {
      this.emit('daemon:error', error as Error);
      throw error;
    }
  }

  /**
   * Install daemon as system service
   */
  async installService(): Promise<void> {
    try {
      await this.serviceManager.installService();
      this.emit('service:installed');
      console.log('✅ APEX Daemon installed as system service');
    } catch (error) {
      console.error('❌ Failed to install service:', error);
      throw error;
    }
  }

  /**
   * Uninstall daemon service
   */
  async uninstallService(): Promise<void> {
    try {
      await this.serviceManager.uninstallService();
      this.emit('service:uninstalled');
      console.log('✅ APEX Daemon service uninstalled');
    } catch (error) {
      console.error('❌ Failed to uninstall service:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive daemon status
   */
  async getStatus(): Promise<{
    daemon: any;
    service: any;
    usage: any;
    workspaces: any;
    thoughts: any;
    health: any;
    capacity: any;
  }> {
    const [
      daemonMetrics,
      serviceStatus,
      usageStats,
      workspaceStats,
      thoughtStats,
      serviceHealthStatus,
    ] = await Promise.all([
      this.daemonRunner.getMetrics(),
      this.serviceManager.getServiceStatus(),
      this.usageManager.getUsageStats(),
      this.workspaceManager.getWorkspaceStats(),
      this.thoughtCapture.getThoughtStats(),
      this.serviceManager.performHealthCheck(),
    ]);

    // Get comprehensive health metrics from HealthMonitor
    const healthMetrics = this.healthMonitor.getHealthReport(this.daemonRunner);

    return {
      daemon: daemonMetrics,
      service: serviceStatus,
      usage: usageStats,
      workspaces: workspaceStats,
      thoughts: thoughtStats,
      health: {
        ...serviceHealthStatus,
        metrics: healthMetrics,
      },
      capacity: this.capacityMonitor.getStatus(),
    };
  }

  // ============================================================================
  // Component Initialization
  // ============================================================================

  private initializeComponents(): void {
    const daemonConfig = DaemonConfigSchema.parse(this.config.daemon ?? {});
    const limitsConfig = LimitsConfigSchema.parse(this.config.limits ?? {});

    // Initialize HealthMonitor first
    this.healthMonitor = new HealthMonitor();

    // Initialize daemon runner
    this.daemonRunner = new DaemonRunner({
      projectPath: this.projectPath,
      config: this.config,
      healthMonitor: this.healthMonitor,
    });

    // Initialize service manager
    this.serviceManager = new ServiceManager({
      projectPath: this.projectPath,
      serviceName: daemonConfig.serviceName,
      workingDirectory: this.projectPath,
      environment: {
        APEX_PROJECT_PATH: this.projectPath,
      },
    });

    // Initialize usage manager
    this.usageManager = new UsageManager(daemonConfig, limitsConfig);

    // Initialize session manager
    this.sessionManager = new SessionManager({
      projectPath: this.projectPath,
      config: daemonConfig,
    });

    // Initialize workspace manager
    this.workspaceManager = new WorkspaceManager({
      projectPath: this.projectPath,
      defaultStrategy: 'none', // Conservative default
    });

    // Initialize interaction manager
    this.interactionManager = new InteractionManager(this.store);

    // Initialize idle processor
    this.idleProcessor = new IdleProcessor(
      this.projectPath,
      daemonConfig,
      this.store
    );

    // Initialize thought capture
    this.thoughtCapture = new ThoughtCaptureManager(
      this.projectPath,
      this.store
    );

    // Initialize CapacityMonitor with UsageManager adapter
    const capacityUsageProvider = new CapacityMonitorUsageAdapter(
      this.usageManager,
      daemonConfig,
      limitsConfig
    );

    this.capacityMonitor = new CapacityMonitor(
      daemonConfig,
      limitsConfig,
      capacityUsageProvider
    );
  }

  private setupEventHandlers(): void {
    // Usage manager events
    this.usageManager.on?.('mode-changed', (mode) => {
      this.emit('usage:mode-changed', mode);
    });

    // Session manager events
    this.sessionManager.on?.('session-recovered', (taskId) => {
      this.emit('session:recovered', taskId);
    });

    // Workspace manager events
    this.workspaceManager.on?.('workspace-created', (taskId, path) => {
      this.emit('workspace:created', taskId, path);
    });

    this.workspaceManager.on?.('workspace-cleaned', (taskId) => {
      this.emit('workspace:cleaned', taskId);
    });

    // Idle processor events
    this.idleProcessor.on('task:suggested', (suggestion) => {
      this.emit('idle:suggestion', suggestion);
    });

    // Thought capture events
    this.thoughtCapture.on('thought:captured', (thought) => {
      this.emit('thought:captured', thought);
    });

    // Interaction manager events
    this.interactionManager.on('interaction:received', (interaction) => {
      this.emit('interaction:received', interaction);
    });

    // Orchestrator events for enhanced features
    this.orchestrator.on('task:created', async (task: Task) => {
      // Create workspace if needed
      if (task.workspace) {
        await this.workspaceManager.createWorkspace(task);
      }

      // Track task start for usage management
      this.usageManager.trackTaskStart(task.id);
    });

    this.orchestrator.on('task:completed', async (task: Task) => {
      // Track completion for usage management
      this.usageManager.trackTaskCompletion(task.id, task.usage, true);

      // Cleanup workspace
      await this.workspaceManager.cleanupWorkspace(task.id);
    });

    this.orchestrator.on('task:failed', async (task: Task) => {
      // Track failure for usage management
      this.usageManager.trackTaskCompletion(task.id, task.usage, false);

      // Optionally keep workspace for debugging
      if (!task.workspace?.cleanup) {
        await this.workspaceManager.cleanupWorkspace(task.id);
      }
    });

    // CapacityMonitor events
    this.capacityMonitor.on('capacity:restored', (event: CapacityRestoredEvent) => {
      this.emit('capacity:restored', event);
    });

    // Forward tasks:auto-resumed from orchestrator to EnhancedDaemon
    this.orchestrator.on('tasks:auto-resumed', (event: TasksAutoResumedEvent) => {
      this.emit('tasks:auto-resumed', event);
    });

    // Forward task:session-resumed from orchestrator to EnhancedDaemon
    this.orchestrator.on('task:session-resumed', (event: TaskSessionResumedEvent) => {
      this.emit('task:session-resumed', event);
    });
  }

  // ============================================================================
  // Health Monitoring & Watchdog
  // ============================================================================

  private setupHealthMonitoring(): void {
    const healthConfig = this.config.daemon?.healthCheck;

    if (!healthConfig?.enabled) {
      return;
    }

    const interval = healthConfig.interval || 30000; // 30 seconds

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.serviceManager.performHealthCheck();

        // Record health check result in HealthMonitor
        this.healthMonitor.performHealthCheck(health.healthy);

        if (!health.healthy) {
          console.warn('⚠️ Health check failed:', health.errors);

          if (this.watchdogEnabled && this.canRestart()) {
            console.log('🔄 Attempting restart due to health check failure...');
            await this.restartDaemon('health_check_failure');
          }
        }
      } catch (error) {
        console.error('❌ Health check error:', error);
        // Record failed health check
        this.healthMonitor.performHealthCheck(false);
      }
    }, interval);
  }

  private setupWatchdog(): void {
    const watchdogConfig = this.config.daemon?.watchdog;

    if (!watchdogConfig?.enabled) {
      return;
    }

    this.watchdogEnabled = true;

    // Monitor for daemon failures and restart if needed
    this.on('daemon:error', async (error) => {
      console.error('💥 Daemon error detected:', error);

      if (this.canRestart()) {
        const delay = watchdogConfig.restartDelay || 5000;
        console.log(`🔄 Restarting daemon in ${delay}ms...`);

        setTimeout(async () => {
          try {
            await this.restartDaemon('daemon_error');
          } catch (restartError) {
            console.error('❌ Failed to restart daemon:', restartError);
          }
        }, delay);
      } else {
        console.error('🛑 Maximum restart attempts reached. Manual intervention required.');
      }
    });
  }

  private canRestart(): boolean {
    const watchdogConfig = this.config.daemon?.watchdog;
    const maxRestarts = watchdogConfig?.maxRestarts || 5;
    const restartWindow = watchdogConfig?.restartWindow || 300000; // 5 minutes

    const now = Date.now();

    // Reset restart count if outside the window
    if (now - this.lastRestart > restartWindow) {
      this.restartCount = 0;
    }

    return this.restartCount < maxRestarts;
  }

  private async restartDaemon(reason: string = 'watchdog'): Promise<void> {
    this.restartCount++;
    this.lastRestart = Date.now();

    // Record restart event in HealthMonitor
    this.healthMonitor.recordRestart(reason, undefined, true);

    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      await this.start();
      console.log('✅ Daemon restarted successfully');
    } catch (error) {
      console.error('❌ Daemon restart failed:', error);
      throw error;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private loadConfigSync(): ApexConfig {
    const configPath = path.join(this.projectPath, '.apex', 'config.yaml');

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const rawConfig = yaml.parse(content);
      return ApexConfigSchema.parse(rawConfig);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn('⚠️ Failed to load config, using defaults:', err.message);
      } else {
        console.warn('⚠️ Config not found, using defaults');
      }

      return ApexConfigSchema.parse({
        project: { name: path.basename(this.projectPath) || 'apex-project' },
      });
    }
  }

  private logFeatureStatus(): void {
    const features = [
      { name: 'Service Installation', enabled: this.config.daemon?.installAsService },
      { name: 'Time-based Usage', enabled: this.config.daemon?.timeBasedUsage?.enabled },
      { name: 'Session Recovery', enabled: this.config.daemon?.sessionRecovery?.enabled },
      { name: 'Idle Processing', enabled: this.config.daemon?.idleProcessing?.enabled },
      { name: 'Health Monitoring', enabled: this.config.daemon?.healthCheck?.enabled },
      { name: 'Watchdog', enabled: this.config.daemon?.watchdog?.enabled },
    ];

    console.log('\n📋 v0.4.0 Feature Status:');
    features.forEach(feature => {
      const status = feature.enabled ? '✅' : '⏸️';
      const state = feature.enabled ? 'Enabled' : 'Disabled';
      console.log(`   ${status} ${feature.name}: ${state}`);
    });
    console.log('');
  }

  private async cleanupOnStop(): Promise<void> {
    try {
      // Cleanup old workspaces
      await this.workspaceManager.cleanupOldWorkspaces();

      // Cleanup old checkpoints
      await this.sessionManager.cleanupCheckpoints();

      console.log('🧹 Cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }

  // ============================================================================
  // Public API for CLI Integration
  // ============================================================================

  /**
   * Get usage manager for CLI commands
   */
  getUsageManager(): UsageManager {
    return this.usageManager;
  }

  /**
   * Get workspace manager for CLI commands
   */
  getWorkspaceManager(): WorkspaceManager {
    return this.workspaceManager;
  }

  /**
   * Get interaction manager for CLI commands
   */
  getInteractionManager(): InteractionManager {
    return this.interactionManager;
  }

  /**
   * Get thought capture manager for CLI commands
   */
  getThoughtCapture(): ThoughtCaptureManager {
    return this.thoughtCapture;
  }

  /**
   * Get idle processor for CLI commands
   */
  getIdleProcessor(): IdleProcessor {
    return this.idleProcessor;
  }

  /**
   * Get capacity monitor for CLI commands
   */
  getCapacityMonitor(): CapacityMonitor {
    return this.capacityMonitor;
  }

  /**
   * Get service manager for CLI commands
   */
  getServiceManager(): ServiceManager {
    return this.serviceManager;
  }

  /**
   * Get health monitor for CLI commands
   */
  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }
}
