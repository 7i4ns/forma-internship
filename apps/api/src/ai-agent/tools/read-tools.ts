import { Inject, Injectable } from '@nestjs/common';
import type { ToolCompany, ToolContext, ToolUser } from '@internship/ai-contracts';
import { UserService } from '../../user/user.service';
import { CompanyService } from '../../company/company.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { CompanyAnalysisService } from '../../dashboard/company-analysis.service';
import { parseCompanyFilter } from '../../dashboard/company-filter';
import { BaseTool, RegisteredTool, type ToolOutput } from './base-tool';
import { UserQueryParams, CompanyQueryParams, DashboardParams, AnalysisParams } from './tool-parameters';
@Injectable() @RegisteredTool({name:'users.query',label:'用户查询',intent:'QUERY_DATA',permission:'users:read',operation:'read',resultType:'table'})
export class UserQueryTool extends BaseTool<UserQueryParams> {
 readonly parameterType=UserQueryParams;
 constructor(@Inject(UserService)private readonly users:UserService){super();}
 async run(ctx:ToolContext,p:UserQueryParams):Promise<ToolOutput>{
  const result=await this.users.queryForAgent({...p},[...(ctx.visibleUserIds??[ctx.userId])]);
  const rows:ToolUser[]=result.items.map(r=>({id:r.id,name:r.name,email:r.email,role:r.role,status:r.status}));
  return {resultType:'table',message:`找到 ${result.total} 位可见用户，本页 ${rows.length} 位。`,data:{kind:'users',title:'用户查询结果',rows,roles:result.roles,pagination:{page:result.page,limit:result.limit,total:result.total,sortBy:result.sortBy,sortDirection:result.sortDirection}}};
 }
}
@Injectable() @RegisteredTool({name:'companies.query',label:'公司查询',intent:'QUERY_DATA',permission:'companies:read',operation:'read',resultType:'table'})
export class CompanyQueryTool extends BaseTool<CompanyQueryParams> {
 readonly parameterType=CompanyQueryParams;
 constructor(@Inject(CompanyService)private readonly companies:CompanyService){super();}
 async run(_ctx:ToolContext,p:CompanyQueryParams):Promise<ToolOutput>{
  const result=await this.companies.list({...p});const max=Math.max(0,...result.items.map(r=>r.efficiency??0));
  const rows:ToolCompany[]=result.items.map(r=>({id:r.id,name:r.name,level:r.level,country:r.country,city:r.city,founded_year:r.founded_year,annual_revenue:r.annual_revenue,employees:r.employees,efficiency:r.efficiency,efficiencyStrength:r.efficiency===null||max===0?0:r.efficiency/max}));
  return {resultType:'table',message:`找到 ${result.total} 家公司，本页 ${rows.length} 家。`,data:{kind:'companies',title:'公司查询结果',rows,pagination:{page:result.page,limit:result.limit,total:result.total,sortBy:result.sortBy,sortDirection:result.sortDirection},options:{level:result.levels,country:result.countries,city:result.cities}}};
 }
}
@Injectable() @RegisteredTool({name:'dashboard.metrics',label:'综合指标与趋势',intent:'STATISTICS_ANALYSIS',permission:'dashboard:read',operation:'read',resultType:'report'})
export class DashboardMetricsTool extends BaseTool<DashboardParams> {
 readonly parameterType=DashboardParams;
 constructor(@Inject(DashboardService)private readonly dashboard:DashboardService){super();}
 async run(_ctx:ToolContext,p:DashboardParams):Promise<ToolOutput>{const filter=parseCompanyFilter({dimension:'level',filter:p.filter});const result=await this.dashboard.get(filter);return {resultType:'report',message:`筛选范围内共 ${result.summary.companyCount} 家公司，覆盖 ${result.summary.countryCount} 个国家。`,data:{...result,kind:'dashboard',title:'公司综合指标'}};}
}
@Injectable() @RegisteredTool({name:'companies.analysis',label:'多维度条形图',intent:'STATISTICS_ANALYSIS',permission:'dashboard:read',operation:'read',resultType:'chart'})
export class CompanyAnalysisTool extends BaseTool<AnalysisParams> {
 readonly parameterType=AnalysisParams;
 constructor(@Inject(CompanyAnalysisService)private readonly analysis:CompanyAnalysisService){super();}
 async run(_ctx:ToolContext,p:AnalysisParams):Promise<ToolOutput>{const filter=parseCompanyFilter({dimension:p.dimension,filter:p.filter});const result=await this.analysis.aggregate(filter);const sorted=[...result.groups].sort((a,b)=>{const difference=p.sortBy==='count'?a.count-b.count:(a.value??'').localeCompare(b.value??'');return (p.sortDirection==='asc'?1:-1)*difference||(a.value??'').localeCompare(b.value??'');});return {resultType:'chart',message:`共 ${result.total} 家公司，${sorted.length} 个分组。`,data:{...result,kind:'bar',title:'公司分布统计',groups:sorted.slice(p.page*p.limit,(p.page+1)*p.limit),pagination:{page:p.page,limit:p.limit,total:sorted.length,sortBy:p.sortBy,sortDirection:p.sortDirection}}};}
}
