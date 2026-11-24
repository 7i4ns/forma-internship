import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
@Catch()
export class ToolErrorsFilter implements ExceptionFilter {
 catch(error:unknown,host:ArgumentsHost){const response=host.switchToHttp().getResponse<Response>();const status=error instanceof HttpException?error.getStatus():500;const body=error instanceof HttpException?error.getResponse():null;const detail=body&&typeof body==='object'?body as {code?:string;message?:string}:null;response.status(status).json({code:status>=500?'TOOL_UNAVAILABLE':detail?.code||'INVALID_TOOL_REQUEST',data:null,message:status>=500?'工具服务暂时不可用，请稍后重试。':typeof detail?.message==='string'?detail.message:'请求格式无效，请检查查询条件。',resultType:'text',tool:'',requestId:randomUUID()});}
}
