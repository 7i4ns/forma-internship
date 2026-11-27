import { Inject, Injectable } from '@nestjs/common';
import type { ToolContext } from '@internship/ai-contracts';
import { CompanyService } from '../../company/company.service';
import { BaseWriteTool, RegisteredWriteTool, type WriteRollbackResult } from './base-write-tool';
import { WritePrevalidationService } from './write-prevalidation.service';
import { WritePreviewService } from './write-preview.service';
import { CompanyCreateToolDto, CompanyDeleteToolDto, CompanyUpdateToolDto } from './write-tool.dto';

const rollback=async():Promise<WriteRollbackResult>=>({code:'ROLLBACK_NOT_IMPLEMENTED',message:'执行前快照已保存，自动回滚能力将在后续版本启用'});

@Injectable() @RegisteredWriteTool({name:'companies.create',label:'新增公司',intent:'MUTATE_DATA',permission:'companies:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class CompanyCreateTool extends BaseWriteTool<CompanyCreateToolDto>{
 readonly parameterType=CompanyCreateToolDto;
 constructor(@Inject(CompanyService)private companies:CompanyService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'companies:write',this.parameterType,input);await this.companies.validateCreate(p);return p;}
 async getPreview(_ctx:ToolContext,p:CompanyCreateToolDto){return this.previews.create('company','新增公司预览',p as unknown as Record<string,unknown>);}
 async getSnapshot(_ctx:ToolContext,p:CompanyCreateToolDto){return{operation:'create',parameters:{...p}};}
 async execute(_ctx:ToolContext,p:CompanyCreateToolDto){return this.companies.create(p);}
 rollback=rollback;
}

@Injectable() @RegisteredWriteTool({name:'companies.update',label:'编辑公司',intent:'MUTATE_DATA',permission:'companies:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class CompanyUpdateTool extends BaseWriteTool<CompanyUpdateToolDto>{
 readonly parameterType=CompanyUpdateToolDto;
 constructor(@Inject(CompanyService)private companies:CompanyService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'companies:write',this.parameterType,input);const{id,...changes}=p;await this.companies.validateUpdate(id,changes);return p;}
 async getPreview(_ctx:ToolContext,p:CompanyUpdateToolDto){const{id,...changes}=p;return this.previews.update('company','编辑公司预览',await this.companies.get(id) as Record<string,unknown>,changes as Record<string,unknown>);}
 async getSnapshot(_ctx:ToolContext,p:CompanyUpdateToolDto){return{operation:'update',records:[await this.companies.get(p.id)]};}
 async execute(_ctx:ToolContext,p:CompanyUpdateToolDto){const{id,...changes}=p;return this.companies.update(id,changes);}
 rollback=rollback;
}

@Injectable() @RegisteredWriteTool({name:'companies.delete',label:'删除公司',intent:'MUTATE_DATA',permission:'companies:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class CompanyDeleteTool extends BaseWriteTool<CompanyDeleteToolDto>{
 readonly parameterType=CompanyDeleteToolDto;
 constructor(@Inject(CompanyService)private companies:CompanyService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService,@Inject(WritePreviewService)private previews:WritePreviewService){super();}
 async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'companies:write',this.parameterType,input);await this.companies.validateRemove(p.id);return p;}
 async getPreview(_ctx:ToolContext,p:CompanyDeleteToolDto){return this.previews.delete('company','删除公司预览',await this.companies.get(p.id) as Record<string,unknown>);}
 async getSnapshot(_ctx:ToolContext,p:CompanyDeleteToolDto){return{operation:'delete',records:[await this.companies.get(p.id)]};}
 async execute(_ctx:ToolContext,p:CompanyDeleteToolDto){return this.companies.remove(p.id);}
 rollback=rollback;
}
