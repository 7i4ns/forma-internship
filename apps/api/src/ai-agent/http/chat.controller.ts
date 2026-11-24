import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SessionGuard, type SessionRequest } from '../../user/session.guard';
import { dtoPipe } from '../../shared/validation';
import { ChatService } from '../application/chat.service';
import { ModelGateway } from '../infrastructure/model-gateway';
import { CreateSessionDto, DecisionDto, SendMessageDto } from './chat.dto';
const uuid=()=>new ParseUUIDPipe({version:'4'});
@ApiTags('AI Agent') @ApiCookieAuth('session') @UseGuards(SessionGuard)
@ApiResponse({status:401,description:'会话未登录或已失效'}) @ApiResponse({status:404,description:'资源不存在或不属于当前用户'})
@Controller('ai-agent')
export class ChatController {
 constructor(@Inject(ChatService)private readonly chat:ChatService,@Inject(ModelGateway)private readonly model:ModelGateway){}
 @Get('models') @ApiOperation({summary:'列出模型配置状态，不返回密钥或服务地址'}) models(){return {items:this.model.profiles()};}
 @Get('sessions') @ApiOperation({summary:'加载当前用户最近100个会话'}) list(@Req()r:SessionRequest){return this.chat.list(r.userId);}
 @Post('sessions') @ApiBody({type:CreateSessionDto}) @ApiOperation({summary:'创建固定模型的新对话'}) create(@Req()r:SessionRequest,@Body(dtoPipe(CreateSessionDto))body:CreateSessionDto){return this.chat.create(r.userId,body.provider);}
 @Post('sessions/demo') @ApiBody({type:CreateSessionDto}) @ApiOperation({summary:'创建明确标识的五类消息渲染演示，不调用模型'}) demo(@Req()r:SessionRequest,@Body(dtoPipe(CreateSessionDto))body:CreateSessionDto){return this.chat.create(r.userId,body.provider,true);}
 @Get('sessions/:id') @ApiOperation({summary:'读取持久化消息，包括生成中/失败状态'}) get(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.chat.get(r.userId,id);}
 @Post('sessions/:id/messages') @HttpCode(200) @ApiBody({type:SendMessageDto}) @ApiOperation({summary:'发送多轮消息并持久化回答；检查assistant.status判断模型生成是否成功'})
 send(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Body(dtoPipe(SendMessageDto))body:SendMessageDto){if(!body.text.trim()&&!body.fileIds.length)throw new BadRequestException({code:'EMPTY_MESSAGE',message:'请输入消息或上传附件'});return this.chat.send(r.userId,id,body);}
 @Post('sessions/:id/messages/:messageId/retry') @HttpCode(200) @ApiOperation({summary:'重试最后一条失败回答，不重复添加用户消息'}) retry(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Param('messageId',uuid())message:string){return this.chat.retry(r.userId,id,message);}
 @Post('sessions/:id/messages/:messageId/decision') @HttpCode(200) @ApiBody({type:DecisionDto}) @ApiOperation({summary:'持久化示例人工确认选择；不执行业务操作'}) decision(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Param('messageId',uuid())message:string,@Body(dtoPipe(DecisionDto))body:DecisionDto){return this.chat.decision(r.userId,id,message,body.decision);}
 @Post('sessions/:id/files') @ApiConsumes('multipart/form-data') @ApiOperation({summary:'上传会话附件，单文件5MB；文本可提取上下文，PDF/图片仅保存'}) @ApiBody({schema:{type:'object',required:['file'],properties:{file:{type:'string',format:'binary'}}}})
 @UseInterceptors(FileInterceptor('file',{storage:memoryStorage(),limits:{fileSize:5242880,files:1,fields:0}}))
 upload(@Req()r:SessionRequest,@Param('id',uuid())id:string,@UploadedFile()file:Express.Multer.File|undefined){return this.chat.upload(r.userId,id,file);}
 @Get('files/:id') @ApiOperation({summary:'下载本人会话附件；强制attachment防止执行上传内容'}) async file(@Req()r:SessionRequest,@Param('id',uuid())id:string,@Res()res:Response){const f=await this.chat.file(r.userId,id);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.setHeader('X-Content-Type-Options','nosniff');res.send(f.data);}
 @Delete('files/:id') @ApiOperation({summary:'删除尚未发送的本人草稿附件'}) remove(@Req()r:SessionRequest,@Param('id',uuid())id:string){return this.chat.removeFile(r.userId,id);}
}
