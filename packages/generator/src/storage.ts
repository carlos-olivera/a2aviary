import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import { SiteError } from './render.ts';
export interface ObjectStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}
export class BucketStore implements ObjectStore {
  readonly client: S3Client;
  readonly bucket: string;
  constructor(client: S3Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
  }
  async put(key: string, bytes: Uint8Array) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: 'application/octet-stream'
      })
    );
  }
  async get(key: string) {
    const r = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key })
    );
    if (!r.Body) throw new SiteError('artifact_missing');
    if ((r.ContentLength ?? 0) > 64 * 1024 * 1024)
      throw new SiteError('artifact_too_large');
    const bytes = await r.Body.transformToByteArray();
    if (bytes.length > 64 * 1024 * 1024)
      throw new SiteError('artifact_too_large');
    return bytes;
  }
}
