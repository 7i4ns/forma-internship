import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type EncryptedPayload={version:string;iv:string;tag:string;data:string};

@Injectable()
export class ApprovalPayloadCipherService {
 private readonly key:Buffer;
 constructor(){
  const secret=process.env.AI_APPROVAL_ENCRYPTION_KEY||process.env.JWT_SECRET||process.env.SESSION_SECRET;
  if(!secret)throw new Error('AI approval encryption secret is not configured');
  this.key=createHash('sha256').update(secret).digest();
 }
 encrypt(value:unknown):EncryptedPayload{
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return{version:'aes-256-gcm-v1',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
 }
 decrypt<T>(payload:EncryptedPayload):T{
  if(payload.version!=='aes-256-gcm-v1')throw new Error('Unsupported approval payload version');
  const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(payload.iv,'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data,'base64')),decipher.final()]).toString('utf8')) as T;
 }
}
