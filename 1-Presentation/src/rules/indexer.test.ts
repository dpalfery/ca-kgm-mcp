import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RuleManager } from './rule-manager';
import { RulesEngineConfig } from '../config/rules-engine-config';
import { Neo4jConfig } from '../config/neo4j-types';

// Build a minimal rules engine config
const rulesEngineConfig: RulesEngineConfig = {
  llm: {
    provider: 'local',
    endpoint: 'http://localhost:11434',
    model: 'local-model'
  },
  processing: {
    enableSplitting: false,
    minWordCountForSplit: 250,
    enableDirectiveGeneration: false,
    minWordCountForGeneration: 100
  },
  queryDefaults: {
    maxItems: 8,
    tokenBudget: 0,
    includeMetadata: false
  },
  modes: {
    allowedModes: ['code']
  }
};

const neo4jConfig: Neo4jConfig = {
  uri: 'bolt://localhost:7687',
  username: 'neo4j',
  password: 'password',
  database: 'neo4j',
  workspace: 'tests',
  encrypted: false,
  maxConnectionPoolSize: 1,
  connectionTimeout: 1000
};

describe('Indexer case-insensitive matching', () => {
  it('matchesPattern is case-insensitive for extensions', () => {
    const rm = new RuleManager(neo4jConfig, rulesEngineConfig) as any;
    expect(rm.matchesPattern('C:/tmp/ReadMe.MD', '**/*.md')).toBe(true);
    expect(rm.matchesPattern('C:/TMP/docs/notes.mD', '**/*.md')).toBe(true);
    expect(rm.matchesPattern('C:/tmp/file.txt', '**/*.md')).toBe(false);
  });
});

describe('index_rules respects case-insensitive file patterns', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ctxiso-index-'));
  const docsDir = path.join(tmpRoot, 'Docs');
  const nestedDir = path.join(docsDir, 'Nested');

  beforeAll(() => {
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'README.MD'), '# Title\n\n## Section');
    fs.writeFileSync(path.join(docsDir, 'guide.md'), '# Guide');
    fs.writeFileSync(path.join(nestedDir, 'Notes.mD'), '## Nested');
  });

  afterAll(() => {
    // Cleanup temp dir
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  it('finds .md files regardless of case via memory.rules.index_rules', async () => {
    const rm = new RuleManager(neo4jConfig, rulesEngineConfig);

    // Stub memory manager to avoid DB calls
    const memoryStub = {
      handleTool: vi.fn().mockResolvedValue({ created: 0, entities: [], total: 0 })
    } as any;
    rm.setMemoryManager(memoryStub);

    // Configure env for indexer
    const prev = {
      INDEX_PATHS: process.env.INDEX_PATHS,
      INDEX_FILE_PATTERN: process.env.INDEX_FILE_PATTERN,
      INDEX_EXCLUDE_PATTERNS: process.env.INDEX_EXCLUDE_PATTERNS
    };

    process.env.INDEX_PATHS = docsDir;
    process.env.INDEX_FILE_PATTERN = '**/*.md';
    delete process.env.INDEX_EXCLUDE_PATTERNS;

    try {
      const result = await (rm as any).handleTool('memory.rules.index_rules', {});
      expect(result).toBeTruthy();
      expect(Array.isArray(result.files)).toBe(true);
      // Should find at least the three files we created
      expect(result.files.length).toBeGreaterThanOrEqual(3);
      // Ensure at least one upper-case extension file is included
      const hasUpper = result.files.some((f: string) => /README\.MD$/i.test(f));
      expect(hasUpper).toBe(true);
    } finally {
      // Restore env
      process.env.INDEX_PATHS = prev.INDEX_PATHS;
      process.env.INDEX_FILE_PATTERN = prev.INDEX_FILE_PATTERN;
      process.env.INDEX_EXCLUDE_PATTERNS = prev.INDEX_EXCLUDE_PATTERNS;
    }
  }, 20000);
});
