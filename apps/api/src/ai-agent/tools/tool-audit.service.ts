import { HttpException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ToolContext, ToolExecuteInput, ToolResult } from '@internship/ai-contracts';
import { AiCoreService } from '../application/core.service';
import { AiScopeService } from '../application/ai-scope.service';
const sensitive=/(email|e.?mail|phone|mobile|contact|password|token|secret|authorization|cookie|revenue|income|amount|salary|efficiency|邮箱|邮件|电话|联系|金额|收入|营收|盈利)/i;
function safeText(value:string){return Buffer.from(value,'utf8').toString('utf8').replace(/[\x00-\x1f\x7f]/g,'').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已脱敏]').replace(/(?:\+?\d[\d ()-]{6,}\d)/g,'[号码已脱敏]').replace(/(?:[$￥¥€]\s*\d[\d,.]*|\d[\d,.]*\s*(?:元|万元|亿元))/g,'[金额已脱敏]').slice(0,1000);}
export function redact(value:unknown,key='',depth=0):unknown {
 if(sensitive.test(key))return '[已脱敏]';if(depth>12)return '[超出审计深度]';
 if(typeof value==='string')return safeText(value);if(Array.isArray(value))return value.slice(0,30).map(v=>redact(v,key,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,80).map(([k,v])=>[safeText(k)||'[字段]',redact(v,k,depth+1)]));return value;
}
@Injectable()
export class ToolAuditService {
 constructor(@Inject(AiCoreService)private readonly core:AiCoreService,@Inject(AiScopeService)private readonly scopes:AiScopeService){}
 async record(ctx:ToolContext,input:ToolExecuteInput,result:ToolResult){
  const details={userId:ctx.userId,toolName:safeText(input.name),operation:'read',parameters:redact(input.parameters),executionResult:redact(result),ip:ctx.ip,time:new Date().toISOString(),requestId:result.requestId,durationMs:result.durationMs};
  // Audit parameters are sanitized before persistence. Large results retain only a bounded preview.
  if(Buffer.byteLength(JSON.stringify(details))>32768)details.executionResult={code:result.code,message:safeText(result.message),resultType:result.resultType,data:'[结果过长，省略审计预览]'};
  await this.core.audit(this.scopes.forUser(ctx.userId),'tool.execute',safeText(input.name).slice(0,100),undefined,result.code==='OK'?'success':'failure',details);
 }
 async recordWrite(ctx:ToolContext,name:string,action:'preview'|'execute',parameters:unknown,result:unknown,status:'success'|'failure'){
  const details={userId:ctx.userId,toolName:safeText(name),operation:`write.${action}`,parameters:redact(parameters),executionResult:redact(result),ip:ctx.ip,time:new Date().toISOString()};
  await this.core.audit(this.scopes.forUser(ctx.userId),`tool.write.${action}`,safeText(name).slice(0,100),undefined,status,details);
 }
}
export function AuditedToolExecution():MethodDecorator {
 return (_target,_key,descriptor:PropertyDescriptor)=>{const original=descriptor.value;descriptor.value=async function(this:{audit:ToolAuditService},ctx:ToolContext,input:ToolExecuteInput,...options:unknown[]){const result=await original.call(this,ctx,input,...options) as ToolResult;try{await this.audit.record(ctx,input,result);return result;}catch{return {...result,code:'TOOL_AUDIT_UNAVAILABLE',data:null,resultType:'text',message:'审计记录暂时不可用，本次查询结果未返回，请稍后重试。'};}};};
}
export function AuditedWriteToolOperation(action:'preview'|'execute'):MethodDecorator {
 return (_target,_key,descriptor:PropertyDescriptor)=>{const original=descriptor.value;descriptor.value=async function(this:{audit:ToolAuditService},ctx:ToolContext,name:string,parameters:unknown,...rest:unknown[]){
  try{const result=await original.call(this,ctx,name,parameters,...rest);try{await this.audit.recordWrite(ctx,name,action,parameters,result,'success');}catch{throw new ServiceUnavailableException({code:'WRITE_AUDIT_UNAVAILABLE',message:'审计记录暂时不可用，本次操作已终止'});}return result;
  }catch(error){if(error instanceof ServiceUnavailableException&&typeof error.getResponse()==='object'&&(error.getResponse() as {code?:string}).code==='WRITE_AUDIT_UNAVAILABLE')throw error;const body=error instanceof HttpException?error.getResponse():null;const failure=body&&typeof body==='object'?body:{code:'WRITE_OPERATION_FAILED'};try{await this.audit.recordWrite(ctx,name,action,parameters,failure,'failure');}catch{}throw error;}
 };};
}
