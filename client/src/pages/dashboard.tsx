import { useQuery } from "@tanstack/react-query";
import { Database, AlertCircle } from "lucide-react";
import { StatusOverview } from "@/components/status-overview";
import { APIDocumentation } from "@/components/api-documentation";
import { RealTimeData } from "@/components/real-time-data";
import { SystemLogs } from "@/components/system-logs";
import { ConfigurationPanel } from "@/components/configuration-panel";

export default function Dashboard() {
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["/health"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: metricsData } = useQuery({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000,
  });

  const { data: solData, isLoading: solLoading } = useQuery({
    queryKey: ["/api/sol/complete"],
    refetchInterval: 10000, // Refresh every 10 seconds for real-time data
  });

  const isOnline = healthData?.data?.status === 'operational';

  return (
    <div className="font-inter bg-gray-50 text-gray-900 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Database className="text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Crypto Data Gateway</h1>
                <p className="text-sm text-gray-500">SOL Trading API Aggregator</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                isOnline ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className={`text-sm font-medium ${
                  isOnline ? 'text-green-700' : 'text-red-700'
                }`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <span className="text-sm text-gray-500">crypto-data-gateway.replit.app</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Overview */}
        <StatusOverview 
          healthData={healthData?.data} 
          metricsData={metricsData?.data}
          isLoading={healthLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* API Documentation */}
          <APIDocumentation />

          {/* Real-time Data */}
          <RealTimeData 
            solData={solData?.data} 
            isLoading={solLoading}
          />
        </div>

        {/* System Logs */}
        <SystemLogs />

        {/* Configuration Panel */}
        <ConfigurationPanel 
          healthData={healthData?.data}
        />
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <p className="text-sm text-gray-500">© 2024 Crypto Data Gateway</p>
              <span className="text-gray-300">|</span>
              <a 
                href="https://crypto-data-gateway.replit.app" 
                className="text-sm text-primary hover:text-blue-700"
                data-testid="link-domain"
              >
                crypto-data-gateway.replit.app
              </a>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Database className="w-4 h-4" />
              <span>Powered by Replit</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
