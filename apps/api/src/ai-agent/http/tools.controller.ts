import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type SessionRequest } from '../../user/session.guard';
import { dtoPipe } from '../../shared/validation';
import { AiBusinessToolsService } from '../application/business-tools.service';
import { AiScopeService } from '../application/ai-scope.service';
import { AiToolQueryDto } from './core.dto';
@ApiTags('AI Tools') @ApiCookieAuth('session') @UseGuards(SessionGuard) @Controller('ai-agent/tools')
export class AiToolsController {
 constructor(@Inject(AiBusinessToolsService)private readonly tools:AiBusinessToolsService,@Inject(AiScopeService)private readonly scopes:AiScopeService){}
 @Post('query') @HttpCode(200) @ApiBody({type:AiToolQueryDto})
 @ApiOperation({summary:'白名单调用现有Dashboard Service，按用户缓存查询结果',description:'显式选择工具；不执行自由SQL、写操作、自动意图识别或编排。现有公司数据集必须由服务端AI_BUSINESS_TENANT_ID绑定到单个租户。'})
 query(@Req()r:SessionRequest,@Body(dtoPipe(AiToolQueryDto))input:AiToolQueryDto){return this.tools.query(this.scopes.forUser(r.userId),input,r.ip);}
}
