import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseConnection } from '../connection.js';
import { MigrationManager } from '../migrations.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

describe('MigrationManager', () => {
  let db: DatabaseConnection;
  let migrationManager: MigrationManager;
  let tempDbPath: string;

  beforeEach(async () => {
    // Create temporary database for testing
    tempDbPath = path.join(process.cwd(), `test-${Date.now()}.db`);
    db = new DatabaseConnection(tempDbPath);
    await db.initialize();
    migrationManager = new MigrationManager(db);
  });

  afterEach(async () => {
    await db.close();
    // Clean up temporary database
    try {
      await fs.unlink(tempDbPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('initializeMigrationsTable', () => {
    it('should create schema_migrations table', async () => {
      await migrationManager.initializeMigrationsTable();
      
      const tableExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      );
      
      expect(tableExists).toBeDefined();
      expect(tableExists?.name).toBe('schema_migrations');
    });

    it('should not fail if migrations table already exists', async () => {
      await migrationManager.initializeMigrationsTable();
      await migrationManager.initializeMigrationsTable(); // Second call should not fail
      
      const tableExists = await db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      );
      
      expect(tableExists).toBeDefined();
    });
  });

  describe('getAppliedMigrations', () => {
    it('should return empty array when no migrations applied', async () => {
      await migrationManager.initializeMigrationsTable();
      const applied = await migrationManager.getAppliedMigrations();
      expect(applied).toEqual([]);
    });

    it('should return applied migrations in order', async () => {
      await migrationManager.initializeMigrationsTable();
      
      // Manually insert some migration records
      await db.run(
        'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
        ['001_initial', 'checksum1']
      );
      await db.run(
        'INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)',
        ['002_add_rules', 'checksum2']
      );
      
      const applied = await migrationManager.getAppliedMigrations();
      expect(applied).toEqual(['001_initial', '002_add_rules']);
    });
  });

  describe('getAvailableMigrations', () => {
    it('should return empty array when migrations directory does not exist', async () => {
      const available = await migrationManager.getAvailableMigrations();
      expect(available).toEqual([]);
    });
  });

  describe('parseMigrationSql', () => {
    it('should parse SQL statements correctly', async () => {
      const migrationSql = `
        CREATE TABLE test_table (id INTEGER PRIMARY KEY);
        INSERT INTO test_table (id) VALUES (1);
        -- This is a comment
        UPDATE test_table SET id = 2 WHERE id = 1;
      `;
      
      // Access private method for testing
      const parsedStatements = (migrationManager as any).parseMigrationSql(migrationSql);
      
      expect(parsedStatements).toHaveLength(3);
      expect(parsedStatements[0].sql.trim()).toBe('CREATE TABLE test_table (id INTEGER PRIMARY KEY)');
      expect(parsedStatements[1].sql.trim()).toBe('INSERT INTO test_table (id) VALUES (1)');
      expect(parsedStatements[2].sql.trim()).toBe('UPDATE test_table SET id = 2 WHERE id = 1');
    });

    it('should filter out empty statements and comments', async () => {
      const migrationSql = `
        -- This is a comment
        CREATE TABLE test_table (id INTEGER);
        
        -- Another comment
        ;
        INSERT INTO test_table (id) VALUES (1);
      `;
      
      const parsedStatements = (migrationManager as any).parseMigrationSql(migrationSql);
      
      expect(parsedStatements).toHaveLength(2);
      expect(parsedStatements[0].sql.trim()).toBe('CREATE TABLE test_table (id INTEGER)');
      expect(parsedStatements[1].sql.trim()).toBe('INSERT INTO test_table (id) VALUES (1)');
    });
  });

  describe('calculateChecksum', () => {
    it('should generate consistent checksums for same content', async () => {
      const content = 'CREATE TABLE test (id INTEGER);';
      
      const checksum1 = (migrationManager as any).calculateChecksum(content);
      const checksum2 = (migrationManager as any).calculateChecksum(content);
      
      expect(checksum1).toBe(checksum2);
    });

    it('should generate different checksums for different content', async () => {
      const content1 = 'CREATE TABLE test1 (id INTEGER);';
      const content2 = 'CREATE TABLE test2 (id INTEGER);';
      
      const checksum1 = (migrationManager as any).calculateChecksum(content1);
      const checksum2 = (migrationManager as any).calculateChecksum(content2);
      
      expect(checksum1).not.toBe(checksum2);
    });

    it('should normalize whitespace in content', async () => {
      const content1 = 'CREATE TABLE test (id INTEGER);';
      const content2 = 'CREATE   TABLE   test   (id   INTEGER);';
      
      const checksum1 = (migrationManager as any).calculateChecksum(content1);
      const checksum2 = (migrationManager as any).calculateChecksum(content2);
      
      expect(checksum1).toBe(checksum2);
    });
  });

  describe('validateMigrations', () => {
    it('should return valid when no migrations applied', async () => {
      await migrationManager.initializeMigrationsTable();
      
      const validation = await migrationManager.validateMigrations();
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });
  });
});