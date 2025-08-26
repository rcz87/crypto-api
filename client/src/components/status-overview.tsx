import { CheckCircle, Clock, TrendingUp, Plug, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthCheckData, SystemMetrics } from "@shared/schema";

interface StatusOverviewProps {
  healthData?: HealthCheckData | any;
  metricsData?: SystemMetrics | any;
  isLoading: boolean;
}

export function StatusOverview({ healthData, metricsData, isLoading }: StatusOverviewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-white rounded-lg shadow-sm border border-gray-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statusItems = [
    {
      title: "API Status",
      value: healthData?.status === 'operational' ? 'Operational' : 'Degraded',
      icon: healthData?.status === 'operational' ? CheckCircle : AlertCircle,
      bgColor: healthData?.status === 'operational' ? 'bg-green-100' : 'bg-red-100',
      textColor: healthData?.status === 'operational' ? 'text-green-600' : 'text-red-600',
      valueColor: healthData?.status === 'operational' ? 'text-green-600' : 'text-red-600',
    },
    {
      title: "Response Time",
      value: `${healthData?.metrics?.responseTime || metricsData?.responseTime || 0}ms`,
      icon: Clock,
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
      valueColor: 'text-gray-900',
    },
    {
      title: "Requests Today",
      value: (healthData?.metrics?.requestsToday || metricsData?.requestsToday || 0).toLocaleString(),
      icon: TrendingUp,
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-600',
      valueColor: 'text-gray-900',
    },
    {
      title: "OKX API Status",
      value: healthData?.services?.okx === 'connected' ? 'Connected' : 'Disconnected',
      icon: Plug,
      bgColor: healthData?.services?.okx === 'connected' ? 'bg-green-100' : 'bg-red-100',
      textColor: healthData?.services?.okx === 'connected' ? 'text-green-600' : 'text-red-600',
      valueColor: healthData?.services?.okx === 'connected' ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statusItems.map((item, index) => (
        <Card key={index} className="bg-white rounded-lg shadow-sm border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{item.title}</p>
                <p className={`text-2xl font-semibold ${item.valueColor}`} data-testid={`status-${item.title.toLowerCase().replace(' ', '-')}`}>
                  {item.value}
                </p>
              </div>
              <div className={`${item.bgColor} p-3 rounded-lg`}>
                <item.icon className={`${item.textColor} text-xl`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
