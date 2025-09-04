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
- **Real-Time Data**: WebSocket streaming for OKX data (50-level order book depth, 6 channels, tick-by-tick updates, 7-timeframe candlestick data).
- **Market Depth Chart**: Binance-style professional market depth chart with SVG rendering, linear gradient fills, and interactive hover points.
- **Order Flow**: Real-time trades table with buy/sell indicators, whale trade alerts, and buffer management.

# External Dependencies

- **Crypto Data**: OKX exchange API integration for real-time SOL trading data.
- **Database**: Neon Database for production PostgreSQL hosting.
- **Hosting**: Replit.
- **Fonts**: Google Fonts (Inter, DM Sans, Fira Code, Geist Mono).
- **Icons**: Lucide React.
- **TradingView**: Embedded widget for professional charting.