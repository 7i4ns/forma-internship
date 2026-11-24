import { Body, Controller, Get, Header, HttpCode, Inject, Post, Req, Res, UseGuards, ValidationPipe, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ServerResponse } from 'node:http';
import { CredentialsDto } from './credentials.dto';
import { UserService } from './user.service';
import { SessionGuard, sessionCookie, SessionRequest } from './session.guard';
import { AuthRateGuard } from './auth-rate.guard';
const credentialsPipe = new ValidationPipe({
  expectedType: CredentialsDto, transform: true, whitelist: true, forbidNonWhitelisted: true,
  exceptionFactory: errors => new BadRequestException({ code: 'VALIDATION_ERROR', message: '请检查输入内容', errors: Object.fromEntries(errors.map(error => [error.property, Object.values(error.constraints || {})[0] || '输入无效'])) }),
});
@ApiTags('User')
@Controller('auth')
export class UserController {
  constructor(@Inject(UserService) private readonly users: UserService, @Inject(JwtService) private readonly jwt: JwtService) {}
  private checkOrigin(request: SessionRequest) {
    const allowed = (process.env.WEB_ORIGINS || 'http://127.0.0.1:3000,http://localhost:3000').split(',');
    if (request.headers.origin && !allowed.includes(request.headers.origin)) throw new ForbiddenException({ code: 'INVALID_ORIGIN', message: '请求来源无效' });
  }
  @Post('signup')
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthRateGuard)
  @ApiOperation({ summary: '注册新用户' })
  @ApiBody({ type: CredentialsDto })
  @ApiResponse({ status: 201, description: '注册成功' })
  @ApiResponse({ status: 409, description: 'EMAIL_EXISTS：邮箱已注册' })
  @ApiResponse({ status: 400, description: 'VALIDATION_ERROR：字段校验失败' })
  async signup(@Body(credentialsPipe) body: CredentialsDto, @Req() request: SessionRequest) {
    this.checkOrigin(request);
    return { code: 'SIGNUP_SUCCESS', message: '注册成功，请使用新账号登录', user: await this.users.signup(body) };
  }
  @Post('login')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @UseGuards(AuthRateGuard)
  @ApiBody({ type: CredentialsDto })
  @ApiOperation({ summary: '邮箱密码登录，设置 HttpOnly 会话 Cookie' })
  @ApiResponse({ status: 401, description: 'EMAIL_NOT_FOUND 或 WRONG_PASSWORD' })
  async login(@Body(credentialsPipe) body: CredentialsDto, @Req() request: SessionRequest, @Res({ passthrough: true }) response: ServerResponse) {
    this.checkOrigin(request);
    const user = await this.users.login(body);
    const token = await this.jwt.signAsync({ sub: user.id }, { issuer: 'internship-api', audience: 'internship-web', algorithm: 'HS256' });
    response.setHeader('Set-Cookie', `${sessionCookie}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=3600${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
    return { code: 'LOGIN_SUCCESS', message: '登录成功', user };
  }
  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: '获取当前登录用户（不返回密码）' })
  async me(@Req() request: SessionRequest) { return { user: await this.users.findById(request.userId) }; }
  @Post('logout')
  @Header('Cache-Control', 'no-store')
  @HttpCode(200)
  @ApiOperation({ summary: '退出登录，清除浏览器会话 Cookie' })
  logout(@Req() request: SessionRequest, @Res({ passthrough: true }) response: ServerResponse) {
    this.checkOrigin(request);
    response.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
    return { code: 'LOGOUT_SUCCESS', message: '已退出登录' };
  }
}
