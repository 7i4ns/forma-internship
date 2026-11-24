import { BadRequestException } from '@nestjs/common';
export type Dimension = 'level' | 'country' | 'city';
export type CompanyFilterQuery = {
  dimension: Dimension;
  filter: { level?: string[]; country?: string[]; city?: string[];
    founded_year?: { start?: number; end?: number };
    annual_revenue?: { min?: string; max?: string };
    employees?: { min?: number; max?: number } };
};
// Validate the complete nested request explicitly: tsx does not emit DTO metadata.
// Money stays decimal text all the way to PostgreSQL, avoiding rounded boundaries.
export function parseCompanyFilter(input: unknown): CompanyFilterQuery {
  const errors: Record<string, string> = {};
  const object = (value: unknown, path: string, keys: string[]): Record<string, unknown> => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) { errors[path] = '必须是对象'; return {}; }
    const result = value as Record<string, unknown>;
    for (const key of Object.keys(result)) if (!keys.includes(key)) errors[`${path}.${key}`] = '不支持的字段';
    return result;
  };
  const body = object(input, 'request', ['dimension', 'filter']);
  if (!['level', 'country', 'city'].includes(body.dimension as string)) errors.dimension = '请选择 level、country 或 city';
  const raw = object(body.filter === undefined ? {} : body.filter, 'filter', ['level','country','city','founded_year','annual_revenue','employees']);
  const filter: CompanyFilterQuery['filter'] = {};
  for (const key of ['level','country','city'] as const) {
    if (raw[key] === undefined) continue;
    const items = raw[key]; const maxLength = {level:80,country:100,city:120}[key];
    if (!Array.isArray(items) || items.length > 100) { errors[`filter.${key}`] = '请选择最多100项'; continue; }
    const values: string[] = [];
    for (const value of items) {
      const text = key === 'level' && typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
      if (typeof text !== 'string' || !text.trim() || text.trim().length > maxLength || /[\x00-\x1f\x7f]/.test(text)) errors[`filter.${key}`] = '选项格式无效';
      else values.push(text.trim());
    }
    filter[key] = [...new Set(values)];
  }
  const year = Number(new Intl.DateTimeFormat('en', {timeZone:'Australia/Sydney',year:'numeric'}).format(new Date()));
  for (const key of ['founded_year','annual_revenue','employees'] as const) {
    if (raw[key] === undefined) continue;
    const keys = key === 'founded_year' ? ['start','end'] : ['min','max'];
    const range = object(raw[key], `filter.${key}`, keys);
    const normalized: Record<string, string | number> = {};
    const comparable: bigint[] = [];
    for (const bound of keys) {
      const value = range[bound]; if (value === undefined) continue;
      const path = `filter.${key}.${bound}`;
      if (key === 'annual_revenue') {
        const text = typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) && value <= Number.MAX_SAFE_INTEGER ? String(value) : '';
        if (!/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(text)) { errors[path] = '请输入非负金额，最多18位整数和2位小数'; continue; }
        normalized[bound] = text;
        const [whole, fraction = ''] = text.split('.'); comparable[keys.indexOf(bound)] = BigInt(whole)*100n + BigInt(fraction.padEnd(2,'0'));
      } else {
        const minimum = key === 'founded_year' ? 1000 : 0; const maximum = key === 'founded_year' ? year : 2147483647;
        if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) { errors[path] = `请输入 ${minimum} 至 ${maximum} 的整数`; continue; }
        normalized[bound] = value; comparable[keys.indexOf(bound)] = BigInt(value);
      }
    }
    if (comparable[0] !== undefined && comparable[1] !== undefined && comparable[0] > comparable[1]) errors[`filter.${key}`] = '起始值不能大于结束值';
    Object.assign(filter, {[key]: normalized});
  }
  if (Object.keys(errors).length) throw new BadRequestException({code:'INVALID_FILTER',message:'请检查筛选条件',errors});
  return {dimension:body.dimension as Dimension, filter};
}
export type CompanyBarData = {
  dimension: Dimension; total: number; groups: {value: string | null; count: number; percentage: number}[];
  options: {level: string[]; country: string[]; city: string[]}; generatedAt: string;
};
export function companyFilterPredicates(query: CompanyFilterQuery,offset=0,normalize=false) {
  const values: unknown[] = []; const clauses: string[] = [];
  const parameter = (value: unknown) => {values.push(value);return `$${values.length+offset}`;};
  for (const key of ['level','country','city'] as const) {
    const items = query.filter[key]; if (items?.length) clauses.push(`${normalize?'btrim('+key+')':key} = ANY(${parameter(items)}::text[])`);
  }
  for (const key of ['founded_year','annual_revenue','employees'] as const) {
    const range = query.filter[key]; if (!range) continue;
    const [low, high] = key === 'founded_year' ? [(range as {start?:number}).start,(range as {end?:number}).end] : [(range as {min?:number|string}).min,(range as {max?:number|string}).max];
    if (low !== undefined) clauses.push(`${key} >= ${parameter(low)}`);
    if (high !== undefined) clauses.push(`${key} <= ${parameter(high)}`);
  }
  return {values,clauses};
}
export function companyFilterSql(query:CompanyFilterQuery){
  const {values,clauses}=companyFilterPredicates(query);
  // dimension is checked against the allowlist, never interpolated from raw input.
  const dimension = {level:'level',country:'country',city:'city'}[query.dimension];
  if (!dimension) throw new BadRequestException('Invalid dimension');
  return {values,text:`WITH base AS (
    SELECT nullif(btrim(level),'') AS level, nullif(btrim(country),'') AS country,
      nullif(btrim(city),'') AS city, founded_year, annual_revenue, employees FROM companies
  ), filtered AS (SELECT * FROM base ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}),
  grouped AS (SELECT ${dimension} AS value, count(*)::int AS count FROM filtered GROUP BY ${dimension}),
  total AS (SELECT count(*)::int AS count FROM filtered)
  SELECT json_build_object('dimension','${dimension}','total',t.count,
    'groups',coalesce((SELECT json_agg(json_build_object('value',g.value,'count',g.count,
      'percentage',round(g.count::numeric*100/nullif(t.count,0),2)) ORDER BY g.count DESC,g.value NULLS LAST) FROM grouped g),'[]'::json),
    'options',json_build_object(
      'level',coalesce((SELECT json_agg(v ORDER BY length(v),v) FROM (SELECT DISTINCT level AS v FROM base WHERE level IS NOT NULL) o),'[]'::json),
      'country',coalesce((SELECT json_agg(v ORDER BY v) FROM (SELECT DISTINCT country AS v FROM base WHERE country IS NOT NULL) o),'[]'::json),
      'city',coalesce((SELECT json_agg(v ORDER BY v) FROM (SELECT DISTINCT city AS v FROM base WHERE city IS NOT NULL) o),'[]'::json)),
    'generatedAt',CURRENT_TIMESTAMP) AS chart FROM total t`};
}
