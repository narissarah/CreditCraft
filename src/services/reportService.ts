import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';

export class ReportService {
  /**
   * Get dashboard overview data
   */
  async getDashboardData(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.setDate(now.getDate() - 30));
      const end = endDate || new Date();

      // Basic metrics
      const [
        totalActiveCredits,
        totalActiveCustomers,
        creditStats,
        transactionData
      ] = await Promise.all([
        // Count of active credits
        prisma.credit.count({
          where: {
            status: 'ACTIVE',
            expirationDate: {
              gt: new Date()
            }
          }
        }),
        // Count of customers with active credits
        prisma.customer.count({
          where: {
            credits: {
              some: {
                status: 'ACTIVE',
                expirationDate: {
                  gt: new Date()
                }
              }
            }
          }
        }),
        // Credit statistics
        prisma.$queryRaw`
          SELECT 
            SUM(CASE WHEN status = 'ACTIVE' THEN balance ELSE 0 END) as totalActiveBalance,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END) as activeCount,
            COUNT(CASE WHEN status = 'EXPIRED' THEN 1 ELSE NULL END) as expiredCount,
            COUNT(CASE WHEN status = 'REDEEMED' THEN 1 ELSE NULL END) as redeemedCount,
            AVG(amount) as avgAmount
          FROM "Credit"
          WHERE "createdAt" BETWEEN ${start} AND ${end}
        `,
        // Daily transaction data
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', "createdAt") as date,
            SUM(amount) as amount,
            COUNT(*) as count,
            type
          FROM "Transaction"
          WHERE "createdAt" BETWEEN ${start} AND ${end}
          GROUP BY DATE_TRUNC('day', "createdAt"), type
          ORDER BY date ASC
        `
      ]);

      // Process transaction data for charts
      const dates = this.getDateRange(start, end);
      const transactionsByDay = this.processTransactionsByDay(dates, transactionData);
      
      // Format the response
      return {
        summary: {
          totalActiveCredits,
          totalActiveCustomers,
          totalActiveBalance: creditStats[0]?.totalActiveBalance || 0,
          avgCreditAmount: creditStats[0]?.avgAmount || 0,
          activeCreditsCount: creditStats[0]?.activeCount || 0,
          expiredCreditsCount: creditStats[0]?.expiredCount || 0,
          redeemedCreditsCount: creditStats[0]?.redeemedCount || 0
        },
        charts: {
          transactionTrend: {
            type: 'bar',
            labels: dates.map(d => d.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Issue',
                data: transactionsByDay.map(d => d.issueAmount || 0)
              },
              {
                label: 'Redeem',
                data: transactionsByDay.map(d => Math.abs(d.redeemAmount || 0))
              },
              {
                label: 'Adjust',
                data: transactionsByDay.map(d => d.adjustAmount || 0)
              }
            ]
          },
          creditDistribution: {
            type: 'doughnut',
            labels: ['Active', 'Expired', 'Redeemed'],
            datasets: [
              {
                data: [
                  creditStats[0]?.activeCount || 0,
                  creditStats[0]?.expiredCount || 0,
                  creditStats[0]?.redeemedCount || 0
                ]
              }
            ]
          }
        }
      };
    } catch (error) {
      logger.error('Error generating dashboard data:', error);
      throw new Error('Failed to generate dashboard data');
    }
  }

  /**
   * Get credit analytics data
   */
  async getCreditAnalyticsData(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.setDate(now.getDate() - 30));
      const end = endDate || new Date();

      // Get credit statistics
      const [
        creditStats,
        creditsByDay,
        expirationData,
        redemptionRateByType
      ] = await Promise.all([
        // Basic credit statistics
        prisma.$queryRaw`
          SELECT 
            COUNT(*) as total,
            SUM(amount) as totalAmount,
            SUM(balance) as totalBalance,
            AVG(amount) as avgAmount,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END) as activeCount,
            COUNT(CASE WHEN status = 'EXPIRED' THEN 1 ELSE NULL END) as expiredCount,
            COUNT(CASE WHEN status = 'REDEEMED' THEN 1 ELSE NULL END) as redeemedCount
          FROM "Credit"
          WHERE "createdAt" BETWEEN ${start} AND ${end}
        `,
        // Credits issued by day
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', "createdAt") as date,
            COUNT(*) as count,
            SUM(amount) as amount
          FROM "Credit"
          WHERE "createdAt" BETWEEN ${start} AND ${end}
          GROUP BY DATE_TRUNC('day', "createdAt")
          ORDER BY date ASC
        `,
        // Expiration data
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', "expirationDate") as date,
            COUNT(*) as count,
            SUM(balance) as amount
          FROM "Credit"
          WHERE "expirationDate" BETWEEN ${start} AND DATE_ADD(${end}, INTERVAL 90 DAY)
          GROUP BY DATE_TRUNC('day', "expirationDate")
          ORDER BY date ASC
        `,
        // Redemption rate by credit type
        prisma.$queryRaw`
          SELECT 
            c.code as creditType,
            COUNT(*) as totalCount,
            COUNT(CASE WHEN c.status = 'REDEEMED' THEN 1 ELSE NULL END) as redeemedCount,
            AVG(CASE WHEN c.status = 'REDEEMED' THEN (c.amount - c.balance) / c.amount ELSE 0 END) * 100 as redemptionRate
          FROM "Credit" c
          WHERE c."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY c.code
        `
      ]);

      // Process data for charts
      const dates = this.getDateRange(start, end);
      const creditsByDayFormatted = this.processCreditsByDay(dates, creditsByDay);
      
      return {
        summary: {
          totalCredits: creditStats[0]?.total || 0,
          totalAmount: creditStats[0]?.totalAmount || 0,
          totalBalance: creditStats[0]?.totalBalance || 0,
          avgAmount: creditStats[0]?.avgAmount || 0,
          activeCount: creditStats[0]?.activeCount || 0,
          expiredCount: creditStats[0]?.expiredCount || 0,
          redeemedCount: creditStats[0]?.redeemedCount || 0,
          redemptionRate: creditStats[0]?.redeemedCount && creditStats[0]?.total
            ? (creditStats[0].redeemedCount / creditStats[0].total * 100).toFixed(2) + '%'
            : '0%'
        },
        charts: {
          issuedCredits: {
            type: 'line',
            labels: dates.map(d => d.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Credits Issued',
                data: creditsByDayFormatted.map(d => d.count || 0)
              }
            ]
          },
          creditAmounts: {
            type: 'bar',
            labels: dates.map(d => d.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Credit Amount',
                data: creditsByDayFormatted.map(d => d.amount || 0)
              }
            ]
          },
          upcomingExpirations: {
            type: 'bar',
            labels: expirationData.map((d: any) => d.date.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Expiring Credits',
                data: expirationData.map((d: any) => d.count)
              },
              {
                label: 'Expiring Amount',
                data: expirationData.map((d: any) => d.amount)
              }
            ]
          },
          redemptionByType: {
            type: 'doughnut',
            labels: redemptionRateByType.map((d: any) => d.creditType),
            datasets: [
              {
                label: 'Redemption Rate',
                data: redemptionRateByType.map((d: any) => d.redemptionRate)
              }
            ]
          }
        }
      };
    } catch (error) {
      logger.error('Error generating credit analytics data:', error);
      throw new Error('Failed to generate credit analytics data');
    }
  }

  /**
   * Get customer segmentation data
   */
  async getCustomerSegmentationData(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.setDate(now.getDate() - 30));
      const end = endDate || new Date();

      // Get customer segments
      const [
        customerStats,
        creditsByCustomerSegment,
        topCustomers,
        customerActivity
      ] = await Promise.all([
        // Basic customer statistics
        prisma.$queryRaw`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'ACTIVE' THEN 1 ELSE NULL END) as activeCount,
            COUNT(CASE WHEN status = 'INACTIVE' THEN 1 ELSE NULL END) as inactiveCount,
            COUNT(CASE WHEN status = 'BLOCKED' THEN 1 ELSE NULL END) as blockedCount
          FROM "Customer"
          WHERE "createdAt" <= ${end}
        `,
        // Credits by customer segment/tag
        prisma.$queryRaw`
          SELECT 
            t.name as tag,
            COUNT(DISTINCT c.id) as customerCount,
            COUNT(cr.id) as creditCount,
            SUM(cr.amount) as totalAmount,
            AVG(cr.amount) as avgAmount
          FROM "Customer" c
          JOIN "CustomerTag" ct ON c.id = ct."customerId"
          JOIN "Tag" t ON ct."tagId" = t.id
          LEFT JOIN "Credit" cr ON c.id = cr."customerId" AND cr."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY t.name
        `,
        // Top customers by credit usage
        prisma.$queryRaw`
          SELECT 
            c.id,
            c.email,
            c."firstName",
            c."lastName",
            COUNT(cr.id) as creditCount,
            SUM(cr.amount) as totalAmount
          FROM "Customer" c
          JOIN "Credit" cr ON c.id = cr."customerId"
          WHERE cr."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY c.id, c.email, c."firstName", c."lastName"
          ORDER BY totalAmount DESC
          LIMIT 10
        `,
        // Customer activity over time
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', tr."createdAt") as date,
            COUNT(DISTINCT c.id) as customerCount,
            COUNT(tr.id) as transactionCount
          FROM "Customer" c
          JOIN "Credit" cr ON c.id = cr."customerId"
          JOIN "Transaction" tr ON cr.id = tr."creditId"
          WHERE tr."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY DATE_TRUNC('day', tr."createdAt")
          ORDER BY date ASC
        `
      ]);

      // Process data for charts
      const dates = this.getDateRange(start, end);
      const customerActivityFormatted = this.processCustomerActivity(dates, customerActivity);
      
      return {
        summary: {
          totalCustomers: customerStats[0]?.total || 0,
          activeCustomers: customerStats[0]?.activeCount || 0,
          inactiveCustomers: customerStats[0]?.inactiveCount || 0,
          blockedCustomers: customerStats[0]?.blockedCount || 0
        },
        charts: {
          customerSegments: {
            type: 'pie',
            labels: creditsByCustomerSegment.map((d: any) => d.tag),
            datasets: [
              {
                label: 'Customer Count',
                data: creditsByCustomerSegment.map((d: any) => d.customerCount)
              }
            ]
          },
          segmentCreditUsage: {
            type: 'bar',
            labels: creditsByCustomerSegment.map((d: any) => d.tag),
            datasets: [
              {
                label: 'Average Credit Amount',
                data: creditsByCustomerSegment.map((d: any) => d.avgAmount)
              },
              {
                label: 'Credit Count',
                data: creditsByCustomerSegment.map((d: any) => d.creditCount)
              }
            ]
          },
          customerActivity: {
            type: 'line',
            labels: dates.map(d => d.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Active Customers',
                data: customerActivityFormatted.map(d => d.customerCount || 0)
              },
              {
                label: 'Transactions',
                data: customerActivityFormatted.map(d => d.transactionCount || 0)
              }
            ]
          }
        },
        tables: [
          {
            title: 'Top Customers by Credit Usage',
            data: topCustomers.map((customer: any) => ({
              id: customer.id,
              name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown',
              email: customer.email,
              creditCount: customer.creditCount,
              totalAmount: customer.totalAmount
            }))
          }
        ]
      };
    } catch (error) {
      logger.error('Error generating customer segmentation data:', error);
      throw new Error('Failed to generate customer segmentation data');
    }
  }

  /**
   * Get staff performance data
   */
  async getStaffPerformanceData(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.setDate(now.getDate() - 30));
      const end = endDate || new Date();

      // Get staff performance metrics
      const [
        staffStats,
        staffPerformanceByDay,
        topStaffByVolume,
        topStaffByAmount
      ] = await Promise.all([
        // Basic staff statistics
        prisma.$queryRaw`
          SELECT 
            COUNT(DISTINCT s.id) as totalStaff,
            COUNT(DISTINCT t.id) as totalTransactions,
            SUM(CASE WHEN t.type = 'ISSUE' THEN t.amount ELSE 0 END) as issuedAmount,
            SUM(CASE WHEN t.type = 'REDEEM' THEN ABS(t.amount) ELSE 0 END) as redeemedAmount,
            AVG(t.amount) as avgTransactionAmount
          FROM "Staff" s
          JOIN "Transaction" t ON s.id = t."staffId"
          WHERE t."createdAt" BETWEEN ${start} AND ${end}
        `,
        // Staff performance by day
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('day', t."createdAt") as date,
            COUNT(DISTINCT s.id) as staffCount,
            COUNT(t.id) as transactionCount,
            SUM(CASE WHEN t.type = 'ISSUE' THEN t.amount ELSE 0 END) as issuedAmount,
            SUM(CASE WHEN t.type = 'REDEEM' THEN ABS(t.amount) ELSE 0 END) as redeemedAmount
          FROM "Staff" s
          JOIN "Transaction" t ON s.id = t."staffId"
          WHERE t."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY DATE_TRUNC('day', t."createdAt")
          ORDER BY date ASC
        `,
        // Top staff by transaction volume
        prisma.$queryRaw`
          SELECT 
            s.id,
            s.name,
            COUNT(t.id) as transactionCount
          FROM "Staff" s
          JOIN "Transaction" t ON s.id = t."staffId"
          WHERE t."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY s.id, s.name
          ORDER BY transactionCount DESC
          LIMIT 5
        `,
        // Top staff by transaction amount
        prisma.$queryRaw`
          SELECT 
            s.id,
            s.name,
            SUM(CASE WHEN t.type = 'ISSUE' THEN t.amount ELSE 0 END) as issuedAmount,
            SUM(CASE WHEN t.type = 'REDEEM' THEN ABS(t.amount) ELSE 0 END) as redeemedAmount,
            SUM(CASE WHEN t.type = 'ISSUE' THEN t.amount ELSE (CASE WHEN t.type = 'REDEEM' THEN ABS(t.amount) ELSE 0 END) END) as totalAmount
          FROM "Staff" s
          JOIN "Transaction" t ON s.id = t."staffId"
          WHERE t."createdAt" BETWEEN ${start} AND ${end}
          GROUP BY s.id, s.name
          ORDER BY totalAmount DESC
          LIMIT 5
        `
      ]);

      // Process data for charts
      const dates = this.getDateRange(start, end);
      const staffPerformanceFormatted = this.processStaffPerformance(dates, staffPerformanceByDay);
      
      return {
        summary: {
          totalStaff: staffStats[0]?.totalStaff || 0,
          totalTransactions: staffStats[0]?.totalTransactions || 0,
          issuedAmount: staffStats[0]?.issuedAmount || 0,
          redeemedAmount: staffStats[0]?.redeemedAmount || 0,
          avgTransactionAmount: staffStats[0]?.avgTransactionAmount || 0
        },
        charts: {
          staffPerformanceTrend: {
            type: 'line',
            labels: dates.map(d => d.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Transaction Count',
                data: staffPerformanceFormatted.map(d => d.transactionCount || 0)
              },
              {
                label: 'Active Staff',
                data: staffPerformanceFormatted.map(d => d.staffCount || 0)
              }
            ]
          },
          dailyAmounts: {
            type: 'bar',
            labels: dates.map(d => d.toISOString().split('T')[0]),
            datasets: [
              {
                label: 'Issued Amount',
                data: staffPerformanceFormatted.map(d => d.issuedAmount || 0)
              },
              {
                label: 'Redeemed Amount',
                data: staffPerformanceFormatted.map(d => d.redeemedAmount || 0)
              }
            ]
          },
          topStaffByVolume: {
            type: 'bar',
            labels: topStaffByVolume.map((d: any) => d.name),
            datasets: [
              {
                label: 'Transaction Count',
                data: topStaffByVolume.map((d: any) => d.transactionCount)
              }
            ]
          },
          topStaffByAmount: {
            type: 'bar',
            labels: topStaffByAmount.map((d: any) => d.name),
            datasets: [
              {
                label: 'Issued Amount',
                data: topStaffByAmount.map((d: any) => d.issuedAmount)
              },
              {
                label: 'Redeemed Amount',
                data: topStaffByAmount.map((d: any) => d.redeemedAmount)
              }
            ]
          }
        },
        tables: [
          {
            title: 'Top Staff by Transaction Volume',
            data: topStaffByVolume
          },
          {
            title: 'Top Staff by Transaction Amount',
            data: topStaffByAmount
          }
        ]
      };
    } catch (error) {
      logger.error('Error generating staff performance data:', error);
      throw new Error('Failed to generate staff performance data');
    }
  }

  /**
   * Get custom report data based on saved report configuration
   */
  async getCustomReportData(reportId: string, startDate?: Date, endDate?: Date): Promise<any> {
    try {
      const savedReport = await prisma.savedReport.findUnique({
        where: { id: reportId }
      });
      
      if (!savedReport) {
        throw new Error('Report not found');
      }
      
      const config = savedReport.config as any;
      
      // Determine which data to fetch based on metrics and dimensions
      const metrics = config.metrics || [];
      const dimensions = config.dimensions || [];
      
      // Call appropriate methods based on selected metrics
      const reports = [];
      
      if (metrics.some((m: string) => ['creditCount', 'creditAmount', 'avgCreditValue'].includes(m))) {
        reports.push(this.getCreditAnalyticsData(startDate, endDate));
      }
      
      if (metrics.some((m: string) => ['customerCount', 'redemptionRate'].includes(m))) {
        reports.push(this.getCustomerSegmentationData(startDate, endDate));
      }
      
      if (metrics.some((m: string) => ['transactionCount', 'transactionValue'].includes(m))) {
        reports.push(this.getStaffPerformanceData(startDate, endDate));
      }
      
      // Combine and process the results according to the report configuration
      const results = await Promise.all(reports);
      
      // Combine and transform data based on the configuration
      return this.transformCustomReportData(results, config, savedReport.name);
    } catch (error) {
      logger.error(`Error generating custom report data: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate custom report data');
    }
  }

  /**
   * Transform data for custom reports
   */
  private transformCustomReportData(results: any[], config: any, reportName: string): any {
    // Combine summary metrics from all reports
    const summary = results.reduce((acc, result) => {
      return { ...acc, ...(result.summary || {}) };
    }, {});
    
    // Filter summary metrics based on selected metrics in config
    const filteredSummary = Object.entries(summary)
      .filter(([key]) => config.metrics.some((m: string) => key.includes(m)))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    // Create charts based on selected dimensions and metrics
    const charts: Record<string, any> = {};
    
    if (config.metrics.includes('creditCount') && config.dimensions.includes('date')) {
      const creditData = results.find(r => r.charts && r.charts.issuedCredits);
      if (creditData) {
        charts['Credits Over Time'] = {
          type: config.chartType || 'line',
          ...creditData.charts.issuedCredits
        };
      }
    }
    
    if (config.metrics.includes('transactionValue') && config.dimensions.includes('date')) {
      const transactionData = results.find(r => r.charts && r.charts.transactionTrend);
      if (transactionData) {
        charts['Transactions Over Time'] = {
          type: config.chartType || 'bar',
          ...transactionData.charts.transactionTrend
        };
      }
    }
    
    if (config.metrics.includes('redemptionRate') && config.dimensions.includes('creditType')) {
      const redemptionData = results.find(r => r.charts && r.charts.redemptionByType);
      if (redemptionData) {
        charts['Redemption by Credit Type'] = {
          type: config.chartType || 'doughnut',
          ...redemptionData.charts.redemptionByType
        };
      }
    }
    
    // Add tables from the reports
    const tables = results.flatMap(result => result.tables || []);
    
    return {
      title: reportName,
      summary: filteredSummary,
      charts,
      tables
    };
  }

  /**
   * Helper methods for data processing
   */
  private getDateRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    let currentDate = new Date(start);
    
    while (currentDate <= end) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  private processTransactionsByDay(dates: Date[], transactionData: any[]): any[] {
    return dates.map(date => {
      const dateString = date.toISOString().split('T')[0];
      
      // Find transactions for this date
      const transactions = transactionData.filter((t: any) => {
        const tDateString = t.date.toISOString().split('T')[0];
        return tDateString === dateString;
      });
      
      // Sum up by transaction type
      const issueTransactions = transactions.filter((t: any) => t.type === 'ISSUE');
      const redeemTransactions = transactions.filter((t: any) => t.type === 'REDEEM');
      const adjustTransactions = transactions.filter((t: any) => t.type === 'ADJUST');
      
      return {
        date: dateString,
        issueAmount: issueTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0),
        redeemAmount: redeemTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0),
        adjustAmount: adjustTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0),
        totalCount: transactions.reduce((sum: number, t: any) => sum + Number(t.count), 0)
      };
    });
  }

  private processCreditsByDay(dates: Date[], creditData: any[]): any[] {
    return dates.map(date => {
      const dateString = date.toISOString().split('T')[0];
      
      // Find credits for this date
      const credits = creditData.find((c: any) => {
        const cDateString = c.date.toISOString().split('T')[0];
        return cDateString === dateString;
      });
      
      return {
        date: dateString,
        count: credits ? Number(credits.count) : 0,
        amount: credits ? Number(credits.amount) : 0
      };
    });
  }

  private processCustomerActivity(dates: Date[], activityData: any[]): any[] {
    return dates.map(date => {
      const dateString = date.toISOString().split('T')[0];
      
      // Find activity for this date
      const activity = activityData.find((a: any) => {
        const aDateString = a.date.toISOString().split('T')[0];
        return aDateString === dateString;
      });
      
      return {
        date: dateString,
        customerCount: activity ? Number(activity.customerCount) : 0,
        transactionCount: activity ? Number(activity.transactionCount) : 0
      };
    });
  }

  private processStaffPerformance(dates: Date[], performanceData: any[]): any[] {
    return dates.map(date => {
      const dateString = date.toISOString().split('T')[0];
      
      // Find performance data for this date
      const performance = performanceData.find((p: any) => {
        const pDateString = p.date.toISOString().split('T')[0];
        return pDateString === dateString;
      });
      
      return {
        date: dateString,
        staffCount: performance ? Number(performance.staffCount) : 0,
        transactionCount: performance ? Number(performance.transactionCount) : 0,
        issuedAmount: performance ? Number(performance.issuedAmount) : 0,
        redeemedAmount: performance ? Number(performance.redeemedAmount) : 0
      };
    });
  }
} 