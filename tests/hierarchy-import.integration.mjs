import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve,join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const require=createRequire(import.meta.url);require('dotenv').config({path:'apps/api/.env',quiet:true});const {Pool}=require('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL});
const key='hierarchy-qa-'+randomUUID();const folder=await mkdtemp(join(tmpdir(),'hierarchy-csv-'));const cp=join(folder,'companies.csv'),rp=join(folder,'relationships.csv');let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label);};
const run=async(flags=[])=>promisify(execFile)(process.execPath,['--import','tsx','src/import-csv.ts',cp,rp,...flags],{cwd:resolve('apps/api'),env:process.env});
const header='company_code,company_name,level,country,city,founded_year,annual_revenue,employees\n';
try{
 await writeFile(cp,header+`${key}-a,"根公司,测试",1,China,Beijing,1994,1000,10\n${key}-b,子公司测试,2,Japan,Tokyo,2000,2000,20\n${key}-c,孙公司测试,3,China,Shanghai,2001,3000,30\n`);
 await writeFile(rp,`company_code,parent_company\n${key}-a,\n${key}-b,${key}-a\n${key}-c,${key}-b\n`);
 let result=JSON.parse((await run(['--dry-run'])).stdout.trim());eq(result.roots,1,'root marker recognized');eq(result.relationshipsInserted,2,'root does not generate a relationship');eq((await pool.query('SELECT count(*)::int n FROM companies WHERE external_id LIKE $1',[key+'%'])).rows[0].n,0,'hierarchy dry run writes nothing');
 result=JSON.parse((await run()).stdout.trim());eq(result.relationshipFormat,'parent-child','hierarchy format identified');
 const ids=(await pool.query('SELECT id,external_id,name FROM companies WHERE external_id LIKE $1',[key+'%'])).rows;eq(ids.length,3,'company_code alias mapped to external_id');eq(ids.find(r=>r.external_id===key+'-a').name,'根公司,测试','company_name alias preserves quoted comma');
 const rows=(await pool.query('SELECT p.external_id parent,c.external_id child,r.supplier_id,r.customer_id FROM relationships r JOIN companies p ON p.id=r.parent_company_id JOIN companies c ON c.id=r.child_company_id WHERE c.external_id LIKE $1 ORDER BY c.external_id',[key+'%'])).rows;
 eq(rows.map(r=>[r.parent,r.child]),[[key+'-a',key+'-b'],[key+'-b',key+'-c']],'parent-child direction preserved');eq(rows.every(r=>r.supplier_id===null&&r.customer_id===null),true,'hierarchy not mislabeled as trade relationship');
 result=JSON.parse((await run()).stdout.trim());eq(result.relationshipsInserted,0,'repeat hierarchy import adds no duplicate edges');
 await writeFile(cp,header+`${key}-a,不应写入,1,China,Beijing,1994,1000,10\n`);
 await writeFile(rp,`company_code,parent_company\n${key}-a,${key}-missing\n`);
 await assert.rejects(run());eq((await pool.query('SELECT name FROM companies WHERE external_id=$1',[key+'-a'])).rows[0].name,'根公司,测试','missing parent rolls back company upsert');
 await writeFile(rp,`company_code,parent_company\n${key}-a,${key}-b\n${key}-b,${key}-a\n`);await assert.rejects(run(),/循环/);console.log('PASS cyclic hierarchy rejected');
 await writeFile(rp,`company_code,parent_company\n${key}-a,${key}-a\n`);await assert.rejects(run(),/自关联/);console.log('PASS self relation rejected');
 await writeFile(rp,`company_code,parent_company\n${key}-a,\n${key}-a,${key}-b\n`);await assert.rejects(run(),/多次上级定义/);console.log('PASS duplicate parent definition rejected');
 console.log(`Completed ${checks} hierarchy import assertions plus failure cases.`);
}finally{
 await pool.query('DELETE FROM relationships WHERE parent_company_id IN (SELECT id FROM companies WHERE external_id LIKE $1) OR child_company_id IN (SELECT id FROM companies WHERE external_id LIKE $1)',[key+'%']);
 await pool.query('DELETE FROM companies WHERE external_id LIKE $1',[key+'%']);await pool.end();await rm(folder,{recursive:true,force:true});
}
