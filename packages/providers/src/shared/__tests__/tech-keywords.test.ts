import { describe, it, expect } from 'vitest';
import { extractTechnologiesFromText, TECH_KEYWORDS } from '../tech-keywords.js';

describe('TECH_KEYWORDS', () => {
  it('contains a comprehensive list of technologies', () => {
    expect(TECH_KEYWORDS.length).toBeGreaterThan(50);
    expect(TECH_KEYWORDS).toContain('javascript');
    expect(TECH_KEYWORDS).toContain('python');
    expect(TECH_KEYWORDS).toContain('react');
    expect(TECH_KEYWORDS).toContain('docker');
    expect(TECH_KEYWORDS).toContain('postgresql');
  });
});

describe('extractTechnologiesFromText', () => {
  it('extracts technologies from text', () => {
    const text = 'We are looking for a React developer with TypeScript and Node.js experience';
    const result = extractTechnologiesFromText(text);
    expect(result).toContain('react');
    expect(result).toContain('typescript');
    expect(result).toContain('node.js');
  });

  it('returns empty array for text with no technologies', () => {
    const text = 'We are looking for a motivated person to join our team';
    const result = extractTechnologiesFromText(text);
    expect(result).toEqual([]);
  });

  it('returns unique technologies', () => {
    const text = 'React and react and REACT developer needed';
    const result = extractTechnologiesFromText(text);
    expect(result.filter((t) => t === 'react')).toHaveLength(1);
  });

  it('normalizes to lowercase', () => {
    const text = 'TypeScript and PYTHON and Docker experience required';
    const result = extractTechnologiesFromText(text);
    expect(result).toContain('typescript');
    expect(result).toContain('python');
    expect(result).toContain('docker');
  });

  it('extracts from title and description combined', () => {
    const title = 'Senior React Developer';
    const description = 'Experience with PostgreSQL and Redis required';
    const result = extractTechnologiesFromText(`${title} ${description}`);
    expect(result).toContain('react');
    expect(result).toContain('postgresql');
    expect(result).toContain('redis');
  });

  it('handles Russian text with English tech names', () => {
    const text = 'Ищем разработчика с опытом работы с React и PostgreSQL';
    const result = extractTechnologiesFromText(text);
    expect(result).toContain('react');
    expect(result).toContain('postgresql');
  });

  it('handles mixed case and special characters', () => {
    const text = 'C++ and C# developer, also knows Node.js, Vue.js, and Next.js';
    const result = extractTechnologiesFromText(text);
    expect(result).toContain('c++');
    expect(result).toContain('c#');
    expect(result).toContain('node.js');
    expect(result).toContain('vue.js');
    expect(result).toContain('next.js');
  });

  it('extracts cloud technologies', () => {
    const text = 'Experience with AWS, Azure, and GCP required. Docker and Kubernetes a plus.';
    const result = extractTechnologiesFromText(text);
    expect(result).toContain('aws');
    expect(result).toContain('azure');
    expect(result).toContain('gcp');
    expect(result).toContain('docker');
    expect(result).toContain('kubernetes');
  });

  it('extracts database technologies', () => {
    const text = 'Must know PostgreSQL, MySQL, MongoDB, and Redis';
    const result = extractTechnologiesFromText(text);
    expect(result).toContain('postgresql');
    expect(result).toContain('mysql');
    expect(result).toContain('mongodb');
    expect(result).toContain('redis');
  });

  it('handles empty string', () => {
    const result = extractTechnologiesFromText('');
    expect(result).toEqual([]);
  });

  it('handles null/undefined text gracefully', () => {
    expect(extractTechnologiesFromText(null as unknown as string)).toEqual([]);
    expect(extractTechnologiesFromText(undefined as unknown as string)).toEqual([]);
  });
});

describe('False positive prevention', () => {
  describe('AI false positives', () => {
    it('does not extract AI from "email"', () => {
      expect(extractTechnologiesFromText('Send me an email')).not.toContain('ai');
    });

    it('does not extract AI from "maintain"', () => {
      expect(extractTechnologiesFromText('Maintain the codebase')).not.toContain('ai');
    });

    it('does not extract AI from "email address"', () => {
      expect(extractTechnologiesFromText('Your email address is required')).not.toContain('ai');
    });

    it('does not extract AI from "details"', () => {
      expect(extractTechnologiesFromText('See details below')).not.toContain('ai');
    });

    it('extracts AI from "AI engineer"', () => {
      expect(extractTechnologiesFromText('AI engineer position')).toContain('ai');
    });

    it('extracts AI from "AI/ML"', () => {
      expect(extractTechnologiesFromText('AI/ML specialist')).toContain('ai');
    });

    it('extracts AI from "artificial intelligence"', () => {
      expect(extractTechnologiesFromText('Artificial Intelligence background')).toContain('ai');
    });

    it('extracts AI from "GenAI"', () => {
      expect(extractTechnologiesFromText('GenAI experience required')).toContain('ai');
    });

    it('extracts AI from "LLM"', () => {
      expect(extractTechnologiesFromText('Working with LLMs')).toContain('ai');
    });
  });

  describe('Go false positives', () => {
    it('does not extract Go from "google"', () => {
      expect(extractTechnologiesFromText('Work at Google')).not.toContain('go');
    });

    it('does not extract Go from "good"', () => {
      expect(extractTechnologiesFromText('Good communication skills')).not.toContain('go');
    });

    it('does not extract Go from "going"', () => {
      expect(extractTechnologiesFromText('Going forward with the project')).not.toContain('go');
    });

    it('does not extract Go from "dialogue"', () => {
      expect(extractTechnologiesFromText('Open dialogue')).not.toContain('go');
    });

    it('extracts Go from "Go developer"', () => {
      expect(extractTechnologiesFromText('Go developer position')).toContain('go');
    });

    it('extracts Go from "Golang"', () => {
      expect(extractTechnologiesFromText('Golang microservices')).toContain('go');
    });

    it('extracts Go from "Go backend"', () => {
      expect(extractTechnologiesFromText('Go backend services')).toContain('go');
    });
  });

  describe('ML false positives', () => {
    it('does not extract ML from "html"', () => {
      expect(extractTechnologiesFromText('HTML and CSS')).not.toContain('ml');
    });

    it('does not extract ML from "xml"', () => {
      expect(extractTechnologiesFromText('XML configuration')).not.toContain('ml');
    });

    it('does not extract ML from "meal"', () => {
      expect(extractTechnologiesFromText('Team meal')).not.toContain('ml');
    });

    it('does not extract ML from "email"', () => {
      expect(extractTechnologiesFromText('Send an email')).not.toContain('ml');
    });

    it('extracts ML from "ML engineer"', () => {
      expect(extractTechnologiesFromText('ML engineer role')).toContain('ml');
    });

    it('extracts ML from "machine learning"', () => {
      expect(extractTechnologiesFromText('Machine Learning experience')).toContain('ml');
    });

    it('extracts ML from "AI/ML"', () => {
      expect(extractTechnologiesFromText('AI/ML team')).toContain('ml');
    });
  });

  describe('REST false positives', () => {
    it('does not extract REST from "restaurant"', () => {
      expect(extractTechnologiesFromText('Near the restaurant')).not.toContain('rest');
    });

    it('does not extract REST from "result"', () => {
      expect(extractTechnologiesFromText('The result is positive')).not.toContain('rest');
    });

    it('does not extract REST from "test"', () => {
      expect(extractTechnologiesFromText('Run the test')).not.toContain('rest');
    });

    it('extracts REST from "REST API"', () => {
      expect(extractTechnologiesFromText('REST API design')).toContain('rest');
    });

    it('extracts REST from "RESTful"', () => {
      expect(extractTechnologiesFromText('RESTful services')).toContain('rest');
    });
  });

  describe('Git false positives', () => {
    it('does not extract Git from "digit"', () => {
      expect(extractTechnologiesFromText('Single digit number')).not.toContain('git');
    });

    it('does not extract Git from "origin"', () => {
      expect(extractTechnologiesFromText('The origin story')).not.toContain('git');
    });

    it('does not extract Git from "target"', () => {
      expect(extractTechnologiesFromText('Target audience')).not.toContain('git');
    });

    it('extracts Git from "Git experience"', () => {
      expect(extractTechnologiesFromText('Git experience required')).toContain('git');
    });

    it('extracts GitLab as separate technology', () => {
      expect(extractTechnologiesFromText('GitLab CI/CD')).toContain('gitlab');
    });
  });

  describe('SQL false positives', () => {
    it('does not extract SQL from "sequel"', () => {
      expect(extractTechnologiesFromText('The sequel to the movie')).not.toContain('sql');
    });

    it('does not extract SQL from "squash"', () => {
      expect(extractTechnologiesFromText('Squash commits')).not.toContain('sql');
    });

    it('extracts SQL from "SQL experience"', () => {
      expect(extractTechnologiesFromText('SQL experience required')).toContain('sql');
    });

    it('extracts PostgreSQL as separate technology', () => {
      expect(extractTechnologiesFromText('PostgreSQL database')).toContain('postgresql');
    });
  });

  describe('Word boundary matching', () => {
    it('does not extract React from "reaction"', () => {
      expect(extractTechnologiesFromText('Positive reaction')).not.toContain('react');
    });

    it('does not extract Java from "javascript" (as separate)', () => {
      const result = extractTechnologiesFromText('javascript');
      expect(result).toContain('javascript');
      expect(result.filter((t) => t === 'java')).toHaveLength(0);
    });

    it('extracts React from "React developer"', () => {
      expect(extractTechnologiesFromText('React developer')).toContain('react');
    });

    it('does not extract Node from "node_modules"', () => {
      expect(extractTechnologiesFromText('Check node_modules')).not.toContain('node');
    });
  });

  describe('Special technologies', () => {
    it('extracts C++ correctly', () => {
      expect(extractTechnologiesFromText('C++ developer')).toContain('c++');
    });

    it('extracts C# correctly', () => {
      expect(extractTechnologiesFromText('C# developer')).toContain('c#');
    });

    it('extracts React Native correctly', () => {
      expect(extractTechnologiesFromText('React Native developer')).toContain('react native');
    });

    it('extracts Spring Boot correctly', () => {
      expect(extractTechnologiesFromText('Spring Boot application')).toContain('spring boot');
    });

    it('extracts GitHub Actions correctly', () => {
      expect(extractTechnologiesFromText('GitHub Actions workflow')).toContain('github actions');
    });

    it('extracts CI/CD correctly', () => {
      expect(extractTechnologiesFromText('CI/CD pipeline')).toContain('ci/cd');
    });

    it('extracts K8s correctly', () => {
      expect(extractTechnologiesFromText('K8s deployment')).toContain('k8s');
    });
  });

  describe('Real vacancy text scenarios', () => {
    it('handles typical job posting', () => {
      const text = `
        Senior Full Stack Developer

        We are looking for a Senior Full Stack Developer with experience in:
        - React, TypeScript, Node.js
        - PostgreSQL, Redis
        - AWS, Docker, Kubernetes
        - Git, CI/CD

        Nice to have:
        - GraphQL
        - Python
      `;
      const result = extractTechnologiesFromText(text);
      expect(result).toContain('react');
      expect(result).toContain('typescript');
      expect(result).toContain('node.js');
      expect(result).toContain('postgresql');
      expect(result).toContain('redis');
      expect(result).toContain('aws');
      expect(result).toContain('docker');
      expect(result).toContain('kubernetes');
      expect(result).toContain('git');
      expect(result).toContain('ci/cd');
      expect(result).toContain('graphql');
      expect(result).toContain('python');
    });

    it('handles AI/ML job posting without false positives', () => {
      const text = `
        AI/ML Engineer

        Requirements:
        - Strong background in Machine Learning
        - Experience with PyTorch or TensorFlow
        - Python programming
        - Email communication skills

        Nice to have:
        - Deep Learning experience
        - NLP knowledge
      `;
      const result = extractTechnologiesFromText(text);
      expect(result).toContain('ai');
      expect(result).toContain('ml');
      expect(result).toContain('machine learning');
      expect(result).toContain('pytorch');
      expect(result).toContain('tensorflow');
      expect(result).toContain('python');
      expect(result).not.toContain('email');
    });

    it('handles Go developer posting without false positives', () => {
      const text = `
        Go Backend Developer

        We are building microservices in Go/Golang.
        Good understanding of distributed systems.
        Experience with Google Cloud Platform is a plus.

        Requirements:
        - Go programming language
        - Docker, Kubernetes
        - PostgreSQL
      `;
      const result = extractTechnologiesFromText(text);
      expect(result).toContain('go');
      expect(result).toContain('golang');
      expect(result).toContain('docker');
      expect(result).toContain('kubernetes');
      expect(result).toContain('postgresql');
      expect(result).not.toContain('google');
    });
  });
});
