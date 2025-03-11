"""Utility functions for knowledge graph processing."""

import re
import logging
import numpy as np
from datetime import datetime
import json
import spacy
from rapidfuzz import fuzz

# Global dictionary to store entity embeddings
entity_embeddings = {}

# Add caching for frequently accessed entities to reduce redundant similarity calculations
entity_match_cache = {}

# Initialize spaCy with a more comprehensive English model
try:
    nlp = spacy.load("en_core_web_lg")
except Exception as e:
    logging.error(f"Error loading spaCy model: {str(e)}")
    nlp = None

def get_entity_embedding(entity_name):
    """Get the embedding for an entity using spaCy with error handling"""
    if nlp is None:
        return np.zeros(300)  # Default dimension if spaCy not loaded
        
    if entity_name not in entity_embeddings:
        try:
            doc = nlp(entity_name)
            if doc.vector_norm == 0:
                logging.warning(f"No embedding found for entity: {entity_name}")
                # Return a zero vector of correct dimension
                return np.zeros(nlp.vocab.vectors_length)
            entity_embeddings[entity_name] = doc.vector
        except Exception as e:
            logging.error(f"Error generating embedding for {entity_name}: {e}")
            # Return a zero vector of correct dimension
            return np.zeros(nlp.vocab.vectors_length)
    return entity_embeddings[entity_name]

def find_similar_entity(entity_name, existing_entities, threshold=0.85):
    """Find a similar entity using fuzzy string matching and embeddings with caching"""
    # Check cache first
    cache_key = (entity_name, frozenset(existing_entities))
    if cache_key in entity_match_cache:
        return entity_match_cache[cache_key]
    
    entity_embedding = get_entity_embedding(entity_name)
    
    best_match = None
    best_score = 0
    
    for existing_entity in existing_entities:
        # Fuzzy string matching with rapidfuzz (faster than fuzzywuzzy)
        string_similarity = fuzz.ratio(entity_name.lower(), existing_entity.lower()) / 100
        
        # Embedding similarity
        existing_embedding = get_entity_embedding(existing_entity)
        embedding_similarity = np.dot(entity_embedding, existing_embedding) / (np.linalg.norm(entity_embedding) * np.linalg.norm(existing_embedding))
        
        # Combine similarities
        combined_score = (string_similarity + embedding_similarity) / 2
        
        if combined_score > best_score and combined_score >= threshold:
            best_match = existing_entity
            best_score = combined_score
    
    # Cache the result before returning
    entity_match_cache[cache_key] = best_match
    return best_match

def parse_date(date_string):
    """
    Parse different date formats and return a standardized representation.
    """
    # Check if this is an ISO date format (YYYY-MM-DD)
    iso_date_pattern = r'^\d{4}-\d{2}-\d{2}$'
    if re.match(iso_date_pattern, date_string):
        try:
            date_obj = datetime.strptime(date_string, "%Y-%m-%d")
            return {
                'type': 'specific',
                'date': date_obj.strftime("%Y-%m-%d")
            }
        except ValueError:
            pass  # If parsing fails, continue to other format checks
    
    # Check for year range (YYYY-YYYY)
    year_range_pattern = r'^\d{4}-\d{4}$'
    if re.match(year_range_pattern, date_string):
        start, end = date_string.split('-')
        return {
            'type': 'range',
            'start': int(start.strip()),
            'end': int(end.strip())
        }
    
    # Check for single year
    year_pattern = r'^\d{4}$'
    if re.match(year_pattern, date_string):
        return {
            'type': 'year',
            'year': int(date_string)
        }
    
    # Return original text if no patterns match
    return {
        'type': 'text',
        'description': date_string
    }

def standardize_entity(entity):
    """Standardize entity names for consistency"""
    if not entity:
        return ""
    
    # List of common lowercase words
    lowercase_words = set([
        'a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from',
        'by', 'with', 'in', 'of', 'as', 'if', 'then', 'than', 'so', 'yet', 'until'
    ])
    
    # Split the entity name into words
    words = entity.split()
    standardized = []
    
    for i, word in enumerate(words):
        # Always capitalize first and last word, and words that aren't in the lowercase list
        if i == 0 or i == len(words) - 1 or word.lower() not in lowercase_words:
            standardized.append(word.capitalize())
        else:
            standardized.append(word.lower())
    
    return ' '.join(standardized)

def list_to_string(value, separator="; ", default=None):
    """Convert a value to string, joining with separator if it's a list
    
    Args:
        value: Value to convert (list or scalar)
        separator: Separator to use for joining list items
        default: Default value if None
        
    Returns:
        str: Formatted string
    """
    if value is None and default is not None:
        value = default
        
    if isinstance(value, list):
        return separator.join(str(item) for item in value)
    return str(value)

def extract_safely(data, field, entity_name, expected_type=None, default=None):
    """Safely extract a field from data with error handling
    
    Args:
        data: Dict containing the field
        field: Field name to extract
        entity_name: Entity name for logging
        expected_type: Optional type check (list, dict, etc.)
        default: Default value if extraction fails
        
    Returns:
        The extracted value or default
    """
    result = default
    try:
        if field in data:
            value = data[field]
            if expected_type is None or isinstance(value, expected_type):
                result = value
    except Exception as e:
        logging.warning(f"Error processing {field} for {entity_name}: {str(e)}")
    return result

def cleanup_temp_files():
    """Remove temporary checkpoint files after successful processing"""
    import glob
    import os
    
    checkpoint_files = glob.glob("checkpoint_*.json")
    for file in checkpoint_files:
        try:
            os.remove(file)
            logging.info(f"Removed temporary file: {file}")
        except Exception as e:
            logging.warning(f"Failed to remove {file}: {str(e)}") 