import * as fs from 'fs';
import * as path from 'path';

// Knowledge Graph Schema Types
interface RuleEntity {
  name: string;
  description: string;
  whenToApply: string;
  authoritativeFor: string[];
  layerTags: string[];
  topics: string[];
  filePath: string;
  content: string;
}

interface SectionEntity {
  title: string;
  layerTags: string[];
  topics: string[];
  filePath: string;
  content: string;
}

interface DirectiveEntity {
  text: string;
  severity: 'must' | 'should' | 'may';
  layerTags: string[];
  topics: string[];
  filePath: string;
  sectionTitle: string;
}

interface PatternEntity {
  snippet: string;
  topics: string[];
  filePath: string;
  context: string;
}

// MCP Integration
async function createEntities(entities: any[]) {
  // Use MCP tool to create entities
  // This will be called via use_mcp_tool
}

async function createRelations(relations: any[]) {
  // Use MCP tool to create relations
}

// Parser Functions
function parseMarkdownFile(filePath: string): { rules: RuleEntity[], sections: SectionEntity[], directives: DirectiveEntity[], patterns: PatternEntity[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const rules: RuleEntity[] = [];
  const sections: SectionEntity[] = [];
  const directives: DirectiveEntity[] = [];
  const patterns: PatternEntity[] = [];

  let currentRule: Partial<RuleEntity> | null = null;
  let currentSection: Partial<SectionEntity> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Parse rule metadata (frontmatter-like)
    if (line.startsWith('name: ')) {
      currentRule = {
        name: line.replace('name: ', ''),
        filePath,
        content: '',
        authoritativeFor: [],
        layerTags: [],
        topics: []
      };
    } else if (currentRule && line.startsWith('description: ')) {
      currentRule.description = line.replace('description: ', '');
    } else if (currentRule && line.startsWith('when-to-apply: ')) {
      currentRule.whenToApply = line.replace('when-to-apply: ', '');
    } else if (currentRule && line.startsWith('rule: |')) {
      // Start collecting rule content
      let ruleContent = '';
      i++; // Skip the 'rule: |' line
      while (i < lines.length && !lines[i].startsWith('---')) {
        ruleContent += lines[i] + '\n';
        i++;
      }
      currentRule.content = ruleContent;
      rules.push(currentRule as RuleEntity);
      currentRule = null;
    }

    // Parse sections (H2/H3)
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentSection) {
        sections.push(currentSection as SectionEntity);
      }
      currentSection = {
        title: line.replace(/^#+\s*/, ''),
        filePath,
        content: '',
        layerTags: [],
        topics: []
      };
      // Extract tags from title or content
      extractTagsFromContent(currentSection, line);
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }

    // Parse directives (bullets)
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const directive: DirectiveEntity = {
        text: line.substring(2),
        severity: 'should', // Default, will be updated based on content
        layerTags: [],
        topics: [],
        filePath,
        sectionTitle: currentSection?.title || ''
      };

      // Determine severity
      if (directive.text.toLowerCase().includes('must') || directive.text.toLowerCase().includes('never')) {
        directive.severity = 'must';
      } else if (directive.text.toLowerCase().includes('should')) {
        directive.severity = 'should';
      } else {
        directive.severity = 'may';
      }

      extractTagsFromContent(directive, directive.text);
      directives.push(directive);
    }

    // Parse patterns/examples (code blocks or specific markers)
    if (line.startsWith('```') || line.includes('Example:')) {
      let patternContent = '';
      if (line.startsWith('```')) {
        i++; // Skip opening ```
        while (i < lines.length && !lines[i].startsWith('```')) {
          patternContent += lines[i] + '\n';
          i++;
        }
      } else {
        // Collect example content
        while (i < lines.length && !lines[i].startsWith('##') && !lines[i].startsWith('###')) {
          patternContent += lines[i] + '\n';
          i++;
        }
        i--; // Back up one line
      }

      const pattern: PatternEntity = {
        snippet: patternContent,
        topics: [],
        filePath,
        context: currentSection?.title || ''
      };
      extractTagsFromContent(pattern, patternContent);
      patterns.push(pattern);
    }
  }

  // Close any remaining section
  if (currentSection) {
    sections.push(currentSection as SectionEntity);
  }

  return { rules, sections, directives, patterns };
}

function extractTagsFromContent(entity: any, content: string) {
  // Extract layer tags (e.g., 1-Presentation, 4-Persistence)
  const layerMatches = content.match(/\b\d-[A-Za-z]+\b/g);
  if (layerMatches) {
    entity.layerTags = layerMatches;
  }

  // Extract topics (security, testing, process, architecture)
  const topicMatches = content.match(/\b(security|testing|process|architecture|data|build|quality)\b/gi);
  if (topicMatches) {
    entity.topics = topicMatches.map(t => t.toLowerCase());
  }
}

// Main crawler function
async function crawlKnowledgeSources() {
  const sourceDirs = [
    '.kilocode/rules',
    '.kilocode/rules/memory-bank',
    '6-Docs'
  ];

  const allEntities = {
    rules: [] as RuleEntity[],
    sections: [] as SectionEntity[],
    directives: [] as DirectiveEntity[],
    patterns: [] as PatternEntity[]
  };

  for (const dir of sourceDirs) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        const entities = parseMarkdownFile(filePath);

        allEntities.rules.push(...entities.rules);
        allEntities.sections.push(...entities.sections);
        allEntities.directives.push(...entities.directives);
        allEntities.patterns.push(...entities.patterns);
      }
    }
  }

  // Create entities in MCP
  await createEntities([
    ...allEntities.rules.map(r => ({ name: r.name, entityType: 'Rule', observations: [r.description, r.whenToApply, ...r.layerTags, ...r.topics] })),
    ...allEntities.sections.map(s => ({ name: s.title, entityType: 'Section', observations: [s.content, ...s.layerTags, ...s.topics] })),
    ...allEntities.directives.map(d => ({ name: d.text.substring(0, 50) + '...', entityType: 'Directive', observations: [d.text, d.severity, ...d.layerTags, ...d.topics] })),
    ...allEntities.patterns.map(p => ({ name: 'Pattern', entityType: 'Pattern', observations: [p.snippet, ...p.topics] }))
  ]);

  // Create relations
  const relations = [];

  // Rule CONTAINS Section
  for (const rule of allEntities.rules) {
    for (const section of allEntities.sections) {
      if (section.filePath === rule.filePath) {
        relations.push({ from: rule.name, to: section.title, relationType: 'CONTAINS' });
      }
    }
  }

  // Section CONTAINS Directive
  for (const section of allEntities.sections) {
    for (const directive of allEntities.directives) {
      if (directive.filePath === section.filePath && directive.sectionTitle === section.title) {
        relations.push({ from: section.title, to: directive.text.substring(0, 50) + '...', relationType: 'CONTAINS' });
      }
    }
  }

  // Rule APPLIES_TO Layer
  for (const rule of allEntities.rules) {
    for (const layer of rule.layerTags) {
      relations.push({ from: rule.name, to: layer, relationType: 'APPLIES_TO' });
    }
  }

  // Rule IS_AUTHORITATIVE_FOR Topic
  for (const rule of allEntities.rules) {
    for (const topic of rule.topics) {
      relations.push({ from: rule.name, to: topic, relationType: 'IS_AUTHORITATIVE_FOR' });
    }
  }

  await createRelations(relations);
}

// Run the crawler
crawlKnowledgeSources().then(() => {
  console.log('Knowledge graph crawling completed');
}).catch(console.error);