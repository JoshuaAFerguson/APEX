import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SessionStore, Session, SessionMessage, ToolCallRecord } from '../SessionStore';

/**
 * Comprehensive SessionStore Audit Tests
 *
 * This test suite provides comprehensive verification of SessionStore
 * functionality against all acceptance criteria:
 *
 * ✅ CRUD Operations: create/get/update/delete sessions work
 * ✅ Session Branching: parent-child relationships are correct
 * ✅ Archive Compression: gzip compression and storage works
 * ✅ Export Formats: md/json/html produce valid output
 * ✅ Index Management: session index operations function correctly
 */
describe('SessionStore Comprehensive Audit Tests', () => {
  let tempDir: string;
  let store: SessionStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-session-audit-'));
    store = new SessionStore(tempDir);
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('✅ AC1: CRUD Operations Verification', () => {
    it('should CREATE sessions with all required fields', async () => {
      const session = await store.createSession('Test CRUD Session');

      // Verify session creation
      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_\d+_\w+$/);
      expect(session.name).toBe('Test CRUD Session');
      expect(session.projectPath).toBe(tempDir);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
      expect(session.lastAccessedAt).toBeInstanceOf(Date);
      expect(session.messages).toEqual([]);
      expect(session.inputHistory).toEqual([]);
      expect(session.state).toEqual({
        totalTokens: { input: 0, output: 0 },
        totalCost: 0,
        tasksCreated: [],
        tasksCompleted: []
      });
      expect(session.childSessionIds).toEqual([]);
      expect(session.tags).toEqual([]);
    });

    it('should GET sessions with data integrity', async () => {
      // Create session with comprehensive data
      const originalSession = await store.createSession('Get Test Session');

      // Add comprehensive test data
      const message: SessionMessage = {
        id: 'test_msg_1',
        index: 0,
        role: 'assistant',
        content: 'Test message for GET verification',
        timestamp: new Date(),
        agent: 'tester',
        stage: 'testing',
        taskId: 'audit_task_1',
        tokens: { input: 50, output: 75 },
        toolCalls: [{
          id: 'test_tool_1',
          name: 'Read',
          arguments: { file_path: '/test/file.ts' },
          result: 'file content',
          timestamp: new Date()
        }]
      };

      originalSession.messages.push(message);
      originalSession.state = {
        totalTokens: { input: 50, output: 75 },
        totalCost: 0.00825,
        tasksCreated: ['audit_task_1'],
        tasksCompleted: [],
        currentTaskId: 'audit_task_1'
      };
      originalSession.tags = ['audit', 'crud'];

      await store.updateSession(originalSession.id, originalSession);

      // Retrieve and verify
      const retrievedSession = await store.getSession(originalSession.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.name).toBe('Get Test Session');
      expect(retrievedSession!.messages).toHaveLength(1);
      expect(retrievedSession!.messages[0].content).toBe('Test message for GET verification');
      expect(retrievedSession!.state.totalTokens).toEqual({ input: 50, output: 75 });
      expect(retrievedSession!.tags).toEqual(['audit', 'crud']);
    });

    it('should UPDATE sessions preserving data integrity', async () => {
      const session = await store.createSession('Update Test Session');
      const originalCreatedAt = session.createdAt;

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update session
      const updates = {
        name: 'Updated Session Name',
        tags: ['updated', 'audit'],
        state: {
          ...session.state,
          totalCost: 0.15,
          tasksCreated: ['new_task'],
          currentTaskId: 'new_task'
        }
      };

      await store.updateSession(session.id, updates);

      // Verify update
      const updatedSession = await store.getSession(session.id);
      expect(updatedSession!.name).toBe('Updated Session Name');
      expect(updatedSession!.tags).toEqual(['updated', 'audit']);
      expect(updatedSession!.state.totalCost).toBe(0.15);
      expect(updatedSession!.createdAt.getTime()).toBe(originalCreatedAt.getTime());
      expect(updatedSession!.updatedAt.getTime()).toBeGreaterThan(originalCreatedAt.getTime());
    });

    it('should DELETE sessions completely', async () => {
      const session = await store.createSession('Delete Test Session');
      const sessionId = session.id;

      // Verify session exists
      const beforeDelete = await store.getSession(sessionId);
      expect(beforeDelete).not.toBeNull();

      // Delete session
      await store.deleteSession(sessionId);

      // Verify session is deleted
      const afterDelete = await store.getSession(sessionId);
      expect(afterDelete).toBeNull();

      // Verify session file is deleted
      const sessionPath = path.join(tempDir, '.apex', 'sessions', `${sessionId}.json`);
      await expect(fs.access(sessionPath)).rejects.toThrow();
    });
  });

  describe('✅ AC2: Session Branching Parent-Child Relationships', () => {
    it('should create branched sessions with correct parent-child relationships', async () => {
      // Create parent session
      const parent = await store.createSession('Parent Session');

      // Add messages to parent
      const parentMessages: SessionMessage[] = [
        {
          id: 'parent_msg_1',
          index: 0,
          role: 'user',
          content: 'First message',
          timestamp: new Date()
        },
        {
          id: 'parent_msg_2',
          index: 1,
          role: 'assistant',
          content: 'Second message',
          timestamp: new Date()
        },
        {
          id: 'parent_msg_3',
          index: 2,
          role: 'user',
          content: 'Third message',
          timestamp: new Date()
        }
      ];

      parent.messages = parentMessages;
      await store.updateSession(parent.id, { messages: parentMessages });

      // Branch at index 1 (should include messages 0 and 1)
      const branched = await store.branchSession(parent.id, 1, 'Branched Session');

      // Verify branched session structure
      expect(branched.parentSessionId).toBe(parent.id);
      expect(branched.branchPoint).toBe(1);
      expect(branched.messages).toHaveLength(2); // Messages 0 and 1
      expect(branched.messages[0].content).toBe('First message');
      expect(branched.messages[1].content).toBe('Second message');
      expect(branched.name).toBe('Branched Session');

      // Verify parent session has child reference
      const updatedParent = await store.getSession(parent.id);
      expect(updatedParent!.childSessionIds).toContain(branched.id);

      // Verify both sessions persist correctly
      const persistedParent = await store.getSession(parent.id);
      const persistedBranched = await store.getSession(branched.id);

      expect(persistedParent!.messages).toHaveLength(3);
      expect(persistedBranched!.messages).toHaveLength(2);
      expect(persistedBranched!.parentSessionId).toBe(parent.id);
    });

    it('should handle multiple levels of branching', async () => {
      // Create original session
      const original = await store.createSession('Original Session');
      original.messages = [
        { id: 'orig_1', index: 0, role: 'user', content: 'Original message', timestamp: new Date() }
      ];
      await store.updateSession(original.id, { messages: original.messages });

      // First branch
      const branch1 = await store.branchSession(original.id, 0, 'Branch 1');

      // Add message to first branch
      branch1.messages.push({
        id: 'branch1_1',
        index: 1,
        role: 'assistant',
        content: 'Branch 1 message',
        timestamp: new Date()
      });
      await store.updateSession(branch1.id, { messages: branch1.messages });

      // Second branch from first branch
      const branch2 = await store.branchSession(branch1.id, 1, 'Branch 2');

      // Verify hierarchy
      expect(branch1.parentSessionId).toBe(original.id);
      expect(branch2.parentSessionId).toBe(branch1.id);

      const updatedOriginal = await store.getSession(original.id);
      const updatedBranch1 = await store.getSession(branch1.id);

      expect(updatedOriginal!.childSessionIds).toContain(branch1.id);
      expect(updatedBranch1!.childSessionIds).toContain(branch2.id);
    });
  });

  describe('✅ AC3: Archive Compression Functionality', () => {
    it('should compress and archive sessions using gzip', async () => {
      // Create session with substantial content
      const session = await store.createSession('Archive Test Session');

      // Add substantial content
      session.messages = Array.from({ length: 10 }, (_, i) => ({
        id: `archive_msg_${i}`,
        index: i,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `This is message ${i} with substantial content: ${'x'.repeat(100)}`,
        timestamp: new Date(),
        tokens: { input: 25, output: 35 }
      }));

      session.state = {
        totalTokens: { input: 250, output: 350 },
        totalCost: 6.0,
        tasksCreated: ['archive_task_1', 'archive_task_2'],
        tasksCompleted: ['archive_task_1']
      };

      await store.updateSession(session.id, session);

      // Archive the session
      await store.archiveSession(session.id);

      // Verify session is archived
      const archivePath = path.join(tempDir, '.apex', 'sessions', 'archive', `${session.id}.json.gz`);
      const archiveExists = await fs.access(archivePath).then(() => true).catch(() => false);
      expect(archiveExists).toBe(true);

      // Verify original session file is removed
      const originalPath = path.join(tempDir, '.apex', 'sessions', `${session.id}.json`);
      const originalExists = await fs.access(originalPath).then(() => true).catch(() => false);
      expect(originalExists).toBe(false);

      // Verify compressed file is smaller than original would be
      const compressedSize = (await fs.stat(archivePath)).size;
      const originalContent = JSON.stringify(session);
      expect(compressedSize).toBeLessThan(originalContent.length);

      // Verify archived session can still be retrieved
      const retrievedSession = await store.getSession(session.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.name).toBe('Archive Test Session');
      expect(retrievedSession!.messages).toHaveLength(10);
      expect(retrievedSession!.state.totalCost).toBe(6.0);
    });

    it('should handle archive retrieval after process restart', async () => {
      // Create and archive a session
      const session = await store.createSession('Restart Archive Test');
      session.messages = [{
        id: 'restart_msg',
        index: 0,
        role: 'user',
        content: 'This message should survive restart',
        timestamp: new Date()
      }];
      await store.updateSession(session.id, session);
      await store.archiveSession(session.id);

      // Simulate restart with new store instance
      const newStore = new SessionStore(tempDir);
      await newStore.initialize();

      // Verify archived session can be retrieved
      const retrievedSession = await newStore.getSession(session.id);
      expect(retrievedSession).not.toBeNull();
      expect(retrievedSession!.messages[0].content).toBe('This message should survive restart');
    });
  });

  describe('✅ AC4: Export Format Validation (md/json/html)', () => {
    let testSession: Session;

    beforeEach(async () => {
      testSession = await store.createSession('Export Format Test');
      testSession.messages = [
        {
          id: 'export_msg_1',
          index: 0,
          role: 'user',
          content: 'Hello APEX, please help me test exports',
          timestamp: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'export_msg_2',
          index: 1,
          role: 'assistant',
          content: 'I will help you test the export functionality',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          agent: 'tester',
          stage: 'testing',
          tokens: { input: 20, output: 30 }
        }
      ];
      testSession.state = {
        totalTokens: { input: 20, output: 30 },
        totalCost: 0.51,
        tasksCreated: ['export_task'],
        tasksCompleted: []
      };
      testSession.tags = ['export', 'test'];
      await store.updateSession(testSession.id, testSession);
    });

    it('should export valid Markdown format', async () => {
      const markdown = await store.exportSession(testSession.id, 'md');

      // Verify markdown structure
      expect(markdown).toContain('# APEX Session: Export Format Test');
      expect(markdown).toContain('**Created:**');
      expect(markdown).toContain('**Total Messages:** 2');
      expect(markdown).toContain('**Total Cost:** $0.5100');
      expect(markdown).toContain('**Tokens:** 50');
      expect(markdown).toContain('### **User**');
      expect(markdown).toContain('Hello APEX, please help me test exports');
      expect(markdown).toContain('### **Assistant (tester)**');
      expect(markdown).toContain('Agent: tester | Stage: testing | Tokens: 50');
      expect(markdown).toContain('I will help you test the export functionality');
      expect(markdown).toContain('---');
      expect(markdown).toContain('*Exported from APEX on');

      // Verify it's valid markdown (basic checks)
      const lines = markdown.split('\n');
      const headerLine = lines.find(line => line.startsWith('# APEX Session:'));
      expect(headerLine).toBeDefined();
    });

    it('should export valid JSON format', async () => {
      const jsonString = await store.exportSession(testSession.id, 'json');

      // Verify it's valid JSON
      const parsedJson = JSON.parse(jsonString);

      // Verify JSON structure
      expect(parsedJson.id).toBe(testSession.id);
      expect(parsedJson.name).toBe('Export Format Test');
      expect(parsedJson.created).toBe(testSession.createdAt.toISOString());
      expect(parsedJson.messages).toHaveLength(2);
      expect(parsedJson.messages[0].role).toBe('user');
      expect(parsedJson.messages[0].content).toBe('Hello APEX, please help me test exports');
      expect(parsedJson.messages[1].role).toBe('assistant');
      expect(parsedJson.messages[1].metadata.agent).toBe('tester');
      expect(parsedJson.messages[1].metadata.stage).toBe('testing');
      expect(parsedJson.messages[1].metadata.tokens).toEqual({ input: 20, output: 30 });
      expect(parsedJson.state.totalTokens).toEqual({ input: 20, output: 30 });
      expect(parsedJson.state.totalCost).toBe(0.51);
      expect(parsedJson.metadata.tags).toEqual(['export', 'test']);
    });

    it('should export valid HTML format', async () => {
      const html = await store.exportSession(testSession.id, 'html');

      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<title>APEX Session: Export Format Test</title>');
      expect(html).toContain('<style>');
      expect(html).toContain('font-family: system-ui');
      expect(html).toContain('<body>');
      expect(html).toContain('<h1>APEX Session: Export Format Test</h1>');
      expect(html).toContain('<div class="message user">');
      expect(html).toContain('<div class="message assistant">');
      expect(html).toContain('Hello APEX, please help me test exports');
      expect(html).toContain('I will help you test the export functionality');
      expect(html).toContain('<strong>user</strong>');
      expect(html).toContain('<strong>assistant (tester)</strong>');
      expect(html).toContain('Agent: tester');
      expect(html).toContain('Tokens: 50');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');

      // Verify it's well-formed HTML (basic checks)
      const divCount = html.split('<div').length - 1; // subtract 1 because split creates empty first element
      const divCloseCount = html.split('</div>').length - 1;
      expect(divCount).toBe(divCloseCount);

      // Check basic HTML structure is present
      expect(html).toMatch(/<div[^>]*class="message[^"]*"[^>]*>/g);
    });

    it('should write exported files to disk when outputPath is provided', async () => {
      const outputPath = path.join(tempDir, 'export-test.md');

      await store.exportSession(testSession.id, 'md', outputPath);

      // Verify file exists
      const fileExists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      // Verify file content
      const fileContent = await fs.readFile(outputPath, 'utf-8');
      expect(fileContent).toContain('# APEX Session: Export Format Test');
      expect(fileContent).toContain('Hello APEX, please help me test exports');
    });
  });

  describe('✅ AC5: Index Management Operations', () => {
    it('should maintain session index with accurate metadata', async () => {
      // Create multiple sessions
      const session1 = await store.createSession('Index Test 1');
      const session2 = await store.createSession('Index Test 2');
      const session3 = await store.createSession('Index Test 3');

      // Add different amounts of content to each
      session1.messages = Array.from({ length: 5 }, (_, i) => ({
        id: `s1_msg_${i}`,
        index: i,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      }));
      session1.state.totalCost = 1.25;
      session1.tags = ['test1', 'index'];

      session2.messages = Array.from({ length: 3 }, (_, i) => ({
        id: `s2_msg_${i}`,
        index: i,
        role: 'assistant',
        content: `Response ${i}`,
        timestamp: new Date()
      }));
      session2.state.totalCost = 0.75;
      session2.tags = ['test2'];

      await store.updateSession(session1.id, session1);
      await store.updateSession(session2.id, session2);

      // List sessions and verify index accuracy
      const sessions = await store.listSessions();

      expect(sessions).toHaveLength(3);

      const s1Summary = sessions.find(s => s.id === session1.id);
      const s2Summary = sessions.find(s => s.id === session2.id);
      const s3Summary = sessions.find(s => s.id === session3.id);

      expect(s1Summary).toBeDefined();
      expect(s1Summary!.name).toBe('Index Test 1');
      expect(s1Summary!.messageCount).toBe(5);
      expect(s1Summary!.totalCost).toBe(1.25);
      expect(s1Summary!.tags).toEqual(['test1', 'index']);

      expect(s2Summary).toBeDefined();
      expect(s2Summary!.name).toBe('Index Test 2');
      expect(s2Summary!.messageCount).toBe(3);
      expect(s2Summary!.totalCost).toBe(0.75);
      expect(s2Summary!.tags).toEqual(['test2']);

      expect(s3Summary).toBeDefined();
      expect(s3Summary!.name).toBe('Index Test 3');
      expect(s3Summary!.messageCount).toBe(0);
      expect(s3Summary!.totalCost).toBe(0);
    });

    it('should support session filtering by search, tags, and archived status', async () => {
      // Create test sessions
      const session1 = await store.createSession('Production Session');
      session1.tags = ['production', 'important'];
      await store.updateSession(session1.id, session1);

      const session2 = await store.createSession('Development Session');
      session2.tags = ['development', 'test'];
      await store.updateSession(session2.id, session2);

      const session3 = await store.createSession('Testing Session');
      session3.tags = ['test'];
      await store.updateSession(session3.id, session3);

      // Archive one session
      await store.archiveSession(session2.id);

      // Test search functionality
      const searchResults = await store.listSessions({ search: 'production' });
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].name).toBe('Production Session');

      // Test tag filtering
      const testTagResults = await store.listSessions({ tags: ['test'] });
      expect(testTagResults).toHaveLength(1); // Only active sessions with 'test' tag
      expect(testTagResults[0].name).toBe('Testing Session');

      // Test archived inclusion
      const allResults = await store.listSessions({ all: true, tags: ['test'] });
      expect(allResults).toHaveLength(2); // Both active and archived with 'test' tag

      // Test limit functionality
      const limitedResults = await store.listSessions({ limit: 1 });
      expect(limitedResults).toHaveLength(1);
    });

    it('should handle index persistence across store restarts', async () => {
      // Create sessions
      await store.createSession('Persistent Session 1');
      await store.createSession('Persistent Session 2');

      // Restart store
      const newStore = new SessionStore(tempDir);
      await newStore.initialize();

      // Verify index is persisted
      const sessions = await newStore.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name).sort()).toEqual([
        'Persistent Session 1',
        'Persistent Session 2'
      ]);
    });

    it('should update index when sessions are modified or deleted', async () => {
      const session = await store.createSession('Modifiable Session');

      // Verify initial index
      let sessions = await store.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Modifiable Session');
      expect(sessions[0].messageCount).toBe(0);

      // Update session
      session.messages = [{
        id: 'new_msg',
        index: 0,
        role: 'user',
        content: 'New message',
        timestamp: new Date()
      }];
      session.name = 'Modified Session';
      await store.updateSession(session.id, session);

      // Verify index is updated
      sessions = await store.listSessions();
      expect(sessions[0].name).toBe('Modified Session');
      expect(sessions[0].messageCount).toBe(1);

      // Delete session
      await store.deleteSession(session.id);

      // Verify index is updated
      sessions = await store.listSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('🔄 Integration: End-to-End Workflow Testing', () => {
    it('should handle complete session lifecycle with all features', async () => {
      // 1. CREATE session
      const session = await store.createSession('E2E Workflow Session');
      expect(session).toBeDefined();

      // 2. UPDATE with comprehensive data
      session.messages = [
        {
          id: 'e2e_msg_1',
          index: 0,
          role: 'user',
          content: 'Start workflow test',
          timestamp: new Date(),
        },
        {
          id: 'e2e_msg_2',
          index: 1,
          role: 'assistant',
          content: 'Starting comprehensive test',
          timestamp: new Date(),
          agent: 'tester',
          tokens: { input: 30, output: 40 },
          toolCalls: [{
            id: 'e2e_tool',
            name: 'Write',
            arguments: { file_path: '/test.ts', content: 'test' },
            result: 'Success',
            timestamp: new Date()
          }]
        }
      ];
      session.state = {
        totalTokens: { input: 30, output: 40 },
        totalCost: 0.69,
        tasksCreated: ['e2e_task'],
        tasksCompleted: [],
        currentTaskId: 'e2e_task'
      };
      session.tags = ['e2e', 'comprehensive'];
      await store.updateSession(session.id, session);

      // 3. BRANCH session
      const branched = await store.branchSession(session.id, 0, 'E2E Branched');
      expect(branched.parentSessionId).toBe(session.id);
      expect(branched.messages).toHaveLength(1);

      // 4. EXPORT all formats
      const markdown = await store.exportSession(session.id, 'md');
      const json = await store.exportSession(session.id, 'json');
      const html = await store.exportSession(session.id, 'html');

      expect(markdown).toContain('# APEX Session: E2E Workflow Session');
      expect(JSON.parse(json).name).toBe('E2E Workflow Session');
      expect(html).toContain('<title>APEX Session: E2E Workflow Session</title>');

      // 5. ARCHIVE session
      await store.archiveSession(session.id);

      // Verify archived but still retrievable
      const archivedSession = await store.getSession(session.id);
      expect(archivedSession).not.toBeNull();
      expect(archivedSession!.name).toBe('E2E Workflow Session');

      // 6. INDEX verification
      const allSessions = await store.listSessions({ all: true });
      const archivedInIndex = allSessions.find(s => s.id === session.id);
      expect(archivedInIndex!.isArchived).toBe(true);

      const activeOnly = await store.listSessions();
      const branchedInActive = activeOnly.find(s => s.id === branched.id);
      expect(branchedInActive).toBeDefined();
      expect(branchedInActive!.isArchived).toBe(false);

      // 7. Verify final state - we have both sessions
      const preCleanup = await store.listSessions({ all: true });
      expect(preCleanup).toHaveLength(2); // original + branched

      // 8. Verify both sessions can be retrieved
      const finalOriginal = await store.getSession(session.id);
      const finalBranched = await store.getSession(branched.id);
      expect(finalOriginal).not.toBeNull();
      expect(finalBranched).not.toBeNull();

      // All acceptance criteria have been verified through this comprehensive test
    });
  });
});