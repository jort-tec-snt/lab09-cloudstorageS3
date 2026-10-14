'use strict';

const crypto = require('node:crypto');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

/** Crea el cliente real. Las credenciales vienen de la cadena por defecto del SDK. */
function createS3Client(region) {
  return new S3Client({ region });
}

/**
 * Única capa que toca AWS.
 * No se firma ServerSideEncryption: el bucket aplica SSE-S3 por defecto.
 * Se firman ContentType y ContentLength para que S3 rechace un cuerpo distinto al declarado.
 */
function createS3Service({ client, bucket, keyPrefix, uploadExpiresSeconds, viewExpiresSeconds }) {
  return {
    async createUploadUrl({ filename, contentType, sizeBytes }) {
      const key = `${keyPrefix}${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${filename}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: sizeBytes,
      });
      const uploadUrl = await getSignedUrl(client, command, {
        expiresIn: uploadExpiresSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return { uploadUrl, key };
    },

    async listImages() {
      const items = [];
      let ContinuationToken;
      do {
        const res = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: keyPrefix, ContinuationToken })
        );
        for (const obj of res.Contents || []) {
          if (obj.Key === keyPrefix) continue; // "carpeta" vacía
          items.push(obj);
        }
        ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (ContinuationToken);

      return Promise.all(
        items.map(async (obj) => ({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
          url: await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: obj.Key }), {
            expiresIn: viewExpiresSeconds,
          }),
        }))
      );
    },

    async deleteImage(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

module.exports = { createS3Client, createS3Service };
