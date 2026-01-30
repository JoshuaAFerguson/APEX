#!/bin/bash

# Fix permissions for browser tool files
find src/tools/browser -type f -name "*.ts" -exec chmod 644 {} \;

echo "Fixed permissions for browser tool TypeScript files"
ls -la src/tools/browser/