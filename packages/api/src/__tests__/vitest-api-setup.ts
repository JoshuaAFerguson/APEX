/**
 * API-specific vitest setup file.
 * Patches ApexOrchestrator to disable auth in test environments,
 * ensuring tests don't get 401 responses unless they explicitly enable auth.
 */
import { beforeAll } from 'vitest';

const PATCHED_KEY = '__apexTestAuthPatched';

beforeAll(async () => {
  try {
    const orchestratorModule = await import('@apexcli/orchestrator');
    const OrchestratorClass = orchestratorModule.ApexOrchestrator;

    if (OrchestratorClass?.prototype && !(OrchestratorClass.prototype as any)[PATCHED_KEY]) {
      const proto = OrchestratorClass.prototype;
      const realGetConfig = proto.getConfig;

      proto.getConfig = async function () {
        const config = await realGetConfig.call(this);
        if (!config.api) {
          config.api = { auth: { enabled: false, apiKeys: [] } };
        } else if (!config.api.auth) {
          config.api.auth = { enabled: false, apiKeys: [] };
        }
        return config;
      };

      (proto as any)[PATCHED_KEY] = true;
    }
  } catch {
    // If orchestrator can't be imported, skip patching
  }
});
