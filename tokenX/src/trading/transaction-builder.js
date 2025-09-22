const { 
  Transaction, 
  SystemProgram, 
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');
const axios = require('axios');
const { logger, logError, logPerformance } = require('../utils/logger');
const config = require('../config');

class TransactionBuilder {
  constructor(solanaConnection) {
    this.connection = solanaConnection.getConnection();
    this.wallet = solanaConnection.getWallet();
    this.preSignedTransactions = new Map();
  }

  async buildBuyTransaction(tokenMint, amountSol, slippagePercent = null) {
    try {
      const startTime = Date.now();
      const slippage = slippagePercent || config.trading.maxSlippagePercent;
      
      logger.info(`🔨 Building BUY transaction: ${tokenMint} | Amount: ${amountSol} SOL | Slippage: ${slippage}%`);
      
      // Get Jupiter quote untuk best route
      const quote = await this.getJupiterQuote(
        'So11111111111111111111111111111111111111112', // SOL mint
        tokenMint,
        amountSol * 1e9, // Convert to lamports
        slippage
      );
      
      if (!quote) {
        throw new Error('Failed to get Jupiter quote');
      }
      
      // Build transaction via Jupiter
      const transaction = await this.buildJupiterTransaction(quote);
      
      // Add priority fee dan compute budget
      await this.addPriorityFeeInstructions(transaction);
      
      const buildTime = Date.now() - startTime;
      logPerformance('Build BUY transaction', buildTime);
      
      return {
        transaction,
        quote,
        expectedOutput: quote.outAmount,
        route: quote.routePlan
      };
      
    } catch (error) {
      logError(error, 'TransactionBuilder.buildBuyTransaction');
      throw error;
    }
  }

  async buildSellTransaction(tokenMint, tokenAmount, slippagePercent = null) {
    try {
      const startTime = Date.now();
      const slippage = slippagePercent || config.trading.maxSlippagePercent;
      
      logger.info(`🔨 Building SELL transaction: ${tokenMint} | Amount: ${tokenAmount} tokens | Slippage: ${slippage}%`);
      
      // Get Jupiter quote untuk sell
      const quote = await this.getJupiterQuote(
        tokenMint,
        'So11111111111111111111111111111111111111112', // SOL mint
        tokenAmount,
        slippage
      );
      
      if (!quote) {
        throw new Error('Failed to get Jupiter quote for sell');
      }
      
      // Build transaction via Jupiter
      const transaction = await this.buildJupiterTransaction(quote);
      
      // Add priority fee dan compute budget
      await this.addPriorityFeeInstructions(transaction);
      
      const buildTime = Date.now() - startTime;
      logPerformance('Build SELL transaction', buildTime);
      
      return {
        transaction,
        quote,
        expectedOutput: quote.outAmount,
        route: quote.routePlan
      };
      
    } catch (error) {
      logError(error, 'TransactionBuilder.buildSellTransaction');
      throw error;
    }
  }

  async getJupiterQuote(inputMint, outputMint, amount, slippageBps) {
    try {
      const slippageInBps = slippageBps * 100; // Convert percentage to basis points
      
      const quoteUrl = `${config.dex.jupiterApiUrl}/quote`;
      const params = {
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageInBps,
        onlyDirectRoutes: false,
        asLegacyTransaction: false
      };
      
      const response = await axios.get(quoteUrl, { 
        params,
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data && response.data.outAmount) {
        logger.debug(`Jupiter quote: ${amount} -> ${response.data.outAmount}`);
        return response.data;
      }
      
      return null;
      
    } catch (error) {
      logError(error, 'TransactionBuilder.getJupiterQuote');
      return null;
    }
  }

  async buildJupiterTransaction(quote) {
    try {
      const swapUrl = `${config.dex.jupiterApiUrl}/swap`;
      
      const swapRequest = {
        quoteResponse: quote,
        userPublicKey: this.wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        feeAccount: undefined,
        computeUnitPriceMicroLamports: config.fees.basePriorityFee
      };
      
      const response = await axios.post(swapUrl, swapRequest, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.swapTransaction) {
        // Deserialize transaction
        const transactionBuf = Buffer.from(response.data.swapTransaction, 'base64');
        const transaction = Transaction.from(transactionBuf);
        
        return transaction;
      }
      
      throw new Error('Invalid Jupiter swap response');
      
    } catch (error) {
      logError(error, 'TransactionBuilder.buildJupiterTransaction');
      throw error;
    }
  }

  async addPriorityFeeInstructions(transaction) {
    try {
      // Calculate dynamic priority fee berdasarkan network conditions
      const priorityFee = await this.calculateDynamicPriorityFee();
      
      // Add compute budget instructions di awal transaction
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: config.fees.computeUnitLimit
      });
      
      const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee
      });
      
      // Insert di awal transaction
      transaction.instructions.unshift(priorityFeeIx);
      transaction.instructions.unshift(computeBudgetIx);
      
      logger.debug(`Added priority fee: ${priorityFee} microlamports`);
      
    } catch (error) {
      logError(error, 'TransactionBuilder.addPriorityFeeInstructions');
      // Continue without priority fee jika gagal
    }
  }

  async calculateDynamicPriorityFee() {
    try {
      // Get recent prioritization fees untuk estimate
      const recentFees = await this.connection.getRecentPrioritizationFees({
        lockedWritableAccounts: [this.wallet.publicKey]
      });
      
      if (recentFees && recentFees.length > 0) {
        // Calculate median fee dari recent transactions
        const fees = recentFees.map(fee => fee.prioritizationFee).sort((a, b) => a - b);
        const medianFee = fees[Math.floor(fees.length / 2)];
        
        // Add buffer untuk ensure inclusion
        const dynamicFee = Math.max(
          config.fees.basePriorityFee,
          Math.min(medianFee * 1.5, config.fees.maxPriorityFee)
        );
        
        return Math.floor(dynamicFee);
      }
      
      return config.fees.basePriorityFee;
      
    } catch (error) {
      logError(error, 'TransactionBuilder.calculateDynamicPriorityFee');
      return config.fees.basePriorityFee;
    }
  }

  async preBuildTransaction(tokenMint, action = 'buy') {
    try {
      // Pre-build transaction template untuk kecepatan
      const template = {
        tokenMint,
        action,
        timestamp: Date.now(),
        template: null
      };
      
      if (action === 'buy') {
        // Create basic buy transaction structure
        const transaction = new Transaction();
        
        // Add compute budget instructions
        await this.addPriorityFeeInstructions(transaction);
        
        template.template = transaction;
      }
      
      // Store template untuk quick access
      this.preSignedTransactions.set(`${tokenMint}_${action}`, template);
      
      logger.debug(`Pre-built ${action} transaction template for ${tokenMint}`);
      
    } catch (error) {
      logError(error, 'TransactionBuilder.preBuildTransaction');
    }
  }

  async executeQuickBuy(tokenMint, amountSol) {
    try {
      const startTime = Date.now();
      
      // Check untuk pre-built template
      const template = this.preSignedTransactions.get(`${tokenMint}_buy`);
      
      let transaction;
      if (template && (Date.now() - template.timestamp) < 30000) { // Template valid for 30 seconds
        transaction = template.template;
        logger.debug('Using pre-built transaction template');
      } else {
        // Build new transaction
        const result = await this.buildBuyTransaction(tokenMint, amountSol);
        transaction = result.transaction;
      }
      
      // Get fresh blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;
      
      // Sign transaction
      transaction.sign(this.wallet);
      
      // Send dengan maximum speed settings
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: true, // Skip simulation untuk speed
          preflightCommitment: 'processed',
          maxRetries: 0 // No retries untuk speed
        }
      );
      
      const executionTime = Date.now() - startTime;
      logger.info(`⚡ QUICK BUY executed: ${signature} (${executionTime}ms)`);
      
      return signature;
      
    } catch (error) {
      logError(error, 'TransactionBuilder.executeQuickBuy');
      throw error;
    }
  }

  async executeQuickSell(tokenMint, tokenAmount) {
    try {
      const startTime = Date.now();
      
      // Build sell transaction
      const result = await this.buildSellTransaction(tokenMint, tokenAmount);
      const transaction = result.transaction;
      
      // Get fresh blockhash
      const { blockhash } = await this.connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet.publicKey;
      
      // Sign transaction
      transaction.sign(this.wallet);
      
      // Send dengan maximum speed settings
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        {
          skipPreflight: true,
          preflightCommitment: 'processed',
          maxRetries: 0
        }
      );
      
      const executionTime = Date.now() - startTime;
      logger.info(`⚡ QUICK SELL executed: ${signature} (${executionTime}ms)`);
      
      return signature;
      
    } catch (error) {
      logError(error, 'TransactionBuilder.executeQuickSell');
      throw error;
    }
  }

  async getTokenBalance(tokenMint) {
    try {
      const tokenPublicKey = new PublicKey(tokenMint);
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenPublicKey,
        this.wallet.publicKey
      );
      
      const tokenAccount = await this.connection.getTokenAccountBalance(associatedTokenAddress);
      
      if (tokenAccount && tokenAccount.value) {
        return {
          balance: tokenAccount.value.amount,
          decimals: tokenAccount.value.decimals,
          uiAmount: tokenAccount.value.uiAmount
        };
      }
      
      return { balance: '0', decimals: 0, uiAmount: 0 };
      
    } catch (error) {
      // Token account doesn't exist
      return { balance: '0', decimals: 0, uiAmount: 0 };
    }
  }

  async simulateTransaction(transaction) {
    try {
      const simulation = await this.connection.simulateTransaction(transaction);
      
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      
      return {
        success: true,
        logs: simulation.value.logs,
        unitsConsumed: simulation.value.unitsConsumed
      };
      
    } catch (error) {
      logError(error, 'TransactionBuilder.simulateTransaction');
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cleanup old pre-built transactions
  cleanupOldTransactions() {
    const now = Date.now();
    const maxAge = 60000; // 1 minute
    
    for (const [key, template] of this.preSignedTransactions) {
      if (now - template.timestamp > maxAge) {
        this.preSignedTransactions.delete(key);
      }
    }
  }

  getStats() {
    return {
      preBuiltTransactions: this.preSignedTransactions.size,
      walletAddress: this.wallet.publicKey.toString()
    };
  }
}

module.exports = TransactionBuilder;
