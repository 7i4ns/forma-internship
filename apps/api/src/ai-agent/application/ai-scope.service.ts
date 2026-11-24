import { Injectable, ForbiddenException } from '@nestjs/common';
export type AiScope={userId:string;tenantId:string;auditAdmin:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
@Injectable()
export class AiScopeService {
 /** Server-owned membership only. Never trust job-title role, headers or request-body tenant IDs. */
 forUser(userId:string):AiScope {
  let map:Record<string,{tenantId:string;auditAdmin?:boolean}>;
  try{map=JSON.parse(process.env.AI_TENANT_MEMBERSHIPS||'{}');if(!map||Array.isArray(map)||typeof map!=='object')throw Error();for(const [id,m]of Object.entries(map))if(!uuid.test(id)||!m||!uuid.test(m.tenantId)||('auditAdmin'in m&&typeof m.auditAdmin!=='boolean'))throw Error();}
  catch{throw new ForbiddenException({code:'AI_SCOPE_CONFIG_INVALID',message:'AI租户权限配置无效，请联系管理员'});}
  const member=Object.hasOwn(map,userId)?map[userId]:undefined;
  return {userId,tenantId:member?.tenantId||userId,auditAdmin:member?.auditAdmin===true};
 }
 requireUserFilter(scope:AiScope,userId?:string,audit=false){if(userId&&userId!==scope.userId&&!(audit&&scope.auditAdmin))throw new ForbiddenException({code:'AI_FORBIDDEN',message:'不能筛选其他用户的数据'});}
}
