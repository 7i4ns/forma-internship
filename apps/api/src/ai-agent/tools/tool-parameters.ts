import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsObject, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
const trimValues=()=>Transform(({value})=>Array.isArray(value)?value.map(v=>typeof v==='string'?v.trim():v):value);
const optional=()=>ValidateIf((_o,v)=>v!==undefined);
export class PageParams {
 @IsInt() @Min(0) @Max(1000000) page=0;
 @IsInt() @Min(1) @Max(100) limit=10;
 @IsIn(['asc','desc']) sortDirection:'asc'|'desc'='asc';
}
export class UserQueryParams extends PageParams {
 @IsString() @MaxLength(200) @Matches(/^[^\x00-\x1f\x7f]*$/) search='';
 @trimValues() @Matches(/^[^\x00-\x1f\x7f]+$/,{each:true}) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) @Length(1,80,{each:true}) roles:string[]=[];
 @optional() @IsIn(['active','inactive']) status?:string;
 @IsIn(['name','email','role','status','created_at']) sortBy='name';
}
export class CompanyQueryParams extends PageParams {
 @IsString() @MaxLength(200) @Matches(/^[^\x00-\x1f\x7f]*$/) search='';
 @trimValues() @Matches(/^[^\x00-\x1f\x7f]+$/,{each:true}) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) @Length(1,80,{each:true}) levels:string[]=[];
 @trimValues() @Matches(/^[^\x00-\x1f\x7f]+$/,{each:true}) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) @Length(1,100,{each:true}) country:string[]=[];
 @trimValues() @Matches(/^[^\x00-\x1f\x7f]+$/,{each:true}) @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) @Length(1,120,{each:true}) city:string[]=[];
 @IsIn(['name','level','country','efficiency','annual_revenue','employees']) sortBy='name';
}
export class DashboardParams {
 @IsObject() filter:Record<string,unknown>={};
}
export class AnalysisParams extends PageParams {
 @IsIn(['level','country','city']) dimension:'level'|'country'|'city'='level';
 @IsObject() filter:Record<string,unknown>={};
 @IsIn(['value','count']) sortBy='count';
 @IsInt() @Min(1) @Max(100) override limit=100;
 @IsIn(['asc','desc']) override sortDirection:'asc'|'desc'='desc';
}
