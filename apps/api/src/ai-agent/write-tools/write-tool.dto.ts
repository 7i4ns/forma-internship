import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { IsObject, IsUUID } from 'class-validator';
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
