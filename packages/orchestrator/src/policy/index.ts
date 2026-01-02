/**
 * @fileoverview Policy enforcement module for APEX orchestrator
 *
 * This module exports the PolicyEnforcer class and related utilities for
 * validating agent operations against policy rules.
 *
 * @module @apex/orchestrator/policy
 */

export {
  PolicyEnforcer,
  createPolicyEnforcer,
  type ViolationOptions,
  type PathValidationResult,
  type ApprovalCheckContext,
  type ApprovalRequirement,
} from './policy-enforcer.js';
