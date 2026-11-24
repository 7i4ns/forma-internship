import { Entity, Column, Index } from 'typeorm';
import { AiOwnedEntity } from './ai-owned.entity';
@Entity('ai_task_record') @Index(['tenant_id','user_id','status'])
export class AiTaskRecordEntity extends AiOwnedEntity {
 @Column('uuid',{nullable:true}) session_id!:string|null;
 @Column('varchar',{length:100}) task_type!:string;
 @Column('varchar',{length:16,default:'queued'}) status!:'queued'|'running'|'completed'|'failed'|'cancelled';
 @Column('integer',{default:0}) progress!:number;
 @Column('jsonb',{default:{}}) input!:Record<string,unknown>;
 @Column('jsonb',{default:{}}) output!:Record<string,unknown>;
}
