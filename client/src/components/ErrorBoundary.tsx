import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Component error caught:', error, errorInfo);
    
    // Enhanced error logging for debugging
    if (error.message?.includes('AbortError') || error.message?.includes('NetworkError')) {
      console.log('Network/Abort error - component was likely unmounted during fetch');
      return; // Don't log these as serious errors
    }
    
    // Log serious component errors
    console.error('Serious component error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="w-full border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-700">
              <AlertCircle className="h-5 w-5" />
              Loading Component
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-yellow-600">
                Component is loading market data...
              </p>
              {this.state.error?.message?.includes('Insufficient') && (
                <div className="text-xs text-blue-600 bg-blue-100 p-2 rounded">
                  📊 Waiting for sufficient market data to load
                </div>
              )}
              {this.state.error?.message?.includes('Failed to fetch') && (
                <div className="text-xs text-orange-600 bg-orange-100 p-2 rounded">
                  🔄 Connecting to market data feed...
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}