import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from './user.service';
import type { IncomingMessage } from 'node:http';
export type SessionRequest = IncomingMessage & { userId: string; ip?: string };
export const sessionCookie = 'internship_session';
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService, @Inject(UserService) private readonly users: UserService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method || 'GET') && request.headers.origin && !(process.env.WEB_ORIGINS || 'http://127.0.0.1:3000,http://localhost:3000').split(',').includes(request.headers.origin)) throw new ForbiddenException({ code: 'INVALID_ORIGIN', message: '请求来源无效' });
    const response = context.switchToHttp().getResponse<{ setHeader: (key: string, value: string) => void }>();
    response.setHeader('Cache-Control', 'no-store');
    const token = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
    try {
      if (!token) throw new Error('Missing session');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { algorithms: ['HS256'], issuer: 'internship-api', audience: 'internship-web' });
      if (typeof payload.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.sub)) throw new Error('Invalid subject');
      await this.users.findById(payload.sub);
      request.userId = payload.sub;
      return true;
    } catch { throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '请先登录，或重新登录以更新状态' }); }
  }
}
