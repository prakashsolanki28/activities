import { HttpStatus, Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { ImageRef } from '@hrrl/shared';
import { AppError } from '../common/errors';
import { humanCode } from '../common/ids';
import { appConfig } from '../config';

const ACCEPTED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_WIDTH = 2400;

export function uploadRoot(): string {
  return resolve(appConfig().UPLOAD_DIR);
}

@Injectable()
export class UploadsService {
  /**
   * Re-encode every upload: strips metadata (EXIF/GPS), caps the size, and means the
   * stored file is always an image we produced, never the raw bytes someone sent.
   */
  async storeImage(buffer: Buffer, mimetype: string, alt = ''): Promise<ImageRef> {
    if (!ACCEPTED.has(mimetype)) {
      throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'unsupported_image', 'Upload a PNG, JPEG, WebP or GIF image.');
    }
    let output: { data: Buffer; info: sharp.OutputInfo };
    try {
      output = await sharp(buffer, { limitInputPixels: 60_000_000, animated: false })
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new AppError(HttpStatus.BAD_REQUEST, 'unreadable_image', 'That file could not be read as an image.');
    }
    const now = new Date();
    const dir = join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'));
    const name = `${humanCode(16).toLowerCase()}.webp`;
    await mkdir(join(uploadRoot(), dir), { recursive: true });
    await writeFile(join(uploadRoot(), dir, name), output.data);
    return { url: `/uploads/${dir}/${name}`, w: output.info.width, h: output.info.height, alt };
  }
}
