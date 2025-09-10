import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, TrendingUp, Activity, Zap, Target, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface EnhancedAISignal {
  signal_id: string;
  timestamp: string;
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  strength: number;
  confidence: number;
  neural_prediction: {
    direction: 'long' | 'short' | 'neutral';
    confidence: number;
    risk_level: 'low' | 'medium' | 'high';
    supporting_patterns: string[];
  };
  detected_patterns: Array<{
    id: string;
    name: string;
    confidence: number;
    neural_score: number;
    pattern_complexity: 'simple' | 'moderate' | 'complex' | 'advanced';
    learning_weight: number;
  }>;
  reasoning: {
    primary_factors: string[];
    supporting_evidence: string[];
    risk_factors: string[];
    market_context: string;
    neural_analysis: string;
    pattern_confluence: number;
  };
  execution_details: {
    recommended_size: number;
    stop_loss: number;
    take_profit: number[];
    risk_reward_ratio: number;
  };
  performance_metrics: {
    expected_return: number;
    win_rate: number;
    sharpe_ratio: number;
  };
  learning_metadata: {
    pattern_novelty: number;
    learning_opportunity: boolean;
  };
}

interface EnhancedPerformance {
  enhanced_patterns: Array<{
    pattern_id: string;
    name: string;
    confidence: number;
    neural_score: number;
    learning_weight: number;
    complexity: string;
    success_rate: number;
    last_seen: string;
  }>;
  neural_network_stats: {
    model_active: boolean;
    feature_vector_size: number;
    training_samples: number;
    prediction_accuracy: number;
  };
  learning_stats: {
    total_patterns: number;
    active_patterns: number;
    pattern_memory_size: number;
    adaptation_rate: number;
    learning_samples: number;
  };
}

export function EnhancedAISection() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSignal, setLastSignal] = useState<EnhancedAISignal | null>(null);

  // Query enhanced AI performance
  const { data: performanceData, isLoading: performanceLoading } = useQuery({
    queryKey: ['/api/ai/enhanced-performance'],
    refetchInterval: 30000, // Every 30 seconds
  });

  const performance = (performanceData as any)?.data as EnhancedPerformance;

  // Generate enhanced AI signal
  const generateEnhancedSignal = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/enhanced-signal');
      const result = await response.json();
      if (result.success) {
        setLastSignal(result.data);
      }
    } catch (error) {
      console.error('Error generating enhanced AI signal:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'long': return 'text-green-400';
      case 'short': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'long': return '↗️';
      case 'short': return '↘️';
      default: return '➡️';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-blue-500';
      case 'moderate': return 'bg-indigo-500';
      case 'complex': return 'bg-purple-500';
      case 'advanced': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="bg-gray-900/50 border-gray-700">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              Enhanced AI Signal Engine
              <Badge variant="outline" className="text-purple-400 border-purple-400">
                Neural Network
              </Badge>
            </CardTitle>
            <CardDescription className="text-gray-400">
              Advanced pattern recognition dengan TensorFlow.js dan adaptive learning
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Tabs defaultValue="signal" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="signal" className="data-[state=active]:bg-purple-600">
              AI Signal
            </TabsTrigger>
            <TabsTrigger value="patterns" className="data-[state=active]:bg-purple-600">
              Patterns
            </TabsTrigger>
            <TabsTrigger value="performance" className="data-[state=active]:bg-purple-600">
              Neural Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signal" className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={generateEnhancedSignal}
                disabled={isGenerating}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-generate-enhanced-signal"
              >
                {isGenerating ? (
                  <>
                    <Activity className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Generate Enhanced AI Signal
                  </>
                )}
              </Button>
            </div>

            {lastSignal && (
              <div className="space-y-4">
                {/* Main Signal Display */}
                <Card className="bg-gray-800/50 border-gray-600">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getDirectionIcon(lastSignal.direction)}</span>
                          <span className={`text-xl font-bold ${getDirectionColor(lastSignal.direction)}`}>
                            {lastSignal.direction.toUpperCase()}
                          </span>
                          <Badge variant="outline" className="text-gray-300">
                            SOL-USDT-SWAP
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-400">
                          Signal ID: {lastSignal.signal_id}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{lastSignal.confidence}%</div>
                        <div className="text-sm text-gray-400">Confidence</div>
                      </div>
                    </div>

                    {/* Neural Prediction */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Neural Direction</div>
                        <div className={`font-semibold ${getDirectionColor(lastSignal.neural_prediction.direction)}`}>
                          {lastSignal.neural_prediction.direction.toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Neural Confidence</div>
                        <div className="font-semibold text-white">
                          {lastSignal.neural_prediction.confidence}%
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                        <Badge className={`${getRiskColor(lastSignal.neural_prediction.risk_level)} text-white`}>
                          {lastSignal.neural_prediction.risk_level.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Pattern Confluence</div>
                        <div className="font-semibold text-white">
                          {(lastSignal.reasoning.pattern_confluence * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Execution Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Position Size</div>
                        <div className="font-semibold text-white">
                          {(lastSignal.execution_details.recommended_size * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Stop Loss</div>
                        <div className="font-semibold text-red-400">
                          {(lastSignal.execution_details.stop_loss * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Expected Return</div>
                        <div className="font-semibold text-green-400">
                          {(lastSignal.performance_metrics.expected_return * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-xs text-gray-400 mb-1">Win Rate</div>
                        <div className="font-semibold text-white">
                          {(lastSignal.performance_metrics.win_rate * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Neural Analysis */}
                <Card className="bg-gray-800/50 border-gray-600">
                  <CardContent className="p-4">
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-400" />
                      Neural Network Analysis
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {lastSignal.reasoning.neural_analysis}
                    </p>
                  </CardContent>
                </Card>

                {/* Detected Patterns */}
                {lastSignal.detected_patterns.length > 0 && (
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-400" />
                        Detected Patterns ({lastSignal.detected_patterns.length})
                      </h4>
                      <div className="space-y-3">
                        {lastSignal.detected_patterns.map((pattern, index) => (
                          <div key={index} className="bg-gray-700/50 p-3 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-semibold text-white">{pattern.name}</div>
                                <div className="text-xs text-gray-400">ID: {pattern.id}</div>
                              </div>
                              <div className="flex gap-2">
                                <Badge className={`${getComplexityColor(pattern.pattern_complexity)} text-white text-xs`}>
                                  {pattern.pattern_complexity}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <div className="text-gray-400">Confidence</div>
                                <div className="text-white font-semibold">
                                  {(pattern.confidence * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-400">Neural Score</div>
                                <div className="text-purple-400 font-semibold">
                                  {(pattern.neural_score * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-gray-400">Learning Weight</div>
                                <div className="text-blue-400 font-semibold">
                                  {pattern.learning_weight.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Primary Factors & Risk Factors */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        Primary Factors
                      </h4>
                      <ul className="space-y-2">
                        {lastSignal.reasoning.primary_factors.map((factor, index) => (
                          <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-green-400 mt-1">•</span>
                            {factor}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        Risk Factors
                      </h4>
                      <ul className="space-y-2">
                        {lastSignal.reasoning.risk_factors.map((risk, index) => (
                          <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                            <span className="text-red-400 mt-1">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            {performance && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-white">{performance.learning_stats.total_patterns}</div>
                      <div className="text-sm text-gray-400">Total Patterns</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-400">{performance.learning_stats.active_patterns}</div>
                      <div className="text-sm text-gray-400">Active Patterns</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-400">{performance.learning_stats.pattern_memory_size}</div>
                      <div className="text-sm text-gray-400">Pattern Memory</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-purple-400">
                        {(performance.learning_stats.adaptation_rate * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-400">Adaptation Rate</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h4 className="text-white font-semibold">Enhanced Patterns</h4>
                  {performance.enhanced_patterns.slice(0, 8).map((pattern, index) => (
                    <Card key={index} className="bg-gray-800/50 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-semibold text-white">{pattern.name}</div>
                            <div className="text-xs text-gray-400">ID: {pattern.pattern_id}</div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={`${getComplexityColor(pattern.complexity)} text-white text-xs`}>
                              {pattern.complexity}
                            </Badge>
                            {pattern.success_rate > 70 && (
                              <Badge className="bg-green-500 text-white text-xs">
                                High Success
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="text-gray-400">Confidence</div>
                            <Progress value={pattern.confidence} className="h-2 mt-1" />
                            <div className="text-white font-semibold mt-1">{pattern.confidence}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Neural Score</div>
                            <Progress value={pattern.neural_score} className="h-2 mt-1" />
                            <div className="text-purple-400 font-semibold mt-1">{pattern.neural_score}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Success Rate</div>
                            <Progress value={pattern.success_rate} className="h-2 mt-1" />
                            <div className="text-green-400 font-semibold mt-1">{pattern.success_rate}%</div>
                          </div>
                          <div>
                            <div className="text-gray-400">Learning Weight</div>
                            <div className="text-blue-400 font-semibold">{pattern.learning_weight.toFixed(2)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {performance && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${performance.neural_network_stats.model_active ? 'bg-green-400' : 'bg-red-400'}`}></div>
                        <div className="text-sm text-gray-400">Neural Network</div>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {performance.neural_network_stats.model_active ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-white">{performance.neural_network_stats.feature_vector_size}</div>
                      <div className="text-sm text-gray-400">Feature Vector Size</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-400">{performance.neural_network_stats.training_samples}</div>
                      <div className="text-sm text-gray-400">Training Samples</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-800/50 border-gray-600">
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-400">
                        {(performance.neural_network_stats.prediction_accuracy * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-400">Prediction Accuracy</div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-800/50 border-gray-600">
                  <CardContent className="p-4">
                    <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-400" />
                      Neural Network Architecture
                    </h4>
                    <div className="space-y-3">
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-sm text-gray-400">Input Layer</div>
                        <div className="text-white font-semibold">{performance.neural_network_stats.feature_vector_size} features</div>
                        <div className="text-xs text-gray-500">Multi-timeframe, Technical, CVD, Confluence, Funding data</div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-sm text-gray-400">Hidden Layers</div>
                        <div className="text-white font-semibold">5 layers with dropout regularization</div>
                        <div className="text-xs text-gray-500">128 → 96 → 64 → 32 → 16 neurons</div>
                      </div>
                      <div className="bg-gray-700/50 p-3 rounded-lg">
                        <div className="text-sm text-gray-400">Output Layer</div>
                        <div className="text-white font-semibold">3 predictions</div>
                        <div className="text-xs text-gray-500">Direction probability, Confidence, Risk level</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800/50 border-gray-600">
                  <CardContent className="p-4">
                    <h4 className="text-white font-semibold mb-4">Learning Statistics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Learning Samples</div>
                        <Progress value={(performance.learning_stats.learning_samples / 1000) * 100} className="h-3" />
                        <div className="text-white font-semibold mt-1">{performance.learning_stats.learning_samples} / 1000</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400 mb-2">Pattern Memory Usage</div>
                        <Progress value={(performance.learning_stats.pattern_memory_size / 1000) * 100} className="h-3" />
                        <div className="text-white font-semibold mt-1">{performance.learning_stats.pattern_memory_size} / 1000</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}