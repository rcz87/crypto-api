import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Import all components
import { StatusOverview } from '@/components/status-overview';
import { APIDocumentation } from '@/components/api-documentation';
import { RealTimeData } from '@/components/real-time-data';
import { SystemLogs } from '@/components/system-logs';
import { ConfigurationPanel } from '@/components/configuration-panel';
import { TradingViewWidget } from '@/components/TradingViewWidget';
import { EnhancedFundingRate } from '@/components/EnhancedFundingRate';
import { AISignalDashboard } from '@/components/AISignalDashboard';
import { EnhancedOpenInterest } from '@/components/EnhancedOpenInterest';
import { EnhancedVolumeProfile } from '@/components/EnhancedVolumeProfile';
import { VolumeDelta } from '@/components/VolumeDelta';
import { SMCAnalysis } from '@/components/SMCAnalysis';
import { CVDAnalysisComponent } from '@/components/CVDAnalysis';
import { ConfluenceScoring } from '@/components/ConfluenceScoring';
import { TechnicalIndicators } from '@/components/TechnicalIndicators';
import { FibonacciAnalysis } from '@/components/FibonacciAnalysis';
import { OrderFlowAnalysis } from '@/components/OrderFlowAnalysis';
import LiquidityHeatmap from '@/components/LiquidityHeatmap';
import MultiTimeframeAnalysis from '@/components/MultiTimeframeAnalysis';
import EnhancedMTFAnalysis from '@/components/EnhancedMTFAnalysis';
import { EnhancedAISection } from '@/components/EnhancedAISection';
import LiveTradingSignals from '@/components/LiveTradingSignals';
import MultiCoinScreening from '@/components/MultiCoinScreening';

interface DashboardContentProps {
  activeSection: string;
  solData: any;
  isDataLoading: boolean;
  healthData: any;
  metricsData: any;
  healthLoading: boolean;
  wsConnected: boolean;
  marketData: any;
}

export const DashboardContent = ({
  activeSection,
  solData,
  isDataLoading,
  healthData,
  metricsData,
  healthLoading,
  wsConnected,
  marketData
}: DashboardContentProps) => {
  
  const renderSection = () => {
    switch (activeSection) {
      // PASAR CATEGORY
      case 'overview':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Status Overview</h2>
            <ErrorBoundary>
              <StatusOverview 
                healthData={healthData?.data} 
                metricsData={metricsData?.data}
                isLoading={healthLoading}
              />
            </ErrorBoundary>
          </div>
        );

      case 'tradingview':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Chart Utama</h2>
            <ErrorBoundary>
              <TradingViewWidget 
                data={solData} 
                isConnected={wsConnected}
              />
            </ErrorBoundary>
            
            {/* System Status Info */}
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800 space-y-1">
                <div>🔍 <span className="font-medium">System Status:</span></div>
                <div>🌐 API Base: {window.location.hostname === 'localhost' ? 'localhost:5000' : 'guardiansofthegreentoken.com'}</div>
                <div>WebSocket: {wsConnected ? '✅ Connected' : '❌ Disconnected'}</div>
                <div>SOL Futures API: {solData?.data ? '✅ Available' : '❌ None'}</div>
                <div>Candles Data: {solData?.candles ? '✅ Available' : '❌ None'}</div>
                {solData?.candles && (
                  <div>📊 Candles: 1H({(solData.candles['1H'] || []).length}) 4H({(solData.candles['4H'] || []).length}) 1D({(solData.candles['1D'] || []).length})</div>
                )}
                <div>⚡ Data Source: {marketData ? 'WebSocket + REST' : 'REST only'}</div>
              </div>
            </div>
          </div>
        );

      case 'realtime':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Data Real-time</h2>
            <ErrorBoundary>
              <RealTimeData 
                solData={solData} 
                isLoading={isDataLoading}
                isLiveStream={wsConnected && !!marketData}
              />
            </ErrorBoundary>
          </div>
        );

      case 'multi-coin':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Multi-Coin Screening</h2>
            <ErrorBoundary>
              <MultiCoinScreening />
            </ErrorBoundary>
          </div>
        );

      // ANALISIS TEKNIS CATEGORY
      case 'technical-indicators':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Indikator Teknis</h2>
            <ErrorBoundary>
              <TechnicalIndicators className="w-full" />
            </ErrorBoundary>
          </div>
        );

      case 'fibonacci':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Fibonacci Analysis</h2>
            <ErrorBoundary>
              <FibonacciAnalysis className="w-full" />
            </ErrorBoundary>
          </div>
        );

      case 'confluence':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">8-Layer Confluence Scoring</h2>
            <ErrorBoundary>
              <ConfluenceScoring timeframe="1H" className="w-full" />
            </ErrorBoundary>
          </div>
        );

      case 'mtf-analysis':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Enhanced Multi-Timeframe Analysis</h2>
            <ErrorBoundary>
              <EnhancedMTFAnalysis />
            </ErrorBoundary>
          </div>
        );

      // MINAT TERBUKA CATEGORY
      case 'open-interest':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Enhanced Open Interest</h2>
            <ErrorBoundary>
              <EnhancedOpenInterest />
            </ErrorBoundary>
          </div>
        );

      // FUNDING CATEGORY
      case 'funding-rate':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Enhanced Funding Rate</h2>
            <ErrorBoundary>
              <EnhancedFundingRate />
            </ErrorBoundary>
          </div>
        );

      // LIKUIDASI CATEGORY
      case 'liquidity-heatmap':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Liquidity Heatmap - VIP8+</h2>
            <ErrorBoundary>
              <LiquidityHeatmap />
            </ErrorBoundary>
          </div>
        );

      case 'order-flow':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Order Flow Analysis</h2>
            <ErrorBoundary>
              <OrderFlowAnalysis className="w-full" />
            </ErrorBoundary>
          </div>
        );

      // VOLUME CATEGORY
      case 'volume-profile':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Enhanced Volume Profile</h2>
            <ErrorBoundary>
              <EnhancedVolumeProfile />
            </ErrorBoundary>
          </div>
        );

      case 'cvd-analysis':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">CVD Analysis - Smart Money Detection</h2>
            <ErrorBoundary>
              <CVDAnalysisComponent className="col-span-1" />
            </ErrorBoundary>
          </div>
        );

      case 'volume-delta':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Volume Delta Analysis</h2>
            <ErrorBoundary>
              <VolumeDelta />
            </ErrorBoundary>
          </div>
        );

      // AI TRADING CATEGORY
      case 'enhanced-ai':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Enhanced AI Engine - Phase 2</h2>
            <ErrorBoundary>
              <EnhancedAISection />
            </ErrorBoundary>
          </div>
        );

      case 'ai-signals':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">AI Signal Dashboard</h2>
            <ErrorBoundary>
              <AISignalDashboard />
            </ErrorBoundary>
          </div>
        );

      case 'live-signals':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Live Trading Signals</h2>
            <ErrorBoundary>
              <LiveTradingSignals className="w-full" />
            </ErrorBoundary>
          </div>
        );

      // SMART MONEY CATEGORY
      case 'smc-analysis':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Smart Money Concepts Analysis</h2>
            <ErrorBoundary>
              <SMCAnalysis />
            </ErrorBoundary>
          </div>
        );

      // DATA CATEGORY
      case 'api-docs':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">API Documentation</h2>
            <ErrorBoundary>
              <APIDocumentation />
            </ErrorBoundary>
          </div>
        );

      case 'system-logs':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">System Logs</h2>
            <ErrorBoundary>
              <SystemLogs />
            </ErrorBoundary>
          </div>
        );

      // KONFIGURASI CATEGORY
      case 'configuration':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Configuration Panel</h2>
            <ErrorBoundary>
              <ConfigurationPanel 
                healthData={healthData?.data}
              />
            </ErrorBoundary>
          </div>
        );

      // DEFAULT: Show overview with TradingView
      default:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
            
            {/* Status Overview */}
            <ErrorBoundary>
              <StatusOverview 
                healthData={healthData?.data} 
                metricsData={metricsData?.data}
                isLoading={healthLoading}
              />
            </ErrorBoundary>

            {/* TradingView Widget - Main Chart */}
            <div className="mt-6">
              <ErrorBoundary>
                <TradingViewWidget 
                  data={solData} 
                  isConnected={wsConnected}
                />
              </ErrorBoundary>
            </div>

            {/* Real-time Data */}
            <div className="mt-6">
              <ErrorBoundary>
                <RealTimeData 
                  solData={solData} 
                  isLoading={isDataLoading}
                  isLiveStream={wsConnected && !!marketData}
                />
              </ErrorBoundary>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {renderSection()}
    </div>
  );
};