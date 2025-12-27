import { describe, it, expect } from 'vitest';
import {
  ContainerConfigSchema,
  ResourceLimitsSchema,
  ContainerNetworkModeSchema
} from '../types';

/**
 * Additional edge case tests for container configuration
 * These tests focus on boundary conditions, error cases,
 * and unusual but valid configurations.
 */
describe('Container Configuration Edge Cases', () => {

  describe('Resource limits boundary conditions', () => {
    it('should accept minimum valid CPU values', () => {
      const result = ResourceLimitsSchema.parse({ cpu: 0.1 });
      expect(result.cpu).toBe(0.1);
    });

    it('should accept maximum valid CPU values', () => {
      const result = ResourceLimitsSchema.parse({ cpu: 64 });
      expect(result.cpu).toBe(64);
    });

    it('should reject CPU values just below minimum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 0.09 })).toThrow();
    });

    it('should reject CPU values just above maximum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpu: 64.1 })).toThrow();
    });

    it('should accept minimum valid CPU shares', () => {
      const result = ResourceLimitsSchema.parse({ cpuShares: 2 });
      expect(result.cpuShares).toBe(2);
    });

    it('should accept maximum valid CPU shares', () => {
      const result = ResourceLimitsSchema.parse({ cpuShares: 262144 });
      expect(result.cpuShares).toBe(262144);
    });

    it('should reject CPU shares below minimum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 1 })).toThrow();
    });

    it('should reject CPU shares above maximum', () => {
      expect(() => ResourceLimitsSchema.parse({ cpuShares: 262145 })).toThrow();
    });

    it('should accept minimum PIDs limit', () => {
      const result = ResourceLimitsSchema.parse({ pidsLimit: 1 });
      expect(result.pidsLimit).toBe(1);
    });

    it('should reject zero PIDs limit', () => {
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: 0 })).toThrow();
    });

    it('should reject negative PIDs limit', () => {
      expect(() => ResourceLimitsSchema.parse({ pidsLimit: -1 })).toThrow();
    });
  });

  describe('Memory format edge cases', () => {
    it('should accept uppercase memory units', () => {
      const examples = ["512K", "256M", "4G"];
      for (const memory of examples) {
        const result = ResourceLimitsSchema.parse({ memory });
        expect(result.memory).toBe(memory);
      }
    });

    it('should accept lowercase memory units', () => {
      const examples = ["512k", "256m", "4g"];
      for (const memory of examples) {
        const result = ResourceLimitsSchema.parse({ memory });
        expect(result.memory).toBe(memory);
      }
    });

    it('should accept memory values without units', () => {
      const result = ResourceLimitsSchema.parse({ memory: "1073741824" });
      expect(result.memory).toBe("1073741824");
    });

    it('should reject invalid memory formats', () => {
      const invalidFormats = [
        "512x",    // Invalid unit
        "512 m",   // Space in value
        "512mb",   // Too many characters
        "abc123m", // Non-numeric prefix
        "m512",    // Unit before number
        "",        // Empty string
      ];

      for (const memory of invalidFormats) {
        expect(() => ResourceLimitsSchema.parse({ memory }),
               `Should reject memory format: ${memory}`).toThrow();
      }
    });
  });

  describe('Image name validation edge cases', () => {
    it('should accept complex registry URLs', () => {
      const complexImages = [
        "registry.gitlab.com/group/subgroup/project:v1.2.3",
        "localhost:5000/my-image:latest",
        "my-registry.io:8080/namespace/image:sha256-abc123",
        "gcr.io/project-id/image:tag-with-dashes",
        "quay.io/organization/repository:v1.0.0-alpha.1"
      ];

      for (const image of complexImages) {
        const result = ContainerConfigSchema.parse({ image });
        expect(result.image).toBe(image);
      }
    });

    it('should accept images with numeric tags', () => {
      const numericTagImages = [
        "node:18",
        "python:3.11",
        "postgres:15.2",
        "redis:7.0.8"
      ];

      for (const image of numericTagImages) {
        const result = ContainerConfigSchema.parse({ image });
        expect(result.image).toBe(image);
      }
    });

    it('should reject malformed image names', () => {
      const invalidImages = [
        "",                    // Empty string
        "node:",              // Missing tag after colon
        ":latest",            // Missing image name
        "node::",             // Double colon
        "NODE:latest",        // Uppercase not allowed in name
        "node/",              // Trailing slash
        "/node",              // Leading slash
        "node@sha256:",       // Incomplete digest
        "node latest",        // Space in name
      ];

      for (const image of invalidImages) {
        expect(() => ContainerConfigSchema.parse({ image }),
               `Should reject image: ${image}`).toThrow();
      }
    });
  });

  describe('Complex configuration combinations', () => {
    it('should accept all fields populated', () => {
      const complexConfig = ContainerConfigSchema.parse({
        image: "node:20-alpine",
        dockerfile: "custom/Dockerfile",
        buildContext: "../",
        imageTag: "my-app:v1.0.0",
        volumes: {
          "./src": "/app/src",
          "./config": "/app/config"
        },
        environment: {
          NODE_ENV: "production",
          DEBUG: "app:*",
          PORT: "3000"
        },
        resourceLimits: {
          cpu: 2.5,
          memory: "4g",
          memoryReservation: "2g",
          memorySwap: "6g",
          cpuShares: 1024,
          pidsLimit: 100
        },
        networkMode: "bridge",
        workingDir: "/app",
        user: "1000:1000",
        labels: {
          "version": "1.0.0",
          "environment": "production"
        },
        entrypoint: ["/usr/local/bin/node"],
        command: ["server.js"],
        autoRemove: false,
        privileged: true,
        securityOpts: ["no-new-privileges:true"],
        capAdd: ["NET_BIND_SERVICE"],
        capDrop: ["ALL"],
        autoDependencyInstall: true,
        customInstallCommand: "npm ci --production",
        useFrozenLockfile: false,
        installTimeout: 600000,
        installRetries: 5
      });

      expect(complexConfig.image).toBe("node:20-alpine");
      expect(complexConfig.dockerfile).toBe("custom/Dockerfile");
      expect(complexConfig.buildContext).toBe("../");
      expect(complexConfig.imageTag).toBe("my-app:v1.0.0");
      expect(complexConfig.volumes).toEqual({
        "./src": "/app/src",
        "./config": "/app/config"
      });
      expect(complexConfig.environment).toEqual({
        NODE_ENV: "production",
        DEBUG: "app:*",
        PORT: "3000"
      });
      expect(complexConfig.resourceLimits?.cpu).toBe(2.5);
      expect(complexConfig.resourceLimits?.memory).toBe("4g");
      expect(complexConfig.networkMode).toBe("bridge");
      expect(complexConfig.workingDir).toBe("/app");
      expect(complexConfig.user).toBe("1000:1000");
      expect(complexConfig.labels).toEqual({
        "version": "1.0.0",
        "environment": "production"
      });
      expect(complexConfig.entrypoint).toEqual(["/usr/local/bin/node"]);
      expect(complexConfig.command).toEqual(["server.js"]);
      expect(complexConfig.autoRemove).toBe(false);
      expect(complexConfig.privileged).toBe(true);
      expect(complexConfig.securityOpts).toEqual(["no-new-privileges:true"]);
      expect(complexConfig.capAdd).toEqual(["NET_BIND_SERVICE"]);
      expect(complexConfig.capDrop).toEqual(["ALL"]);
      expect(complexConfig.customInstallCommand).toBe("npm ci --production");
      expect(complexConfig.useFrozenLockfile).toBe(false);
      expect(complexConfig.installTimeout).toBe(600000);
      expect(complexConfig.installRetries).toBe(5);
    });

    it('should accept minimal valid configuration', () => {
      const minimalConfig = ContainerConfigSchema.parse({
        image: "ubuntu"
      });

      expect(minimalConfig.image).toBe("ubuntu");
      expect(minimalConfig.networkMode).toBe("bridge"); // default
      expect(minimalConfig.autoRemove).toBe(true); // default
      expect(minimalConfig.privileged).toBe(false); // default
    });
  });

  describe('Array field validation edge cases', () => {
    it('should accept empty arrays for optional array fields', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        entrypoint: [],
        command: [],
        securityOpts: [],
        capAdd: [],
        capDrop: []
      });

      expect(config.entrypoint).toEqual([]);
      expect(config.command).toEqual([]);
      expect(config.securityOpts).toEqual([]);
      expect(config.capAdd).toEqual([]);
      expect(config.capDrop).toEqual([]);
    });

    it('should accept single-element arrays', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        entrypoint: ["/bin/bash"],
        command: ["--version"],
        securityOpts: ["no-new-privileges:true"],
        capAdd: ["NET_ADMIN"],
        capDrop: ["MKNOD"]
      });

      expect(config.entrypoint).toEqual(["/bin/bash"]);
      expect(config.command).toEqual(["--version"]);
      expect(config.securityOpts).toEqual(["no-new-privileges:true"]);
      expect(config.capAdd).toEqual(["NET_ADMIN"]);
      expect(config.capDrop).toEqual(["MKNOD"]);
    });

    it('should accept multi-element arrays', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        entrypoint: ["/usr/local/bin/node", "--enable-source-maps"],
        command: ["npm", "start", "--", "--port", "3000"],
        securityOpts: ["no-new-privileges:true", "apparmor:unconfined"],
        capAdd: ["NET_ADMIN", "SYS_TIME"],
        capDrop: ["ALL", "NET_RAW"]
      });

      expect(config.entrypoint).toEqual(["/usr/local/bin/node", "--enable-source-maps"]);
      expect(config.command).toEqual(["npm", "start", "--", "--port", "3000"]);
      expect(config.securityOpts).toEqual(["no-new-privileges:true", "apparmor:unconfined"]);
      expect(config.capAdd).toEqual(["NET_ADMIN", "SYS_TIME"]);
      expect(config.capDrop).toEqual(["ALL", "NET_RAW"]);
    });
  });

  describe('Record field validation edge cases', () => {
    it('should accept empty objects for optional record fields', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        volumes: {},
        environment: {},
        labels: {}
      });

      expect(config.volumes).toEqual({});
      expect(config.environment).toEqual({});
      expect(config.labels).toEqual({});
    });

    it('should accept special characters in record values', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        environment: {
          "SPECIAL_CHARS": "!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`",
          "PATH": "/usr/local/bin:/usr/bin:/bin",
          "JSON_CONFIG": '{"key": "value", "nested": {"array": [1, 2, 3]}}'
        },
        labels: {
          "com.example.description": "A very long description with spaces and punctuation!",
          "com.example.version": "v1.0.0-alpha.1+build.123"
        }
      });

      expect(config.environment?.["SPECIAL_CHARS"]).toBe("!@#$%^&*()_+-={}[]|\\:;\"'<>,.?/~`");
      expect(config.environment?.["PATH"]).toBe("/usr/local/bin:/usr/bin:/bin");
      expect(config.environment?.["JSON_CONFIG"]).toBe('{"key": "value", "nested": {"array": [1, 2, 3]}}');
      expect(config.labels?.["com.example.description"]).toBe("A very long description with spaces and punctuation!");
      expect(config.labels?.["com.example.version"]).toBe("v1.0.0-alpha.1+build.123");
    });

    it('should accept numeric-looking strings in record values', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        environment: {
          "PORT": "3000",
          "TIMEOUT": "30000",
          "FLOAT_VALUE": "3.14159",
          "NEGATIVE": "-123"
        }
      });

      expect(config.environment?.["PORT"]).toBe("3000");
      expect(config.environment?.["TIMEOUT"]).toBe("30000");
      expect(config.environment?.["FLOAT_VALUE"]).toBe("3.14159");
      expect(config.environment?.["NEGATIVE"]).toBe("-123");
    });
  });

  describe('Default value verification', () => {
    it('should apply correct default values', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20"
      });

      expect(config.networkMode).toBe("bridge");
      expect(config.autoRemove).toBe(true);
      expect(config.privileged).toBe(false);
    });

    it('should preserve explicitly set defaults', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        networkMode: "bridge",
        autoRemove: true,
        privileged: false
      });

      expect(config.networkMode).toBe("bridge");
      expect(config.autoRemove).toBe(true);
      expect(config.privileged).toBe(false);
    });

    it('should override defaults when specified', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        networkMode: "host",
        autoRemove: false,
        privileged: true
      });

      expect(config.networkMode).toBe("host");
      expect(config.autoRemove).toBe(false);
      expect(config.privileged).toBe(true);
    });
  });

  describe('Type coercion behavior', () => {
    it('should not coerce numeric strings to numbers for installTimeout', () => {
      expect(() => ContainerConfigSchema.parse({
        image: "node:20",
        installTimeout: "300000" // String instead of number
      })).toThrow();
    });

    it('should not coerce numeric strings to numbers for installRetries', () => {
      expect(() => ContainerConfigSchema.parse({
        image: "node:20",
        installRetries: "3" // String instead of number
      })).toThrow();
    });

    it('should not coerce string booleans to boolean values', () => {
      expect(() => ContainerConfigSchema.parse({
        image: "node:20",
        privileged: "true" // String instead of boolean
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: "node:20",
        autoRemove: "false" // String instead of boolean
      })).toThrow();
    });
  });
});