import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, WatchError } from 'redis';
import { createHash, randomUUID } from 'node:crypto';
import type { AiScope } from '../application/ai-scope.service';
export const AI_CACHE_PREFIXES={session:'ai:session:',chat:'ai:chat_cache:',llm:'ai:llm_cache:',task:'ai:task_state:'} as const;
const digest=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex');
function stable(v:unknown):string {if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}';return JSON.stringify(v)??'null';}
export type CachedContext<T>={revision:string;messages:T[]};
@Injectable()
export class AiCacheService implements OnModuleDestroy {
 private readonly log=new Logger(AiCacheService.name);
 private readonly client=createClient({url:process.env.REDIS_URL,socket:{connectTimeout:1000,reconnectStrategy:false},disableOfflineQueue:true});
 private connecting?:Promise<void>;private dirty=new Set<string>();private warned=false;
 constructor(){this.client.on('error',()=>{if(!this.warned){this.log.warn('AI Redis unavailable; durable storage remains authoritative');this.warned=true;}});}
 private async ready(){if(!this.client.isReady){if(!this.connecting)this.connecting=this.client.connect().then(()=>{this.warned=false;}).finally(()=>{this.connecting=undefined;});await this.connecting;}}
 private async attempt<T>(operation:()=>Promise<T>):Promise<T|undefined>{try{await this.ready();return await operation();}catch{return undefined;}}
 async onModuleDestroy(){if(this.client.isOpen)this.client.destroy();}
 private scope(s:AiScope){return `${s.tenantId}:${s.userId}:`;}
 sessionKey(s:AiScope,id:string){return AI_CACHE_PREFIXES.session+this.scope(s)+id;}
 taskKey(s:AiScope,id:string){return AI_CACHE_PREFIXES.task+this.scope(s)+id;}
 async session<T>(s:AiScope,id:string,revision:string,load:()=>Promise<T[]>):Promise<T[]> {
  const key=this.sessionKey(s,id);const hit=await this.attempt(()=>this.client.get(key));
  if(hit)try{const item=JSON.parse(hit) as CachedContext<T>;if(item.revision===revision&&Array.isArray(item.messages))return item.messages;}catch{}
  const messages=(await load()).slice(-20);
  await this.attempt(()=>this.client.set(key,JSON.stringify({revision,messages}),{EX:7200}));return messages;
 }
 async clearSession(s:AiScope,id:string){await this.attempt(()=>this.client.del(this.sessionKey(s,id)));}
 private policy(domain:string){const defaults={enabled:true,ttl:600};try{const p=JSON.parse(process.env.AI_CHAT_CACHE_POLICIES||'{}')[domain];if(p===undefined)return defaults;if(typeof p.enabled!=='boolean'||!Number.isInteger(p.ttl)||p.ttl<1||p.ttl>86400)throw Error();return p as typeof defaults;}catch{return {enabled:false,ttl:600};}}
 private versionKey(domain:string){return AI_CACHE_PREFIXES.chat+'version:'+digest(domain);}
 private async version(domain:string){if(this.dirty.has(domain)){const changed=await this.attempt(()=>this.client.set(this.versionKey(domain),randomUUID()));if(changed===undefined)return undefined;this.dirty.delete(domain);}return this.attempt(async()=>{await this.client.set(this.versionKey(domain),'initial',{NX:true});return (await this.client.get(this.versionKey(domain)))!;});}
 async result<T>(s:AiScope,domain:string,question:string,parameters:unknown,load:()=>Promise<T>):Promise<{data:T;cacheHit:boolean}> {
  const policy=this.policy(domain);if(!policy.enabled)return {data:await load(),cacheHit:false};
  const version=await this.version(domain);if(version===undefined)return {data:await load(),cacheHit:false};
  const key=AI_CACHE_PREFIXES.chat+this.scope(s)+digest({domain,question:question.trim().normalize('NFC'),parameters,version});
  const hit=await this.attempt(()=>this.client.get(key));if(hit)try{return {data:JSON.parse(hit) as T,cacheHit:true};}catch{}
  const data=await load();
  // An invalidation racing a slow query must not repopulate the old generation.
  await this.attempt(()=>this.client.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]) end return 0",{keys:[this.versionKey(domain),key],arguments:[version,JSON.stringify(data),String(policy.ttl)]}));
  return {data,cacheHit:false};
 }
 async invalidateDomain(domain:string){this.dirty.add(domain);await this.version(domain);}
 async invalidateCompanies(){await this.invalidateDomain('companies');}
 async invalidateUsers(){await this.invalidateDomain('users');}
 async getTaskState<T>(s:AiScope,id:string):Promise<T|undefined>{const value=await this.attempt(()=>this.client.get(this.taskKey(s,id)));if(!value)return undefined;try{return JSON.parse(value) as T;}catch{return undefined;}}
 async setTaskState(s:AiScope,id:string,state:unknown,ttl=7200){if(!Number.isInteger(ttl)||ttl<1||ttl>86400)throw new Error('Invalid task TTL');const ok=await this.attempt(()=>this.client.set(this.taskKey(s,id),JSON.stringify(state),{EX:ttl}));return ok!==undefined;}
 async clearTaskState(s:AiScope,id:string){await this.attempt(()=>this.client.del(this.taskKey(s,id)));}
 /** Atomic read-modify-write, including TTL, used by concurrent checkpoint writes. */
 async mutateTaskState<T>(s:AiScope,id:string,mutate:(state:T|undefined)=>T,ttl=7200){
  if(!Number.isInteger(ttl)||ttl<1||ttl>86400)throw new Error('Invalid task TTL');
  await this.ready();const key=this.taskKey(s,id);
  // Dedicated connection per WATCH transaction avoids concurrent requests sharing WATCH state.
  const connection=this.client.duplicate();connection.on('error',()=>{});await connection.connect();try{for(let retry=0;retry<8;retry++){await connection.watch(key);const raw=await connection.get(key);const next=mutate(raw?JSON.parse(raw) as T:undefined);try{await connection.multi().set(key,JSON.stringify(next),{EX:ttl}).exec();return;}catch(e){if(!(e instanceof WatchError))throw e;}}throw Error('Checkpoint contention');}finally{connection.destroy();}
 }
}
