import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('dotenv').config({ path: 'apps/api/.env', quiet: true });
const { Pool } = require('pg');
const { DASHBOARD_SQL } = require('../apps/api/src/dashboard/dashboard.service.ts');
const { compactNumber } = require('../apps/web/lib/dashboard.ts');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
let checks = 0;
const eq = (a,b,label) => { assert.deepEqual(a,b,label); checks++; console.log(`PASS ${label}`); };
try {
  for (const [input,text,unit] of [['0','0',''],['9999','9,999',''],['10000','1','万'],['12500.5','1.25','万'],['100000000','1','亿'],['1000000000000','1','万亿'],['10000000000000000','1','京'],['9999.999','1','万'],['99999999.99','1','亿'],['1999999999999999999.98','200','京']]) {
    const result = compactNumber(input); eq({text:result.text,unit:result.unit},{text,unit},`compact ${input}`);
  }
  eq(compactNumber('1999999999999999999.98').exact,'1,999,999,999,999,999,999.98','large decimal exact value retained');
  assert.throws(()=>compactNumber('NaN')); assert.throws(()=>compactNumber('-1'));
  await client.query('BEGIN');
  // A connection-local temporary table shadows the production table. No existing
  // companies are truncated, replaced or changed by these edge-case fixtures.
  await client.query('CREATE TEMP TABLE companies (annual_revenue numeric, employees integer, founded_year integer, country text, level text) ON COMMIT DROP');
  const aggregate = async () => (await client.query(DASHBOARD_SQL,[2026])).rows[0].dashboard;
  let data = await aggregate();
  eq(data.summary.companyCount,0,'empty company count'); eq(data.summary.totalRevenue,'0','empty revenue'); eq(data.summary.totalEmployees,'0','empty employees'); eq(data.levels,[],'empty distribution'); eq(data.growth,[],'empty year series');
  const fixtures = [[100.25,10,2000,' China ','Tier 1'],[200,10,2001,'china','Tier 1'],[300.75,null,2001,'Japan','Tier 2'],[null,20,2001,' japan ','Tier 2'],[0,0,2003,'Australia','Tier 2'],[999,5,null,' ',null],[50.5,8,2031,'USA','Tier 3']];
  for (const row of fixtures) await client.query('INSERT INTO companies VALUES($1,$2,$3,$4,$5)',row);
  data = await aggregate();
  eq(data.summary.companyCount,7,'all companies included'); eq(data.summary.countryCount,4,'trim/case unique countries, blank excluded'); eq(data.summary.totalRevenue,'1650.50','decimal sum exact, null ignored'); eq(data.summary.totalEmployees,'53','employee sum includes valid zero'); eq(data.summary.revenueReported,6,'missing revenue coverage'); eq(data.summary.employeesReported,6,'missing employee coverage');
  eq(data.levels.reduce((n,x)=>n+x.count,0),7,'distribution covers all companies');
  eq(data.levels.find(x=>x.level==='Tier 2'),{level:'Tier 2',count:3,percentage:42.86},'level count and percentage denominator');
  eq(data.levels.find(x=>x.level==='未分类').count,1,'blank level included as unclassified');
  eq(data.growth[0],{year:2000,added:1,cumulative:1},'first year count'); eq(data.growth[1],{year:2001,added:3,cumulative:4},'1 then 3 becomes cumulative 4'); eq(data.growth[2],{year:2002,added:0,cumulative:4},'missing intermediate year carried forward'); eq(data.growth[3],{year:2003,added:1,cumulative:5},'later addition'); eq(data.growth.at(-1),{year:2026,added:0,cumulative:5},'series extended through current year');
  eq(data.coverage,{yearKnown:5,yearExcluded:2,yearMissing:1,yearInvalid:1},'unknown and future years counted separately');
  await client.query('TRUNCATE companies');
  for (const year of [null,2030]) await client.query('INSERT INTO companies VALUES(NULL,NULL,$1,NULL,NULL)',[year]);
  data=await aggregate();eq(data.growth,[],'no valid years creates no false trend');eq(data.coverage.yearExcluded,2,'all invalid/missing years excluded');
  await client.query('TRUNCATE companies');
  await client.query("INSERT INTO companies VALUES (999999999999999999.99,2147483647,2000,'A','X'),(999999999999999999.99,2147483647,2001,'B','X')");
  data=await aggregate();eq(data.summary.totalRevenue,'1999999999999999999.98','huge revenue total remains decimal string');eq(data.summary.totalEmployees,'4294967294','employee sum exceeds int32 safely');
  await client.query('ROLLBACK');
} catch(error) { await client.query('ROLLBACK'); throw error; }
finally { client.release(); }
const base=process.env.TEST_API_URL || 'http://127.0.0.1:3001';
const email=`dashboard-qa-${randomUUID()}@example.com`; let companyId; let actorId; let cookie;
async function request(path,method='GET',body,session=cookie) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(session?{Cookie:session}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie'),cache:response.headers.get('cache-control')};
}
const cents = text => {const [a,b='']=text.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));};
try {
  eq((await request('/dashboard')).status,401,'dashboard requires login');
  const signup=await request('/auth/signup','POST',{email,password:'DashboardQA2026!'});eq(signup.status,201,'create isolated API test actor');actorId=signup.data.user.id;
  const login=await request('/auth/login','POST',{email,password:'DashboardQA2026!'});cookie=login.cookie.split(';')[0];
  const baseline=await request('/dashboard');eq(baseline.status,200,'authenticated dashboard responds');eq(baseline.cache,'no-store','dashboard not cached');
  const created=await request('/companies','POST',{name:`Dashboard QA ${randomUUID()}`,level:'Dashboard QA',country:'QA test country',founded_year:2000,annual_revenue:1234.56,employees:7});
  eq(created.status,201,'company creation for live update');companyId=created.data.company.id;
  let result=(await request('/dashboard')).data;
  eq(result.summary.companyCount,baseline.data.summary.companyCount+1,'new company updates card');eq(cents(result.summary.totalRevenue)-cents(baseline.data.summary.totalRevenue),123456n,'new company updates revenue card');eq(BigInt(result.summary.totalEmployees)-BigInt(baseline.data.summary.totalEmployees),7n,'new company updates employees');eq(result.summary.countryCount,baseline.data.summary.countryCount+1,'new country updates distinct count');eq(result.levels.find(x=>x.level==='Dashboard QA').count,1,'new level updates doughnut');eq(result.growth.at(-1).cumulative,baseline.data.coverage.yearKnown+1,'new company updates cumulative line');
  eq((await request(`/companies/${companyId}`,'PATCH',{annual_revenue:2000.56,employees:9,founded_year:2001})).status,200,'update company metrics');
  result=(await request('/dashboard')).data;eq(cents(result.summary.totalRevenue)-cents(baseline.data.summary.totalRevenue),200056n,'edited revenue reflected');eq(BigInt(result.summary.totalEmployees)-BigInt(baseline.data.summary.totalEmployees),9n,'edited employees reflected');
  eq((await request(`/companies/${companyId}`,'DELETE')).status,200,'delete temporary company');companyId=undefined;
  result=(await request('/dashboard')).data;eq(result.summary,baseline.data.summary,'deletion restores baseline metrics');eq(result.levels,baseline.data.levels,'deletion restores distribution');eq(result.growth,baseline.data.growth,'deletion restores growth');
  const doc=await (await fetch(base+'/docs-json')).json();assert.ok(doc.paths['/dashboard']?.get);console.log('PASS dashboard Swagger documentation');
  console.log(`Completed ${checks} dashboard assertions plus invalid input / Swagger checks.`);
} finally {
  if(companyId)await pool.query('DELETE FROM companies WHERE id=$1',[companyId]);
  if(actorId)await pool.query('DELETE FROM users WHERE id=$1 AND email=$2',[actorId,email]);
  else await pool.query('DELETE FROM users WHERE email=$1',[email]);
  await pool.end();
}
