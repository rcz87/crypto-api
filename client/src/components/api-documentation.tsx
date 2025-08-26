import { Book, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export function APIDocumentation() {
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-white rounded-lg shadow-sm border border-gray-200">
      <CardHeader className="px-6 py-4 border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
          <Book className="text-primary mr-2" />
          API Documentation
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Main Endpoint */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                  GET
                </span>
                <code className="text-sm font-mono text-gray-900" data-testid="endpoint-sol-complete">
                  /api/sol/complete
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard('/api/sol/complete', 'Endpoint')}
                className="text-primary hover:text-blue-700 text-sm font-medium"
                data-testid="button-copy-endpoint"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Aggregates all SOL trading data from OKX including ticker, candles, order book, and recent trades.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Example Response:</p>
              <pre className="text-xs text-gray-600 overflow-x-auto" data-testid="example-response">
{`{
  "success": true,
  "data": {
    "ticker": {
      "symbol": "SOL-USDT",
      "price": "67.42",
      "change24h": "2.5%"
    },
    "candles": {
      "1H": [...],
      "4H": [...],
      "1D": [...]
    },
    "orderBook": {...},
    "recentTrades": [...]
  },
  "timestamp": "2024-08-26T..."
}`}
              </pre>
            </div>
          </div>

          {/* Health Check Endpoint */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                  GET
                </span>
                <code className="text-sm font-mono text-gray-900" data-testid="endpoint-health">
                  /health
                </code>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard('/health', 'Health endpoint')}
                className="text-primary hover:text-blue-700 text-sm font-medium"
                data-testid="button-copy-health"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Health check endpoint for monitoring service status.
            </p>
          </div>
        </div>

        {/* Rate Limiting Info */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <AlertTriangle className="text-yellow-600 mr-2 w-4 h-4" />
            <h3 className="text-sm font-semibold text-yellow-800">Rate Limiting</h3>
          </div>
          <p className="text-sm text-yellow-700" data-testid="text-rate-limit">
            API requests are limited to prevent abuse. Current limit: 100 requests per minute per IP.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );
}
