'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatSession, ChatSnapshot, ModelProfile, ModelProvider, SendMessageInput, ToolExecuteInput } from '@internship/ai-contracts';
import { chatApi } from '../services/chat-api';
import { ApiError } from '../../../lib/api';
export function useChat(userId:string){
 const [open,setOpen]=useState(false),[initialized,setInitialized]=useState(false),[snapshot,setSnapshot]=useState<ChatSnapshot|null>(null),[sessions,setSessions]=useState<ChatSession[]>([]),[models,setModels]=useState<ModelProfile[]>([]),[provider,setProvider]=useState<ModelProvider>('ollama'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const id=useRef<string|null>(null),mounted=useRef(true),action=useRef(false),sequence=useRef(0),ambiguous=useRef<{id:string;input:SendMessageInput}|null>(null);
 const uncertainTool=useRef<ToolExecuteInput|null>(null);
 const uncertainCommand=useRef<{command:string;sessionId:string;requestId:string}|null>(null);
 const uncertainWrite=useRef<{command:string;sessionId:string;requestId:string}|null>(null);
 const key=`forma.ai.v1.${userId}`;
 const accept=useCallback((value:ChatSnapshot)=>{if(!mounted.current||id.current!==value.session.id)return;setError('');setSnapshot(old=>old?.session.id===value.session.id&&old.session.updatedAt>value.session.updatedAt?old:value);setSessions(old=>[value.session,...old.filter(s=>s.id!==value.session.id)].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));},[]);
 const explain=(e:unknown)=>e instanceof ApiError&&e.code==='MODEL_NOT_CONFIGURED'?'该模型未配置，请选择已配置模型或联系开发人员。':e instanceof Error?e.message:'对话服务暂时不可用，请重试';
 useEffect(()=>{
  mounted.current=true;let alive=true;
  void(async()=>{
   try{const [m,s]=await Promise.all([chatApi.models(),chatApi.sessions()]);if(!alive)return;setModels(m.items);setSessions(s.items);setProvider((m.items.find(p=>p.configured&&p.isDefault)||m.items.find(p=>p.configured))?.provider||'ollama');
    let cache:{id?:string;open?:boolean}={};try{cache=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
    const selected=s.items.find(row=>row.id===cache.id)?.id||s.items[0]?.id||null;id.current=selected;setOpen(cache.open===true);
    if(selected){const loaded=await chatApi.get(selected);if(alive)accept(loaded);}
   }catch(e){if(alive)setError(explain(e));}finally{if(alive)setInitialized(true);}
  })();return()=>{alive=false;mounted.current=false;};
 },[userId,key,accept]);
 useEffect(()=>{if(initialized){try{localStorage.setItem(key,JSON.stringify({id:snapshot?.session.id||id.current,open}));}catch{}}},[initialized,key,open,snapshot?.session.id]);
 const load=useCallback(async()=>{let selected=id.current;if(!selected){try{const [m,s]=await Promise.all([chatApi.models(),chatApi.sessions()]);if(!mounted.current)return;setModels(m.items);setSessions(s.items);setProvider((m.items.find(p=>p.configured&&p.isDefault)||m.items.find(p=>p.configured))?.provider||'ollama');selected=s.items[0]?.id||null;id.current=selected;setError('');}catch(e){if(mounted.current)setError(explain(e));return;}}if(!selected)return;try{const value=await chatApi.get(selected);accept(value);if(mounted.current)setError('');}catch(e){if(mounted.current)setError(explain(e));}},[accept]);
 useEffect(()=>{if(!open||(!busy&&snapshot?.session.state!=='thinking'))return;const timer=setInterval(()=>void load(),1500);return()=>clearInterval(timer);},[open,busy,snapshot?.session.state,load]);
 const create=useCallback(async(demo=false)=>{if(action.current)return;action.current=true;setBusy(true);setError('');const token=++sequence.current;
  try{const value=await chatApi.create(provider,demo);if(!mounted.current||token!==sequence.current)return;id.current=value.session.id;setSnapshot(value);accept(value);setOpen(true);ambiguous.current=null;}
  catch(e){if(mounted.current)setError(explain(e));}finally{action.current=false;if(mounted.current)setBusy(false);}
 },[provider,accept]);
 useEffect(()=>{if(open&&initialized&&!id.current&&!busy&&!error)void create();},[open,initialized,busy,error,create]);
 async function select(session:string){if(action.current||snapshot?.session.state==='thinking')return;const token=++sequence.current;setBusy(true);setError('');id.current=session;setSnapshot(null);try{const value=await chatApi.get(session);if(mounted.current&&token===sequence.current)accept(value);}catch(e){if(mounted.current)setError(explain(e));}finally{if(mounted.current&&token===sequence.current)setBusy(false);}}
 async function send(text:string,fileIds:string[]):Promise<boolean>{const selected=id.current;if(!selected||action.current||snapshot?.session.state==='thinking')return false;action.current=true;setBusy(true);setError('');const last=ambiguous.current;const input=last?.id===selected&&last.input.text===text&&JSON.stringify(last.input.fileIds)===JSON.stringify(fileIds)?last.input:{text,fileIds,requestId:crypto.randomUUID()};ambiguous.current={id:selected,input};
  try{if(text.trim().startsWith('/tool ')){if(fileIds.length)throw new Error('工具指令不支持同时上传附件，请分开发送。');const previous=uncertainCommand.current;const command=previous?.sessionId===selected&&previous.command===text.trim()?previous:{command:text.trim(),sessionId:selected,requestId:input.requestId};uncertainCommand.current=command;accept(await chatApi.executeCommand(command));uncertainCommand.current=null;}else if(text.trim().startsWith('/write ')){if(fileIds.length)throw new Error('写入指令不支持同时上传附件，请分开发送。');const previous=uncertainWrite.current;const command=previous?.sessionId===selected&&previous.command===text.trim()?previous:{command:text.trim(),sessionId:selected,requestId:input.requestId};uncertainWrite.current=command;accept(await chatApi.executeWriteCommand(command));uncertainWrite.current=null;}else accept(await chatApi.send(selected,input));ambiguous.current=null;return true;}
  catch(e){try{const value=await chatApi.get(selected);accept(value);if(value.messages.some(m=>m.requestId===input.requestId)){ambiguous.current=null;return true;}}catch{}
   if(mounted.current)setError(explain(e));return false;
  }finally{action.current=false;if(mounted.current)setBusy(false);}
 }
 async function executeTool(name:string,parameters:Record<string,unknown>):Promise<boolean>{
  const selected=id.current;if(!selected||action.current||snapshot?.session.state==='thinking')return false;action.current=true;setBusy(true);setError('');
  const previous=uncertainTool.current;const input:ToolExecuteInput=previous?.sessionId===selected&&previous.name===name&&JSON.stringify(previous.parameters)===JSON.stringify(parameters)?previous:{name,parameters,sessionId:selected,requestId:crypto.randomUUID()};uncertainTool.current=input;
  try{const result=await chatApi.executeTool(input);if(!('session'in result))throw new Error(result.message);accept(result);uncertainTool.current=null;return true;}
  catch(e){try{const loaded=await chatApi.get(selected);accept(loaded);if(loaded.messages.some(m=>m.requestId===input.requestId)){uncertainTool.current=null;return true;}}catch{}if(mounted.current)setError(explain(e));return false;}
  finally{action.current=false;if(mounted.current)setBusy(false);}
 }
 async function retry(message:string){const selected=id.current;if(!selected||action.current)return;action.current=true;setBusy(true);setError('');try{accept(await chatApi.retry(selected,message));}catch(e){if(mounted.current)setError(explain(e));}finally{action.current=false;if(mounted.current)setBusy(false);}}
 async function decide(message:string,decision:'approved'|'rejected'){const selected=id.current;if(!selected||action.current)return;action.current=true;setBusy(true);setError('');try{const current=snapshot?.messages.find(item=>item.id===message);if(current?.type==='confirmation'&&!current.content.demoOnly&&current.content.approvalId){await chatApi.decideApproval(current.content.approvalId,decision,decision==='rejected'?'用户在聊天窗口驳回':'');accept(await chatApi.get(selected));}else accept(await chatApi.decision(selected,message,decision));}catch(e){try{accept(await chatApi.get(selected));}catch{}if(mounted.current)setError(explain(e));}finally{action.current=false;if(mounted.current)setBusy(false);}}
 return {open,setOpen,initialized,snapshot,sessions,models,provider,setProvider,busy:busy||snapshot?.session.state==='thinking',error,setError,create,select,send,executeTool,retry,decide,reload:load};
}
export type ChatState=ReturnType<typeof useChat>;
