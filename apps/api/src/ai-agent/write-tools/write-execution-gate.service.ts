import { ConflictException, HttpException, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ToolContext, WriteApprovalDecisionResult, WriteApprovalDetail, WriteApprovalListItem, WriteApprovalRequest, WriteToolPreviewDetails } from '@internship/ai-contracts';
import { AiCoreService } from '../application/core.service';
import { AiDatabase } from '../infrastructure/ai-database';
import { redact } from '../tools/tool-audit.service';
import { ApprovalPayloadCipherService } from './approval-payload-cipher.service';
import { BaseWriteTool } from './base-write-tool';

type ApprovalRow={id:string;tenant_id:string;user_id:string;task_id:string;tool_name:string;operation_type:WriteToolPreviewDetails['action'];risk_level:WriteToolPreviewDetails['riskLevel'];status:'pending'|'approved'|'rejected'|'expired'|'executed'|'failed';preview:WriteToolPreviewDetails;encrypted_parameters:{version:string;iv:string;tag:string;data:string};rejection_reason:string|null;expires_at:Date;decided_at:Date|null;executed_at:Date|null;created_at:Date;updated_at:Date;session_id:string|null;task_status:string;progress:number;rollback_snapshots:Record<string,unknown>;output:Record<string,unknown>};
type ListFilters={status?:string;operationType?:string;from?:string;to?:string;page:number;limit:number};

@Injectable()
export class WriteExecutionGateService implements OnModuleInit,OnModuleDestroy {
 private timer?:ReturnType<typeof setInterval>;
 private readonly timeoutHours=Math.min(168,Math.max(1,Number(process.env.AI_APPROVAL_TIMEOUT_HOURS)||24));
 constructor(@Inject(AiDatabase)private readonly db:AiDatabase,@Inject(ApprovalPayloadCipherService)private readonly cipher:ApprovalPayloadCipherService,@Inject(AiCoreService)private readonly core:AiCoreService){}
 onModuleInit(){this.timer=setInterval(()=>void this.expireDue().catch(()=>{}),60_000);this.timer.unref();void this.expireDue().catch(()=>{});}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 requireConfirmedDispatch():never{throw new ConflictException({code:'WRITE_CONFIRMATION_REQUIRED',message:'写入操作不能直接执行，请先创建审批并由本人确认'});}
 async create(ctx:ToolContext,name:string,parameters:object,preview:WriteToolPreviewDetails,sessionId?:string):Promise<WriteApprovalRequest>{
  const taskId=randomUUID(),approvalId=randomUUID(),expiresAt=new Date(Date.now()+this.timeoutHours*3_600_000),encrypted=this.cipher.encrypt(parameters);
  await this.db.source.transaction(async manager=>{
   await manager.query(`INSERT INTO ai_task_record(id,tenant_id,user_id,session_id,task_type,status,progress,operation_type,approval_status,input,output,rollback_snapshots)
    VALUES($1,$2,$3,$4,$5,'pending_approval',10,$6,'pending',$7::jsonb,'{}','{}')`,[taskId,ctx.tenantId,ctx.userId,sessionId??null,`write:${name}`,preview.action,JSON.stringify({tool:name,preview})]);
   await manager.query(`INSERT INTO ai_write_approval(id,tenant_id,user_id,task_id,tool_name,operation_type,risk_level,status,preview,encrypted_parameters,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8::jsonb,$9::jsonb,$10)`,[approvalId,ctx.tenantId,ctx.userId,taskId,name,preview.action,preview.riskLevel,JSON.stringify(preview),JSON.stringify(encrypted),expiresAt]);
  });
  await this.core.audit(this.core.scopes.forUser(ctx.userId),'write.approval.created',name,approvalId,'success',{taskId,operationType:preview.action,riskLevel:preview.riskLevel,expiresAt:expiresAt.toISOString()});
  return{code:'APPROVAL_REQUIRED',tool:name,operation:'write',message:'预校验通过，任务已挂起，等待人工确认。',approvalId,taskId,status:'pending',expiresAt:expiresAt.toISOString(),preview};
 }
 private map(row:ApprovalRow):WriteApprovalListItem{return{approvalId:row.id,taskId:row.task_id,sessionId:row.session_id,tool:row.tool_name,operationType:row.operation_type,riskLevel:row.risk_level,approvalStatus:row.status,taskStatus:row.task_status,progress:row.progress,title:row.preview.title,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),decidedAt:row.decided_at?new Date(row.decided_at).toISOString():null,executedAt:row.executed_at?new Date(row.executed_at).toISOString():null};}
 private selectSql(extra=''){return `SELECT a.*,t.session_id,t.status AS task_status,t.progress,t.rollback_snapshots,t.output FROM ai_write_approval a JOIN ai_task_record t ON t.id=a.task_id AND t.tenant_id=a.tenant_id AND t.user_id=a.user_id WHERE a.tenant_id=$1 AND a.user_id=$2 ${extra}`;}
 async inspect(ctx:ToolContext,id:string,lock=false):Promise<ApprovalRow>{
  const rows=await this.db.source.manager.query(this.selectSql(`AND a.id=$3 ${lock?'FOR UPDATE OF a,t':''}`),[ctx.tenantId,ctx.userId,id]);if(!rows[0])throw new HttpException({code:'APPROVAL_NOT_FOUND',message:'审批单不存在或无权访问'},404);return rows[0];
 }
 async list(ctx:ToolContext,filters:ListFilters){
  const values:unknown[]=[ctx.tenantId,ctx.userId],where:string[]=[];
  const add=(sql:string,value:unknown)=>{values.push(value);where.push(sql.replace('?',`$${values.length}`));};
  if(filters.status)add('a.status=?',filters.status);if(filters.operationType)add('a.operation_type=?',filters.operationType);if(filters.from)add('a.created_at>=?',filters.from);if(filters.to)add('a.created_at<?::date + interval \'1 day\'',filters.to);
  const clause=where.length?'AND '+where.join(' AND '):'';const count=(await this.db.source.manager.query(`SELECT count(*)::int total FROM ai_write_approval a WHERE a.tenant_id=$1 AND a.user_id=$2 ${clause}`,values))[0].total;
  values.push(filters.limit,filters.page*filters.limit);
  const rows=await this.db.source.manager.query(this.selectSql(`${clause} ORDER BY a.created_at DESC,a.id DESC LIMIT $${values.length-1} OFFSET $${values.length}`),values);
  return{items:rows.map((row:ApprovalRow)=>this.map(row)),total:count,page:filters.page,limit:filters.limit};
 }
 async detail(ctx:ToolContext,id:string):Promise<WriteApprovalDetail>{
  const row=await this.inspect(ctx,id);const output=row.output||{};return{...this.map(row),preview:row.preview,rejectionReason:row.rejection_reason,result:output.result??null,rollbackSnapshots:row.rollback_snapshots||{},executionLog:Array.isArray(output.executionLog)?output.executionLog as WriteApprovalDetail['executionLog']:[]};
 }
 private async patchMessage(approvalId:string,patch:Record<string,unknown>){await this.db.source.manager.query(`UPDATE ai_chat_messages SET content=content||$2::jsonb WHERE type='confirmation' AND source='tool' AND content->>'approvalId'=$1`,[approvalId,JSON.stringify(patch)]);}
 async decide(ctx:ToolContext,id:string,decision:'approved'|'rejected',reason:string|undefined,tool:BaseWriteTool):Promise<WriteApprovalDecisionResult>{
  const claimed=await this.db.source.transaction(async manager=>{
   const rows=await manager.query(this.selectSql('AND a.id=$3 FOR UPDATE OF a,t'),[ctx.tenantId,ctx.userId,id]);const row=rows[0] as ApprovalRow|undefined;
   if(!row)throw new HttpException({code:'APPROVAL_NOT_FOUND',message:'审批单不存在或无权访问'},404);
   if(row.status!=='pending')throw new ConflictException({code:'APPROVAL_CLOSED',message:'该审批单已处理，不能重复操作'});
   if(new Date(row.expires_at).getTime()<=Date.now()){
    await manager.query("UPDATE ai_write_approval SET status='expired',updated_at=now() WHERE id=$1",[id]);
    await manager.query("UPDATE ai_task_record SET status='cancelled',approval_status='expired',updated_at=now(),output=jsonb_build_object('executionLog',jsonb_build_array(jsonb_build_object('time',now(),'status','expired','message','审批已超时'))) WHERE id=$1",[row.task_id]);
    return{row,expired:true};
   }
   if(decision==='rejected'){
    const rejection=(reason?.trim()||'用户拒绝执行').slice(0,500);
    await manager.query("UPDATE ai_write_approval SET status='rejected',rejection_reason=$2,decided_at=now(),updated_at=now() WHERE id=$1",[id,rejection]);
    await manager.query("UPDATE ai_task_record SET status='cancelled',approval_status='rejected',updated_at=now(),output=jsonb_build_object('executionLog',jsonb_build_array(jsonb_build_object('time',now(),'status','rejected','message',$2::text))) WHERE id=$1",[row.task_id,rejection]);
    return{row,rejected:true,rejection};
   }
   await manager.query("UPDATE ai_write_approval SET status='approved',decided_at=now(),updated_at=now() WHERE id=$1",[id]);
   await manager.query("UPDATE ai_task_record SET status='running',approval_status='approved',progress=50,updated_at=now() WHERE id=$1",[row.task_id]);
   return{row,approved:true};
  });
  if('expired'in claimed){
   await this.patchMessage(id,{decision:'rejected',approvalStatus:'expired',error:'审批已超过有效期'});
   await this.core.audit(this.core.scopes.forUser(ctx.userId),'write.approval.expired',claimed.row.tool_name,id,'failure',{taskId:claimed.row.task_id});
   throw new ConflictException({code:'APPROVAL_EXPIRED',message:'该审批单已超过有效期，任务已自动取消'});
  }
  if('rejected'in claimed){
   await this.patchMessage(id,{decision:'rejected',approvalStatus:'rejected'});
   await this.core.audit(this.core.scopes.forUser(ctx.userId),'write.approval.rejected',claimed.row.tool_name,id,'success',{taskId:claimed.row.task_id,reason:claimed.rejection});
   return{code:'WRITE_REJECTED',message:'已驳回操作，任务已取消。',approvalId:id,taskId:claimed.row.task_id,status:'rejected'};
  }
  const row=claimed.row,scoped=Object.freeze(ctx);
  try{
   const parameters=this.cipher.decrypt<object>(row.encrypted_parameters);
   const validated=await tool.validate(scoped,parameters),snapshot=await tool.getSnapshot(scoped,validated);
   await this.db.source.manager.query("UPDATE ai_task_record SET rollback_snapshots=$2::jsonb,updated_at=now() WHERE id=$1",[row.task_id,JSON.stringify(snapshot)]);
   const result=await tool.execute(scoped,validated);
   const storedResult=redact(result) as Record<string,unknown>;
   const log={time:new Date().toISOString(),status:'executed',message:'业务 Service 执行成功'};
   await this.db.source.transaction(async manager=>{
    await manager.query("UPDATE ai_write_approval SET status='executed',executed_at=now(),updated_at=now() WHERE id=$1",[id]);
    await manager.query("UPDATE ai_task_record SET status='completed',approval_status='executed',progress=100,updated_at=now(),output=$2::jsonb WHERE id=$1",[row.task_id,JSON.stringify({result:storedResult,executionLog:[log]})]);
   });
   await this.patchMessage(id,{decision:'approved',approvalStatus:'executed',result:storedResult});
   await this.core.audit(this.core.scopes.forUser(ctx.userId),'write.approval.executed',row.tool_name,id,'success',{taskId:row.task_id,result:storedResult});
   return{code:'WRITE_EXECUTED',message:'人工确认通过，业务操作已执行。',approvalId:id,taskId:row.task_id,status:'executed',result};
  }catch(error){
   const response=error instanceof HttpException?error.getResponse():null;const message=response&&typeof response==='object'&&'message'in response?String(response.message):'执行失败，业务数据未确认修改';
   const log={time:new Date().toISOString(),status:'failed',message};
   await this.db.source.transaction(async manager=>{
    await manager.query("UPDATE ai_write_approval SET status='failed',updated_at=now() WHERE id=$1",[id]);
    await manager.query("UPDATE ai_task_record SET status='failed',approval_status='failed',updated_at=now(),output=$2::jsonb WHERE id=$1",[row.task_id,JSON.stringify({executionLog:[log]})]);
   });
   await this.patchMessage(id,{decision:'approved',approvalStatus:'failed',error:message});
   await this.core.audit(this.core.scopes.forUser(ctx.userId),'write.approval.failed',row.tool_name,id,'failure',{taskId:row.task_id,message});
   throw error;
  }
 }
 async expireDue(){
  if(!this.db.source.isInitialized)return{expired:0};
  const rows=await this.db.source.transaction(async manager=>{
   const due=await manager.query("SELECT id,task_id,tenant_id,user_id,tool_name FROM ai_write_approval WHERE status='pending' AND expires_at<=now() FOR UPDATE SKIP LOCKED");
   if(!due.length)return due;
   await manager.query("UPDATE ai_write_approval SET status='expired',updated_at=now() WHERE id=ANY($1::uuid[])",[due.map((row:{id:string})=>row.id)]);
   await manager.query("UPDATE ai_task_record SET status='cancelled',approval_status='expired',updated_at=now(),output=jsonb_build_object('executionLog',jsonb_build_array(jsonb_build_object('time',now(),'status','expired','message','审批超过有效期，任务自动取消'))) WHERE id=ANY($1::uuid[])",[due.map((row:{task_id:string})=>row.task_id)]);
   await manager.query("UPDATE ai_chat_messages SET content=content||jsonb_build_object('decision','rejected','approvalStatus','expired','error','审批已超过有效期') WHERE type='confirmation' AND source='tool' AND content->>'approvalId'=ANY($1::text[])",[due.map((row:{id:string})=>row.id)]);
   return due;
  });
  for(const row of rows)await this.core.audit({tenantId:row.tenant_id,userId:row.user_id,auditAdmin:false},'write.approval.expired',row.tool_name,row.id,'failure',{taskId:row.task_id,source:'scheduler'}).catch(()=>{});
  return{expired:rows.length};
 }
}
