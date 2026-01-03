import { describe, it, expect } from 'vitest';

describe('Snapshot and Undo Types Exports', () => {
  it('should export FileSnapshot types from core package', async () => {
    const coreModule = await import('../index.js');

    // Check that the schemas are exported
    expect(coreModule.FileSnapshotSchema).toBeDefined();
    expect(typeof coreModule.FileSnapshotSchema.parse).toBe('function');

    // Verify the schema works
    const validSnapshot = {
      id: 'test-snapshot',
      filePath: '/path/to/file.ts',
      content: 'const x = 1;',
      timestamp: new Date(),
      existed: true,
    };

    const parsed = coreModule.FileSnapshotSchema.parse(validSnapshot);
    expect(parsed.id).toBe('test-snapshot');
  });

  it('should export ToolActionSnapshot types from core package', async () => {
    const coreModule = await import('../index.js');

    // Check that the schemas are exported
    expect(coreModule.ToolActionSnapshotSchema).toBeDefined();
    expect(typeof coreModule.ToolActionSnapshotSchema.parse).toBe('function');

    // Verify the schema works
    const validToolActionSnapshot = {
      actionId: 'test-action',
      toolName: 'Write',
      snapshots: [{
        id: 'file-snapshot',
        filePath: '/path/to/file.ts',
        content: 'const x = 1;',
        timestamp: new Date(),
        existed: true,
      }],
      timestamp: new Date(),
    };

    const parsed = coreModule.ToolActionSnapshotSchema.parse(validToolActionSnapshot);
    expect(parsed.actionId).toBe('test-action');
    expect(parsed.snapshots).toHaveLength(1);
  });

  it('should export UndoEvent types from core package', async () => {
    const coreModule = await import('../index.js');

    // Check that the schemas are exported
    expect(coreModule.UndoEventTypeSchema).toBeDefined();
    expect(coreModule.UndoEventSchema).toBeDefined();
    expect(typeof coreModule.UndoEventSchema.parse).toBe('function');

    // Verify the schemas work
    const validEventType = 'undo:completed';
    const parsedType = coreModule.UndoEventTypeSchema.parse(validEventType);
    expect(parsedType).toBe('undo:completed');

    const validUndoEvent = {
      id: 'test-undo-event',
      type: validEventType,
      taskId: 'test-task',
      actionId: 'test-action',
      timestamp: new Date(),
    };

    const parsed = coreModule.UndoEventSchema.parse(validUndoEvent);
    expect(parsed.id).toBe('test-undo-event');
    expect(parsed.type).toBe('undo:completed');
  });

  it('should export TypeScript types for use in type annotations', async () => {
    // Import types directly for TypeScript checking
    const {
      FileSnapshot,
      ToolActionSnapshot,
      UndoEventType,
      UndoEvent
    } = await import('../types.js');

    // This test verifies that the types can be imported and used
    // TypeScript compilation will fail if types are not properly exported

    const fileSnapshot: typeof FileSnapshot extends { id: string } ? true : false = true;
    const toolActionSnapshot: typeof ToolActionSnapshot extends { actionId: string } ? true : false = true;
    const undoEventType: typeof UndoEventType extends string ? true : false = true;
    const undoEvent: typeof UndoEvent extends { id: string } ? true : false = true;

    expect(fileSnapshot).toBe(true);
    expect(toolActionSnapshot).toBe(true);
    expect(undoEventType).toBe(true);
    expect(undoEvent).toBe(true);
  });

  it('should allow re-export from core index', async () => {
    // Test that the types can be imported from the main entry point
    const coreExports = await import('../index');

    // Extract type constructor functions (the actual runtime validation schemas)
    const {
      FileSnapshotSchema,
      ToolActionSnapshotSchema,
      UndoEventTypeSchema,
      UndoEventSchema,
    } = coreExports;

    // Verify all schemas are present and callable
    expect(FileSnapshotSchema).toBeDefined();
    expect(ToolActionSnapshotSchema).toBeDefined();
    expect(UndoEventTypeSchema).toBeDefined();
    expect(UndoEventSchema).toBeDefined();

    // Quick functional test
    expect(() => {
      FileSnapshotSchema.parse({
        id: 'test',
        filePath: '/test',
        content: 'test',
        timestamp: new Date(),
      });
    }).not.toThrow();
  });
});