# EPIC-11: Resume Engine

## Status

**Partial.** `resume-service.ts` implements upload and text extraction, but only for PDF (`ALLOWED_MIME_TYPES = ['application/pdf']`, via `pdf-parse`) — DOCX (mammoth) and Markdown import from the original scope are not implemented. AI extraction into a structured profile is implemented (`resume-context-builder.ts`, `StructuredResume` domain entity, `features/resume-intelligence`). Resume files are stored on local disk, not MinIO (MinIO is provisioned but unused — see README).

## Duration

3-4 days

## Dependencies

EPIC-05 (AI Layer), EPIC-04 (Backend API)

## Objective

Create resume parsing and AI extraction system.

## Tasks

### TASK-11-01: Resume Upload Endpoint
- [ ] Create upload endpoint
- [ ] Validate file types
- [ ] Store files in MinIO

### TASK-11-02: PDF Parsing
- [ ] Implement PDF text extraction
- [ ] Handle multi-page documents
- [ ] Handle tables and formatting

### TASK-11-03: DOCX Parsing
- [ ] Implement DOCX text extraction
- [ ] Handle styles and formatting
- [ ] Handle images (alt text)

### TASK-11-04: Markdown Parsing
- [ ] Implement Markdown parsing
- [ ] Handle structure
- [ ] Handle code blocks

### TASK-11-05: AI Extraction Pipeline
- [ ] Create extraction prompt
- [ ] Call AI provider
- [ ] Parse structured response
- [ ] Validate extracted data

### TASK-11-06: Resume Validation
- [ ] Validate extracted data
- [ ] Handle missing fields
- [ ] Allow manual correction

### TASK-11-07: Resume Storage
- [ ] Store parsed resume
- [ ] Link to user/workspace
- [ ] Version control

## Deliverables

- Resume upload endpoint
- PDF parsing
- DOCX parsing
- Markdown parsing
- AI extraction pipeline
- Resume storage

## Acceptance Criteria

- [ ] PDF files parsed correctly
- [ ] DOCX files parsed correctly
- [ ] Markdown files parsed correctly
- [ ] AI extracts structured data
- [ ] Resumes stored and retrievable
