import { Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HealthCheckData } from "@shared/schema";

interface ConfigurationPanelProps {
  healthData?: HealthCheckData;
}

export function ConfigurationPanel({ healthData }: ConfigurationPanelProps) {
  const formatUptime = (uptimeString?: string) => {
    if (!uptimeString) return "Unknown";
    const seconds = parseFloat(uptimeString.replace('s', ''));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const configItems = [
    {
      label: "OKX API Status",
      status: healthData?.services?.okx === 'connected' ? 'Connected' : 'Disconnected',
      isOnline: healthData?.services?.okx === 'connected',
      description: "API keys are securely stored in environment variables",
    },
    {
      label: "Rate Limiting",
      status: "100 req/min",
      isOnline: true,
      description: "per IP address",
    },
    {
      label: "CORS Settings",
      status: "Enabled",
      isOnline: true,
      description: "Allow all origins",
    },
    {
      label: "Uptime",
      status: `24/7 Always On (${formatUptime(healthData?.metrics?.uptime)})`,
      isOnline: true,
      description: "Replit hosting",
    },
  ];

  return (
    <Card className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
          <Settings className="text-primary mr-2" />
          Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {configItems.map((item, index) => (
            <div key={index} data-testid={`config-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {item.label}
              </label>
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  item.isOnline ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="text-sm text-gray-900" data-testid={`config-status-${index}`}>
                  {item.status}
                </span>
                {item.description && (
                  <span className="text-xs text-gray-500">
                    ({item.description})
                  </span>
                )}
              </div>
              {item.label === "Rate Limiting" && (
                <p className="text-xs text-gray-500 mt-1">
                  Configurable via environment variables
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
