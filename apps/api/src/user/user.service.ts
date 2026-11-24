import { Inject, Optional } from '@nestjs/common';
import { ManagementService } from './management.service';
import { ConflictException, Injectable, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { CredentialsDto } from './credentials.dto';
import { CreateUserDto, UpdateUserDto } from './management.dto';
import { AiCacheService } from '../ai-agent/infrastructure/ai-cache.service';
const deriveKey = promisify(scrypt);
export type PublicUser = { id: string; email: string; created_at: string; name: string; role: string; status: string };
type StoredUser = PublicUser & { password_hash: string };
@Injectable()
export class UserService implements OnModuleDestroy {
  constructor(@Optional() @Inject(ManagementService) private readonly management?:ManagementService,@Optional() @Inject(AiCacheService)private readonly aiCache?:AiCacheService){}
  async queryForAgent(query:Record<string,unknown>,visibleUserIds:string[]){if(!this.management)throw new Error("User query service unavailable");return this.management.list(query,visibleUserIds);}
  async validateAgentCreate(body:CreateUserDto){if(!this.management)throw new Error('User management service unavailable');return this.management.validateCreate(body);}
  async validateAgentUpdate(id:string,body:UpdateUserDto,actor:string){if(!this.management)throw new Error('User management service unavailable');return this.management.validateUpdate(id,body,actor);}
  async validateAgentDelete(ids:string[],actor:string){if(!this.management)throw new Error('User management service unavailable');return this.management.validateRemove(ids,actor);}
  async getAgentUser(id:string){if(!this.management)throw new Error('User management service unavailable');return this.management.get(id);}

  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
  async onModuleDestroy() { await this.pool.end(); }
  async signup({ email, password }: CredentialsDto): Promise<PublicUser> {
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64) as Buffer;
    try {
      const { rows } = await this.pool.query<PublicUser>(
        `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, created_at, name, role, status`,
        [email, `scrypt:${salt}:${key.toString('hex')}`, email.split('@')[0].slice(0,100)],
      );
      await this.aiCache?.invalidateUsers();return rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException({ code: 'EMAIL_EXISTS', message: '该邮箱已注册，请直接登录', field: 'email' });
      throw error;
    }
  }
  async login({ email, password }: CredentialsDto): Promise<PublicUser> {
    const { rows } = await this.pool.query<StoredUser>('SELECT id, email, password_hash, created_at, name, role, status FROM users WHERE email = $1', [email]);
    const stored = rows[0];
    // Run the same expensive hash operation even when the account does not exist.
    const [, salt, encoded] = (stored?.password_hash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    const key = await deriveKey(password, salt, 64) as Buffer;
    const expected = Buffer.from(encoded, 'hex');
    const valid = expected.length === key.length && timingSafeEqual(expected, key);
    if (!stored) throw new UnauthorizedException({ code: 'EMAIL_NOT_FOUND', message: '该邮箱尚未注册', field: 'email' });
    if (!valid) throw new UnauthorizedException({ code: 'WRONG_PASSWORD', message: '密码错误，请重新输入', field: 'password' });
    if (stored.status !== 'active') throw new UnauthorizedException({ code: 'ACCOUNT_INACTIVE', message: '该账号已停用，请联系管理人员' });
    return { id: stored.id, email: stored.email, created_at: stored.created_at, name: stored.name, role: stored.role, status: stored.status };
  }
  async findById(id: string): Promise<PublicUser> {
    const { rows } = await this.pool.query<PublicUser>('SELECT id, email, created_at, name, role, status FROM users WHERE id = $1', [id]);
    if (!rows[0] || rows[0].status !== 'active') throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '登录状态已失效，请重新登录' });
    return rows[0];
  }
}
