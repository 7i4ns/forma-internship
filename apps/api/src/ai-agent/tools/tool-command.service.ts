import { BadRequestException, Injectable } from '@nestjs/common';
import type { ToolExecuteInput } from '@internship/ai-contracts';

const allowed=new Set(['users.query','companies.query','dashboard.metrics','companies.analysis']);
@Injectable()
export class ToolCommandService {
 parse(command:string,sessionId:string,requestId:string):ToolExecuteInput {
  const match=command.trim().match(/^\/tool\s+([a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+)\s*(.*)$/s);
  if(!match||!allowed.has(match[1]))throw new BadRequestException({code:'INVALID_TOOL_COMMAND',message:'请使用 /tool 工具名 {JSON条件}，例如 /tool companies.query {"search":"China"}'});
  let parameters:unknown={};
  if(match[2])try{parameters=JSON.parse(match[2]);}catch{throw new BadRequestException({code:'INVALID_TOOL_COMMAND',message:'工具条件必须是有效 JSON 对象'});}
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw new BadRequestException({code:'INVALID_TOOL_COMMAND',message:'工具条件必须是 JSON 对象'});
  return{name:match[1],parameters:parameters as Record<string,unknown>,sessionId,requestId};
 }
}
