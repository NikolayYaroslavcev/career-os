import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Resume, createResumeId, createUserId, ResumeFormat, ResumeVersionStatus } from '@careeros/career';
import type { ResumeRepository } from '@careeros/career';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'resumes');
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf'] as const;

export class ResumeUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeUploadError';
  }
}

export class ResumeNotFoundError extends Error {
  constructor(id: string) {
    super(`Resume '${id}' not found`);
    this.name = 'ResumeNotFoundError';
  }
}

export class ResumeNotAuthorizedError extends Error {
  constructor(id: string) {
    super(`Resume '${id}' does not belong to this user`);
    this.name = 'ResumeNotAuthorizedError';
  }
}

export interface ResumeUploadResult {
  readonly resume: Resume;
  readonly extractedText: string;
}

export class ResumeService {
  constructor(private readonly resumeRepository: ResumeRepository) {}

  async upload(params: {
    userId: string;
    workspaceId: string;
    fileName: string;
    mimeType: string;
    fileBuffer: Buffer;
  }): Promise<ResumeUploadResult> {
    if (!ALLOWED_MIME_TYPES.includes(params.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
      throw new ResumeUploadError(`Unsupported file type: ${params.mimeType}. Only PDF is supported.`);
    }

    if (params.fileBuffer.length > MAX_FILE_SIZE) {
      throw new ResumeUploadError(`File too large: ${params.fileBuffer.length} bytes. Maximum is ${MAX_FILE_SIZE} bytes.`);
    }

    const extractedText = await this.extractPdfText(params.fileBuffer);

    const fileStoredName = `${randomUUID()}.pdf`;
    await this.ensureUploadDir();
    const filePath = join(UPLOAD_DIR, fileStoredName);
    await writeFile(filePath, params.fileBuffer);

    const resume = Resume.create({
      id: createResumeId(crypto.randomUUID()),
      userId: createUserId(params.userId),
      title: this.cleanFileName(params.fileName),
      summary: '',
      format: ResumeFormat.PDF,
    });

    await this.resumeRepository.save(resume, {
      originalFile: fileStoredName,
      fileName: params.fileName,
      fileType: params.mimeType,
      fileSize: params.fileBuffer.length,
      rawText: extractedText,
      workspaceId: params.workspaceId,
    });

    return { resume, extractedText };
  }

  async listByUser(userId: string): Promise<Resume[]> {
    return this.resumeRepository.findByUserId(createUserId(userId));
  }

  async getById(id: string): Promise<Resume | null> {
    return this.resumeRepository.findById(createResumeId(id));
  }

  async getDefaultForUser(userId: string): Promise<Resume | null> {
    return this.resumeRepository.findDefaultByUserId(createUserId(userId));
  }

  async updateVersionMetadata(
    id: string,
    userId: string,
    updates: {
      title?: string;
      description?: string;
      language?: string;
      tags?: string[];
      status?: ResumeVersionStatus;
    },
  ): Promise<Resume> {
    const resume = await this.resumeRepository.findById(createResumeId(id));
    if (!resume) {
      throw new ResumeNotFoundError(id);
    }
    if (resume.userId !== userId) {
      throw new ResumeNotAuthorizedError(id);
    }

    if (updates.title !== undefined) resume.updateTitle(updates.title);
    if (updates.description !== undefined) resume.updateDescription(updates.description);
    if (updates.language !== undefined) resume.updateLanguage(updates.language);
    if (updates.tags !== undefined) resume.setTags(updates.tags);
    if (updates.status !== undefined) resume.updateStatus(updates.status);

    await this.resumeRepository.save(resume);
    return resume;
  }

  async delete(id: string, userId: string): Promise<void> {
    const resume = await this.resumeRepository.findById(createResumeId(id));
    if (!resume) {
      throw new ResumeNotFoundError(id);
    }
    if (resume.userId !== userId) {
      throw new ResumeNotAuthorizedError(id);
    }
    await this.resumeRepository.delete(createResumeId(id));
  }

  async getExtractedText(resumeId: string): Promise<string | null> {
    const resume = await this.resumeRepository.findById(createResumeId(resumeId));
    if (!resume) return null;
    return resume.rawText ?? null;
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const result = await pdfParse(buffer);
      return result.text ?? '';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ResumeUploadError(`Failed to extract text from PDF: ${message}`);
    }
  }

  private cleanFileName(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^\p{L}\p{N}\s\-_.]/gu, '')
      .trim() || 'Untitled Resume';
  }

  private async ensureUploadDir(): Promise<void> {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}
