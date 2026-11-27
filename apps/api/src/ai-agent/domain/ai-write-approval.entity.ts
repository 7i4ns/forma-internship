import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ai_write_approval')
@Index(['tenant_id','user_id','status','created_at'])
export class AiWriteApprovalEntity {
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Column('uuid') tenant_id!:string;
 @Column('uuid') user_id!:string;
 @Column('uuid',{unique:true}) task_id!:string;
 @Column('varchar',{length:100}) tool_name!:string;
 @Column('varchar',{length:20}) operation_type!:'create'|'update'|'delete'|'batch-delete';
 @Column('varchar',{length:12}) risk_level!:'low'|'medium'|'high';
 @Column('varchar',{length:16,default:'pending'}) status!:'pending'|'approved'|'rejected'|'expired'|'executed'|'failed';
 @Column('jsonb') preview!:Record<string,unknown>;
 @Column('jsonb') encrypted_parameters!:Record<string,string>;
 @Column('varchar',{length:500,nullable:true}) rejection_reason!:string|null;
 @Column('timestamptz') expires_at!:Date;
 @Column('timestamptz',{nullable:true}) decided_at!:Date|null;
 @Column('timestamptz',{nullable:true}) executed_at!:Date|null;
 @Column('timestamptz',{default:()=> 'now()'}) created_at!:Date;
 @Column('timestamptz',{default:()=> 'now()'}) updated_at!:Date;
}
