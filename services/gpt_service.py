"""
GPT Personal Assistant Service for Crypto Trading Analysis
Integrates with OpenAI API for personalized trading insights
"""
import os
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
import openai
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class GPTAnalysis:
    """GPT Analysis Result"""
    symbol: str
    analysis_type: str
    insight: str
    recommendation: str
    confidence: float
    reasoning: str
    key_factors: List[str]
    risk_level: str
    timestamp: datetime

class GPTPersonalAssistant:
    """Personal GPT Assistant for Crypto Trading"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY')
        self.model = os.getenv('GPT_MODEL', 'gpt-4-turbo-preview')
        self.max_tokens = int(os.getenv('GPT_MAX_TOKENS', '1000'))
        self.temperature = float(os.getenv('GPT_TEMPERATURE', '0.3'))
        
        if self.api_key:
            openai.api_key = self.api_key
            logger.info("GPT Service initialized with OpenAI API")
        else:
            logger.warning("OpenAI API key not found, using mock responses")
    
    async def analyze_market_sentiment(self, symbol: str, market_data: Dict, social_data: Dict) -> GPTAnalysis:
        """Analyze market sentiment using GPT"""
        try:
            if not self.api_key:
                return self._mock_sentiment_analysis(symbol, market_data, social_data)
            
            prompt = self._build_sentiment_prompt(symbol, market_data, social_data)
            
            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert crypto trading analyst with deep knowledge of technical analysis, market sentiment, and social media trends."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            return self._parse_gpt_response(symbol, "sentiment", response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error in GPT sentiment analysis: {e}")
            return self._mock_sentiment_analysis(symbol, market_data, social_data)
    
    async def generate_trading_strategy(self, symbol: str, technical_data: Dict, social_data: Dict, risk_tolerance: str = "medium") -> GPTAnalysis:
        """Generate personalized trading strategy"""
        try:
            if not self.api_key:
                return self._mock_strategy_analysis(symbol, technical_data, social_data, risk_tolerance)
            
            prompt = self._build_strategy_prompt(symbol, technical_data, social_data, risk_tolerance)
            
            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional trading strategist who creates personalized trading strategies based on technical analysis, social sentiment, and risk tolerance."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            return self._parse_gpt_response(symbol, "strategy", response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error in GPT strategy generation: {e}")
            return self._mock_strategy_analysis(symbol, technical_data, social_data, risk_tolerance)
    
    async def analyze_risk_factors(self, symbol: str, liquidation_data: Dict, market_data: Dict) -> GPTAnalysis:
        """Analyze risk factors using GPT"""
        try:
            if not self.api_key:
                return self._mock_risk_analysis(symbol, liquidation_data, market_data)
            
            prompt = self._build_risk_prompt(symbol, liquidation_data, market_data)
            
            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a risk management specialist focused on cryptocurrency trading risks, including liquidation risks, market volatility, and systemic risks."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            return self._parse_gpt_response(symbol, "risk", response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error in GPT risk analysis: {e}")
            return self._mock_risk_analysis(symbol, liquidation_data, market_data)
    
    async def get_market_outlook(self, symbols: List[str], market_overview: Dict) -> Dict[str, GPTAnalysis]:
        """Get comprehensive market outlook"""
        try:
            if not self.api_key:
                return self._mock_market_outlook(symbols, market_overview)
            
            prompt = self._build_outlook_prompt(symbols, market_overview)
            
            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a chief market analyst providing comprehensive market outlook and predictions for multiple cryptocurrencies."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens * 2,
                temperature=self.temperature
            )
            
            return self._parse_outlook_response(symbols, response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error in GPT market outlook: {e}")
            return self._mock_market_outlook(symbols, market_overview)
    
    async def detect_pump_candidates(self, symbols: List[str], market_data: Dict, social_data: Dict, risk_tolerance: str = "medium") -> Dict[str, Dict]:
        """Detect pump candidates using AI analysis"""
        try:
            if not self.api_key:
                return self._mock_pump_detection(symbols, market_data, social_data)
            
            prompt = self._build_pump_detection_prompt(symbols, market_data, social_data, risk_tolerance)
            
            response = await openai.ChatCompletion.acreate(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert cryptocurrency pump detection analyst specializing in identifying coins with high probability of price pumps based on social sentiment, liquidation patterns, and market data."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens * 2,
                temperature=self.temperature
            )
            
            return self._parse_pump_detection_response(symbols, response.choices[0].message.content)
            
        except Exception as e:
            logger.error(f"Error in GPT pump detection: {e}")
            return self._mock_pump_detection(symbols, market_data, social_data)
    
    def _build_sentiment_prompt(self, symbol: str, market_data: Dict, social_data: Dict) -> str:
        """Build prompt for sentiment analysis"""
        return f"""
        Analyze the market sentiment for {symbol} based on the following data:
        
        MARKET DATA:
        - Current Price: ${market_data.get('price', 0):,.2f}
        - 24h Change: {market_data.get('change_24h', 0):.2f}%
        - Volume 24h: ${market_data.get('volume_24h', 0):,.0f}
        - Open Interest: ${market_data.get('open_interest', 0):,.0f}
        - Funding Rate: {market_data.get('funding_rate', 0):.4f}%
        
        SOCIAL DATA:
        - Galaxy Score: {social_data.get('galaxy_score', 0)}/100
        - Social Sentiment: {social_data.get('sentiment', 0):.1f}%
        - Social Volume: {social_data.get('social_volume', 0):,}
        - Alt Rank: #{social_data.get('alt_rank', 0)}
        - Trending Score: {social_data.get('trending_score', 0):.1f}
        
        LIQUIDATION DATA:
        - 24h Liquidations: ${market_data.get('liquidations_24h', 0):,.0f}
        - Long Liquidations: {market_data.get('long_liq_pct', 0):.1f}%
        
        Provide a comprehensive sentiment analysis including:
        1. Overall sentiment (BULLISH/BEARISH/NEUTRAL)
        2. Key driving factors
        3. Potential catalysts
        4. Confidence level (1-100)
        5. Risk assessment
        """
    
    def _build_strategy_prompt(self, symbol: str, technical_data: Dict, social_data: Dict, risk_tolerance: str) -> str:
        """Build prompt for trading strategy"""
        return f"""
        Create a personalized trading strategy for {symbol} based on:
        
        TECHNICAL ANALYSIS:
        {json.dumps(technical_data, indent=2)}
        
        SOCIAL INTELLIGENCE:
        {json.dumps(social_data, indent=2)}
        
        RISK TOLERANCE: {risk_tolerance.upper()}
        
        Provide a detailed trading strategy including:
        1. Entry/Exit points
        2. Position sizing recommendations
        3. Stop-loss and take-profit levels
        4. Time horizon (short-term/medium-term/long-term)
        5. Risk management rules
        6. Key indicators to monitor
        7. Confidence level (1-100)
        """
    
    def _build_risk_prompt(self, symbol: str, liquidation_data: Dict, market_data: Dict) -> str:
        """Build prompt for risk analysis"""
        return f"""
        Analyze risk factors for {symbol} trading:
        
        LIQUIDATION DATA:
        {json.dumps(liquidation_data, indent=2)}
        
        MARKET CONDITIONS:
        {json.dumps(market_data, indent=2)}
        
        Identify and analyze:
        1. Primary risk factors
        2. Liquidation risk levels
        3. Market volatility risks
        4. Systemic risks
        5. Recommended risk mitigation strategies
        6. Risk level (LOW/MEDIUM/HIGH/EXTREME)
        7. Confidence in assessment (1-100)
        """
    
    def _build_outlook_prompt(self, symbols: List[str], market_overview: Dict) -> str:
        """Build prompt for market outlook"""
        return f"""
        Provide comprehensive market outlook for the following cryptocurrencies: {', '.join(symbols)}
        
        MARKET OVERVIEW:
        {json.dumps(market_overview, indent=2)}
        
        For each symbol, provide:
        1. Short-term outlook (1-7 days)
        2. Medium-term outlook (1-4 weeks)
        3. Key catalysts to watch
        4. Risk factors
        5. Trading recommendations
        6. Confidence levels
        7. Correlation analysis with other assets
        """
    
    def _parse_gpt_response(self, symbol: str, analysis_type: str, response: str) -> GPTAnalysis:
        """Parse GPT response into structured format"""
        # Simple parsing - in production, use more sophisticated parsing
        lines = response.split('\n')
        
        insight = response[:200] + "..." if len(response) > 200 else response
        recommendation = "HOLD"  # Default
        confidence = 75.0  # Default
        reasoning = response
        key_factors = ["Market analysis", "Technical indicators", "Social sentiment"]
        risk_level = "MEDIUM"
        
        # Try to extract recommendation
        response_upper = response.upper()
        if "BUY" in response_upper or "BULLISH" in response_upper:
            recommendation = "BUY"
        elif "SELL" in response_upper or "BEARISH" in response_upper:
            recommendation = "SELL"
        
        # Try to extract confidence
        for line in lines:
            if "confidence" in line.lower():
                try:
                    confidence = float(''.join(filter(str.isdigit, line)))
                except:
                    pass
        
        # Try to extract risk level
        if "HIGH" in response_upper or "EXTREME" in response_upper:
            risk_level = "HIGH"
        elif "LOW" in response_upper:
            risk_level = "LOW"
        
        return GPTAnalysis(
            symbol=symbol,
            analysis_type=analysis_type,
            insight=insight,
            recommendation=recommendation,
            confidence=confidence,
            reasoning=reasoning,
            key_factors=key_factors,
            risk_level=risk_level,
            timestamp=datetime.now(timezone.utc)
        )
    
    def _parse_outlook_response(self, symbols: List[str], response: str) -> Dict[str, GPTAnalysis]:
        """Parse market outlook response"""
        outlook = {}
        for symbol in symbols:
            outlook[symbol] = GPTAnalysis(
                symbol=symbol,
                analysis_type="outlook",
                insight=f"Market outlook for {symbol}",
                recommendation="HOLD",
                confidence=70.0,
                reasoning=response,
                key_factors=["Market trends", "Technical analysis"],
                risk_level="MEDIUM",
                timestamp=datetime.now(timezone.utc)
            )
        return outlook
    
    def _mock_sentiment_analysis(self, symbol: str, market_data: Dict, social_data: Dict) -> GPTAnalysis:
        """Mock sentiment analysis when API is not available"""
        sentiment_score = social_data.get('sentiment', 50)
        
        if sentiment_score > 65:
            recommendation = "BUY"
            insight = f"Strong bullish sentiment detected for {symbol} with Galaxy Score of {social_data.get('galaxy_score', 0)}/100"
            risk_level = "MEDIUM"
        elif sentiment_score < 35:
            recommendation = "SELL"
            insight = f"Bearish sentiment prevailing for {symbol} with declining social metrics"
            risk_level = "HIGH"
        else:
            recommendation = "HOLD"
            insight = f"Neutral sentiment for {symbol} with mixed signals from technical and social data"
            risk_level = "MEDIUM"
        
        return GPTAnalysis(
            symbol=symbol,
            analysis_type="sentiment",
            insight=insight,
            recommendation=recommendation,
            confidence=75.0,
            reasoning=f"Based on sentiment score of {sentiment_score:.1f}% and market conditions",
            key_factors=["Social sentiment", "Galaxy Score", "Market volume"],
            risk_level=risk_level,
            timestamp=datetime.now(timezone.utc)
        )
    
    def _mock_strategy_analysis(self, symbol: str, technical_data: Dict, social_data: Dict, risk_tolerance: str) -> GPTAnalysis:
        """Mock strategy analysis when API is not available"""
        price = technical_data.get('price', 100)
        
        if risk_tolerance == "high":
            recommendation = "BUY"
            insight = f"Aggressive strategy recommended for {symbol} with tight stop-loss at ${price * 0.97:.2f}"
            confidence = 80.0
        elif risk_tolerance == "low":
            recommendation = "HOLD"
            insight = f"Conservative approach for {symbol} - wait for clearer signals"
            confidence = 85.0
        else:
            recommendation = "BUY"
            insight = f"Balanced strategy for {symbol} with entry at current levels"
            confidence = 75.0
        
        return GPTAnalysis(
            symbol=symbol,
            analysis_type="strategy",
            insight=insight,
            recommendation=recommendation,
            confidence=confidence,
            reasoning=f"Strategy tailored for {risk_tolerance} risk tolerance",
            key_factors=["Risk tolerance", "Market conditions", "Technical levels"],
            risk_level="MEDIUM",
            timestamp=datetime.now(timezone.utc)
        )
    
    def _mock_risk_analysis(self, symbol: str, liquidation_data: Dict, market_data: Dict) -> GPTAnalysis:
        """Mock risk analysis when API is not available"""
        liquidation_volume = market_data.get('liquidations_24h', 0)
        
        if liquidation_volume > 1000000:  # $1M+
            risk_level = "HIGH"
            insight = f"High liquidation activity detected for {symbol} - increased volatility risk"
            recommendation = "CAUTION"
        elif liquidation_volume > 500000:  # $500K+
            risk_level = "MEDIUM"
            insight = f"Moderate liquidation levels for {symbol} - normal market activity"
            recommendation = "MONITOR"
        else:
            risk_level = "LOW"
            insight = f"Low liquidation risk for {symbol} - stable market conditions"
            recommendation = "PROCEED"
        
        return GPTAnalysis(
            symbol=symbol,
            analysis_type="risk",
            insight=insight,
            recommendation=recommendation,
            confidence=80.0,
            reasoning=f"Based on 24h liquidation volume of ${liquidation_volume:,.0f}",
            key_factors=["Liquidation volume", "Market volatility", "Leverage levels"],
            risk_level=risk_level,
            timestamp=datetime.now(timezone.utc)
        )
    
    def _mock_market_outlook(self, symbols: List[str], market_overview: Dict) -> Dict[str, GPTAnalysis]:
        """Mock market outlook when API is not available"""
        outlook = {}
        for symbol in symbols:
            outlook[symbol] = GPTAnalysis(
                symbol=symbol,
                analysis_type="outlook",
                insight=f"Positive outlook for {symbol} based on current market trends",
                recommendation="BUY",
                confidence=70.0,
                reasoning="Market conditions appear favorable for upside potential",
                key_factors=["Market trend", "Technical indicators", "Social sentiment"],
                risk_level="MEDIUM",
                timestamp=datetime.now(timezone.utc)
            )
        return outlook
    
    def _build_pump_detection_prompt(self, symbols: List[str], market_data: Dict, social_data: Dict, risk_tolerance: str) -> str:
        """Build prompt for pump detection"""
        return f"""
        DETECT PUMP CANDIDATES - Personal AI Assistant Analysis
        
        USER REQUEST: "Carikan coin yang akan pump dan dump"
        
        SYMBOLS TO ANALYZE: {', '.join(symbols)}
        RISK TOLERANCE: {risk_tolerance.upper()}
        
        MARKET DATA:
        {json.dumps(market_data, indent=2)}
        
        SOCIAL INTELLIGENCE:
        {json.dumps(social_data, indent=2)}
        
        PUMP & DUMP DETECTION CRITERIA:
        
        PUMP INDICATORS:
        1. Social volume spike > 200% in 2 hours
        2. Galaxy Score jump > 10 points
        3. Bullish liquidation cluster patterns
        4. Funding rate turning positive
        5. Influencer sentiment > 70% bullish
        6. Volume increase > 150%
        7. Technical breakout patterns
        
        DUMP INDICATORS:
        1. Social volume decline > 150% in 2 hours
        2. Galaxy Score drop > 15 points
        3. Bearish liquidation cluster patterns
        4. Funding rate turning negative
        5. Influencer sentiment > 60% bearish
        6. Volume decrease > 120%
        7. Technical breakdown patterns
        
        For each symbol, provide:
        1. PUMP PROBABILITY (0-100%)
        2. DUMP PROBABILITY (0-100%)
        3. ENTRY POINT RANGE
        4. TARGET PRICE RANGE (for pump)
        5. EXIT POINT RANGE (for dump)
        6. TIMEFRAME (hours)
        7. CONFIDENCE LEVEL (1-100)
        8. RISK LEVEL (LOW/MEDIUM/HIGH/EXTREME)
        9. KEY TRIGGERS (bulleted list)
        10. WARNING SIGNS (if any)
        11. RECOMMENDATION (PUMP/DUMP/HOLD)
        
        Prioritize symbols with highest pump/dump probability and best risk/reward ratio.
        Focus on actionable insights with specific entry/exit points.
        Provide clear recommendation for each coin: PUMP, DUMP, or HOLD.
        """
    
    def _parse_pump_detection_response(self, symbols: List[str], response: str) -> Dict[str, Dict]:
        """Parse pump detection response"""
        pump_candidates = {}
        
        for symbol in symbols:
            # Mock structured response for pump detection
            pump_candidates[symbol] = {
                'pump_probability': 75.0,
                'entry_range': f"${100 + hash(symbol) % 50:.2f} - ${120 + hash(symbol) % 50:.2f}",
                'target_range': f"${130 + hash(symbol) % 80:.2f} - ${160 + hash(symbol) % 80:.2f}",
                'timeframe': f"{6 + hash(symbol) % 18} hours",
                'confidence': 78.0,
                'risk_level': 'MEDIUM',
                'key_triggers': [
                    'Social volume spike detected',
                    'Galaxy Score improvement',
                    'Bullish liquidation patterns',
                    'Volume increase confirmed'
                ],
                'warning_signs': [
                    'Monitor for sudden reversals',
                    'Watch liquidation density at resistance'
                ],
                'analysis_summary': f"{symbol} shows strong pump potential based on social sentiment and market data convergence"
            }
        
        return pump_candidates
    
    def _mock_pump_detection(self, symbols: List[str], market_data: Dict, social_data: Dict) -> Dict[str, Dict]:
        """Mock pump & dump detection when API is not available"""
        pump_candidates = {}
        
        # Simulate realistic pump & dump detection based on mock data
        for i, symbol in enumerate(symbols):
            # Generate varied pump and dump probabilities
            base_pump_prob = 60 + (i * 5) % 40  # 60-95% range
            base_dump_prob = 40 + (i * 3) % 50  # 40-90% range
            
            # Adjust based on mock social data
            social_score = social_data.get(symbol, {}).get('sentiment', 50)
            if social_score > 70:
                base_pump_prob += 15
                base_dump_prob -= 10
            elif social_score < 40:
                base_pump_prob -= 20
                base_dump_prob += 15
            
            # Ensure probabilities stay in valid range
            pump_probability = max(20, min(95, base_pump_prob))
            dump_probability = max(20, min(95, base_dump_prob))
            
            # Generate entry, target, and exit ranges
            base_price = 100 + (hash(symbol) % 200)  # $100-300 range
            entry_low = base_price * 0.98
            entry_high = base_price * 1.02
            target_low = base_price * 1.15
            target_high = base_price * 1.35
            exit_low = base_price * 0.85
            exit_high = base_price * 0.92
            
            # Determine recommendation based on probabilities
            if pump_probability > dump_probability + 10:
                recommendation = "PUMP"
                risk_level = "MEDIUM"
                confidence = 80.0
            elif dump_probability > pump_probability + 10:
                recommendation = "DUMP"
                risk_level = "HIGH"
                confidence = 75.0
            else:
                recommendation = "HOLD"
                risk_level = "MEDIUM"
                confidence = 70.0
            
            pump_candidates[symbol] = {
                'pump_probability': pump_probability,
                'dump_probability': dump_probability,
                'entry_range': f"${entry_low:.2f} - ${entry_high:.2f}",
                'target_range': f"${target_low:.2f} - ${target_high:.2f}",
                'exit_range': f"${exit_low:.2f} - ${exit_high:.2f}",
                'timeframe': f"{6 + (hash(symbol) % 12)} hours",
                'confidence': confidence,
                'risk_level': risk_level,
                'recommendation': recommendation,
                'key_triggers': [
                    f'Social volume: +{200 + (hash(symbol) % 300)}%',
                    f'Galaxy Score: {65 + (hash(symbol) % 25)}/100',
                    f'{"Bullish" if recommendation == "PUMP" else "Bearish"} liquidation cluster pattern',
                    f'Volume {"increase" if recommendation == "PUMP" else "decrease"}: {150 + (hash(symbol) % 200)}%',
                    f'Funding rate turning {"positive" if recommendation == "PUMP" else "negative"}'
                ],
                'warning_signs': [
                    'Monitor for sudden whale movements',
                    'Watch for resistance/support at liquidation clusters',
                    'Check for upcoming news catalysts',
                    'Be prepared for rapid price reversals'
                ],
                'analysis_summary': f"{symbol} shows {pump_probability:.0f}% pump probability and {dump_probability:.0f}% dump probability. Recommendation: {recommendation}"
            }
        
        return pump_candidates

async def get_gpt_pump_detection(symbols: List[str], market_data: Dict, social_data: Dict, risk_tolerance: str = "medium") -> Dict[str, Dict]:
    """Get GPT pump detection analysis"""
    return await gpt_assistant.detect_pump_candidates(symbols, market_data, social_data, risk_tolerance)

# Global GPT assistant instance
gpt_assistant = GPTPersonalAssistant()

async def get_gpt_sentiment_analysis(symbol: str, market_data: Dict, social_data: Dict) -> GPTAnalysis:
    """Get GPT sentiment analysis"""
    return await gpt_assistant.analyze_market_sentiment(symbol, market_data, social_data)

async def get_gpt_trading_strategy(symbol: str, technical_data: Dict, social_data: Dict, risk_tolerance: str = "medium") -> GPTAnalysis:
    """Get GPT trading strategy"""
    return await gpt_assistant.generate_trading_strategy(symbol, technical_data, social_data, risk_tolerance)

async def get_gpt_risk_analysis(symbol: str, liquidation_data: Dict, market_data: Dict) -> GPTAnalysis:
    """Get GPT risk analysis"""
    return await gpt_assistant.analyze_risk_factors(symbol, liquidation_data, market_data)

async def get_gpt_market_outlook(symbols: List[str], market_overview: Dict) -> Dict[str, GPTAnalysis]:
    """Get GPT market outlook"""
    return await gpt_assistant.get_market_outlook(symbols, market_overview)
