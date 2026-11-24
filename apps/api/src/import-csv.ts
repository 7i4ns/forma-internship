import { AiCacheService } from './ai-agent/infrastructure/ai-cache.service';
import 'reflect-metadata';
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Pool } from 'pg';
import { CompanyDto } from './company/company.dto';
async function csv(path: string, allowed: string[], required: string[], aliases: Record<string, string> = {}) {
  const content = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(resolve(path)));
  let seen = false;
  const rows = parse(content, { bom: true, skip_empty_lines: true, trim: true, columns: (headers: string[]) => {
    seen = true;
    headers = headers.map(header => aliases[header] || header);
    if (allowed.includes('parent_company')) {
      const parentFormat = headers.includes('company_code');
      const invalid = parentFormat
        ? !headers.includes('parent_company') || headers.includes('supplier_external_id') || headers.includes('customer_external_id')
        : !headers.includes('supplier_external_id') || !headers.includes('customer_external_id') || headers.includes('parent_company');
      if (invalid) throw new Error(`${path}: 关系表头必须为完整的父子格式或供应商/客户格式，不可混合`);
    }
    if (new Set(headers).size !== headers.length) throw new Error(`${path}: 重复列名`);
    if (required.some(key => !headers.includes(key))) throw new Error(`${path}: 缺少必需列 ${required.join(', ')}`);
    const unknown = headers.filter(key => !allowed.includes(key));
    if (unknown.length) throw new Error(`${path}: 未识别列 ${unknown.join(', ')}，请先配置字段映射`);
    return headers;
  } }) as Record<string, string>[];
  if (!seen) throw new Error(`${path}: CSV 为空或缺少表头`);
  return rows;
}
async function main() {
  const args = process.argv.slice(2); const dryRun = args.includes('--dry-run');
  const paths = args.filter(arg => arg !== '--dry-run');
  if (paths.length < 1 || paths.length > 2) throw new Error('用法：npm run db:import -w apps/api -- companies.csv [relationships.csv] [--dry-run]（建议使用绝对路径）');
  const fields = ['external_id','name','level','country','city','founded_year','supplying_since','annual_revenue','employees'];
  const records = await csv(paths[0], fields, ['external_id','name','level','country'], { company_code: 'external_id', company_name: 'name' });
  const companies = records.map((row, i) => {
    const data: Record<string, unknown> = {};
    for (const key of fields) {
      const raw = row[key];
      data[key] = !raw ? null : ['founded_year','annual_revenue','employees'].includes(key) ? Number(raw) : raw;
      if (raw && ['founded_year','annual_revenue','employees'].includes(key) && !/^(?:\d+)(?:\.\d+)?$/.test(raw)) throw new Error(`companies 行 ${i+2}: ${key} 必须是不带货币符号或千位分隔符的数字`);
    }
    const dto = plainToInstance(CompanyDto, data);
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length || !dto.external_id?.trim()) throw new Error(`companies 行 ${i+2}: ${errors.map(e => `${e.property}: ${Object.values(e.constraints || {}).join('; ')}`).join(', ') || 'external_id 不能为空'}`);
    dto.external_id = dto.external_id.trim();
    return dto;
  });
  if (new Set(companies.map(c => c.external_id)).size !== companies.length) throw new Error('公司 CSV 中 external_id 重复，未导入任何记录');
  const relationships = paths[1] ? await csv(paths[1], ['supplier_external_id','customer_external_id','relationship_type','company_code','parent_company'], []) : [];
  const hierarchy = relationships.length > 0 && Object.hasOwn(relationships[0], 'company_code');
  if (relationships.length && (hierarchy
    ? !Object.hasOwn(relationships[0], 'parent_company') || Object.hasOwn(relationships[0], 'supplier_external_id') || Object.hasOwn(relationships[0], 'customer_external_id')
    : !Object.hasOwn(relationships[0], 'supplier_external_id') || !Object.hasOwn(relationships[0], 'customer_external_id') || Object.hasOwn(relationships[0], 'parent_company'))) throw new Error('关系 CSV 必须使用完整的父子列，或完整的供应商/客户列，不可混合');
  let roots = 0;
  if (hierarchy) {
    const parents = new Map<string, string>();
    for (const [i, row] of relationships.entries()) {
      if (row.relationship_type && row.relationship_type !== 'parent_of') throw new Error(`relationships 行 ${i+2}: 父子格式的类型应为 parent_of`);
      if (!row.company_code || row.company_code === row.parent_company) throw new Error(`relationships 行 ${i+2}: 公司编号为空或自关联`);
      if (parents.has(row.company_code)) throw new Error(`relationships 行 ${i+2}: 同一公司出现多次上级定义`);
      parents.set(row.company_code, row.parent_company);
      if (!row.parent_company) roots++;
    }
    // Check each ancestry chain before any database mutation.
    const verified = new Set<string>();
    for (const start of parents.keys()) {
      const chain = new Set<string>(); let current = start;
      while (current && parents.has(current) && !verified.has(current)) {
        if (chain.has(current)) throw new Error(`relationships: 父子关系存在循环，涉及 ${current}`);
        chain.add(current); current = parents.get(current)!;
      }
      for (const code of chain) verified.add(code);
    }
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL }); const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const company of companies) await client.query(`INSERT INTO companies(${fields.join(',')}) VALUES(${fields.map((_,i) => '$'+(i+1)).join(',')}) ON CONFLICT(external_id) DO UPDATE SET ${fields.filter(f => f !== 'external_id').map(f => `${f}=EXCLUDED.${f}`).join(',')}, updated_at=now()`, fields.map(key => company[key as keyof CompanyDto] ?? null));
    let inserted = 0;
    for (const [i, row] of relationships.entries()) {
      if (hierarchy) {
        const codes = row.parent_company ? [row.company_code, row.parent_company] : [row.company_code];
        const result = await client.query('SELECT id, external_id FROM companies WHERE external_id=ANY($1::text[])', [codes]);
        if (result.rows.length !== codes.length) throw new Error(`relationships 行 ${i+2}: 父子关系引用的公司不存在，整批导入将回滚`);
        if (!row.parent_company) continue; // Root marker is not a self-edge or a null edge.
        const ids = new Map(result.rows.map(r => [r.external_id, r.id]));
        const added = await client.query("INSERT INTO relationships(parent_company_id,child_company_id,relationship_type) VALUES($1,$2,'parent_of') ON CONFLICT(parent_company_id,child_company_id,relationship_type) DO NOTHING", [ids.get(row.parent_company),ids.get(row.company_code)]);
        inserted += added.rowCount || 0;
      } else {
        if (!row.supplier_external_id || !row.customer_external_id || row.supplier_external_id === row.customer_external_id || (row.relationship_type?.length || 0) > 80) throw new Error(`relationships 行 ${i+2}: 关系必须连接两个不同的公司，类型最多 80 字符`);
        const result = await client.query('SELECT id, external_id FROM companies WHERE external_id=ANY($1::text[])', [[row.supplier_external_id,row.customer_external_id]]);
        if (result.rows.length !== 2) throw new Error(`relationships 行 ${i+2}: 引用的公司编号不存在，整批导入将回滚`);
        const ids = new Map(result.rows.map(r => [r.external_id, r.id]));
        const added = await client.query('INSERT INTO relationships(supplier_id,customer_id,relationship_type) VALUES($1,$2,$3) ON CONFLICT(supplier_id,customer_id,relationship_type) DO NOTHING', [ids.get(row.supplier_external_id),ids.get(row.customer_external_id),row.relationship_type || 'supplier_of']);
        inserted += added.rowCount || 0;
      }
    }
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    if(!dryRun){const cache=new AiCacheService();try{await cache.invalidateCompanies();}finally{await cache.onModuleDestroy();}}
    console.log(JSON.stringify({ dryRun, companyRows: companies.length, relationshipRows: relationships.length, relationshipFormat: hierarchy ? 'parent-child' : 'supplier-customer', roots, relationshipsInserted: inserted, message: dryRun ? '预检通过，未写入数据' : '导入完成，可重复运行；已有公司按 external_id 更新，重复关系跳过' }));
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
