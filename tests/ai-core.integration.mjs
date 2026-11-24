import 'reflect-metadata';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);require('dotenv').config({path:'apps/api/.env',quiet:true});
const {Pool}=require('pg');const {createClient}=require('redis');
const {UserService}=require('../apps/api/src/user/user.service.ts');
const {AiCacheService}=require('../apps/api/src/ai-agent/infrastructure/ai-cache.service.ts');
const {AiScopeService}=require('../apps/api/src/ai-agent/application/ai-scope.service.ts');
const {AiDatabase}=require('../apps/api/src/ai-agent/infrastructure/ai-database.ts');
const {AiCoreService}=require('../apps/api/src/ai-agent/application/core.service.ts');
const {ModelGateway}=require('../apps/api/src/ai-agent/infrastructure/model-gateway.ts');
const {ChatService}=require('../apps/api/src/ai-agent/application/chat.service.ts');
const {RedisTaskCheckpointer}=require('../apps/api/src/ai-agent/infrastructure/redis-checkpointer.ts');
const {StateGraph,Annotation,START,END}=require('@langchain/langgraph');
const {emptyCheckpoint,uuid6}=require('@langchain/langgraph-checkpoint');
const pool=new Pool({connectionString:process.env.DATABASE_URL});const users=new UserService();const redis=createClient({url:process.env.REDIS_URL});redis.on('error',()=>{});
const cache=new AiCacheService(),db=new AiDatabase(),scopes=new AiScopeService();const checks=[],ids=[],cacheKeys=[];let server,serverLogs='',companyId;const actors={};const base='http://127.0.0.1:3031';const tenant=randomUUID(),otherTenant=randomUUID();
const check=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label);};
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks.push(label);console.log('PASS '+label);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,method='GET',body,actor='a'){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(actors[actor]?.cookie?{Cookie:actors[actor].cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data,headers:r.headers};}
async function code(path,method,body,status,label,actor='a'){const r=await request(path,method,body,actor);eq(r.status,status,label);return r.data;}
const corePath=r=>'/ai-agent/core/'+r;
try{
 const beforeSchema={columns:(await pool.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name IN ('users','companies','relationships') ORDER BY table_name,ordinal_position")).rows,counts:(await pool.query('SELECT (SELECT count(*) FROM companies)::int companies,(SELECT count(*) FROM relationships)::int relationships')).rows[0]};
 await redis.connect();await db.onModuleInit();
 for(const name of ['a','b','admin','c']){const user=await users.signup({email:`ai-core-${name}-${randomUUID()}@example.com`,password:'AiCoreTest2026!'});ids.push(user.id);actors[name]={id:user.id};}
 // Job title intentionally resembles an administrator role; it must never grant access.
 await pool.query("UPDATE users SET role='Administrator' WHERE id=$1",[actors.b.id]);
 process.env.AI_TENANT_MEMBERSHIPS=JSON.stringify(Object.fromEntries(Object.entries(actors).map(([n,a])=>[a.id,{tenantId:n==='c'?otherTenant:tenant,auditAdmin:n==='admin'}])));
 process.env.AI_BUSINESS_TENANT_ID=tenant;
 process.env.AI_CHAT_CACHE_POLICIES=JSON.stringify({companies:{enabled:true,ttl:600},conversation:{enabled:true,ttl:600},short:{enabled:true,ttl:1},off:{enabled:false,ttl:600}});
 server=spawn(process.execPath,['--import','tsx','src/main.ts'],{cwd:'apps/api',env:{...process.env,API_PORT:'3031',TSX_TSCONFIG_PATH:'tsconfig.json'},stdio:['ignore','pipe','pipe']});server.stdout.on('data',x=>serverLogs+=x);server.stderr.on('data',x=>serverLogs+=x);
 let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/health');if(r.ok){ready=true;break;}}catch{}if(server.exitCode!==null)break;await pause(100);}assert.ok(ready,'API startup: '+serverLogs.slice(-4000));
 for(const [name,a]of Object.entries(actors)){const r=await request('/auth/login','POST',{email:(await users.findById(a.id)).email,password:'AiCoreTest2026!'},'none');eq(r.status,200,`${name} JWT login`);a.cookie=r.headers.get('set-cookie').split(';')[0];}
 const scope=scopes.forUser(actors.a.id),admin=scopes.forUser(actors.admin.id),scopeB=scopes.forUser(actors.b.id),scopeC=scopes.forUser(actors.c.id);
 eq(scopes.forUser(randomUUID()).auditAdmin,false,'unconfigured account is never admin');eq(scope.tenantId,tenant,'server resolves trusted tenant');
 const made={};
 const bodies={sessions:{title:'核心模块会话',provider:'ollama'},memories:{memory_key:'project-preference',content:{language:'中文'}},tasks:{task_type:'future-report',input:{mode:'preview'}},audits:{action:'manual.note',details:{note:'isolated test'}}};
 const patches={sessions:{title:'已更新会话'},memories:{content:{language:'中文',updated:true}},tasks:{status:'running',progress:45},audits:{details:{note:'updated'}}};
 for(const resource of Object.keys(bodies)){
  const path=corePath(resource);
  for(const [method,suffix,body]of [['GET','',undefined],['POST','',bodies[resource]],['GET','/'+randomUUID(),undefined],['PATCH','/'+randomUUID(),patches[resource]],['DELETE','/'+randomUUID(),undefined]])await code(path+suffix,method,body,401,`${resource} ${method}${suffix?' ID':''} requires JWT`,'none');
  await code(path,'POST',{...bodies[resource],tenant_id:otherTenant},400,`${resource} rejects client tenant`);
  await code(path,'POST',{...bodies[resource],user_id:actors.b.id},400,`${resource} rejects client owner`);
  const row=await code(path,'POST',bodies[resource],201,`${resource} create`);made[resource]=row.id;
  eq(row.user_id,scope.userId,`${resource} auto owner`);eq(row.tenant_id,tenant,`${resource} auto tenant`);
  await code(path+'/'+row.id,'GET',undefined,200,`${resource} get ID`);
  const page=await code(path+'?page=0&limit=1','GET',undefined,200,`${resource} pagination`);eq(page.limit,1,`${resource} limit applied`);check(page.items.length<=1,`${resource} bounded items`);
  await code(path+'?user_id='+scope.userId,'GET',undefined,200,`${resource} self user filter`);
  await code(path+'?user_id='+actors.b.id,'GET',undefined,403,`${resource} peer filter denied`);
  await code(path+'?page=-1','GET',undefined,400,`${resource} invalid page`);await code(path+'?page=','GET',undefined,400,`${resource} blank page`);await code(path+'?limit=101','GET',undefined,400,`${resource} excessive limit`);await code(path+'?tenant_id='+otherTenant,'GET',undefined,400,`${resource} tenant query injection rejected`);
  for(const actor of ['b','c'])for(const method of ['GET','PATCH','DELETE'])await code(path+'/'+row.id,method,method==='PATCH'?patches[resource]:undefined,404,`${resource} ${method} denied for ${actor}`,actor);
  await code(path+'/'+row.id,'PATCH',{},400,`${resource} empty update rejected`);
  await code(path+'/'+row.id,'PATCH',patches[resource],200,`${resource} update`);
  await code(path+'/'+row.id,'PATCH',{...patches[resource],tenant_id:otherTenant},400,`${resource} update cannot move tenant`);
 }
 await code(corePath('memories'),'POST',bodies.memories,409,'duplicate memory key conflicts');
 for(const resource of ['memories','tasks','audits'])await code(corePath(resource),'POST',{},400,`${resource} required input`);
 await code(corePath('memories'),'POST',{memory_key:' ',content:{}},400,'blank memory key rejected');await code(corePath('memories')+'/'+made.memories,'PATCH',{content:null},400,'null update rejected');
 await code(corePath('tasks')+'/'+made.tasks,'PATCH',{progress:101},400,'task progress max validated');await code(corePath('tasks')+'/'+made.tasks,'PATCH',{status:'queued'},409,'task cannot go backwards');
 await code(corePath('tasks')+'/'+made.tasks,'PATCH',{status:'completed'},200,'task completes');eq((await request(corePath('tasks')+'/'+made.tasks)).data.progress,100,'completed task reaches 100');await code(corePath('tasks')+'/'+made.tasks,'PATCH',{progress:70},409,'completed task cannot reduce progress');
 const peerSession=await code(corePath('sessions'),'POST',{provider:'ollama'},201,'peer session create','b');
 await code(corePath('memories'),'POST',{memory_key:'foreign-link',content:{},session_id:peerSession.id},404,'cross-owner memory session denied');await code(corePath('tasks'),'POST',{task_type:'x',session_id:peerSession.id},404,'cross-owner task session denied');
 const peerAudit=await code(corePath('audits'),'POST',{action:'peer.note'},201,'peer manual audit','b');await code(corePath('audits')+'/'+peerAudit.id,'GET',undefined,200,'tenant audit admin reads peer','admin');await code(corePath('audits')+'/'+peerAudit.id,'PATCH',{details:{}},403,'admin cannot edit peer audit','admin');
 const allAudits=await code(corePath('audits')+'?user_id='+scope.userId,'GET',undefined,200,'admin user audit filter','admin');check(allAudits.items.every(r=>r.user_id===scope.userId&&r.tenant_id===tenant),'admin filter remains tenant scoped');
 const foreignAudit=await code(corePath('audits'),'POST',{action:'other-tenant'},201,'other tenant audit','c');await code(corePath('audits')+'/'+foreignAudit.id,'GET',undefined,404,'admin cannot read other tenant audit','admin');await code(corePath('audits')+'/'+peerAudit.id,'GET',undefined,404,'job-title Administrator grants no rights','a');
 const ownAudits=(await request(corePath('audits')+'?limit=100')).data.items;const systemAudit=ownAudits.find(r=>r.source==='system');check(!!systemAudit,'CRUD emits automatic system audit');await code(corePath('audits')+'/'+systemAudit.id,'PATCH',{action:'tamper'},403,'system audit update denied');await code(corePath('audits')+'/'+systemAudit.id,'DELETE',undefined,403,'system audit deletion denied');
 await assert.rejects(()=>pool.query('UPDATE ai_operation_audit SET action=$1 WHERE id=$2',['tamper',systemAudit.id]),e=>e.code==='23514');checks.push('database guards system audit immutability');
 // A record with the same owner but another tenant must remain invisible in legacy chat APIs too.
 const hidden=(await pool.query("INSERT INTO ai_chat_session(tenant_id,user_id,provider,model) VALUES($1,$2,'ollama','qwen3:8b') RETURNING id",[otherTenant,scope.userId])).rows[0];
 await code('/ai-agent/sessions/'+hidden.id,'GET',undefined,404,'legacy chat checks tenant even for same owner');
 const sid=made.sessions;await code(corePath('sessions')+'/'+sid,'PATCH',{closed:true},200,'close session');await code('/ai-agent/sessions/'+sid+'/messages','POST',{text:'x',fileIds:[],requestId:randomUUID()},409,'closed chat rejects messages');await code(corePath('sessions')+'/'+sid,'PATCH',{closed:false},200,'reopen session');
 // A real local model call verifies the existing chat path after migration/cache integration.
 const first=await code('/ai-agent/sessions/'+sid+'/messages','POST',{text:'请记住代号松林417，只回复已记住松林417。',fileIds:[],requestId:randomUUID()},200,'real model through cached session');eq(first.messages.at(-1).status,'complete','real model completed');check(first.messages.at(-1).content.markdown.includes('松林417'),'real model reply verified');
 const sk=cache.sessionKey(scope,sid);cacheKeys.push(sk);const cached=JSON.parse(await redis.get(sk));eq(cached.messages.length,2,'new messages auto populate session cache');check((await redis.ttl(sk))>7100,'session default TTL two hours');await redis.del(sk);
 await code('/ai-agent/sessions/'+sid,'GET',undefined,200,'reload after session cache eviction');check(await redis.exists(sk),'GET reload rebuilds short memory from PG');
 const second=await code('/ai-agent/sessions/'+sid+'/messages','POST',{text:'代号是什么？只回复代号。',fileIds:[],requestId:randomUUID()},200,'session fallback after cache eviction');check(second.messages.at(-1).content.markdown.includes('松林417'),'database fallback preserves remembered code');
 await code(corePath('sessions')+'/'+sid,'PATCH',{closed:true},200,'close populated session');eq(await redis.exists(sk),0,'close actively clears short-term cache');await code(corePath('sessions')+'/'+sid,'PATCH',{closed:false},200,'reopen populated session');
 let calls=0;const fake=new ModelGateway();fake.complete=async()=>`context test ${++calls}`;const chat=new ChatService(fake,cache,scopes);
 try{const s=await chat.create(scope.userId,'ollama');cacheKeys.push(cache.sessionKey(scope,s.session.id));for(let i=0;i<12;i++)await chat.send(scope.userId,s.session.id,{text:'context-window-'+i,fileIds:[],requestId:randomUUID()});const context=JSON.parse(await redis.get(cache.sessionKey(scope,s.session.id)));eq(context.messages.length,20,'short memory retains exactly ten rounds');eq(context.messages[0].content.markdown,'context-window-2','short memory evicts oldest two rounds');eq((await chat.get(scope.userId,s.session.id)).messages.length,24,'full durable history is not truncated');}finally{await chat.onModuleDestroy();}
 // Chat-result keys include actor, tenant, query parameters and domain generation.
 const q={tool:'dashboard.summary',question:'当前公司数量？'};
 const q1=await code('/ai-agent/tools/query','POST',q,200,'call existing dashboard Service');eq(q1.source,'existing-service','existing service provenance');eq(q1.cacheHit,false,'first business query miss');const q2=await request('/ai-agent/tools/query','POST',q);eq(q2.data.cacheHit,true,'identical actor question hits cache');eq(q1.data,q2.data.data,'cached body preserved');eq((await request('/ai-agent/tools/query','POST',q,'b')).data.cacheHit,false,'different user does not share result cache');await code('/ai-agent/tools/query','POST',q,403,'business dataset cross-tenant denied','c');
 await code('/ai-agent/tools/query','POST',{...q,tool:'arbitrary.sql'},400,'unknown tool rejected');await code('/ai-agent/tools/query','POST',{...q,parameters:{sql:'SELECT 1'}},400,'summary rejects arbitrary parameters');await code('/ai-agent/tools/query','POST',{tool:'companies.filter',question:'按国家统计',parameters:{dimension:'country',filter:{level:[2,3]}}},200,'existing filtered Service reused');await code('/ai-agent/tools/query','POST',{tool:'companies.filter',question:'x',parameters:{dimension:'bad'}},400,'existing filter validation reused');
 const before=q1.data.summary.companyCount;const c=await code('/companies','POST',{name:'AI cache isolated test',level:'test',country:'TestCountry',external_id:'ai-core-'+randomUUID()},201,'create isolated company to invalidate cache');companyId=c.company.id;
 const after=await request('/ai-agent/tools/query','POST',q);eq(after.data.cacheHit,false,'company create actively invalidates business cache');eq(after.data.data.summary.companyCount,before+1,'updated business count visible');
 await code('/companies/'+companyId,'PATCH',{name:'AI cache updated'},200,'update isolated company');eq((await request('/ai-agent/tools/query','POST',q)).data.cacheHit,false,'company update invalidates cache');await code('/companies/'+companyId,'DELETE',undefined,200,'delete isolated company');companyId=undefined;const restored=(await request('/ai-agent/tools/query','POST',q)).data;eq(restored.cacheHit,false,'company delete invalidates cache');eq(restored.data.summary.companyCount,before,'business dataset restored');
 let loads=0;const load=async()=>++loads;await cache.result(scope,'short','ttl',{},load);eq((await cache.result(scope,'short','ttl',{},load)).cacheHit,true,'short policy cache hit');await pause(1100);eq((await cache.result(scope,'short','ttl',{},load)).cacheHit,false,'result TTL expires');eq((await cache.result(scope,'off','disabled',{},load)).cacheHit,false,'domain switch disables cache');eq((await cache.result(scope,'off','disabled',{},load)).cacheHit,false,'disabled domain never caches');
 let release;const inFlight=cache.result(scope,'companies','race-'+randomUUID(),{},async()=>await new Promise(r=>release=r));while(!release)await pause(5);await cache.invalidateCompanies();release('old');await inFlight;check(true,'invalidation racing query completes safely');
 const task=await code(corePath('tasks'),'POST',{task_type:'checkpoint-demo'},201,'checkpoint backing task');const statePath=corePath('tasks')+'/'+task.id+'/state';cacheKeys.push(cache.taskKey(scope,task.id));await code(statePath,'POST',{state:{step:'pending'},ttl:1},200,'temporary state write');eq((await request(statePath)).data.state,{step:'pending'},'temporary state read');await code(statePath,'GET',undefined,404,'task state user isolation','b');await pause(1100);eq((await request(statePath)).data.state,null,'temporary task state auto expires');eq((await request(statePath)).data.durable.status,'queued','durable task survives cache expiry');
 const core=new AiCoreService(db,scopes,cache,new ModelGateway());const saver=new RedisTaskCheckpointer(cache,scope,task.id,()=>core.find('tasks',scope,task.id));
 const ann=Annotation.Root({n:Annotation({reducer:(a,b)=>a+b,default:()=>0})});const graph=new StateGraph(ann).addNode('plus',()=>({n:1})).addEdge(START,'plus').addEdge('plus',END).compile({checkpointer:saver});const config={configurable:{thread_id:task.id}};
 eq((await graph.invoke({n:2},config)).n,3,'real LangGraph invokes Redis checkpointer');
 const saver2=new RedisTaskCheckpointer(cache,scope,task.id,()=>core.find('tasks',scope,task.id));const graph2=new StateGraph(ann).addNode('plus',()=>({n:1})).addEdge(START,'plus').addEdge('plus',END).compile({checkpointer:saver2});eq((await graph2.invoke({n:2},config)).n,6,'new graph instance restores checkpoint');let checkpoints=[];for await(const item of saver2.list(config))checkpoints.push(item);check(checkpoints.length>=4,'checkpoint list supports history');const latest=await saver2.getTuple(config);check(!!latest.parentConfig,'checkpoint parent linkage retained');
 await Promise.all([saver2.putWrites(latest.config,[['parallelA',1]],'task-A','a'),saver2.putWrites(latest.config,[['parallelB',2]],'task-B','b')]);const writes=(await saver2.getTuple(latest.config)).pendingWrites;check(writes.some(w=>w[1]==='parallelA')&&writes.some(w=>w[1]==='parallelB'),'concurrent pending writes both retained');
 await assert.rejects(()=>saver2.getTuple({configurable:{thread_id:randomUUID()}}));checks.push('checkpointer rejects arbitrary thread');const deniedSaver=new RedisTaskCheckpointer(cache,scopeB,task.id,()=>core.find('tasks',scopeB,task.id));await assert.rejects(()=>deniedSaver.getTuple(config),e=>e.getStatus()===404);checks.push('checkpointer enforces durable ownership');await saver2.deleteThread(task.id);eq(await saver2.getTuple(config),undefined,'deleteThread removes temporary checkpoints');
 const expiring=new RedisTaskCheckpointer(cache,scope,task.id,()=>core.find('tasks',scope,task.id),1);
 const cp={...emptyCheckpoint(),id:uuid6()};await expiring.put(config,cp,{source:'input',step:0,parents:{}},{});check(!!await expiring.getTuple(config),'short TTL checkpoint initially readable');await pause(1100);eq(await expiring.getTuple(config),undefined,'checkpoint expires automatically');check(!!await core.find('tasks',scope,task.id),'checkpoint expiry preserves durable task record');
 const priorRedis=process.env.REDIS_URL;process.env.REDIS_URL='redis://127.0.0.1:26379';const offlineCache=new AiCacheService();process.env.REDIS_URL=priorRedis;
 try{eq(await offlineCache.session(scope,randomUUID(),'1',async()=>['database fallback']),['database fallback'],'Redis outage falls back to database context');eq((await offlineCache.result(scope,'companies','offline',{},async()=>42)).data,42,'Redis outage still executes actual Service');eq(await offlineCache.setTaskState(scope,task.id,{step:1}),false,'Redis outage does not fake task-state persistence');}finally{await offlineCache.onModuleDestroy();}
 for(const resource of Object.keys(made)){await code(corePath(resource)+'/'+made[resource],'DELETE',undefined,200,`${resource} delete own manual record`);await code(corePath(resource)+'/'+made[resource],'GET',undefined,404,`${resource} deleted record unavailable`);}
 const spec=await (await fetch(base+'/docs-json')).json();const parser=require('@apidevtools/swagger-parser');await parser.validate(spec);eq(Object.values(spec.paths).reduce((n,x)=>n+['get','post','patch','delete','put'].filter(k=>k in x).length,0),61,'Swagger validates all 61 APIs');
 const columns=(await pool.query("SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_name IN ('users','companies','relationships') ORDER BY table_name,ordinal_position")).rows;eq(columns,beforeSchema.columns,'all original business column definitions unchanged');eq((await pool.query('SELECT count(*)::int n FROM companies')).rows[0].n,beforeSchema.counts.companies,'company count restored');eq((await pool.query('SELECT count(*)::int n FROM relationships')).rows[0].n,beforeSchema.counts.relationships,'relationship count unchanged');
 const reportDir=process.env.AI_CORE_REPORT_DIR||'tmp/ai-core-current';await mkdir(reportDir,{recursive:true});await writeFile(reportDir+'/openapi.json',JSON.stringify(spec,null,2));await writeFile(reportDir+'/test-results.json',JSON.stringify({date:new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney'}).format(new Date()),passed:checks.length,checks,realModel:'local Ollama qwen3:8b; 2 actual replies',checkpointer:'actual LangGraph graph invocation and cross-instance restore',businessSchemaUnchanged:true},null,2));console.log('Completed '+checks.length+' AI core assertions.');
}finally{
 if(server){server.kill('SIGTERM');await pause(500);}if(companyId)await pool.query('DELETE FROM companies WHERE id=$1',[companyId]);
 // Delete only this test run's keys, never FLUSHDB or unrelated application state.
 if(redis.isOpen){for(const user of ids)for await(const key of redis.scanIterator({MATCH:'ai:*:'+user+':*',COUNT:100}))for(const item of Array.isArray(key)?key:[key])await redis.del(item);for(const key of cacheKeys)await redis.del(key);await redis.quit();}
 for(const id of ids)await pool.query('DELETE FROM users WHERE id=$1',[id]);await cache.onModuleDestroy();await db.onModuleDestroy();await users.onModuleDestroy();await pool.end();
}
