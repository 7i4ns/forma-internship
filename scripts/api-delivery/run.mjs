import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID,randomBytes,scryptSync,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('dotenv').config({path:'apps/api/.env',quiet:true});
const {Pool}=require('pg');const newman=require('newman');const dir=process.env.API_TEST_OUTPUT_DIR||'tmp/api-legacy-current';await mkdir(dir,{recursive:true});
const pool=new Pool({connectionString:process.env.DATABASE_URL});const runId='postman-qa-'+randomUUID();const linked=randomUUID(),peer=randomUUID();let summary,cleanup;
async function fingerprint(){const result={};for(const table of ['companies','relationships','users']){const rows=(await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;result[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};}return result;}
const previous=await readFile(dir+'/newman-results.json','utf8').then(JSON.parse).catch(()=>null);
const cooldown=previous?65000-(Date.now()-Date.parse(previous.generatedAt)):0;
if(cooldown>0){console.log('等待登录限流窗口恢复后重新执行完整测试…');await new Promise(resolve=>setTimeout(resolve,cooldown));}
const prepare=process.argv.includes('--prepare');let prepared=false;
const before=await fingerprint();
try{
 const salt=randomBytes(16).toString('hex');const hash=`scrypt:${salt}:${scryptSync('ApiTest2026!',salt,64).toString('hex')}`;
 await pool.query("INSERT INTO users(email,name,role,status,password_hash) VALUES($1,$2,'Postman QA','inactive',$3)",[runId+'-inactive@example.com',runId+' Inactive',hash]);
 for(const [id,suffix]of [[linked,'linked'],[peer,'peer']])await pool.query("INSERT INTO companies(id,external_id,name,level,country,employees,annual_revenue,founded_year) VALUES($1,$2,$3,'QA Fixture','QA Fixture',1,1,2000)",[id,runId+'-'+suffix,runId+' '+suffix]);
 await pool.query("INSERT INTO relationships(parent_company_id,child_company_id,relationship_type) VALUES($1,$2,'parent_of')",[linked,peer]);
 const env={id:randomUUID(),name:'本轮隔离测试环境 - 自动生成',values:Object.entries({baseUrl:'http://127.0.0.1:3001',maxResponseMs:'2000',runId,missingId:randomUUID(),linkedCompanyId:linked}).map(([key,value])=>({key,value,enabled:true,type:'default'})),_postman_variable_scope:'environment'};
 await writeFile('postman/local-qa.postman_environment.json',JSON.stringify(env,null,2));
 const collection=JSON.parse(await readFile('postman/all-apis.postman_collection.json','utf8'));
 if(prepare){await mkdir('tmp',{recursive:true});await writeFile('tmp/api-delivery-fixture.json',JSON.stringify({runId,linked,peer,before},null,2));prepared=true;console.log('隔离夹具已就绪。请导入Postman集合与local-qa环境，顺序运行；完成后执行 npm run api:cleanup。');}
 else summary=await new Promise((resolve,reject)=>newman.run({collection,environment:env,reporters:['cli','junit'],reporter:{junit:{export:dir+'/newman-junit.xml'}},timeoutRequest:10000,delayRequest:35},(error,result)=>error?reject(error):resolve(result)));
}finally{
 if(!prepare||!prepared){
 await pool.query('DELETE FROM relationships WHERE parent_company_id=$1 AND child_company_id=$2',[linked,peer]);
 await pool.query('DELETE FROM companies WHERE external_id LIKE $1',[runId+'-%']);
 await pool.query('DELETE FROM users WHERE email LIKE $1',[runId+'-%@example.com']);
 const after=await fingerprint();cleanup={before,after,restored:JSON.stringify(before)===JSON.stringify(after)};
 await writeFile(`${dir}/data-integrity.json`,JSON.stringify(cleanup,null,2));}
 await pool.end();
}
if(prepare)process.exit(0);
const executions=summary.run.executions.map(e=>({id:e.item.name.split(' ')[0],name:e.item.name,method:e.request.method,url:e.request.url.toString(),status:e.response?.code,responseTimeMs:e.response?.responseTime,responseSize:e.response?.responseSize,body:e.response?.stream?JSON.parse(e.response.stream.toString()):null,assertions:e.assertions?.map(a=>({name:a.assertion,passed:!a.error,...(a.error?{error:a.error.message}:{})}))}));
const times=executions.map(e=>e.responseTimeMs).filter(Number.isFinite).sort((a,b)=>a-b);const percentile=p=>times[Math.max(0,Math.ceil(times.length*p)-1)];
const result={generatedAt:new Date().toISOString(),tool:'Newman (real Postman Collection Runner)',runId,requestCount:executions.length,assertionCount:summary.run.stats.assertions.total,failedAssertions:summary.run.stats.assertions.failed,failures:summary.run.failures.map(f=>({source:f.source?.name,error:f.error?.message})),performance:{thresholdMs:2000,minMs:times[0],meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:times.at(-1),note:'单次本地顺序执行的响应时间冒烟检查；不是并发负载测试或生产SLA。'},dataIntegrity:cleanup,executions};
await writeFile(`${dir}/newman-results.json`,JSON.stringify(result,null,2));if(summary.run.failures.length||!cleanup.restored)process.exitCode=1;
console.log(JSON.stringify({requestCount:result.requestCount,assertionCount:result.assertionCount,failed:result.failures.length,performance:result.performance,dataRestored:cleanup.restored},null,2));
