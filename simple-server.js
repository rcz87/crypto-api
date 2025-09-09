import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'SOL Trading Platform',
    environment: 'production'
  });
});

// Basic API endpoints for testing
app.get('/api/sol/ticker', (req, res) => {
  res.json({
    success: true,
    data: {
      symbol: 'SOL-USDT-SWAP',
      price: 142.50,
      change: '+2.34%',
      volume: '1,234,567',
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/sol/complete', (req, res) => {
  res.json({
    success: true,
    data: {
      ticker: {
        symbol: 'SOL-USDT-SWAP',
        price: 142.50,
        change: '+2.34%'
      },
      analysis: {
        sharpSignal: 8,
        whaleActivity: 'High',
        riskLevel: 'Medium'
      },
      timestamp: new Date().toISOString()
    }
  });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist/public')));

// Catch all handler for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const port = parseInt(process.env.PORT || '8080', 10);

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SOL Trading Platform running on port ${port}`);
  console.log(`📈 Health: http://localhost:${port}/health`);
  console.log(`💰 API: http://localhost:${port}/api/sol/complete`);
});