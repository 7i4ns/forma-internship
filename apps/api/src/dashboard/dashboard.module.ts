import { CompanyAnalysisService } from './company-analysis.service';
import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
@Module({ imports: [UserModule], controllers: [DashboardController], providers: [DashboardService,CompanyAnalysisService], exports: [DashboardService,CompanyAnalysisService] })
export class DashboardModule {}
