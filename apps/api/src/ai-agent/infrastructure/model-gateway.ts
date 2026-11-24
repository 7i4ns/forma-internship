import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { ModelProfile, ModelProvider } from '@internship/ai-contracts';
export type ModelTurn = {role:'system'|'user'|'assistant';content:string};
export class ModelError extends Error {constructor(public code:string,message:string){super(message);}}
const labels:Record<ModelProvider,string>={ollama:'本地 Qwen · Ollama',deepseek:'DeepSeek',qwen:'Qwen API',gpt:'GPT',kimi:'Kimi'};
const providers=Object.keys(labels) as ModelProvider[];
export function modelConfig(provider:ModelProvider,env:NodeJS.ProcessEnv=process.env){
 if(!providers.includes(provider))throw new ServiceUnavailableException({code:'MODEL_NOT_CONFIGURED',message:'模型提供方无效'});
 const prefix=provider==='gpt'?'OPENAI':provider.toUpperCase();
 const model=env[`${prefix}_MODEL`]||(provider==='ollama'?'qwen3:8b':'');
 // Remote endpoints are explicit server configuration, never browser input.
 const base=env[`${prefix}_BASE_URL`]||(provider==='ollama'?'http://127.0.0.1:11434':'');
 const key=env[`${prefix}_API_KEY`]||'';
 const configured=!!model&&!!base&&(provider==='ollama'||!!key);
 return {provider,model,base:base.replace(/\/$/,''),key,configured};
}
export function defaultProvider():ModelProvider {const name=process.env.AI_MODEL_PROVIDER||process.env.MODEL_PROVIDER||'ollama';return name==='api'?'gpt':providers.includes(name as ModelProvider)?name as ModelProvider:'ollama';}
export const modelTimeout=()=>Math.min(180000,Math.max(1000,Number(process.env.AI_MODEL_TIMEOUT_MS)||120000));
@Injectable()
export class ModelGateway {
 profiles():ModelProfile[]{return providers.map(provider=>{const c=modelConfig(provider);return {provider,label:labels[provider],model:c.model,configured:c.configured,isLocal:provider==='ollama',isDefault:provider===defaultProvider()};});}
 require(provider:ModelProvider){const c=modelConfig(provider);if(!c.configured)throw new ServiceUnavailableException({code:'MODEL_NOT_CONFIGURED',message:'该模型尚未配置，请选择可用模型或在服务端设置密钥、地址和模型名称'});return c;}
 async complete(provider:ModelProvider,model:string,messages:ModelTurn[],fetcher:typeof fetch=fetch):Promise<string>{
  const config=this.require(provider);const local=provider==='ollama';
  const path=local?'/api/chat':'/chat/completions';
  const body=local?{model,messages,stream:false,think:false,options:{num_ctx:8192,num_predict:768,temperature:0.3}}:{model,messages,stream:false,...(provider==='gpt'?{max_completion_tokens:1536}:{max_tokens:1536})};
  try {
   const response=await fetcher(config.base+path,{method:'POST',headers:{'Content-Type':'application/json',...(!local?{Authorization:`Bearer ${config.key}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(modelTimeout())});
   if(!response.ok)throw new ModelError(response.status===429?'MODEL_RATE_LIMIT':'MODEL_UPSTREAM_ERROR',response.status===429?'模型服务繁忙，请稍后重试':'模型服务返回错误，请检查配置或稍后重试');
   const result=await response.json();const text=local?result.message?.content:result.choices?.[0]?.message?.content;
   if(typeof text!=='string'||!text.trim())throw new ModelError('MODEL_EMPTY_REPLY','模型未返回有效文本，请重试');
   return text.replace(/<think>[\s\S]*?<\/think>/g,'').trim().slice(0,24000)||'模型未返回可显示的回答，请重试。';
  }catch(error){if(error instanceof ModelError)throw error;if((error as Error).name==='TimeoutError'||(error as Error).name==='AbortError')throw new ModelError('MODEL_TIMEOUT','模型响应超时，可点击重试；你的消息已保存');throw new ModelError('MODEL_UNAVAILABLE','暂时无法连接模型，请检查本地模型服务或网络后重试');}
 }
}
