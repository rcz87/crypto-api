# Overview

This is a crypto data gateway application that provides real-time SOL (Solana) trading data through a REST API. The application aggregates cryptocurrency data from OKX exchange and serves it through a clean web dashboard. It's built as a full-stack TypeScript application with a React frontend and Express.js backend, designed to run on Replit hosting.

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

## Key Features
- Real-time SOL price data, 24h change, volume, and market cap
- Order book data with bid/ask spreads
- System health monitoring and metrics tracking
- API documentation with interactive examples
- Rate limiting and CORS for production use
- Responsive dashboard design for desktop and mobile
- System logs and performance monitoring

## Performance Considerations
- React Query caching with configurable refresh intervals
- Efficient API response caching
- Lightweight bundle size with tree shaking
- PostgreSQL connection pooling through Neon
- Memory-efficient in-memory storage fallback