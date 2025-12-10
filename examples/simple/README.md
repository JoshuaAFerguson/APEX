# Simple Example

This is a minimal example showing APEX in action with a basic Node.js project.

## Setup

```bash
cd examples/simple

# Initialize npm project
npm init -y

# Initialize APEX
apex init --name simple-example --language javascript

# Run a task
export ANTHROPIC_API_KEY=your_key
apex run "Create a hello world Express server with health endpoint"
```

## What to Expect

APEX will:
1. Plan the implementation
2. Create `server.js` with Express setup
3. Add health check endpoint
4. Create basic tests
5. Commit changes to a feature branch
