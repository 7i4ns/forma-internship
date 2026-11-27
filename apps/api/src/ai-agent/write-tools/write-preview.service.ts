import { Injectable } from '@nestjs/common';
import type { WritePreviewField, WritePreviewItem, WriteToolPreviewDetails } from '@internship/ai-contracts';

type EntityType='user'|'company';
type RecordValue=Record<string,unknown>;
const definitions:Record<EntityType,{key:string;label:string}[]>={
 user:[{key:'name',label:'姓名'},{key:'email',label:'邮箱'},{key:'role',label:'Title / Role'},{key:'status',label:'状态'}],
 company:[{key:'name',label:'名称'},{key:'level',label:'等级'},{key:'country',label:'国家'},{key:'city',label:'城市'},{key:'founded_year',label:'成立年份'},{key:'annual_revenue',label:'年营收'},{key:'employees',label:'员工数'}],
};
const same=(left:unknown,right:unknown)=>JSON.stringify(left??null)===JSON.stringify(right??null);

@Injectable()
export class WritePreviewService {
 private values(entity:EntityType,record:RecordValue):WritePreviewField[]{return definitions[entity].map(({key,label})=>({key,label,value:record[key]??null}));}
 create(entity:EntityType,title:string,record:RecordValue):WriteToolPreviewDetails{return{title,action:'create',entityType:entity,riskLevel:'low',summary:`确认后将创建${entity==='user'?'用户':'公司'}“${String(record.name??'未命名')}”。`,riskMessages:['执行后将新增一条业务数据，可在后续页面继续编辑。'],fields:this.values(entity,record)};}
 update(entity:EntityType,title:string,before:RecordValue,changes:RecordValue):WriteToolPreviewDetails{
  const fields=definitions[entity].map(({key,label})=>{const oldValue=before[key]??null,newValue=changes[key]===undefined?oldValue:changes[key]??null;return{key,label,before:oldValue,after:newValue,changed:!same(oldValue,newValue)};});
  const count=fields.filter(field=>field.changed).length;
  return{title,action:'update',entityType:entity,riskLevel:'medium',summary:`确认后将修改${entity==='user'?'用户':'公司'}“${String(before.name??'未命名')}”的 ${count} 个字段。`,riskMessages:['高亮字段将被目标值覆盖，请核对修改前后内容。'],fields};
 }
 delete(entity:EntityType,title:string,record:RecordValue):WriteToolPreviewDetails{return{title,action:'delete',entityType:entity,riskLevel:'high',summary:`确认后将永久删除${entity==='user'?'用户':'公司'}“${String(record.name??'未命名')}”。`,riskMessages:['删除属于高风险操作，执行后业务记录将不可直接恢复。','执行前会自动保存完整快照，为后续回滚能力保留数据。'],fields:this.values(entity,record)};}
 batchDelete(entity:'user',title:string,records:RecordValue[]):WriteToolPreviewDetails{
  const items:WritePreviewItem[]=records.map(record=>({id:String(record.id),label:String(record.name??record.email??record.id),fields:this.values(entity,record)}));
  return{title,action:'batch-delete',entityType:entity,riskLevel:'high',summary:`确认后将批量删除 ${records.length} 位用户。`,riskMessages:['批量删除属于高风险操作，请逐项核对姓名与角色。','本次操作将复用现有多选删除逻辑，并在执行前保存全部用户快照。'],fields:[],items};
 }
}
