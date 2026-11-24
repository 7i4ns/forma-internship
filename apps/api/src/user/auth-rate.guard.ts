import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { SessionRequest } from './session.guard';
@Injectable()
export class AuthRateGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const now = Date.now();
    for (const [key, entry] of this.attempts) if (entry.until <= now) this.attempts.delete(key);
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const entry = this.attempts.get(ip) || { count: 0, until: now + 60000 };
    entry.count++;
    this.attempts.set(ip, entry);
    if (entry.count > 30) throw new HttpException({ code: 'TOO_MANY_REQUESTS', message: '操作过于频繁，请一分钟后重试' }, 429);
    return true;
  }
}
