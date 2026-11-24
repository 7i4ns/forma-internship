import { applyReadToolsDocs } from '../ai-agent/http/read-tools.openapi';
import { applyAiCoreDocs } from '../ai-agent/http/core.openapi';
import { applyChatDocs } from '../ai-agent/http/chat.openapi';
import { applyWriteToolsDocs } from '../ai-agent/http/write-tools.openapi';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { SchemaObject, ReferenceObject, OperationObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
const str = (extra: Partial<SchemaObject> = {}): SchemaObject => ({ type:'string',...extra });
const integer = (extra: Partial<SchemaObject> = {}): SchemaObject => ({type:'integer',minimum:0,...extra});
const object = (properties: Record<string,SchemaObject|ReferenceObject>, required=Object.keys(properties)): SchemaObject => ({type:'object',properties,required});
const array = (items:SchemaObject|ReferenceObject):SchemaObject=>({type:'array',items});
const ref = (name:string) => ({$ref:`#/components/schemas/${name}`});
const uuid = str({format:'uuid',example:'11111111-1111-4111-8111-111111111111'});
const date = str({format:'date-time',example:'2026-11-10T00:00:00.000Z'});
const decimal = str({pattern:'^\\d+(\\.\\d+)?$',example:'182779175.00',description:'十进制字符串，保留大数精度；原始金额单位'});
const publicUser = {id:uuid,email:str({format:'email',example:'api-test@example.com'}),name:str({example:'API Test'}),role:str({example:'Analyst'}),status:str({enum:['active','inactive']}),created_at:date};
const company = {id:uuid,external_id:str({nullable:true}),name:str(),level:str(),country:str(),city:str({nullable:true}),founded_year:integer({minimum:1000,nullable:true}),supplying_since:str({format:'date',nullable:true}),annual_revenue:{type:'number',minimum:0,nullable:true} as SchemaObject,employees:integer({nullable:true}),efficiency:{type:'number',minimum:0,nullable:true,description:'annual_revenue/employees；员工为0或任一未知时为null'} as SchemaObject,created_at:date,updated_at:date};
const authResponse = object({code:str(),message:str(),user:ref('PublicUser')});
const percentage = {type:'number',minimum:0,maximum:100} as SchemaObject;
const schemas: Record<string,SchemaObject> = {
  PublicUser:object(publicUser),ManagedUser:object({...publicUser,updated_at:date}),Company:object(company),AuthResponse:authResponse,
  UserResponse:object({user:ref('PublicUser')}),UserMutation:object({message:str(),user:ref('ManagedUser')}),CompanyMutation:object({message:str(),company:ref('Company')}),
  DeleteUsersResponse:object({message:str(),deleted:integer({minimum:1})}),MessageResponse:object({message:str()}),LogoutResponse:object({code:str({enum:['LOGOUT_SUCCESS']}),message:str()}),
  UserList:object({items:array(ref('ManagedUser')),total:integer(),roles:array(str()),page:integer(),limit:integer({minimum:1,maximum:100})}),
  CompanyList:object({items:array(ref('Company')),total:integer(),levels:array(str()),page:integer(),limit:integer({minimum:1,maximum:100})}),
  Health:object({status:str({enum:['ok']}),postgres:str({enum:['ok']}),pgvector:str(),redis:str({enum:['PONG']})}),AgentSmoke:object({message:str({enum:['LangGraph ready']})}),
  ErrorResponse:{anyOf:[object({code:str(),message:str(),field:str(),errors:{type:'object',additionalProperties:{type:'string'}}},['code','message']),object({statusCode:integer(),message:{oneOf:[str(),array(str())]},error:str()},['statusCode','message'])],description:'业务错误返回code/message；框架UUID和JSON解析错误返回statusCode/message/error。'},
  DashboardResponse:object({summary:object({companyCount:integer(),totalRevenue:decimal,countryCount:integer(),totalEmployees:str({pattern:'^\\d+$'}),revenueReported:integer(),employeesReported:integer()}),levels:array(object({level:str(),count:integer(),percentage})),growth:array(object({year:integer({minimum:1000}),added:integer(),cumulative:integer()})),coverage:object({yearKnown:integer(),yearExcluded:integer(),yearMissing:integer(),yearInvalid:integer()}),asOfYear:integer({minimum:1000}),generatedAt:date}),
  CompanyBarResponse:object({dimension:str({enum:['level','country','city']}),total:integer(),groups:array(object({value:str({nullable:true}),count:integer(),percentage})),options:object({level:array(str()),country:array(str()),city:array(str())}),generatedAt:date}),
};
type Endpoint = {tag:string;summary:string;id:string;description:string;schema:string;status?:number;public?:boolean;errors?:Record<number,string>;example?:unknown};
const commonInput={400:'VALIDATION_ERROR / INVALID_QUERY / EMPTY_UPDATE：输入校验失败或未提供更新字段'};
export const endpoints:Record<string,Endpoint> = {
 'GET /health':{tag:'System',summary:'检查 PostgreSQL、pgvector 与 Redis 连通性',id:'getHealth',public:true,schema:'Health',description:'无请求体或业务查询参数。实际连接依赖服务；本检查不调用大模型。',errors:{503:'依赖服务不可用（不会返回连接凭证）'}},
 'GET /agent/smoke':{tag:'System',summary:'验证 LangGraph 最小工作流',id:'getAgentSmoke',public:true,schema:'AgentSmoke',description:'无参数。执行本地固定节点图，返回 LangGraph ready；不调用外部模型或产生费用。'},
 'POST /auth/signup':{tag:'Authentication',summary:'邮箱密码注册',id:'signup',public:true,status:201,schema:'AuthResponse',description:'邮箱去空格并转小写。密码8-128位，至少一个字母和数字，不含空白/控制字符。注册成功不自动登录。注册与登录共享每IP每分钟30次限额。',errors:{400:'VALIDATION_ERROR：空值、格式错误或额外字段',403:'INVALID_ORIGIN：请求来源不允许',409:'EMAIL_EXISTS：邮箱已注册',429:'TOO_MANY_REQUESTS：注册与登录共享限额'}},
 'POST /auth/login':{tag:'Authentication',summary:'登录并设置会话 Cookie',id:'login',public:true,schema:'AuthResponse',description:'成功返回 Set-Cookie: internship_session=<JWT>; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600。浏览器同源请求自动携带；COOKIE_SECURE=true时增加Secure。Swagger UI可直接先调用登录，再调用受保护接口。',errors:{400:'VALIDATION_ERROR：字段格式无效',401:'EMAIL_NOT_FOUND / WRONG_PASSWORD / ACCOUNT_INACTIVE',403:'INVALID_ORIGIN',429:'TOO_MANY_REQUESTS'}},
 'GET /auth/me':{tag:'Authentication',summary:'获取当前会话用户',id:'getMe',schema:'UserResponse',description:'每次验证JWT及数据库用户active状态，不返回password/password_hash。无查询参数。'},
 'POST /auth/logout':{tag:'Authentication',summary:'清除浏览器会话 Cookie',id:'logout',public:true,schema:'LogoutResponse',description:'无需登录，可重复调用；Set-Cookie Max-Age=0。无请求体。仅清除客户端Cookie，未建立服务端JWT吊销列表，复制的旧JWT在到期前仍可有效。',errors:{403:'INVALID_ORIGIN'}},
 'GET /users':{tag:'Users',summary:'分页查询用户与角色选项',id:'listUsers',schema:'UserList',description:'page从0开始，limit为1-100默认10。姓名search按字面量不区分大小写搜索，roles重复参数为OR；search与roles为AND。返回全量角色选项。不返回密码。',errors:commonInput},
 'POST /users':{tag:'Users',summary:'添加用户',id:'createUser',schema:'UserMutation',status:201,description:'必填email/password/name/role/status。role为工作类别字符串，不代表权限角色。',errors:{...commonInput,409:'DUPLICATE：邮箱重复'}},
 'GET /users/{id}':{tag:'Users',summary:'按UUID查询用户',id:'getUser',schema:'ManagedUser',description:'id必须为UUID v4。',errors:{400:'UUID格式错误',404:'NOT_FOUND：用户不存在'}},
 'PATCH /users/{id}':{tag:'Users',summary:'编辑用户',id:'updateUser',schema:'UserMutation',description:'只更新提供的name/email/role/status，至少一个字段；不支持修改密码。禁止停用当前登录账号。',errors:{...commonInput,404:'NOT_FOUND',409:'DUPLICATE：邮箱已存在'}},
 'DELETE /users/{id}':{tag:'Users',summary:'删除用户',id:'deleteUser',schema:'DeleteUsersResponse',description:'禁止删除当前登录账号。永久删除，非软删除；已不存在的UUID返回400 STALE_SELECTION。',errors:{400:'UUID错误 / SELF_DELETE / STALE_SELECTION'}},
 'POST /users/bulk-delete':{tag:'Users',summary:'原子批量删除用户',id:'bulkDeleteUsers',status:201,schema:'DeleteUsersResponse',description:'ids为1-100个UUID v4，重复ID去重。包含本人或任一ID不存在则整批拒绝，不部分删除。永久删除，非软删除。',errors:{400:'VALIDATION_ERROR / SELF_DELETE / STALE_SELECTION'}},
 'GET /companies':{tag:'Companies',summary:'分页查询公司与等级选项',id:'listCompanies',schema:'CompanyList',description:'page从0开始、limit默认10最多100，search按公司名搜索，levels重复参数多选OR。效率为年收入/员工数。金额在本CRUD接口为JSON number；大额精确合计见Dashboard十进制字符串。',errors:commonInput},
 'POST /companies':{tag:'Companies',summary:'添加公司',id:'createCompany',schema:'CompanyMutation',status:201,description:'必填name/level/country；其他字段可省略或为null，external_id非空时唯一。年份、日期、收入和员工数均校验。',errors:{...commonInput,409:'DUPLICATE：external_id重复'}},
 'GET /companies/{id}':{tag:'Companies',summary:'按UUID查询公司详情',id:'getCompany',schema:'Company',description:'包含折叠详情字段与盈利效率；id必须为UUID v4。',errors:{400:'UUID格式错误',404:'NOT_FOUND'}},
 'PATCH /companies/{id}':{tag:'Companies',summary:'编辑公司',id:'updateCompany',schema:'CompanyMutation',description:'只更新提供的字段，至少一个字段；可选字段传null表示清空。name/level/country不可为null。',errors:{...commonInput,404:'NOT_FOUND',409:'DUPLICATE'}},
 'DELETE /companies/{id}':{tag:'Companies',summary:'删除公司',id:'deleteCompany',schema:'MessageResponse',description:'永久删除。存在relationship关联时拒绝，不自动级联删除；先处理关联关系。',errors:{400:'UUID格式错误',404:'NOT_FOUND',409:'RELATED_RECORDS：存在关联记录'}},
 'GET /dashboard':{tag:'Dashboard',summary:'全量公司概览：卡片、等级环图、累计折线',id:'getDashboard',schema:'DashboardResponse',description:'同一SQL快照聚合全部公司；国家去空格/大小写差异后去重；金额和员工合计为十进制字符串。founded_year从最早有效年补齐至悉尼当前年，缺失或未来年份单独计数。无请求参数。'},
 'POST /dashboard/getCompaniesByFilter':{tag:'Dashboard',summary:'组合筛选并按维度统计公司数量',id:'getCompaniesByFilter',schema:'CompanyBarResponse',description:'dimension为level/country/city。同字段多选OR，不同字段AND；空数组、空范围或省略filter表示不限，范围含端点。开启数值范围后排除该字段NULL。收入推荐十进制字符串；国家/城市区分大小写，同名城市合组。返回所有分组及全量options；只读查询不修改公司。',errors:{400:'INVALID_FILTER：非法维度、类型、空值、额外字段或反向范围'},example:{dimension:'country',filter:{level:[2,3],country:['China','Japan'],city:[],founded_year:{start:1950,end:2000},annual_revenue:{min:'1000.00',max:'500000.00'},employees:{min:100,max:1000}}}},
};
export function createApiDocument(app:INestApplication) {
 const config=new DocumentBuilder().setTitle('Forma Internship REST API').setVersion('1.0.0').setDescription('现有19条业务/系统API完整契约。仅本地实习环境；所有active账号均可管理数据，尚未实现生产RBAC。响应时间阈值是本地冒烟基线，不等同并发负载或生产SLA。分页page从0开始；业务错误见ErrorResponse。文档端点 /docs、/docs-json、/docs-yaml 为生成产物，不计业务接口。').addServer('http://127.0.0.1:3001','本地后端').addServer('http://127.0.0.1:3000/api','Next.js同源代理').addCookieAuth('internship_session',{type:'apiKey',in:'cookie'},'session').build();
 const doc=SwaggerModule.createDocument(app,config);
 doc.components??={};doc.components.schemas={...doc.components.schemas,...schemas};
 for(const [key,meta] of Object.entries(endpoints)) {
  const [method,path]=key.split(' ');const op=doc.paths[path]?.[method.toLowerCase() as 'get'] as OperationObject|undefined;
  if(!op)throw new Error(`Missing route for API contract: ${key}`);
  op.operationId=meta.id;op.summary=meta.summary;op.description=meta.description;op.tags=[meta.tag];op.security=meta.public?[]:[{session:[]}];
  const statuses={...meta.errors,...(!meta.public?{401:'UNAUTHENTICATED：Cookie缺失、无效、过期或账号停用'}:{}),...(!meta.public&&method!=='GET'?{403:'INVALID_ORIGIN：请求来源不允许'}:{})};
  op.responses={[meta.status||200]:{description:'成功',content:{'application/json':{schema:ref(meta.schema)}},...(meta.id==='login'||meta.id==='logout'?{headers:{'Set-Cookie':{description:meta.id==='login'?'HttpOnly会话Cookie，1小时有效':'清空Cookie，Max-Age=0',schema:str()}}}:{})}};
  for(const [status,description] of Object.entries(statuses))op.responses[status]={description,content:{'application/json':{schema:ref('ErrorResponse')}}};
  if(path.includes('{id}'))op.parameters=[{in:'path',name:'id',required:true,description:'UUID v4',schema:uuid}];
  if(meta.id==='listUsers'||meta.id==='listCompanies') {
   const field=meta.id==='listUsers'?'roles':'levels';
   op.parameters=[{in:'query',name:'page',schema:integer({maximum:1000000,default:0}),description:'从0开始的页码'},{in:'query',name:'limit',schema:integer({minimum:1,maximum:100,default:10})},{in:'query',name:'search',schema:str({maxLength:200,default:''})},{in:'query',name:field,style:'form',explode:true,schema:{...array(str({maxLength:80})),maxItems:100},description:`多选：${field}=A&${field}=B；省略或空数组表示不限`}];
  }
  if(meta.example&&op.requestBody&&'content'in op.requestBody)op.requestBody.content['application/json'].example=meta.example;
  // Runtime DTOs reject all unknown request fields.
 }
 const allSchemas=doc.components.schemas as Record<string,SchemaObject>;
 for(const name of ['CredentialsDto','CreateUserDto','UpdateUserDto','CompanyDto','UpdateCompanyDto','DeleteManyDto','CompanyFilterRequest','CompanyFilters','YearRange','RevenueRange','EmployeeRange'])if(allSchemas[name])allSchemas[name].additionalProperties=false;
 for(const name of ['CredentialsDto','CreateUserDto','UpdateUserDto']) {
  const props=allSchemas[name]?.properties as Record<string,SchemaObject>|undefined;if(!props)continue;
  if(props.email)Object.assign(props.email,{type:'string',format:'email',maxLength:254});
  if(props.name)Object.assign(props.name,{minLength:1,maxLength:100});if(props.role)Object.assign(props.role,{minLength:1,maxLength:80});
 }
 const currentYear=Number(new Intl.DateTimeFormat('en',{timeZone:'Australia/Sydney',year:'numeric'}).format(new Date()));
 for(const name of ['CompanyDto','UpdateCompanyDto']) {
  const p=allSchemas[name].properties as Record<string,SchemaObject>;
  Object.assign(p.name,{minLength:1,maxLength:200});Object.assign(p.level,{minLength:1,maxLength:80});Object.assign(p.country,{minLength:1,maxLength:100});
  Object.assign(p.external_id,{minLength:1,maxLength:120});Object.assign(p.city,{maxLength:120});Object.assign(p.founded_year,{type:'integer',minimum:1000,maximum:currentYear});Object.assign(p.employees,{type:'integer',minimum:0,maximum:2147483647});Object.assign(p.annual_revenue,{type:'number',minimum:0,maximum:1e15,multipleOf:0.01});Object.assign(p.supplying_since,{format:'date',pattern:'^\\d{4}-\\d{2}-\\d{2}$'});
 }
 const filters=allSchemas.CompanyFilters.properties as Record<string,SchemaObject>;
 for(const key of ['level','country','city'])Object.assign(filters[key],{type:'array',maxItems:100,items:key==='level'?{oneOf:[str({minLength:1,maxLength:80}),{type:'integer'}]}:str({minLength:1,maxLength:key==='country'?100:120})});
 for(const name of ['YearRange','EmployeeRange'])for(const prop of Object.values(allSchemas[name].properties||{}))Object.assign(prop,{type:'integer',minimum:name==='YearRange'?1000:0,maximum:name==='YearRange'?currentYear:2147483647});
 for(const prop of Object.values(allSchemas.RevenueRange.properties||{})) {const p=prop as SchemaObject;delete p.type;p.oneOf=[str({pattern:'^(0|[1-9]\\d{0,17})(\\.\\d{1,2})?$',example:'1000.00'}),{type:'number',minimum:0,maximum:Number.MAX_SAFE_INTEGER,multipleOf:0.01}];}
 Object.assign((allSchemas.DeleteManyDto.properties as Record<string,SchemaObject>).ids,{minItems:1,maxItems:100});
 applyChatDocs(doc);
 applyAiCoreDocs(doc);
 applyReadToolsDocs(doc);
 applyWriteToolsDocs(doc);
 return doc;
}
