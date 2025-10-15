// Compact Response Formatter
// Returns top-k directives with parent breadcrumbs and source references

interface FormattedDirective {
  directive: string;
  severity: 'must' | 'should' | 'may';
  source: string;
  breadcrumb: string; // e.g., "Security-General-Rule > Input Validation > Sanitization"
  rationale: string; // Why this directive is relevant
}

interface RetrievalResult {
  entity: string;
  type: string;
  content: string;
  score: number;
  metadata: {
    severity?: 'must' | 'should' | 'may';
    topics?: string[];
    layer?: string;
    source?: string;
    whenToApply?: string;
    authoritativeFor?: string[];
  };
}

export function formatRetrievalResponse(results: RetrievalResult[], context: any): FormattedDirective[] {
  return results
    .filter(result => result.type === 'Directive') // Focus on actionable directives
    .slice(0, 5) // Top 5 most relevant
    .map(result => ({
      directive: result.content,
      severity: result.metadata.severity || 'should',
      source: formatSource(result.metadata.source || ''),
      breadcrumb: generateBreadcrumb(result),
      rationale: generateRationale(result, context)
    }));
}

function formatSource(sourcePath: string): string {
  // Convert file path to readable format
  return sourcePath
    .replace('.kilocode/rules/', '')
    .replace('.md', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase()); // Title case
}

function generateBreadcrumb(result: RetrievalResult): string {
  const parts = [];

  // Extract rule name from entity ID
  const entityParts = result.entity.split('|');
  if (entityParts.length >= 2) {
    const fileName = entityParts[1].split('/').pop()?.replace('.md', '') || '';
    parts.push(formatSource(fileName));
  }

  // Add section if available
  if (result.metadata.source && result.metadata.source.includes('#')) {
    const section = result.metadata.source.split('#')[1];
    parts.push(section.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
  }

  return parts.join(' > ');
}

function generateRationale(result: RetrievalResult, context: any): string {
  const reasons = [];

  if (result.metadata.layer && context.layer === result.metadata.layer) {
    reasons.push(`applies to ${result.metadata.layer} layer`);
  }

  if (result.metadata.topics && context.topics) {
    const matchingTopics = result.metadata.topics.filter((topic: string) =>
      context.topics.some((ctxTopic: string) => topic.includes(ctxTopic))
    );
    if (matchingTopics.length > 0) {
      reasons.push(`covers ${matchingTopics.join(', ')} topics`);
    }
  }

  if (result.metadata.authoritativeFor && context.topics) {
    const authorityMatches = result.metadata.authoritativeFor.filter((auth: string) =>
      context.topics.some((topic: string) => auth.includes(topic))
    );
    if (authorityMatches.length > 0) {
      reasons.push(`authoritative for ${authorityMatches.join(', ')}`);
    }
  }

  return reasons.length > 0 ? reasons.join('; ') : 'generally applicable';
}

// Example output format:
// [
//   {
//     directive: "Validate all user inputs on both client and server",
//     severity: "must",
//     source: "Security General Rule",
//     breadcrumb: "Security General Rule > Input Validation And Sanitization",
//     rationale: "applies to 1-Presentation layer; covers security topics; authoritative for security"
//   }
// ]