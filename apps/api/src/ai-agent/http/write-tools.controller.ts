import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type SessionRequest } from '../../user/session.guard';
import { dtoPipe } from '../../shared/validation';
import { WriteToolRegistryService } from '../write-tools/write-tool-registry.service';
import { CompanyCreateToolDto, CompanyDeleteToolDto, CompanyUpdateToolDto, UserBatchDeleteToolDto, UserCreateToolDto, UserDeleteToolDto, UserUpdateToolDto, WriteApprovalDecisionDto, WriteApprovalListDto, WriteApprovalRequestDto, WriteCommandDto, WriteToolRequestDto } from '../write-tools/write-tool.dto';
import { WriteCommandService } from '../write-tools/write-command.service';
import { ChatService } from '../application/chat.service';

@ApiTags('AI Write Tools') @ApiExtraModels(UserCreateToolDto,UserUpdateToolDto,UserDeleteToolDto,UserBatchDeleteToolDto,CompanyCreateToolDto,CompanyUpdateToolDto,CompanyDeleteToolDto) @ApiCookieAuth('session') @UseGuards(SessionGuard) @Controller('ai-agent/write-tools')
export class WriteToolsController {
 constructor(@Inject(WriteToolRegistryService)private readonly registry:WriteToolRegistryService,@Inject(WriteCommandService)private readonly commands:WriteCommandService,@Inject(ChatService)private readonly chat:ChatService){}
 @Get() @ApiOperation({summary:'列出7个写入工具骨架及默认拦截状态'}) list(@Req()r:SessionRequest){return this.registry.list(this.registryContext(r));}
 @Get('approvals') @ApiOperation({summary:'分页查询本人写入审批任务，支持状态、操作类型和时间范围筛选'}) approvals(@Req()r:SessionRequest,@Query(dtoPipe(WriteApprovalListDto))q:WriteApprovalListDto){return this.registry.approvals(this.registryContext(r),q);}
 @Get('approvals/:id') @ApiOperation({summary:'读取本人审批详情、预览、快照与执行日志'}) approval(@Req()r:SessionRequest,@Param('id',new ParseUUIDPipe({version:'4'}))id:string){return this.registry.approval(this.registryContext(r),id);}
 @Post('approvals/:id/decision') @HttpCode(200) @ApiBody({type:WriteApprovalDecisionDto}) @ApiOperation({summary:'人工通过或驳回审批；通过后调用业务 Service 执行'}) decide(@Req()r:SessionRequest,@Param('id',new ParseUUIDPipe({version:'4'}))id:string,@Body(dtoPipe(WriteApprovalDecisionDto))b:WriteApprovalDecisionDto){return this.registry.decide(this.registryContext(r),id,b.decision,b.reason);}
 @Post('command') @HttpCode(200) @ApiBody({type:WriteCommandDto}) @ApiOperation({summary:'在聊天中使用 /write 指令创建写入预览、审批单并挂起任务'}) async command(@Req()r:SessionRequest,@Body(dtoPipe(WriteCommandDto))b:WriteCommandDto){if(await this.chat.requestExists(r.userId,b.sessionId,b.requestId))return this.chat.get(r.userId,b.sessionId);const parsed=this.commands.parse(b.command),approval=await this.registry.request(this.registryContext(r),parsed.name,parsed.parameters,b.sessionId);return this.chat.appendWriteApproval(r.userId,b.sessionId,b.requestId,b.command,approval);}
 @Post(':name/preview') @HttpCode(200) @ApiBody({type:WriteToolRequestDto}) @ApiOperation({summary:'执行DTO、权限和业务规则预校验，仅返回预览'}) preview(@Req()r:SessionRequest,@Param('name')name:string,@Body(dtoPipe(WriteToolRequestDto))b:WriteToolRequestDto){return this.registry.preview(this.registryContext(r),name,b.parameters);}
 @Post(':name/request') @HttpCode(200) @ApiBody({type:WriteApprovalRequestDto}) @ApiOperation({summary:'预校验、生成标准预览、创建审批单并挂起任务'}) request(@Req()r:SessionRequest,@Param('name')name:string,@Body(dtoPipe(WriteApprovalRequestDto))b:WriteApprovalRequestDto){return this.registry.request(this.registryContext(r),name,b.parameters,b.sessionId);}
 @Post(':name/execute') @HttpCode(200) @ApiBody({type:WriteToolRequestDto}) @ApiOperation({summary:'写入拦截验证端点；本阶段总是拒绝自动执行'}) execute(@Req()r:SessionRequest,@Param('name')name:string,@Body(dtoPipe(WriteToolRequestDto))b:WriteToolRequestDto){return this.registry.execute(this.registryContext(r),name,b.parameters);}
 private registryContext(r:SessionRequest){return this.registry.policy.context(r.userId,r.ip);}
}
