import { Ligature, RefreshCw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SystemLogs as SystemLogsType } from "@shared/schema";

export function SystemLogs() {
  const queryClient = useQueryClient();
  
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ["/api/logs"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const logs = logsData?.data || [];

  const refreshLogs = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      case 'error':
        return XCircle;
      default:
        return CheckCircle;
    }
  };

  const getLogStyles = (level: string) => {
    switch (level) {
      case 'info':
        return { bg: 'bg-green-100', text: 'text-green-600' };
      case 'warning':
        return { bg: 'bg-yellow-100', text: 'text-yellow-600' };
      case 'error':
        return { bg: 'bg-red-100', text: 'text-red-600' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-600' };
    }
  };

  const formatTimestamp = (timestamp: string | Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
            <Ligature className="text-primary mr-2" />
            System Logs
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshLogs}
            disabled={isLoading}
            className="text-primary hover:text-blue-700 text-sm font-medium"
            data-testid="button-refresh-logs"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Ligature className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p data-testid="text-no-logs">No logs available</p>
            </div>
          ) : (
            logs.map((log: SystemLogsType, index: number) => {
              const LogIcon = getLogIcon(log.level);
              const styles = getLogStyles(log.level);
              
              return (
                <div 
                  key={log.id || index} 
                  className="flex items-start space-x-3 py-2 border-b border-gray-100 last:border-b-0"
                  data-testid={`log-entry-${index}`}
                >
                  <div className={`${styles.bg} p-1 rounded`}>
                    <LogIcon className={`${styles.text} text-xs w-3 h-3`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-900 font-medium" data-testid={`log-message-${index}`}>
                        {log.message}
                      </p>
                      <span className="text-xs text-gray-500" data-testid={`log-timestamp-${index}`}>
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-gray-500 mt-1" data-testid={`log-details-${index}`}>
                        {log.details}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
