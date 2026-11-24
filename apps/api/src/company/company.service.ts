import { Inject, Optional } from '@nestjs/common';
import { AiCacheService } from '../ai-agent/infrastructure/ai-cache.service';
import { BadRequestException, ConflictException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { CompanyDto, UpdateCompanyDto } from './company.dto';
import { dbError, filterValues, pagination, sorting, requireRow, searchPattern } from '../shared/validation';
const fields = ['external_id','name','level','country','city','founded_year','supplying_since','annual_revenue','employees'] as const;
const select = "id, external_id, name, level, country, city, founded_year, to_char(supplying_since, 'YYYY-MM-DD') AS supplying_since, annual_revenue::float8, employees, (annual_revenue / nullif(employees,0))::float8 AS efficiency, created_at, updated_at";
@Injectable()
export class CompanyService implements OnModuleDestroy {
  constructor(@Optional() @Inject(AiCacheService) private readonly aiCache?:AiCacheService) {}
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });
  async onModuleDestroy() { await this.pool.end(); }
  async list(query: Record<string, unknown>) {
    const {page,limit,search}=pagination(query);const levels=filterValues(query.levels),country=filterValues(query.country,100),city=filterValues(query.city,120);
    const sort=sorting(query,{name:'name',level:'level',country:'country',efficiency:'efficiency',annual_revenue:'annual_revenue',employees:'employees'},'name');
    const where="WHERE ($1::text='' OR name ILIKE $2) AND (cardinality($3::text[])=0 OR level=ANY($3::text[])) AND (cardinality($4::text[])=0 OR btrim(country)=ANY($4::text[])) AND (cardinality($5::text[])=0 OR btrim(city)=ANY($5::text[]))";
    const args=[search,searchPattern(search),levels,country,city];const client=await this.pool.connect();
    try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const result=await client.query(`SELECT ${select} FROM companies ${where} ORDER BY ${sort.column} ${sort.sqlDirection} NULLS LAST,id LIMIT $6 OFFSET $7`,[...args,limit,page*limit]);
      const count=await client.query(`SELECT count(*)::int AS total FROM companies ${where}`,args);
      const options=await client.query('SELECT DISTINCT level FROM companies ORDER BY level');
      const countries=await client.query("SELECT DISTINCT btrim(country) AS value FROM companies WHERE nullif(btrim(country),'') IS NOT NULL ORDER BY value");
      const cities=await client.query("SELECT DISTINCT btrim(city) AS value FROM companies WHERE nullif(btrim(city),'') IS NOT NULL ORDER BY value");
      await client.query('COMMIT');return {items:result.rows,total:count.rows[0].total,levels:options.rows.map(r=>r.level),countries:countries.rows.map(r=>r.value),cities:cities.rows.map(r=>r.value),page,limit,sortBy:sort.sortBy,sortDirection:sort.sortDirection};
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async get(id: string) { return requireRow((await this.pool.query(`SELECT ${select} FROM companies WHERE id=$1`, [id])).rows); }
  async validateCreate(body:CompanyDto){
    if(body.external_id&&(await this.pool.query('SELECT 1 FROM companies WHERE external_id=$1',[body.external_id])).rowCount)throw new ConflictException({code:'DUPLICATE',message:'邮箱或外部编号已存在，请检查后重试'});
    return body;
  }
  async validateUpdate(id:string,body:UpdateCompanyDto){
    const entries=Object.entries(body).filter(([key,value])=>fields.includes(key as typeof fields[number])&&value!==undefined);
    if(!entries.length)throw new BadRequestException({code:'EMPTY_UPDATE',message:'请至少修改一个字段'});
    await this.get(id);
    if(body.external_id&&(await this.pool.query('SELECT 1 FROM companies WHERE external_id=$1 AND id<>$2',[body.external_id,id])).rowCount)throw new ConflictException({code:'DUPLICATE',message:'邮箱或外部编号已存在，请检查后重试'});
    return entries;
  }
  async validateRemove(id:string){
    await this.get(id);
    if((await this.pool.query('SELECT 1 FROM relationships WHERE parent_company_id=$1 OR child_company_id=$1 LIMIT 1',[id])).rowCount)throw new ConflictException({code:'RELATED_RECORDS',message:'该公司仍有关联关系，请先处理关联关系后再删除'});
    return {id};
  }
  async create(body: CompanyDto) {
    await this.validateCreate(body);
    try { const row = requireRow((await this.pool.query(`INSERT INTO companies(${fields.join(',')}) VALUES(${fields.map((_,i) => '$'+(i+1)).join(',')}) RETURNING ${select}`, fields.map(key => body[key] ?? null))).rows); await this.aiCache?.invalidateCompanies(); return row; }
    catch (e) { dbError(e); }
  }
  async update(id: string, body: UpdateCompanyDto) {
    const entries=await this.validateUpdate(id,body);
    try { const row = requireRow((await this.pool.query(`UPDATE companies SET ${entries.map(([key],i) => `${key}=$${i+2}`).join(',')}, updated_at=now() WHERE id=$1 RETURNING ${select}`, [id, ...entries.map(([,v]) => v)])).rows); await this.aiCache?.invalidateCompanies(); return row; }
    catch (e) { dbError(e); }
  }
  async remove(id: string) {
    await this.validateRemove(id);
    try { requireRow((await this.pool.query('DELETE FROM companies WHERE id=$1 RETURNING id', [id])).rows); await this.aiCache?.invalidateCompanies(); return { message: '公司已删除' }; }
    catch (e) { dbError(e); }
  }
}
