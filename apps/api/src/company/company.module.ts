import { AiCacheModule } from '../ai-agent/infrastructure/ai-cache.module';
import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
@Module({ imports: [UserModule,AiCacheModule], controllers: [CompanyController], providers: [CompanyService], exports: [CompanyService] })
export class CompanyModule {}
