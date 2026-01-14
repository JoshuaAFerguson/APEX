# Visual Regression Configuration

The visual regression configuration has been successfully implemented in APEX. This feature allows you to configure automated visual testing settings.

## Schema Definition

The `VisualRegressionConfigSchema` includes the following fields:

- `enabled` (boolean, optional, default: false) - Enable visual regression testing
- `threshold` (number, 0-1, default: 0.99) - Similarity threshold for comparison (99% match required)
- `diffColor` (array, default: [255, 0, 255]) - RGB color for highlighting differences (magenta)
- `snapshotDir` (string, default: '.apex/snapshots') - Directory for storing baseline snapshots
- `failOnMismatch` (boolean, default: true) - Whether to fail when visual differences are detected

## Usage in .apex/config.yaml

```yaml
visualRegression:
  enabled: true
  threshold: 0.98              # 98% similarity required
  diffColor: [255, 0, 0]       # Red highlighting for differences
  snapshotDir: '.apex/screenshots'  # Custom snapshot directory
  failOnMismatch: true         # Fail on visual differences
```

## Code Integration

The configuration is:
- ✅ Defined in `packages/core/src/types.ts`
- ✅ Integrated into main `ApexConfigSchema`
- ✅ Loaded via `loadConfig()` function
- ✅ Available through `getEffectiveConfig()` with defaults
- ✅ Exported for use in other packages

## Validation

All configuration values are validated using Zod schemas:
- `threshold` must be between 0 and 1
- `diffColor` must be an array of 3 RGB values (0-255 each)
- `snapshotDir` must be a valid string path
- All fields are optional and have sensible defaults

The implementation is complete and ready for use.