import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsArray, ArrayMinSize, ArrayMaxSize, IsUUID, validateSync } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
const validationError = (errors: {property:string;constraints?:Record<string,string>}[]) => new BadRequestException({ code: 'VALIDATION_ERROR', message: '请检查输入内容', errors: Object.fromEntries(errors.map(e => [e.property, Object.values(e.constraints || {})[0] || '输入无效'])) });
export const dtoPipe = (type: new () => object) => new ValidationPipe({ expectedType: type, transform: true, whitelist: true, forbidNonWhitelisted: true, exceptionFactory: validationError });
/** Reuses the HTTP DTO contract for non-controller entry points such as AI write-tool previews. */
export function validateDto<T extends object>(type:new()=>T,input:unknown):T {
  const value=plainToInstance(type,input);
  const errors=validateSync(value,{whitelist:true,forbidNonWhitelisted:true,forbidUnknownValues:true});
  if(errors.length)throw validationError(errors);
  return value;
}
export class DeleteManyDto {
  @ApiProperty({ type: [String], description: '待删除的用户 UUID，最多 100 个' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @IsUUID('4', { each: true }) ids!: string[];
}
export function dbError(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === '23505') throw new ConflictException({ code: 'DUPLICATE', message: '邮箱或外部编号已存在，请检查后重试' });
  if (code === '23503') throw new ConflictException({ code: 'RELATED_RECORDS', message: '该公司仍有关联关系，请先处理关联关系后再删除' });
  if (code === '23514' || code === '22003' || code === '22007') throw new BadRequestException({ code: 'INVALID_VALUE', message: '字段值超出允许范围' });
  throw error;
}
export function requireRow<T>(rows: T[]): T { if (!rows[0]) throw new NotFoundException({ code: 'NOT_FOUND', message: '记录不存在或已被删除，请刷新列表' }); return rows[0]; }
export function pagination(query: Record<string, unknown>) {
  const page = query.page === undefined ? 0 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isInteger(page) || page < 0 || page > 1000000 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException({ code: 'INVALID_QUERY', message: '分页参数无效' });
  const raw = query.search ?? '';
  if (typeof raw !== 'string' || raw.length > 200) throw new BadRequestException({ code: 'INVALID_QUERY', message: '搜索内容无效或过长' });
  return { page, limit, search: raw.trim() };
}
export function filterValues(value: unknown,maxLength=80): string[] {
  if (value === undefined || value === '') return [];
  const items = Array.isArray(value) ? value : [value];
  if (items.length > 100 || items.some(v => typeof v !== 'string' || v.length > maxLength)) throw new BadRequestException({ code: 'INVALID_QUERY', message: '筛选参数无效' });
  return [...new Set(items)] as string[];
}
// Escape LIKE wildcards so typing % or _ searches for those literal characters.
export const searchPattern = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;

export function sorting(query:Record<string,unknown>,fields:Record<string,string>,fallback:string,direction='asc'){
 const by=query.sortBy===undefined?fallback:query.sortBy;const order=query.sortDirection===undefined?direction:query.sortDirection;
 if(typeof by!=='string'||!Object.hasOwn(fields,by)||!['asc','desc'].includes(order as string))throw new BadRequestException({code:'INVALID_SORT',message:'排序字段或顺序无效'});
 return {sortBy:by,sortDirection:order as 'asc'|'desc',column:fields[by],sqlDirection:order==='asc'?'ASC':'DESC'};
}
