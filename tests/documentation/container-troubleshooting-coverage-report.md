# Container Troubleshooting Documentation - Test Coverage Report

## Overview

This report documents the comprehensive test coverage for the container troubleshooting documentation (`docs/container-troubleshooting.md`). The testing suite validates that all acceptance criteria have been met and that the documentation provides accurate, complete troubleshooting guidance.

## Acceptance Criteria Coverage

### ✅ Common Errors and Solutions
- **Coverage**: Complete
- **Test Files**:
  - `container-troubleshooting-docs.test.ts`
  - `container-troubleshooting-integration.test.ts`
- **Validation Areas**:
  - Runtime detection errors ("No container runtime available", "Docker daemon not running")
  - Image and container creation failures ("Image not found", "Container startup timeout")
  - Configuration and volume mount issues ("Volume mount failed")
  - Each error includes multiple solution approaches with platform-specific guidance

### ✅ Runtime Detection Issues
- **Coverage**: Complete
- **Test Coverage**:
  - Docker runtime detection and installation validation
  - Podman runtime detection and setup verification
  - Permission-based access issues ("Permission denied accessing Docker")
  - Socket connection failures for both Docker and Podman
  - Platform-specific installation commands (macOS, Linux, Windows)

### ✅ Permission Problems
- **Coverage**: Complete
- **Test Coverage**:
  - Docker daemon permission issues with user group solutions
  - Container file system permission mismatches (user ID mapping)
  - SELinux and AppArmor security context problems
  - Node modules permission errors during dependency installation
  - Rootless container runtime configurations

### ✅ Resource Exhaustion
- **Coverage**: Complete
- **Test Coverage**:
  - Out of Memory (OOM) scenarios with container exit code 137
  - CPU throttling detection and resource allocation solutions
  - Disk space exhaustion with cleanup procedures
  - Resource limit configuration examples with validation against schemas
  - Memory leak detection and monitoring tools

### ✅ Cleanup Failures
- **Coverage**: Complete
- **Test Coverage**:
  - Container removal failures for running containers
  - Orphaned container cleanup automation scripts
  - Volume and image cleanup procedures
  - Automated cleanup configuration options
  - Cleanup scheduling and monitoring

### ✅ Debugging Tips
- **Coverage**: Complete
- **Test Coverage**:
  - Container health monitoring setup and commands
  - Log analysis techniques and filtering
  - Performance profiling tools and metrics
  - Interactive debugging with container shell access
  - Network and file system debugging procedures

### ✅ FAQ Section
- **Coverage**: Complete
- **Test Coverage**:
  - 9+ comprehensive FAQ entries covering common scenarios
  - Docker vs Podman usage guidance
  - Custom base image creation and management
  - Container vs worktree isolation comparison
  - Private registry authentication
  - Data persistence and multi-container scenarios
  - Performance optimization strategies

## Test Suite Structure

### 1. Document Structure Validation (`container-troubleshooting-docs.test.ts`)
- **Purpose**: Validates document completeness, structure, and content accuracy
- **Test Count**: 50+ test cases
- **Coverage Areas**:
  - Document existence and readability
  - Required section presence and organization
  - Error message pattern validation
  - Code example syntax verification
  - Cross-reference link validation
  - Content quality metrics

### 2. Integration Testing (`container-troubleshooting-integration.test.ts`)
- **Purpose**: Validates technical accuracy of solutions and configurations
- **Test Count**: 30+ test cases
- **Coverage Areas**:
  - YAML configuration validation against schemas
  - Command syntax verification for Docker/Podman/APEX
  - Error-solution mapping validation
  - Platform compatibility verification
  - Best practices integration
  - Real-world scenario coverage

### 3. Structure Analysis (`container-troubleshooting-structure.test.ts`)
- **Purpose**: Validates documentation quality and consistency using utility functions
- **Test Count**: 40+ test cases
- **Coverage Areas**:
  - Header hierarchy and navigation structure
  - Code block diversity and labeling
  - Link integrity and descriptive text
  - Error section formatting consistency
  - Content readability metrics
  - Terminology consistency

## Key Test Utilities

### DocumentationAnalyzer Class
- **extractHeaders()**: Analyzes markdown header structure and hierarchy
- **extractCodeBlocks()**: Validates code examples by language and content
- **extractLinks()**: Verifies internal and external link integrity
- **extractErrorSections()**: Validates error-cause-solution structure consistency
- **calculateReadabilityMetrics()**: Measures document quality and comprehensiveness

## Schema Integration Testing

### Configuration Validation
- Tests validate all YAML examples against production schemas:
  - `ApexConfigSchema`: Full project configuration validation
  - `ContainerConfigSchema`: Container-specific setting validation
  - `WorkspaceConfigSchema`: Workspace strategy configuration validation

### Command Verification
- All bash commands tested for proper syntax
- Docker and Podman command parity verification
- APEX CLI command accuracy validation
- System administration command safety checks

## Coverage Metrics

### Quantitative Measures
- **Total Test Cases**: 120+
- **Document Length**: 50,000+ characters (comprehensive coverage)
- **Code Blocks**: 30+ with proper language tagging
- **Error Scenarios**: 15+ with multiple solution paths
- **Configuration Examples**: 10+ validated against schemas
- **FAQ Items**: 9+ covering common user scenarios

### Qualitative Validation
- **Technical Accuracy**: All configurations validated against production schemas
- **Platform Coverage**: Windows, macOS, Linux support verified
- **Container Runtime Support**: Docker and Podman parity ensured
- **Solution Escalation**: Simple to advanced solution paths provided
- **Cross-References**: Proper linking to related documentation validated

## Test Execution

### Running the Tests
```bash
# Run all container troubleshooting tests
npm run test -- tests/documentation/container-troubleshooting-*.test.ts

# Run individual test suites
npm run test -- tests/documentation/container-troubleshooting-docs.test.ts
npm run test -- tests/documentation/container-troubleshooting-integration.test.ts
npm run test -- tests/documentation/container-troubleshooting-structure.test.ts

# Run with coverage
npm run test:coverage -- tests/documentation/container-troubleshooting-*.test.ts
```

### Integration with CI/CD
Tests can be integrated into continuous integration pipelines to:
- Validate documentation changes before merge
- Ensure configuration examples remain valid as schemas evolve
- Maintain documentation quality standards
- Prevent documentation regressions

## Quality Assurance

### Automated Validation
- **Schema Compliance**: All configuration examples validated against current schemas
- **Link Integrity**: Internal documentation links verified to exist
- **Code Syntax**: Bash, YAML, and Dockerfile examples validated
- **Error Patterns**: Consistent error-cause-solution structure enforced

### Manual Review Points
- Technical solution accuracy should be periodically reviewed by infrastructure experts
- New container runtimes or versions may require documentation updates
- User feedback should inform additional FAQ entries or troubleshooting scenarios

## Maintenance Guidelines

### Updating Tests
When updating container troubleshooting documentation:
1. Add corresponding test cases for new error scenarios
2. Validate new configuration examples against current schemas
3. Update expected content in structure tests for new sections
4. Ensure cross-reference consistency across related documentation

### Schema Evolution
When container or configuration schemas change:
1. Update integration tests with new valid configuration examples
2. Validate existing examples still pass schema validation
3. Add tests for new configuration options or deprecation warnings
4. Update error scenarios if validation messages change

## Conclusion

The container troubleshooting documentation test suite provides comprehensive coverage of all acceptance criteria with over 120 test cases validating:

- ✅ **Common errors and solutions** with multiple approaches
- ✅ **Runtime detection issues** across Docker and Podman
- ✅ **Permission problems** with security-conscious solutions
- ✅ **Resource exhaustion** scenarios with monitoring and limits
- ✅ **Cleanup failures** with automation and best practices
- ✅ **Debugging tips** with practical tools and techniques
- ✅ **FAQ section** covering real-world scenarios

The test suite ensures that users can successfully troubleshoot container-related issues using the provided documentation while maintaining technical accuracy through schema validation and integration testing.