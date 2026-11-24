import type { OpenAPIObject,SchemaObject,ReferenceObject,OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
const ref=(name:string):ReferenceObject=>({$ref:`#/components/schemas/${name}`});
const s=(extra:Partial<SchemaObject>={}):SchemaObject=>({type:'string',...extra});
const object=(properties:Record<string,SchemaObject|ReferenceObject>,required=Object.keys(properties)):SchemaObject=>({type:'object',properties,required});
const array=(items:SchemaObject|ReferenceObject):SchemaObject=>({type:'array',items});
export function applyChatDocs(doc:OpenAPIObject){
 const uuid=s({format:'uuid'}),date=s({format:'date-time'}),provider=s({enum:['ollama','deepseek','qwen','gpt','kimi']});
 const base={id:uuid,role:s({enum:['user','assistant']}),status:s({enum:['complete','pending','error']}),createdAt:date,source:s({enum:['user','model','demo','tool']}),attachments:array(ref('ChatAttachment')),requestId:uuid,errorCode:s()};
 const required=['id','role','status','createdAt','source','attachments','type','content'];
 const message=(type:string,content:SchemaObject)=>object({...base,type:s({enum:[type]}),content},required);
 const schemas:Record<string,SchemaObject>={
  ChatAttachment:object({id:uuid,name:s(),mime:s(),size:{type:'integer',minimum:1,maximum:5242880},contextReady:{type:'boolean'},createdAt:date}),
  ChatSession:object({id:uuid,title:s(),provider,model:s(),state:s({enum:['idle','thinking']}),isDemo:{type:'boolean'},createdAt:date,updatedAt:date}),
  ChatTextMessage:message('text',object({markdown:s()})),
  ChatTableMessage:message('table',object({title:s(),columns:array(s()),rows:array(array({oneOf:[s({nullable:true}),{type:'number'}]}))})),
  ChatChartMessage:message('chart',object({title:s(),labels:array(s()),values:array({type:'number'}),unit:s()})),
  ChatReportMessage:message('report',object({title:s(),summary:s(),markdown:s()})),
  ChatConfirmationMessage:message('confirmation',object({title:s(),description:s(),decision:s({enum:['pending','approved','rejected']}),demoOnly:{type:'boolean',enum:[true]}})),
  ChatToolMessage:message('tool',object({result:ref('ToolResult')})),
  ChatMessage:{oneOf:['ChatTextMessage','ChatTableMessage','ChatChartMessage','ChatReportMessage','ChatConfirmationMessage','ChatToolMessage'].map(ref),discriminator:{propertyName:'type',mapping:{text:'#/components/schemas/ChatTextMessage',table:'#/components/schemas/ChatTableMessage',chart:'#/components/schemas/ChatChartMessage',report:'#/components/schemas/ChatReportMessage',confirmation:'#/components/schemas/ChatConfirmationMessage',tool:'#/components/schemas/ChatToolMessage'}}},
  ChatSnapshot:object({session:ref('ChatSession'),messages:array(ref('ChatMessage'))}),
  ChatSessionList:object({items:array(ref('ChatSession'))}),ChatUpload:object({file:ref('ChatAttachment')}),
  ChatModels:object({items:array(object({provider,label:s(),model:s(),configured:{type:'boolean'},isLocal:{type:'boolean'},isDefault:{type:'boolean'}}))}),
 };
 doc.components??={};doc.components.schemas={...doc.components.schemas,...schemas};
 const entries:[string,string,string,number,string][]=[
 ['get','/ai-agent/models','aiListModels',200,'ChatModels'],['get','/ai-agent/sessions','aiListSessions',200,'ChatSessionList'],
 ['post','/ai-agent/sessions','aiCreateSession',201,'ChatSnapshot'],['post','/ai-agent/sessions/demo','aiCreateDemo',201,'ChatSnapshot'],
 ['get','/ai-agent/sessions/{id}','aiGetSession',200,'ChatSnapshot'],['post','/ai-agent/sessions/{id}/messages','aiSendMessage',200,'ChatSnapshot'],
 ['post','/ai-agent/sessions/{id}/messages/{messageId}/retry','aiRetryMessage',200,'ChatSnapshot'],['post','/ai-agent/sessions/{id}/messages/{messageId}/decision','aiDemoDecision',200,'ChatSnapshot'],
 ['post','/ai-agent/sessions/{id}/files','aiUploadFile',201,'ChatUpload'],['get','/ai-agent/files/{id}','aiDownloadFile',200,'binary'],['delete','/ai-agent/files/{id}','aiRemoveDraftFile',200,'MessageResponse'],
 ];
 for(const [method,path,id,status,schema]of entries){const op=doc.paths[path]?.[method as 'get'] as OperationObject;if(!op)throw new Error(`AI route not documented: ${path}`);op.operationId=id;op.security=[{session:[]}];
  op.responses={[status]:{description:schema==='ChatSnapshot'?'持久化快照；发送/重试接口中需检查assistant.status。模型失败仍保存消息并返回error状态。':'成功',content:schema==='binary'?{'application/octet-stream':{schema:{type:'string',format:'binary'}}}:{'application/json':{schema:ref(schema)}}}};
  const errors:Record<number,string>={401:'UNAUTHENTICATED：登录失效'};
  if(op.requestBody||path.includes('{'))errors[400]='VALIDATION_ERROR / EMPTY_MESSAGE / INVALID_FILE / FILE_QUOTA / CHAT_LIMIT / UUID格式错误';
  if(path.includes('{'))errors[404]='CHAT_NOT_FOUND / FILE_NOT_FOUND：不存在或非本人资源';
  if(method!=='get')errors[403]='INVALID_ORIGIN：请求来源无效';
  if(['aiCreateSession','aiCreateDemo','aiSendMessage','aiRetryMessage'].includes(id))errors[503]='MODEL_NOT_CONFIGURED：未配置的模型不可创建或发送';
  if(id==='aiSendMessage'||id==='aiRetryMessage'||id==='aiDemoDecision'||id==='aiRemoveDraftFile')errors[409]='CHAT_BUSY / REQUEST_ID_CONFLICT / RETRY_NOT_AVAILABLE / CONFIRMATION_CLOSED / FILE_IN_USE';
  if(['aiSendMessage','aiRetryMessage','aiDemoDecision','aiUploadFile'].includes(id))errors[409]=(errors[409]||'')+' / CHAT_CLOSED：会话已关闭';
  if(id==='aiUploadFile')errors[413]='文件大小超过5MB';
  for(const [code,description]of Object.entries(errors))op.responses[code]={description,content:{'application/json':{schema:ref('ErrorResponse')}}};
  if(op.parameters)for(const p of op.parameters)if('in'in p&&p.in==='path'){p.schema=uuid;p.required=true;}
 }
 for(const name of ['CreateSessionDto','SendMessageDto','DecisionDto']){const dto=doc.components.schemas[name] as SchemaObject;if(dto)dto.additionalProperties=false;}
 const send=doc.components.schemas.SendMessageDto as SchemaObject;if(send?.properties?.fileIds)Object.assign(send.properties.fileIds,{uniqueItems:true,maxItems:3,items:{type:'string',format:'uuid'}});
 doc.info.version='1.1.0';doc.info.description=doc.info.description?.replace('现有19条','现有30条')+' AI Agent本期新增11条接口；仅基础对话，确认/任务为演示，不执行编排。';
}
