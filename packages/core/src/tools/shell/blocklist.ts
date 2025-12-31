/**
 * @fileoverview Command blocklist patterns for BashTool security
 *
 * This module defines categorized patterns of dangerous commands that should be
 * blocked from execution. Each category has specific patterns and error messages
 * to provide clear feedback to users about why commands are blocked.
 *
 * @module @apex/core/tools/shell/blocklist
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of command security validation
 */
export interface CommandValidationResult {
  /** Whether the command is allowed to execute */
  allowed: boolean;
  /** Reason the command was blocked (if not allowed) */
  blockedReason?: string;
  /** Category of security violation */
  violationType?: 'blocklist' | 'path_traversal' | 'directory_escape' | 'forbidden_pattern';
  /** The specific pattern or rule that was violated */
  violatedRule?: string;
  /** Warnings that don't block but should be noted */
  warnings?: string[];
}

/**
 * A category of dangerous command patterns
 */
export interface BlocklistCategory {
  /** Regex patterns that match dangerous commands */
  patterns: RegExp[];
  /** Error message to show when commands in this category are blocked */
  message: string;
  /** Additional context about why this category is dangerous */
  description?: string;
}

// ============================================================================
// Blocklist Categories
// ============================================================================

/**
 * Categorized dangerous patterns for clear error messages
 *
 * These patterns are designed to catch dangerous commands while minimizing
 * false positives. Each category represents a different type of security risk.
 */
export const COMMAND_BLOCKLIST: Record<string, BlocklistCategory> = {
  // Category 1: Destructive file operations
  destructive: {
    patterns: [
      /^rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive[^=]*|--force[^=]*).*\/\s*$/,  // rm -rf / or variants
      /^rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive|--force)(?!\s*\.|\.\.)/,      // rm -rf (not current dir)
      />\s*\/dev\/sd[a-z]/,                                                   // overwrite disk devices
      /^dd\s+.*of=\/dev\//,                                                   // dd to device
      /^mkfs\./,                                                              // format filesystem
      /^shred\s+.*\/(?!tmp)/,                                                 // secure delete (not /tmp)
      /^wipe\s+.*\/(?!tmp)/,                                                  // disk wipe (not /tmp)
      /^format\s+[C-Z]:/,                                                     // Windows format command
      /^del\s+.*\/[qsf]/i,                                                    // Windows delete with force
      // Additional destructive patterns
      /^truncate\s+.*\/(?!tmp)/,                                              // truncate files outside /tmp
      /cat\s+\/dev\/zero\s*>\s*\/(?!tmp)/,                                    // overwrite with zeros
    ],
    message: 'Command blocked: This command could destroy files or data. Destructive operations like "rm -rf /" are not allowed.',
    description: 'Prevents commands that could delete or corrupt important files or system data'
  },

  // Category 2: Privilege escalation
  privilegeEscalation: {
    patterns: [
      /^sudo\s/,                                                              // sudo commands
      /^su\s/,                                                                // switch user
      /^doas\s/,                                                              // doas (OpenBSD sudo)
      /\|\s*sudo\s/,                                                          // pipe to sudo
      /;\s*sudo\s/,                                                           // chain with sudo
      /&&\s*sudo\s/,                                                          // and with sudo
      /\|\|\s*sudo\s/,                                                        // or with sudo
      // Windows privilege escalation
      /runas\s+\/user:/i,                                                     // Windows runas
      /powershell\s+.*-verb\s+runas/i,                                        // PowerShell as admin
    ],
    message: 'Command blocked: Privilege escalation is not permitted. Commands like "sudo" and "su" are blocked.',
    description: 'Prevents attempts to gain elevated privileges or run commands as other users'
  },

  // Category 3: Dangerous permission changes
  permissionAbuse: {
    patterns: [
      /chmod\s+777\s+\/(?!tmp)/,                                              // chmod 777 on non-tmp root paths
      /chmod\s+-R\s+777\s+\/(?!tmp)/,                                         // recursive chmod 777 on root
      /chmod\s+[0-7]*[0-7][0-7][0-7]\s+\/(?!tmp)/,                           // any chmod on root (except /tmp)
      /chown\s+-R\s+.*\s+\/(?!tmp)/,                                          // recursive chown on root
      /chown\s+root:root\s+\//,                                               // chown to root on system paths
      // Windows permission changes
      /icacls\s+.*\/grant\s+.*full/i,                                         // Windows full permissions
      /attrib\s+.*\/s\s+.*\\/,                                                // Windows recursive attribute change
    ],
    message: 'Command blocked: Dangerous permission change detected. Setting permissions to 777 or changing ownership recursively on system paths is not allowed.',
    description: 'Prevents dangerous changes to file permissions that could compromise security'
  },

  // Category 4: System commands
  systemCommands: {
    patterns: [
      /^shutdown\s/,
      /^reboot\s*$/,
      /^halt\s*$/,
      /^poweroff\s*$/,
      /^init\s+[0-6]/,                                                        // init runlevel change
      /^systemctl\s+(halt|reboot|poweroff|shutdown)/,
      /^service\s+.*\s+(stop|restart|reload)/,                                // service control
      /^pkill\s+-9/,                                                          // force kill processes
      /^killall\s+-9/,                                                        // force kill all
      // Windows system commands
      /^shutdown\s+\/[srh]/i,                                                 // Windows shutdown
      /^taskkill\s+\/f/i,                                                     // Windows force kill
    ],
    message: 'Command blocked: System control commands are not permitted. Commands like "shutdown", "reboot", and "halt" are blocked.',
    description: 'Prevents commands that could disrupt system availability or stability'
  },

  // Category 5: Dangerous command substitution/injection
  commandInjection: {
    patterns: [
      /`[^`]*rm\s+-[rf]/,                                                     // backtick with destructive rm
      /\$\([^)]*rm\s+-[rf]/,                                                  // $() with destructive rm
      /;\s*rm\s+-[rf]/,                                                       // ; rm -rf
      /\|\|\s*rm\s+-[rf]/,                                                    // || rm -rf
      /&&\s*rm\s+-[rf]/,                                                      // && rm -rf
      /;\s*sudo\s+rm/,                                                        // ; sudo rm
      /&&\s*sudo\s+rm/,                                                       // && sudo rm
      // Complex injection patterns
      /eval\s+.*\$\(/,                                                        // eval with command substitution
      /exec\s+.*\$\(/,                                                        // exec with command substitution
      /bash\s+-c\s+.*\$\(/,                                                   // bash -c with substitution
    ],
    message: 'Command blocked: Potentially malicious command pattern detected. The command contains patterns commonly used for injection attacks.',
    description: 'Prevents command injection and chaining patterns that could be used maliciously'
  },

  // Category 6: Fork bombs and resource exhaustion
  resourceExhaustion: {
    patterns: [
      /:\(\)\s*\{\s*:\|\s*:&\s*\}\s*;?\s*:/,                                 // classic fork bomb :(){ :|:& };:
      /:\s*\(\s*\)\s*\{.*\|.*&.*\}/,                                          // fork bomb variants
      /while\s+true\s*;\s*do.*done/,                                          // infinite while loop
      /for\s*\(\s*;\s*;\s*\)/,                                                // infinite for loop in C style
      /while\s*:\s*;\s*do/,                                                   // infinite loop with :
      // Memory bombs
      /yes\s+.*>\s*\/dev\/null\s*&/,                                          // background yes command
      /cat\s+\/dev\/zero/,                                                    // reading from /dev/zero
      /dd\s+.*\/dev\/zero.*count=[0-9]{6,}/,                                  // large dd operations
    ],
    message: 'Command blocked: Resource exhaustion attack detected. Commands that could consume unlimited resources are not allowed.',
    description: 'Prevents fork bombs, infinite loops, and other commands that could exhaust system resources'
  },

  // Category 7: Network and data exfiltration
  networkSecurity: {
    patterns: [
      /curl\s+.*\|\s*(bash|sh|python)/,                                       // curl | shell execution
      /wget\s+.*\|\s*(bash|sh|python)/,                                       // wget | shell execution
      /nc\s+.*-l\s+.*-e/,                                                     // netcat reverse shell
      /bash\s+-i\s+.*\/dev\/tcp/,                                             // bash reverse shell
      /python.*socket.*exec/,                                                 // Python reverse shell patterns
      // Data exfiltration patterns
      /curl\s+.*-d\s+.*@/,                                                    // curl data upload
      /wget\s+.*--post-data/,                                                 // wget data post
      /scp\s+.*\*.*:/,                                                        // bulk scp operations
    ],
    message: 'Command blocked: Potentially dangerous network operation detected. Remote code execution and data exfiltration patterns are not allowed.',
    description: 'Prevents commands that could execute remote code or exfiltrate sensitive data'
  },

  // Category 8: File system manipulation
  filesystemManipulation: {
    patterns: [
      /mount\s+.*\/dev/,                                                      // mounting devices
      /umount\s+.*-f/,                                                        // force unmount
      /fsck\s+.*\/dev/,                                                       // filesystem check on devices
      /fdisk\s+\/dev/,                                                        // disk partitioning
      /parted\s+\/dev/,                                                       // partition manipulation
      /mkswap\s+\/dev/,                                                       // swap creation
      /swapon\s+\/dev/,                                                       // swap activation
      // Archive bombs
      /tar\s+.*--exclude.*\*.*-/,                                             // complex tar with exclusions
      /zip\s+.*-r.*-9.*\*/,                                                   // recursive high-compression zip
    ],
    message: 'Command blocked: Dangerous filesystem operation detected. Commands that manipulate disk devices or create archive bombs are not allowed.',
    description: 'Prevents commands that could damage filesystems or create problematic archives'
  },
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a command matches any pattern in the blocklist
 *
 * @param command The command to check
 * @returns CommandValidationResult indicating if command is blocked
 */
export function checkCommandBlocklist(command: string): CommandValidationResult {
  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    return { allowed: true };
  }

  // Check each category
  for (const [categoryName, category] of Object.entries(COMMAND_BLOCKLIST)) {
    for (const pattern of category.patterns) {
      if (pattern.test(trimmedCommand)) {
        return {
          allowed: false,
          blockedReason: category.message,
          violationType: 'blocklist',
          violatedRule: `${categoryName}: ${pattern.source}`,
        };
      }
    }
  }

  return { allowed: true };
}

/**
 * Gets all blocklist patterns as a flat array (useful for testing)
 *
 * @returns Array of all regex patterns across all categories
 */
export function getAllBlocklistPatterns(): RegExp[] {
  const patterns: RegExp[] = [];

  for (const category of Object.values(COMMAND_BLOCKLIST)) {
    patterns.push(...category.patterns);
  }

  return patterns;
}

/**
 * Gets the names of all blocklist categories
 *
 * @returns Array of category names
 */
export function getBlocklistCategories(): string[] {
  return Object.keys(COMMAND_BLOCKLIST);
}

/**
 * Gets detailed information about a specific blocklist category
 *
 * @param categoryName Name of the category
 * @returns Category information or undefined if not found
 */
export function getBlocklistCategory(categoryName: string): BlocklistCategory | undefined {
  return COMMAND_BLOCKLIST[categoryName];
}