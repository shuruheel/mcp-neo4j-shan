# Knowledge Graph Schema (SQLite)

## Node Types (15)

All nodes are stored in a single `nodes` table. The `node_type` column determines the type.

| Type | Description | Key Fields |
|---|---|---|
| Entity | People, orgs, products, objects | description, biography, subType |
| Event | Time-bound occurrences | startDate, endDate, participants, outcome, subType (Decision, Outcome) |
| Concept | Abstract ideas, theories | definition, domain, examples |
| Attribute | Properties of entities | value, unit, valueType |
| Proposition | Facts, claims, rules | statement, status, confidence, subType (Prediction) |
| Emotion | Emotional states | intensity, valence, category |
| Agent | Cognitive entities | agentType, capabilities, beliefs |
| ScientificInsight | Research findings | hypothesis, evidence, methodology |
| Law | Established principles | statement, conditions, exceptions |
| Location | Places (physical/virtual) | locationType, coordinates |
| Thought | Analyses, reflections | thoughtContent, stance (support/oppose/uncertain/mixed) |
| ReasoningChain | Structured logical reasoning | conclusion, confidenceScore, methodology |
| ReasoningStep | Steps in a reasoning chain | content, stepType, stepNumber |
| Source | Provenance tracking | sourceType, uri, collectedAt, contentHash |
| EmotionalEvent | Episodic emotional episodes | timestamp, valence, arousal, intensity |

## Tables

### nodes
```sql
name        TEXT PRIMARY KEY
node_type   TEXT NOT NULL
sub_type    TEXT
status      TEXT NOT NULL DEFAULT 'active'   -- active | candidate | archived
description TEXT
statement   TEXT
content     TEXT
confidence  REAL
properties  TEXT NOT NULL DEFAULT '{}'       -- JSON blob for all other fields
search_text TEXT                             -- auto-populated for FTS
created_at  TEXT
updated_at  TEXT
```

### edges
```sql
id            INTEGER PRIMARY KEY AUTOINCREMENT
from_node     TEXT NOT NULL REFERENCES nodes(name)
to_node       TEXT NOT NULL REFERENCES nodes(name)
relation_type TEXT NOT NULL
confidence    REAL
weight        REAL DEFAULT 0.5
context       TEXT
properties    TEXT NOT NULL DEFAULT '{}'
created_at    TEXT
UNIQUE(from_node, to_node, relation_type)
```

### aliases
```sql
alias          TEXT NOT NULL
canonical_name TEXT NOT NULL REFERENCES nodes(name)
match_score    REAL DEFAULT 1.0
PRIMARY KEY (alias, canonical_name)
```

### observations
```sql
id         INTEGER PRIMARY KEY AUTOINCREMENT
node_name  TEXT NOT NULL REFERENCES nodes(name)
content    TEXT NOT NULL
created_at TEXT
```

### nodes_fts (FTS5 virtual table)
Full-text search over `name` and `search_text`, kept in sync via triggers.

## Relationship Types

### Core
IS_A, INSTANCE_OF, HAS_PART, PART_OF, LOCATED_IN, CONTAINS, OCCURRED_AT

### Temporal
BEFORE, AFTER, DURING, NEXT, PREVIOUS, HAS_TIME, OCCURS_ON

### Causal
CAUSES, CAUSED_BY, INFLUENCES, INFLUENCED_BY, TRIGGERED_BY

### Provenance
DERIVED_FROM, CITES, SOURCE

### Reasoning
HAS_STEP, BASED_ON, RESULT_OF, EVALUATED_BY

### Social/Relational
KNOWS, MEMBER_OF, MENTORS, ADMIRES, OPPOSES, LOYAL_TO

### Cognitive
BELIEVES, SUPPORTS, CONTRADICTS, FEELS, EXPRESSES_EMOTION, VALUES

### New
EXPERIENCED, ABOUT, USES
