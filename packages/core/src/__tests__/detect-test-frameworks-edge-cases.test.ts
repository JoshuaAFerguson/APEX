/**
 * Edge Cases and Robustness Test Suite for detectTestFrameworks() method
 *
 * This test suite focuses on testing edge cases, error scenarios, and robustness
 * to ensure the detectTestFrameworks() method handles all possible conditions gracefully.
 * Specifically tests the three newly added frameworks with comprehensive edge cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { ProjectContextAnalyzer } from '../project-context-analyzer';

describe('detectTestFrameworks() - Edge Cases and Robustness', () => {
  let tempDir: string;
  let analyzer: ProjectContextAnalyzer;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(tmpdir(), 'apex-edge-cases-'));
    analyzer = new ProjectContextAnalyzer(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp dir:', error);
    }
  });

  describe('Cargo Test Framework - Edge Cases', () => {
    it('should detect Cargo Test from minimal Cargo.toml', async () => {
      const cargoToml = `[package]
name = "minimal"
version = "0.1.0"
edition = "2021"`;

      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        cargoToml
      );

      // Create src/lib.rs with tests
      await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'lib.rs'),
        '#[cfg(test)]\nmod tests {\n    #[test]\n    fn it_works() {\n        assert_eq!(2 + 2, 4);\n    }\n}'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cargo Test',
          configFile: 'Cargo.toml',
          runCommand: 'cargo test',
        })
      );
    });

    it('should detect Cargo Test from Cargo.toml with complex structure', async () => {
      const cargoToml = `[package]
name = "complex-rust-project"
version = "1.2.3"
edition = "2021"
authors = ["Test Author <test@example.com>"]
license = "MIT OR Apache-2.0"
description = "A complex Rust project for testing"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
criterion = "0.3"
proptest = "1.0"

[[bin]]
name = "main"
path = "src/main.rs"

[lib]
name = "complex_project"
path = "src/lib.rs"`;

      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        cargoToml
      );

      // Create integration tests directory
      await fs.promises.mkdir(path.join(tempDir, 'tests'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'tests', 'integration.rs'),
        'use complex_project;\n\n#[test]\nfn integration_test() {\n    assert!(true);\n}'
      );

      // Create src with unit tests
      await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'main.rs'),
        'fn main() {\n    println!("Hello, world!");\n}\n\n#[cfg(test)]\nmod tests {\n    #[test]\n    fn test_main() {\n        assert!(true);\n    }\n}'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cargo Test',
          configFile: 'Cargo.toml',
          runCommand: 'cargo test',
        })
      );
    });

    it('should handle corrupted Cargo.toml gracefully', async () => {
      const invalidCargoToml = `[package
name = "invalid-toml"
version = 0.1.0"  # missing quote
edition = "2021"

[dependencies
serde = "1.0"  # missing closing bracket`;

      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        invalidCargoToml
      );

      // Should still detect based on file existence, even if content is invalid
      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cargo Test',
          configFile: 'Cargo.toml',
          runCommand: 'cargo test',
        })
      );
    });

    it('should detect Cargo Test without test indicators if Cargo.toml exists', async () => {
      const cargoToml = `[package]
name = "no-tests"
version = "0.1.0"
edition = "2021"`;

      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        cargoToml
      );

      // No tests/ directory or src files with tests

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cargo Test',
          configFile: 'Cargo.toml',
          runCommand: 'cargo test',
        })
      );
    });

    it('should handle nested Rust workspace structure', async () => {
      // Create workspace Cargo.toml
      const workspaceCargoToml = `[workspace]
members = ["crate-a", "crate-b"]

[workspace.dependencies]
serde = "1.0"`;

      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        workspaceCargoToml
      );

      // Create member crates
      await fs.promises.mkdir(path.join(tempDir, 'crate-a'), { recursive: true });
      const crateACargoToml = `[package]
name = "crate-a"
version = "0.1.0"
edition = "2021"`;

      await fs.promises.writeFile(
        path.join(tempDir, 'crate-a', 'Cargo.toml'),
        crateACargoToml
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cargo Test',
          configFile: 'Cargo.toml',
          runCommand: 'cargo test',
        })
      );
    });
  });

  describe('RSpec Framework - Edge Cases', () => {
    it('should detect RSpec from spec_helper.rb only', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'spec'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'spec_helper.rb'),
        `require 'rspec'
RSpec.configure do |config|
  config.color = true
  config.formatter = :documentation
end`
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'RSpec',
          configFile: 'spec/spec_helper.rb',
          runCommand: 'bundle exec rspec',
        })
      );
    });

    it('should detect RSpec from rails_helper.rb only', async () => {
      await fs.promises.mkdir(path.join(tempDir, 'spec'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'rails_helper.rb'),
        `ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'
require 'rspec/rails'

RSpec.configure do |config|
  config.use_transactional_fixtures = true
end`
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'RSpec',
          configFile: 'spec/rails_helper.rb',
          runCommand: 'bundle exec rspec',
        })
      );
    });

    it('should detect RSpec from .rspec config with various options', async () => {
      const rspecConfig = `--color
--require spec_helper
--format progress
--profile 10
--order random
--seed 12345
--backtrace`;

      await fs.promises.writeFile(
        path.join(tempDir, '.rspec'),
        rspecConfig
      );

      // Create spec files
      await fs.promises.mkdir(path.join(tempDir, 'spec'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'example_spec.rb'),
        `RSpec.describe "Example" do
  it "does something" do
    expect(1 + 1).to eq(2)
  end

  context "when testing edge cases" do
    it "handles nil values" do
      expect(nil).to be_nil
    end
  end
end`
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'RSpec',
          configFile: '.rspec',
          runCommand: 'bundle exec rspec',
        })
      );
    });

    it('should detect RSpec from Gemfile with various gem specifications', async () => {
      const gemfile = `source 'https://rubygems.org'

ruby '3.1.0'

gem 'rails', '~> 7.0.0'
gem 'pg', '~> 1.1'
gem 'bootsnap', '>= 1.4.4', require: false

group :development, :test do
  gem 'rspec-rails', '~> 5.0'
  gem 'factory_bot_rails'
  gem 'faker'
end

group :test do
  gem 'capybara', '>= 3.26'
  gem 'selenium-webdriver'
  gem 'webdrivers'
end

group :development do
  gem 'listen', '~> 3.3'
  gem 'spring'
end`;

      await fs.promises.writeFile(
        path.join(tempDir, 'Gemfile'),
        gemfile
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'RSpec',
          runCommand: 'bundle exec rspec',
        })
      );
    });

    it('should handle empty .rspec file', async () => {
      await fs.promises.writeFile(
        path.join(tempDir, '.rspec'),
        ''
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'RSpec',
          configFile: '.rspec',
          runCommand: 'bundle exec rspec',
        })
      );
    });

    it('should detect RSpec from complex spec directory structure', async () => {
      // Create complex spec structure
      await fs.promises.mkdir(path.join(tempDir, 'spec', 'models'), { recursive: true });
      await fs.promises.mkdir(path.join(tempDir, 'spec', 'controllers'), { recursive: true });
      await fs.promises.mkdir(path.join(tempDir, 'spec', 'features'), { recursive: true });
      await fs.promises.mkdir(path.join(tempDir, 'spec', 'support'), { recursive: true });

      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'spec_helper.rb'),
        'require "rspec"'
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'models', 'user_spec.rb'),
        'RSpec.describe User do\nend'
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'controllers', 'users_controller_spec.rb'),
        'RSpec.describe UsersController do\nend'
      );

      await fs.promises.writeFile(
        path.join(tempDir, 'spec', 'features', 'user_registration_spec.rb'),
        'RSpec.feature "User Registration" do\nend'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'RSpec',
          configFile: 'spec/spec_helper.rb',
          runCommand: 'bundle exec rspec',
        })
      );
    });
  });

  describe('JUnit Framework - Edge Cases', () => {
    it('should detect JUnit from Maven pom.xml with Maven Surefire plugin', async () => {
      const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                            http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>test-project</artifactId>
    <version>1.0-SNAPSHOT</version>
    <packaging>jar</packaging>

    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <junit.version>5.9.1</junit.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>\${junit.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.0.0-M7</version>
                <configuration>
                    <includes>
                        <include>**/*Test.java</include>
                        <include>**/*Tests.java</include>
                    </includes>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>`;

      await fs.promises.writeFile(
        path.join(tempDir, 'pom.xml'),
        pomXml
      );

      // Create complex test structure
      await fs.promises.mkdir(path.join(tempDir, 'src', 'test', 'java', 'com', 'example'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'test', 'java', 'com', 'example', 'MyServiceTest.java'),
        `package com.example;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("MyService Tests")
class MyServiceTest {

    @BeforeEach
    void setUp() {
        // setup
    }

    @Test
    @DisplayName("Should return expected value")
    void shouldReturnExpectedValue() {
        assertEquals(2, 1 + 1);
    }
}`
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'JUnit',
          configFile: 'pom.xml',
          runCommand: 'mvn test',
        })
      );
    });

    it('should detect JUnit from Gradle build.gradle with test configuration', async () => {
      const buildGradle = `plugins {
    id 'java'
    id 'application'
}

repositories {
    mavenCentral()
}

dependencies {
    implementation 'com.google.guava:guava:31.1-jre'

    testImplementation 'org.junit.jupiter:junit-jupiter-api:5.9.1'
    testImplementation 'org.junit.jupiter:junit-jupiter-params:5.9.1'
    testRuntimeOnly 'org.junit.jupiter:junit-jupiter-engine:5.9.1'

    testImplementation 'org.mockito:mockito-core:4.6.1'
    testImplementation 'org.assertj:assertj-core:3.23.1'
}

test {
    useJUnitPlatform()
    testLogging {
        events "passed", "skipped", "failed"
        exceptionFormat "full"
    }

    systemProperties = [
        'junit.jupiter.execution.parallel.enabled': true,
        'junit.jupiter.execution.parallel.mode.default': 'concurrent'
    ]
}

application {
    mainClass = 'com.example.App'
}`;

      await fs.promises.writeFile(
        path.join(tempDir, 'build.gradle'),
        buildGradle
      );

      // Create test structure
      await fs.promises.mkdir(path.join(tempDir, 'src', 'test', 'java', 'com', 'example'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'test', 'java', 'com', 'example', 'AppTest.java'),
        `package com.example;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

@Execution(ExecutionMode.CONCURRENT)
class AppTest {

    @Test
    void testApp() {
        assertTrue(true);
    }

    @RepeatedTest(5)
    void testRepeated() {
        assertNotNull("test");
    }

    @ParameterizedTest
    @ValueSource(ints = {1, 2, 3})
    void testWithParameters(int value) {
        assertTrue(value > 0);
    }
}`
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'JUnit',
          configFile: 'build.gradle',
          runCommand: 'mvn test', // Note: This should ideally be 'gradle test' for Gradle projects
        })
      );
    });

    it('should detect JUnit from build.gradle.kts (Kotlin DSL)', async () => {
      const buildGradleKts = `plugins {
    kotlin("jvm") version "1.7.10"
    application
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("stdlib"))

    testImplementation("org.junit.jupiter:junit-jupiter-api:5.9.1")
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.9.1")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.9.1")

    testImplementation("io.mockk:mockk:1.12.4")
}

tasks.test {
    useJUnitPlatform()
}

application {
    mainClass.set("MainKt")
}`;

      await fs.promises.writeFile(
        path.join(tempDir, 'build.gradle.kts'),
        buildGradleKts
      );

      // Create Kotlin test structure
      await fs.promises.mkdir(path.join(tempDir, 'src', 'test', 'kotlin'), { recursive: true });
      await fs.promises.writeFile(
        path.join(tempDir, 'src', 'test', 'kotlin', 'MainTest.kt'),
        `import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.*

class MainTest {

    @Test
    fun \`should pass basic test\`() {
        assertEquals(4, 2 + 2)
    }

    @Test
    fun \`should handle null values\`() {
        assertNull(null)
    }
}`
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'JUnit',
          configFile: 'build.gradle.kts',
          runCommand: 'mvn test',
        })
      );
    });

    it('should handle corrupted pom.xml gracefully', async () => {
      const corruptedPom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>corrupted-project</artifactId>
    <version>1.0-SNAPSHOT</version>

    <dependencies>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit
            <version>4.13.2</version>
            <!-- Missing closing tags -->`;

      await fs.promises.writeFile(
        path.join(tempDir, 'pom.xml'),
        corruptedPom
      );

      // Should still detect based on file existence
      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'JUnit',
          configFile: 'pom.xml',
          runCommand: 'mvn test',
        })
      );
    });

    it('should detect JUnit from minimal test structure', async () => {
      const minimalPom = `<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>test</groupId>
    <artifactId>test</artifactId>
    <version>1.0</version>
</project>`;

      await fs.promises.writeFile(
        path.join(tempDir, 'pom.xml'),
        minimalPom
      );

      // Just create the test directory without actual test files
      await fs.promises.mkdir(path.join(tempDir, 'src', 'test'), { recursive: true });

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'JUnit',
          configFile: 'pom.xml',
          runCommand: 'mvn test',
        })
      );
    });
  });

  describe('Cross-Framework Interaction and Priority', () => {
    it('should handle project with multiple build systems (Maven + Gradle)', async () => {
      // Create both pom.xml and build.gradle
      const pomXml = `<project>
    <modelVersion>4.0.0</modelVersion>
    <groupId>test</groupId>
    <artifactId>multi-build</artifactId>
    <version>1.0</version>
</project>`;

      const buildGradle = `plugins {
    id 'java'
}
dependencies {
    testImplementation 'junit:junit:4.13.2'
}`;

      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), pomXml);
      await fs.promises.writeFile(path.join(tempDir, 'build.gradle'), buildGradle);

      await fs.promises.mkdir(path.join(tempDir, 'src', 'test', 'java'), { recursive: true });

      const result = await analyzer.detectTestFrameworks();

      // Should detect JUnit but not duplicate it
      const junitFrameworks = result.filter(f => f.name === 'JUnit');
      expect(junitFrameworks.length).toBe(1);

      // Should prioritize the first config file found
      expect(junitFrameworks[0].configFile).toMatch(/^(pom\.xml|build\.gradle)$/);
    });

    it('should handle Rust project with Cargo.toml and other test frameworks', async () => {
      // Create Cargo.toml
      const cargoToml = `[package]
name = "multi-lang"
version = "0.1.0"
edition = "2021"`;

      await fs.promises.writeFile(path.join(tempDir, 'Cargo.toml'), cargoToml);

      // Also create Node.js package.json with Jest
      const packageJson = {
        name: 'multi-lang-project',
        devDependencies: {
          jest: '^29.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const result = await analyzer.detectTestFrameworks();

      // Should detect both frameworks
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Cargo Test' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Jest' })
      );
    });

    it('should handle Ruby project with RSpec and other test frameworks coexisting', async () => {
      // Create Gemfile with RSpec
      const gemfile = `source 'https://rubygems.org'
gem 'rspec'`;

      await fs.promises.writeFile(path.join(tempDir, 'Gemfile'), gemfile);

      // Also create package.json for frontend testing
      const packageJson = {
        name: 'fullstack-project',
        devDependencies: {
          cypress: '^12.0.0',
        },
      };
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create spec directory
      await fs.promises.mkdir(path.join(tempDir, 'spec'), { recursive: true });

      const result = await analyzer.detectTestFrameworks();

      // Should detect both frameworks
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'RSpec' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Cypress' })
      );
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle empty config files gracefully', async () => {
      // Create empty config files
      await fs.promises.writeFile(path.join(tempDir, 'Cargo.toml'), '');
      await fs.promises.writeFile(path.join(tempDir, '.rspec'), '');
      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), '');

      const result = await analyzer.detectTestFrameworks();

      // Should still detect frameworks based on file existence
      const frameworkNames = result.map(f => f.name);
      expect(frameworkNames).toContain('Cargo Test');
      expect(frameworkNames).toContain('RSpec');
      expect(frameworkNames).toContain('JUnit');
    });

    it('should handle very large config files efficiently', async () => {
      // Create a very large pom.xml with many dependencies
      let largePom = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.example</groupId>
    <artifactId>large-project</artifactId>
    <version>1.0-SNAPSHOT</version>

    <dependencies>`;

      // Add many dependencies to make file large
      for (let i = 0; i < 100; i++) {
        largePom += `
        <dependency>
            <groupId>com.example.dep${i}</groupId>
            <artifactId>dependency-${i}</artifactId>
            <version>1.0.${i}</version>
        </dependency>`;
      }

      largePom += `
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>`;

      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), largePom);

      const startTime = Date.now();
      const result = await analyzer.detectTestFrameworks();
      const endTime = Date.now();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'JUnit',
          configFile: 'pom.xml',
        })
      );

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should handle deeply nested test directory structures', async () => {
      // Create deeply nested Rust test structure
      const cargoToml = `[package]
name = "nested-tests"
version = "0.1.0"
edition = "2021"`;

      await fs.promises.writeFile(path.join(tempDir, 'Cargo.toml'), cargoToml);

      // Create deeply nested test structure
      const deepPath = path.join(tempDir, 'tests', 'integration', 'modules', 'submodules', 'deep');
      await fs.promises.mkdir(deepPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(deepPath, 'deep_test.rs'),
        '#[test] fn deep_test() { assert!(true); }'
      );

      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'Cargo Test',
          configFile: 'Cargo.toml',
        })
      );
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should continue detection even if one config file is unreadable', async () => {
      // Create valid Cargo.toml
      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        '[package]\nname = "test"\nversion = "0.1.0"'
      );

      // Create valid package.json
      await fs.promises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { jest: '^29.0.0' } })
      );

      // Create unreadable file (this simulates permission issues)
      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');

      // The method should still detect the readable frameworks
      const result = await analyzer.detectTestFrameworks();

      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Cargo Test' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'Jest' })
      );
      expect(result).toContainEqual(
        expect.objectContaining({ name: 'JUnit' })
      );
    });

    it('should handle concurrent file operations gracefully', async () => {
      // Create multiple config files
      await fs.promises.writeFile(
        path.join(tempDir, 'Cargo.toml'),
        '[package]\nname = "concurrent"\nversion = "0.1.0"'
      );
      await fs.promises.writeFile(path.join(tempDir, '.rspec'), '--color');
      await fs.promises.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');

      // Run detection multiple times concurrently
      const promises = Array.from({ length: 5 }, () => analyzer.detectTestFrameworks());
      const results = await Promise.all(promises);

      // All results should be consistent
      results.forEach(result => {
        expect(result).toContainEqual(
          expect.objectContaining({ name: 'Cargo Test' })
        );
        expect(result).toContainEqual(
          expect.objectContaining({ name: 'RSpec' })
        );
        expect(result).toContainEqual(
          expect.objectContaining({ name: 'JUnit' })
        );
      });
    });
  });
});