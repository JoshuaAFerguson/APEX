"use strict";
/**
 * @fileoverview Base Test Utilities for MCP Marketplace E2E Tests
 *
 * Provides low-level utilities for:
 * - CLI execution with MCP-specific defaults
 * - Config file manipulation (read/write YAML)
 * - File system assertions
 * - Output parsing and validation
 * - Test environment configuration
 *
 * ## Architecture (ADR-071)
 *
 * This is the lowest layer of the MCP E2E test infrastructure, providing
 * primitive operations that higher-level helpers compose into workflows.
 *
 * @module tests/e2e/utils/mcp-test-utils
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCliPath = getCliPath;
exports.execCli = execCli;
exports.execMCPCommand = execMCPCommand;
exports.execMCPCommandJson = execMCPCommandJson;
exports.readApexConfig = readApexConfig;
exports.writeApexConfig = writeApexConfig;
exports.readMCPConfig = readMCPConfig;
exports.isServerInConfig = isServerInConfig;
exports.getServerFromConfig = getServerFromConfig;
exports.createTestProject = createTestProject;
exports.createTestProjectWithServers = createTestProjectWithServers;
exports.cleanupTestProject = cleanupTestProject;
exports.assertFileExists = assertFileExists;
exports.assertDirectoryExists = assertDirectoryExists;
exports.assertOutputContains = assertOutputContains;
exports.assertOutputNotContains = assertOutputNotContains;
exports.assertServerInstalled = assertServerInstalled;
exports.assertMarketplaceOutput = assertMarketplaceOutput;
exports.parseSimpleYaml = parseSimpleYaml;
exports.serializeSimpleYaml = serializeSimpleYaml;
exports.isE2EMode = isE2EMode;
exports.isCI = isCI;
exports.getTestTimeout = getTestTimeout;
exports.isCliBinaryAvailable = isCliBinaryAvailable;
exports.retry = retry;
exports.waitForCondition = waitForCondition;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ============================================================================
// CLI Execution Utilities
// ============================================================================
/**
 * Path to the built CLI binary
 */
function getCliPath() {
    return path.resolve(__dirname, '../../../packages/cli/dist/index.js');
}
/**
 * Execute a CLI command and return structured result
 */
async function execCli(args, options) {
    const cliPath = getCliPath();
    const startTime = Date.now();
    const timeout = options.timeout ?? 30000;
    const env = {
        ...process.env,
        NODE_ENV: 'test',
        APEX_TEST_MODE: 'e2e',
        ...(options.noColor !== false ? { NO_COLOR: '1' } : {}),
        ...(options.env ?? {}),
    };
    try {
        const { stdout, stderr } = await execAsync(`node ${cliPath} ${args}`, {
            cwd: options.cwd,
            env,
            timeout,
        });
        const duration = Date.now() - startTime;
        let json = undefined;
        if (options.parseJson && stdout.trim()) {
            try {
                json = JSON.parse(stdout.trim());
            }
            catch {
                // Not valid JSON, leave as undefined
            }
        }
        return {
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: 0,
            success: true,
            json,
            duration,
        };
    }
    catch (error) {
        const duration = Date.now() - startTime;
        const execError = error;
        return {
            stdout: execError.stdout?.toString() || '',
            stderr: execError.stderr?.toString() || execError.message || '',
            exitCode: execError.code ?? 1,
            success: false,
            duration,
        };
    }
}
/**
 * Execute an MCP subcommand
 */
async function execMCPCommand(subcommand, options) {
    return execCli(`mcp ${subcommand}`, options);
}
/**
 * Execute an MCP command with --json flag for structured output
 */
async function execMCPCommandJson(subcommand, options) {
    return execCli(`mcp ${subcommand} --json`, {
        ...options,
        parseJson: true,
    });
}
// ============================================================================
// Config File Utilities
// ============================================================================
/**
 * Read and parse the APEX config file
 *
 * Note: Uses simple YAML parsing suitable for test verification.
 * For production YAML parsing, use the 'yaml' package.
 */
async function readApexConfig(projectDir) {
    const configPath = path.join(projectDir, '.apex', 'config.yaml');
    const content = await fs.readFile(configPath, 'utf-8');
    return parseSimpleYaml(content);
}
/**
 * Write an APEX config file
 */
async function writeApexConfig(projectDir, config) {
    const configPath = path.join(projectDir, '.apex', 'config.yaml');
    const content = serializeSimpleYaml(config);
    await fs.writeFile(configPath, content, 'utf-8');
}
/**
 * Read only the MCP section from config
 */
async function readMCPConfig(projectDir) {
    const config = await readApexConfig(projectDir);
    return config.mcp ?? {};
}
/**
 * Check if a server exists in the config
 */
async function isServerInConfig(projectDir, serverName) {
    const mcpConfig = await readMCPConfig(projectDir);
    return !!(mcpConfig.servers && serverName in mcpConfig.servers);
}
/**
 * Get a specific server's config from the APEX config
 */
async function getServerFromConfig(projectDir, serverName) {
    const mcpConfig = await readMCPConfig(projectDir);
    return mcpConfig.servers?.[serverName] ?? null;
}
// ============================================================================
// Project Setup Utilities
// ============================================================================
/**
 * Create a temporary test project directory with .apex structure
 */
async function createTestProject(prefix = 'apex-e2e-mcp-') {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    // Create .apex directory structure
    const apexDir = path.join(testDir, '.apex');
    await fs.mkdir(apexDir, { recursive: true });
    await fs.mkdir(path.join(apexDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(apexDir, 'workflows'), { recursive: true });
    // Write default config
    const defaultConfig = {
        project: {
            name: 'e2e-mcp-test',
            language: 'typescript',
        },
        autonomy: {
            default: 'supervised',
        },
        models: {
            planning: 'sonnet',
            implementation: 'sonnet',
        },
        limits: {
            maxTokensPerTask: 100000,
            maxCostPerTask: 10,
        },
    };
    await writeApexConfig(testDir, defaultConfig);
    return testDir;
}
/**
 * Create a test project with pre-installed MCP servers
 */
async function createTestProjectWithServers(servers, prefix = 'apex-e2e-mcp-') {
    const testDir = await createTestProject(prefix);
    const config = await readApexConfig(testDir);
    config.mcp = {
        servers,
    };
    await writeApexConfig(testDir, config);
    return testDir;
}
/**
 * Clean up a test project directory
 */
async function cleanupTestProject(testDir) {
    try {
        await fs.rm(testDir, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup errors
    }
}
// ============================================================================
// Assertion Utilities
// ============================================================================
/**
 * Assert a file exists at the given path
 */
async function assertFileExists(filePath) {
    try {
        await fs.stat(filePath);
    }
    catch {
        throw new Error(`Expected file to exist: ${filePath}`);
    }
}
/**
 * Assert a directory exists at the given path
 */
async function assertDirectoryExists(dirPath) {
    try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
            throw new Error(`Expected directory, got file: ${dirPath}`);
        }
    }
    catch (err) {
        if (err instanceof Error && err.message.startsWith('Expected directory')) {
            throw err;
        }
        throw new Error(`Expected directory to exist: ${dirPath}`);
    }
}
/**
 * Assert CLI output contains expected strings
 */
function assertOutputContains(result, expected) {
    const expectations = Array.isArray(expected) ? expected : [expected];
    const combined = result.stdout + result.stderr;
    for (const exp of expectations) {
        if (!combined.includes(exp)) {
            throw new Error(`Expected output to contain "${exp}".\nStdout: ${result.stdout}\nStderr: ${result.stderr}`);
        }
    }
}
/**
 * Assert CLI output does not contain specific strings
 */
function assertOutputNotContains(result, unexpected) {
    const expectations = Array.isArray(unexpected) ? unexpected : [unexpected];
    const combined = result.stdout + result.stderr;
    for (const exp of expectations) {
        if (combined.includes(exp)) {
            throw new Error(`Expected output NOT to contain "${exp}".\nStdout: ${result.stdout}\nStderr: ${result.stderr}`);
        }
    }
}
/**
 * Assert a server is properly configured in the project
 */
async function assertServerInstalled(projectDir, serverName, expectedConfig) {
    const server = await getServerFromConfig(projectDir, serverName);
    if (!server) {
        throw new Error(`Expected server "${serverName}" to be installed in config at ${projectDir}`);
    }
    if (expectedConfig) {
        for (const [key, value] of Object.entries(expectedConfig)) {
            const actual = server[key];
            if (JSON.stringify(actual) !== JSON.stringify(value)) {
                throw new Error(`Server "${serverName}" config mismatch for "${key}":\n` +
                    `  Expected: ${JSON.stringify(value)}\n` +
                    `  Actual: ${JSON.stringify(actual)}`);
            }
        }
    }
}
/**
 * Assert marketplace output matches expectations
 */
function assertMarketplaceOutput(output, expectations) {
    if (expectations.containsServers) {
        for (const server of expectations.containsServers) {
            if (!output.includes(server)) {
                throw new Error(`Expected marketplace output to contain server "${server}"`);
            }
        }
    }
    if (expectations.doesNotContain) {
        for (const text of expectations.doesNotContain) {
            if (output.includes(text)) {
                throw new Error(`Expected marketplace output NOT to contain "${text}"`);
            }
        }
    }
}
// ============================================================================
// YAML Utilities (Simple parser for test purposes)
// ============================================================================
/**
 * Simple YAML parser for test config files.
 * Handles basic key-value pairs, nested objects, and arrays.
 * Not a full YAML parser - suitable for APEX config format only.
 */
function parseSimpleYaml(content) {
    const result = {};
    const lines = content.split('\n');
    const stack = [
        { indent: -1, obj: result },
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.replace(/\s+$/, '');
        // Skip empty lines and comments
        if (!trimmed || trimmed.trim().startsWith('#')) {
            continue;
        }
        const indent = line.length - line.trimStart().length;
        const keyValueMatch = trimmed.trim().match(/^([^:]+):\s*(.*)$/);
        if (!keyValueMatch) {
            // Handle array items
            const arrayMatch = trimmed.trim().match(/^-\s*(.+)$/);
            if (arrayMatch) {
                // Find parent and append to its last key's array
                while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                    stack.pop();
                }
                const parent = stack[stack.length - 1].obj;
                const lastKey = Object.keys(parent).pop();
                if (lastKey) {
                    if (!Array.isArray(parent[lastKey])) {
                        parent[lastKey] = [];
                    }
                    const value = parseYamlValue(arrayMatch[1]);
                    parent[lastKey].push(value);
                }
            }
            continue;
        }
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();
        // Pop stack to find correct parent
        while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
        }
        const currentObj = stack[stack.length - 1].obj;
        if (value === '' || value === undefined) {
            // Nested object
            const newObj = {};
            currentObj[key] = newObj;
            stack.push({ indent, obj: newObj });
        }
        else {
            // Simple value
            currentObj[key] = parseYamlValue(value);
        }
    }
    return result;
}
/**
 * Parse a YAML value string into appropriate type
 */
function parseYamlValue(value) {
    // Handle quoted strings
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    // Handle booleans
    if (value === 'true')
        return true;
    if (value === 'false')
        return false;
    // Handle null
    if (value === 'null' || value === '~')
        return null;
    // Handle numbers
    const num = Number(value);
    if (!isNaN(num) && value !== '')
        return num;
    // Handle inline arrays
    if (value.startsWith('[') && value.endsWith(']')) {
        return value
            .slice(1, -1)
            .split(',')
            .map((v) => parseYamlValue(v.trim()));
    }
    return value;
}
/**
 * Simple YAML serializer for test config files.
 * Handles basic structures for APEX config format.
 */
function serializeSimpleYaml(obj, indent = 0) {
    let result = '';
    const prefix = '  '.repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined) {
            continue;
        }
        if (Array.isArray(value)) {
            result += `${prefix}${key}:\n`;
            for (const item of value) {
                if (typeof item === 'object' && item !== null) {
                    result += `${prefix}  - ${serializeSimpleYaml(item, indent + 2).trimStart()}`;
                }
                else {
                    result += `${prefix}  - ${serializeYamlValue(item)}\n`;
                }
            }
        }
        else if (typeof value === 'object') {
            result += `${prefix}${key}:\n`;
            result += serializeSimpleYaml(value, indent + 1);
        }
        else {
            result += `${prefix}${key}: ${serializeYamlValue(value)}\n`;
        }
    }
    return result;
}
/**
 * Serialize a scalar YAML value
 */
function serializeYamlValue(value) {
    if (typeof value === 'string') {
        // Quote strings that could be confused with other types
        if (value === '' ||
            value === 'true' ||
            value === 'false' ||
            value === 'null' ||
            !isNaN(Number(value))) {
            return `"${value}"`;
        }
        // Quote strings with special characters
        if (/[:{}\[\],&*?|>!%@`]/.test(value)) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
    }
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    if (typeof value === 'number')
        return String(value);
    if (value === null)
        return 'null';
    return String(value);
}
// ============================================================================
// Test Environment Detection
// ============================================================================
/**
 * Check if running in E2E test mode
 */
function isE2EMode() {
    return process.env.APEX_TEST_MODE === 'e2e';
}
/**
 * Check if running in CI environment
 */
function isCI() {
    return process.env.CI === 'true' || process.env.CI === '1';
}
/**
 * Get the test timeout based on environment
 */
function getTestTimeout() {
    if (isCI())
        return 60000;
    return 30000;
}
/**
 * Check if the CLI binary is built and available
 */
async function isCliBinaryAvailable() {
    try {
        await fs.stat(getCliPath());
        return true;
    }
    catch {
        return false;
    }
}
// ============================================================================
// Retry Utilities
// ============================================================================
/**
 * Retry an async operation with configurable attempts
 */
async function retry(operation, options = {}) {
    const { maxAttempts = 3, delayMs = 1000, backoff = true } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxAttempts) {
                const wait = backoff ? delayMs * attempt : delayMs;
                await new Promise((resolve) => setTimeout(resolve, wait));
            }
        }
    }
    throw lastError;
}
/**
 * Wait for a condition to become true
 */
async function waitForCondition(condition, options = {}) {
    const { timeout = 10000, interval = 100, message = 'Condition not met' } = options;
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (await condition()) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
    }
    throw new Error(`${message} (timeout: ${timeout}ms)`);
}
//# sourceMappingURL=mcp-test-utils.js.map