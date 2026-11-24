import 'reflect-metadata';
import 'dotenv/config';
import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DashboardModule } from './dashboard/dashboard.module';
import { CompanyModule } from './company/company.module';
import { UserModule } from './user/user.module';
import { AiAgentModule } from './ai-agent/ai-agent.module';
import { SwaggerModule } from '@nestjs/swagger';
import { createApiDocument } from './docs/openapi';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';

@Controller()
class AppController {
  @Get('health')
  async health() {
    const pg = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
    const redis = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 3000, reconnectStrategy: false } });
    redis.on('error', () => {});
    try {
      const result = await pg.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
      if (!result.rowCount) throw new Error('pgvector missing');
      await redis.connect();
      return { status: 'ok', postgres: 'ok', pgvector: result.rows[0].extversion, redis: await redis.ping() };
    } catch { throw new ServiceUnavailableException('PostgreSQL / pgvector / Redis unavailable'); }
    finally { await pg.end(); if (redis.isOpen) await redis.quit(); }
  }
  @Get('agent/smoke')
  async agent() {
    const state = Annotation.Root({ message: Annotation<string> });
    const graph = new StateGraph(state).addNode('hello', () => ({ message: 'LangGraph ready' })).addEdge(START, 'hello').addEdge('hello', END).compile();
    return graph.invoke({ message: '' });
  }
}
@Module({ imports: [UserModule, CompanyModule, DashboardModule, AiAgentModule], controllers: [AppController] })
class AppModule {}
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: (process.env.WEB_ORIGINS || 'http://127.0.0.1:3000,http://localhost:3000').split(','), credentials: true });
  app.enableShutdownHooks();
  SwaggerModule.setup('docs', app, createApiDocument(app), { swaggerOptions: { withCredentials: true, displayRequestDuration: true, persistAuthorization: false }, customSiteTitle: 'Forma API 文档' });
  const port=Number(process.env.API_PORT||3001);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid API_PORT');
  await app.listen(port, '127.0.0.1');
}
void bootstrap();
