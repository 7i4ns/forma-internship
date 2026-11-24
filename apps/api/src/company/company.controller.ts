import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../user/session.guard';
import { dtoPipe } from '../shared/validation';
import { CompanyDto, UpdateCompanyDto } from './company.dto';
import { CompanyService } from './company.service';
@ApiTags('Companies') @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('companies')
export class CompanyController {
  constructor(@Inject(CompanyService) private readonly service: CompanyService) {}
  @Get() @ApiQuery({ name: 'search', required: false }) @ApiQuery({ name: 'levels', required: false, isArray: true, type: String }) @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  list(@Query() query: Record<string, unknown>) { return this.service.list(query); }
  @Post() @ApiBody({ type: CompanyDto }) async create(@Body(dtoPipe(CompanyDto)) body: CompanyDto) { return { message: '公司已添加', company: await this.service.create(body) }; }
  @Get(':id') get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.service.get(id); }
  @Patch(':id') @ApiBody({ type: UpdateCompanyDto }) async update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body(dtoPipe(UpdateCompanyDto)) body: UpdateCompanyDto) { return { message: '公司信息已更新', company: await this.service.update(id, body) }; }
  @Delete(':id') remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.service.remove(id); }
}
