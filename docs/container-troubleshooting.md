# Container Troubleshooting Guide

This guide provides solutions to common container-related issues in APEX. For general container setup and configuration, see the [Container Isolation Guide](./container-isolation.md) and [Container Configuration Reference](./container-configuration.md).

## Quick Diagnostics

Before diving into specific issues, run these commands to check your container setup:

```bash
# Check container runtime availability
docker --version && docker info
# OR
podman --version && podman info

# Check APEX container configuration
apex config

# List running APEX containers
docker ps --filter "label=apex.managed=true"
# OR
podman ps --filter "label=apex.managed=true"

# Check recent APEX tasks
apex status

# Test container creation (dry run)
apex run "echo 'Container test'" --workspace-strategy container --dry-run
```

---

## Container Runtime Issues

### "No container runtime available"

**Error:**
```
Error: No container runtime available. Please install Docker or Podman.
```

**Cause:** Neither Docker nor Podman is installed or accessible.

**Solutions:**

1. **Install Docker:**
   ```bash
   # macOS (via Homebrew)
   brew install --cask docker

   # Ubuntu/Debian
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh

   # Start Docker service
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

2. **Install Podman:**
   ```bash
   # macOS
   brew install podman

   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install -y podman

   # Initialize Podman machine (macOS)
   podman machine init
   podman machine start
   ```

3. **Verify installation:**
   ```bash
   # Test Docker
   docker run hello-world

   # OR test Podman
   podman run hello-world
   ```

---

### "Docker daemon not running"

**Error:**
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

**Cause:** Docker service is not started.

**Solutions:**

1. **Linux - Start Docker service:**
   ```bash
   sudo systemctl start docker
   sudo systemctl enable docker  # Auto-start on boot

   # Add user to docker group (avoid sudo)
   sudo usermod -aG docker $USER
   newgrp docker  # Apply group changes
   ```

2. **macOS - Start Docker Desktop:**
   ```bash
   # Open Docker Desktop application
   open /Applications/Docker.app

   # Or via command line
   docker context use desktop-linux
   ```

3. **Windows - Start Docker Desktop:**
   - Open Docker Desktop from Start menu
   - Wait for Docker to finish starting
   - Check system tray for Docker icon

4. **Verify Docker is running:**
   ```bash
   docker info
   docker ps  # Should not error
   ```

---

### "Permission denied accessing Docker"

**Error:**
```
permission denied while trying to connect to the Docker daemon socket
```

**Cause:** User doesn't have permission to access Docker.

**Solutions:**

1. **Add user to docker group (Linux):**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker

   # Test without sudo
   docker ps
   ```

2. **Fix socket permissions (temporary):**
   ```bash
   sudo chmod 666 /var/run/docker.sock
   ```

3. **Run with sudo (not recommended for production):**
   ```bash
   sudo apex run "task" --workspace-strategy container
   ```

4. **Use rootless Docker:**
   ```bash
   # Install rootless Docker
   curl -fsSL https://get.docker.com/rootless | sh

   # Set environment variables
   export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
   ```

---

### "Podman socket connection failed"

**Error:**
```
Error: unable to connect to Podman socket
```

**Cause:** Podman service not running or socket not accessible.

**Solutions:**

1. **Start Podman socket (Linux):**
   ```bash
   systemctl --user enable podman.socket
   systemctl --user start podman.socket

   # Verify socket
   systemctl --user status podman.socket
   ```

2. **Start Podman machine (macOS/Windows):**
   ```bash
   podman machine start

   # Check status
   podman machine list
   ```

3. **Check Podman connection:**
   ```bash
   podman system connection list
   podman info
   ```

---

## Container Creation Issues

### "Image not found"

**Error:**
```
Error response from daemon: pull access denied for myimage, repository does not exist
```

**Cause:** Specified image doesn't exist or is inaccessible.

**Solutions:**

1. **Check image name:**
   ```yaml
   # .apex/config.yaml - Use correct image
   workspace:
     container:
       image: "node:20-alpine"  # Correct
       # image: "nodejs:20"     # Incorrect
   ```

2. **Pull image manually:**
   ```bash
   docker pull node:20-alpine
   # OR
   podman pull node:20-alpine
   ```

3. **Use alternative image:**
   ```yaml
   workspace:
     container:
       image: "node:18-alpine"  # Fallback if 20 unavailable
   ```

4. **For private images, login first:**
   ```bash
   docker login your-registry.com
   docker pull your-registry.com/your-image:tag
   ```

---

### "Container startup timeout"

**Error:**
```
Container creation failed: timeout waiting for container to start
```

**Cause:** Container takes too long to start, often due to large image or slow network.

**Solutions:**

1. **Increase timeout:**
   ```yaml
   workspace:
     container:
       image: "node:20-alpine"
       # Add startup timeout (default: 30s)
       startupTimeout: 120000  # 2 minutes
   ```

2. **Use lighter base image:**
   ```yaml
   workspace:
     container:
       image: "node:20-alpine"    # Light (200MB)
       # image: "node:20"         # Heavy (1GB+)
   ```

3. **Pre-pull large images:**
   ```bash
   docker pull node:20-alpine
   # Then run APEX task
   apex run "task" --workspace-strategy container
   ```

4. **Check resource limits:**
   ```yaml
   workspace:
     container:
       resourceLimits:
         memory: "2g"     # Increase if too low
         cpu: 1           # Increase if too low
   ```

---

### "Volume mount failed"

**Error:**
```
Error response from daemon: invalid bind mount spec: invalid volume specification
```

**Cause:** Invalid volume mount path or permissions.

**Solutions:**

1. **Fix path format:**
   ```yaml
   workspace:
     container:
       volumes:
         "./data": "/app/data"           # Correct relative path
         "/home/user/data": "/app/data"  # Correct absolute path
         # "~/data": "/app/data"         # Incorrect: ~ not expanded
   ```

2. **Create host directories:**
   ```bash
   mkdir -p ./data ./config ./cache

   # Set proper permissions
   chmod 755 ./data
   ```

3. **Use absolute paths:**
   ```yaml
   workspace:
     container:
       volumes:
         "/absolute/path/to/data": "/app/data"
   ```

4. **Check SELinux context (Linux):**
   ```bash
   # Set SELinux context for volume mount
   sudo chcon -Rt svirt_sandbox_file_t /path/to/host/directory

   # Or use :Z flag in mount
   volumes:
     "./data": "/app/data:Z"
   ```

---

## Resource Management Issues

### "Out of Memory (OOM) Killed"

**Error:**
```
Container exited with code 137 (OOM Killed)
```

**Cause:** Container exceeded memory limit and was killed by the kernel.

**Solutions:**

1. **Increase memory limit:**
   ```yaml
   workspace:
     container:
       resourceLimits:
         memory: "8g"              # Increase from default
         memorySwap: "16g"         # Allow swap usage
         memoryReservation: "4g"   # Soft limit
   ```

2. **Monitor memory usage:**
   ```bash
   # Check container memory usage
   docker stats $(docker ps -q --filter "label=apex.managed=true")

   # Check memory details
   docker inspect <container-id> | jq '.[].HostConfig.Memory'
   ```

3. **Use memory-efficient base image:**
   ```yaml
   workspace:
     container:
       image: "node:20-alpine"    # Less memory than full node
   ```

4. **Optimize application memory:**
   ```bash
   # For Node.js applications
   apex run "Optimize memory usage: reduce bundle size, use streaming for large files"
   ```

5. **Enable memory monitoring:**
   ```yaml
   workspace:
     container:
       healthCheck:
         enabled: true
         interval: 30s
       resourceLimits:
         memory: "4g"
         memoryReservation: "2g"  # Warn before hitting limit
   ```

---

### "CPU throttling detected"

**Error:**
```
Task running slowly, CPU throttling detected
```

**Cause:** Container is hitting CPU limits.

**Solutions:**

1. **Increase CPU allocation:**
   ```yaml
   workspace:
     container:
       resourceLimits:
         cpu: 4              # Increase CPU cores
         cpuShares: 2048     # Higher priority
   ```

2. **Check CPU usage:**
   ```bash
   docker stats --no-stream <container-id>
   ```

3. **Optimize for CPU-bound tasks:**
   ```bash
   # Use more CPU for intensive tasks
   apex run "build production" \
     --container-cpu 4 \
     --container-memory "8g"
   ```

4. **Use dedicated resource pool:**
   ```yaml
   workspace:
     container:
       resourceLimits:
         cpuShares: 4096     # Highest priority
         cpuSetCpus: "0-3"   # Pin to specific cores
   ```

---

### "Disk space exhausted"

**Error:**
```
Error: no space left on device
```

**Cause:** Container or host running out of disk space.

**Solutions:**

1. **Clean up Docker resources:**
   ```bash
   # Remove unused containers, images, networks
   docker system prune -a -f

   # Remove unused volumes
   docker volume prune -f

   # Remove APEX containers specifically
   docker container prune --filter "label=apex.managed=true" -f
   ```

2. **Monitor disk usage:**
   ```bash
   # Check container disk usage
   docker system df

   # Check specific container
   docker exec <container-id> df -h
   ```

3. **Add disk limits:**
   ```yaml
   workspace:
     container:
       resourceLimits:
         storageLimit: "10g"    # Limit container storage
   ```

4. **Use mounted volumes for large data:**
   ```yaml
   workspace:
     container:
       volumes:
         "./large-data": "/app/data"  # Store on host
   ```

---

## Dependency Installation Issues

### "Package installation failed"

**Error:**
```
npm ERR! network timeout
npm ERR! network This is a problem related to network connectivity
```

**Cause:** Network issues, registry problems, or timeout during dependency installation.

**Solutions:**

1. **Increase installation timeout:**
   ```yaml
   workspace:
     container:
       installTimeout: 600000    # 10 minutes
       installRetries: 3         # Retry on failure
   ```

2. **Use different registry:**
   ```yaml
   workspace:
     container:
       environment:
         NPM_REGISTRY: "https://registry.npmjs.org/"
         # Or use internal registry
         NPM_REGISTRY: "https://npm.company.com/"
   ```

3. **Enable offline installation:**
   ```yaml
   workspace:
     container:
       customInstallCommand: "npm ci --prefer-offline"
       useFrozenLockfile: true
   ```

4. **Pre-install dependencies in custom image:**
   ```dockerfile
   # .apex/Dockerfile
   FROM node:20-alpine

   WORKDIR /workspace

   # Copy package files
   COPY package*.json ./

   # Install dependencies
   RUN npm ci --production --prefer-offline

   CMD ["tail", "-f", "/dev/null"]
   ```

5. **Configure npm in container:**
   ```yaml
   workspace:
     container:
       environment:
         NPM_CONFIG_UPDATE_NOTIFIER: "false"
         NPM_CONFIG_AUDIT: "false"
         NPM_CONFIG_FUND: "false"
         NPM_CONFIG_TIMEOUT: "300000"
   ```

---

### "Permission denied writing to node_modules"

**Error:**
```
Error: EACCES: permission denied, mkdir '/workspace/node_modules'
```

**Cause:** User mismatch between host and container.

**Solutions:**

1. **Fix user mapping:**
   ```yaml
   workspace:
     container:
       user: "1000:1000"    # Match your UID:GID
   ```

2. **Check your user ID:**
   ```bash
   echo "UID: $(id -u), GID: $(id -g)"
   ```

3. **Use dynamic user mapping:**
   ```yaml
   workspace:
     container:
       user: "${UID}:${GID}"    # Use environment variables
   ```

4. **Fix permissions on host:**
   ```bash
   sudo chown -R $(id -u):$(id -g) node_modules
   chmod -R 755 node_modules
   ```

5. **Install as root then fix ownership:**
   ```yaml
   workspace:
     container:
       # Install as root
       user: "root"
       customInstallCommand: "npm install && chown -R 1000:1000 node_modules"
   ```

---

## Container Networking Issues

### "Network connection refused"

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Cause:** Service not accessible due to network configuration.

**Solutions:**

1. **Use correct network mode:**
   ```yaml
   workspace:
     container:
       networkMode: "bridge"    # Default, isolated
       # networkMode: "host"    # Use host networking
   ```

2. **Expose ports:**
   ```yaml
   workspace:
     container:
       ports:
         "3000:3000"    # Host port : Container port
         "8080:80"
   ```

3. **For host services, use host.docker.internal:**
   ```yaml
   workspace:
     container:
       environment:
         DATABASE_URL: "host.docker.internal:5432"
   ```

4. **Check container networking:**
   ```bash
   # List networks
   docker network ls

   # Inspect network
   docker network inspect bridge

   # Test connectivity from container
   docker exec <container-id> ping host.docker.internal
   ```

---

### "DNS resolution failed"

**Error:**
```
Error: getaddrinfo ENOTFOUND registry.npmjs.org
```

**Cause:** Container cannot resolve DNS names.

**Solutions:**

1. **Configure DNS servers:**
   ```yaml
   workspace:
     container:
       dns:
         - "8.8.8.8"
         - "8.8.4.4"
         - "1.1.1.1"
   ```

2. **Use host DNS:**
   ```yaml
   workspace:
     container:
       networkMode: "host"    # Use host networking
   ```

3. **Test DNS resolution:**
   ```bash
   # From container
   docker exec <container-id> nslookup google.com

   # From host
   nslookup google.com
   ```

4. **Add custom hosts:**
   ```yaml
   workspace:
     container:
       extraHosts:
         "registry.npmjs.org": "104.16.16.35"
   ```

---

## Container Cleanup Issues

### "Container removal failed"

**Error:**
```
Error response from daemon: cannot remove container: container is running
```

**Cause:** APEX cannot clean up running containers.

**Solutions:**

1. **Force container removal:**
   ```bash
   # Stop all APEX containers
   docker stop $(docker ps -q --filter "label=apex.managed=true")

   # Remove all APEX containers
   docker rm -f $(docker ps -a -q --filter "label=apex.managed=true")
   ```

2. **Enable auto-cleanup:**
   ```yaml
   workspace:
     cleanupOnComplete: true
     container:
       autoRemove: true
   ```

3. **Manual cleanup after failed tasks:**
   ```bash
   # List orphaned APEX containers
   docker ps -a --filter "label=apex.managed=true" \
     --filter "status=exited" --filter "status=dead"

   # Remove them
   docker container prune --filter "label=apex.managed=true" -f
   ```

4. **Check for mount conflicts:**
   ```bash
   # Check what's using the mount
   lsof +D /path/to/mounted/directory

   # Kill processes using it
   sudo fuser -k /path/to/mounted/directory
   ```

---

### "Orphaned containers consuming resources"

**Error:**
```
System running slow, many old APEX containers found
```

**Cause:** Containers not properly cleaned up after tasks.

**Solutions:**

1. **Automated cleanup script:**
   ```bash
   #!/bin/bash
   # cleanup-apex-containers.sh

   echo "Cleaning up APEX containers..."

   # Stop running APEX containers older than 1 hour
   docker ps --filter "label=apex.managed=true" \
     --format "table {{.ID}}\t{{.Names}}\t{{.CreatedAt}}" | \
     awk '$3 < (systime() - 3600) {print $1}' | \
     xargs -r docker stop

   # Remove stopped APEX containers
   docker container prune --filter "label=apex.managed=true" -f

   # Remove unused APEX images
   docker image prune --filter "label=apex.managed=true" -f

   echo "Cleanup complete."
   ```

2. **Monitor container count:**
   ```bash
   # Count APEX containers
   docker ps -a --filter "label=apex.managed=true" | wc -l

   # Set up monitoring alert
   if [ $(docker ps -a -q --filter "label=apex.managed=true" | wc -l) -gt 50 ]; then
     echo "Warning: Too many APEX containers ($(docker ps -a -q --filter "label=apex.managed=true" | wc -l))"
   fi
   ```

3. **Configure automatic cleanup:**
   ```yaml
   # .apex/config.yaml
   workspace:
     cleanupOnComplete: true
     cleanupOrphanedContainers: true
     maxConcurrentContainers: 10
   ```

4. **Scheduled cleanup (cron):**
   ```bash
   # Add to crontab
   # Run cleanup every hour
   0 * * * * /path/to/cleanup-apex-containers.sh >> /var/log/apex-cleanup.log 2>&1
   ```

---

## Debugging and Monitoring

### Container Health Monitoring

**Monitor container health:**

```bash
# Real-time container stats
docker stats $(docker ps -q --filter "label=apex.managed=true")

# Container resource usage
docker exec <container-id> top
docker exec <container-id> df -h
docker exec <container-id> free -h

# Container logs
docker logs <container-id> --timestamps --follow
docker logs <container-id> --since="1h" --tail=100
```

**Enable health checks:**

```yaml
workspace:
  container:
    healthCheck:
      enabled: true
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      startPeriod: 60s
```

---

### Container Inspection

**Inspect running containers:**

```bash
# Detailed container info
docker inspect <container-id>

# Container configuration
docker inspect <container-id> | jq '.[].Config'

# Resource limits
docker inspect <container-id> | jq '.[].HostConfig.{Memory,CpuShares,PidsLimit}'

# Volume mounts
docker inspect <container-id> | jq '.[].Mounts'

# Network settings
docker inspect <container-id> | jq '.[].NetworkSettings'
```

**Check container processes:**

```bash
# Processes inside container
docker exec <container-id> ps aux

# Process tree
docker exec <container-id> pstree

# File descriptors
docker exec <container-id> ls -la /proc/*/fd | wc -l
```

---

### Log Analysis

**APEX container logs:**

```bash
# Get container ID from task
task_id="task_12345"
container_id=$(docker ps -q --filter "label=apex.task.id=$task_id")

# Follow logs
docker logs $container_id --follow --timestamps

# Filter logs by level
docker logs $container_id 2>&1 | grep -E "(ERROR|WARN|error|warn)"

# Export logs for analysis
docker logs $container_id --timestamps > apex-task-$task_id.log
```

**APEX task logs:**

```bash
# APEX built-in logging
apex logs $task_id --level error
apex logs $task_id --follow
apex logs $task_id --since="2024-01-01T10:00:00Z"

# Export to file
apex logs $task_id > task-debug.log
```

---

### Performance Profiling

**Container performance analysis:**

```bash
# CPU usage over time
docker stats --no-stream $(docker ps -q --filter "label=apex.managed=true")

# Memory usage breakdown
docker exec <container-id> cat /proc/meminfo

# Disk I/O statistics
docker exec <container-id> iostat -x 1

# Network statistics
docker exec <container-id> netstat -i
```

**Process monitoring:**

```bash
# Top processes in container
docker exec <container-id> top -o +%CPU

# Process with high memory usage
docker exec <container-id> ps aux --sort=-%mem | head -10

# Open file descriptors
docker exec <container-id> ls /proc/*/fd | wc -l
```

---

## Debugging Tools

### Container Shell Access

**Interactive debugging:**

```bash
# Get shell in running container
docker exec -it <container-id> /bin/sh

# Or bash if available
docker exec -it <container-id> /bin/bash

# Run specific command
docker exec <container-id> ls -la /workspace

# Access as root for debugging
docker exec -u root -it <container-id> /bin/sh
```

**Debug container that won't start:**

```bash
# Run container interactively
docker run -it --rm node:20-alpine /bin/sh

# Check what's preventing startup
docker logs <container-id>

# Start container without entrypoint
docker run -it --rm --entrypoint /bin/sh node:20-alpine
```

---

### Network Debugging

**Network connectivity tests:**

```bash
# From inside container
docker exec <container-id> ping 8.8.8.8
docker exec <container-id> nslookup google.com
docker exec <container-id> curl -I https://registry.npmjs.org

# Port connectivity
docker exec <container-id> nc -zv host.docker.internal 3000
docker exec <container-id> telnet host.docker.internal 3000
```

**Network inspection:**

```bash
# Container network details
docker inspect <container-id> | jq '.[].NetworkSettings.Networks'

# Network interfaces in container
docker exec <container-id> ip addr show

# Routing table
docker exec <container-id> ip route show
```

---

### File System Debugging

**File system inspection:**

```bash
# Check mounted volumes
docker exec <container-id> mount | grep workspace

# File permissions
docker exec <container-id> ls -la /workspace

# Disk usage
docker exec <container-id> du -h /workspace

# Find large files
docker exec <container-id> find /workspace -size +100M -ls
```

**Permission debugging:**

```bash
# Check user context
docker exec <container-id> id
docker exec <container-id> whoami

# File ownership
docker exec <container-id> ls -la /workspace
docker exec <container-id> stat /workspace/package.json

# SELinux context (if applicable)
docker exec <container-id> ls -Z /workspace
```

---

## FAQ

### Q: Can I use APEX containers with Podman instead of Docker?

**A:** Yes! APEX automatically detects and supports both Docker and Podman. Podman is preferred if both are available due to its rootless security model.

```bash
# Verify Podman detection
apex config | grep -i runtime

# Force Podman usage
export CONTAINER_RUNTIME=podman
```

---

### Q: How do I use custom base images for specific projects?

**A:** Create a custom Dockerfile and configure it in your APEX config:

```yaml
# .apex/config.yaml
workspace:
  container:
    dockerfile: ".apex/Dockerfile"
    buildContext: "."
    imageTag: "my-project:apex"
```

```dockerfile
# .apex/Dockerfile
FROM node:20-alpine

# Add project-specific tools
RUN apk add --no-cache git python3 make g++

# Pre-install global dependencies
RUN npm install -g typescript ts-node

WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
```

---

### Q: How can I speed up container startup times?

**A:** Several strategies can help:

1. **Use lightweight base images:**
   ```yaml
   image: "node:20-alpine"  # ~200MB vs 1GB+ for full images
   ```

2. **Pre-build custom images:**
   ```yaml
   dockerfile: ".apex/Dockerfile"  # Pre-install dependencies
   ```

3. **Cache volume mounts:**
   ```yaml
   volumes:
     "~/.npm": "/root/.npm"       # Cache npm packages
     "~/.cache": "/root/.cache"   # Cache other tools
   ```

4. **Use registry mirrors:**
   ```yaml
   environment:
     NPM_REGISTRY: "https://registry.npm.taobao.org/"
   ```

---

### Q: What's the difference between container vs worktree isolation?

**A:**

| Aspect | Container | Worktree |
|--------|-----------|----------|
| **Isolation Level** | Full OS-level (filesystem, network, process) | Git-level only |
| **Performance** | Moderate (startup overhead) | Fast |
| **Dependencies** | Fully isolated | Shared with host |
| **Environment** | Customizable | Host environment |
| **Security** | High | Medium |
| **Resource Control** | Yes (CPU/memory limits) | No |
| **Cleanup** | Automatic | Git prune required |

Use containers for:
- Production-like environments
- Dependency isolation
- Security-sensitive tasks
- Resource-limited tasks

Use worktrees for:
- Quick development tasks
- Multiple parallel branches
- Host environment compatibility

---

### Q: How do I handle private Docker registries?

**A:** Configure authentication before running tasks:

```bash
# Login to registry
docker login your-registry.com
Username: your-username
Password: your-token

# Use private images in config
```

```yaml
workspace:
  container:
    image: "your-registry.com/your-project:latest"
```

For CI/CD environments:

```bash
# Set registry credentials
export DOCKER_REGISTRY_USER=username
export DOCKER_REGISTRY_PASS=password

# Login programmatically
echo $DOCKER_REGISTRY_PASS | docker login your-registry.com -u $DOCKER_REGISTRY_USER --password-stdin
```

---

### Q: Can I run multiple containers for one task?

**A:** APEX currently uses one container per task for simplicity and isolation. For multi-service scenarios:

1. **Use docker-compose in container:**
   ```dockerfile
   FROM docker:dind
   RUN apk add --no-cache docker-compose
   ```

2. **Use sidecar containers manually:**
   ```bash
   # Start database
   docker run -d --name task-db postgres:13

   # Run APEX task with link
   apex run "task" --container-link task-db:database
   ```

3. **Use services from host:**
   ```yaml
   workspace:
     container:
       networkMode: "host"  # Access host services
   ```

---

### Q: How do I persist data between container runs?

**A:** Use volume mounts to persist data:

```yaml
workspace:
  container:
    volumes:
      "./data": "/app/data"              # Project data
      "~/.cache": "/root/.cache"         # Tool caches
      "/tmp/apex-storage": "/storage"    # Shared storage
```

For databases or state:

```yaml
workspace:
  container:
    volumes:
      "apex-postgres-data": "/var/lib/postgresql/data"
```

Create named volumes:

```bash
docker volume create apex-postgres-data
```

---

### Q: What happens if a container crashes during a task?

**A:** APEX includes automatic recovery mechanisms:

1. **Container health monitoring** detects crashes
2. **Task failure events** are emitted
3. **Cleanup procedures** remove crashed containers
4. **Error reporting** provides debugging information

Configure recovery behavior:

```yaml
workspace:
  container:
    restartPolicy: "on-failure"
    restartMaxAttempts: 3
  preserveOnFailure: true  # Keep container for debugging
```

Check crash details:

```bash
# Find crashed container
docker ps -a --filter "label=apex.managed=true" --filter "status=exited"

# Check exit code and logs
docker inspect <container-id> | jq '.[].State.ExitCode'
docker logs <container-id>
```

---

### Q: How can I optimize container resource usage?

**A:** Follow these best practices:

1. **Set appropriate limits:**
   ```yaml
   resourceLimits:
     memory: "2g"        # Start conservative
     cpu: 1              # Scale based on need
     pidsLimit: 1000     # Prevent fork bombs
   ```

2. **Monitor actual usage:**
   ```bash
   docker stats <container-id>
   ```

3. **Use multi-stage builds:**
   ```dockerfile
   # Build stage
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production

   # Runtime stage
   FROM node:20-alpine
   COPY --from=builder /app/node_modules ./node_modules
   ```

4. **Clean up during build:**
   ```dockerfile
   RUN npm install && npm cache clean --force
   RUN apk del .build-deps
   ```

---

## Getting Help

### Additional Resources

- [Container Isolation Guide](./container-isolation.md) - Setup and configuration
- [Container Configuration Reference](./container-configuration.md) - Complete field reference
- [Best Practices](./best-practices.md) - General APEX best practices
- [API Reference](./api-reference.md) - Programmatic container management

### Reporting Container Issues

When reporting container-related issues, include:

1. **System information:**
   ```bash
   apex --version
   docker --version  # or podman --version
   docker info       # or podman info
   uname -a
   ```

2. **APEX configuration:**
   ```bash
   apex config --json
   ```

3. **Container details:**
   ```bash
   docker ps -a --filter "label=apex.managed=true"
   docker logs <container-id>
   ```

4. **Error logs:**
   ```bash
   apex logs <task-id> --level error
   ```

### Community Support

- [GitHub Issues](https://github.com/JoshuaAFerguson/apex/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/JoshuaAFerguson/apex/discussions) - Community help and questions

### Debug Mode

For complex issues, enable full debug logging:

```bash
# Enable all debug output
APEX_DEBUG=1 apex run "task" --workspace-strategy container --verbose

# Docker debug logging
DOCKER_BUILDKIT_PROGRESS=plain docker build ...

# Podman debug logging
podman --log-level debug ...
```

Save logs for issue reports:

```bash
# Capture full debug session
APEX_DEBUG=1 apex run "task" --workspace-strategy container --verbose 2>&1 | tee apex-debug.log
```

---

*This troubleshooting guide covers the most common container-related issues in APEX. If you encounter an issue not covered here, please check the [main troubleshooting guide](./troubleshooting.md) or report it to the community.*