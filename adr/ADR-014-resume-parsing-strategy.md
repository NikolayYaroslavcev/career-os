# ADR-014: Resume Parsing Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs to:

- Import user resumes
- Extract structured data
- Match against job requirements
- Generate tailored resumes

Resume formats to support:

- PDF (most common)
- DOCX (common in enterprise)
- Markdown (developer-friendly)

## Decision

### Use Existing Parsers

For document parsing, use established libraries:

- **PDF**: `pdf-parse` or `unpdf`
- **DOCX**: `docx-parser` or `mammoth`
- **Markdown**: Native parsing (simple)

### AI Extraction

After raw text extraction, use AI to:

- Extract structured career profile
- Identify skills, experience, education
- Normalize data into ResumeData format

## Consequences

### Positive

- Reliable document parsing
- AI handles complex extraction
- Structured output guaranteed
- Easy to add new formats

### Negative

- AI extraction adds latency
- AI costs per resume parse
- Parsing errors possible

### Mitigations

- Cache parsed results
- Validate extracted data
- Allow manual correction

## Pipeline

```
1. User uploads file (PDF/DOCX/MD)
    ↓
2. File type detected
    ↓
3. Raw text extracted (pdf-parse / mammoth / native)
    ↓
4. AI extracts structured data
    ↓
5. Data validated against schema
    ↓
6. Resume entity created
    ↓
7. Available for matching
```

## Implementation

### PDF Parsing

```typescript
import pdf from 'pdf-parse';

async function parsePDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  return data.text;
}
```

### DOCX Parsing

```typescript
import mammoth from 'mammoth';

async function parseDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
```

### Markdown Parsing

```typescript
function parseMarkdown(content: string): string {
  // Markdown is already text, return as-is
  // Or parse structure if needed
  return content;
}
```

### AI Extraction

```typescript
async function extractResumeData(
  rawText: string,
  aiProvider: AIProvider,
): Promise<ResumeData> {
  const prompt = `
    Extract structured career data from this resume:
    
    ${rawText}
    
    Return JSON with:
    - summary: string
    - experience: Array<{company, role, description, startDate, endDate, skills}>
    - education: Array<{institution, degree, field, startDate, endDate}>
    - skills: Array<{name, level?}>
    - projects: Array<{name, description, technologies}>
  `;
  
  const result = await aiProvider.generate(prompt);
  return JSON.parse(result);
}
```

## ResumeData Schema

```typescript
interface ResumeData {
  summary: string;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
  certifications?: Certification[];
  languages?: Language[];
}

interface Experience {
  company: string;
  role: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  skills: string[];
  isCurrent: boolean;
}

interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  gpa?: number;
}

interface Skill {
  name: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
}
```

## AI Prompt Template

```
You are a resume parsing expert. Extract structured data from the following resume text.

Resume Text:
{raw_text}

Extract the following fields as JSON:
- summary: Professional summary or objective
- experience: Work experience with company, role, description, dates, skills used
- education: Educational background
- skills: Technical and soft skills with proficiency levels
- projects: Notable projects

Return only valid JSON. Do not include markdown formatting.
```

## Configuration

```bash
# .env
RESUME_AI_EXTRACTION=true
RESUME_CACHE_ENABLED=true
RESUME_CACHE_TTL=86400  # 24 hours
```

## Alternatives Considered

### Pure AI Extraction

Use AI for everything, no parsers.

**Rejected because:**
- Slower
- More expensive
- Less reliable for binary formats

### Template-based Extraction

Regex patterns for common formats.

**Rejected because:**
- Fragile
- Hard to maintain
- Doesn't handle variation

### Third-party Parsing Service

Use external resume parsing API.

**Rejected because:**
- Vendor lock-in
- Additional cost
- Less control

## References

- [pdf-parse GitHub](https://github.com/nicbarker/pdf-parse)
- [mammoth.js](https://github.com/mwilliamson/mammoth.js)
- [Resume Parsing Best Practices](https:// engineering.resumebuilder.com/)
