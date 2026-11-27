import { SetMetadata } from '@nestjs/common';
import type { ToolContext, WriteToolDescriptor, WriteToolPreviewDetails } from '@internship/ai-contracts';

export const WRITE_TOOL_DEFINITION=Symbol('AI_WRITE_TOOL_DEFINITION');
export type WriteToolDefinition=Omit<WriteToolDescriptor,'enabled'|'allowed'>;
export const RegisteredWriteTool=(definition:WriteToolDefinition)=>SetMetadata(WRITE_TOOL_DEFINITION,Object.freeze(definition));
export type WriteRollbackResult={code:'ROLLBACK_NOT_IMPLEMENTED';message:string};

/** Write tools are physically separated from read tools and never run through BaseTool. */
export abstract class BaseWriteTool<P extends object=object> {
 abstract readonly parameterType:new()=>P;
 abstract validate(context:Readonly<ToolContext>,input:unknown):Promise<P>;
 abstract getPreview(context:Readonly<ToolContext>,parameters:P):Promise<WriteToolPreviewDetails>;
 abstract getSnapshot(context:Readonly<ToolContext>,parameters:P):Promise<Record<string,unknown>>;
 abstract execute(context:Readonly<ToolContext>,parameters:P):Promise<unknown>;
 abstract rollback(context:Readonly<ToolContext>,parameters:P):Promise<WriteRollbackResult>;
}
