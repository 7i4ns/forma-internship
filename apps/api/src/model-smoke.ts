import 'dotenv/config';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
async function main() {
  const model = process.env.MODEL_PROVIDER === 'api'
    ? new ChatOpenAI({ model: process.env.OPENAI_MODEL, apiKey: process.env.OPENAI_API_KEY, configuration: { baseURL: process.env.OPENAI_BASE_URL }, maxRetries: 0, timeout: 120000 })
    : new ChatOllama({ model: process.env.OLLAMA_MODEL || 'qwen3:8b', baseUrl: process.env.OLLAMA_BASE_URL, numCtx: 4096, numPredict: 128, think: false, temperature: 0 });
  const state = Annotation.Root({ answer: Annotation<string> });
  const graph = new StateGraph(state).addNode('model', async () => {
    const response = await model.invoke('Reply with exactly: internship ready /no_think');
    const answer = String(response.content).trim();
    if (!answer) throw new Error('Model returned empty content');
    return { answer };
  }).addEdge(START, 'model').addEdge('model', END).compile();
  console.log(await graph.invoke({ answer: '' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
