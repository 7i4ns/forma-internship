import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, ObjectLiteral, type EntityTarget } from 'typeorm';
import { AiDatabase } from '../infrastructure/ai-database';
import { AiCacheService } from '../infrastructure/ai-cache.service';
import { AiScopeService, type AiScope } from './ai-scope.service';
import { AIChatSessionEntity } from '../domain/ai-chat-session.entity';
import { AiUserMemoryEntity } from '../domain/ai-user-memory.entity';
import { AiTaskRecordEntity } from '../domain/ai-task-record.entity';
import { AiOperationAuditEntity } from '../domain/ai-operation-audit.entity';
import { ModelGateway, defaultProvider } from '../infrastructure/model-gateway';
import type { AiListDto } from '../http/core.dto';
export type AiResource='sessions'|'memories'|'tasks'|'audits';
const targets:Record<AiResource,EntityTarget<ObjectLiteral>>={sessions:AIChatSessionEntity,memories:AiUserMemoryEntity,tasks:AiTaskRecordEntity,audits:AiOperationAuditEntity};
@Injectable()
export class AiCoreService {
 constructor(@Inject(AiDatabase)readonly db:AiDatabase,@Inject(AiScopeService)readonly scopes:AiScopeService,@Inject(AiCacheService)readonly cache:AiCacheService,@Inject(ModelGateway)private readonly models:ModelGateway){}
 private query(m:EntityManager,resource:AiResource,s:AiScope,user?:string){
  const q=m.getRepository(targets[resource]).createQueryBuilder('r').where('r.tenant_id=:tenant',{tenant:s.tenantId});
  if(resource!=='audits'||!s.auditAdmin)q.andWhere('r.user_id=:user',{user:s.userId});else if(user)q.andWhere('r.user_id=:user',{user});
  if(resource==='sessions')q.andWhere('r.deleted_at IS NULL');return q;
 }
 async list(resource:AiResource,s:AiScope,query:AiListDto){this.scopes.requireUserFilter(s,query.user_id,resource==='audits');const [items,total]=await this.query(this.db.source.manager,resource,s,query.user_id).orderBy(resource==='audits'?'r.created_at':'r.updated_at','DESC').addOrderBy('r.id','DESC').skip(query.page*query.limit).take(query.limit).getManyAndCount();return {items,total,page:query.page,limit:query.limit};}
 async find(resource:AiResource,s:AiScope,id:string,m=this.db.source.manager,lock=false){const q=this.query(m,resource,s).andWhere('r.id=:id',{id});if(lock)q.setLock('pessimistic_write');const row=await q.getOne();if(!row)throw new NotFoundException({code:'AI_NOT_FOUND',message:'记录不存在或无权访问'});return row;}
 private async sessionLink(m:EntityManager,s:AiScope,id:unknown){if(id!==undefined)await this.find('sessions',s,id as string,m);}
 async audit(s:AiScope,action:string,target_type:string,target_id:string|undefined,result:'success'|'failure'='success',details:Record<string,unknown>={},m=this.db.source.manager){return m.getRepository(AiOperationAuditEntity).save({tenant_id:s.tenantId,user_id:s.userId,action,target_type,target_id:target_id??null,result,source:'system',details});}
 private async mutation<T>(run:()=>Promise<T>){try{return await run();}catch(e){const code=(e as {code?:string}).code;if(code==='23505')throw new ConflictException({code:'AI_DUPLICATE',message:'该记忆键已存在'});if(code==='23503'||code==='23514')throw new BadRequestException({code:'AI_INVALID_REFERENCE',message:'关联或字段约束不满足'});throw e;}}
 private size(body:object){if(Buffer.byteLength(JSON.stringify(body),'utf8')>65536)throw new BadRequestException({code:'AI_PAYLOAD_TOO_LARGE',message:'AI记录最多64KB'});}
 async create(resource:AiResource,s:AiScope,body:Record<string,unknown>){this.size(body);return this.mutation(()=>this.db.source.transaction(async m=>{
  let data=Object.fromEntries(Object.entries(body).filter(([,v])=>v!==undefined));await this.sessionLink(m,s,data.session_id);
  if(resource==='sessions'){const provider=(data.provider??defaultProvider()) as Parameters<ModelGateway['require']>[0];data={title:'新对话',...data,provider,model:this.models.require(provider).model,state:'idle',is_demo:false};}
  if(resource==='tasks')data={status:'queued',progress:0,input:{},output:{},...data};
  if(resource==='audits')data={result:'success',details:{},...data,source:'manual'};
  const row=await m.getRepository(targets[resource]).save({...data,tenant_id:s.tenantId,user_id:s.userId});
  await this.audit(s,`${resource}.create`,resource,row.id,'success',{},m);return row;
 }));}
 async update(resource:AiResource,s:AiScope,id:string,body:Record<string,unknown>){body=Object.fromEntries(Object.entries(body).filter(([,v])=>v!==undefined));this.size(body);if(!Object.keys(body).length)throw new BadRequestException({code:'EMPTY_UPDATE',message:'请至少修改一个字段'});
  const row=await this.mutation(()=>this.db.source.transaction(async m=>{
   const row=await this.find(resource,s,id,m,true);
   // Audit administrators can read peers, never rewrite their records.
   if(row.user_id!==s.userId||resource==='audits'&&row.source==='system')throw new ForbiddenException({code:'AUDIT_IMMUTABLE',message:'系统审计或他人的审计记录不可修改'});
   await this.sessionLink(m,s,body.session_id);const patch={...body};
   if(resource==='sessions'){if(row.state==='thinking')throw new ConflictException({code:'CHAT_BUSY',message:'生成中的会话不能编辑或关闭'});if('closed'in patch){patch.closed_at=patch.closed?new Date():null;delete patch.closed;}}
   if(resource==='tasks'&&patch.status!==undefined){const transitions:Record<string,string[]>={queued:['queued','running','cancelled'],running:['running','completed','failed','cancelled'],completed:['completed'],failed:['failed'],cancelled:['cancelled']};if(!transitions[row.status].includes(patch.status as string))throw new ConflictException({code:'INVALID_TASK_TRANSITION',message:'任务状态不能按该顺序变更'});if(patch.status==='completed')patch.progress=100;}
   if(resource==='tasks'&&row.status==='completed'&&patch.progress!==undefined&&patch.progress!==100)throw new ConflictException({code:'INVALID_TASK_PROGRESS',message:'已完成任务的进度必须为100'});
   Object.assign(row,patch);const saved=await m.getRepository(targets[resource]).save(row);await this.audit(s,`${resource}.update`,resource,id,'success',{fields:Object.keys(body)},m);return saved;
  }));
  if(resource==='sessions')await this.cache.clearSession(s,id);if(resource==='tasks')await this.cache.clearTaskState(s,id);return row;
 }
 async remove(resource:AiResource,s:AiScope,id:string){await this.mutation(()=>this.db.source.transaction(async m=>{const row=await this.find(resource,s,id,m,true);if(row.user_id!==s.userId||resource==='audits'&&row.source==='system')throw new ForbiddenException({code:'AUDIT_IMMUTABLE',message:'系统审计或他人的审计记录不可删除'});if(resource==='sessions'){if(row.state==='thinking')throw new ConflictException({code:'CHAT_BUSY',message:'生成中的会话不能删除'});row.deleted_at=new Date();row.closed_at=new Date();await m.getRepository(targets[resource]).save(row);}else await m.getRepository(targets[resource]).remove(row);await this.audit(s,`${resource}.delete`,resource,id,'success',{},m);}));if(resource==='sessions')await this.cache.clearSession(s,id);if(resource==='tasks')await this.cache.clearTaskState(s,id);return {message:'记录已删除'};}
 async taskState(s:AiScope,id:string){const row=await this.find('tasks',s,id);return {state:await this.cache.getTaskState(s,id)??null,durable:{status:row.status,progress:row.progress},temporary:true};}
 async setTaskState(s:AiScope,id:string,state:Record<string,unknown>,ttl:number){this.size(state);return this.db.source.transaction(async m=>{await this.find('tasks',s,id,m,true);const stored=await this.cache.setTaskState(s,id,state,ttl);if(!stored)throw new ConflictException({code:'AI_CACHE_UNAVAILABLE',message:'临时任务状态缓存暂不可用'});await this.audit(s,'tasks.state.write','tasks',id,'success',{ttl},m);return {stored:true,ttl};});}
}
