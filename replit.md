# Overview

This is a crypto data gateway application that provides real-time SOL (Solana) trading data through a REST API. The application aggregates cryptocurrency data from OKX exchange and serves it through a clean web dashboard. It's built as a full-stack TypeScript application with a React frontend and Express.js backend, designed to run on Replit hosting and accessible via custom domain guardiansofthegreentoken.com.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Design System**: Modern dashboard interface with real-time data visualization

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful architecture with structured JSON responses
- **Middleware**: Custom rate limiting (100 requests/minute per IP), CORS support, request logging
- **Error Handling**: Centralized error handling with proper HTTP status codes
- **Development**: Hot reload with Vite integration for full-stack development

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Provider**: Neon Database (serverless PostgreSQL)
- **Schema**: System metrics tracking, system logs, and structured crypto data models
- **Migrations**: Drizzle Kit for database schema management
- **Fallback**: In-memory storage implementation for development/testing

## Authentication and Authorization
- **Current**: No authentication implemented
- **Rate Limiting**: IP-based rate limiting to prevent abuse
- **CORS**: Open CORS policy allowing all origins for public API access

## External Dependencies
- **Crypto Data**: OKX exchange API integration for real-time SOL trading data
- **Database**: Neon Database for production PostgreSQL hosting
- **Hosting**: Replit with environment variable configuration
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono)
- **Icons**: Lucide React for consistent iconography

# Recent Changes (August 2025)

## Latest Updates - Order Flow & Real-Time Trading Module (August 26, 2025)
- **Order Flow Component**: Professional real-time trades tracking with WebSocket integration
- **Trade Detection**: Live buy/sell indicators with whale trade alerts ($10,000+ USDT threshold)
- **Performance Optimization**: Cleaned debug logs, optimized WebSocket data processing
- **Production Ready**: All real-time components stable for deployment

### Order Flow Features
- **Real-time trades table**: Time, Price, Size, Value columns with professional formatting
- **Buy/Sell indicators**: Green ↑ arrows for buy orders, red ↓ arrows for sell orders  
- **Whale trade alerts**: Yellow highlighting for large transactions with warning icons
- **Buffer management**: Auto-maintains 60 most recent trades with efficient memory usage
- **WebSocket integration**: Listens to OKX trades channel for live trading activity
- **Visual status**: Real-time indicator showing trade count and connection status

## Previous Updates - Binance-Style Market Depth Chart (August 26, 2025)
- **Professional Market Depth Chart**: Upgraded to Binance-style professional trading interface
- **SVG-Based Smooth Curves**: Replaced bar charts with smooth SVG curves for cumulative volume visualization
- **Professional Dark Theme**: Black/gray gradient backgrounds with professional color schemes
- **Interactive Features**: Hover tooltips, gradient area fills, and smooth transitions
- **Separated Layout**: Independent card sections for Order Book and Market Depth Chart
- **Real-time Professional UI**: Professional headers, metrics display, and trading analysis dashboard

### Market Depth Chart Features
- **Smooth SVG Rendering**: Professional curved lines instead of choppy bars
- **Linear Gradient Fills**: Green/red gradients for bid/ask areas with opacity effects
- **Interactive Hover Points**: Exact price and volume tooltips on hover
- **Professional Grid System**: Trading chart grid lines and center price indicator
- **Market Analysis Dashboard**: Buy pressure, liquidity depth, and sell pressure metrics
- **Responsive Design**: Scales perfectly across all screen sizes
- **Real-time Updates**: 3-second WebSocket throttling with smooth CSS transitions

## Previous Updates - TradingView Integration & OKX Optimizations
- **Professional Chart**: Successfully integrated TradingView free embedded widget
- **Chart Implementation**: `client/src/components/TradingViewWidget.tsx`
- **Data Source**: SOL/USDT pair from OKX exchange via TradingView
- **Theme**: Dark theme for professional trading appearance
- **Features**: Advanced candlestick charts, volume analysis, technical indicators
- **UI Cleanup**: Removed flickering debug panel by eliminating real-time data display
- **Performance**: No custom chart rendering needed, leverages TradingView's optimized system

### Performance Optimizations
- **Order Book Depth**: Upgraded WebSocket from books5 to books (10 levels) for consistency
- **Historical Data**: Increased candlestick limits (1H: 50, 4H: 50, 1D: 60 bars)
- **WebSocket Priority**: Frontend now prioritizes WebSocket ticker over REST API
- **Data Accuracy**: Fixed market cap calculation to clarify it's trading volume

## Production Deployment Status
- **Custom Domain**: Successfully deployed at `https://guardiansofthegreentoken.com`
- **SSL Certificate**: Auto-generated and active
- **DNS Configuration**: Fully propagated via Hostinger DNS management
- **API Endpoint for GPT 5**: `https://guardiansofthegreentoken.com/api/sol/complete`
- **Performance**: 195ms response time, production-ready
- **WebSocket Real-time**: Active at `wss://guardiansofthegreentoken.com/ws`

## Key Features
- **Professional TradingView Chart**: Dark theme candlestick chart with full trading tools
- **Binance-Style Market Depth Chart**: Professional SVG curves with interactive tooltips and real-time analysis
- Real-time SOL price data, 24h change, volume, and market cap
- Order book data with bid/ask spreads and precision controls (0.01, 0.1, 1.0)
- WebSocket streaming with auto-reconnection and fallback mechanisms
- System health monitoring and metrics tracking
- API documentation with interactive examples
- Rate limiting and CORS for production use
- Responsive dashboard design for desktop and mobile
- System logs and performance monitoring
- Custom domain integration for professional API access
- **Professional Trading Interface**: Horizontal order book layout with market analysis dashboard

## Chart Implementation Details
- **Widget Type**: TradingView Advanced Chart (free version)
- **Symbol**: OKX:SOLUSDT
- **Interval**: 1H (1-hour candlesticks)
- **Theme**: Dark theme for professional appearance
- **Features**: Volume display, date ranges, interactive tools
- **Integration**: React component with cleanup on unmount
- **Styling**: Tailwind CSS with dark theme integration

## Performance Considerations
- React Query caching with configurable refresh intervals
- Efficient API response caching
- Lightweight bundle size with tree shaking
- PostgreSQL connection pooling through Neon
- Memory-efficient in-memory storage fallback
- **TradingView Optimization**: External widget handles all chart rendering and optimization