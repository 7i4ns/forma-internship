import { Inject, Injectable } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { CompanyFilterQuery } from './company-filter';
/** Business-layer facade over the original shared company aggregation. */
@Injectable()
export class CompanyAnalysisService {
 constructor(@Inject(DashboardService)private readonly dashboard:DashboardService){}
 aggregate(query:CompanyFilterQuery){return this.dashboard.getCompaniesByFilter(query);}
}
