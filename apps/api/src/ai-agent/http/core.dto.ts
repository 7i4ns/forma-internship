import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsString, IsUUID, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
const optional=()=>ValidateIf((_o,value)=>value!==undefined);
const text=()=>Transform(({value})=>typeof value==='string'?value.trim():value);
export class AiListDto {
 @ApiPropertyOptional({type:Number,default:0,minimum:0,maximum:1000000}) @optional() @Transform(({value})=>typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)?Number(value):value) @IsInt() @Min(0) @Max(1000000) page=0;
 @ApiPropertyOptional({type:Number,default:10,minimum:1,maximum:100}) @optional() @Transform(({value})=>typeof value==='string'&&/^(0|[1-9]\d*)$/.test(value)?Number(value):value) @IsInt() @Min(1) @Max(100) limit=10;
 @ApiPropertyOptional({type:String,format:'uuid',description:'普通用户只允许本人；审计管理员可筛选同租户用户'}) @optional() @IsUUID('4') user_id?:string;
}
export class AiCreateSessionDto {
 @ApiPropertyOptional({type:String,default:'新对话'}) @optional() @text() @IsString() @Length(1,80) @Matches(/^[^\x00-\x1f\x7f]+$/) title?:string;
 @ApiPropertyOptional({type:String,enum:['ollama','deepseek','qwen','gpt','kimi']}) @optional() @IsIn(['ollama','deepseek','qwen','gpt','kimi']) provider?:'ollama'|'deepseek'|'qwen'|'gpt'|'kimi';
}
export class AiUpdateSessionDto {
 @ApiPropertyOptional({type:String}) @optional() @text() @IsString() @Length(1,80) @Matches(/^[^\x00-\x1f\x7f]+$/) title?:string;
 @ApiPropertyOptional({type:Boolean,description:'true关闭会话并清理短期缓存；false重新打开'}) @optional() @IsBoolean() closed?:boolean;
}
export class AiCreateMemoryDto {
 @ApiProperty({type:String}) @text() @IsString() @Length(1,100) @Matches(/^[^\x00-\x1f\x7f]+$/) memory_key!:string;
 @ApiProperty({type:'object',additionalProperties:true}) @IsObject() content!:Record<string,unknown>;
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') session_id?:string;
}
// ValidateIf deliberately rejects explicit nulls, unlike IsOptional / PartialType defaults.
export class AiUpdateMemoryDto extends PartialType(AiCreateMemoryDto,{skipNullProperties:false}) {}
export class AiCreateTaskDto {
 @ApiProperty({type:String}) @text() @IsString() @Length(1,100) @Matches(/^[^\x00-\x1f\x7f]+$/) task_type!:string;
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') session_id?:string;
 @ApiPropertyOptional({type:'object',additionalProperties:true}) @optional() @IsObject() input?:Record<string,unknown>;
}
export class AiUpdateTaskDto extends PartialType(AiCreateTaskDto,{skipNullProperties:false}) {
 @ApiPropertyOptional({type:String,enum:['queued','pending_approval','running','completed','failed','cancelled']}) @optional() @IsIn(['queued','pending_approval','running','completed','failed','cancelled']) status?:string;
 @ApiPropertyOptional({type:Number,minimum:0,maximum:100}) @optional() @IsInt() @Min(0) @Max(100) progress?:number;
 @ApiPropertyOptional({type:'object',additionalProperties:true}) @optional() @IsObject() output?:Record<string,unknown>;
}
export class AiCreateAuditDto {
 @ApiProperty({type:String}) @text() @IsString() @Length(1,100) @Matches(/^[^\x00-\x1f\x7f]+$/) action!:string;
 @ApiPropertyOptional({type:String,enum:['success','failure']}) @optional() @IsIn(['success','failure']) result?:string;
 @ApiPropertyOptional({type:String}) @optional() @text() @IsString() @Length(1,100) target_type?:string;
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') target_id?:string;
 @ApiPropertyOptional({type:'object',additionalProperties:true}) @optional() @IsObject() details?:Record<string,unknown>;
}
export class AiUpdateAuditDto extends PartialType(AiCreateAuditDto,{skipNullProperties:false}) {}
export class AiTaskStateDto {
 @ApiProperty({type:'object',additionalProperties:true}) @IsObject() state!:Record<string,unknown>;
 @ApiPropertyOptional({type:Number,default:7200,minimum:1,maximum:86400}) @optional() @IsInt() @Min(1) @Max(86400) ttl=7200;
}
export class AiToolQueryDto {
 @ApiProperty({type:String,enum:['dashboard.summary','companies.filter']}) @IsIn(['dashboard.summary','companies.filter']) tool!:'dashboard.summary'|'companies.filter';
 @ApiProperty({type:String}) @text() @IsString() @Length(1,2000) question!:string;
 @ApiPropertyOptional({type:'object',additionalProperties:true,description:'companies.filter 使用现有 dimension/filter 契约；summary应省略'}) @optional() @IsObject() parameters?:Record<string,unknown>;
}
