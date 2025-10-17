/**
 * Technology/Framework Detection Module
 * 
 * Extracts technology and framework mentions from text with fuzzy matching
 * to handle aliases and variations (React vs ReactJS vs React.js, etc).
 */

export interface TechEntry {
  name: string;
  aliases: string[];
  category: string;  // 'frontend', 'backend', 'database', 'devops', 'testing', etc.
}

export interface DetectedTech {
  name: string;
  category: string;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy';
}

// Comprehensive technology registry
const TECHNOLOGY_REGISTRY: TechEntry[] = [
  // Frontend
  { name: 'React', aliases: ['reactjs', 'react.js', 'reactx'], category: 'frontend' },
  { name: 'Vue', aliases: ['vuejs', 'vue.js'], category: 'frontend' },
  { name: 'Angular', aliases: ['angularjs', 'angular2+', 'ng'], category: 'frontend' },
  { name: 'Svelte', aliases: ['sveltejs'], category: 'frontend' },
  { name: 'Next.js', aliases: ['nextjs', 'next'], category: 'frontend' },
  { name: 'Nuxt', aliases: ['nuxtjs'], category: 'frontend' },
  { name: 'TypeScript', aliases: ['ts'], category: 'frontend' },
  { name: 'JavaScript', aliases: ['js'], category: 'frontend' },
  { name: 'HTML', aliases: ['html5'], category: 'frontend' },
  { name: 'CSS', aliases: ['css3', 'scss', 'sass'], category: 'frontend' },
  
  // Backend
  { name: 'Node.js', aliases: ['nodejs', 'node'], category: 'backend' },
  { name: 'Express', aliases: ['expressjs'], category: 'backend' },
  { name: 'Fastify', aliases: ['fastifyjs'], category: 'backend' },
  { name: 'Python', aliases: ['py'], category: 'backend' },
  { name: 'Django', aliases: ['djangoframework'], category: 'backend' },
  { name: 'FastAPI', aliases: ['fastapi'], category: 'backend' },
  { name: 'Java', aliases: ['jvm'], category: 'backend' },
  { name: 'Spring', aliases: ['springboot', 'spring-boot'], category: 'backend' },
  { name: 'Go', aliases: ['golang'], category: 'backend' },
  { name: 'Rust', aliases: ['rustlang'], category: 'backend' },
  { name: 'C#', aliases: ['.net', 'dotnet', 'csharp'], category: 'backend' },
  { name: 'Ruby', aliases: ['ruby-on-rails', 'rails'], category: 'backend' },
  
  // Databases
  { name: 'PostgreSQL', aliases: ['postgres', 'pg'], category: 'database' },
  { name: 'MySQL', aliases: ['mysql'], category: 'database' },
  { name: 'MongoDB', aliases: ['mongo', 'nosql'], category: 'database' },
  { name: 'Neo4j', aliases: ['neo4j', 'graph'], category: 'database' },
  { name: 'Redis', aliases: ['redis'], category: 'database' },
  { name: 'Elasticsearch', aliases: ['elastic', 'es'], category: 'database' },
  { name: 'DynamoDB', aliases: ['dynamodb'], category: 'database' },
  { name: 'Firestore', aliases: ['firebase'], category: 'database' },
  
  // DevOps & Infrastructure
  { name: 'Docker', aliases: ['dockercontainer', 'containerization'], category: 'devops' },
  { name: 'Kubernetes', aliases: ['k8s', 'k8', 'kube'], category: 'devops' },
  { name: 'AWS', aliases: ['amazon web services'], category: 'devops' },
  { name: 'Azure', aliases: ['microsoft azure'], category: 'devops' },
  { name: 'GCP', aliases: ['google cloud'], category: 'devops' },
  { name: 'GitHub', aliases: ['github'], category: 'devops' },
  { name: 'GitLab', aliases: ['gitlab'], category: 'devops' },
  { name: 'GitActions', aliases: ['github actions'], category: 'devops' },
  { name: 'Terraform', aliases: ['terraform'], category: 'devops' },
  { name: 'CloudFormation', aliases: ['cloudformation', 'cfn'], category: 'devops' },
  
  // Testing
  { name: 'Jest', aliases: ['jestjs'], category: 'testing' },
  { name: 'Vitest', aliases: ['vitest'], category: 'testing' },
  { name: 'Mocha', aliases: ['mochajs'], category: 'testing' },
  { name: 'Cypress', aliases: ['cypressjs'], category: 'testing' },
  { name: 'Selenium', aliases: ['seleniumwebdriver'], category: 'testing' },
  { name: 'pytest', aliases: ['pytest'], category: 'testing' },
  { name: 'RSpec', aliases: ['rspec'], category: 'testing' },
  
  // API & Protocols
  { name: 'REST', aliases: ['restful'], category: 'api' },
  { name: 'GraphQL', aliases: ['graphql'], category: 'api' },
  { name: 'gRPC', aliases: ['grpc'], category: 'api' },
  { name: 'SOAP', aliases: ['soap'], category: 'api' },
  { name: 'WebSocket', aliases: ['websockets', 'ws'], category: 'api' },
];

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export class TechDetector {
  /**
   * Extract technologies from text
   */
  static extract(text: string): DetectedTech[] {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\W+/);
    const detected = new Map<string, DetectedTech>();

    for (const word of words) {
      if (word.length < 2) continue;

      for (const tech of TECHNOLOGY_REGISTRY) {
        // Check exact match
        if (word === tech.name.toLowerCase()) {
          if (!detected.has(tech.name)) {
            detected.set(tech.name, {
              name: tech.name,
              category: tech.category,
              confidence: 1.0,
              matchType: 'exact'
            });
          }
          continue;
        }

        // Check alias match
        for (const alias of tech.aliases) {
          if (word === alias.toLowerCase()) {
            if (!detected.has(tech.name)) {
              detected.set(tech.name, {
                name: tech.name,
                category: tech.category,
                confidence: 0.95,
                matchType: 'alias'
              });
            }
            break;
          }
        }

        // Check fuzzy match (if word is similar enough)
        if (!detected.has(tech.name)) {
          const similarity = calculateSimilarity(word, tech.name.toLowerCase());
          if (similarity > 0.75 && word.length > 2) {
            detected.set(tech.name, {
              name: tech.name,
              category: tech.category,
              confidence: similarity * 0.8, // Reduce confidence for fuzzy matches
              matchType: 'fuzzy'
            });
          }
        }
      }
    }

    return Array.from(detected.values())
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get all technologies in a specific category
   */
  static getTechsByCategory(category: string): string[] {
    return TECHNOLOGY_REGISTRY
      .filter(t => t.category === category)
      .map(t => t.name);
  }

  /**
   * Get all available categories
   */
  static getCategories(): string[] {
    const categories = new Set(TECHNOLOGY_REGISTRY.map(t => t.category));
    return Array.from(categories);
  }
}
