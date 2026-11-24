import { Entity, Column, Index } from 'typeorm';
import { AiOwnedEntity } from './ai-owned.entity';
@Entity('ai_user_memory') @Index(['tenant_id','user_id','memory_key'],{unique:true})
export class AiUserMemoryEntity extends AiOwnedEntity {
 @Column('uuid',{nullable:true}) session_id!:string|null;
 @Column('varchar',{length:100}) memory_key!:string;
 @Column('jsonb') content!:Record<string,unknown>;
}
