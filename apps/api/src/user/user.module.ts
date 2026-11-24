import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SessionGuard } from './session.guard';
import { AuthRateGuard } from './auth-rate.guard';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';
import { AiCacheModule } from '../ai-agent/infrastructure/ai-cache.module';
@Module({
  imports: [AiCacheModule,JwtModule.registerAsync({ useFactory: () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error('Set JWT_SECRET to at least 32 random characters');
    return { secret, signOptions: { expiresIn: '1h' } };
  } })],
  controllers: [UserController, ManagementController], providers: [UserService, SessionGuard, AuthRateGuard, ManagementService],
  exports: [SessionGuard, UserService, JwtModule],
})
export class UserModule {}
