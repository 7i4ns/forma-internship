import json, re, statistics
from pathlib import Path
from html import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
base=Path('deliveries/api-2026-11-10'); out=Path('output/pdf');out.mkdir(parents=True,exist_ok=True)
spec=json.loads((base/'openapi.json').read_text()); results=json.loads((base/'newman-results.json').read_text()); cases=json.loads((base/'test-cases.json').read_text());coverage=json.loads((base/'coverage.json').read_text())
pdfmetrics.registerFont(TTFont('CNSans','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='CJK',fontName='CNSans',fontSize=9,leading=14,spaceAfter=6,wordWrap='CJK',textColor=colors.HexColor('#24372f')));styles.add(ParagraphStyle(name='TitleCN',parent=styles['CJK'],fontSize=27,leading=36,spaceAfter=18));styles.add(ParagraphStyle(name='H1CN',parent=styles['CJK'],fontSize=17,leading=24,spaceBefore=10,spaceAfter=12,keepWithNext=True));styles.add(ParagraphStyle(name='H2CN',parent=styles['CJK'],fontSize=11,leading=16,spaceBefore=10,spaceAfter=6,keepWithNext=True));styles.add(ParagraphStyle(name='SmallCN',parent=styles['CJK'],fontSize=7.6,leading=11,spaceAfter=2));styles.add(ParagraphStyle(name='MonoCode',fontName='Courier',fontSize=7.5,leading=11,spaceAfter=8,wordWrap='CJK'))
def P(text,kind='CJK'):return Paragraph(escape(str(text)).replace('\n','<br/>'),styles[kind])
def table(rows,widths=None):
 t=Table([[P(v,'SmallCN') for v in row] for row in rows],colWidths=widths,repeatRows=1,hAlign='LEFT');t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e4eee7')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),.6,colors.HexColor('#86a78e')),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#dce5df')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]));return t
W=A4[0]-84

def footer(canvas,doc):
 canvas.setStrokeColor(colors.HexColor('#dce5df'));canvas.line(42,37,A4[0]-42,37);canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#5e7366'));canvas.drawString(42,24,'FORMA / API ENGINEERING / 2026-11-10');canvas.drawRightString(A4[0]-42,24,str(doc.page))
def build(path,story):SimpleDocTemplate(str(path),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=42,bottomMargin=48,title=path.stem,author='Forma Internship Project').build(story,onFirstPage=footer,onLaterPages=footer)
def resolve(s):return spec['components']['schemas'][s['$ref'].split('/')[-1]] if '$ref' in s else s

def typename(s):
 if '$ref'in s:return s['$ref'].split('/')[-1]
 if 'oneOf'in s or 'anyOf'in s:return ' | '.join(typename(x) for x in s.get('oneOf',s.get('anyOf',[])))
 t=s.get('type','object');t=('array<'+typename(s['items'])+'>') if t=='array' else t
 return t+(' / null' if s.get('nullable') else '')
def constraints(s):
 parts=[]
 for k,label in [('minimum','min'),('maximum','max'),('minLength','长度>='),('maxLength','长度<='),('minItems','至少'),('maxItems','最多'),('multipleOf','步长'),('format','格式'),('pattern','规则')]:
  if k in s:parts.append(f'{label} {s[k]}')
 if 'enum'in s:parts.append(' / '.join(map(str,s['enum'])))
 if 'default'in s:parts.append('默认 '+str(s['default']))
 if 'description'in s:parts.append(s['description'])
 return '; '.join(parts) or '-'
def props_table(s):
 s=resolve(s);rows=[['字段','类型','必填','规则 / 说明']]
 for k,v in s.get('properties',{}).items():rows.append([k,typename(v),'是' if k in s.get('required',[]) else '否',constraints(v)])
 if len(rows)==1:rows.append(['value',typename(s),'-',constraints(s)])
 return table(rows,[115,112,29,W-256])
ops=[(m.upper(),path,op)for path,defs in spec['paths'].items()for m,op in defs.items()if m in ['get','post','patch','delete','put']]

story=[Spacer(1,70),P('FORMA / BACKEND API','H2CN'),P('Swagger API 文档\n可打印版','TitleCN'),P('19 条现有接口 · OpenAPI 3.0 · 契约版本 1.0.0','H1CN'),P('2026-11-10 | 实习项目本地开发环境'),Spacer(1,24),P('本文件由运行中的 /docs-json 导出的 OpenAPI 规范生成。交互文档、离线规范与本打印版使用同一份接口契约。'),P('在线 Swagger UI：http://127.0.0.1:3001/docs'),P('机器可读规范：交付包 openapi.json'),P('后端：http://127.0.0.1:3001；前端代理：http://127.0.0.1:3000/api'),Spacer(1,15),P('阅读顺序：接口索引 → 登录与通用规则 → 逐接口说明 → 字段模型目录。'),PageBreak(),P('接口索引','H1CN')]
story.append(table([['方法','路径','功能']]+[[m,p,o['summary']]for m,p,o in ops],[52,202,W-254]));story.extend([Spacer(1,14),P('范围：19 条业务/系统接口。/docs、/docs-json、/docs-yaml 是文档生成产物，不计业务接口；当前没有 relationship 独立CRUD或Order业务API。'),PageBreak(),P('登录、输入与统计约定','H1CN')])
for heading,text in [
 ('Cookie 登录','先 POST /auth/login，成功后使用 internship_session Cookie；有效期1小时，HttpOnly、SameSite=Lax，HTTPS环境可启用Secure。Swagger UI在同一后端域名登录后自动带Cookie；浏览器不支持手写Cookie请求头，Authorize并不能替代真实登录。'),
 ('鉴权与权限','每次受保护请求验证JWT和数据库active状态。本地项目尚未建立生产RBAC，role为职位类别。Cookie缺失、无效、过期或用户停用返回401。写请求携带不允许的Origin时返回403。'),
 ('错误格式','业务错误：code、message，可附field/errors；框架错误（例如UUID格式和JSON语法）：statusCode、message、error。所有JSON字段说明见ErrorResponse。'),
 ('输入校验','JSON请求体拒绝未定义字段。分页page从0开始，limit为1-100。查询参数使用普通文本或重复数组参数，不识别的查询键会被忽略。PATCH至少一个有效字段，可选字段的null语义见各接口。'),
 ('日期与金额','founded_year按成立年份使用，不推断实际加入供应链日期。CRUD公司金额为JSON number；Dashboard合计金额和员工数使用十进制字符串。过滤API的金额推荐字符串以保留精确边界。'),
 ('删除和退出','删除是永久删除；禁止删除/停用本人。批量选择失效时整批拒绝。退出仅清除客户端Cookie，不对已有JWT做服务端吊销；不能把旧JWT仍可用误报为退出接口失败。'),
 ('测试与性能','Postman集合实际通过Newman执行，使用唯一前缀隔离夹具并清理，原数据指纹前后一致。响应时间阈值为本地2秒冒烟基线，不代表并发负载能力或生产SLA。')]:story.extend([P(heading,'H2CN'),P(text)])
for index,(method,path,op)in enumerate(ops,1):
 story.extend([PageBreak(),P(f'{index:02d} / {op["tags"][0]}','H2CN'),P(op['summary'],'H1CN'),P(method+' '+path,'MonoCode'),P('operationId: '+op['operationId'],'SmallCN'),P(op.get('description','')),P('认证：'+('需要 internship_session Cookie' if op.get('security') else '公开 / 无需登录'),'H2CN')])
 parameters=op.get('parameters',[])
 story.append(P('路径与查询参数','H2CN'))
 story.append(table([['位置 / 字段','类型','必填','说明']]+[[p['in']+' / '+p['name'],typename(p['schema']),'是' if p.get('required')else '否',(p.get('description','')+' '+constraints(p['schema'])).strip()]for p in parameters],[110,100,29,W-239]) if parameters else P('无声明参数。无输入接口不人为构造不存在的业务格式校验。'))
 story.append(P('请求体','H2CN'))
 body=op.get('requestBody',{}).get('content',{}).get('application/json')
 if body:
  schema=body['schema'];story.append(P('application/json · '+typename(schema)+'；完整字段规则见后方模型目录。'));story.append(props_table(schema))
 else:story.append(P('无需请求体。'))
 story.append(P('响应状态与JSON模型','H2CN'))
 story.append(table([['状态码','模型','返回说明']]+[[status,typename(response.get('content',{}).get('application/json',{}).get('schema',{})),response.get('description','')]for status,response in op['responses'].items()],[50,145,W-195]))
 n=sum(c['operation']==method+' '+path for c in cases);story.append(P(f'本接口测试场景：{n} 个。请求示例、预期值及每条测试断言见Postman集合和测试用例清单。','SmallCN'))
story.extend([PageBreak(),P('字段模型目录','H1CN'),P('下面列出请求DTO和响应模型。嵌套类型名称对应同目录的模型；optional表示可以省略，null仅在标注 / null 时允许。')])
for name,schema in spec['components']['schemas'].items():
 story.append(P(name,'H2CN'));story.append(props_table(schema));story.append(Spacer(1,10))
story.extend([P('实现与参考','H1CN'),P('NestJS OpenAPI operations: https://docs.nestjs.com/openapi/operations'),P('Swagger官方文档: https://swagger.io/docs/'),P('Postman测试示例: https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-examples/')])
build(out/'Swagger-API-可打印文档.pdf',story)

perf=results['performance'];success=sum(e['status']<400 for e in results['executions']);fail=results['failedAssertions']
story=[P('FORMA / TEST ENGINEERING','H2CN'),P('API 测试执行报告','TitleCN'),P('Swagger 覆盖 + Postman Test Scripts + 响应时间检查','H1CN'),P('执行工具：Newman，实际运行Postman v2.1集合；以下数据来自newman-results.json。'),table([['指标','结果'],['覆盖接口',str(len(coverage))],['请求场景',str(results['requestCount'])],['测试断言',str(results['assertionCount'])],['失败断言',str(fail)],['预期内成功/错误响应',f'{success} / {results["requestCount"]-success}'],['原始数据恢复校验','一致' if results['dataIntegrity']['restored']else '不一致'],['响应阈值',str(perf['thresholdMs'])+' ms'],['平均 / P95 / 最大',f'{perf["meanMs"]:.2f} / {perf["p95Ms"]} / {perf["maxMs"]} ms']],[155,W-155]),Spacer(1,16),P('重要：400/401/403/404/409是预设异常场景的正确响应，不等同测试失败。平均每接口约6.95个请求场景；无输入的系统接口场景较少，复杂CRUD与组合筛选增加覆盖。'),P('响应时间为单次本地顺序运行统计，不包含并发、吞吐或长时间压力测试。原有2000家公司及1999条关系未被修改，测试临时记录已清理。'),PageBreak(),P('覆盖矩阵','H1CN'),table([['接口','场景数']]+[[c['operation'],c['cases']]for c in coverage],[W-60,60]),P('所有请求均检查状态码、JSON Content-Type、JSON Schema、响应时间和密码/哈希泄露；另按场景增加业务字段、Cookie、累计公式和数量合计断言。'),P('场景设计','H2CN'),P('涵盖正常请求、缺失/空字符串/null、邮箱/密码/UUID/日期/数字格式、无登录/无效会话、重复记录、本人保护、关联删除保护、失效批量选择原子性、零值和可空字段、过滤与统计不变量。'),P('本轮修正','H2CN'),P('首轮发现两处测试假设不准确：errors.password字段名不是密码泄露；未知查询参数当前被忽略，已改用真实长度超限场景。修正断言后重新完整运行，最终结果见首页。未降低鉴权或放宽业务校验来通过测试。'),PageBreak(),P('逐接口响应时间','H1CN')]
rows=[['接口','请求数','平均ms','P95ms','最大ms']]
for c in coverage:
 ids={x['id']for x in cases if x['operation']==c['operation']};t=sorted(x['responseTimeMs']for x in results['executions']if x['id']in ids);rows.append([c['operation'],len(t),f'{statistics.mean(t):.2f}',t[max(0,__import__('math').ceil(len(t)*.95)-1)],max(t)])
story.append(table(rows,[W-176,36,48,46,46]));story.extend([PageBreak(),P('完整请求场景与执行结果','H1CN')])
executions={e['id']:e for e in results['executions']};rows=[['编号 / 接口','场景','预期/实际','断言','耗时ms']]
for c in cases:
 e=executions[c['id']];passed=sum(a['passed']for a in e['assertions']);rows.append([c['id']+'\n'+c['operation'],c['scenario'],str(c['expectedStatus'])+' / '+str(e['status']),f'{passed}/{len(e["assertions"])}',e['responseTimeMs']])
story.append(table(rows,[164,176,62,49,W-451]));story.extend([Spacer(1,15),P('证据文件与复现','H1CN'),P('newman-results.json：去除Cookie等凭证后的逐请求结果；newman-junit.xml：JUnit测试结果；newman-console.txt：执行日志；test-cases.json / coverage.json：场景与覆盖清单；data-integrity.json：测试前后数据指纹。'),P('启动本地API后：npm run api:collection，然后 npm run test:api-delivery。集合包含写入/永久删除临时夹具的场景，只应针对本项目本地测试库顺序运行。详细说明见交付目录README。')])
build(out/'Postman-API-测试报告.pdf',story)
print(json.dumps({'pdfs':[str(p)for p in out.glob('*.pdf')]},ensure_ascii=False))
