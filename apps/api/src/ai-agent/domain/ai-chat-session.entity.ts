import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import type { ChatSession, ModelProvider } from '@internship/ai-contracts';
@Entity('ai_chat_session')
@Index(['tenant_id','user_id','updated_at','id'])
export class AIChatSessionEntity {
 @PrimaryGeneratedColumn('uuid') id!:string;
 @Column('uuid') tenant_id!:string;
 @Column('uuid') user_id!:string;
 @Column('varchar',{length:80,default:'新对话'}) title!:string;
 @Column('varchar',{length:20}) provider!:ModelProvider;
 @Column('varchar',{length:120}) model!:string;
 @Column('varchar',{length:12,default:'idle'}) state!:'idle'|'thinking';
 @Column('uuid',{nullable:true}) active_message_id!:string|null;
 @Column('timestamptz',{nullable:true}) generation_started_at!:Date|null;
 @Column('boolean',{default:false}) is_demo!:boolean;
 @Column('timestamptz',{nullable:true}) closed_at!:Date|null;
 @Column('timestamptz',{nullable:true}) deleted_at!:Date|null;
 @CreateDateColumn({type:'timestamptz'}) created_at!:Date;
 @UpdateDateColumn({type:'timestamptz'}) updated_at!:Date;
 static public(row:AIChatSessionEntity):ChatSession {
  return {id:row.id,title:row.title,provider:row.provider,model:row.model,state:row.state,isDemo:row.is_demo,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()};
 }
}
