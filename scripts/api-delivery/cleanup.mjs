import {readFile,unlink} from 'node:fs/promises';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('dotenv').config({path:'apps/api/.env',quiet:true});const {Pool}=require('pg');
const state=JSON.parse(await readFile('tmp/api-delivery-fixture.json','utf8'));
if(!/^postman-qa-[0-9a-f-]{36}$/.test(state.runId))throw new Error('Invalid fixture scope');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{await pool.query('DELETE FROM relationships WHERE parent_company_id=$1 AND child_company_id=$2',[state.linked,state.peer]);await pool.query('DELETE FROM companies WHERE external_id LIKE $1',[state.runId+'-%']);await pool.query('DELETE FROM users WHERE email LIKE $1',[state.runId+'-%@example.com']);await unlink('tmp/api-delivery-fixture.json');console.log('本轮Postman临时数据已清理。');}finally{await pool.end();}
