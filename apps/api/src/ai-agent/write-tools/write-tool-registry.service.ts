import { HttpException, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { ToolContext, WriteToolDescriptor, WriteToolPreview } from '@internship/ai-contracts';
import { UserService } from '../../user/user.service';
import { ToolPolicyService } from '../tools/tool-policy.service';
import { ToolSettingsService } from '../tools/tool-settings.service';
import { AuditedWriteToolOperation, ToolAuditService } from '../tools/tool-audit.service';
import { BaseWriteTool, WRITE_TOOL_DEFINITION, type WriteToolDefinition } from './base-write-tool';
import { WriteExecutionGateService } from './write-execution-gate.service';

@Injectable()
export class WriteToolRegistryService implements OnModuleInit {
 private readonly tools=new Map<string,{tool:BaseWriteTool;definition:WriteToolDefinition}>();
 constructor(@Inject(DiscoveryService)private readonly discovery:DiscoveryService,@Inject(ToolPolicyService)readonly policy:ToolPolicyService,@Inject(ToolSettingsService)private readonly settings:ToolSettingsService,@Inject(WriteExecutionGateService)private readonly gate:WriteExecutionGateService,@Inject(UserService)private readonly users:UserService,@Inject(ToolAuditService)readonly audit:ToolAuditService){}
 onModuleInit(){for(const provider of this.discovery.getProviders()){const tool=provider.instance;const definition=provider.metatype?Reflect.getMetadata(WRITE_TOOL_DEFINITION,provider.metatype) as WriteToolDefinition|undefined:undefined;if(tool instanceof BaseWriteTool&&definition){if(this.tools.has(definition.name))throw Error('Duplicate AI write tool: '+definition.name);this.tools.set(definition.name,{tool,definition});}}}
 private find(name:string){const entry=this.tools.get(name);if(!entry)throw new HttpException({code:'WRITE_TOOL_NOT_FOUND',message:'写入工具不存在'},404);return entry;}
 private async authorized(ctx:ToolContext,name:string){await this.users.findById(ctx.userId);const entry=this.find(name);this.policy.require(ctx,entry.definition.permission);if(!await this.settings.enabled(ctx,name))throw new HttpException({code:'WRITE_TOOL_DISABLED',message:'此写入工具已停用'},403);return{entry,scoped:Object.freeze(this.policy.scopedContext(ctx))};}
 async list(ctx:ToolContext):Promise<{items:WriteToolDescriptor[]}>{const items=[];for(const[name,{definition}]of this.tools)items.push({...definition,enabled:await this.settings.enabled(ctx,name),allowed:this.policy.allowed(ctx,definition.permission)});return{items};}
 @AuditedWriteToolOperation('preview')
 async preview(ctx:ToolContext,name:string,parameters:unknown):Promise<WriteToolPreview>{const start=Date.now(),{entry,scoped}=await this.authorized(ctx,name);const validated=await entry.tool.validate(scoped,parameters);const preview=await entry.tool.getPreview(scoped,validated);return{code:'PREVIEW_READY',tool:name,operation:'write',autoExecute:false,confirmationRequired:true,message:'预校验通过，仅生成预览，未修改业务数据。',preview,durationMs:Date.now()-start};}
 @AuditedWriteToolOperation('preview')
 async request(ctx:ToolContext,name:string,parameters:unknown,sessionId?:string){const{entry,scoped}=await this.authorized(ctx,name);const validated=await entry.tool.validate(scoped,parameters);const preview=await entry.tool.getPreview(scoped,validated);return this.gate.create(scoped,name,validated,preview,sessionId);}
 async approval(ctx:ToolContext,id:string){const scoped=Object.freeze(this.policy.scopedContext(ctx));return this.gate.detail(scoped,id);}
 async approvals(ctx:ToolContext,filters:{status?:string;operationType?:string;from?:string;to?:string;page:number;limit:number}){const scoped=Object.freeze(this.policy.scopedContext(ctx));return this.gate.list(scoped,filters);}
 async decide(ctx:ToolContext,id:string,decision:'approved'|'rejected',reason?:string){const scoped=Object.freeze(this.policy.scopedContext(ctx)),approval=await this.gate.inspect(scoped,id),entry=this.find(approval.tool_name);this.policy.require(scoped,entry.definition.permission);if(!await this.settings.enabled(scoped,approval.tool_name))throw new HttpException({code:'WRITE_TOOL_DISABLED',message:'此写入工具已停用'},403);return this.gate.decide(scoped,id,decision,reason,entry.tool);}
 @AuditedWriteToolOperation('execute')
 async execute(ctx:ToolContext,name:string,parameters:unknown):Promise<never>{const{entry,scoped}=await this.authorized(ctx,name);await entry.tool.validate(scoped,parameters);return this.gate.requireConfirmedDispatch();}
}
