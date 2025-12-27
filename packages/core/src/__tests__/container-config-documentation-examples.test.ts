import { describe, it, expect } from 'vitest';
import {
  ContainerConfigSchema,
  ResourceLimitsSchema,
  ApexConfigSchema,
  WorkspaceConfigSchema
} from '../types';

/**
 * Test suite to validate all container configuration examples from documentation.
 * This ensures documentation examples are accurate and work correctly.
 *
 * References:
 * - docs/container-configuration.md
 * - docs/container-isolation.md
 */
describe('Container Configuration Documentation Examples', () => {

  describe('Basic image configuration examples', () => {
    it('should validate simple image configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20-alpine"
      });

      expect(config.image).toBe("node:20-alpine");
      expect(config.networkMode).toBe("bridge"); // default value
      expect(config.autoRemove).toBe(true); // default value
      expect(config.privileged).toBe(false); // default value
    });

    it('should validate alternative base images from docs', () => {
      const validImages = [
        "node:20-alpine",
        "python:3.11-slim",
        "ubuntu:22.04",
        "ghcr.io/myorg/myimage:v1.0"
      ];

      for (const image of validImages) {
        const config = ContainerConfigSchema.parse({ image });
        expect(config.image).toBe(image);
      }
    });
  });

  describe('Custom Dockerfile examples', () => {
    it('should validate Dockerfile configuration example', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20", // Still required as base
        dockerfile: ".apex/Dockerfile",
        buildContext: ".",
        imageTag: "my-project:dev"
      });

      expect(config.dockerfile).toBe(".apex/Dockerfile");
      expect(config.buildContext).toBe(".");
      expect(config.imageTag).toBe("my-project:dev");
    });

    it('should validate development Dockerfile example', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        dockerfile: "docker/Dockerfile.dev",
        buildContext: "."
      });

      expect(config.dockerfile).toBe("docker/Dockerfile.dev");
      expect(config.buildContext).toBe(".");
    });

    it('should validate custom tag example', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        dockerfile: ".apex/Dockerfile",
        imageTag: "my-project:apex-dev"
      });

      expect(config.imageTag).toBe("my-project:apex-dev");
    });
  });

  describe('Resource limits examples from documentation table', () => {
    it('should validate CPU core examples', () => {
      const examples = [
        { cpu: 2, description: "2 full cores" },
        { cpu: 0.5, description: "Half a core" },
        { cpu: 1.5, description: "1.5 cores" }
      ];

      for (const example of examples) {
        const resourceLimits = ResourceLimitsSchema.parse({ cpu: example.cpu });
        expect(resourceLimits.cpu).toBe(example.cpu);
      }
    });

    it('should validate memory examples from docs', () => {
      const examples = [
        { memory: "4g", description: "4 gigabytes" },
        { memory: "512m", description: "512 megabytes" },
        { memory: "2048m", description: "2 gigabytes" }
      ];

      for (const example of examples) {
        const resourceLimits = ResourceLimitsSchema.parse({ memory: example.memory });
        expect(resourceLimits.memory).toBe(example.memory);
      }
    });

    it('should validate memory reservation and swap examples', () => {
      const resourceLimits = ResourceLimitsSchema.parse({
        memory: "2g",
        memoryReservation: "1g",
        memorySwap: "4g"
      });

      expect(resourceLimits.memory).toBe("2g");
      expect(resourceLimits.memoryReservation).toBe("1g");
      expect(resourceLimits.memorySwap).toBe("4g");
    });

    it('should validate CPU shares example', () => {
      const resourceLimits = ResourceLimitsSchema.parse({
        cpuShares: 512  // Half weight (1024 = 1 share)
      });

      expect(resourceLimits.cpuShares).toBe(512);
    });

    it('should validate PIDs limit example', () => {
      const resourceLimits = ResourceLimitsSchema.parse({
        pidsLimit: 100
      });

      expect(resourceLimits.pidsLimit).toBe(100);
    });
  });

  describe('Environment variables examples', () => {
    it('should validate environment variables configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        environment: {
          NODE_ENV: "development",
          DEBUG: "*",
          PORT: "3000"
        }
      });

      expect(config.environment).toEqual({
        NODE_ENV: "development",
        DEBUG: "*",
        PORT: "3000"
      });
    });
  });

  describe('Volume mounting examples', () => {
    it('should validate volume mounting configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        volumes: {
          "./src": "/app/src",
          "./node_modules": "/app/node_modules",
          "/tmp": "/tmp"
        }
      });

      expect(config.volumes).toEqual({
        "./src": "/app/src",
        "./node_modules": "/app/node_modules",
        "/tmp": "/tmp"
      });
    });
  });

  describe('Network mode examples', () => {
    it('should validate all documented network modes', () => {
      const networkModes = ['bridge', 'host', 'none', 'container'] as const;

      for (const networkMode of networkModes) {
        const config = ContainerConfigSchema.parse({
          image: "node:20",
          networkMode
        });

        expect(config.networkMode).toBe(networkMode);
      }
    });

    it('should default to bridge when not specified', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20"
      });

      expect(config.networkMode).toBe('bridge');
    });
  });

  describe('Security options examples', () => {
    it('should validate security options configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        securityOpts: ["no-new-privileges:true"],
        capDrop: ["ALL"],
        capAdd: ["NET_BIND_SERVICE"]
      });

      expect(config.securityOpts).toEqual(["no-new-privileges:true"]);
      expect(config.capDrop).toEqual(["ALL"]);
      expect(config.capAdd).toEqual(["NET_BIND_SERVICE"]);
    });

    it('should validate privileged mode configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        privileged: true
      });

      expect(config.privileged).toBe(true);
    });
  });

  describe('Working directory and user examples', () => {
    it('should validate working directory configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        workingDir: "/app"
      });

      expect(config.workingDir).toBe("/app");
    });

    it('should validate user configuration examples', () => {
      const userConfigs = ["1000:1000", "node", "root"];

      for (const user of userConfigs) {
        const config = ContainerConfigSchema.parse({
          image: "node:20",
          user
        });

        expect(config.user).toBe(user);
      }
    });
  });

  describe('Container labels examples', () => {
    it('should validate container labels configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        labels: {
          "com.example.project": "my-app",
          "com.example.version": "1.0.0",
          "apex.task-id": "task-123"
        }
      });

      expect(config.labels).toEqual({
        "com.example.project": "my-app",
        "com.example.version": "1.0.0",
        "apex.task-id": "task-123"
      });
    });
  });

  describe('Entrypoint and command examples', () => {
    it('should validate entrypoint override', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        entrypoint: ["/usr/local/bin/node"]
      });

      expect(config.entrypoint).toEqual(["/usr/local/bin/node"]);
    });

    it('should validate command override', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        command: ["npm", "run", "dev"]
      });

      expect(config.command).toEqual(["npm", "run", "dev"]);
    });

    it('should validate entrypoint and command together', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        entrypoint: ["/usr/local/bin/node"],
        command: ["--version"]
      });

      expect(config.entrypoint).toEqual(["/usr/local/bin/node"]);
      expect(config.command).toEqual(["--version"]);
    });
  });

  describe('Dependency installation examples', () => {
    it('should validate auto dependency installation configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        autoDependencyInstall: true,
        useFrozenLockfile: true,
        installTimeout: 300000,
        installRetries: 3
      });

      expect(config.autoDependencyInstall).toBe(true);
      expect(config.useFrozenLockfile).toBe(true);
      expect(config.installTimeout).toBe(300000);
      expect(config.installRetries).toBe(3);
    });

    it('should validate custom install command', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        customInstallCommand: "npm ci --only=production"
      });

      expect(config.customInstallCommand).toBe("npm ci --only=production");
    });

    it('should validate disabled auto dependency installation', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:20",
        autoDependencyInstall: false
      });

      expect(config.autoDependencyInstall).toBe(false);
    });
  });

  describe('Complete workspace configuration examples', () => {
    it('should validate basic workspace container configuration from docs', () => {
      const workspaceConfig = WorkspaceConfigSchema.parse({
        strategy: "container",
        cleanup: true,
        preserveOnFailure: false,
        container: {
          image: "node:20-alpine",
          resourceLimits: {
            cpu: 2,
            memory: "4g"
          },
          environment: {
            NODE_ENV: "development"
          }
        }
      });

      expect(workspaceConfig.strategy).toBe("container");
      expect(workspaceConfig.cleanup).toBe(true);
      expect(workspaceConfig.preserveOnFailure).toBe(false);
      expect(workspaceConfig.container?.image).toBe("node:20-alpine");
      expect(workspaceConfig.container?.resourceLimits?.cpu).toBe(2);
      expect(workspaceConfig.container?.resourceLimits?.memory).toBe("4g");
      expect(workspaceConfig.container?.environment?.NODE_ENV).toBe("development");
    });

    it('should validate advanced workspace container configuration', () => {
      const workspaceConfig = WorkspaceConfigSchema.parse({
        strategy: "container",
        cleanup: true,
        container: {
          image: "node:20",
          dockerfile: ".apex/Dockerfile",
          buildContext: ".",
          imageTag: "my-project:dev",
          volumes: {
            "./src": "/app/src"
          },
          resourceLimits: {
            cpu: 1.5,
            memory: "2g",
            memoryReservation: "1g"
          },
          networkMode: "bridge",
          workingDir: "/app",
          user: "1000:1000",
          autoRemove: true,
          privileged: false
        }
      });

      expect(workspaceConfig.container?.dockerfile).toBe(".apex/Dockerfile");
      expect(workspaceConfig.container?.buildContext).toBe(".");
      expect(workspaceConfig.container?.imageTag).toBe("my-project:dev");
      expect(workspaceConfig.container?.volumes).toEqual({"./src": "/app/src"});
      expect(workspaceConfig.container?.resourceLimits?.cpu).toBe(1.5);
      expect(workspaceConfig.container?.resourceLimits?.memory).toBe("2g");
      expect(workspaceConfig.container?.resourceLimits?.memoryReservation).toBe("1g");
      expect(workspaceConfig.container?.networkMode).toBe("bridge");
      expect(workspaceConfig.container?.workingDir).toBe("/app");
      expect(workspaceConfig.container?.user).toBe("1000:1000");
      expect(workspaceConfig.container?.autoRemove).toBe(true);
      expect(workspaceConfig.container?.privileged).toBe(false);
    });
  });

  describe('Per-task override examples', () => {
    it('should validate task-specific container overrides', () => {
      // This tests the scenario where a task overrides global container settings
      const taskContainerConfig = ContainerConfigSchema.parse({
        image: "python:3.11-slim", // Override base image
        resourceLimits: {
          cpu: 4, // More CPU for compute-intensive task
          memory: "8g" // More memory
        },
        environment: {
          PYTHONPATH: "/app",
          DEBUG: "1"
        }
      });

      expect(taskContainerConfig.image).toBe("python:3.11-slim");
      expect(taskContainerConfig.resourceLimits?.cpu).toBe(4);
      expect(taskContainerConfig.resourceLimits?.memory).toBe("8g");
      expect(taskContainerConfig.environment?.PYTHONPATH).toBe("/app");
      expect(taskContainerConfig.environment?.DEBUG).toBe("1");
    });
  });
});