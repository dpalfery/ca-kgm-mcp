import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import { RuleManager } from './rule-manager';
import { RulesEngineConfig } from '../config/rules-engine-config';
import { Neo4jConfig } from '../config/neo4j-types';

// External path provided by user
const EXTERNAL_RULES_DIR = 'C:/git/bolt-hotshot-logistics/.kilocode/rules-old';

// Minimal configs (we don't hit the DB in this test)
const rulesEngineConfig: RulesEngineConfig = {
  llm: { provider: 'local', endpoint: 'http://localhost:11434', model: 'local-model' },
  processing: { enableSplitting: false, minWordCountForSplit: 250, enableDirectiveGeneration: false, minWordCountForGeneration: 100 },
  queryDefaults: { maxItems: 8, tokenBudget: 0, includeMetadata: false },
  modes: { allowedModes: ['code'] }
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

describe('External indexing (bolt-hotshot-logistics rules-old)', () => {
  const exists = fs.existsSync(EXTERNAL_RULES_DIR);
  const maybeIt: typeof it = exists ? it : it.skip;

  maybeIt('indexes 12 markdown files from external folder', async () => {
    // Arrange
    const rm = new RuleManager(neo4jConfig, rulesEngineConfig);
    const memoryStub = { handleTool: vi.fn().mockResolvedValue({ created: 0, entities: [], total: 0 }) } as any;
    rm.setMemoryManager(memoryStub);

    const prev = {
      INDEX_PATHS: process.env.INDEX_PATHS,
      INDEX_FILE_PATTERN: process.env.INDEX_FILE_PATTERN,
      INDEX_EXCLUDE_PATTERNS: process.env.INDEX_EXCLUDE_PATTERNS,
    };

    process.env.INDEX_PATHS = EXTERNAL_RULES_DIR;
    process.env.INDEX_FILE_PATTERN = '**/*.md'; // case-insensitive matching is handled in code
    delete process.env.INDEX_EXCLUDE_PATTERNS;

    try {
      // Act
      const result = await (rm as any).handleTool('memory.rules.index_rules', {});

      // Assert
      expect(result).toBeTruthy();
      expect(Array.isArray(result.files)).toBe(true);
      expect(result.files.length).toBe(12);
    } finally {
      // Cleanup env
      process.env.INDEX_PATHS = prev.INDEX_PATHS;
      process.env.INDEX_FILE_PATTERN = prev.INDEX_FILE_PATTERN;
      process.env.INDEX_EXCLUDE_PATTERNS = prev.INDEX_EXCLUDE_PATTERNS;
    }
  }, 30000);
});
