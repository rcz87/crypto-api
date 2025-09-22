const winston = require('winston');
const config = require('../config');

// Custom format untuk log yang lebih readable
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Logger configuration
const logger = winston.createLogger({
  level: config.monitoring.logLevel,
  format: customFormat,
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    
    // File output untuk semua logs
    new winston.transports.File({
      filename: 'logs/bot.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // File khusus untuk error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760,
      maxFiles: 3
    }),
    
    // File khusus untuk trading logs
    new winston.transports.File({
      filename: 'logs/trades.log',
      level: 'info',
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

// Helper functions untuk different log types
const logTrade = (action, tokenAddress, amount, price, profit = null) => {
  const logData = {
    action,
    tokenAddress,
    amount,
    price,
    profit,
    timestamp: new Date().toISOString()
  };
  
  logger.info(`TRADE ${action.toUpperCase()}: ${tokenAddress} | Amount: ${amount} SOL | Price: $${price}${profit ? ` | Profit: ${profit}%` : ''}`, logData);
};

const logError = (error, context = '') => {
  logger.error(`${context ? `[${context}] ` : ''}${error.message}`, { 
    error: error.stack,
    context 
  });
};

const logPerformance = (operation, duration, success = true) => {
  const level = success ? 'info' : 'warn';
  logger[level](`PERFORMANCE: ${operation} took ${duration}ms | Success: ${success}`);
};

const logTokenAnalysis = (tokenAddress, score, analysis) => {
  logger.info(`TOKEN ANALYSIS: ${tokenAddress} | Score: ${score}/10`, {
    tokenAddress,
    score,
    analysis
  });
};

const logWhaleActivity = (walletAddress, action, tokenAddress, amount) => {
  logger.info(`WHALE ACTIVITY: ${walletAddress} ${action} ${amount} of ${tokenAddress}`);
};

module.exports = {
  logger,
  logTrade,
  logError,
  logPerformance,
  logTokenAnalysis,
  logWhaleActivity
};
