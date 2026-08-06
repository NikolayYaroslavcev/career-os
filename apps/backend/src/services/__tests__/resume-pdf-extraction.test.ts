import { describe, it, expect } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { InMemoryResumeRepository } from '../../testing/in-memory-repositories.js';
import { ResumeService } from '../resume-service.js';

// Regression test for a bug where pdf-parse@1.1.4 (bundling a pdf.js build
// from ~2017) failed to extract text from any PDF produced by a modern
// writer — including the project's own apps/e2e/fixtures/sample-resume.pdf
// — throwing "Unknown compression method in flate stream" or "Invalid PDF
// structure". Upgrading to pdf-parse@2.x (current pdf.js) fixed it.
async function buildPdfBuffer(lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 720;
  for (const line of lines) {
    page.drawText(line, { x: 72, y, size: 11, font });
    y -= 24;
  }
  return Buffer.from(await doc.save());
}

describe('ResumeService PDF text extraction', () => {
  it('extracts text from a PDF produced by a modern writer (pdf-lib)', async () => {
    const repository = new InMemoryResumeRepository();
    const service = new ResumeService(repository);
    const fileBuffer = await buildPdfBuffer([
      'QA Tester',
      'Senior Backend Engineer',
      'Skills: TypeScript, Node.js, PostgreSQL',
    ]);

    const result = await (service as unknown as {
      extractPdfText(buffer: Buffer): Promise<string>;
    }).extractPdfText(fileBuffer);

    expect(result).toContain('QA Tester');
    expect(result).toContain('Senior Backend Engineer');
    expect(result).toContain('TypeScript, Node.js, PostgreSQL');
  });
});
