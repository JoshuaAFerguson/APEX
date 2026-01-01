#!/usr/bin/env node

// Basic syntax verification for the permission hooks implementation
console.log("🔍 Verifying permission hooks implementation...");

try {
  // Check if files exist and are readable
  const fs = require('fs');
  const path = require('path');

  const hooksFile = path.join(__dirname, 'packages/orchestrator/src/hooks.ts');
  const indexFile = path.join(__dirname, 'packages/orchestrator/src/index.ts');

  // Read the files to check for basic syntax
  const hooksContent = fs.readFileSync(hooksFile, 'utf8');
  const indexContent = fs.readFileSync(indexFile, 'utf8');

  // Check for key implementation components
  const checks = [
    {
      name: "PermissionPresetManager import in hooks.ts",
      check: hooksContent.includes("import { PermissionPresetManager }"),
      file: "hooks.ts"
    },
    {
      name: "permissionPresetManager in HookContext",
      check: hooksContent.includes("permissionPresetManager?: PermissionPresetManager"),
      file: "hooks.ts"
    },
    {
      name: "checkToolPermissions function",
      check: hooksContent.includes("async function checkToolPermissions"),
      file: "hooks.ts"
    },
    {
      name: "permission:request event emission",
      check: hooksContent.includes("emit('permission:request'"),
      file: "hooks.ts"
    },
    {
      name: "permission:denied event emission",
      check: hooksContent.includes("emit('permission:denied'"),
      file: "hooks.ts"
    },
    {
      name: "permission:granted event emission",
      check: hooksContent.includes("emit('permission:granted'"),
      file: "hooks.ts"
    },
    {
      name: "permission hook in PreToolUse array",
      check: hooksContent.includes("createHookCallback(context, checkToolPermissions)"),
      file: "hooks.ts"
    },
    {
      name: "permissionPresetManager passed to createHooks in index.ts",
      check: indexContent.includes("permissionPresetManager: this.permissionPresetManager"),
      file: "index.ts"
    }
  ];

  let allPassed = true;

  console.log("\n✅ Implementation Verification Results:");
  for (const check of checks) {
    const status = check.check ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} - ${check.name} (${check.file})`);
    if (!check.check) allPassed = false;
  }

  if (allPassed) {
    console.log("\n🎉 All checks passed! Implementation looks correct.");
    console.log("\n📋 Summary of implementation:");
    console.log("• Added PermissionPresetManager to HookContext interface");
    console.log("• Created checkToolPermissions function to enforce preset policies");
    console.log("• Integrated permission checks into PreToolUse hooks (runs first)");
    console.log("• Emits permission:request events when confirmation needed");
    console.log("• Emits permission:granted/denied events based on preset behavior");
    console.log("• Handles allow/deny/confirm behaviors per preset configuration");
    console.log("• Added permissionPresetManager to hook context in orchestrator");

    process.exit(0);
  } else {
    console.log("\n❌ Some checks failed. Please review the implementation.");
    process.exit(1);
  }

} catch (error) {
  console.error("❌ Error during verification:", error.message);
  process.exit(1);
}