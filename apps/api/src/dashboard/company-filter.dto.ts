import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Dimension } from './company-filter';
class YearRange {
  @ApiPropertyOptional({ type: Number, example: 1980 }) start?: number;
  @ApiPropertyOptional({ type: Number, example: 2020 }) end?: number;
}
class RevenueRange {
  @ApiPropertyOptional({ type: String, example: '0.00', description: '非负十进制金额，最多18位整数、2位小数；也接受安全范围内的 JSON number' }) min?: string;
  @ApiPropertyOptional({ type: String, example: '500000.00' }) max?: string;
}
class EmployeeRange {
  @ApiPropertyOptional({ type: Number, example: 0 }) min?: number;
  @ApiPropertyOptional({ type: Number, example: 1000 }) max?: number;
}
class CompanyFilters {
  @ApiPropertyOptional({ type: [String], example: ['1', '2'], description: '也接受数字等级，空数组表示不限' }) level?: string[];
  @ApiPropertyOptional({ type: [String] }) country?: string[];
  @ApiPropertyOptional({ type: [String] }) city?: string[];
  @ApiPropertyOptional({ type: YearRange }) founded_year?: YearRange;
  @ApiPropertyOptional({ type: RevenueRange }) annual_revenue?: RevenueRange;
  @ApiPropertyOptional({ type: EmployeeRange }) employees?: EmployeeRange;
}
export class CompanyFilterRequest {
  @ApiProperty({ type: String, enum: ['level', 'country', 'city'] }) dimension!: Dimension;
  @ApiPropertyOptional({ type: CompanyFilters }) filter?: CompanyFilters;
}
