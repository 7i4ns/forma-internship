import { Module } from '@nestjs/common';
import { AiCacheService } from './ai-cache.service';
@Module({providers:[AiCacheService],exports:[AiCacheService]})
export class AiCacheModule {}
