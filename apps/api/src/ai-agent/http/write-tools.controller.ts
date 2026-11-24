import { Body, Controller, Get, HttpCode, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type SessionRequest } from '../../user/session.guard';
import { dtoPipe } from '../../shared/validation';
import { WriteToolRegistryService } from '../write-tools/write-tool-registry.service';
import { CompanyCreateToolDto, CompanyDeleteToolDto, CompanyUpdateToolDto, UserBatchDeleteToolDto, UserCreateToolDto, UserDeleteToolDto, UserUpdateToolDto, WriteToolRequestDto } from '../write-tools/write-tool.dto';

@ApiTags('AI Write Tools') @ApiExtraModels(UserCreateToolDto,UserUpdateToolDto,UserDeleteToolDto,UserBatchDeleteToolDto,CompanyCreateToolDto,CompanyUpdateToolDto,CompanyDeleteToolDto) @ApiCookieAuth('session') @UseGuards(SessionGuard) @Controller('ai-agent/write-tools')
export class WriteToolsController {
 constructor(@Inject(WriteToolRegistryService)private readonly registry:WriteToolRegistryService){}
 @Get() @ApiOperation({summary:'列出7个写入工具骨架及默认拦截状态'}) list(@Req()r:SessionRequest){return this.registry.list(this.registryContext(r));}
 @Post(':name/preview') @HttpCode(200) @ApiBody({type:WriteToolRequestDto}) @ApiOperation({summary:'执行DTO、权限和业务规则预校验，仅返回预览'}) preview(@Req()r:SessionRequest,@Param('name')name:string,@Body(dtoPipe(WriteToolRequestDto))b:WriteToolRequestDto){return this.registry.preview(this.registryContext(r),name,b.parameters);}
 @Post(':name/execute') @HttpCode(200) @ApiBody({type:WriteToolRequestDto}) @ApiOperation({summary:'写入拦截验证端点；本阶段总是拒绝自动执行'}) execute(@Req()r:SessionRequest,@Param('name')name:string,@Body(dtoPipe(WriteToolRequestDto))b:WriteToolRequestDto){return this.registry.execute(this.registryContext(r),name,b.parameters);}
 private registryContext(r:SessionRequest){return this.registry.policy.context(r.userId,r.ip);}
}
