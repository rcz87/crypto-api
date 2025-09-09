# Multi-Coin Screening Module

Module terpisah untuk fitur Multi-Coin Screening agar mudah dikembangkan tanpa mengganggu sistem utama.

## Struktur Folder

```
screening-module/
├── backend/                 # Backend logic dan API
│   ├── screener/           # File backend yang sudah ada
│   │   ├── screener.controller.ts
│   │   ├── screener.service.ts  
│   │   ├── screener.routes.ts
│   │   ├── scoring.ts
│   │   ├── indicators.ts
│   │   └── smc.ts
├── frontend/               # Komponen React
│   └── MultiCoinScreening.tsx
├── shared/                 # Schema dan types
│   └── schemas.ts
└── README.md              # Dokumentasi module
```

## Fitur Utama

### Backend
- **8-layer Analysis**: SMC, Price Action, EMA, RSI/MACD, Funding, OI, CVD, Fibonacci
- **Real-time Processing**: Response time ~220ms untuk 5 symbols
- **Confidence Scoring**: Minimum 10% confidence, never null values
- **API Contract**: Standard `{ success, data, meta }` format

### Frontend
- **Professional UI**: Menggunakan shadcn/ui components
- **Auto Refresh**: Toggle dengan interval custom
- **Preset Symbols**: Top coins, DeFi, Layer1 categories
- **Results Table**: Sorting, filtering, confidence indicators
- **Stats Display**: Processing time, signal distribution

### Schemas
- **ScreeningParams**: Symbol list, timeframe, enabled layers
- **ScreeningResult**: Score, label, layers breakdown, confidence
- **ScreeningResponse**: Complete API response format
- **Database Tables**: screener_runs, screener_results

## Integrasi ke Sistem Utama

Setelah development selesai:

1. Copy files kembali ke lokasi asli
2. Import schemas ke shared/schema.ts
3. Register routes di server/routes.ts
4. Import component ke dashboard

## Status

✅ Backend logic complete  
✅ Frontend component ready  
✅ API endpoints working  
✅ Database integration  
✅ Confidence calculation fixed  

**Ready for production integration**