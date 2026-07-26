import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const ENCRYPTION_VERSION = 1;
const DEFAULT_KEY_ID = 'primary';

interface EncryptedPayload {
  v: number;
  kid: string;
  alg: string;
  iv: string;
  tag: string;
  data: string;
}

export interface EncryptionConfig {
  masterKeyHex: string;
  keyId?: string;
  allowUnencrypted?: boolean;
}

export class EncryptionService {
  private readonly masterKey: Buffer;
  private readonly keyId: string;
  private readonly allowUnencrypted: boolean;

  constructor(config: EncryptionConfig | string) {
    let masterKeyHex: string;
    let keyId: string;
    let allowUnencrypted: boolean;

    if (typeof config === 'string') {
      masterKeyHex = config;
      keyId = DEFAULT_KEY_ID;
      allowUnencrypted = false;
    } else {
      masterKeyHex = config.masterKeyHex;
      keyId = config.keyId ?? DEFAULT_KEY_ID;
      allowUnencrypted = config.allowUnencrypted ?? false;
    }

    if (!masterKeyHex) {
      throw new Error('MASTER_ENCRYPTION_KEY is required');
    }

    if (!/^[0-9a-fA-F]+$/.test(masterKeyHex)) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY must be a valid hex string (0-9, a-f, A-F).',
      );
    }

    const keyBuffer = Buffer.from(masterKeyHex, 'hex');

    if (keyBuffer.length !== 32) {
      throw new Error(
        `MASTER_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${keyBuffer.length} bytes.`,
      );
    }

    this.masterKey = keyBuffer;
    this.keyId = keyId;
    this.allowUnencrypted = allowUnencrypted;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      v: ENCRYPTION_VERSION,
      kid: this.keyId,
      alg: ALGORITHM,
      iv: iv.toString('base64'),
      tag: authTag.toString('base64'),
      data: encrypted.toString('base64'),
    };

    return `enc:v1:${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  decrypt(encryptedValue: string): string {
    if (!encryptedValue.startsWith('enc:v1:')) {
      throw new Error('Invalid encrypted value format');
    }

    const base64Payload = encryptedValue.slice('enc:v1:'.length);
    let payloadJson: string;
    try {
      payloadJson = Buffer.from(base64Payload, 'base64').toString('utf8');
    } catch {
      throw new Error('Invalid encrypted value: corrupted base64 payload');
    }

    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      throw new Error('Invalid encrypted value: corrupted JSON payload');
    }

    if (payload.v !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${payload.v}`);
    }

    if (payload.alg !== ALGORITHM) {
      throw new Error(`Unsupported algorithm: ${payload.alg}`);
    }

    const iv = Buffer.from(payload.iv, 'base64');
    const authTag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.data, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith('enc:v1:');
  }

  isAllowUnencrypted(): boolean {
    return this.allowUnencrypted;
  }

  getKeyId(): string {
    return this.keyId;
  }
}

let _instance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!_instance) {
    const key = process.env.MASTER_ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        'MASTER_ENCRYPTION_KEY environment variable is required for encryption.',
      );
    }

    const allowUnencrypted = process.env.ALLOW_UNENCRYPTED_PROVIDER_KEYS === 'true';

    _instance = new EncryptionService({
      masterKeyHex: key,
      allowUnencrypted,
    });
  }
  return _instance;
}

export function resetEncryptionService(): void {
  _instance = null;
}

export function validateEncryptionConfig(): void {
  const key = process.env.MASTER_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(key)) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY must be a valid hex string (0-9, a-f, A-F).',
    );
  }

  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== 32) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${keyBuffer.length} bytes.`,
    );
  }

  const allowUnencrypted = process.env.ALLOW_UNENCRYPTED_PROVIDER_KEYS === 'true';
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  if (nodeEnv === 'production' && allowUnencrypted) {
    throw new Error(
      'ALLOW_UNENCRYPTED_PROVIDER_KEYS=true is not permitted in production. ' +
      'Set NODE_ENV=development or remove ALLOW_UNENCRYPTED_PROVIDER_KEYS.',
    );
  }

  if (nodeEnv === 'production' && !key) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY is required in production mode.',
    );
  }
}
