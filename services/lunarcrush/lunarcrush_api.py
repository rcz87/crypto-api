#!/usr/bin/env python3
"""
LunarCrush API Server
Flask API service for social sentiment analysis
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import sys
import logging
from datetime import datetime

# Add parent directory to path for imports
sys.path.append('/root/crypto-api')

from services.lunarcrush.lunarcrush_service import (
    get_social_sentiment,
    get_trending_coins,
    compare_coins,
    get_market_overview,
    health_check
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
PORT = int(os.getenv('LUNARCRUSH_PORT', 8001))
HOST = os.getenv('LUNARCRUSH_HOST', '0.0.0.0')

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    try:
        service_health = health_check()
        return jsonify({
            'status': 'healthy',
            'service': 'lunarcrush-api',
            'timestamp': datetime.now().isoformat(),
            'service_health': service_health
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/sentiment/<symbol>', methods=['GET'])
def get_sentiment(symbol):
    """Get social sentiment for a specific cryptocurrency"""
    try:
        sentiment_data = get_social_sentiment(symbol)
        
        return jsonify({
            'success': True,
            'data': {
                'symbol': sentiment_data.symbol,
                'galaxy_score': sentiment_data.galaxy_score,
                'sentiment': sentiment_data.sentiment,
                'social_volume': sentiment_data.social_volume,
                'alt_rank': sentiment_data.alt_rank,
                'trending_score': sentiment_data.trending_score,
                'price_change_24h': sentiment_data.price_change_24h,
                'reddit_posts': sentiment_data.reddit_posts,
                'twitter_mentions': sentiment_data.twitter_mentions,
                'influencers': sentiment_data.influencers,
                'recommendation': sentiment_data.recommendation,
                'confidence': sentiment_data.confidence,
                'timestamp': sentiment_data.timestamp
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting sentiment for {symbol}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/trending', methods=['GET'])
def get_trending():
    """Get trending cryptocurrencies"""
    try:
        limit = request.args.get('limit', 20, type=int)
        limit = min(max(limit, 1), 50)  # Limit between 1-50
        
        trending_data = get_trending_coins(limit)
        
        return jsonify({
            'success': True,
            'data': [
                {
                    'symbol': coin.symbol,
                    'galaxy_score': coin.galaxy_score,
                    'sentiment': coin.sentiment,
                    'social_volume': coin.social_volume,
                    'alt_rank': coin.alt_rank,
                    'trending_score': coin.trending_score,
                    'recommendation': coin.recommendation,
                    'confidence': coin.confidence,
                    'timestamp': coin.timestamp
                }
                for coin in trending_data
            ],
            'count': len(trending_data),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting trending coins: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/compare', methods=['POST'])
def compare():
    """Compare multiple cryptocurrencies"""
    try:
        data = request.get_json()
        if not data or 'symbols' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing symbols in request body',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        symbols = data['symbols']
        if not isinstance(symbols, list) or len(symbols) == 0:
            return jsonify({
                'success': False,
                'error': 'Symbols must be a non-empty array',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        if len(symbols) > 10:
            return jsonify({
                'success': False,
                'error': 'Maximum 10 symbols can be compared at once',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        comparison_data = compare_coins(symbols)
        
        return jsonify({
            'success': True,
            'data': {
                symbol: {
                    'galaxy_score': coin.galaxy_score,
                    'sentiment': coin.sentiment,
                    'social_volume': coin.social_volume,
                    'alt_rank': coin.alt_rank,
                    'trending_score': coin.trending_score,
                    'recommendation': coin.recommendation,
                    'confidence': coin.confidence,
                    'timestamp': coin.timestamp
                }
                for symbol, coin in comparison_data.items()
            },
            'symbols_compared': list(comparison_data.keys()),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error comparing coins: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/market-overview', methods=['GET'])
def market_overview():
    """Get overall market social sentiment"""
    try:
        overview_data = get_market_overview()
        
        return jsonify({
            'success': True,
            'data': overview_data,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting market overview: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/influencers/<symbol>', methods=['GET'])
def get_influencers(symbol):
    """Get influencer data for a specific cryptocurrency"""
    try:
        sentiment_data = get_social_sentiment(symbol)
        
        return jsonify({
            'success': True,
            'data': {
                'symbol': sentiment_data.symbol,
                'influencers': sentiment_data.influencers,
                'total_influencers': len(sentiment_data.influencers),
                'timestamp': sentiment_data.timestamp
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting influencers for {symbol}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'available_endpoints': [
            'GET /health',
            'GET /sentiment/<symbol>',
            'GET /trending?limit=N',
            'POST /compare',
            'GET /market-overview',
            'GET /influencers/<symbol>'
        ],
        'timestamp': datetime.now().isoformat()
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error',
        'timestamp': datetime.now().isoformat()
    }), 500

if __name__ == '__main__':
    logger.info(f"Starting LunarCrush API Server on {HOST}:{PORT}")
    logger.info(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    
    # Check if API key is configured
    api_key = os.getenv('LUNARCRUSH_API_KEY')
    if api_key:
        logger.info("LunarCrush API key configured - PRODUCTION mode")
    else:
        logger.warning("LunarCrush API key not configured - MOCK mode")
    
    app.run(host=HOST, port=PORT, debug=False)
