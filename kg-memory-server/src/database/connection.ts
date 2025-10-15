import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Database connection manager for the Knowledge Graph Memory system
 * Extends the base Memory MCP Server with SQLite-based storage
 */
export class DatabaseConnection {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor(dbPath?: string) {
    // Default to memory.db in the same directory as the main script
    const defaultPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)), 
      '../../memory.db'
    );
    
    this.dbPath = dbPath || process.env.MEMORY_DB_PATH || defaultPath;
  }

  /**
   * Initialize the database connection and run migrations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to connect to database: ${err.message}`));
          return;
        }

        try {
          await this.runMigrations();
          this.isInitialized = true;
          resolve();
        } catch (migrationError) {
          reject(migrationError);
        }
      });
    });
  }

  /**
   * Run database migrations to set up schema
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    // Enable foreign keys
    await this.run('PRAGMA foreign_keys = ON');
    
    // Enable WAL mode for better concurrency
    await this.run('PRAGMA journal_mode = WAL');

    // Read and execute schema
    const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Parse SQL statements properly, handling triggers and other complex statements
    const statements = this.parseSqlStatements(schema);

    for (const statement of statements) {
      if (statement.trim()) {
        await this.run(statement);
      }
    }
  }

  /**
   * Parse SQL statements from schema, properly handling triggers and other complex statements
   */
  private parseSqlStatements(sql: string): string[] {
    const statements: string[] = [];
    let currentStatement = '';
    let inTrigger = false;
    let triggerDepth = 0;
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check if we're entering a trigger
      if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
        inTrigger = true;
        triggerDepth = 0;
      }
      
      // Track BEGIN/END depth in triggers
      if (inTrigger) {
        if (trimmedLine.toUpperCase().includes('BEGIN')) {
          triggerDepth++;
        }
        if (trimmedLine.toUpperCase().includes('END')) {
          triggerDepth--;
          if (triggerDepth === 0) {
            // End of trigger, add semicolon and complete statement
            if (trimmedLine.endsWith(';')) {
              statements.push(currentStatement.trim());
              currentStatement = '';
              inTrigger = false;
            }
          }
        }
      } else {
        // Not in trigger, split on semicolon
        if (trimmedLine.endsWith(';')) {
          statements.push(currentStatement.trim());
          currentStatement = '';
        }
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => stmt.length > 0);
  }

  /**
   * Execute a SQL statement
   */
  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(new Error(`SQL execution failed: ${err.message}\nSQL: ${sql}`));
        } else {
          resolve(this);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return a single row
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err: Error | null, row: any) => {
        if (err) {
          reject(new Error(`SQL query failed: ${err.message}\nSQL: ${sql}`));
        } else {
          resolve(row as T);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return all rows
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(new Error(`SQL query failed: ${err.message}\nSQL: ${sql}`));
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * Execute multiple SQL statements in a transaction
   */
  async transaction(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    await this.run('BEGIN TRANSACTION');
    
    try {
      for (const { sql, params = [] } of statements) {
        await this.run(sql, params);
      }
      await this.run('COMMIT');
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db!.close((err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to close database: ${err.message}`));
        } else {
          this.db = null;
          this.isInitialized = false;
          resolve();
        }
      });
    });
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalRules: number;
    totalDirectives: number;
    totalRelationships: number;
    dbSize: number;
  }> {
    const [rulesCount, directivesCount, relationshipsCount] = await Promise.all([
      this.get<{ count: number }>('SELECT COUNT(*) as count FROM rules'),
      this.get<{ count: number }>('SELECT COUNT(*) as count FROM directives'),
      this.get<{ count: number }>('SELECT COUNT(*) as count FROM rule_relationships')
    ]);

    // Get database file size
    let dbSize = 0;
    try {
      const stats = await fs.stat(this.dbPath);
      dbSize = stats.size;
    } catch {
      // File might not exist yet
    }

    return {
      totalRules: rulesCount?.count || 0,
      totalDirectives: directivesCount?.count || 0,
      totalRelationships: relationshipsCount?.count || 0,
      dbSize
    };
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance for the application
let dbInstance: DatabaseConnection | null = null;

/**
 * Get the singleton database connection instance
 */
export function getDatabase(): DatabaseConnection {
  if (!dbInstance) {
    dbInstance = new DatabaseConnection();
  }
  return dbInstance;
}

/**
 * Initialize the database connection (should be called at startup)
 */
export async function initializeDatabase(): Promise<DatabaseConnection> {
  const db = getDatabase();
  await db.initialize();
  return db;
}