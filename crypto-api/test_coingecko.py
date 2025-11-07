#!/usr/bin/env python3
"""
Test CoinGecko API functionality
"""

from services.dynamic_coin_discovery import search_coin
import logging

logging.basicConfig(level=logging.INFO)

def test_coingecko():
    print("=== Testing CoinGecko API ===")
    
    # Test dengan Bitcoin
    print("\n1. Testing Bitcoin search:")
    results = search_coin('bitcoin', ['coingecko'])
    
    for i, coin in enumerate(results[:3], 1):
        print(f"   {i}. {coin.symbol} - {coin.name}")
        print(f"      Source: {coin.source}")
        print(f"      Price: ${coin.price}" if coin.price else "      Price: N/A")
        print(f"      24h Change: {coin.change_24h}%" if coin.change_24h else "      24h Change: N/A")
        print()
    
    # Test dengan Ethereum
    print("2. Testing Ethereum search:")
    results = search_coin('ethereum', ['coingecko'])
    
    for i, coin in enumerate(results[:2], 1):
        print(f"   {i}. {coin.symbol} - {coin.name}")
        print(f"      Source: {coin.source}")
        print(f"      Price: ${coin.price}" if coin.price else "      Price: N/A")
        print(f"      24h Change: {coin.change_24h}%" if coin.change_24h else "      24h Change: N/A")
        print()
    
    # Test multi-source
    print("3. Testing multi-source search (BTC):")
    results = search_coin('BTC', ['coingecko', 'binance'])
    
    print(f"   Found {len(results)} results:")
    for i, coin in enumerate(results[:3], 1):
        print(f"   {i}. {coin.symbol} - {coin.name}")
        print(f"      Source: {coin.source}")
        print(f"      Price: ${coin.price}" if coin.price else "      Price: N/A")
        print(f"      Exchanges: {', '.join(coin.exchanges)}")
        print()

if __name__ == "__main__":
    test_coingecko()
