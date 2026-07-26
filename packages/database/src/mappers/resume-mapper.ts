import type { Prisma } from '@prisma/client';
import { Resume as ResumeEntity, ResumeFormat, ResumeVersionStatus, createResumeId, createUserId } from '@careeros/career';

type PrismaResumeVersionStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

interface PrismaResume {
  id: string;
  title: string;
  description: string | null;
  language: string | null;
  tags: string[];
  status: PrismaResumeVersionStatus;
  originalFile: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  parsedData: unknown;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

const STATUS_TO_DOMAIN: Record<PrismaResumeVersionStatus, ResumeVersionStatus> = {
  DRAFT: ResumeVersionStatus.DRAFT,
  ACTIVE: ResumeVersionStatus.ACTIVE,
  ARCHIVED: ResumeVersionStatus.ARCHIVED,
};

const STATUS_TO_PERSISTENCE: Record<ResumeVersionStatus, PrismaResumeVersionStatus> = {
  [ResumeVersionStatus.DRAFT]: 'DRAFT',
  [ResumeVersionStatus.ACTIVE]: 'ACTIVE',
  [ResumeVersionStatus.ARCHIVED]: 'ARCHIVED',
};

interface ParsedData {
  title?: string;
  summary?: string;
  format?: string;
  skills?: Array<Record<string, unknown>>;
  technologies?: Array<Record<string, unknown>>;
  experience?: Array<Record<string, unknown>>;
  education?: Array<Record<string, unknown>>;
  rawText?: string;
}

export interface ResumeMetadata {
  readonly originalFile?: string;
  readonly fileName?: string;
  readonly fileType?: string;
  readonly fileSize?: number;
  readonly rawText?: string;
  readonly workspaceId?: string;
}

export class ResumeMapper {
  static toDomain(record: PrismaResume): ResumeEntity {
    const parsedData = (record.parsedData ?? {}) as ParsedData;

    return ResumeEntity.reconstitute(createResumeId(record.id), {
      userId: createUserId(record.userId),
      title: record.title || (parsedData.title as string) || record.fileName || 'Untitled Resume',
      summary: (parsedData.summary as string) ?? '',
      description: record.description ?? '',
      language: record.language ?? undefined,
      tags: [...record.tags],
      status: STATUS_TO_DOMAIN[record.status],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      skills: (parsedData.skills as any[]) ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      technologies: (parsedData.technologies as any[]) ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      experience: (parsedData.experience as any[]) ?? [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      education: (parsedData.education as any[]) ?? [],
      format: parseResumeFormat(parsedData.format, record.fileType, record.fileName, record.originalFile),
      isDefault: false,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      rawText: parsedData.rawText ?? undefined,
    });
  }

  static toPersistence(resume: { id: string; title: string; summary: string; description: string; language?: string; tags: ReadonlyArray<string>; status: ResumeVersionStatus; skills: ReadonlyArray<unknown>; technologies: ReadonlyArray<unknown>; experience: ReadonlyArray<unknown>; education: ReadonlyArray<unknown>; createdAt: Date; updatedAt: Date; userId: string; rawText?: string }, metadata?: ResumeMetadata): {
    id: string;
    title: string;
    description: string | null;
    language: string | null;
    tags: string[];
    status: PrismaResumeVersionStatus;
    fileName: string;
    originalFile: string | null;
    fileType: string | null;
    fileSize: number | null;
    parsedData: Prisma.InputJsonValue;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    workspaceId: string;
  } {
    return {
      id: resume.id,
      title: resume.title,
      description: resume.description || null,
      language: resume.language ?? null,
      tags: [...resume.tags],
      status: STATUS_TO_PERSISTENCE[resume.status],
      fileName: metadata?.fileName ?? resume.title,
      originalFile: metadata?.originalFile ?? null,
      fileType: metadata?.fileType ?? null,
      fileSize: metadata?.fileSize ?? null,
      // parsedData.title is kept in sync for one release as a rollback safety net —
      // the `title` column above is now the source of truth for reads.
      parsedData: JSON.parse(JSON.stringify({
        title: resume.title,
        summary: resume.summary,
        format: 'format' in resume ? resume.format : ResumeFormat.JSON,
        skills: [...resume.skills],
        technologies: [...resume.technologies],
        experience: [...resume.experience],
        education: [...resume.education],
        rawText: metadata?.rawText ?? resume.rawText ?? null,
      })),
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
      userId: resume.userId,
      workspaceId: metadata?.workspaceId ?? 'default',
    };
  }
}

function parseResumeFormat(
  parsedFormat: string | undefined,
  fileType: string | null,
  fileName: string | null,
  originalFile: string | null
): 'json' | 'pdf' | 'docx' | 'markdown' {
  if (
    parsedFormat &&
    Object.values(ResumeFormat).includes(
      parsedFormat as (typeof ResumeFormat)[keyof typeof ResumeFormat]
    )
  ) {
    return parsedFormat as 'json' | 'pdf' | 'docx' | 'markdown';
  }

  if (fileType === 'application/pdf') {
    return ResumeFormat.PDF;
  }

  const references = [fileName, originalFile].filter(Boolean).join(' ').toLowerCase();
  if (references.includes('.pdf')) {
    return ResumeFormat.PDF;
  }
  if (references.includes('.docx')) {
    return ResumeFormat.DOCX;
  }
  if (references.includes('.md')) {
    return ResumeFormat.MARKDOWN;
  }

  return ResumeFormat.JSON;
}
