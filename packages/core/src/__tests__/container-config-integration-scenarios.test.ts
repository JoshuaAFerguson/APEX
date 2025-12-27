import { describe, it, expect } from 'vitest';
import {
  ContainerConfigSchema,
  WorkspaceConfigSchema,
  ApexConfigSchema
} from '../types';

/**
 * Integration tests for container configuration in realistic scenarios.
 * These tests simulate real-world usage patterns and complex configurations.
 */
describe('Container Configuration Integration Scenarios', () => {

  describe('Development environment scenarios', () => {
    it('should validate Node.js development environment configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:18-alpine",
        volumes: {
          "./": "/workspace",
          "./node_modules": "/workspace/node_modules",
          "/tmp": "/tmp"
        },
        environment: {
          NODE_ENV: "development",
          DEBUG: "*",
          CHOKIDAR_USEPOLLING: "true",
          WATCHPACK_POLLING: "true"
        },
        resourceLimits: {
          cpu: 2,
          memory: "4g"
        },
        workingDir: "/workspace",
        user: "1000:1000",
        networkMode: "bridge",
        autoDependencyInstall: true,
        useFrozenLockfile: false,
        installTimeout: 300000
      });

      expect(config.image).toBe("node:18-alpine");
      expect(config.environment?.NODE_ENV).toBe("development");
      expect(config.environment?.DEBUG).toBe("*");
      expect(config.volumes?.["./"]).toBe("/workspace");
      expect(config.resourceLimits?.cpu).toBe(2);
      expect(config.resourceLimits?.memory).toBe("4g");
      expect(config.autoDependencyInstall).toBe(true);
      expect(config.useFrozenLockfile).toBe(false);
    });

    it('should validate Python development environment configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "python:3.11-slim",
        volumes: {
          "./src": "/app/src",
          "./requirements.txt": "/app/requirements.txt",
          "./pyproject.toml": "/app/pyproject.toml"
        },
        environment: {
          PYTHONPATH: "/app/src",
          PYTHONDONTWRITEBYTECODE: "1",
          PYTHONUNBUFFERED: "1",
          PIP_NO_CACHE_DIR: "1"
        },
        resourceLimits: {
          cpu: 1,
          memory: "2g"
        },
        workingDir: "/app",
        customInstallCommand: "pip install -r requirements.txt",
        autoDependencyInstall: true,
        installTimeout: 600000,
        installRetries: 2
      });

      expect(config.image).toBe("python:3.11-slim");
      expect(config.environment?.PYTHONPATH).toBe("/app/src");
      expect(config.environment?.PYTHONDONTWRITEBYTECODE).toBe("1");
      expect(config.customInstallCommand).toBe("pip install -r requirements.txt");
      expect(config.installTimeout).toBe(600000);
      expect(config.installRetries).toBe(2);
    });
  });

  describe('Production-like environment scenarios', () => {
    it('should validate production container with security constraints', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:18-alpine",
        resourceLimits: {
          cpu: 0.5,
          memory: "1g",
          memoryReservation: "512m",
          cpuShares: 512,
          pidsLimit: 50
        },
        user: "node",
        privileged: false,
        securityOpts: ["no-new-privileges:true"],
        capDrop: ["ALL"],
        capAdd: ["NET_BIND_SERVICE"],
        environment: {
          NODE_ENV: "production",
          PORT: "3000"
        },
        networkMode: "bridge",
        autoRemove: true,
        labels: {
          "com.example.environment": "production",
          "com.example.tier": "web"
        }
      });

      expect(config.resourceLimits?.cpu).toBe(0.5);
      expect(config.resourceLimits?.memory).toBe("1g");
      expect(config.resourceLimits?.pidsLimit).toBe(50);
      expect(config.user).toBe("node");
      expect(config.privileged).toBe(false);
      expect(config.securityOpts).toEqual(["no-new-privileges:true"]);
      expect(config.capDrop).toEqual(["ALL"]);
      expect(config.capAdd).toEqual(["NET_BIND_SERVICE"]);
    });

    it('should validate high-performance compute container', () => {
      const config = ContainerConfigSchema.parse({
        image: "python:3.11",
        resourceLimits: {
          cpu: 8,
          memory: "16g",
          memorySwap: "20g",
          cpuShares: 4096
        },
        environment: {
          OMP_NUM_THREADS: "8",
          CUDA_VISIBLE_DEVICES: "0,1",
          PYTHONUNBUFFERED: "1"
        },
        volumes: {
          "/data": "/workspace/data",
          "/tmp": "/tmp",
          "/dev/shm": "/dev/shm"
        },
        networkMode: "host",
        privileged: false,
        autoRemove: false, // Keep for debugging
        labels: {
          "com.example.workload": "compute-intensive",
          "com.example.gpu": "enabled"
        }
      });

      expect(config.resourceLimits?.cpu).toBe(8);
      expect(config.resourceLimits?.memory).toBe("16g");
      expect(config.resourceLimits?.memorySwap).toBe("20g");
      expect(config.environment?.OMP_NUM_THREADS).toBe("8");
      expect(config.networkMode).toBe("host");
      expect(config.autoRemove).toBe(false);
    });
  });

  describe('CI/CD pipeline scenarios', () => {
    it('should validate CI build container configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:18",
        dockerfile: ".ci/Dockerfile",
        buildContext: ".",
        imageTag: "build:${BUILD_ID}",
        volumes: {
          "./": "/workspace",
          "/var/run/docker.sock": "/var/run/docker.sock"
        },
        environment: {
          CI: "true",
          NODE_ENV: "test",
          COVERAGE: "true",
          BUILD_ID: "${BUILD_ID}",
          GIT_COMMIT: "${GIT_COMMIT}"
        },
        resourceLimits: {
          cpu: 4,
          memory: "8g",
          pidsLimit: 200
        },
        workingDir: "/workspace",
        user: "1001:1001",
        autoRemove: true,
        customInstallCommand: "npm ci --frozen-lockfile",
        useFrozenLockfile: true,
        installTimeout: 600000,
        installRetries: 3
      });

      expect(config.dockerfile).toBe(".ci/Dockerfile");
      expect(config.imageTag).toBe("build:${BUILD_ID}");
      expect(config.environment?.CI).toBe("true");
      expect(config.environment?.NODE_ENV).toBe("test");
      expect(config.customInstallCommand).toBe("npm ci --frozen-lockfile");
      expect(config.useFrozenLockfile).toBe(true);
      expect(config.installRetries).toBe(3);
    });

    it('should validate test runner container configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "mcr.microsoft.com/playwright:v1.30.0-focal",
        environment: {
          CI: "true",
          PLAYWRIGHT_BROWSERS_PATH: "0",
          NODE_ENV: "test"
        },
        volumes: {
          "./": "/workspace",
          "./test-results": "/workspace/test-results",
          "./playwright-report": "/workspace/playwright-report"
        },
        resourceLimits: {
          cpu: 2,
          memory: "4g",
          pidsLimit: 100
        },
        workingDir: "/workspace",
        networkMode: "bridge",
        securityOpts: ["seccomp:unconfined"],
        capAdd: ["SYS_ADMIN"], // Needed for Chrome sandbox
        autoRemove: true
      });

      expect(config.image).toBe("mcr.microsoft.com/playwright:v1.30.0-focal");
      expect(config.environment?.PLAYWRIGHT_BROWSERS_PATH).toBe("0");
      expect(config.securityOpts).toEqual(["seccomp:unconfined"]);
      expect(config.capAdd).toEqual(["SYS_ADMIN"]);
    });
  });

  describe('Database and service scenarios', () => {
    it('should validate database container configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "postgres:15",
        environment: {
          POSTGRES_DB: "testdb",
          POSTGRES_USER: "testuser",
          POSTGRES_PASSWORD: "testpass",
          PGDATA: "/var/lib/postgresql/data/pgdata"
        },
        volumes: {
          "./db-data": "/var/lib/postgresql/data",
          "./init-scripts": "/docker-entrypoint-initdb.d"
        },
        resourceLimits: {
          cpu: 1,
          memory: "2g",
          pidsLimit: 100
        },
        networkMode: "bridge",
        autoRemove: false,
        labels: {
          "com.example.service": "database",
          "com.example.version": "15"
        },
        entrypoint: ["docker-entrypoint.sh"],
        command: ["postgres", "-c", "log_statement=all"]
      });

      expect(config.image).toBe("postgres:15");
      expect(config.environment?.POSTGRES_DB).toBe("testdb");
      expect(config.volumes?.["./db-data"]).toBe("/var/lib/postgresql/data");
      expect(config.entrypoint).toEqual(["docker-entrypoint.sh"]);
      expect(config.command).toEqual(["postgres", "-c", "log_statement=all"]);
    });

    it('should validate Redis cache container configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "redis:7-alpine",
        resourceLimits: {
          cpu: 0.5,
          memory: "512m",
          pidsLimit: 20
        },
        environment: {
          REDIS_ARGS: "--requirepass mypassword --maxmemory 256mb --maxmemory-policy allkeys-lru"
        },
        networkMode: "bridge",
        autoRemove: true,
        labels: {
          "com.example.service": "cache",
          "com.example.tier": "infrastructure"
        },
        command: ["redis-server", "--requirepass", "mypassword"]
      });

      expect(config.image).toBe("redis:7-alpine");
      expect(config.resourceLimits?.memory).toBe("512m");
      expect(config.command).toEqual(["redis-server", "--requirepass", "mypassword"]);
    });
  });

  describe('Multi-service workspace scenarios', () => {
    it('should validate web application workspace with container strategy', () => {
      const workspaceConfig = WorkspaceConfigSchema.parse({
        strategy: "container",
        cleanup: false, // Keep for debugging
        preserveOnFailure: true,
        container: {
          image: "node:18",
          dockerfile: ".apex/Dockerfile.dev",
          buildContext: ".",
          volumes: {
            "./": "/workspace",
            "./node_modules": "/workspace/node_modules"
          },
          environment: {
            NODE_ENV: "development",
            PORT: "3000",
            DATABASE_URL: "postgresql://user:pass@db:5432/app"
          },
          resourceLimits: {
            cpu: 2,
            memory: "4g"
          },
          networkMode: "bridge",
          workingDir: "/workspace",
          autoDependencyInstall: true,
          customInstallCommand: "npm install && npm run build:dev"
        }
      });

      expect(workspaceConfig.strategy).toBe("container");
      expect(workspaceConfig.cleanup).toBe(false);
      expect(workspaceConfig.preserveOnFailure).toBe(true);
      expect(workspaceConfig.container?.dockerfile).toBe(".apex/Dockerfile.dev");
      expect(workspaceConfig.container?.customInstallCommand).toBe("npm install && npm run build:dev");
    });
  });

  describe('Security-focused scenarios', () => {
    it('should validate hardened container configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "alpine:3.18",
        user: "65534:65534", // nobody:nobody
        privileged: false,
        securityOpts: [
          "no-new-privileges:true",
          "apparmor:docker-default",
          "seccomp:default"
        ],
        capDrop: ["ALL"],
        resourceLimits: {
          cpu: 0.25,
          memory: "128m",
          pidsLimit: 10
        },
        networkMode: "none", // No network access
        autoRemove: true,
        environment: {
          "TERM": "xterm",
          "HOME": "/tmp"
        },
        workingDir: "/tmp",
        entrypoint: ["/bin/sh", "-c"],
        command: ["echo 'Secure container'"]
      });

      expect(config.user).toBe("65534:65534");
      expect(config.privileged).toBe(false);
      expect(config.securityOpts).toContain("no-new-privileges:true");
      expect(config.capDrop).toEqual(["ALL"]);
      expect(config.networkMode).toBe("none");
      expect(config.resourceLimits?.pidsLimit).toBe(10);
    });

    it('should validate container with minimal capabilities', () => {
      const config = ContainerConfigSchema.parse({
        image: "nginx:alpine",
        user: "nginx",
        privileged: false,
        securityOpts: ["no-new-privileges:true"],
        capDrop: [
          "ALL",
          "AUDIT_CONTROL",
          "AUDIT_WRITE",
          "BLOCK_SUSPEND",
          "CHOWN",
          "DAC_OVERRIDE"
        ],
        capAdd: [
          "NET_BIND_SERVICE", // Needed for binding to port 80
          "CHOWN",           // Needed for nginx log rotation
          "SETGID",          // Needed for user switching
          "SETUID"           // Needed for user switching
        ],
        resourceLimits: {
          cpu: 1,
          memory: "512m"
        },
        networkMode: "bridge"
      });

      expect(config.capAdd).toContain("NET_BIND_SERVICE");
      expect(config.capDrop).toContain("ALL");
      expect(config.user).toBe("nginx");
    });
  });

  describe('Error recovery and debugging scenarios', () => {
    it('should validate debug-friendly container configuration', () => {
      const config = ContainerConfigSchema.parse({
        image: "node:18",
        environment: {
          DEBUG: "*",
          NODE_OPTIONS: "--inspect=0.0.0.0:9229 --enable-source-maps",
          FORCE_COLOR: "1"
        },
        volumes: {
          "./": "/workspace",
          "./logs": "/workspace/logs"
        },
        resourceLimits: {
          cpu: 1,
          memory: "2g"
        },
        workingDir: "/workspace",
        autoRemove: false, // Keep for post-mortem debugging
        labels: {
          "com.example.debug": "enabled",
          "com.example.inspect-port": "9229"
        },
        entrypoint: ["/usr/local/bin/node"],
        command: ["--inspect=0.0.0.0:9229", "server.js"]
      });

      expect(config.environment?.DEBUG).toBe("*");
      expect(config.environment?.NODE_OPTIONS).toContain("--inspect");
      expect(config.autoRemove).toBe(false);
      expect(config.labels?.["com.example.debug"]).toBe("enabled");
    });
  });
});