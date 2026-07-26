# ADR-018: File Storage Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs file storage for:

- Resume files (PDF, DOCX)
- User avatars
- Company logos
- Generated documents

We need:

- Local development storage
- Production-ready storage
- Pluggable provider abstraction
- S3 compatibility

## Decision

### StorageProvider Abstraction

- Abstract interface for all file operations
- Configurable backend

### Development: MinIO

- S3-compatible object storage
- Docker-based
- Local development only

### Production: S3-Compatible Storage

- AWS S3
- Google Cloud Storage
- DigitalOcean Spaces
- Any S3-compatible service

## Consequences

### Positive

- Same API in dev and production
- S3 compatibility throughout
- Easy migration to cloud storage
- Local development without cloud

### Negative

- MinIO adds Docker service
- S3 costs in production
- File size limits needed

### Mitigations

- MinIO is lightweight
- Set file size limits
- Monitor storage costs

## Architecture

```
packages/shared/src/
├── domain/
│   └── StorageProvider.ts      # Interface
├── infrastructure/
│   ├── MinIOProvider.ts        # Local development
│   └── S3Provider.ts           # Production
```

## Interface

```typescript
// packages/shared/src/domain/StorageProvider.ts
export interface StorageProvider {
  readonly name: string;
  
  upload(options: UploadOptions): Promise<UploadResult>;
  
  download(key: string): Promise<DownloadResult>;
  
  delete(key: string): Promise<void>;
  
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  
  exists(key: string): Promise<boolean>;
}

export interface UploadOptions {
  key: string;
  body: Buffer | ReadableStream;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export interface DownloadResult {
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}
```

## MinIO Implementation

```typescript
// packages/shared/src/infrastructure/MinIOProvider.ts
import * as Minio from 'minio';

export class MinIOProvider implements StorageProvider {
  readonly name = 'minio';
  
  private client: Minio.Client;
  private bucket: string;
  
  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
    this.bucket = process.env.MINIO_BUCKET || 'careeros';
  }
  
  async upload(options: UploadOptions): Promise<UploadResult> {
    await this.ensureBucket();
    
    const result = await this.client.putObject(
      this.bucket,
      options.key,
      options.body,
      options.body.length,
      { 'Content-Type': options.contentType }
    );
    
    return {
      key: options.key,
      url: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${this.bucket}/${options.key}`,
      size: options.body.length,
    };
  }
  
  async download(key: string): Promise<DownloadResult> {
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    return {
      body: Buffer.concat(chunks),
      contentType: 'application/octet-stream',
    };
  }
  
  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }
  
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresIn);
  }
  
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
  
  private async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }
}
```

## Docker Compose

```yaml
services:
  minio:
    image: minio/minio
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Web UI
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"

volumes:
  minio_data:
```

## Usage Examples

### Upload Resume

```typescript
const storage = new MinIOProvider();
const resumeBuffer = await file.buffer;

const result = await storage.upload({
  key: `users/${userId}/resumes/${uuid()}.pdf`,
  body: resumeBuffer,
  contentType: 'application/pdf',
  metadata: {
    originalName: file.originalname,
    uploadedAt: new Date().toISOString(),
  },
});
```

### Get Download URL

```typescript
const url = await storage.getSignedUrl(result.key, 3600);
// Returns: http://localhost:9000/careeros/users/123/resumes/abc.pdf?X-Amz-...
```

## File Organization

```
careeros/
├── users/
│   ├── {userId}/
│   │   ├── avatars/
│   │   │   └── avatar.jpg
│   │   └── resumes/
│   │       ├── {uuid}.pdf
│   │       └── {uuid}.docx
├── companies/
│   └── {companyId}/
│       └── logos/
│           └── logo.png
└── temp/
    └── {uuid}
```

## Configuration

```bash
# .env (Development)
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=careeros

# .env (Production - future)
STORAGE_PROVIDER=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=careeros-prod
```

## File Size Limits

| Type | Limit |
|------|-------|
| Resume | 10 MB |
| Avatar | 5 MB |
| Logo | 2 MB |
| Temp files | 50 MB |

## References

- [MinIO](https://min.io/)
- [AWS S3 SDK](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/working-with-s3.html)
- [S3 Compatible Services](https://min.io/product/s3-compatible-storage)
