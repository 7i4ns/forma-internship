import type { OpenAPIObject, SchemaObject, OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
const str=(extra:Partial<SchemaObject>={}):SchemaObject=>({type:'string',...extra});
const object=(properties:Record<string,SchemaObject>,required=Object.keys(properties)):SchemaObject=>({type:'object',properties,required});
const json:SchemaObject={type:'object',additionalProperties:true};
export function applyAiCoreDocs(doc:OpenAPIObject){
 const uuid=str({format:'uuid'}),date=str({format:'date-time'});const base={id:uuid,tenant_id:uuid,user_id:uuid,created_at:date,updated_at:date};
 const schemas:Record<string,SchemaObject>={
  AiSessionRecord:object({...base,title:str(),provider:str({enum:['ollama','deepseek','qwen','gpt','kimi']}),model:str(),state:str({enum:['idle','thinking']}),is_demo:{type:'boolean'},active_message_id:{...uuid,nullable:true},generation_started_at:{...date,nullable:true},closed_at:{...date,nullable:true},deleted_at:{...date,nullable:true}}),
  AiMemoryRecord:object({...base,session_id:{...uuid,nullable:true},memory_key:str(),content:json}),
  AiTaskRecord:object({...base,session_id:{...uuid,nullable:true},task_type:str(),status:str({enum:['queued','running','completed','failed','cancelled']}),progress:{type:'integer',minimum:0,maximum:100},input:json,output:json}),
  AiAuditRecord:object({...base,action:str(),result:str({enum:['success','failure']}),source:str({enum:['manual','system']}),target_type:str({nullable:true}),target_id:{...uuid,nullable:true},details:json}),
 };
 doc.components??={};doc.components.schemas={...doc.components.schemas,...schemas};
 for(const [path,methods]of Object.entries(doc.paths)){
  if(!path.startsWith('/ai-agent/core/')&&!path.startsWith('/ai-agent/tools/'))continue;
  for(const method of ['get','post','patch','delete'] as const){const op=methods[method] as OperationObject|undefined;if(!op)continue;
   op.security=[{session:[]}];op.operationId=`aiCore_${method}_${path.replace(/[^a-zA-Z0-9]/g,'_')}`;
   const schemaName=path.includes('/sessions')?'AiSessionRecord':path.includes('/memories')?'AiMemoryRecord':path.includes('/tasks')?'AiTaskRecord':'AiAuditRecord';
   const record={$ref:`#/components/schemas/${schemaName}`};let schema:SchemaObject|{$ref:string}=record;
   if(path.endsWith('/query'))schema=object({tool:str(),source:str({enum:['existing-service']}),cacheHit:{type:'boolean'},data:json});
   else if(path.endsWith('/state'))schema=method==='get'?object({state:{...json,nullable:true},durable:object({status:str(),progress:{type:'integer'}}),temporary:{type:'boolean'}}):object({stored:{type:'boolean'},ttl:{type:'integer'}});
   else if(method==='delete')schema=object({message:str()});
   else if(method==='get'&&!path.includes('{id}'))schema={type:'object',required:['items','total','page','limit'],properties:{items:{type:'array',items:record},total:{type:'integer'},page:{type:'integer'},limit:{type:'integer'}}};
   const status=method==='post'&&!path.endsWith('/query')&&!path.endsWith('/state')?201:200;
   op.responses={[status]:{description:'成功',content:{'application/json':{schema}}}};
   for(const [code,description]of Object.entries({400:'参数、额外字段、UUID、空更新或关联错误',401:'JWT未登录、过期或账号停用',403:'用户/租户/系统审计保护；公司数据集未授权',404:'记录不存在或不属于作用域',409:'重复记忆键、会话忙、非法任务状态或临时缓存不可用'}))op.responses[code]={description,content:{'application/json':{schema:{$ref:'#/components/schemas/ErrorResponse'}}}};
  }
 }
 for(const [name,schema]of Object.entries(doc.components.schemas))if(name.startsWith('Ai')&&name.endsWith('Dto')&&!('$ref'in schema))schema.additionalProperties=false;
 const operations=Object.values(doc.paths).reduce((n,path)=>n+['get','post','patch','delete','put'].filter(m=>m in path).length,0);
 doc.info.version='1.2.0';doc.info.description=`Forma实习项目当前共${operations}条API。AI Core新增四表CRUD、JWT用户/租户隔离、统一Redis缓存与受限Service工具调用。普通用户仅本人；审计管理员只能查看本租户全量审计。现有业务API沿用原权限，业务表无改动。AI无自动任务编排；模型调用缓存仅预留前缀。`;
}
