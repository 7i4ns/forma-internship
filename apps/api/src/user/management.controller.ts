import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SessionGuard, SessionRequest } from './session.guard';
import { ManagementService } from './management.service';
import { CreateUserDto, UpdateUserDto } from './management.dto';
import { DeleteManyDto, dtoPipe } from '../shared/validation';
@ApiTags('Users management') @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('users')
export class ManagementController {
  constructor(@Inject(ManagementService) private readonly service: ManagementService) {}
  @Get() @ApiQuery({ name: 'search', required: false }) @ApiQuery({ name: 'roles', required: false, isArray: true, type: String }) @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  list(@Query() query: Record<string, unknown>) { return this.service.list(query); }
  @Post() @ApiBody({ type: CreateUserDto })
  async create(@Body(dtoPipe(CreateUserDto)) body: CreateUserDto) { return { message: '用户已添加', user: await this.service.create(body) }; }
  @Post('bulk-delete') @ApiBody({ type: DeleteManyDto })
  async bulk(@Body(dtoPipe(DeleteManyDto)) body: DeleteManyDto, @Req() request: SessionRequest) { return { message: '所选用户已删除', ...await this.service.remove(body.ids, request.userId) }; }
  @Get(':id') get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.service.get(id); }
  @Patch(':id') @ApiBody({ type: UpdateUserDto })
  async update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body(dtoPipe(UpdateUserDto)) body: UpdateUserDto, @Req() request: SessionRequest) { return { message: '用户信息已更新', user: await this.service.update(id, body, request.userId) }; }
  @Delete(':id') async remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Req() request: SessionRequest) { return { message: '用户已删除', ...await this.service.remove([id], request.userId) }; }
}
