import { Body, Controller, HttpStatus, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { AdminGuard } from '../auth/auth.guard';
import { AppError } from '../common/errors';

@Controller('admin/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body('alt') alt?: string) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'no_file', 'Choose an image to upload.');
    return this.uploads.storeImage(file.buffer, file.mimetype, (alt ?? '').slice(0, 300));
  }
}
