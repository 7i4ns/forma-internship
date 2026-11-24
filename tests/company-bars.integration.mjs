import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
require('dotenv').config({path:'apps/api/.env',quiet:true});
const {Pool}=require('pg');
const {parseCompanyFilter,companyFilterSql}=require('../apps/api/src/dashboard/company-filter.ts');
const {makeBarRequest,emptyBarFilters}=require('../apps/web/lib/company-bars.ts');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log(`PASS ${label}`);};
const client=await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('CREATE TEMP TABLE companies (level text,country text,city text,founded_year int,annual_revenue numeric(20,2),employees int) ON COMMIT DROP');
  const query=async(body)=>{const result=await client.query(companyFilterSql(parseCompanyFilter(body)));return result.rows[0].chart;};
  eq((await query({dimension:'level'})).groups,[],'empty dataset');
  const fixtures=[['1','China','Beijing',2000,'100.10',0],['2','China','Shanghai',2001,'200.20',10],['2','Japan','Tokyo',2001,'300.30',20],['3','Japan','Tokyo',2002,'400.40',30],['3','USA',null,null,null,null],[' 2 ',' China ',' Beijing ',2000,'100.11',5],['4','USA','Rare city',2020,'999999999999999999.99',2147483647],['4','USA','',2021,'0.00',0]];
  for(const row of fixtures)await client.query('INSERT INTO companies VALUES ($1,$2,$3,$4,$5,$6)',row);
  let data=await query({dimension:'level'});
  eq(data.total,8,'all companies counted');eq(data.groups[0],{value:'2',count:3,percentage:37.50},'trimmed level grouping and percentage');
  eq(data.groups.reduce((a,g)=>a+g.count,0),8,'group total equals matched companies');
  eq(data.options.country,['China','Japan','USA'],'options trim and deduplicate');
  eq((await query({dimension:'country'})).groups.length,3,'country dimension');
  eq((await query({dimension:'city'})).groups.find(g=>g.value===null).count,2,'null and blank dimension grouped explicitly');
  eq((await query({dimension:'level',filter:{level:[1,2,2]}})).total,4,'numeric multi levels normalize, OR and deduplicate');
  eq((await query({dimension:'city',filter:{level:[2],country:['China'],city:['Beijing','Shanghai']}})).total,2,'multiple filters combine AND, options OR');
  eq((await query({dimension:'city',filter:{founded_year:{start:2001,end:2001}}})).total,2,'year inclusive equal endpoints');
  eq((await query({dimension:'level',filter:{founded_year:{start:2002}}})).total,3,'year open upper range');
  eq((await query({dimension:'level',filter:{founded_year:{end:2000}}})).total,2,'year open lower range excludes null');
  eq((await query({dimension:'level',filter:{annual_revenue:{min:'100.10',max:'100.11'}}})).total,2,'exact adjacent cent boundaries inclusive');
  eq((await query({dimension:'level',filter:{annual_revenue:{min:'999999999999999999.99'}}})).total,1,'huge decimal precision retained');
  eq((await query({dimension:'level',filter:{annual_revenue:{max:0},employees:{min:0,max:0}}})).total,1,'zero boundaries are active, null excluded');
  eq((await query({dimension:'level',filter:{employees:{min:2147483647}}})).total,1,'maximum employee count');
  eq((await query({dimension:'level',filter:{level:[],country:[],city:[],employees:{},founded_year:{},annual_revenue:{}}})).total,8,'all empty filters mean unrestricted');
  data=await query({dimension:'country',filter:{level:[1,2],country:['China'],city:['Beijing'],founded_year:{start:2000,end:2001},annual_revenue:{min:'100.10',max:'200.20'},employees:{min:0,max:5}}});
  eq(data.total,2,'all six filters together');eq(data.groups,[{value:'China',count:2,percentage:100}],'percentage denominator is filtered total');
  data=await query({dimension:'city',filter:{country:['China'],city:['Tokyo']}});eq(data.total,0,'incompatible selections return empty');eq(data.options.country,['China','Japan','USA'],'options do not disappear for empty results');
  eq((await query({dimension:'city',filter:{country:["China' OR TRUE --"]}})).total,0,'SQL injection treated as literal value');
  for(let i=0;i<25;i++)await client.query("INSERT INTO companies VALUES ('5','QA',$1,2000,0,0)",[`city-${i}`]);
  eq((await query({dimension:'city'})).groups.length,30,'all groups returned beyond first twenty');
  await client.query('ROLLBACK');
  const invalid=[null,[],{}, {dimension:'other'}, {dimension:'level; DROP TABLE companies'}, {dimension:'level',extra:true}, {dimension:'level',filter:null},{dimension:'level',filter:{extra:1}}, {dimension:'level',filter:{level:'1'}},{dimension:'level',filter:{country:[null]}},{dimension:'level',filter:{level:[{}]}}, {dimension:'level',filter:{city:['\u0000']}}, {dimension:'level',filter:{city:Array(101).fill('A')}}, {dimension:'level',filter:{country:['A'.repeat(101)]}},{dimension:'level',filter:{employees:{min:-1}}},{dimension:'level',filter:{employees:{min:1.5}}},{dimension:'level',filter:{employees:{max:2147483648}}},{dimension:'level',filter:{employees:{min:10,max:1}}},{dimension:'level',filter:{employees:{min:null}}},{dimension:'level',filter:{founded_year:{start:999}}},{dimension:'level',filter:{founded_year:{end:9999}}},{dimension:'level',filter:{founded_year:{start:2020,end:2000}}},{dimension:'level',filter:{annual_revenue:{min:'1e3'}}},{dimension:'level',filter:{annual_revenue:{min:'0.001'}}},{dimension:'level',filter:{annual_revenue:{min:'1000000000000000000'}}},{dimension:'level',filter:{annual_revenue:{min:'0.02',max:'0.01'}}},{dimension:'level',filter:{annual_revenue:{min:true}}},{dimension:'level',filter:{annual_revenue:{oops:1}}}];
  for(const body of invalid){assert.throws(()=>parseCompanyFilter(body));checks++;}
  let fields=emptyBarFilters();eq(Object.keys(makeBarRequest('level',fields).errors).length,0,'empty frontend form valid');
  fields={...fields,start:'2001',end:'2000',revenueMin:'-1',employeesMax:'1.2'};eq(Object.keys(makeBarRequest('country',fields).errors).sort(),['employeesMax','end','revenueMin'],'frontend range errors');
  fields={...emptyBarFilters(),revenueMin:'999999999999999999.98',revenueMax:'999999999999999999.99'};eq(Object.keys(makeBarRequest('level',fields).errors).length,0,'frontend validates huge money exactly');
  eq(JSON.parse(makeBarRequest('level',fields).body).filter.annual_revenue.min,'999999999999999999.98','frontend retains money text');
} catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
const base=process.env.TEST_API_URL||'http://127.0.0.1:3001';
const email=`bar-qa-${randomUUID()}@example.com`;let actorId,cookie,companyId;
async function request(path,body,session=cookie,method=body===undefined?'GET':'POST'){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(session?{Cookie:session}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie'),cache:response.headers.get('cache-control')};
}
try{
 eq((await request('/dashboard/getCompaniesByFilter',{dimension:'level'})).status,401,'API requires session');
 const actor=await request('/auth/signup',{email,password:'BarChartQA2026!'});eq(actor.status,201,'isolated test account created');actorId=actor.data.user.id;
 const login=await request('/auth/login',{email,password:'BarChartQA2026!'});cookie=login.cookie.split(';')[0];
 const all=await request('/dashboard/getCompaniesByFilter',{dimension:'level'});eq(all.status,200,'authenticated query');eq(all.cache,'no-store','private result not cached');
 eq(all.data.total,(await request('/dashboard')).data.summary.companyCount,'unrestricted matches dashboard count');
 const raw=(await pool.query('SELECT level,country,city,founded_year,annual_revenue,employees FROM companies')).rows;
 const body={dimension:'country',filter:{level:[2,3],country:['China','Japan'],city:[],founded_year:{start:1950,end:2000},annual_revenue:{min:'1000.00',max:'500000.00'},employees:{min:100,max:1000}}};
 const cents=text=>{const [w,f='']=String(text).split('.');return BigInt(w)*100n+BigInt(f.padEnd(2,'0'));};
 const expected=raw.filter(r=>['2','3'].includes(r.level.trim())&&['China','Japan'].includes(r.country.trim())&&r.founded_year>=1950&&r.founded_year<=2000&&r.annual_revenue!==null&&cents(r.annual_revenue)>=100000n&&cents(r.annual_revenue)<=50000000n&&r.employees>=100&&r.employees<=1000);
 const result=await request('/dashboard/getCompaniesByFilter',body);eq(result.data.total,expected.length,'CSV data combination matches independent calculation');
 for(const group of result.data.groups)eq(group.count,expected.filter(r=>r.country.trim()===group.value).length,`country group ${group.value}`);
 for(const body of [{dimension:'invalid'},{dimension:'level',filter:{employees:{min:10,max:1}}},{dimension:'level',filter:{annual_revenue:{min:'0.001'}}},{dimension:'level',filter:{founded_year:{start:null}}}])eq((await request('/dashboard/getCompaniesByFilter',body)).status,400,'invalid request rejected by HTTP API');
 const marker=`Bar QA ${randomUUID()}`;
 const added=await request('/companies',{name:marker,level:marker,country:'QA',city:'QA City',founded_year:2000,annual_revenue:0,employees:0});eq(added.status,201,'temporary company for update verification');companyId=added.data.company.id;
 eq((await request('/dashboard/getCompaniesByFilter',{dimension:'city',filter:{level:[marker]}})).data.total,1,'new company included dynamically');
 await request(`/companies/${companyId}`,{city:'Updated QA City'},cookie,'PATCH');eq((await request('/dashboard/getCompaniesByFilter',{dimension:'city',filter:{level:[marker]}})).data.groups[0].value,'Updated QA City','edited company changes group');
 await request(`/companies/${companyId}`,undefined,cookie,'DELETE');companyId=undefined;eq((await request('/dashboard/getCompaniesByFilter',{dimension:'city',filter:{level:[marker]}})).data.total,0,'deleted company removed dynamically');
 const docs=(await request('/docs-json')).data;assert.ok(docs.paths['/dashboard/getCompaniesByFilter']?.post?.requestBody);checks++;
 console.log(`Completed ${checks} bar-chart assertions.`);
}finally{
 if(companyId)await pool.query('DELETE FROM companies WHERE id=$1',[companyId]);
 if(actorId)await pool.query('DELETE FROM users WHERE id=$1 AND email=$2',[actorId,email]);
 await pool.end();
}
