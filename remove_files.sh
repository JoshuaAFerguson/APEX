#!/bin/bash
# Simple file removal script
rm -f packages/core/src/test-utils/MockServer-test-coverage-report.md 2>/dev/null || echo "File not found"
rm -f packages/core/src/test-utils/autonomy-fixtures-coverage-report.md 2>/dev/null || echo "File not found"
rm -f packages/core/src/test-utils/__tests__/test-coverage-report.md 2>/dev/null || echo "File not found"
rm -f packages/core/src/tools/shell/__tests__/bash-tool.timeout-test-report.md 2>/dev/null || echo "File not found"
rm -f packages/core/src/tools/shell/__tests__/test-coverage-report.md 2>/dev/null || echo "File not found"
echo "Batch removed"