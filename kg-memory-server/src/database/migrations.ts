import { DatabaseConnection } from './connection.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Database migration system for managing schema changes
 */
export class MigrationManager {
  private db: DatabaseConnection;
  private migrationsPath: string;

  constructor(db: DatabaseConnection) {
    this.db = db;
    this.migrationsPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)), 
      'migrations'
    );
  }

  /**
   * Initialize the migrations table
   */
  async initializeMigrationsTable(): Promise<void> {
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `);
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations(): Promise<string[]> {
    const rows = await this.db.all<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return rows.map(row => row.version);
  }

  /**
   * Get list of available migration files
   */
  async getAvailableMigrations(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .map(file => file.replace('.sql', ''))
        .sort();
    } catch {
      // Migrations directory doesn't exist yet
      return [];
    }
  }

  /**
   * Apply a single migration
   */
  async applyMigration(version: string): Promise<void> {
    const migrationPath = path.join(this.migrationsPath, `${version}.sql`);
    
    try {
      const migrationSql = await fs.readFile(migrationPath, 'utf-8');
      const checksum = this.calculateChecksum(migrationSql);

      // Execute migration in a transaction
      await this.db.transaction([
        ...this.parseMigrationSql(migrationSql),
        {
          sql: 'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
          params: [version, checksum]
        }
      ]);

      console.log(`Applied migration: ${version}`);
    } catch (error) {
      throw new Error(`Failed to apply migration ${version}: ${error}`);
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    await this.initializeMigrationsTable();
    
    const applied = await this.getAppliedMigrations();
    const available = await this.getAvailableMigrations();
    
    const pending = available.filter(version => !applied.includes(version));
    
    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pending.length} pending migrations...`);
    
    for (const version of pending) {
      await this.applyMigration(version);
    }
    
    console.log('All migrations completed successfully');
  }

  /**
   * Create a new migration file
   */
  async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const version = `${timestamp}_${name}`;
    const filename = `${version}.sql`;
    const filepath = path.join(this.migrationsPath, filename);

    // Ensure migrations directory exists
    await fs.mkdir(this.migrationsPath, { recursive: true });

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- ALTER TABLE rules ADD COLUMN new_field TEXT;
-- CREATE INDEX idx_new_field ON rules(new_field);

-- Remember to test your migration thoroughly!
`;

    await fs.writeFile(filepath, template);
    console.log(`Created migration: ${filename}`);
    
    return version;
  }

  /**
   * Rollback the last migration (if rollback SQL is provided)
   */
  async rollbackMigration(version: string): Promise<void> {
    const rollbackPath = path.join(this.migrationsPath, `${version}_rollback.sql`);
    
    try {
      const rollbackSql = await fs.readFile(rollbackPath, 'utf-8');
      
      await this.db.transaction([
        ...this.parseMigrationSql(rollbackSql),
        {
          sql: 'DELETE FROM schema_migrations WHERE version = ?',
          params: [version]
        }
      ]);

      console.log(`Rolled back migration: ${version}`);
    } catch (error) {
      throw new Error(`Failed to rollback migration ${version}: ${error}`);
    }
  }

  /**
   * Parse migration SQL into individual statements
   */
  private parseMigrationSql(sql: string): Array<{ sql: string; params?: any[] }> {
    return sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .map(stmt => ({ sql: stmt }));
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    // Simple checksum using content length and first/last chars
    // In production, you might want to use a proper hash function
    const normalized = content.replace(/\s+/g, ' ').trim();
    return `${normalized.length}-${normalized.charCodeAt(0)}-${normalized.charCodeAt(normalized.length - 1)}`;
  }

  /**
   * Validate migration integrity
   */
  async validateMigrations(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const applied = await this.getAppliedMigrations();
    
    for (const version of applied) {
      const migrationPath = path.join(this.migrationsPath, `${version}.sql`);
      
      try {
        const content = await fs.readFile(migrationPath, 'utf-8');
        const currentChecksum = this.calculateChecksum(content);
        
        const stored = await this.db.get<{ checksum: string }>(
          'SELECT checksum FROM schema_migrations WHERE version = ?',
          [version]
        );
        
        if (stored && stored.checksum !== currentChecksum) {
          errors.push(`Migration ${version} has been modified after application`);
        }
      } catch {
        errors.push(`Migration file ${version}.sql not found`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Create and return a migration manager instance
 */
export function createMigrationManager(db: DatabaseConnection): MigrationManager {
  return new MigrationManager(db);
}