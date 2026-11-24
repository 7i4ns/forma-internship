import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CredentialsDto {
  @ApiProperty({ type: String, example: 'you@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString({ message: '请输入电子邮箱' })
  @IsEmail({}, { message: '请输入有效的电子邮箱地址' })
  @MaxLength(254, { message: '邮箱不能超过 254 个字符' })
  email!: string;

  @ApiProperty({ type: String, minLength: 8, maxLength: 128, format: 'password', description: '8–128 位，至少包含字母和数字，不包含空白或控制字符' })
  @IsString({ message: '请输入密码' })
  @MinLength(8, { message: '密码至少需要 8 位' })
  @MaxLength(128, { message: '密码不能超过 128 位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*[0-9])[^\s\x00-\x1f\x7f]+$/, { message: '密码须包含字母和数字，不能包含空格或控制字符' })
  password!: string;
}
