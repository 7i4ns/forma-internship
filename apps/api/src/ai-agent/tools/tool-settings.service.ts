import { Inject, Injectable } from '@nestjs/common';
import type { ToolContext } from '@internship/ai-contracts';
import { AiDatabase } from '../infrastructure/ai-database';
import { AiToolSettingsEntity } from '../domain/ai-tool-settings.entity';
import { ToolPolicyService } from './tool-policy.service';
import { AiCoreService } from '../application/core.service';
import { AiScopeService } from '../application/ai-scope.service';
@Injectable()
export class ToolSettingsService {
 constructor(@Inject(AiDatabase)private readonly db:AiDatabase,@Inject(ToolPolicyService)private readonly policy:ToolPolicyService,@Inject(AiCoreService)private readonly core:AiCoreService,@Inject(AiScopeService)private readonly scopes:AiScopeService){}
 async enabled(ctx:ToolContext,name:string){const disabled=(process.env.AI_DISABLED_TOOLS||'').split(',').map(x=>x.trim());if(disabled.includes(name))return false;const row=await this.db.source.getRepository(AiToolSettingsEntity).findOneBy({tenant_id:ctx.tenantId,tool_name:name});return row?.enabled??true;}
 async set(ctx:ToolContext,name:string,enabled:boolean){this.policy.require(ctx,'ai:tools:configure');return this.db.source.transaction(async m=>{await m.getRepository(AiToolSettingsEntity).upsert({tenant_id:ctx.tenantId,tool_name:name,enabled,updated_by:ctx.userId},{conflictPaths:['tenant_id','tool_name']});await this.core.audit(this.scopes.forUser(ctx.userId),'tools.configure',name,undefined,'success',{enabled,ip:ctx.ip},m);return {name,enabled};});}
}
