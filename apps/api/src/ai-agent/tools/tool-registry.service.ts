import { AiCacheService } from '../infrastructure/ai-cache.service';
import { HttpException, Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { ToolContext, ToolDescriptor, ToolExecuteInput, ToolIntent, ToolResult } from '@internship/ai-contracts';
import { UserService } from '../../user/user.service';
import { BaseTool, TOOL_DEFINITION, type ToolDefinition } from './base-tool';
import { ToolPolicyService } from './tool-policy.service';
import { ToolSettingsService } from './tool-settings.service';
import { AuditedToolExecution, ToolAuditService } from './tool-audit.service';
@Injectable()
export class ToolRegistryService implements OnModuleInit {
 private readonly tools=new Map<string,{tool:BaseTool;definition:ToolDefinition}>();
 constructor(@Inject(DiscoveryService)private readonly discovery:DiscoveryService,@Inject(ToolPolicyService)readonly policy:ToolPolicyService,@Inject(ToolSettingsService)private readonly settings:ToolSettingsService,@Inject(ToolAuditService)readonly audit:ToolAuditService,@Inject(UserService)private readonly users:UserService,@Optional() @Inject(AiCacheService)private readonly cache?:AiCacheService){}
 onModuleInit(){for(const provider of this.discovery.getProviders()){const tool=provider.instance;const definition=provider.metatype?Reflect.getMetadata(TOOL_DEFINITION,provider.metatype) as ToolDefinition|undefined:undefined;if(tool instanceof BaseTool&&definition){if(this.tools.has(definition.name))throw Error('Duplicate AI tool: '+definition.name);this.tools.set(definition.name,{tool,definition});}}}
 find(name:string){return this.tools.get(name);}
 async list(ctx:ToolContext,intent?:ToolIntent):Promise<{items:ToolDescriptor[]}>{const items=[];for(const [name,{definition}]of this.tools){if(intent&&definition.intent!==intent)continue;items.push({...definition,enabled:await this.settings.enabled(ctx,name),allowed:this.policy.allowed(ctx,definition.permission)});}return {items};}
 async match(ctx:ToolContext,intent:ToolIntent){return this.list(ctx,intent);}
 async configure(ctx:ToolContext,name:string,enabled:boolean){if(!this.find(name))throw new HttpException({code:'TOOL_NOT_FOUND',message:'工具不存在'},404);return this.settings.set(ctx,name,enabled);}
 @AuditedToolExecution()
 async execute(ctx:ToolContext,input:ToolExecuteInput,options?:{domain:string;question:string;revision:string|(()=>Promise<string>)}):Promise<ToolResult>{
  const start=Date.now(),requestId=input.requestId??randomUUID();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   await this.users.findById(ctx.userId);const entry=this.find(input.name);if(!entry)throw new HttpException({code:'TOOL_NOT_FOUND',message:'查询工具不存在，请重新选择'},404);
   this.policy.require(ctx,entry.definition.permission);
   if(!await this.settings.enabled(ctx,input.name))throw new HttpException({code:'TOOL_DISABLED',message:'此查询工具已停用，请联系管理员'},403);
   const params=entry.tool.validate(input.parameters);const actualContext=Object.freeze(this.policy.scopedContext(ctx));
   let cacheHit:boolean|undefined;const run=async()=>{if(this.cache){const selected=options??{domain:input.name==='users.query'?'users':'companies',question:input.name,revision:'registry-v1'};const revision=typeof selected.revision==='function'?await selected.revision():selected.revision;const cached=await this.cache.result({...ctx,auditAdmin:false},selected.domain,selected.question,{name:input.name,parameters:params,revision},()=>entry.tool.run(actualContext,params));cacheHit=cached.cacheHit;return cached.data;}return entry.tool.run(actualContext,params);};
   const output=await Promise.race([run(),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new HttpException({code:'TOOL_TIMEOUT',message:'查询耗时较长，请缩小筛选范围后重试'},504)),30000);})]);
   return {code:'OK',...output,tool:input.name,requestId,durationMs:Date.now()-start,parameters:params as Record<string,unknown>,...(cacheHit===undefined?{}:{cacheHit})};
  }catch(error){const body=error instanceof HttpException?error.getResponse():null;const known=body&&typeof body==='object'?body as {code?:string;message?:string}:null;return {code:known?.code||'TOOL_EXECUTION_FAILED',data:null,message:typeof known?.message==='string'?known.message:'查询暂时不可用，请稍后重试。',resultType:'text',tool:input.name,requestId,durationMs:Date.now()-start};}
  finally{if(timer)clearTimeout(timer);}
 }
}
