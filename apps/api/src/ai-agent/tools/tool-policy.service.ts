import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { ToolContext } from '@internship/ai-contracts';
import { AiScopeService } from '../application/ai-scope.service';
@Injectable()
export class ToolPolicyService {
 constructor(@Inject(AiScopeService)private readonly scopes:AiScopeService){}
 context(userId:string,ip='unknown'):ToolContext {return {userId,tenantId:this.scopes.forUser(userId).tenantId,ip:ip.slice(0,100)};}
 private grants(userId:string):string[]{try{const map=JSON.parse(process.env.AI_TOOL_PERMISSIONS||'{}');if(!map||typeof map!=='object'||Array.isArray(map))throw Error();const values=Object.hasOwn(map,userId)?map[userId]:[];if(!Array.isArray(values)||values.some(x=>typeof x!=='string'))throw Error();return values;}catch{throw new ForbiddenException({code:'TOOL_POLICY_INVALID',message:'工具权限配置无效，请联系管理员'});}}
 allowed(ctx:ToolContext,permission:string){
  const actual=this.scopes.forUser(ctx.userId);if(actual.tenantId!==ctx.tenantId)return false;
  const grants=this.grants(ctx.userId);if(grants.includes('!'+permission))return false;
  if(permission==='users:read')return true;
  if(permission==='companies:read'||permission==='dashboard:read')return !!process.env.AI_BUSINESS_TENANT_ID&&ctx.tenantId===process.env.AI_BUSINESS_TENANT_ID;
  return grants.includes(permission);
 }
 require(ctx:ToolContext,permission:string){if(!this.allowed(ctx,permission))throw new ForbiddenException({code:'TOOL_FORBIDDEN',message:'你没有执行该业务查询的权限，或该数据集不属于当前租户'});}
 visibleUsers(ctx:ToolContext){
  if(!this.allowed(ctx,'users:read:tenant'))return [ctx.userId];
  // Membership is trusted server config, never a tool parameter or job-title role.
  const members=JSON.parse(process.env.AI_TENANT_MEMBERSHIPS||'{}');return [...new Set([ctx.userId,...Object.keys(members).filter(id=>this.scopes.forUser(id).tenantId===ctx.tenantId)])];
 }
 scopedContext(ctx:ToolContext):ToolContext{return {...ctx,visibleUserIds:this.visibleUsers(ctx)} as ToolContext;}
}
