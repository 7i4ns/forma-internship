export type Dimension = 'level' | 'country' | 'city';
export const dimensionLabels: Record<Dimension,string> = {level:'公司等级',country:'国家',city:'城市'};
export type BarFilters = {level:string[];country:string[];city:string[];start:string;end:string;revenueMin:string;revenueMax:string;employeesMin:string;employeesMax:string};
export const emptyBarFilters = (): BarFilters => ({level:[],country:[],city:[],start:'',end:'',revenueMin:'',revenueMax:'',employeesMin:'',employeesMax:''});
export type CompanyBarData = {dimension:Dimension;total:number;groups:{value:string|null;count:number;percentage:number}[];options:Record<Dimension,string[]>;generatedAt:string};
export function makeBarRequest(dimension:Dimension, fields:BarFilters) {
  const errors: Partial<Record<keyof BarFilters,string>> = {};
  const filter: Record<string, unknown> = {level:fields.level,country:fields.country,city:fields.city};
  const year = Number(new Intl.DateTimeFormat('en',{timeZone:'Australia/Sydney',year:'numeric'}).format(new Date()));
  for (const [key,lo,hi] of [['founded_year','start','end'],['annual_revenue','revenueMin','revenueMax'],['employees','employeesMin','employeesMax']] as const) {
    const range: Record<string,number|string> = {}; const compared: (bigint|undefined)[] = [];
    for (const [index,field] of [lo,hi].entries()) {
      const text = fields[field].trim(); if (!text) continue;
      const money = key === 'annual_revenue';
      if (!(money ? /^(0|[1-9]\d{0,17})(\.\d{1,2})?$/ : /^\d+$/).test(text)) {errors[field] = money ? '请输入非负金额，最多2位小数' : '请输入非负整数';continue;}
      const value = Number(text);
      if (!money && (!Number.isSafeInteger(value) || value < (key === 'founded_year' ? 1000 : 0) || value > (key === 'founded_year' ? year : 2147483647))) {errors[field] = key === 'founded_year' ? `请输入1000至${year}的年份` : '员工数量不能超过2,147,483,647';continue;}
      const [whole,fraction=''] = text.split('.'); compared[index] = money ? BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')) : BigInt(text);
      range[key === 'founded_year' ? (index ? 'end' : 'start') : (index ? 'max' : 'min')] = money ? text : value;
    }
    if (compared[0] !== undefined && compared[1] !== undefined && compared[0] > compared[1]) errors[hi] = '结束值不能小于起始值';
    filter[key] = range;
  }
  return {errors,body:JSON.stringify({dimension,filter})};
}
