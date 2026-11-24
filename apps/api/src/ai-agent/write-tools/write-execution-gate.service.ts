import { ConflictException, Injectable } from '@nestjs/common';
/** Central interception point for every write. A confirmation token flow is deliberately not enabled this week. */
@Injectable()
export class WriteExecutionGateService {
 requireConfirmedDispatch():never {
  throw new ConflictException({code:'WRITE_CONFIRMATION_REQUIRED',message:'写入操作默认禁止自动执行，必须由后续人工确认拦截层授权'});
 }
}
