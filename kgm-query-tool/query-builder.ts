// Query Builder for Knowledge Graph Retrieval
// Constructs semantic + filter queries for MCP memory server

interface QueryFilters {
  layer?: string;
  topics?: string[];
  entityTypes?: string[];
  severity?: 'must' | 'should' | 'may';
}

interface RetrievalQuery {
  semanticQuery: string;
  filters: QueryFilters;
  limit: number;
}

export function buildRetrievalQuery(taskDescription: string, context: any): RetrievalQuery {
  const { layer, topics, keywords } = context;

  // Build semantic query combining task description with detected context
  const semanticParts = [taskDescription];

  if (layer) {
    semanticParts.push(`layer:${layer}`);
  }

  if (topics && topics.length > 0) {
    semanticParts.push(`topics:${topics.join(',')}`);
  }

  if (keywords && keywords.length > 0) {
    semanticParts.push(keywords.slice(0, 5).join(' ')); // Add top 5 keywords
  }

  const semanticQuery = semanticParts.join(' ');

  // Build filters for structured retrieval
  const filters: QueryFilters = {};

  if (layer) {
    filters.layer = layer;
  }

  if (topics && topics.length > 0) {
    filters.topics = topics;
  }

  // Prioritize directives and rules for task guidance
  filters.entityTypes = ['Directive', 'Rule', 'Section'];

  return {
    semanticQuery,
    filters,
    limit: 10 // Top 10 most relevant results
  };
}

// MCP Query Execution
export async function executeRetrievalQuery(_query: RetrievalQuery): Promise<any[]> {
  // Use MCP search_nodes tool with the constructed query
  // This would be called via use_mcp_tool
  // Note: semanticQuery, filters, limit would be used in actual implementation

  // For now, return mock structure
  return [
    {
      entity: 'kg:Directive|.kilocode/rules/security-general-rule.md#input-validation-and-sanitization|d0',
      type: 'Directive',
      content: 'Validate all user inputs on both client and server',
      score: 0.95,
      metadata: {
        severity: 'must',
        topics: ['security'],
        layer: '1-Presentation',
        source: '.kilocode/rules/security-general-rule.md'
      }
    }
  ];
}

// Example usage:
// const context = detectTaskContext("Implement secure user authentication API");
// const query = buildRetrievalQuery("Implement secure user authentication API", context);
// const results = await executeRetrievalQuery(query);