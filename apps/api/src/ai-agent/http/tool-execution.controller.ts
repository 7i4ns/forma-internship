import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Req, UseFilters, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type SessionRequest } from '../../user/session.guard';
import { dtoPipe } from '../../shared/validation';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { ChatService } from '../application/chat.service';
import { ExecuteToolDto, MatchToolDto, ConfigureToolDto, ToolCommandDto } from './tool-execution.dto';
import { ToolErrorsFilter } from './tool-errors.filter';
import { ToolCommandService } from '../tools/tool-command.service';
@ApiTags('AI Read Tools') @ApiCookieAuth('session') @UseGuards(SessionGuard) @UseFilters(ToolErrorsFilter)
@Controller('ai-agent/tools')
export class ToolExecutionController {
 constructor(@Inject(ToolRegistryService)private readonly registry:ToolRegistryService,@Inject(ChatService)private readonly chat:ChatService,@Inject(ToolCommandService)private readonly commands:ToolCommandService){}
 @Get() @ApiOperation({summary:'列出自动注册的工具、意图及当前用户可用状态'}) list(@Req()r:SessionRequest){return this.registry.list(this.registry.policy.context(r.userId,r.ip));}
 @Post('match') @HttpCode(200) @ApiBody({type:MatchToolDto}) @ApiOperation({summary:'按意图查找工具；不自动猜测多个候选工具'}) match(@Req()r:SessionRequest,@Body(dtoPipe(MatchToolDto))b:MatchToolDto){return this.registry.match(this.registry.policy.context(r.userId,r.ip),b.intent);}
 @Patch(':name/config') @ApiBody({type:ConfigureToolDto}) @ApiOperation({summary:'动态启停本租户工具，需要 ai:tools:configure 独立授权'}) configure(@Req()r:SessionRequest,@Param('name')name:string,@Body(dtoPipe(ConfigureToolDto))b:ConfigureToolDto){return this.registry.configure(this.registry.policy.context(r.userId,r.ip),name,b.enabled);}
 @Post('execute') @HttpCode(200) @ApiBody({type:ExecuteToolDto}) @ApiOperation({summary:'鉴权、校验、执行只读工具并自动审计；可持久化为聊天消息',description:'工具业务错误返回统一code/data/message/resultType，code=OK表示成功。sessionId须为本人会话，且必须附带requestId。用户、租户和IP只从受信请求构造。'})
 execute(@Req()r:SessionRequest,@Body(dtoPipe(ExecuteToolDto))b:ExecuteToolDto){const ctx=this.registry.policy.context(r.userId,r.ip);if(b.sessionId){if(!b.requestId)throw new BadRequestException({code:'REQUEST_ID_REQUIRED',message:'会话工具调用必须提供requestId'});return this.chat.runTool(r.userId,b.sessionId,b,()=>this.registry.execute(ctx,b));}return this.registry.execute(ctx,b);}
 @Post('command') @HttpCode(200) @ApiBody({type:ToolCommandDto}) @ApiOperation({summary:'在聊天中使用明确 /tool 指令调用只读工具',description:'仅解析白名单工具和JSON参数；不将普通自然语言自动执行为业务操作。'})
 command(@Req()r:SessionRequest,@Body(dtoPipe(ToolCommandDto))b:ToolCommandDto){const input=this.commands.parse(b.command,b.sessionId,b.requestId),ctx=this.registry.policy.context(r.userId,r.ip);return this.chat.runTool(r.userId,b.sessionId,input,()=>this.registry.execute(ctx,input));}
}
