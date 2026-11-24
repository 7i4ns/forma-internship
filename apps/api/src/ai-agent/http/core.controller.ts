import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type SessionRequest } from '../../user/session.guard';
import { dtoPipe } from '../../shared/validation';
import { AiCoreService } from '../application/core.service';
import { AiListDto, AiCreateSessionDto, AiUpdateSessionDto, AiCreateMemoryDto, AiUpdateMemoryDto, AiCreateTaskDto, AiUpdateTaskDto, AiCreateAuditDto, AiUpdateAuditDto, AiTaskStateDto } from './core.dto';
const uuid=()=>new ParseUUIDPipe({version:'4'});

@ApiTags('AI Core sessions') @ApiCookieAuth('session') @UseGuards(SessionGuard)
@ApiResponse({status:401,description:'JWT无效'}) @ApiResponse({status:403,description:'权限或租户隔离限制'}) @ApiResponse({status:404,description:'不存在或不属于当前作用域'})
@Controller('ai-agent/core/sessions')
export class AiSessionController {
 constructor(@Inject(AiCoreService)private readonly service:AiCoreService){}
 @Get() @ApiOperation({summary:'分页查询sessions；user_id按用户筛选',description:'page从0开始，limit默认10最多100。普通用户仅本人；审计管理员仅可跨用户读取本租户审计，不跨租户。'})
 list(@Req()r:SessionRequest,@Query(dtoPipe(AiListDto))q:AiListDto){return this.service.list('sessions',this.service.scopes.forUser(r.userId),q);}
 @Get(':id') @ApiOperation({summary:'按ID读取sessions'})
 get(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.find('sessions',this.service.scopes.forUser(r.userId),id);}
 @Post() @ApiBody({type:AiCreateSessionDto}) @ApiOperation({summary:'创建sessions；归属由服务端自动填写'})
 create(@Req()r:SessionRequest,@Body(dtoPipe(AiCreateSessionDto))b:AiCreateSessionDto){return this.service.create('sessions',this.service.scopes.forUser(r.userId),b as unknown as Record<string,unknown>);}
 @Patch(':id') @ApiBody({type:AiUpdateSessionDto}) @ApiOperation({summary:'更新sessions',description:'至少提供一个字段。系统审计不可修改；会话closed=true清理缓存。'})
 update(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Body(dtoPipe(AiUpdateSessionDto))b:AiUpdateSessionDto){return this.service.update('sessions',this.service.scopes.forUser(r.userId),id,b as unknown as Record<string,unknown>);}
 @Delete(':id') @ApiOperation({summary:'删除sessions',description:'会话为软删除；自动系统审计不可删除；手工审计记录支持本人CRUD。'})
 remove(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.remove('sessions',this.service.scopes.forUser(r.userId),id);}
}

@ApiTags('AI Core memories') @ApiCookieAuth('session') @UseGuards(SessionGuard)
@ApiResponse({status:401,description:'JWT无效'}) @ApiResponse({status:403,description:'权限或租户隔离限制'}) @ApiResponse({status:404,description:'不存在或不属于当前作用域'})
@Controller('ai-agent/core/memories')
export class AiMemoryController {
 constructor(@Inject(AiCoreService)private readonly service:AiCoreService){}
 @Get() @ApiOperation({summary:'分页查询memories；user_id按用户筛选',description:'page从0开始，limit默认10最多100。普通用户仅本人；审计管理员仅可跨用户读取本租户审计，不跨租户。'})
 list(@Req()r:SessionRequest,@Query(dtoPipe(AiListDto))q:AiListDto){return this.service.list('memories',this.service.scopes.forUser(r.userId),q);}
 @Get(':id') @ApiOperation({summary:'按ID读取memories'})
 get(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.find('memories',this.service.scopes.forUser(r.userId),id);}
 @Post() @ApiBody({type:AiCreateMemoryDto}) @ApiOperation({summary:'创建memories；归属由服务端自动填写'})
 create(@Req()r:SessionRequest,@Body(dtoPipe(AiCreateMemoryDto))b:AiCreateMemoryDto){return this.service.create('memories',this.service.scopes.forUser(r.userId),b as unknown as Record<string,unknown>);}
 @Patch(':id') @ApiBody({type:AiUpdateMemoryDto}) @ApiOperation({summary:'更新memories',description:'至少提供一个字段。系统审计不可修改；会话closed=true清理缓存。'})
 update(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Body(dtoPipe(AiUpdateMemoryDto))b:AiUpdateMemoryDto){return this.service.update('memories',this.service.scopes.forUser(r.userId),id,b as unknown as Record<string,unknown>);}
 @Delete(':id') @ApiOperation({summary:'删除memories',description:'会话为软删除；自动系统审计不可删除；手工审计记录支持本人CRUD。'})
 remove(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.remove('memories',this.service.scopes.forUser(r.userId),id);}
}

@ApiTags('AI Core tasks') @ApiCookieAuth('session') @UseGuards(SessionGuard)
@ApiResponse({status:401,description:'JWT无效'}) @ApiResponse({status:403,description:'权限或租户隔离限制'}) @ApiResponse({status:404,description:'不存在或不属于当前作用域'})
@Controller('ai-agent/core/tasks')
export class AiTaskController {
 constructor(@Inject(AiCoreService)private readonly service:AiCoreService){}
 @Get() @ApiOperation({summary:'分页查询tasks；user_id按用户筛选',description:'page从0开始，limit默认10最多100。普通用户仅本人；审计管理员仅可跨用户读取本租户审计，不跨租户。'})
 list(@Req()r:SessionRequest,@Query(dtoPipe(AiListDto))q:AiListDto){return this.service.list('tasks',this.service.scopes.forUser(r.userId),q);}
 @Get(':id') @ApiOperation({summary:'按ID读取tasks'})
 get(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.find('tasks',this.service.scopes.forUser(r.userId),id);}
 @Post() @ApiBody({type:AiCreateTaskDto}) @ApiOperation({summary:'创建tasks；归属由服务端自动填写'})
 create(@Req()r:SessionRequest,@Body(dtoPipe(AiCreateTaskDto))b:AiCreateTaskDto){return this.service.create('tasks',this.service.scopes.forUser(r.userId),b as unknown as Record<string,unknown>);}
 @Patch(':id') @ApiBody({type:AiUpdateTaskDto}) @ApiOperation({summary:'更新tasks',description:'至少提供一个字段。系统审计不可修改；会话closed=true清理缓存。'})
 update(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Body(dtoPipe(AiUpdateTaskDto))b:AiUpdateTaskDto){return this.service.update('tasks',this.service.scopes.forUser(r.userId),id,b as unknown as Record<string,unknown>);}
 @Delete(':id') @ApiOperation({summary:'删除tasks',description:'会话为软删除；自动系统审计不可删除；手工审计记录支持本人CRUD。'})
 remove(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.remove('tasks',this.service.scopes.forUser(r.userId),id);}
 @Get(':id/state') @ApiOperation({summary:'读取隔离的任务临时状态；缓存失效返回null与数据库持久状态'})
 state(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.taskState(this.service.scopes.forUser(r.userId),id);}
 @Post(':id/state') @HttpCode(200) @ApiBody({type:AiTaskStateDto}) @ApiOperation({summary:'写入有TTL的任务临时状态，不执行任务'})
 writeState(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Body(dtoPipe(AiTaskStateDto))b:AiTaskStateDto){return this.service.setTaskState(this.service.scopes.forUser(r.userId),id,b.state,b.ttl);}
}

@ApiTags('AI Core audits') @ApiCookieAuth('session') @UseGuards(SessionGuard)
@ApiResponse({status:401,description:'JWT无效'}) @ApiResponse({status:403,description:'权限或租户隔离限制'}) @ApiResponse({status:404,description:'不存在或不属于当前作用域'})
@Controller('ai-agent/core/audits')
export class AiAuditController {
 constructor(@Inject(AiCoreService)private readonly service:AiCoreService){}
 @Get() @ApiOperation({summary:'分页查询audits；user_id按用户筛选',description:'page从0开始，limit默认10最多100。普通用户仅本人；审计管理员仅可跨用户读取本租户审计，不跨租户。'})
 list(@Req()r:SessionRequest,@Query(dtoPipe(AiListDto))q:AiListDto){return this.service.list('audits',this.service.scopes.forUser(r.userId),q);}
 @Get(':id') @ApiOperation({summary:'按ID读取audits'})
 get(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.find('audits',this.service.scopes.forUser(r.userId),id);}
 @Post() @ApiBody({type:AiCreateAuditDto}) @ApiOperation({summary:'创建audits；归属由服务端自动填写'})
 create(@Req()r:SessionRequest,@Body(dtoPipe(AiCreateAuditDto))b:AiCreateAuditDto){return this.service.create('audits',this.service.scopes.forUser(r.userId),b as unknown as Record<string,unknown>);}
 @Patch(':id') @ApiBody({type:AiUpdateAuditDto}) @ApiOperation({summary:'更新audits',description:'至少提供一个字段。系统审计不可修改；会话closed=true清理缓存。'})
 update(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Body(dtoPipe(AiUpdateAuditDto))b:AiUpdateAuditDto){return this.service.update('audits',this.service.scopes.forUser(r.userId),id,b as unknown as Record<string,unknown>);}
 @Delete(':id') @ApiOperation({summary:'删除audits',description:'会话为软删除；自动系统审计不可删除；手工审计记录支持本人CRUD。'})
 remove(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.service.remove('audits',this.service.scopes.forUser(r.userId),id);}
}
