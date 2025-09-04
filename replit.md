# Overview

This project provides an institutional-grade SOL-USDT-SWAP perpetual futures trading data gateway. It features an 8-layer SharpSignalEngine for advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, and GPT integration capabilities. The system is designed for institutional trading standards, boasting sub-200ms response times and aiming for high data accuracy and intelligence equivalent to professional trading systems.

The gateway offers 16 operational API endpoints covering core trading data (e.g., complete market analysis, order flow, CVD, smart money concepts, technical indicators, funding rates, open interest) and system management (health, metrics, logs, OpenAPI specifications). A key feature is the integration of a professional UI with TradingView and Binance-style market depth charts.

# User Preferences

Preferred communication style: Simple, everyday language.
Primary language: Indonesian (Bahasa Indonesia)
Technical approach: Advanced institutional features over simple implementations
System preference: Real-time data accuracy with professional trading standards

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite.
- **UI Library**: shadcn/ui components built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **State Management**: TanStack Query (React Query) for server state.
- **Routing**: Wouter for lightweight client-side routing.
- **Design System**: Modern dashboard interface with real-time data visualization.
- **Visuals**: Professional dark theme, SVG-based smooth curves for market depth, TradingView widget integration for advanced charts.

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful architecture with structured JSON responses.
- **Middleware**: Custom rate limiting (100 requests/minute per IP), CORS, request logging.
- **Error Handling**: Centralized error handling with proper HTTP status codes.
- **Development**: Hot reload with Vite integration.

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe operations.
- **Provider**: Neon Database (serverless PostgreSQL).
- **Schema**: System metrics, logs, and structured crypto data models.
- **Migrations**: Drizzle Kit for schema management.
- **Fallback**: In-memory storage for development/testing.

## Authentication and Authorization
- **Current**: No authentication implemented.
- **Rate Limiting**: IP-based rate limiting.
- **CORS**: Open CORS policy allowing all origins for public API access.

## Core Feature Specifications
- **SharpSignalEngine**: 8-layer detection algorithms for institutional trading standards, including 5-factor whale scoring, advanced CVD analysis, and multi-timeframe smart money detection.
- **Premium Orderbook System**: VIP tier-based orderbook analysis with up to 1000-level depth support, institutional-grade analytics, and market maker detection.
- **Real-Time Data**: WebSocket streaming for OKX data (Level 2 tick-by-tick orderbook, 6 channels, premium data feeds, 7-timeframe candlestick data).
- **VIP Tier Management**: 4-tier subscription system (Standard, VIP1, VIP8, Institutional) with progressive feature unlocking.
- **Market Depth Chart**: Binance-style professional market depth chart with SVG rendering, linear gradient fills, and interactive hover points.
- **Order Flow**: Real-time trades table with buy/sell indicators, whale trade alerts, and buffer management.
- **Premium Analytics**: Enhanced metrics including liquidity prediction, institutional signals, market maker flow detection.

# External Dependencies

- **Crypto Data**: OKX exchange API integration for real-time SOL trading data with Level 2 premium feeds.
- **Premium Data Access**: OKX VIP tier integration with institutional-grade orderbook depth and sub-10ms latency support.
- **Database**: Neon Database for production PostgreSQL hosting.
- **Hosting**: Replit with custom domain (guardiansofthegreentoken.com).
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **TradingView**: Embedded widget for professional charting.

# Premium Orderbook Features

## VIP Tier System
- **Standard**: 50-level depth, 200ms updates, basic analytics
- **VIP1**: 200-level depth, 50ms updates, enhanced analytics ($200-500/month)
- **VIP8**: 500-level depth, 10ms updates, market maker info ($800-2000/month)
- **Institutional**: 1000-level depth, 5ms updates, custom analysis (custom pricing)

## Available Endpoints
- `/api/sol/premium-orderbook` - Premium orderbook metrics with tier-based analytics
- `/api/premium/tier-status` - VIP tier management and upgrade information
- Enhanced SharpSignalEngine integration with premium data depth
- Real-time WebSocket streaming with tick-by-tick Level 2 orderbook updates