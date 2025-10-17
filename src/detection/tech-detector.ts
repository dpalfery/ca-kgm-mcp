/**
 * Technology/Framework Detection
 * 
 * Extracts technology and framework mentions from text using a registry
 * of known technologies with aliases and fuzzy matching.
 */

export interface TechnologyEntry {
  name: string;
  aliases: string[];
  category: string;
  keywords: string[];
}

export interface TechnologyDetectionResult {
  name: string;
  category: string;
  confidence: number;
}

/**
 * Registry of known technologies with aliases and categories
 */
const TECH_REGISTRY: TechnologyEntry[] = [
  // Frontend Frameworks
  {
    name: 'React',
    aliases: ['react', 'reactjs', 'react.js', 'react-dom'],
    category: 'frontend',
    keywords: ['component', 'jsx', 'hooks', 'useState', 'useEffect']
  },
  {
    name: 'Vue',
    aliases: ['vue', 'vuejs', 'vue.js'],
    category: 'frontend',
    keywords: ['component', 'directive', 'computed', 'reactive']
  },
  {
    name: 'Angular',
    aliases: ['angular', 'angularjs'],
    category: 'frontend',
    keywords: ['component', 'directive', 'service', 'module', 'dependency injection']
  },
  {
    name: 'Svelte',
    aliases: ['svelte', 'sveltekit'],
    category: 'frontend',
    keywords: ['component', 'reactive', 'store']
  },

  // Backend Frameworks
  {
    name: 'Express',
    aliases: ['express', 'express.js', 'expressjs'],
    category: 'backend',
    keywords: ['middleware', 'route', 'router', 'app.get', 'app.post']
  },
  {
    name: 'NestJS',
    aliases: ['nest', 'nestjs', 'nest.js'],
    category: 'backend',
    keywords: ['controller', 'provider', 'module', 'decorator', 'injectable']
  },
  {
    name: 'FastAPI',
    aliases: ['fastapi', 'fast-api'],
    category: 'backend',
    keywords: ['async', 'endpoint', 'pydantic', 'router']
  },
  {
    name: 'Django',
    aliases: ['django'],
    category: 'backend',
    keywords: ['model', 'view', 'template', 'orm', 'queryset']
  },
  {
    name: 'Spring Boot',
    aliases: ['spring', 'spring boot', 'springboot'],
    category: 'backend',
    keywords: ['bean', 'controller', 'service', 'repository', 'autowired']
  },

  // Databases
  {
    name: 'PostgreSQL',
    aliases: ['postgres', 'postgresql', 'psql'],
    category: 'database',
    keywords: ['sql', 'relational', 'schema', 'table', 'query']
  },
  {
    name: 'MongoDB',
    aliases: ['mongodb', 'mongo'],
    category: 'database',
    keywords: ['nosql', 'document', 'collection', 'bson']
  },
  {
    name: 'MySQL',
    aliases: ['mysql'],
    category: 'database',
    keywords: ['sql', 'relational', 'schema', 'table']
  },
  {
    name: 'Redis',
    aliases: ['redis'],
    category: 'database',
    keywords: ['cache', 'key-value', 'in-memory']
  },
  {
    name: 'Neo4j',
    aliases: ['neo4j'],
    category: 'database',
    keywords: ['graph', 'cypher', 'node', 'relationship']
  },

  // ORMs
  {
    name: 'Prisma',
    aliases: ['prisma'],
    category: 'orm',
    keywords: ['schema', 'model', 'migration', 'client']
  },
  {
    name: 'TypeORM',
    aliases: ['typeorm', 'type-orm'],
    category: 'orm',
    keywords: ['entity', 'repository', 'migration', 'decorator']
  },
  {
    name: 'Sequelize',
    aliases: ['sequelize'],
    category: 'orm',
    keywords: ['model', 'migration', 'association']
  },
  {
    name: 'Mongoose',
    aliases: ['mongoose'],
    category: 'orm',
    keywords: ['schema', 'model', 'document']
  },

  // Languages
  {
    name: 'TypeScript',
    aliases: ['typescript', 'ts'],
    category: 'language',
    keywords: ['type', 'interface', 'generic', 'enum']
  },
  {
    name: 'JavaScript',
    aliases: ['javascript', 'js', 'ecmascript'],
    category: 'language',
    keywords: ['function', 'promise', 'async', 'await']
  },
  {
    name: 'Python',
    aliases: ['python', 'py'],
    category: 'language',
    keywords: ['def', 'class', 'import', 'async']
  },
  {
    name: 'Java',
    aliases: ['java'],
    category: 'language',
    keywords: ['class', 'interface', 'public', 'private']
  },
  {
    name: 'Go',
    aliases: ['go', 'golang'],
    category: 'language',
    keywords: ['func', 'struct', 'interface', 'goroutine']
  },

  // Cloud Platforms
  {
    name: 'AWS',
    aliases: ['aws', 'amazon web services'],
    category: 'cloud',
    keywords: ['ec2', 's3', 'lambda', 'dynamodb', 'cloudformation']
  },
  {
    name: 'Azure',
    aliases: ['azure', 'microsoft azure'],
    category: 'cloud',
    keywords: ['app service', 'functions', 'storage']
  },
  {
    name: 'GCP',
    aliases: ['gcp', 'google cloud', 'google cloud platform'],
    category: 'cloud',
    keywords: ['compute engine', 'cloud functions', 'app engine']
  },

  // Container & Orchestration
  {
    name: 'Docker',
    aliases: ['docker'],
    category: 'container',
    keywords: ['container', 'dockerfile', 'image', 'compose']
  },
  {
    name: 'Kubernetes',
    aliases: ['kubernetes', 'k8s'],
    category: 'orchestration',
    keywords: ['pod', 'deployment', 'service', 'namespace', 'helm']
  },

  // Testing
  {
    name: 'Jest',
    aliases: ['jest'],
    category: 'testing',
    keywords: ['test', 'describe', 'expect', 'mock']
  },
  {
    name: 'Vitest',
    aliases: ['vitest'],
    category: 'testing',
    keywords: ['test', 'describe', 'expect', 'vi']
  },
  {
    name: 'Pytest',
    aliases: ['pytest'],
    category: 'testing',
    keywords: ['test', 'fixture', 'assert']
  },

  // API Protocols
  {
    name: 'REST',
    aliases: ['rest', 'restful', 'rest api'],
    category: 'api',
    keywords: ['http', 'get', 'post', 'put', 'delete', 'endpoint']
  },
  {
    name: 'GraphQL',
    aliases: ['graphql', 'gql'],
    category: 'api',
    keywords: ['query', 'mutation', 'schema', 'resolver']
  },
  {
    name: 'gRPC',
    aliases: ['grpc', 'grpc'],
    category: 'api',
    keywords: ['protobuf', 'proto', 'service']
  }
];

/**
 * Detect technologies mentioned in text
 */
export function detectTechnologies(text: string): TechnologyDetectionResult[] {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const wordSet = new Set(words);

  const detectedTechs: Map<string, TechnologyDetectionResult> = new Map();

  for (const tech of TECH_REGISTRY) {
    let matchScore = 0;
    let maxScore = 0;

    // Check aliases
    for (const alias of tech.aliases) {
      const aliasWords = alias.toLowerCase().split(/\s+/);
      maxScore += 2;

      // Exact phrase match
      if (normalizedText.includes(alias.toLowerCase())) {
        matchScore += 2;
        break; // Found exact match, no need to check other aliases
      }
      // All words present
      else if (aliasWords.every(word => wordSet.has(word))) {
        matchScore += 1.5;
      }
      // Some words present
      else if (aliasWords.some(word => wordSet.has(word))) {
        matchScore += 0.5;
      }
    }

    // Check keywords for additional confidence
    for (const keyword of tech.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (normalizedText.includes(keywordLower)) {
        matchScore += 0.3;
      }
    }

    // Calculate confidence
    const confidence = maxScore > 0 ? Math.min(matchScore / maxScore, 1.0) : 0;

    // Only include if there's a reasonable match
    if (confidence > 0.5) {
      detectedTechs.set(tech.name, {
        name: tech.name,
        category: tech.category,
        confidence
      });
    }
  }

  // Convert to array and sort by confidence
  return Array.from(detectedTechs.values())
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get technologies by category
 */
export function getTechnologiesByCategory(
  detectedTechs: TechnologyDetectionResult[]
): Record<string, TechnologyDetectionResult[]> {
  const grouped: Record<string, TechnologyDetectionResult[]> = {};

  for (const tech of detectedTechs) {
    if (!grouped[tech.category]) {
      grouped[tech.category] = [];
    }
    grouped[tech.category].push(tech);
  }

  return grouped;
}

/**
 * Check if a specific technology is mentioned
 */
export function hasTechnology(text: string, techName: string): boolean {
  const detected = detectTechnologies(text);
  return detected.some(t => t.name.toLowerCase() === techName.toLowerCase());
}
