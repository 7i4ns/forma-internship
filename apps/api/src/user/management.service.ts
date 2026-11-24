import { BadRequestException, ConflictException, Inject, Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { CreateUserDto, UpdateUserDto } from './management.dto';
import { dbError, filterValues, pagination, sorting, requireRow, searchPattern } from '../shared/validation';
import { AiCacheService } from '../ai-agent/infrastructure/ai-cache.service';
const columns = 'id, name, email, role, status, created_at, updated_at';
@Injectable()
export class ManagementService implements OnModuleDestroy {
  constructor(@Optional() @Inject(AiCacheService)private readonly aiCache?:AiCacheService){}
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL });
  async onModuleDestroy() { await this.pool.end(); }
  async list(query: Record<string, unknown>,visibleUserIds?:string[]) {
    const {page,limit,search}=pagination(query);const roles=filterValues(query.roles);
    const status=query.status??'';if(!['','active','inactive'].includes(status as string))throw new BadRequestException({code:'INVALID_QUERY',message:'用户状态无效'});
    const sort=sorting(query,{name:'name',email:'email',role:'role',status:'status',created_at:'created_at'},'created_at','desc');
    const where="WHERE ($1::text='' OR name ILIKE $2) AND (cardinality($3::text[])=0 OR role=ANY($3::text[])) AND ($4::text='' OR status=$4) AND ($5::uuid[] IS NULL OR id=ANY($5::uuid[]))";
    const args=[search,searchPattern(search),roles,status,visibleUserIds??null];const client=await this.pool.connect();
    try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const count=await client.query(`SELECT count(*)::int AS total FROM users ${where}`,args);
      const result=await client.query(`SELECT ${columns} FROM users ${where} ORDER BY ${sort.column} ${sort.sqlDirection},id LIMIT $6 OFFSET $7`,[...args,limit,page*limit]);
      const options=await client.query('SELECT DISTINCT role FROM users WHERE ($1::uuid[] IS NULL OR id=ANY($1::uuid[])) ORDER BY role',[visibleUserIds??null]);
      await client.query('COMMIT');return {items:result.rows,total:count.rows[0].total,roles:options.rows.map(r=>r.role),page,limit,sortBy:sort.sortBy,sortDirection:sort.sortDirection};
    }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  }
  async get(id: string) { return requireRow((await this.pool.query(`SELECT ${columns} FROM users WHERE id=$1`, [id])).rows); }
  async validateCreate(body: CreateUserDto) {
    if((await this.pool.query('SELECT 1 FROM users WHERE email=$1',[body.email])).rowCount)throw new ConflictException({code:'DUPLICATE',message:'邮箱或外部编号已存在，请检查后重试'});
    return body;
  }
  async validateUpdate(id:string,body:UpdateUserDto,actor:string){
    if(actor===id&&body.status==='inactive')throw new BadRequestException({code:'SELF_DEACTIVATE',message:'不能停用当前登录账号'});
    const entries=Object.entries(body).filter(([key,value])=>['name','email','role','status'].includes(key)&&value!==undefined);
    if(!entries.length)throw new BadRequestException({code:'EMPTY_UPDATE',message:'请至少修改一个字段'});
    await this.get(id);
    if(body.email&&(await this.pool.query('SELECT 1 FROM users WHERE email=$1 AND id<>$2',[body.email,id])).rowCount)throw new ConflictException({code:'DUPLICATE',message:'邮箱或外部编号已存在，请检查后重试'});
    return entries;
  }
  async validateRemove(ids:string[],actor:string,executor:Pool|PoolClient=this.pool,lock=false){
    if(ids.includes(actor))throw new BadRequestException({code:'SELF_DELETE',message:'不能删除当前登录账号，请取消选择本人'});
    const unique=[...new Set(ids)];
    const existing=await executor.query(`SELECT id FROM users WHERE id = ANY($1::uuid[])${lock?' FOR UPDATE':''}`,[unique]);
    if(existing.rowCount!==unique.length)throw new BadRequestException({code:'STALE_SELECTION',message:'部分用户已不存在，请刷新后重新选择；本次未删除任何用户'});
    return unique;
  }
  async create(body: CreateUserDto) {
    await this.validateCreate(body);
    const salt = randomBytes(16).toString('hex'); const hash = await promisify(scrypt)(body.password, salt, 64) as Buffer;
    try { const row=requireRow((await this.pool.query(`INSERT INTO users(name,email,role,status,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING ${columns}`, [body.name, body.email, body.role, body.status, `scrypt:${salt}:${hash.toString('hex')}`])).rows);await this.aiCache?.invalidateUsers();return row; }
    catch (e) { dbError(e); }
  }
  async update(id: string, body: UpdateUserDto, actor: string) {
    const entries=await this.validateUpdate(id,body,actor);
    try { const row=requireRow((await this.pool.query(`UPDATE users SET ${entries.map(([key], i) => `${key}=$${i+2}`).join(', ')}, updated_at=now() WHERE id=$1 RETURNING ${columns}`, [id, ...entries.map(([,value]) => value)])).rows);await this.aiCache?.invalidateUsers();return row; }
    catch (e) { dbError(e); }
  }
  async remove(ids: string[], actor: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const unique=await this.validateRemove(ids,actor,client,true);
      await client.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [unique]);
      await client.query('COMMIT');await this.aiCache?.invalidateUsers();return { deleted: unique.length };
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
}
