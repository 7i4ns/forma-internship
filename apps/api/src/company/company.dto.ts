import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class CompanyDto {
  @ApiPropertyOptional({ type: String, nullable: true }) @ValidateIf((_, v) => v !== undefined && v !== null) @IsString() @Length(1,120) external_id?: string | null;
  @ApiProperty({ type: String }) @Transform(trim) @IsString() @Length(1,200) @Matches(/^[^\x00-\x1f\x7f]+$/) name!: string;
  @ApiProperty({ type: String }) @Transform(trim) @IsString() @Length(1,80) level!: string;
  @ApiProperty({ type: String }) @Transform(trim) @IsString() @Length(1,100) country!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) @ValidateIf((_, v) => v !== undefined && v !== null) @Transform(trim) @IsString() @Length(0,120) city?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) @ValidateIf((_, v) => v !== undefined && v !== null) @IsInt() @Min(1000) @Max(new Date().getFullYear()) founded_year?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: 'date' }) @ValidateIf((_, v) => v !== undefined && v !== null) @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) supplying_since?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) @ValidateIf((_, v) => v !== undefined && v !== null) @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false }) @Min(0) @Max(1e15) annual_revenue?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) @ValidateIf((_, v) => v !== undefined && v !== null) @IsInt() @Min(0) @Max(2147483647) employees?: number | null;
}
export class UpdateCompanyDto extends PartialType(CompanyDto, { skipNullProperties: false }) {}
