# Overview

This project delivers an institutional-grade perpetual futures trading data gateway, specifically for SOL-USDT-SWAP, featuring an 8-layer SharpSignalEngine. It aims to provide advanced derivatives trading intelligence, including real-time whale detection, smart money analysis, and GPT integration. The system prioritizes institutional trading standards, ensuring sub-200ms response times and high data accuracy, comparable to professional trading systems. Key capabilities include 16 API endpoints for comprehensive market analysis, order flow, smart money concepts, and real-time data, complemented by a professional UI with TradingView and Binance-style market depth charts. The business vision is to provide unparalleled trading intelligence and become a leading data provider for institutional and high-tier retail traders.

# User Preferences

Preferred communication style: Simple, everyday language.
Primary language: Indonesian (Bahasa Indonesia)
Technical approach: Advanced institutional features over simple implementations
System preference: Real-time data accuracy with professional trading standards

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite.
- **UI Library**: shadcn/ui built on Radix UI primitives.
- **Styling**: Tailwind CSS with CSS variables.
- **State Management**: TanStack Query (React Query).
- **Routing**: Wouter for lightweight client-side routing.
- **Design System**: Modern dashboard interface with real-time data visualization, professional dark theme, SVG-based smooth curves for market depth, and TradingView widget integration.

## Backend Architecture
- **Runtime**: Node.js with Express.js.
- **Language**: TypeScript with ES modules.
- **API Design**: RESTful architecture with structured JSON responses.
- **Middleware**: Custom rate limiting (100 requests/minute per IP), CORS, request logging.
- **Error Handling**: Centralized error handling with proper HTTP status codes.

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM.
- **Provider**: Neon Database (serverless PostgreSQL).
- **Schema**: System metrics, logs, and structured crypto data models.
- **Migrations**: Drizzle Kit.
- **Fallback**: In-memory storage for development/testing.

## Authentication and Authorization
- **Current**: No authentication implemented, open CORS policy.
- **Rate Limiting**: IP-based rate limiting.

## Core Feature Specifications
- **SharpSignalEngine**: 8-layer detection algorithms for institutional trading, including 5-factor whale scoring, advanced CVD analysis, and multi-timeframe smart money detection.
- **Premium Orderbook System**: VIP tier-based analysis with up to 1000-level depth, institutional-grade analytics, and market maker detection.
- **Real-Time Data**: WebSocket streaming for OKX data (Level 2 tick-by-tick orderbook, 6 channels, premium feeds, 7-timeframe candlestick data).
- **VIP Tier Management**: 4-tier subscription system (Standard, VIP1, VIP8, Institutional) with progressive feature unlocking.
- **Market Depth Chart**: Binance-style professional chart with SVG rendering and interactive hover points.
- **Order Flow**: Real-time trades table with buy/sell indicators and whale trade alerts.
- **Premium Analytics**: Enhanced metrics including liquidity prediction, institutional signals, and market maker flow detection.

# External Dependencies

- **Crypto Data**: OKX exchange API for real-time SOL trading data and premium feeds.
- **Database**: Neon Database for PostgreSQL hosting.
- **Hosting**: Replit with custom domain.
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **TradingView**: Embedded widget for professional charting.