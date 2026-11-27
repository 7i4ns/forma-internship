import { Inject, Injectable } from '@nestjs/common';
import type { ToolContext, WriteToolPreviewDetails } from '@internship/ai-contracts';
import { UserService } from '../../user/user.service';
import { BaseWriteTool, RegisteredWriteTool, type WriteRollbackResult } from './base-write-tool';
import { WritePrevalidationService } from './write-prevalidation.service';
import { WritePreviewService } from './write-preview.service';
import { UserBatchDeleteToolDto, UserCreateToolDto, UserDeleteToolDto, UserUpdateToolDto } from './write-tool.dto';

const rollback=async():Promise<WriteRollbackResult>=>({code:'ROLLBACK_NOT_IMPLEMENTED',message:'执行前快照已保存，自动回滚能力将在后续版本启用'});
const safeUser=(value:Record<string,unknown>)=>Object.fromEntries(Object.entries(value).filter(([key])=>key!=='password'));

@Injectable() @RegisteredWriteTool({name:'users.create',label:'新增用户',intent:'MUTATE_DATA',permission:'users:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class UserCreateTool extends BaseWriteTool<UserCreateToolDto>{
 readonly parameterType=UserCreateToolDto;
 constructor(@Inject(UserService)private users:UserService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'users:write',this.parameterType,input);await this.users.validateAgentCreate(p);return p;}
 async getPreview(_ctx:ToolContext,p:UserCreateToolDto):Promise<WriteToolPreviewDetails>{return this.previews.create('user','新增用户预览',safeUser(p as unknown as Record<string,unknown>));}
 async getSnapshot(_ctx:ToolContext,p:UserCreateToolDto){return{operation:'create',parameters:safeUser(p as unknown as Record<string,unknown>)};}
 async execute(_ctx:ToolContext,p:UserCreateToolDto){return this.users.createAgentUser(p);}
 rollback=rollback;
}

@Injectable() @RegisteredWriteTool({name:'users.update',label:'编辑用户',intent:'MUTATE_DATA',permission:'users:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class UserUpdateTool extends BaseWriteTool<UserUpdateToolDto>{
 readonly parameterType=UserUpdateToolDto;
 constructor(@Inject(UserService)private users:UserService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'users:write',this.parameterType,input);const{id,...changes}=p;await this.users.validateAgentUpdate(id,changes,ctx.userId);return p;}
 async getPreview(_ctx:ToolContext,p:UserUpdateToolDto){const{id,...changes}=p;const before=await this.users.getAgentUser(id);return this.previews.update('user','编辑用户预览',before as unknown as Record<string,unknown>,safeUser(changes as Record<string,unknown>));}
 async getSnapshot(_ctx:ToolContext,p:UserUpdateToolDto){return{operation:'update',records:[await this.users.getAgentUser(p.id)]};}
 async execute(ctx:ToolContext,p:UserUpdateToolDto){const{id,...changes}=p;return this.users.updateAgentUser(id,changes,ctx.userId);}
 rollback=rollback;
}

@Injectable() @RegisteredWriteTool({name:'users.delete',label:'删除用户',intent:'MUTATE_DATA',permission:'users:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class UserDeleteTool extends BaseWriteTool<UserDeleteToolDto>{
 readonly parameterType=UserDeleteToolDto;
 constructor(@Inject(UserService)private users:UserService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'users:write',this.parameterType,input);await this.users.validateAgentDelete([p.id],ctx.userId);return p;}
 async getPreview(_ctx:ToolContext,p:UserDeleteToolDto){return this.previews.delete('user','删除用户预览',await this.users.getAgentUser(p.id) as unknown as Record<string,unknown>);}
 async getSnapshot(_ctx:ToolContext,p:UserDeleteToolDto){return{operation:'delete',records:[await this.users.getAgentUser(p.id)]};}
 async execute(ctx:ToolContext,p:UserDeleteToolDto){return this.users.removeAgentUsers([p.id],ctx.userId);}
 rollback=rollback;
}

@Injectable() @RegisteredWriteTool({name:'users.batch-delete',label:'批量删除用户',intent:'MUTATE_DATA',permission:'users:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class UserBatchDeleteTool extends BaseWriteTool<UserBatchDeleteToolDto>{
 readonly parameterType=UserBatchDeleteToolDto;
 constructor(@Inject(UserService)private users:UserService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'users:write',this.parameterType,input);await this.users.validateAgentDelete(p.ids,ctx.userId);return{...p,ids:[...new Set(p.ids)]};}
 private async records(ids:string[]){return Promise.all(ids.map(id=>this.users.getAgentUser(id)));}
 async getPreview(_ctx:ToolContext,p:UserBatchDeleteToolDto){return this.previews.batchDelete('user','批量删除用户预览',await this.records(p.ids) as unknown as Record<string,unknown>[]);}
 async getSnapshot(_ctx:ToolContext,p:UserBatchDeleteToolDto){return{operation:'batch-delete',records:await this.records(p.ids)};}
 async execute(ctx:ToolContext,p:UserBatchDeleteToolDto){return this.users.removeAgentUsers(p.ids,ctx.userId);}
 rollback=rollback;
}
