/**
 * screenshots.service.ts
 * Sube y elimina imágenes de pantallazos a AWS S3.
 * Cada screenshot se almacena bajo la carpeta: trades/{tradeId}/{uuid}.{ext}
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class ScreenshotsService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.AWS_REGION ?? 'us-east-2';
    this.bucket = process.env.AWS_S3_BUCKET ?? 'elasticitymeter';
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /** Sube un archivo a S3 y retorna la URL pública */
  async upload(tradeId: number, file: Express.Multer.File): Promise<string> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes (jpg, png, webp, gif)');
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const key = `trades/${tradeId}/${randomUUID()}${ext}`;

    await this.s3.send(new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
    }));

    // URL pública (el bucket debe tener ACL o policy pública si quieres esto)
    // Como el bucket es privado, retornamos una URL base que construimos
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /** Elimina un objeto de S3 dado su key */
  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key:    key,
    }));
  }

  /** Extrae el key S3 de una URL completa */
  extractKey(url: string): string {
    // https://elasticitymeter.s3.us-east-2.amazonaws.com/trades/5/uuid.jpg
    const match = url.match(/amazonaws\.com\/(.+)$/);
    if (!match) throw new BadRequestException('URL de screenshot inválida');
    return match[1];
  }
}
