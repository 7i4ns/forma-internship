import { ApiProperty, ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsObject, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';
import { CompanyDto, UpdateCompanyDto } from '../../company/company.dto';
import { CreateUserDto, UpdateUserDto } from '../../user/management.dto';
import { DeleteManyDto } from '../../shared/validation';

export class EntityIdDto { @ApiProperty({type:String,format:'uuid'}) @IsUUID('4') id!:string; }
export class UserCreateToolDto extends CreateUserDto {}
export class UserUpdateToolDto extends IntersectionType(EntityIdDto,UpdateUserDto) {}
export class UserDeleteToolDto extends EntityIdDto {}
export class UserBatchDeleteToolDto extends DeleteManyDto {}
export class CompanyCreateToolDto extends CompanyDto {}
export class CompanyUpdateToolDto extends IntersectionType(EntityIdDto,UpdateCompanyDto) {}
export class CompanyDeleteToolDto extends EntityIdDto {}
export class WriteToolRequestDto { @ApiProperty({type:'object',additionalProperties:true}) @IsObject() parameters!:Record<string,unknown>; }
const optional=()=>ValidateIf((_o:unknown,value:unknown)=>value!==undefined);
export class WriteApprovalRequestDto extends WriteToolRequestDto {
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') sessionId?:string;
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') requestId?:string;
}
export class WriteApprovalDecisionDto {
 @ApiProperty({type:String,enum:['approved','rejected']}) @IsIn(['approved','rejected']) decision!:'approved'|'rejected';
 @ApiPropertyOptional({type:String,maxLength:500}) @optional() @IsString() @Length(1,500) reason?:string;
}
export class WriteApprovalListDto {
 @ApiPropertyOptional({type:String,enum:['pending','approved','rejected','expired','executed','failed']}) @optional() @IsIn(['pending','approved','rejected','expired','executed','failed']) status?:string;
 @ApiPropertyOptional({type:String,enum:['create','update','delete','batch-delete']}) @optional() @IsIn(['create','update','delete','batch-delete']) operationType?:string;
 @ApiPropertyOptional({type:String,format:'date'}) @optional() @IsString() from?:string;
 @ApiPropertyOptional({type:String,format:'date'}) @optional() @IsString() to?:string;
 @ApiPropertyOptional({type:Number,default:0}) @optional() @Transform(({value})=>typeof value==='string'?Number(value):value) @IsInt() @Min(0) @Max(1000000) page=0;
 @ApiPropertyOptional({type:Number,default:20}) @optional() @Transform(({value})=>typeof value==='string'?Number(value):value) @IsInt() @Min(1) @Max(100) limit=20;
}
export class WriteCommandDto {
 @ApiProperty({type:String,maxLength:8000,example:'/write companies.create {"name":"示例公司","level":"1","country":"中国"}'}) @IsString() @Length(1,8000) command!:string;
 @ApiProperty({type:String,format:'uuid'}) @IsUUID('4') sessionId!:string;
 @ApiProperty({type:String,format:'uuid'}) @IsUUID('4') requestId!:string;
}
