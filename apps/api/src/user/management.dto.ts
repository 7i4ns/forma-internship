import { ApiProperty, PartialType, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, Matches } from 'class-validator';
import { CredentialsDto } from './credentials.dto';
export class CreateUserDto extends CredentialsDto {
  @ApiProperty({ type: String, example: 'Alex Chen' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 100) @Matches(/^[^\x00-\x1f\x7f]+$/) name!: string;
  @ApiProperty({ type: String, example: 'Manager' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 80) @Matches(/^[^\x00-\x1f\x7f]+$/) role!: string;
  @ApiProperty({ type: String, enum: ['active', 'inactive'] })
  @IsIn(['active', 'inactive']) status!: string;
}
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const), { skipNullProperties: false }) {}
