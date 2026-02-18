/**
 * Self-Repair Loop Configuration
 *
 * Re-exports the RepairLoopConfigSchema from core and provides
 * resolution utilities for merging user config with defaults.
 *
 * @module repair-loop/repair-config
 */

import { RepairLoopConfigSchema, type RepairLoopConfig } from '@apexcli/core';

// Re-export the schema and type under the module's naming convention
export const RepairConfigSchema = RepairLoopConfigSchema;
export type RepairConfig = RepairLoopConfig;

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_REPAIR_CONFIG: RepairConfig = RepairConfigSchema.parse({});

/**
 * Merge user-provided partial config with defaults.
 */
export function resolveRepairConfig(partial?: Partial<RepairConfig>): RepairConfig {
  if (!partial) return DEFAULT_REPAIR_CONFIG;
  return RepairConfigSchema.parse(partial);
}
