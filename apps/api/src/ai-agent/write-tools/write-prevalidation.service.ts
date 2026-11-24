import { Inject, Injectable } from '@nestjs/common';
import type { ToolContext } from '@internship/ai-contracts';
import { validateDto } from '../../shared/validation';
import { ToolPolicyService } from '../tools/tool-policy.service';

@Injectable()
export class WritePrevalidationService {
 constructor(@Inject(ToolPolicyService)private readonly policy:ToolPolicyService){}
 validate<T extends object>(ctx:ToolContext,permission:string,type:new()=>T,input:unknown){
  this.policy.require(ctx,permission);
  return validateDto(type,input);
 }
}
