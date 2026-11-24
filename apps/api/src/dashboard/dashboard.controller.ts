import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiBadRequestResponse, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionGuard } from '../user/session.guard';
import { CompanyFilterRequest } from './company-filter.dto';
import { parseCompanyFilter } from './company-filter';
import { DashboardService } from './dashboard.service';
@ApiTags('Dashboard') @ApiCookieAuth() @UseGuards(SessionGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}
  @Post('getCompaniesByFilter') @HttpCode(200)
  @ApiOperation({ summary: '按维度与组合过滤器统计公司数量', description: '同字段多选 OR，不同字段 AND；空数组及省略范围表示不限，范围含端点，数值未知记录在该范围启用时排除。按数量降序返回所有分组（不截取前N项）。options 始终来自全部公司；只读检索，不修改数据。' })
  @ApiBody({ type: CompanyFilterRequest })
  @ApiBadRequestResponse({ description: '非法维度、字段、选项、范围或起止顺序；返回 errors 字段' })
  @ApiOkResponse({ schema: { type:'object', properties: {
    dimension:{type:'string',enum:['level','country','city']}, total:{type:'integer'},
    groups:{type:'array',items:{type:'object',properties:{value:{type:'string',nullable:true},count:{type:'integer'},percentage:{type:'number'}}}},
    options:{type:'object',properties:{level:{type:'array',items:{type:'string'}},country:{type:'array',items:{type:'string'}},city:{type:'array',items:{type:'string'}}}},
    generatedAt:{type:'string',format:'date-time'},
  } } })
  getCompaniesByFilter(@Body() body: unknown) { return this.service.getCompaniesByFilter(parseCompanyFilter(body)); }
  @Get()
  @ApiOperation({ summary: '全量公司数据看板：汇总卡片、等级占比、逐年累计公司数', description: '同一数据库快照计算。金额与员工总数返回十进制字符串以保留精度。年份使用 founded_year，补齐中间年份并延伸至当年；未知及未来年份不进入折线图。' })
  @ApiOkResponse({ schema: { type: 'object', required: ['summary','levels','growth','coverage','asOfYear','generatedAt'], properties: {
    summary: { type: 'object', properties: { companyCount: { type: 'integer' }, totalRevenue: { type: 'string', example: '48800000.00' }, countryCount: { type: 'integer' }, totalEmployees: { type: 'string', example: '228' }, revenueReported: { type: 'integer' }, employeesReported: { type: 'integer' } } },
    levels: { type: 'array', items: { type: 'object', properties: { level: { type: 'string' }, count: { type: 'integer' }, percentage: { type: 'number', description: '占全部公司的百分比，保留两位小数' } } } },
    growth: { type: 'array', items: { type: 'object', properties: { year: { type: 'integer' }, added: { type: 'integer' }, cumulative: { type: 'integer' } } } },
    coverage: { type: 'object', properties: { yearKnown: { type: 'integer' }, yearExcluded: { type: 'integer' }, yearMissing: { type: 'integer' }, yearInvalid: { type: 'integer' } } },
    asOfYear: { type: 'integer' }, generatedAt: { type: 'string', format: 'date-time' },
  } } })
  get() { return this.service.get(); }
}
