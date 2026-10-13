import { Module } from '@nestjs/common';
import { AttemptsService } from './attempts.service';
import { AdminAttemptsService } from './admin-attempts.service';
import { PublicController } from './public.controller';
import { AdminAttemptsController } from './admin-attempts.controller';

@Module({
  providers: [AttemptsService, AdminAttemptsService],
  controllers: [PublicController, AdminAttemptsController],
  exports: [AttemptsService],
})
export class AttemptsModule {}
