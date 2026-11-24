import { ToolRegistryService } from '../tools/tool-registry.service';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DashboardService } from '../../dashboard/dashboard.service';
import { parseCompanyFilter } from '../../dashboard/company-filter';
import { AiCoreService } from './core.service';
import { RedisTaskCheckpointer } from '../infrastructure/redis-checkpointer';
import type { AiScope } from './ai-scope.service';
import type { AiToolQueryDto } from '../http/core.dto';
@Injectable()
export class AiBusinessToolsService {
 constructor(@Inject(DashboardService)private readonly dashboard:DashboardService,@Inject(AiCoreService)private readonly core:AiCoreService,@Inject(ToolRegistryService)private readonly registry:ToolRegistryService){}
 async query(s:AiScope,input:AiToolQueryDto,ip='unknown'){
  const name=input.tool==='dashboard.summary'?'dashboard.metrics':'companies.analysis';
  const parameters=input.tool==='companies.filter'?parseCompanyFilter(input.parameters??{}):input.parameters??{};
  const result=await this.registry.execute({userId:s.userId,tenantId:s.tenantId,ip},{name,parameters},{domain:'companies',question:input.question,revision:()=>this.dashboard.revision()});
  if(result.code!=='OK')throw new HttpException({code:result.code,message:result.message},result.code==='TOOL_FORBIDDEN'||result.code==='TOOL_DISABLED'?403:result.code==='INVALID_TOOL_INPUT'||result.code==='INVALID_FILTER'?400:503);
  if(result.data?.kind==='dashboard'){const {kind,title,...data}=result.data;return {data,cacheHit:result.cacheHit??false,tool:input.tool,source:'existing-service'};}
  if(result.data?.kind==='bar'){const {kind,title,pagination,...data}=result.data;return {data,cacheHit:result.cacheHit??false,tool:input.tool,source:'existing-service'};}
  throw new HttpException({code:'INVALID_TOOL_RESULT',message:'业务查询暂不可用'},503);
 }
 checkpointer(s:AiScope,taskId:string,ttl=7200){return new RedisTaskCheckpointer(this.core.cache,s,taskId,()=>this.core.find('tasks',s,taskId),ttl);}
}
