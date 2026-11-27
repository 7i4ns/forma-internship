import { BadRequestException, Injectable } from '@nestjs/common';

const allowed=new Set(['users.create','users.update','users.delete','users.batch-delete','companies.create','companies.update','companies.delete']);

@Injectable()
export class WriteCommandService {
 parse(command:string){
  const match=command.trim().match(/^\/write\s+([a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*)+)\s+(.+)$/s);
  if(!match||!allowed.has(match[1]))throw new BadRequestException({code:'INVALID_WRITE_COMMAND',message:'请使用 /write 写入工具名 {JSON参数}，例如 /write companies.create {"name":"示例公司","level":"1","country":"中国"}'});
  let parameters:unknown;try{parameters=JSON.parse(match[2]);}catch{throw new BadRequestException({code:'INVALID_WRITE_COMMAND',message:'写入参数必须是有效 JSON 对象'});}
  if(!parameters||typeof parameters!=='object'||Array.isArray(parameters))throw new BadRequestException({code:'INVALID_WRITE_COMMAND',message:'写入参数必须是 JSON 对象'});
  return{name:match[1],parameters:parameters as Record<string,unknown>};
 }
}
