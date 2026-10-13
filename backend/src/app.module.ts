import { Controller, Get, Module } from '@nestjs/common';
import * as os from 'node:os';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { ActivitiesModule } from './activities/activities.module';
import { AttemptsModule } from './attempts/attempts.module';
import { UploadsModule } from './uploads/uploads.module';
import { ModelsModule } from './common/models.module';
import { AttemptAwareThrottlerGuard } from './common/throttle.guard';
import { appConfig } from './config';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: appConfig().MONGO_URL,
        // The driver otherwise loads `os` via dynamic import(), which fails silently under Jest's CJS sandbox.
        runtimeAdapters: { os },
      }),
    }),
    ScheduleModule.forRoot(),
    // Generous: one corporate egress IP may carry hundreds of employees.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 600 }]),
    ModelsModule,
    AuthModule,
    ActivitiesModule,
    AttemptsModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: AttemptAwareThrottlerGuard }],
})
export class AppModule {}
