import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsString, IsUUID, Length, Matches, ValidateIf } from 'class-validator';
const optional=()=>ValidateIf((_o,v)=>v!==undefined);
export class ExecuteToolDto {
 @ApiProperty({type:String,enum:['users.query','companies.query','dashboard.metrics','companies.analysis']}) @IsString() @Length(1,100) @Matches(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/) name!:string;
 @ApiProperty({type:'object',additionalProperties:true}) @IsObject() parameters!:Record<string,unknown>;
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') sessionId?:string;
 @ApiPropertyOptional({type:String,format:'uuid'}) @optional() @IsUUID('4') requestId?:string;
}
export class MatchToolDto {
 @ApiProperty({type:String,enum:['QUERY_DATA','STATISTICS_ANALYSIS']}) @IsIn(['QUERY_DATA','STATISTICS_ANALYSIS']) intent!:'QUERY_DATA'|'STATISTICS_ANALYSIS';
}
export class ConfigureToolDto {
 @ApiProperty({type:Boolean}) @IsBoolean() enabled!:boolean;
}
export class ToolCommandDto {
 @ApiProperty({type:String,maxLength:4000,example:'/tool companies.query {"search":"China"}'}) @IsString() @Length(1,4000) command!:string;
 @ApiProperty({type:String,format:'uuid'}) @IsUUID('4') sessionId!:string;
 @ApiProperty({type:String,format:'uuid'}) @IsUUID('4') requestId!:string;
}
