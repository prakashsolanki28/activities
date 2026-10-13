import { HttpException, HttpStatus } from '@nestjs/common';

/** Error with a stable machine code the web app can switch on. */
export class AppError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string, extra: Record<string, unknown> = {}) {
    super({ code, message, ...extra }, status);
  }
}
