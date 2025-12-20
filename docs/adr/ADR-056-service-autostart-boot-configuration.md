# ADR-056: Service Auto-Start on Boot Configuration Option

## Status
Proposed

## Context

The task requires adding a configuration option in `.apex/config.yaml` to control whether the APEX daemon service is enabled at boot. The `apex install-service` command should respect this setting, and the service should start the APEX daemon on boot when enabled.

### Current State Analysis

1. **DaemonConfigSchema** (`packages/core/src/types.ts`, lines 133-182):
   - Already has `autoStart: z.boolean().optional().default(false)` - but this controls whether the daemon starts when the CLI launches, NOT whether the system service starts on boot
   - Has `installAsService: z.boolean().optional().default(false)` - indicates desire for service installation but doesn't control boot behavior

2. **ServiceManager** (`packages/orchestrator/src/service-manager.ts`):
   - `install()` method accepts `enableAfterInstall` option (lines 445-540)
   - `LaunchdGenerator` hardcodes `RunAtLoad: true` (line 242) - always starts on boot
   - `SystemdGenerator` generates `WantedBy=multi-user.target` (line 163) - service enabled means start on boot
   - No mechanism to read from config or respect a "start at boot" setting

3. **CLI service-handlers** (`packages/cli/src/handlers/service-handlers.ts`):
   - Uses `--enable` CLI flag to control enabling (lines 130-132)
   - Does NOT read config to determine default behavior

### Gap Analysis

| Component | Current Behavior | Required Behavior |
|-----------|-----------------|-------------------|
| Config schema | Has `installAsService` and `autoStart` | Needs explicit `enableOnBoot` setting |
| LaunchdGenerator | Hardcoded `RunAtLoad: true` | Respect config setting |
| SystemdGenerator | Enable controlled by install flag | Respect config setting |
| CLI install-service | `--enable` flag only | Read config as default, flag as override |

## Decision

### Architecture Overview

Implement a three-layer approach:
1. **Configuration**: Add `service.enableOnBoot` config option
2. **Service Generators**: Parameterize boot behavior
3. **CLI Integration**: Read config, allow flag override

### 1. Schema Changes (types.ts)

Add a dedicated `service` configuration block within `DaemonConfigSchema`:

```typescript
export const ServiceConfigSchema = z.object({
  /** Whether to enable the service to start on boot when installed */
  enableOnBoot: z.boolean().optional().default(false),
  /** Custom service name (default: 'apex-daemon') */
  name: z.string().optional().default('apex-daemon'),
  /** Service restart policy */
  restartPolicy: z.enum(['always', 'on-failure', 'never']).optional().default('on-failure'),
  /** Restart delay in seconds */
  restartDelaySeconds: z.number().optional().default(5),
});
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

export const DaemonConfigSchema = z.object({
  // ... existing fields ...
  /** System service configuration */
  service: ServiceConfigSchema.optional(),
});
```

**Rationale**:
- Groups all service-related settings together
- `enableOnBoot` is explicit and distinct from `autoStart` (which controls CLI behavior)
- Allows future extension of service-specific settings

### 2. ServiceManager Modifications (service-manager.ts)

#### 2.1 Add `enableOnBoot` to Options Interface

```typescript
export interface ServiceManagerOptions {
  // ... existing fields ...

  /** Whether to enable the service to start on boot (default: false) */
  enableOnBoot?: boolean;
}
```

#### 2.2 Modify LaunchdGenerator

Current (hardcoded):
```typescript
RunAtLoad: true,
```

New (configurable):
```typescript
RunAtLoad: this.options.enableOnBoot,
```

**Impact**: When `enableOnBoot` is `false`, the plist file will have `RunAtLoad: false`, meaning the service must be manually started with `launchctl start`.

#### 2.3 Modify SystemdGenerator

The systemd approach is different - boot behavior is controlled by the `enable` operation, not the unit file content. The unit file should remain unchanged.

**Design Decision**: For systemd, we control boot behavior via:
1. The `[Install]` section's `WantedBy=multi-user.target` enables boot startup
2. The `systemctl enable` command creates the symlink
3. The `install()` method's `enableAfterInstall` parameter triggers enable

**No change to generator needed** - the `enable()` method already handles this.

#### 2.4 Modify install() Method

```typescript
async install(options: InstallOptions = {}): Promise<InstallResult> {
  // Default enableAfterInstall to the config's enableOnBoot setting
  const {
    enableAfterInstall = this.options.enableOnBoot || false,
    force = false
  } = options;

  // ... rest of implementation unchanged ...
}
```

### 3. CLI Integration (service-handlers.ts)

#### 3.1 Load Config and Pass to ServiceManager

```typescript
import { loadConfig } from '@apex/core';

export async function handleInstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  // ... validation ...

  const options = parseOptions(args);

  // Load config to get service settings
  let serviceConfig: ServiceConfig | undefined;
  if (ctx.initialized && ctx.config) {
    serviceConfig = ctx.config.daemon?.service;
  }

  // Create ServiceManager with config-derived options
  const manager = new ServiceManager({
    projectPath: ctx.cwd,
    serviceName: options.name || serviceConfig?.name || 'apex-daemon',
    enableOnBoot: serviceConfig?.enableOnBoot || false,
    restartPolicy: serviceConfig?.restartPolicy || 'on-failure',
    restartDelaySeconds: serviceConfig?.restartDelaySeconds || 5,
  });

  // CLI flag overrides config
  const installResult = await manager.install({
    enableAfterInstall: options.enable ?? serviceConfig?.enableOnBoot ?? false,
    force: options.force || false
  });

  // ... display results ...
}
```

#### 3.2 Flag Override Behavior

| Config `enableOnBoot` | CLI `--enable` flag | Result |
|-----------------------|---------------------|--------|
| `false` (default)     | Not specified       | Not enabled at boot |
| `false`               | `--enable`          | Enabled at boot (override) |
| `true`                | Not specified       | Enabled at boot (from config) |
| `true`                | `--no-enable`       | Not enabled (override) |

Add `--no-enable` flag support:
```typescript
case '--no-enable':
  options.enable = false;
  break;
```

### 4. Config Example

```yaml
# .apex/config.yaml
daemon:
  pollInterval: 5000
  autoStart: false        # Controls CLI auto-start (existing)
  logLevel: info

  # NEW: System service configuration
  service:
    enableOnBoot: true    # Service starts when system boots
    name: apex-daemon     # Service name
    restartPolicy: on-failure
    restartDelaySeconds: 5
```

### 5. Data Flow Diagram

```
User Config (.apex/config.yaml)
         │
         ▼
┌─────────────────────────────┐
│ daemon.service.enableOnBoot │
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ CLI: apex install-service   │◄──── --enable/--no-enable flags
└─────────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ ServiceManager(options)     │
│   enableOnBoot: boolean     │
└─────────────────────────────┘
         │
         ├────────────────────────┐
         ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐
│ LaunchdGenerator    │  │ SystemdGenerator    │
│ RunAtLoad: bool     │  │ (unchanged)         │
└─────────────────────┘  └─────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────────┐  ┌─────────────────────┐
│ .plist file         │  │ .service file       │
│ RunAtLoad: true/    │  │ + enable() call     │
│           false     │  │   if enableOnBoot   │
└─────────────────────┘  └─────────────────────┘
```

### 6. Implementation Plan

#### Phase 1: Schema Update (types.ts)
1. Add `ServiceConfigSchema` with `enableOnBoot` field
2. Add `service` field to `DaemonConfigSchema`
3. Export new types

#### Phase 2: Config Integration (config.ts)
1. Update `getEffectiveConfig()` to include service defaults

#### Phase 3: ServiceManager Update (service-manager.ts)
1. Add `enableOnBoot` to `ServiceManagerOptions`
2. Update `LaunchdGenerator.generate()` to use `enableOnBoot`
3. Update `install()` to default `enableAfterInstall` from `enableOnBoot`

#### Phase 4: CLI Integration (service-handlers.ts)
1. Load config in `handleInstallService()`
2. Pass config values to `ServiceManager`
3. Add `--no-enable` flag support
4. Update output messages to show boot status

#### Phase 5: Testing
1. Unit tests for schema validation
2. Unit tests for LaunchdGenerator with enableOnBoot true/false
3. Integration tests for CLI flag precedence
4. Manual testing on Linux and macOS

### 7. Backward Compatibility

- Existing configs without `daemon.service` section: defaults apply (`enableOnBoot: false`)
- Existing service installations: unaffected until reinstalled
- CLI behavior without flags: unchanged (defaults to config or false)

### 8. Error Handling

| Scenario | Behavior |
|----------|----------|
| Config missing `daemon.service` | Use defaults |
| Invalid `enableOnBoot` value | Zod validation error on config load |
| Service install fails | No boot behavior change |
| Enable fails after install | Warning in output, success returned |

## Consequences

### Positive
- Clear separation between "daemon auto-start" (CLI) and "service boot start" (system)
- Configuration-driven behavior with CLI override capability
- Consistent across platforms (Linux/macOS)
- Backward compatible with existing configurations

### Negative
- Adds configuration complexity (new nested section)
- Two similar-sounding options (`autoStart` vs `enableOnBoot`) may confuse users
- Platform differences in implementation (plist vs symlink)

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User confusion: autoStart vs enableOnBoot | Clear documentation with examples |
| Platform-specific behavior differences | Document per-platform behavior |
| Config validation breaking existing setups | Optional schema with defaults |

## Files to Modify

1. `packages/core/src/types.ts` - Add ServiceConfigSchema, update DaemonConfigSchema
2. `packages/core/src/config.ts` - Update getEffectiveConfig() for service defaults
3. `packages/orchestrator/src/service-manager.ts` - Add enableOnBoot option, modify generators
4. `packages/cli/src/handlers/service-handlers.ts` - Load config, pass to ServiceManager

## References

- [ADR-054: ServiceManager Platform Integration](./ADR-054-service-manager-platform-integration.md)
- [ADR-055: CLI Commands for install-service and uninstall-service](./ADR-055-install-uninstall-service-cli-commands.md)
- [macOS launchd RunAtLoad documentation](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [systemd unit file WantedBy documentation](https://www.freedesktop.org/software/systemd/man/systemd.unit.html#WantedBy=)
