/**
 * Graph Builder
 * 
 * Converts parsed markdown documents into Neo4j graph structure.
 * Creates Rule, Section, and Directive nodes with relationships.
 */

import { Session } from 'neo4j-driver';
import { ParsedMarkdown, MarkdownSection } from './markdown-parser.js';
import { ExtractedDirective } from './directive-processor.js';

export interface GraphNode {
  type: 'Rule' | 'Section' | 'Directive' | 'Topic' | 'Layer' | 'Technology';
  properties: Record<string, any>;
}

export interface GraphRelationship {
  type: string;
  from: string;
  to: string;
  properties?: Record<string, any>;
}

export interface GraphStructure {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface GraphBuildResult {
  structure: GraphStructure;
  stats: {
    rulesCreated: number;
    sectionsCreated: number;
    directivesCreated: number;
    relationshipsCreated: number;
  };
  warnings: string[];
  errors: string[];
}

/**
 * Graph Builder class that converts parsed documents to Neo4j graph
 */
export class GraphBuilder {
  /**
   * Build graph structure from parsed markdown and directives
   */
  buildGraph(
    parsedMarkdown: ParsedMarkdown,
    directives: ExtractedDirective[],
    documentPath: string,
    workspace: string
  ): GraphBuildResult {
    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Create Rule node (root document node)
    const ruleId = this.generateRuleId(documentPath);
    const ruleName = parsedMarkdown.metadata.title || 
                     this.extractTitleFromPath(documentPath);

    nodes.push({
      type: 'Rule',
      properties: {
        id: ruleId,
        name: ruleName,
        workspace: workspace,
        layer: parsedMarkdown.metadata.layer || '*',
        authoritativeFor: parsedMarkdown.metadata.authoritativeFor || [],
        topics: parsedMarkdown.metadata.topics || [],
        severity: parsedMarkdown.metadata.severity || 'SHOULD',
        whenToApply: parsedMarkdown.metadata.whenToApply || [],
        sourcePath: documentPath,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    // Process sections recursively
    const stats = {
      rulesCreated: 1,
      sectionsCreated: 0,
      directivesCreated: 0,
      relationshipsCreated: 0
    };

    for (const section of parsedMarkdown.sections) {
      this.processSectionRecursively(
        section,
        ruleId,
        null,
        nodes,
        relationships,
        stats
      );
    }

    // Process directives
    for (const directive of directives) {
      const directiveNode = this.createDirectiveNode(directive, ruleId, documentPath, workspace);
      nodes.push(directiveNode);
      stats.directivesCreated++;

      // Create relationship from directive to its section
      const sectionId = this.findSectionIdForDirective(directive, nodes);
      if (sectionId) {
        relationships.push({
          type: 'HAS_DIRECTIVE',
          from: sectionId,
          to: directive.id
        });
        stats.relationshipsCreated++;
      } else {
        // If no section found, link directly to rule
        relationships.push({
          type: 'HAS_DIRECTIVE',
          from: ruleId,
          to: directive.id
        });
        stats.relationshipsCreated++;
      }

      // Create relationships to topics, layers, and technologies
      this.createMetadataRelationships(
        directive,
        nodes,
        relationships,
        stats
      );
    }

    return {
      structure: { nodes, relationships },
      stats,
      warnings,
      errors
    };
  }

  /**
   * Process a section and its subsections recursively
   */
  private processSectionRecursively(
    section: MarkdownSection,
    ruleId: string,
    parentSectionId: string | null,
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    stats: { sectionsCreated: number; relationshipsCreated: number }
  ): void {
    const sectionNode: GraphNode = {
      type: 'Section',
      properties: {
        id: section.id,
        ruleId: ruleId,
        workspace: nodes.find(n => n.properties.id === ruleId)?.properties.workspace || 'default',
        name: section.title,
        content: section.content,
        level: section.level,
        lineNumber: section.lineNumber
      }
    };

    nodes.push(sectionNode);
    stats.sectionsCreated++;

    // Create relationship from parent (rule or section) to this section
    if (parentSectionId) {
      relationships.push({
        type: 'CONTAINS',
        from: parentSectionId,
        to: section.id
      });
    } else {
      relationships.push({
        type: 'CONTAINS',
        from: ruleId,
        to: section.id
      });
    }
    stats.relationshipsCreated++;

    // Process subsections recursively
    for (const subsection of section.subsections) {
      this.processSectionRecursively(
        subsection,
        ruleId,
        section.id,
        nodes,
        relationships,
        stats
      );
    }
  }

  /**
   * Create a directive node from extracted directive
   */
  private createDirectiveNode(
    directive: ExtractedDirective,
    _ruleId: string,
    documentPath: string,
    workspace: string
  ): GraphNode {
    return {
      type: 'Directive',
      properties: {
        id: directive.id,
        workspace: workspace,
        content: directive.content,
        severity: directive.severity,
        topics: directive.topics,
        layers: directive.layers,
        technologies: directive.technologies,
        section: directive.section,
        sourcePath: documentPath,
        lineNumber: directive.lineNumber,
        createdAt: new Date().toISOString()
      }
    };
  }

  /**
   * Create relationships for topics, layers, and technologies
   */
  private createMetadataRelationships(
    directive: ExtractedDirective,
    nodes: GraphNode[],
    relationships: GraphRelationship[],
    stats: { relationshipsCreated: number }
  ): void {
    // Create Topic nodes and relationships
    for (const topic of directive.topics) {
      const topicId = `topic-${topic}`;
      
      // Check if Topic node already exists
      if (!nodes.find(n => n.type === 'Topic' && n.properties.id === topicId)) {
        nodes.push({
          type: 'Topic',
          properties: {
            id: topicId,
            name: topic
          }
        });
      }

      relationships.push({
        type: 'APPLIES_TO_TOPIC',
        from: directive.id,
        to: topicId
      });
      stats.relationshipsCreated++;
    }

    // Create Layer nodes and relationships
    for (const layer of directive.layers) {
      const layerId = `layer-${layer}`;
      
      if (!nodes.find(n => n.type === 'Layer' && n.properties.id === layerId)) {
        nodes.push({
          type: 'Layer',
          properties: {
            id: layerId,
            name: layer
          }
        });
      }

      relationships.push({
        type: 'APPLIES_TO_LAYER',
        from: directive.id,
        to: layerId
      });
      stats.relationshipsCreated++;
    }

    // Create Technology nodes and relationships
    for (const tech of directive.technologies) {
      const techId = `tech-${tech}`;
      
      if (!nodes.find(n => n.type === 'Technology' && n.properties.id === techId)) {
        nodes.push({
          type: 'Technology',
          properties: {
            id: techId,
            name: tech
          }
        });
      }

      relationships.push({
        type: 'APPLIES_TO_TECHNOLOGY',
        from: directive.id,
        to: techId
      });
      stats.relationshipsCreated++;
    }
  }

  /**
   * Find the section ID for a directive based on section name
   */
  private findSectionIdForDirective(
    directive: ExtractedDirective,
    nodes: GraphNode[]
  ): string | null {
    // Find section that matches the directive's section path
    const sectionNode = nodes.find(
      n => n.type === 'Section' && 
           (n.properties.name === directive.section ||
            directive.section.includes(n.properties.name))
    );

    return sectionNode?.properties.id || null;
  }

  /**
   * Generate a unique rule ID from document path
   */
  private generateRuleId(documentPath: string): string {
    const hash = this.simpleHash(documentPath);
    const filename = documentPath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'rule';
    return `rule-${filename}-${hash}`;
  }

  /**
   * Extract title from file path
   */
  private extractTitleFromPath(path: string): string {
    const filename = path.split('/').pop() || 'Unknown';
    return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Validate graph structure
   */
  validateGraph(structure: GraphStructure): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for required nodes
    const hasRule = structure.nodes.some(n => n.type === 'Rule');
    if (!hasRule) {
      errors.push('Graph must contain at least one Rule node');
    }

    // Validate node IDs are unique
    const nodeIds = structure.nodes.map(n => n.properties.id);
    const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate node IDs found: ${duplicateIds.join(', ')}`);
    }

    // Validate relationships reference existing nodes
    for (const rel of structure.relationships) {
      const fromExists = structure.nodes.some(n => n.properties.id === rel.from);
      const toExists = structure.nodes.some(n => n.properties.id === rel.to);

      if (!fromExists) {
        errors.push(`Relationship references non-existent 'from' node: ${rel.from}`);
      }
      if (!toExists) {
        errors.push(`Relationship references non-existent 'to' node: ${rel.to}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Persist graph structure to Neo4j
   */
  async persistToNeo4j(
    session: Session,
    structure: GraphStructure
  ): Promise<{ nodesCreated: number; relationshipsCreated: number }> {
    let nodesCreated = 0;
    let relationshipsCreated = 0;

    // Create nodes in batches by type
    const nodesByType = this.groupNodesByType(structure.nodes);

    for (const nodes of Object.values(nodesByType)) {
      for (const node of nodes) {
        await this.createNode(session, node);
        nodesCreated++;
      }
    }

    // Create relationships in batches
    for (const rel of structure.relationships) {
      await this.createRelationship(session, rel);
      relationshipsCreated++;
    }

    return { nodesCreated, relationshipsCreated };
  }

  /**
   * Group nodes by type for batch processing
   */
  private groupNodesByType(nodes: GraphNode[]): Record<string, GraphNode[]> {
    return nodes.reduce((acc, node) => {
      if (!acc[node.type]) {
        acc[node.type] = [];
      }
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, GraphNode[]>);
  }

  /**
   * Create a single node in Neo4j
   */
  private async createNode(session: Session, node: GraphNode): Promise<void> {
    const props = Object.keys(node.properties)
      .map((key) => `${key}: $${key}`)
      .join(', ');

    const query = `
      MERGE (n:${node.type} {id: $id})
      SET n = {${props}}
      RETURN n
    `;

    await session.run(query, node.properties);
  }

  /**
   * Create a single relationship in Neo4j
   */
  private async createRelationship(session: Session, rel: GraphRelationship): Promise<void> {
    const query = `
      MATCH (from {id: $fromId})
      MATCH (to {id: $toId})
      MERGE (from)-[r:${rel.type}]->(to)
      RETURN r
    `;

    await session.run(query, {
      fromId: rel.from,
      toId: rel.to,
      ...rel.properties
    });
  }
}
