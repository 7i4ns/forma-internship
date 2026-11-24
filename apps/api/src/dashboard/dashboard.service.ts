import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { companyFilterSql, companyFilterPredicates, type CompanyFilterQuery, type CompanyBarData } from './company-filter';
export type DashboardData = {
  summary: { companyCount: number; totalRevenue: string; countryCount: number; totalEmployees: string; revenueReported: number; employeesReported: number };
  levels: { level: string; count: number; percentage: number }[];
  growth: { year: number; added: number; cumulative: number }[];
  coverage: { yearKnown: number; yearExcluded: number; yearMissing: number; yearInvalid: number };
  generatedAt: string; asOfYear: number;
};
// One statement gives all widgets the same PostgreSQL snapshot, without loading
// every company into Node or accidentally aggregating a paginated list.
export const DASHBOARD_SQL = `
WITH base AS (
  SELECT annual_revenue, employees, founded_year,
         nullif(lower(btrim(country)), '') AS country_key,
         coalesce(nullif(btrim(level), ''), '未分类') AS level
  FROM companies
), totals AS (
  SELECT count(*)::int AS companies,
         coalesce(sum(annual_revenue), 0)::text AS revenue,
         count(DISTINCT country_key)::int AS countries,
         coalesce(sum(employees), 0)::text AS employees,
         count(annual_revenue)::int AS revenue_reported,
         count(employees)::int AS employees_reported,
         count(*) FILTER (WHERE founded_year BETWEEN 1000 AND $1)::int AS year_known,
         count(*) FILTER (WHERE founded_year IS NULL)::int AS year_missing,
         count(*) FILTER (WHERE founded_year < 1000 OR founded_year > $1)::int AS year_invalid
  FROM base
), distribution AS (
  SELECT level, count(*)::int AS count,
         round(count(*)::numeric * 100 / nullif((SELECT companies FROM totals), 0), 2) AS percentage
  FROM base GROUP BY level
), annual AS (
  SELECT founded_year AS year, count(*)::int AS added
  FROM base WHERE founded_year BETWEEN 1000 AND $1 GROUP BY founded_year
), continuous AS (
  SELECT generate_series((SELECT min(year) FROM annual), $1)::int AS year
), growth AS (
  SELECT c.year, coalesce(a.added, 0)::int AS added,
         sum(coalesce(a.added, 0)) OVER (ORDER BY c.year)::int AS cumulative
  FROM continuous c LEFT JOIN annual a ON a.year = c.year
)
SELECT json_build_object(
  'summary', json_build_object('companyCount', t.companies, 'totalRevenue', t.revenue,
    'countryCount', t.countries, 'totalEmployees', t.employees,
    'revenueReported', t.revenue_reported, 'employeesReported', t.employees_reported),
  'levels', coalesce((SELECT json_agg(d ORDER BY d.count DESC, d.level) FROM distribution d), '[]'::json),
  'growth', coalesce((SELECT json_agg(g ORDER BY g.year) FROM growth g), '[]'::json),
  'coverage', json_build_object('yearKnown', t.year_known, 'yearExcluded', t.year_missing + t.year_invalid,
    'yearMissing', t.year_missing, 'yearInvalid', t.year_invalid),
  'asOfYear', $1, 'generatedAt', CURRENT_TIMESTAMP
) AS dashboard FROM totals t`;
@Injectable()
export class DashboardService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  async onModuleDestroy() { await this.pool.end(); }
  // A read-only fingerprint prevents stale cache reuse after direct imports or Redis outages.
  // Suitable for the current small internship dataset; no business-table schema changes.
  async revision():Promise<string>{return (await this.pool.query("SELECT md5(coalesce(string_agg(to_jsonb(c)::text,'' ORDER BY id),'')) AS revision FROM companies c")).rows[0].revision;}
  async getCompaniesByFilter(query: CompanyFilterQuery): Promise<CompanyBarData> {
    const sql = companyFilterSql(query);
    return (await this.pool.query<{chart: CompanyBarData}>(sql)).rows[0].chart;
  }
  async get(filter?:CompanyFilterQuery): Promise<DashboardData> {
    const year = Number(new Intl.DateTimeFormat('en', { timeZone: 'Australia/Sydney', year: 'numeric' }).format(new Date()));
    const predicates=filter?companyFilterPredicates(filter,1,true):{values:[],clauses:[]};
    const sql=predicates.clauses.length?DASHBOARD_SQL.replace('WITH base AS (',`WITH selected_companies AS (SELECT * FROM companies WHERE ${predicates.clauses.join(' AND ')}), base AS (`).replace('FROM companies\n)', 'FROM selected_companies\n)'):DASHBOARD_SQL;
    const result=await this.pool.query<{dashboard:DashboardData}>(sql,[year,...predicates.values]);
    return result.rows[0].dashboard;
  }
}
