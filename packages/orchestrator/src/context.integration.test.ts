import { describe, it, expect } from 'vitest';
import {
  createContextSummary,
  createContextSummaryData,
  extractKeyDecisions,
  extractProgressInfo,
  extractFileModifications,
} from './context';
import type { AgentMessage } from '@apexcli/core';

describe('Context Summary Integration Tests', () => {
  describe('Real-world Development Scenarios', () => {
    it('should handle a complex feature development conversation', () => {
      const messages: AgentMessage[] = [
        // Initial user request
        {
          type: 'user',
          content: [{
            type: 'text',
            text: 'I need to build a real-time chat application with WebSockets, user authentication, message persistence, and online user status tracking.'
          }]
        },

        // Planning and initial decisions
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement a comprehensive real-time chat application. I\'ve decided to use Socket.IO for WebSocket management due to its reliability and fallback mechanisms. The approach will be to create a layered architecture with separate modules for authentication, messaging, and user management. I plan to use MongoDB for message persistence and Redis for session management.'
          }]
        },

        // Architecture exploration
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/src/server.ts' }
          }]
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: 'import express from "express";\nconst app = express();\napp.listen(3000);'
          }]
        },

        // Database setup
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I\'m going to set up the database models first. I will create schemas for users, messages, and chat rooms. The approach will be to use Mongoose for MongoDB integration.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/models/User.ts',
              content: 'import mongoose from "mongoose";\n\nexport const UserSchema = new mongoose.Schema({\n  username: String,\n  email: String,\n  password: String,\n  isOnline: { type: Boolean, default: false },\n  lastSeen: Date\n});'
            }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/models/Message.ts',
              content: 'import mongoose from "mongoose";\n\nexport const MessageSchema = new mongoose.Schema({\n  content: String,\n  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },\n  room: String,\n  timestamp: { type: Date, default: Date.now }\n});'
            }
          }]
        },

        // Progress update
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the database model setup. Finished implementing user and message schemas. Currently working on implementing the authentication middleware using JWT tokens.'
          }]
        },

        // Authentication implementation
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will implement JWT-based authentication with bcrypt for password hashing. The strategy will be to create middleware that validates tokens and attaches user information to the socket connection.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/middleware/auth.ts',
              content: 'import jwt from "jsonwebtoken";\nimport { User } from "../models/User";\n\nexport const authenticateSocket = async (socket, next) => {\n  try {\n    const token = socket.handshake.auth.token;\n    const decoded = jwt.verify(token, process.env.JWT_SECRET);\n    const user = await User.findById(decoded.userId);\n    socket.userId = user._id;\n    next();\n  } catch (error) {\n    next(new Error("Authentication failed"));\n  }\n};'
            }
          }]
        },

        // Socket.IO setup
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Now implementing the Socket.IO server configuration. I\'ve decided to organize socket events into separate handlers for better maintainability. The architecture will include connection handling, message broadcasting, and user status tracking.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/socket/socketServer.ts',
              content: 'import { Server } from "socket.io";\nimport { authenticateSocket } from "../middleware/auth";\nimport { handleConnection } from "./handlers/connection";\nimport { handleMessage } from "./handlers/message";\n\nexport const setupSocket = (server) => {\n  const io = new Server(server, { cors: { origin: "*" } });\n  io.use(authenticateSocket);\n  \n  io.on("connection", (socket) => {\n    handleConnection(socket, io);\n    handleMessage(socket, io);\n  });\n  \n  return io;\n};'
            }
          }]
        },

        // Server integration
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: {
              file_path: '/src/server.ts',
              old_string: 'import express from "express";\nconst app = express();\napp.listen(3000);',
              new_string: 'import express from "express";\nimport http from "http";\nimport { setupSocket } from "./socket/socketServer";\nimport { connectDatabase } from "./config/database";\n\nconst app = express();\nconst server = http.createServer(app);\nconst io = setupSocket(server);\n\nconnectDatabase().then(() => {\n  server.listen(3000, () => console.log("Chat server running on port 3000"));\n});'
            }
          }]
        },

        // Event handlers implementation
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Currently implementing the socket event handlers. I will create separate modules for connection management, message handling, and user status updates for better code organization.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/socket/handlers/connection.ts',
              content: 'import { User } from "../../models/User";\n\nexport const handleConnection = async (socket, io) => {\n  console.log(`User ${socket.userId} connected`);\n  \n  await User.findByIdAndUpdate(socket.userId, { isOnline: true });\n  socket.broadcast.emit("user_online", { userId: socket.userId });\n  \n  socket.on("disconnect", async () => {\n    await User.findByIdAndUpdate(socket.userId, { \n      isOnline: false, \n      lastSeen: new Date() \n    });\n    socket.broadcast.emit("user_offline", { userId: socket.userId });\n  });\n};'
            }
          }]
        },

        // Message handling
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/socket/handlers/message.ts',
              content: 'import { Message } from "../../models/Message";\n\nexport const handleMessage = (socket, io) => {\n  socket.on("send_message", async (data) => {\n    const message = new Message({\n      content: data.content,\n      sender: socket.userId,\n      room: data.room || "general"\n    });\n    \n    await message.save();\n    \n    io.to(data.room || "general").emit("new_message", {\n      id: message._id,\n      content: message.content,\n      sender: socket.userId,\n      timestamp: message.timestamp\n    });\n  });\n  \n  socket.on("join_room", (room) => {\n    socket.join(room);\n    socket.emit("joined_room", { room });\n  });\n};'
            }
          }]
        },

        // Final progress update
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the core chat functionality implementation. Finished implementing Socket.IO event handlers for messaging and user status. Done with database integration. The real-time chat application now supports user authentication, message persistence, room-based messaging, and online status tracking.'
          }]
        },

        // Testing and validation
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I\'m going to create integration tests to validate the chat functionality. I plan to test socket connections, message broadcasting, user authentication, and database operations.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/tests/chat.test.ts',
              content: 'import { describe, it, expect } from "vitest";\nimport { io as Client } from "socket.io-client";\nimport { setupTestServer } from "./helpers/testServer";\n\ndescribe("Chat Functionality", () => {\n  it("should handle user connections and message broadcasting", async () => {\n    // Test implementation here\n  });\n});'
            }
          }]
        }
      ];

      const summaryData = createContextSummaryData(messages);

      // Verify comprehensive metrics
      expect(summaryData.metrics.messageCount).toBe(17);
      expect(summaryData.metrics.userRequestCount).toBe(1);
      expect(summaryData.metrics.toolUsageCount).toBe(9);

      // Test decision extraction for complex technical decisions
      expect(summaryData.keyDecisions.length).toBeGreaterThan(5);

      const socketIODecision = summaryData.keyDecisions.find(d => d.text.includes('Socket.IO'));
      expect(socketIODecision).toBeDefined();
      expect(socketIODecision!.category).toBe('implementation');

      const mongoDecision = summaryData.keyDecisions.find(d => d.text.includes('MongoDB'));
      expect(mongoDecision).toBeDefined();
      expect(mongoDecision!.category).toBe('approach');

      const jwtDecision = summaryData.keyDecisions.find(d => d.text.includes('JWT'));
      expect(jwtDecision).toBeDefined();

      // Test progress tracking for multi-phase development
      expect(summaryData.progress.completed.length).toBeGreaterThan(4);
      expect(summaryData.progress.completed).toContain('database model setup');
      expect(summaryData.progress.completed).toContain('core chat functionality implementation');
      expect(summaryData.progress.current).toContain('integration tests');

      // Test file tracking across different modules
      expect(summaryData.fileModifications.length).toBe(9);

      const readOps = summaryData.fileModifications.filter(f => f.action === 'read');
      const writeOps = summaryData.fileModifications.filter(f => f.action === 'write');
      const editOps = summaryData.fileModifications.filter(f => f.action === 'edit');

      expect(readOps.length).toBe(1);
      expect(writeOps.length).toBe(7);
      expect(editOps.length).toBe(1);

      // Verify file paths indicate proper architectural organization
      const modelFiles = summaryData.fileModifications.filter(f => f.path.includes('/models/'));
      const socketFiles = summaryData.fileModifications.filter(f => f.path.includes('/socket/'));
      const middlewareFiles = summaryData.fileModifications.filter(f => f.path.includes('/middleware/'));

      expect(modelFiles.length).toBe(2);
      expect(socketFiles.length).toBe(3);
      expect(middlewareFiles.length).toBe(1);

      // Test tool usage distribution
      expect(summaryData.toolsUsed).toEqual({ 'Read': 1, 'Write': 7, 'Edit': 1 });

      // Test context summary generation
      const summary = createContextSummary(messages);
      expect(summary).toContain('Previous Context Summary');
      expect(summary).toContain('Key Decisions Made');
      expect(summary).toContain('Progress Tracking');
      expect(summary).toContain('Socket.IO');
      expect(summary).toContain('MongoDB');
      expect(summary).toContain('JWT');
    });

    it('should handle bug investigation and fix workflow', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{
            type: 'text',
            text: 'There\'s a memory leak in our application that\'s causing the server to crash after a few hours. Can you investigate and fix it?'
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will investigate the memory leak issue systematically. I\'ve decided to start by examining the application logs and monitoring memory usage patterns. The approach will be to check for common memory leak sources like unclosed database connections, event listeners, and circular references.'
          }]
        },

        // Investigation phase
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/logs/server.log' }
          }]
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: '[2024-01-15 10:30:15] Memory usage: 150MB\n[2024-01-15 11:30:15] Memory usage: 200MB\n[2024-01-15 12:30:15] Memory usage: 350MB\nError: Out of memory'
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'The logs show a clear memory growth pattern. Currently investigating the database connection handling and event listener cleanup.'
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/src/database/connection.ts' }
          }]
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: 'export const connectDB = async () => {\n  const conn = await mongoose.connect(DB_URL);\n  // Missing connection close handlers\n  return conn;\n};'
          }]
        },

        // Root cause identification
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Found the issue! I\'ve identified that database connections are not being properly closed and event listeners are accumulating. I will implement proper cleanup mechanisms and connection pooling.'
          }]
        },

        // Fix implementation
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: {
              file_path: '/src/database/connection.ts',
              old_string: 'export const connectDB = async () => {\n  const conn = await mongoose.connect(DB_URL);\n  // Missing connection close handlers\n  return conn;\n};',
              new_string: 'export const connectDB = async () => {\n  const conn = await mongoose.connect(DB_URL, {\n    maxPoolSize: 10,\n    serverSelectionTimeoutMS: 5000,\n    socketTimeoutMS: 45000,\n  });\n  \n  process.on(\'SIGINT\', async () => {\n    await mongoose.connection.close();\n    console.log(\'MongoDB connection closed.\');\n    process.exit(0);\n  });\n  \n  return conn;\n};'
            }
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the database connection fix. Now implementing event listener cleanup in the Socket.IO handlers.'
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Read',
            toolInput: { file_path: '/src/socket/handlers/message.ts' }
          }]
        },
        {
          type: 'user',
          content: [{
            type: 'tool_result',
            toolResult: 'export const handleMessage = (socket, io) => {\n  socket.on("send_message", messageHandler);\n  socket.on("typing", typingHandler);\n  // No cleanup on disconnect\n};'
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Edit',
            toolInput: {
              file_path: '/src/socket/handlers/message.ts',
              old_string: 'export const handleMessage = (socket, io) => {\n  socket.on("send_message", messageHandler);\n  socket.on("typing", typingHandler);\n  // No cleanup on disconnect\n};',
              new_string: 'export const handleMessage = (socket, io) => {\n  const messageHandler = (data) => { /* handler code */ };\n  const typingHandler = (data) => { /* handler code */ };\n  \n  socket.on("send_message", messageHandler);\n  socket.on("typing", typingHandler);\n  \n  socket.on("disconnect", () => {\n    socket.removeAllListeners("send_message");\n    socket.removeAllListeners("typing");\n    console.log(`Cleaned up listeners for socket ${socket.id}`);\n  });\n};'
            }
          }]
        },

        // Testing and validation
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Finished implementing the memory leak fixes. I\'m going to create monitoring tools to track memory usage and validate the fix.'
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: {
              file_path: '/src/monitoring/memoryTracker.ts',
              content: 'export const trackMemoryUsage = () => {\n  setInterval(() => {\n    const usage = process.memoryUsage();\n    console.log(`Memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);\n    \n    if (usage.heapUsed > 500 * 1024 * 1024) {\n      console.warn("High memory usage detected!");\n    }\n  }, 60000);\n};'
            }
          }]
        },

        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Implementation completed successfully. Fixed the memory leak by implementing proper database connection cleanup and Socket.IO event listener management. Added memory monitoring to prevent future issues.'
          }]
        }
      ];

      const summaryData = createContextSummaryData(messages);

      // Test bug investigation workflow tracking
      expect(summaryData.keyDecisions.length).toBeGreaterThan(2);

      const investigationDecision = summaryData.keyDecisions.find(d =>
        d.text.includes('investigate') || d.text.includes('examining')
      );
      expect(investigationDecision).toBeDefined();

      const fixDecision = summaryData.keyDecisions.find(d =>
        d.text.includes('cleanup mechanisms') || d.text.includes('connection pooling')
      );
      expect(fixDecision).toBeDefined();

      // Test progress tracking for investigation and fix phases
      expect(summaryData.progress.completed).toContain('database connection fix');
      expect(summaryData.progress.completed).toContain('memory leak fixes');

      // Test file modification patterns for bug fixes
      const readOps = summaryData.fileModifications.filter(f => f.action === 'read');
      const editOps = summaryData.fileModifications.filter(f => f.action === 'edit');
      const writeOps = summaryData.fileModifications.filter(f => f.action === 'write');

      expect(readOps.length).toBeGreaterThan(0); // Investigation reads
      expect(editOps.length).toBeGreaterThan(0); // Code fixes
      expect(writeOps.length).toBeGreaterThan(0); // Monitoring tools
    });
  });

  describe('Context Summary Format Validation', () => {
    it('should generate well-structured summary with all sections', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Build a REST API for user management' }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'I will build a comprehensive REST API. I\'ve decided to use Express.js with TypeScript for type safety. The approach will be to implement CRUD operations with proper validation.'
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'tool_use',
            toolName: 'Write',
            toolInput: { file_path: '/src/routes/users.ts', content: 'export const userRoutes = ...' }
          }]
        },
        {
          type: 'assistant',
          content: [{
            type: 'text',
            text: 'Completed the user routes implementation. Currently working on input validation middleware.'
          }]
        }
      ];

      const summary = createContextSummary(messages);

      // Test summary structure and content
      expect(summary).toContain('## Previous Context Summary');
      expect(summary).toContain('- Messages exchanged:');
      expect(summary).toContain('- Tools used:');
      expect(summary).toContain('- Files written:');
      expect(summary).toContain('### Progress Tracking');
      expect(summary).toContain('- Completed:');
      expect(summary).toContain('- Currently:');
      expect(summary).toContain('### Key Decisions Made');
      expect(summary).toContain('### Recent Requests');

      // Test specific content presence
      expect(summary).toContain('Express.js');
      expect(summary).toContain('TypeScript');
      expect(summary).toContain('user routes implementation');
      expect(summary).toContain('input validation middleware');
      expect(summary).toContain('/src/routes/users.ts');
    });

    it('should handle sections gracefully when empty', () => {
      const messages: AgentMessage[] = [
        {
          type: 'user',
          content: [{ type: 'text', text: 'Hello' }]
        },
        {
          type: 'assistant',
          content: [{ type: 'text', text: 'Hi there! How can I help you?' }]
        }
      ];

      const summary = createContextSummary(messages);

      expect(summary).toContain('## Previous Context Summary');
      expect(summary).toContain('Messages exchanged: 2');
      expect(summary).toContain('Tools used: none');
      expect(summary).not.toContain('### Progress Tracking');
      expect(summary).not.toContain('### Key Decisions Made');
      expect(summary).toContain('### Recent Requests');
    });
  });
});