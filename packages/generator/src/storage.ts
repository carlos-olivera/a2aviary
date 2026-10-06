import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  PutObjectCommand
} from '@aws-sdk/client-s3';
import { SiteError } from './render.ts';
export interface ObjectStore {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  deletePrefix(prefix: string): Promise<void>;
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
  async deletePrefix(prefix: string) {
    if (
      !/^specs\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/$/.test(
        prefix
      )
    )
      throw new SiteError('unsafe_reset_prefix');
    // Restart each page from the prefix: deleting a page must not make a
    // provider continuation token skip objects. Repeat safely after a failure.
    for (let page = 0; page < 1000; page++) {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          MaxKeys: 1000
        })
      );
      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => Boolean(k));
      if (!keys.length) return;
      if (keys.some((k) => !k.startsWith(prefix)))
        throw new SiteError('unsafe_reset_prefix');
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }
        })
      );
      if (result.Errors?.length) throw new SiteError('asset_reset_failed');
    }
    throw new SiteError('asset_reset_incomplete');
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
