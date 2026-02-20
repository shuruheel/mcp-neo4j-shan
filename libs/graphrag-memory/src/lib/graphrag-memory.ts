

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export interface Source {
  name: string;
  sourceType: 'chat_message' | 'web_page' | 'pdf' | 'email' | 'transcript' | 'document' | 'api_payload';
  title?: string;
  uri?: string;
  collectedAt?: string;
  contentHash?: string;
  metadataJson?: string;
}

export interface EmotionalEvent {
  name: string;
  timestamp: string;
  valence: number;
  arousal: number;
  intensity: number;
  confidence: number;
  label?: string;
  notes?: string;
}

// The KnowledgeGraphMemory interface contains all operations to interact with the knowledge graph
export interface KnowledgeGraphMemory {

  createEntities(entities: Entity[]): Promise<Entity[]>;

  createRelations(relations: Relation[]): Promise<Relation[]>;

  addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]>;

  deleteEntities(entityNames: string[]): Promise<void>;

  deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void>;

  deleteRelations(relations: Relation[]): Promise<void>;

  readGraph(): Promise<KnowledgeGraph>;

  // Very basic search function
  searchNodes(query: string): Promise<KnowledgeGraph>;

  openNodes(names: string[]): Promise<KnowledgeGraph>;

}
