import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsString, IsUUID, Length, ValidateIf } from 'class-validator';
import type { ModelProvider } from '@internship/ai-contracts';
export class CreateSessionDto {
 @ApiPropertyOptional({type:String,enum:['ollama','deepseek','qwen','gpt','kimi']}) @ValidateIf((_,v)=>v!==undefined) @IsIn(['ollama','deepseek','qwen','gpt','kimi']) provider?:ModelProvider;
}
export class SendMessageDto {
 @ApiProperty({type:String,maxLength:4000}) @IsString() @Length(0,4000) text!:string;
 @ApiProperty({type:[String],maxItems:3}) @IsArray() @ArrayMaxSize(3) @ArrayUnique() @IsUUID('4',{each:true}) fileIds!:string[];
 @ApiProperty({type:String,format:'uuid',description:'客户端生成UUID，同一内容重复提交不会重复生成回答'}) @IsUUID('4') requestId!:string;
}
export class DecisionDto {
 @ApiProperty({type:String,enum:['approved','rejected']}) @IsIn(['approved','rejected']) decision!:'approved'|'rejected';
}
