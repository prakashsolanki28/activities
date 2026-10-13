import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { Admin, AdminSchema } from './admin.schema';
import { AuthService } from './auth.service';
import { AuthController, UsersController } from './auth.controller';
import { AdminGuard } from './auth.guard';
import { appConfig } from '../config';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    JwtModule.registerAsync({
      useFactory: () => ({ secret: appConfig().JWT_SECRET, signOptions: { expiresIn: '12h' } }),
    }),
  ],
  providers: [AuthService, AdminGuard],
  controllers: [AuthController, UsersController],
  exports: [AuthService, AdminGuard, JwtModule, MongooseModule],
})
export class AuthModule {}
