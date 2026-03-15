import type Database from 'better-sqlite3';
import * as crypto from 'crypto';

/**
 * Memory types for categorizing stored knowledge
 */
export type MemoryType = 'fact' | 'insight' | 'preference' | 'convention' | 'pattern';

/**
 * A stored memory entry
 */
export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  tags: string[];
  source: string;
  sourceTaskId?: string;
  sourceAgent?: string;
  confidence: number;
  accessCount: number;
  lastAccessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Search criteria for querying memories
 */
export interface MemorySearchCriteria {
  query?: string;
  types?: MemoryType[];
  tags?: string[];
  minConfidence?: number;
  limit?: number;
  source?: string;
}

/**
 * Living memory file for persistent project knowledge
 */
export interface LivingMemoryFile {
  id: string;
  name: string;
  content: string;
  category: string;
  lastUpdatedAt: Date;
  lastUpdatedBy?: string;
}

/**
 * SQLite-backed memory storage for persistent knowledge across tasks
 */
export class MemoryStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Initialize memory tables in the database
   */
  initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        source TEXT NOT NULL,
        source_task_id TEXT,
        source_agent TEXT,
        confidence REAL DEFAULT 1.0,
        access_count INTEGER DEFAULT 0,
        last_accessed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        metadata TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
      CREATE INDEX IF NOT EXISTS idx_memories_confidence ON memories(confidence);
      CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

      CREATE TABLE IF NOT EXISTS living_memory_files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        content TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        last_updated_at TEXT NOT NULL,
        last_updated_by TEXT
      );
    `);
  }

  /**
   * Store a new memory
   */
  storeMemory(memory: Omit<Memory, 'id' | 'accessCount' | 'createdAt' | 'updatedAt'>): Memory {
    const id = crypto.randomUUID();
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, type, content, tags, source, source_task_id, source_agent,
        confidence, access_count, last_accessed_at, created_at, updated_at, expires_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      memory.type,
      memory.content,
      JSON.stringify(memory.tags || []),
      memory.source,
      memory.sourceTaskId || null,
      memory.sourceAgent || null,
      memory.confidence ?? 1.0,
      memory.lastAccessedAt?.toISOString() || null,
      now.toISOString(),
      now.toISOString(),
      memory.expiresAt?.toISOString() || null,
      JSON.stringify(memory.metadata || {})
    );

    return {
      id,
      ...memory,
      tags: memory.tags || [],
      confidence: memory.confidence ?? 1.0,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Search memories using TF-IDF-style text scoring
   */
  searchMemories(criteria: MemorySearchCriteria): Memory[] {
    let sql = 'SELECT * FROM memories WHERE 1=1';
    const params: unknown[] = [];

    if (criteria.types && criteria.types.length > 0) {
      sql += ` AND type IN (${criteria.types.map(() => '?').join(',')})`;
      params.push(...criteria.types);
    }

    if (criteria.minConfidence !== undefined) {
      sql += ' AND confidence >= ?';
      params.push(criteria.minConfidence);
    }

    if (criteria.source) {
      sql += ' AND source = ?';
      params.push(criteria.source);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      // Check if any of the search tags appear in the stored tags JSON array
      const tagConditions = criteria.tags.map(() => `tags LIKE ?`);
      sql += ` AND (${tagConditions.join(' OR ')})`;
      params.push(...criteria.tags.map(tag => `%"${tag}"%`));
    }

    // Remove expired memories
    sql += ` AND (expires_at IS NULL OR expires_at > ?)`;
    params.push(new Date().toISOString());

    sql += ' ORDER BY confidence DESC, access_count DESC, created_at DESC';

    if (criteria.limit) {
      sql += ' LIMIT ?';
      params.push(criteria.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as MemoryRow[];

    let results = rows.map(row => this.rowToMemory(row));

    // Apply text search scoring if query provided
    if (criteria.query) {
      results = this.scoreByRelevance(results, criteria.query);
    }

    return results;
  }

  /**
   * Get memories relevant to a task description
   */
  getRelevantMemories(taskDescription: string, limit: number = 10): Memory[] {
    return this.searchMemories({
      query: taskDescription,
      limit,
      minConfidence: 0.3,
    });
  }

  /**
   * Update access count when a memory is retrieved
   */
  touchMemory(id: string): void {
    this.db.prepare(`
      UPDATE memories
      SET access_count = access_count + 1,
          last_accessed_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), id);
  }

  /**
   * Delete a memory by id
   */
  deleteMemory(id: string): boolean {
    const result = this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Delete memories matching criteria
   */
  forgetMemories(criteria: { source?: string; tags?: string[]; type?: MemoryType }): number {
    let sql = 'DELETE FROM memories WHERE 1=1';
    const params: unknown[] = [];

    if (criteria.source) {
      sql += ' AND source = ?';
      params.push(criteria.source);
    }

    if (criteria.type) {
      sql += ' AND type = ?';
      params.push(criteria.type);
    }

    if (criteria.tags && criteria.tags.length > 0) {
      const tagConditions = criteria.tags.map(() => `tags LIKE ?`);
      sql += ` AND (${tagConditions.join(' OR ')})`;
      params.push(...criteria.tags.map(tag => `%"${tag}"%`));
    }

    const result = this.db.prepare(sql).run(...params);
    return result.changes;
  }

  /**
   * Remove expired memories
   */
  pruneExpiredMemories(): number {
    const result = this.db.prepare(
      'DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?'
    ).run(new Date().toISOString());
    return result.changes;
  }

  /**
   * Get all memories (with optional pagination)
   */
  getAllMemories(limit: number = 50, offset: number = 0): Memory[] {
    const rows = this.db.prepare(
      'SELECT * FROM memories ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset) as MemoryRow[];
    return rows.map(row => this.rowToMemory(row));
  }

  /**
   * Get memory count
   */
  getMemoryCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
    return row.count;
  }

  // Living Memory File operations

  /**
   * Create or update a living memory file
   */
  upsertLivingMemory(file: Omit<LivingMemoryFile, 'id' | 'lastUpdatedAt'>): LivingMemoryFile {
    const now = new Date();
    const existing = this.db.prepare('SELECT id FROM living_memory_files WHERE name = ?').get(file.name) as { id: string } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE living_memory_files SET content = ?, category = ?, last_updated_at = ?, last_updated_by = ?
        WHERE name = ?
      `).run(file.content, file.category, now.toISOString(), file.lastUpdatedBy || null, file.name);
      return { id: existing.id, ...file, lastUpdatedAt: now };
    }

    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO living_memory_files (id, name, content, category, last_updated_at, last_updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, file.name, file.content, file.category, now.toISOString(), file.lastUpdatedBy || null);
    return { id, ...file, lastUpdatedAt: now };
  }

  /**
   * Get a living memory file by name
   */
  getLivingMemory(name: string): LivingMemoryFile | null {
    const row = this.db.prepare('SELECT * FROM living_memory_files WHERE name = ?').get(name) as LivingMemoryRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      category: row.category,
      lastUpdatedAt: new Date(row.last_updated_at),
      lastUpdatedBy: row.last_updated_by || undefined,
    };
  }

  /**
   * Get all living memory files
   */
  getAllLivingMemories(): LivingMemoryFile[] {
    const rows = this.db.prepare('SELECT * FROM living_memory_files ORDER BY name').all() as LivingMemoryRow[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      content: row.content,
      category: row.category,
      lastUpdatedAt: new Date(row.last_updated_at),
      lastUpdatedBy: row.last_updated_by || undefined,
    }));
  }

  /**
   * Delete a living memory file
   */
  deleteLivingMemory(name: string): boolean {
    const result = this.db.prepare('DELETE FROM living_memory_files WHERE name = ?').run(name);
    return result.changes > 0;
  }

  // Private helpers

  private scoreByRelevance(memories: Memory[], query: string): Memory[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) return memories;

    return memories
      .map(memory => {
        const content = memory.content.toLowerCase();
        const tags = memory.tags.join(' ').toLowerCase();
        let score = 0;

        for (const term of queryTerms) {
          // Content match
          const contentMatches = (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          score += contentMatches * 2;

          // Tag match (higher weight)
          const tagMatches = (tags.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          score += tagMatches * 5;
        }

        // Boost by confidence and recency
        score *= memory.confidence;
        const ageInDays = (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        score *= Math.max(0.5, 1 - ageInDays / 365); // Decay over a year

        return { memory, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.memory);
  }

  private rowToMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      type: row.type as MemoryType,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      source: row.source,
      sourceTaskId: row.source_task_id || undefined,
      sourceAgent: row.source_agent || undefined,
      confidence: row.confidence,
      accessCount: row.access_count,
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}

// Internal row type
interface MemoryRow {
  id: string;
  type: string;
  content: string;
  tags: string;
  source: string;
  source_task_id: string | null;
  source_agent: string | null;
  confidence: number;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  metadata: string;
}

interface LivingMemoryRow {
  id: string;
  name: string;
  content: string;
  category: string;
  last_updated_at: string;
  last_updated_by: string | null;
}
