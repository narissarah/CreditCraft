export interface ReportType {
  id: string;
  name: string;
  description?: string;
  type: 'transaction' | 'customer' | 'credit' | 'analytics';
  configuration: ReportConfiguration;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isPublic: boolean;
  schedules?: ReportScheduleType[];
}

export interface ReportConfiguration {
  filters: Record<string, any>;
  columns: string[];
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  chartType?: 'bar' | 'line' | 'pie' | 'table';
  dateRange?: {
    start: string | Date;
    end: string | Date;
  };
  customOptions?: Record<string, any>;
}

export interface SaveReportParams {
  name: string;
  description?: string;
  type: 'transaction' | 'customer' | 'credit' | 'analytics';
  configuration: ReportConfiguration;
  isPublic?: boolean;
}

export interface ReportScheduleType {
  id: string;
  reportId: string;
  report?: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6, Sunday to Saturday (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  month?: number; // 0-11 (for quarterly)
  hour: number;
  minute: number;
  recipients: string[];
  format: 'pdf' | 'csv' | 'excel';
  includeData: boolean;
  subject?: string;
  message?: string;
  nextRunDate: Date;
  lastRunDate?: Date;
  lastRunStatus?: 'success' | 'failed';
  lastRunError?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
}

export interface ReportFilterParams {
  page?: number;
  limit?: number;
  type?: 'transaction' | 'customer' | 'credit' | 'analytics';
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isPublic?: boolean;
}

export interface ReportResult {
  summary?: Record<string, any>;
  data: any[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface EmailAttachment {
  filename: string;
  path: string;
  contentType?: string;
}

export interface ReportExportOptions {
  format: 'pdf' | 'csv' | 'excel';
  includeCharts: boolean;
  includeSummary: boolean;
  filename?: string;
}

export interface ScheduleReportParams {
  reportId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  month?: number;
  hour: number;
  minute: number;
  recipients: string[];
  format: 'pdf' | 'csv' | 'excel';
  includeData: boolean;
  subject?: string;
  message?: string;
} 