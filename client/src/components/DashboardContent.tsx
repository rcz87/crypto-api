import React from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useIsMobile } from '@/hooks/use-mobile';

// Import all components
import { StatusOverview } from '@/components/status-overview';
import { APIDocumentation } from '@/components/api-documentation';
import { RealTimeData } from '@/components/real-time-data';
import { SystemLogs } from '@/components/system-logs';
import { ConfigurationPanel } from '@/components/configuration-panel';
import { TradingViewWidget } from '@/components/TradingViewWidget';
import { TradingChart } from '@/components/TradingChart';
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
  selectedSymbol?: string;
  selectedTvSymbol?: string;
}

export const DashboardContent = ({
  activeSection,
  solData,
  isDataLoading,
  healthData,
  metricsData,
  healthLoading,
  wsConnected,
  marketData,
  selectedSymbol,
  selectedTvSymbol
}: DashboardContentProps) => {
  const isMobile = useIsMobile();
  
  const renderSection = () => {
    switch (activeSection) {
      // PASAR CATEGORY
      case 'overview':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Status Overview</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2' : ''}>
                <StatusOverview 
                  healthData={healthData?.data} 
                  metricsData={metricsData?.data}
                  isLoading={healthLoading}
                />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'tradingview':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Chart Utama</h2>
            <ErrorBoundary>
              <div className={`${isMobile ? 'px-2 -mx-2' : ''}`}>
                <TradingViewWidget 
                  data={solData} 
                  isConnected={wsConnected}
                  tvSymbol={selectedTvSymbol || "BINANCE:SOLUSDT"}
                  displaySymbol={selectedSymbol || "SOL/USDT"}
                />
              </div>
            </ErrorBoundary>
            
            {/* System Status Info */}
            <div className={`mt-4 p-3 md:p-4 bg-blue-50 rounded-lg ${isMobile ? 'mx-2' : ''}`}>
              <div className={`text-xs md:text-sm text-blue-800 space-y-1 ${isMobile ? 'space-y-2' : ''}`}>
                <div>🔍 <span className="font-medium">System Status:</span></div>
                <div className={isMobile ? 'break-all' : ''}>🌐 API Base: {window.location.hostname === 'localhost' ? 'localhost:5000' : 'guardiansofthegreentoken.com'}</div>
                <div>WebSocket: {wsConnected ? '✅ Connected' : '❌ Disconnected'}</div>
                <div>SOL Futures API: {solData?.data ? '✅ Available' : '❌ None'}</div>
                <div>Candles Data: {solData?.candles ? '✅ Available' : '❌ None'}</div>
                {solData?.candles && (
                  <div className={isMobile ? 'text-xs' : ''}>📊 Candles: 1H({(solData.candles['1H'] || []).length}) 4H({(solData.candles['4H'] || []).length}) 1D({(solData.candles['1D'] || []).length})</div>
                )}
                <div>⚡ Data Source: {marketData ? 'WebSocket + REST' : 'REST only'}</div>
              </div>
            </div>
          </div>
        );

      case 'realtime':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Data Real-time</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <RealTimeData 
                  solData={solData} 
                  isLoading={isDataLoading}
                  isLiveStream={wsConnected && !!marketData}
                />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'multi-coin':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Multi-Coin Screening</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <MultiCoinScreening />
              </div>
            </ErrorBoundary>
          </div>
        );

      // ANALISIS TEKNIS CATEGORY
      case 'technical-indicators':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Indikator Teknis</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <TechnicalIndicators className="w-full" />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'fibonacci':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Fibonacci Analysis</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <FibonacciAnalysis className="w-full" />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'confluence':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">8-Layer Confluence Scoring</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <ConfluenceScoring timeframe="1H" className="w-full" />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'mtf-analysis':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Enhanced Multi-Timeframe Analysis</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <EnhancedMTFAnalysis />
              </div>
            </ErrorBoundary>
          </div>
        );

      // MINAT TERBUKA CATEGORY
      case 'open-interest':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Enhanced Open Interest</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <EnhancedOpenInterest />
              </div>
            </ErrorBoundary>
          </div>
        );

      // FUNDING CATEGORY
      case 'funding-rate':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Enhanced Funding Rate</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <EnhancedFundingRate />
              </div>
            </ErrorBoundary>
          </div>
        );

      // LIKUIDASI CATEGORY
      case 'liquidity-heatmap':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Liquidity Heatmap - VIP8+</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <LiquidityHeatmap />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'order-flow':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Order Flow Analysis</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <OrderFlowAnalysis className="w-full" />
              </div>
            </ErrorBoundary>
          </div>
        );

      // VOLUME CATEGORY
      case 'volume-profile':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Enhanced Volume Profile</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <EnhancedVolumeProfile />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'cvd-analysis':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">CVD Analysis - Smart Money Detection</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <CVDAnalysisComponent className="col-span-1" />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'volume-delta':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Volume Delta Analysis</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <VolumeDelta />
              </div>
            </ErrorBoundary>
          </div>
        );

      // AI TRADING CATEGORY
      case 'enhanced-ai':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Enhanced AI Engine - Phase 2</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <EnhancedAISection />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'ai-signals':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">AI Signal Dashboard</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <AISignalDashboard />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'live-signals':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Live Trading Signals</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <LiveTradingSignals className="w-full" />
              </div>
            </ErrorBoundary>
          </div>
        );

      // SMART MONEY CATEGORY
      case 'smc-analysis':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Smart Money Concepts Analysis</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <SMCAnalysis />
              </div>
            </ErrorBoundary>
          </div>
        );

      // DATA CATEGORY
      case 'api-docs':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">API Documentation</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <APIDocumentation />
              </div>
            </ErrorBoundary>
          </div>
        );

      case 'system-logs':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">System Logs</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <SystemLogs />
              </div>
            </ErrorBoundary>
          </div>
        );

      // KONFIGURASI CATEGORY
      case 'configuration':
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Configuration Panel</h2>
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <ConfigurationPanel 
                  healthData={healthData?.data}
                />
              </div>
            </ErrorBoundary>
          </div>
        );

      // DEFAULT: Show overview with TradingView
      default:
        return (
          <div className={`space-y-4 md:space-y-6 ${isMobile ? 'px-2' : ''}`}>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 px-2 md:px-0">Dashboard Overview</h2>
            
            {/* Status Overview */}
            <ErrorBoundary>
              <div className={isMobile ? 'px-2 -mx-2' : ''}>
                <StatusOverview 
                  healthData={healthData?.data} 
                  metricsData={metricsData?.data}
                  isLoading={healthLoading}
                />
              </div>
            </ErrorBoundary>

            {/* Market Data Overview */}
            <div className="mt-4 md:mt-6">
              <ErrorBoundary>
                <div className={`${isMobile ? 'px-2 -mx-2 min-h-[360px]' : ''}`}>
                  <TradingChart 
                    data={solData} 
                    isConnected={wsConnected}
                  />
                </div>
              </ErrorBoundary>
            </div>

            {/* Real-time Data */}
            <div className="mt-4 md:mt-6">
              <ErrorBoundary>
                <div className={isMobile ? 'px-2 -mx-2' : ''}>
                  <RealTimeData 
                    solData={solData} 
                    isLoading={isDataLoading}
                    isLiveStream={wsConnected && !!marketData}
                  />
                </div>
              </ErrorBoundary>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`max-w-7xl mx-auto py-4 md:py-8 ${
      isMobile 
        ? 'px-2 sm:px-4' 
        : 'px-4 sm:px-6 lg:px-8'
    }`}>
      {renderSection()}
    </div>
  );
};