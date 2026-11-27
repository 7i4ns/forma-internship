import { api } from '../../../lib/api';
import type { ChatSession, ChatSnapshot, FileAttachment, ModelProfile, ModelProvider, SendMessageInput, ToolDescriptor, ToolExecuteInput, ToolIntent, ToolResult, WriteApprovalDecisionResult, WriteApprovalDetail, WriteApprovalListItem } from '@internship/ai-contracts';
export const chatApi = {
 tools:()=>api<{items:ToolDescriptor[]}>('/ai-agent/tools'),
 matchTools:(intent:ToolIntent)=>api<{items:ToolDescriptor[]}>('/ai-agent/tools/match',{method:'POST',body:JSON.stringify({intent})}),
 executeTool:(input:ToolExecuteInput)=>api<ToolResult|ChatSnapshot>('/ai-agent/tools/execute',{method:'POST',body:JSON.stringify(input)}),
 executeCommand:(input:{command:string;sessionId:string;requestId:string})=>api<ChatSnapshot>('/ai-agent/tools/command',{method:'POST',body:JSON.stringify(input)}),
 executeWriteCommand:(input:{command:string;sessionId:string;requestId:string})=>api<ChatSnapshot>('/ai-agent/write-tools/command',{method:'POST',body:JSON.stringify(input)}),
 models:()=>api<{items:ModelProfile[]}>('/ai-agent/models'),
 sessions:()=>api<{items:ChatSession[]}>('/ai-agent/sessions'),
 get:(id:string)=>api<ChatSnapshot>(`/ai-agent/sessions/${id}`),
 create:(provider:ModelProvider,demo=false)=>api<ChatSnapshot>(`/ai-agent/sessions${demo?'/demo':''}`,{method:'POST',body:JSON.stringify({provider})}),
 send:(id:string,body:SendMessageInput)=>api<ChatSnapshot>(`/ai-agent/sessions/${id}/messages`,{method:'POST',body:JSON.stringify(body)}),
 retry:(id:string,message:string)=>api<ChatSnapshot>(`/ai-agent/sessions/${id}/messages/${message}/retry`,{method:'POST',body:'{}'}),
 upload:(id:string,file:File)=>{const data=new FormData();data.append('file',file);return api<{file:FileAttachment}>(`/ai-agent/sessions/${id}/files`,{method:'POST',body:data});},
 removeFile:(id:string)=>api(`/ai-agent/files/${id}`,{method:'DELETE'}),
 decision:(id:string,message:string,decision:'approved'|'rejected')=>api<ChatSnapshot>(`/ai-agent/sessions/${id}/messages/${message}/decision`,{method:'POST',body:JSON.stringify({decision})}),
 decideApproval:(approvalId:string,decision:'approved'|'rejected',reason?:string)=>api<WriteApprovalDecisionResult>(`/ai-agent/write-tools/approvals/${approvalId}/decision`,{method:'POST',body:JSON.stringify({decision,...(reason?{reason}:{})})}),
 approvals:(query:string)=>api<{items:WriteApprovalListItem[];total:number;page:number;limit:number}>(`/ai-agent/write-tools/approvals${query?'?'+query:''}`),
 approval:(approvalId:string)=>api<WriteApprovalDetail>(`/ai-agent/write-tools/approvals/${approvalId}`),
};
