import { Entity, Column, Index } from 'typeorm';
import { AiOwnedEntity } from './ai-owned.entity';
@Entity('ai_operation_audit') @Index(['tenant_id','created_at','id'])
export class AiOperationAuditEntity extends AiOwnedEntity {
 @Column('varchar',{length:100}) action!:string;
 @Column('varchar',{length:12,default:'success'}) result!:'success'|'failure';
 @Column('varchar',{length:12,default:'manual'}) source!:'manual'|'system';
 @Column('varchar',{length:100,nullable:true}) target_type!:string|null;
 @Column('uuid',{nullable:true}) target_id!:string|null;
 @Column('jsonb',{default:{}}) details!:Record<string,unknown>;
}
