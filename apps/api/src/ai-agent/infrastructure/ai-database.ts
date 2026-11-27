import { AiToolSettingsEntity } from '../domain/ai-tool-settings.entity';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AIChatSessionEntity } from '../domain/ai-chat-session.entity';
import { AiUserMemoryEntity } from '../domain/ai-user-memory.entity';
import { AiTaskRecordEntity } from '../domain/ai-task-record.entity';
import { AiOperationAuditEntity } from '../domain/ai-operation-audit.entity';
import { AiWriteApprovalEntity } from '../domain/ai-write-approval.entity';
@Injectable()
export class AiDatabase implements OnModuleInit, OnModuleDestroy {
 readonly source=new DataSource({type:'postgres',url:process.env.DATABASE_URL,entities:[AIChatSessionEntity,AiUserMemoryEntity,AiTaskRecordEntity,AiOperationAuditEntity,AiToolSettingsEntity,AiWriteApprovalEntity],synchronize:false,migrationsRun:false,logging:false,extra:{connectionTimeoutMillis:3000}});
 async onModuleInit(){await this.source.initialize();}
 async onModuleDestroy(){if(this.source.isInitialized)await this.source.destroy();}
}
