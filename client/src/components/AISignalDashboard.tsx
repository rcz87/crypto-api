import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Target,
  Zap,
  Bot,
  Activity,
  BarChart3,
  PieChart,
  Shield,
  Gauge,
  Sparkles,
  Clock,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Cpu,
  Rocket
} from 'lucide-react';
import { useState, useMemo } from 'react';

// Import tooltip component for educational explanations
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle, BookOpen, Lightbulb, Database, GraduationCap } from 'lucide-react';

// AI Signal Types
interface AISignalData {
  signal_id: string;
  timestamp: string;
  signal_type: 'entry' | 'exit' | 'hold' | 'risk_management';
  direction: 'long' | 'short' | 'neutral';
  strength: number;
  confidence: number;
  source_patterns: Array<{
    id: string;
    name: string;
    confidence: number;
    timeframe: string;
    historical_accuracy: number;
    risk_reward_ratio: number;
  }>;
  reasoning: {
    primary_factors: string[];
    supporting_evidence: string[];
    risk_factors: string[];
    market_context: string;
    educational_note?: string;
    data_sources?: string;
    ai_confidence?: string;
    analysis_timestamp?: string;
  };
  execution_details: {
    recommended_size: number;
    stop_loss: number;
    take_profit: number[];
    max_holding_time: string;
    optimal_entry_window: string;
  };
  performance_metrics: {
    expected_return: number;
    max_drawdown: number;
    win_rate: number;
    profit_factor: number;
  };
}

interface StrategyPerformanceData {
  active_strategies: Array<{
    strategy_id: string;
    name: string;
    current_fitness: number;
    recent_performance: {
      return_7d: number;
      return_30d: number;
      win_rate_7d: number;
      max_drawdown_7d: number;
    };
    optimization_status: 'optimizing' | 'stable' | 'underperforming';
    next_evolution: string;
  }>;
  ai_learning_stats: {
    total_patterns_learned: number;
    pattern_accuracy: number;
    adaptation_rate: number;
    current_generation: number;
    elite_strategies: number;
  };
  market_intelligence: {
    current_regime: 'trending' | 'ranging' | 'volatile' | 'calm';
    pattern_confidence: number;
    signal_reliability: number;
    recommended_exposure: number;
  };
}

export function AISignalDashboard() {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');

  // AI Signal Query
  const { data: signalData, isLoading: signalLoading, error: signalError } = useQuery<{
    success: boolean;
    data: AISignalData;
    timestamp: string;
  }>({
    queryKey: ['/api/ai/signal'],
    refetchInterval: 45000, // 45 seconds
  });

  // Strategy Performance Query
  const { data: performanceData, isLoading: performanceLoading } = useQuery<{
    success: boolean;
    data: StrategyPerformanceData;
    timestamp: string;
  }>({
    queryKey: ['/api/ai/strategy-performance'],
    refetchInterval: 120000, // 2 minutes
  });

  // Memoized computations
  const signalStrengthColor = useMemo(() => {
    if (!signalData?.data) return 'text-gray-400';
    
    const strength = signalData.data.strength;
    if (strength >= 80) return 'text-green-400';
    if (strength >= 60) return 'text-yellow-400';
    if (strength >= 40) return 'text-orange-400';
    return 'text-red-400';
  }, [signalData]);

  const directionColor = useMemo(() => {
    if (!signalData?.data) return 'text-gray-400';
    
    switch (signalData.data.direction) {
      case 'long': return 'text-green-400';
      case 'short': return 'text-red-400';
      default: return 'text-gray-400';
    }
  }, [signalData]);

  const confidenceLevel = useMemo(() => {
    if (!signalData?.data) return 'low';
    
    const confidence = signalData.data.confidence;
    if (confidence >= 85) return 'very_high';
    if (confidence >= 70) return 'high';
    if (confidence >= 55) return 'medium';
    return 'low';
  }, [signalData]);

  if (signalLoading && performanceLoading) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Trading Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-700 rounded w-3/4"></div>
            <div className="h-32 bg-gray-700 rounded"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (signalError) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Trading Intelligence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>AI System Unavailable</AlertTitle>
            <AlertDescription>
              Unable to connect to AI signal engine. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const signal = signalData?.data;
  const performance = performanceData?.data;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            AI Trading Intelligence
            <Badge variant="outline" className="border-purple-400 text-purple-400">
              Phase 3
            </Badge>
          </div>
          {signal && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">AI Active</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="signal" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800">
            <TabsTrigger value="signal" className="data-[state=active]:bg-gray-700 text-white">Current Signal</TabsTrigger>
            <TabsTrigger value="strategies" className="data-[state=active]:bg-gray-700 text-white">Strategies</TabsTrigger>
            <TabsTrigger value="learning" className="data-[state=active]:bg-gray-700 text-white">AI Learning</TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-gray-700 text-white">Performance</TabsTrigger>
          </TabsList>

          {/* Current Signal Tab */}
          <TabsContent value="signal" className="space-y-6">
            {signal ? (
              <>
                {/* Signal Overview */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-400">AI Signal</span>
                    </div>
                    <div className={`text-2xl font-bold ${directionColor} mb-1`}>
                      {signal.direction.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {signal.signal_type.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-lg p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-green-400">Strength</span>
                    </div>
                    <div className={`text-2xl font-bold ${signalStrengthColor} mb-1`}>
                      {signal.strength}%
                    </div>
                    <Progress value={signal.strength} className="h-2" />
                  </div>

                  <div className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 rounded-lg p-4 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-orange-400">Confidence</span>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                      {signal.confidence.toFixed(0)}%
                    </div>
                    <Badge variant={
                      confidenceLevel === 'very_high' ? 'default' :
                      confidenceLevel === 'high' ? 'secondary' :
                      confidenceLevel === 'medium' ? 'outline' : 'destructive'
                    }>
                      {confidenceLevel.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>

                {/* Signal Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Reasoning */}
                    <Card className="bg-gray-800/50">
                      <CardHeader>
                        <CardTitle className="text-sm text-gray-400">AI Reasoning</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs text-green-400">Primary Factors</div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="w-3 h-3 text-blue-400 hover:text-blue-300 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-sm bg-gray-800 border-gray-600 text-white p-3">
                                  <div className="font-semibold mb-1">📚 How AI Analyzes Signals</div>
                                  <div className="text-xs space-y-1">
                                    <div>• <strong>Funding Rate Logic:</strong> Positive = Longs overpaying, potential reversal</div>
                                    <div>• <strong>Pattern Recognition:</strong> Neural network detects recurring setups</div>
                                    <div>• <strong>Confidence Scoring:</strong> Based on historical accuracy + current conditions</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="space-y-1">
                            {signal.reasoning.primary_factors.map((factor, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-green-300">
                                <CheckCircle className="w-3 h-3 mt-0.5 text-green-400" />
                                <span>{factor}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs text-blue-400">Supporting Evidence</div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="w-3 h-3 text-blue-400 hover:text-blue-300 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-sm bg-gray-800 border-gray-600 text-white p-3">
                                  <div className="font-semibold mb-1">🔍 Evidence Validation</div>
                                  <div className="text-xs space-y-1">
                                    <div>• <strong>Multiple Confirmations:</strong> AI looks for 2+ confirming signals</div>
                                    <div>• <strong>Historical Context:</strong> Similar patterns in past market conditions</div>
                                    <div>• <strong>Real-time Data:</strong> Current orderbook, volume, and flow analysis</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="space-y-1">
                            {signal.reasoning.supporting_evidence.map((evidence, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-blue-300">
                                <Activity className="w-3 h-3 mt-0.5 text-blue-400" />
                                <span>{evidence}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs text-red-400">Risk Factors</div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <HelpCircle className="w-3 h-3 text-blue-400 hover:text-blue-300 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-sm bg-gray-800 border-gray-600 text-white p-3">
                                  <div className="font-semibold mb-1">⚠️ Risk Management</div>
                                  <div className="text-xs space-y-1">
                                    <div>• <strong>Never Risk 100%:</strong> AI considers worst-case scenarios</div>
                                    <div>• <strong>Market Uncertainty:</strong> External factors can invalidate signals</div>
                                    <div>• <strong>Position Sizing:</strong> Risk management is built into every recommendation</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="space-y-1">
                            {signal.reasoning.risk_factors.map((risk, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-red-300">
                                <AlertTriangle className="w-3 h-3 mt-0.5 text-red-400" />
                                <span>{risk}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Market Context */}
                    <Card className="bg-gray-800/50">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm text-gray-400">Market Context</CardTitle>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <BookOpen className="w-4 h-4 text-purple-400 hover:text-purple-300 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-lg bg-gray-800 border-gray-600 text-white p-4">
                                <div className="font-semibold mb-2">🎓 FUNDING RATE EXPLAINED</div>
                                <div className="text-xs space-y-2">
                                  <div><strong>Positive Funding Rate (e.g. +0.01%):</strong></div>
                                  <div className="ml-2 text-gray-300">• Long positions pay funding fees to shorts</div>
                                  <div className="ml-2 text-gray-300">• Indicates too many long positions (bullish sentiment)</div>
                                  <div className="ml-2 text-gray-300">• Often precedes price corrections as overleveraged longs close</div>
                                  <div className="mt-2"><strong>Negative Funding Rate (e.g. -0.01%):</strong></div>
                                  <div className="ml-2 text-gray-300">• Short positions pay funding fees to longs</div>
                                  <div className="ml-2 text-gray-300">• Indicates too many short positions (bearish sentiment)</div>
                                  <div className="ml-2 text-gray-300">• Often precedes price rallies as shorts cover positions</div>
                                  <div className="mt-2 font-semibold text-yellow-300">🔑 Why AI Uses This:</div>
                                  <div className="ml-2 text-gray-300">Extreme funding = Market imbalance = Reversal opportunity!</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-gray-300 leading-relaxed mb-4">
                          {signal.reasoning.market_context}
                        </div>
                        
                        {/* Enhanced: Show data sources and AI confidence */}
                        {signal.reasoning.data_sources && (
                          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Database className="w-4 h-4 text-blue-400" />
                              <span className="text-xs text-blue-400 font-medium">Data Sources</span>
                            </div>
                            <div className="text-xs text-blue-200">
                              {signal.reasoning.data_sources}
                            </div>
                            {signal.reasoning.ai_confidence && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className={`text-xs ${
                                  signal.reasoning.ai_confidence.includes('High') ? 'text-green-400' :
                                  signal.reasoning.ai_confidence.includes('Medium') ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  AI Confidence: {signal.reasoning.ai_confidence}
                                </div>
                                {signal.reasoning.ai_confidence.includes('GPT-5') && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-xs border-green-400 text-green-400 hover:bg-green-400/10 cursor-help">
                                          🤖 GPT-5 Enhanced
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="bg-gray-800 border-gray-600 text-white p-3">
                                        <div className="text-xs">
                                          <div className="font-semibold mb-1">🚀 Diperkuat oleh GPT-5</div>
                                          <div className="text-gray-300">Analisis lebih dalam & presisi lebih tinggi menggunakan model AI terdepan dari OpenAI</div>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Educational Note */}
                        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <GraduationCap className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-purple-400 font-medium">Educational Note</span>
                          </div>
                          <div className="text-xs text-purple-200 leading-relaxed">
                            {signal.reasoning.educational_note || 
                            'This AI signal is generated using machine learning pattern recognition combined with real-time market data analysis. The confidence score represents how similar current conditions are to historically profitable setups.'}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    {/* Execution Details */}
                    <Card className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border-green-500/20">
                      <CardHeader>
                        <CardTitle className="text-sm text-green-400">Execution Plan</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Position Size</div>
                            <div className="text-lg font-bold text-white">
                              {(signal.execution_details.recommended_size * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-400 mb-1">Stop Loss</div>
                            <div className="text-lg font-bold text-red-400">
                              {(signal.execution_details.stop_loss * 100).toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-gray-400 mb-2">Take Profit Targets</div>
                          <div className="space-y-1">
                            {signal.execution_details.take_profit.map((tp, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-gray-400">TP {idx + 1}:</span>
                                <span className="text-green-400 font-mono">
                                  {(tp * 100).toFixed(2)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-700">
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-gray-400">Max Hold:</span>
                            <span className="text-white">{signal.execution_details.max_holding_time}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-400">Entry Window:</span>
                            <span className="text-yellow-400">{signal.execution_details.optimal_entry_window}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Performance Metrics */}
                    <Card className="bg-gray-800/50">
                      <CardHeader>
                        <CardTitle className="text-sm text-gray-400">Expected Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Expected Return:</span>
                          <span className="text-green-400 font-semibold">
                            {(signal.performance_metrics.expected_return * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Win Rate:</span>
                          <span className="text-blue-400 font-semibold">
                            {(signal.performance_metrics.win_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Profit Factor:</span>
                          <span className="text-purple-400 font-semibold">
                            {signal.performance_metrics.profit_factor.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-400">Max Drawdown:</span>
                          <span className="text-red-400 font-semibold">
                            {(signal.performance_metrics.max_drawdown * 100).toFixed(2)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Source Patterns */}
                {signal.source_patterns.length > 0 && (
                  <Card className="bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-400">Detected Patterns</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {signal.source_patterns.map((pattern, idx) => (
                          <div key={idx} className="bg-gray-700/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-white">{pattern.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {pattern.timeframe}
                              </Badge>
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Confidence:</span>
                                <span className="text-white">{(pattern.confidence * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Accuracy:</span>
                                <span className="text-green-400">{(pattern.historical_accuracy * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-gray-400">Risk/Reward:</span>
                                <span className="text-blue-400">{pattern.risk_reward_ratio.toFixed(1)}:1</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No AI signal available</p>
                <p className="text-sm text-gray-500">Waiting for market conditions to generate signals</p>
              </div>
            )}
          </TabsContent>

          {/* Strategies Tab */}
          <TabsContent value="strategies" className="space-y-4">
            {performance?.active_strategies ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performance.active_strategies.slice(0, 6).map((strategy, idx) => (
                    <Card key={idx} className={`cursor-pointer transition-all ${
                      selectedStrategy === strategy.strategy_id ? 
                      'bg-blue-900/30 border-blue-500/50' : 'bg-gray-800/50 hover:bg-gray-700/50'
                    }`}
                    onClick={() => setSelectedStrategy(strategy.strategy_id)}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-white">{strategy.name}</span>
                          <Badge variant={
                            strategy.optimization_status === 'stable' ? 'default' :
                            strategy.optimization_status === 'optimizing' ? 'secondary' : 'destructive'
                          }>
                            {strategy.optimization_status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">Fitness:</span>
                            <span className="text-white font-mono">
                              {(strategy.current_fitness * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">7d Return:</span>
                            <span className={`font-mono ${
                              strategy.recent_performance.return_7d > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {(strategy.recent_performance.return_7d * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">Win Rate:</span>
                            <span className="text-blue-400 font-mono">
                              {(strategy.recent_performance.win_rate_7d * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-400">Max DD:</span>
                            <span className="text-red-400 font-mono">
                              {(strategy.recent_performance.max_drawdown_7d * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-gray-700">
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            <span>Next evolution: {new Date(strategy.next_evolution).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Cpu className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No active strategies</p>
              </div>
            )}
          </TabsContent>

          {/* AI Learning Tab */}
          <TabsContent value="learning" className="space-y-4">
            {performance && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg p-4 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs text-purple-400">Patterns Learned</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {performance.ai_learning_stats.total_patterns_learned}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-lg p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400">Pattern Accuracy</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {(performance.ai_learning_stats.pattern_accuracy * 100).toFixed(0)}%
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg p-4 border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Rocket className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-blue-400">Generation</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {performance.ai_learning_stats.current_generation}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 rounded-lg p-4 border border-orange-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-orange-400" />
                      <span className="text-xs text-orange-400">Elite Strategies</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {performance.ai_learning_stats.elite_strategies}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-400">Learning Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Adaptation Rate</span>
                          <span className="text-white">
                            {(performance.ai_learning_stats.adaptation_rate * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={performance.ai_learning_stats.adaptation_rate * 100} className="h-2" />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Pattern Confidence</span>
                          <span className="text-white">
                            {(performance.market_intelligence.pattern_confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={performance.market_intelligence.pattern_confidence * 100} className="h-2" />
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Signal Reliability</span>
                          <span className="text-white">
                            {(performance.market_intelligence.signal_reliability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={performance.market_intelligence.signal_reliability * 100} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-400">Market Intelligence</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Market Regime:</span>
                        <Badge variant="outline" className={`${
                          performance.market_intelligence.current_regime === 'trending' ? 'border-green-400 text-green-400' :
                          performance.market_intelligence.current_regime === 'volatile' ? 'border-red-400 text-red-400' :
                          performance.market_intelligence.current_regime === 'ranging' ? 'border-yellow-400 text-yellow-400' :
                          'border-blue-400 text-blue-400'
                        }`}>
                          {performance.market_intelligence.current_regime.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Recommended Exposure:</span>
                        <span className="text-white font-mono">
                          {(performance.market_intelligence.recommended_exposure * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-700">
                        <div className="text-xs text-gray-400 mb-2">AI Evolution Status</div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-400">Continuously Learning</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4">
            {performance && (
              <div className="space-y-6">
                <Alert>
                  <Cpu className="h-4 w-4" />
                  <AlertTitle>AI System Performance</AlertTitle>
                  <AlertDescription>
                    Generation {performance.ai_learning_stats.current_generation} with {performance.ai_learning_stats.elite_strategies} elite strategies achieving {(performance.ai_learning_stats.pattern_accuracy * 100).toFixed(1)}% pattern accuracy.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-400">Top Performers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {performance.active_strategies
                          .sort((a, b) => b.current_fitness - a.current_fitness)
                          .slice(0, 5)
                          .map((strategy, idx) => (
                          <div key={idx} className="flex items-center justify-between">
                            <div>
                              <div className="text-sm text-white">{strategy.name}</div>
                              <div className="text-xs text-gray-400">{strategy.optimization_status}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-green-400">
                                {(strategy.current_fitness * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-400">System Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Active Strategies:</span>
                        <span className="text-white">{performance.active_strategies.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Elite Count:</span>
                        <span className="text-green-400">{performance.ai_learning_stats.elite_strategies}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Learning Rate:</span>
                        <span className="text-blue-400">
                          {(performance.ai_learning_stats.adaptation_rate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Patterns Known:</span>
                        <span className="text-purple-400">{performance.ai_learning_stats.total_patterns_learned}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-sm text-gray-400">Evolution Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <span className="text-gray-400">Gen {performance.ai_learning_stats.current_generation}</span>
                          <span className="text-green-400">Active</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          <span className="text-gray-400">Gen {performance.ai_learning_stats.current_generation - 1}</span>
                          <span className="text-gray-500">Completed</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                          <span className="text-gray-400">Gen {performance.ai_learning_stats.current_generation - 2}</span>
                          <span className="text-gray-500">Completed</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <div className="text-xs text-gray-400">Next Evolution</div>
                        <div className="text-sm text-blue-400">~1 hour</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}