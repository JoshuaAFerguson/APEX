#!/bin/bash
# Remove *-report*.md files from packages/
find packages -name "*-report*.md" -type f -exec rm {} \;

# Remove *-coverage*.md files from packages/
find packages -name "*-coverage*.md" -type f -exec rm {} \;

# Remove V0*.md files from packages/
find packages -name "V0*.md" -type f -exec rm {} \;

echo "Cleanup completed successfully"