import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { ToolContext, WriteToolPreviewDetails } from '@internship/ai-contracts';
import { CompanyService } from '../../company/company.service';
import { BaseWriteTool, RegisteredWriteTool, type WriteRollbackResult } from './base-write-tool';
import { WritePrevalidationService } from './write-prevalidation.service';
import { CompanyCreateToolDto, CompanyDeleteToolDto, CompanyUpdateToolDto } from './write-tool.dto';

const blocked=():never=>{throw new ConflictException({code:'WRITE_EXECUTION_BLOCKED',message:'写入工具已完成校验与预览，本阶段默认禁止自动执行'});};
const rollback=async():Promise<WriteRollbackResult>=>({code:'ROLLBACK_NOT_IMPLEMENTED',message:'回滚接口已预留，本阶段不执行任何写操作'});

@Injectable() @RegisteredWriteTool({name:'companies.create',label:'新增公司',intent:'MUTATE_DATA',permission:'companies:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class CompanyCreateTool extends BaseWriteTool<CompanyCreateToolDto>{readonly parameterType=CompanyCreateToolDto;constructor(@Inject(CompanyService)private companies:CompanyService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService){super();}async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'companies:write',this.parameterType,input);await this.companies.validateCreate(p);return p;}async getPreview(_ctx:ToolContext,p:CompanyCreateToolDto):Promise<WriteToolPreviewDetails>{return{title:'新增公司预览',action:'create',summary:`将新增公司 ${p.name}。`,fields:{...p}};}async execute(){return blocked();}rollback=rollback;}

@Injectable() @RegisteredWriteTool({name:'companies.update',label:'编辑公司',intent:'MUTATE_DATA',permission:'companies:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class CompanyUpdateTool extends BaseWriteTool<CompanyUpdateToolDto>{readonly parameterType=CompanyUpdateToolDto;constructor(@Inject(CompanyService)private companies:CompanyService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService){super();}async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'companies:write',this.parameterType,input);const{id,...changes}=p;await this.companies.validateUpdate(id,changes);return p;}async getPreview(_ctx:ToolContext,p:CompanyUpdateToolDto):Promise<WriteToolPreviewDetails>{const{id,...changes}=p;const company=await this.companies.get(id);return{title:'编辑公司预览',action:'update',summary:`将修改公司 ${company.name}。`,fields:{id,...changes}};}async execute(){return blocked();}rollback=rollback;}

@Injectable() @RegisteredWriteTool({name:'companies.delete',label:'删除公司',intent:'MUTATE_DATA',permission:'companies:write',operation:'write',autoExecute:false,confirmationRequired:true})
export class CompanyDeleteTool extends BaseWriteTool<CompanyDeleteToolDto>{readonly parameterType=CompanyDeleteToolDto;constructor(@Inject(CompanyService)private companies:CompanyService,@Inject(WritePrevalidationService)private preflight:WritePrevalidationService){super();}async validate(ctx:ToolContext,input:unknown){const p=this.preflight.validate(ctx,'companies:write',this.parameterType,input);await this.companies.validateRemove(p.id);return p;}async getPreview(_ctx:ToolContext,p:CompanyDeleteToolDto):Promise<WriteToolPreviewDetails>{const company=await this.companies.get(p.id);return{title:'删除公司预览',action:'delete',summary:`将删除公司 ${company.name}，当前尚未执行。`,fields:{id:p.id,name:company.name,level:company.level,country:company.country}};}async execute(){return blocked();}rollback=rollback;}
