import { useQuery } from "@tanstack/react-query";
import { Database, AlertCircle, Radio } from "lucide-react";
import { StatusOverview } from "@/components/status-overview";
import { APIDocumentation } from "@/components/api-documentation";
import { RealTimeData } from "@/components/real-time-data";
import { SystemLogs } from "@/components/system-logs";
import { ConfigurationPanel } from "@/components/configuration-panel";
import { SimpleTradingChart } from "@/components/SimpleTradingChart";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function Dashboard() {
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["/health"],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: metricsData } = useQuery({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000,
  });

  // Keep REST API as fallback, but reduce frequency since WebSocket provides real-time data
  const { data: solData, isLoading: solLoading } = useQuery({
    queryKey: ["/api/sol/complete"],
    refetchInterval: 60000, // Reduce to 1 minute as WebSocket provides real-time updates
  });

  // WebSocket connection for real-time data
  const { 
    isConnected: wsConnected, 
    marketData, 
    systemStatus: wsSystemStatus,
    connectionStatus
  } = useWebSocket();

  const isOnline = healthData?.data?.status === 'operational';
  
  // Use WebSocket data if available, otherwise fall back to REST API data  
  const displaySolData = marketData?.data || solData?.data;
  const isDataLoading = solLoading && !marketData;

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
              
              {/* WebSocket Status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
                wsConnected ? 'bg-blue-50' : 'bg-gray-50'
              }`}>
                <Radio className={`w-3 h-3 ${
                  wsConnected ? 'text-blue-500 animate-pulse' : 'text-gray-400'
                }`} />
                <span className={`text-sm font-medium ${
                  wsConnected ? 'text-blue-700' : 'text-gray-500'
                }`}>
                  {wsConnected ? 'Live Stream' : connectionStatus}
                </span>
              </div>
              
              <span className="text-sm text-gray-500">guardiansofthegreentoken.com</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Overview */}
        <StatusOverview 
          healthData={healthData?.data || {}} 
          metricsData={metricsData?.data || {}}
          isLoading={healthLoading}
        />

        {/* Professional Trading Chart */}
        <div className="mt-8">
          <SimpleTradingChart 
            data={displaySolData} 
            isConnected={wsConnected}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* API Documentation */}
          <APIDocumentation />

          {/* Real-time Data */}
          <RealTimeData 
            solData={displaySolData} 
            isLoading={isDataLoading}
            isLiveStream={wsConnected && !!marketData}
          />
        </div>

        {/* System Logs */}
        <SystemLogs />

        {/* Configuration Panel */}
        <ConfigurationPanel 
          healthData={healthData?.data || {}}
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
                href="https://guardiansofthegreentoken.com" 
                className="text-sm text-primary hover:text-blue-700"
                data-testid="link-domain"
              >
                guardiansofthegreentoken.com
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
