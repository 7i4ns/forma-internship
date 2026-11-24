import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BadRequestException, SetMetadata } from '@nestjs/common';
import type { ToolContext, ToolDescriptor, ToolResult } from '@internship/ai-contracts';
export const TOOL_DEFINITION=Symbol('AI_TOOL_DEFINITION');
export type ToolDefinition=Omit<ToolDescriptor,'enabled'|'allowed'>;
export const RegisteredTool=(definition:ToolDefinition)=>SetMetadata(TOOL_DEFINITION,Object.freeze(definition));
export type ToolOutput=Pick<ToolResult,'data'|'message'|'resultType'>;
/** Concrete tools may inject business Services only, never Repository/Pool/SQL. */
export abstract class BaseTool<P extends object=object> {
 abstract readonly parameterType:new()=>P;
 validate(input:unknown):P {
  if(!input||typeof input!=='object'||Array.isArray(input)||Buffer.byteLength(JSON.stringify(input))>16384)throw new BadRequestException({code:'INVALID_TOOL_INPUT',message:'工具参数必须为对象，且不超过16KB'});
  const params=plainToInstance(this.parameterType,input);const errors=validateSync(params,{whitelist:true,forbidNonWhitelisted:true,forbidUnknownValues:true});
  const labels:Record<string,string>={search:'搜索关键词',roles:'职位筛选',status:'用户状态',page:'页码',limit:'每页条数（1–100）',sortBy:'排序字段',sortDirection:'排序顺序',levels:'公司等级',country:'国家',city:'城市',filter:'筛选条件',dimension:'聚合维度'};
  if(errors.length)throw new BadRequestException({code:'INVALID_TOOL_INPUT',message:'请检查查询条件：'+errors.map(e=>labels[e.property]||'不支持的字段').join('、')});return params;
 }
 abstract run(context:Readonly<ToolContext>,parameters:P):Promise<ToolOutput>;
}
