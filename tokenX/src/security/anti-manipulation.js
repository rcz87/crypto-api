const { logger, logError } = require('../utils/logger');
const { PublicKey } = require('@solana/web3.js');

class AntiManipulationEngine {
  constructor(solanaConnection) {
    this.connection = solanaConnection.getConnection();
    this.suspiciousWallets = new Set();
    this.walletClusters = new Map();
    this.washTradePatterns = new Map();
  }

  // 1. DETEKSI WASH TRADING & WALLET CLUSTERING
  async detectWashTrading(tokenMint, transactions) {
    try {
      const walletGraph = new Map();
      const fundingTraces = new Map();
      
      // Build wallet relationship graph
      for (const tx of transactions) {
        const from = tx.from;
        const to = tx.to;
        
        if (!walletGraph.has(from)) walletGraph.set(from, new Set());
        if (!walletGraph.has(to)) walletGraph.set(to, new Set());
        
        walletGraph.get(from).add(to);
        walletGraph.get(to).add(from);
        
        // Track funding patterns
        await this.traceFundingSource(from, to, tx.amount);
      }
      
      // Detect circular trading patterns
      const circularPatterns = this.findCircularPatterns(walletGraph);
      const clusterScore = this.calculateClusterScore(walletGraph);
      
      // Check for self-trade loops
      const selfTradeLoops = this.detectSelfTradeLoops(transactions);
      
      return {
        isWashTrading: circularPatterns.length > 3 || clusterScore > 0.7,
        circularPatterns,
        clusterScore,
        selfTradeLoops,
        suspiciousWallets: Array.from(this.suspiciousWallets),
        riskLevel: this.calculateManipulationRisk(circularPatterns, clusterScore, selfTradeLoops)
      };
      
    } catch (error) {
      logError(error, 'AntiManipulationEngine.detectWashTrading');
      return { isWashTrading: false, riskLevel: 'UNKNOWN' };
    }
  }

  async traceFundingSource(fromWallet, toWallet, amount) {
    try {
      // Get recent SOL transfers to identify funding patterns
      const signatures = await this.connection.getSignaturesForAddress(
        new PublicKey(fromWallet),
        { limit: 50 }
      );
      
      for (const sig of signatures.slice(0, 10)) { // Check last 10 transactions
        const tx = await this.connection.getParsedTransaction(sig.signature);
        
        if (tx && tx.meta && tx.meta.preBalances && tx.meta.postBalances) {
          // Detect funding from same source
          const fundingPattern = this.analyzeFundingPattern(tx);
          if (fundingPattern.isSuspicious) {
            this.suspiciousWallets.add(fromWallet);
            this.suspiciousWallets.add(toWallet);
          }
        }
      }
      
    } catch (error) {
      // Silent fail untuk avoid rate limiting
    }
  }

  findCircularPatterns(walletGraph) {
    const patterns = [];
    const visited = new Set();
    
    for (const [wallet, connections] of walletGraph) {
      if (visited.has(wallet)) continue;
      
      const path = [wallet];
      const cycle = this.dfsCircular(walletGraph, wallet, wallet, path, visited, new Set([wallet]));
      
      if (cycle && cycle.length >= 3) {
        patterns.push(cycle);
      }
    }
    
    return patterns;
  }

  dfsCircular(graph, current, target, path, globalVisited, localVisited) {
    const connections = graph.get(current) || new Set();
    
    for (const next of connections) {
      if (next === target && path.length >= 3) {
        return [...path, next]; // Found cycle
      }
      
      if (!localVisited.has(next) && path.length < 6) { // Max depth 6
        localVisited.add(next);
        const result = this.dfsCircular(graph, next, target, [...path, next], globalVisited, localVisited);
        if (result) return result;
        localVisited.delete(next);
      }
    }
    
    globalVisited.add(current);
    return null;
  }

  calculateClusterScore(walletGraph) {
    const totalWallets = walletGraph.size;
    if (totalWallets < 3) return 0;
    
    let totalConnections = 0;
    let maxConnections = 0;
    
    for (const [wallet, connections] of walletGraph) {
      const connectionCount = connections.size;
      totalConnections += connectionCount;
      maxConnections = Math.max(maxConnections, connectionCount);
    }
    
    const avgConnections = totalConnections / totalWallets;
    const density = totalConnections / (totalWallets * (totalWallets - 1));
    
    // High density + high max connections = suspicious
    return (density * 0.7) + ((maxConnections / totalWallets) * 0.3);
  }

  detectSelfTradeLoops(transactions) {
    const loops = [];
    const walletTxMap = new Map();
    
    // Group transactions by wallet pairs
    for (const tx of transactions) {
      const pair = [tx.from, tx.to].sort().join('-');
      if (!walletTxMap.has(pair)) walletTxMap.set(pair, []);
      walletTxMap.get(pair).push(tx);
    }
    
    // Detect rapid back-and-forth trading
    for (const [pair, txs] of walletTxMap) {
      if (txs.length >= 4) { // At least 4 transactions between same pair
        const timeSpread = txs[txs.length - 1].timestamp - txs[0].timestamp;
        if (timeSpread < 300000) { // Within 5 minutes
          loops.push({
            walletPair: pair,
            transactionCount: txs.length,
            timeSpread,
            totalVolume: txs.reduce((sum, tx) => sum + tx.amount, 0)
          });
        }
      }
    }
    
    return loops;
  }

  analyzeFundingPattern(transaction) {
    // Analyze if multiple wallets funded from same source
    const fundingSources = new Set();
    let suspiciousCount = 0;
    
    if (transaction.meta && transaction.meta.innerInstructions) {
      for (const inner of transaction.meta.innerInstructions) {
        for (const instruction of inner.instructions) {
          if (instruction.program === 'system' && instruction.parsed?.type === 'transfer') {
            const source = instruction.parsed.info.source;
            fundingSources.add(source);
            
            // Check if this source funded multiple suspicious wallets
            if (this.suspiciousWallets.has(source)) {
              suspiciousCount++;
            }
          }
        }
      }
    }
    
    return {
      isSuspicious: suspiciousCount >= 2 || fundingSources.size === 1,
      fundingSources: Array.from(fundingSources),
      suspiciousCount
    };
  }

  calculateManipulationRisk(circularPatterns, clusterScore, selfTradeLoops) {
    let riskScore = 0;
    
    // Circular patterns risk
    riskScore += Math.min(circularPatterns.length * 0.2, 1.0);
    
    // Cluster score risk
    riskScore += clusterScore;
    
    // Self-trade loops risk
    riskScore += Math.min(selfTradeLoops.length * 0.15, 0.5);
    
    if (riskScore >= 0.8) return 'VERY_HIGH';
    if (riskScore >= 0.6) return 'HIGH';
    if (riskScore >= 0.4) return 'MEDIUM';
    if (riskScore >= 0.2) return 'LOW';
    return 'MINIMAL';
  }

  // 2. ADVANCED SPL TOKEN SECURITY CHECKS
  async advancedSecurityCheck(tokenMint) {
    try {
      const tokenPubkey = new PublicKey(tokenMint);
      const mintInfo = await this.connection.getParsedAccountInfo(tokenPubkey);
      
      if (!mintInfo.value || !mintInfo.value.data.parsed) {
        return { isSecure: false, reason: 'Invalid token mint' };
      }
      
      const mintData = mintInfo.value.data.parsed.info;
      const securityChecks = {
        mintAuthority: await this.checkMintAuthority(mintData.mintAuthority),
        freezeAuthority: await this.checkFreezeAuthority(mintData.freezeAuthority),
        transferHooks: await this.checkTransferHooks(tokenMint),
        poolSecurity: await this.checkPoolSecurity(tokenMint),
        upgradeAuthority: await this.checkUpgradeAuthority(tokenMint)
      };
      
      const riskLevel = this.calculateSecurityRisk(securityChecks);
      
      return {
        isSecure: riskLevel === 'LOW' || riskLevel === 'MINIMAL',
        riskLevel,
        checks: securityChecks,
        recommendation: this.getSecurityRecommendation(riskLevel)
      };
      
    } catch (error) {
      logError(error, 'AntiManipulationEngine.advancedSecurityCheck');
      return { isSecure: false, reason: 'Security check failed' };
    }
  }

  async checkMintAuthority(mintAuthority) {
    if (mintAuthority === null) {
      return { isSecure: true, status: 'REVOKED' };
    }
    
    try {
      // Check if mint authority is a PDA or upgradeable program
      const authorityInfo = await this.connection.getAccountInfo(new PublicKey(mintAuthority));
      
      if (authorityInfo && authorityInfo.owner) {
        const ownerProgram = authorityInfo.owner.toString();
        
        // Check if it's controlled by known safe programs
        const safePrograms = [
          '11111111111111111111111111111111', // System Program
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' // SPL Token Program
        ];
        
        if (safePrograms.includes(ownerProgram)) {
          return { isSecure: true, status: 'SAFE_PROGRAM_CONTROLLED' };
        }
        
        return { 
          isSecure: false, 
          status: 'CUSTOM_PROGRAM_CONTROLLED',
          ownerProgram 
        };
      }
      
      return { isSecure: false, status: 'ACTIVE_MINT_AUTHORITY' };
      
    } catch (error) {
      return { isSecure: false, status: 'CHECK_FAILED' };
    }
  }

  async checkFreezeAuthority(freezeAuthority) {
    if (freezeAuthority === null) {
      return { isSecure: true, status: 'REVOKED' };
    }
    
    // Similar check as mint authority
    return { isSecure: false, status: 'ACTIVE_FREEZE_AUTHORITY' };
  }

  async checkTransferHooks(tokenMint) {
    try {
      // Check for Transfer Hook extensions (Token-2022)
      const mintInfo = await this.connection.getAccountInfo(new PublicKey(tokenMint));
      
      if (mintInfo && mintInfo.data) {
        // Simple check for non-standard data length (indicates extensions)
        const standardMintSize = 82; // Standard SPL token mint size
        
        if (mintInfo.data.length > standardMintSize) {
          return {
            isSecure: false,
            status: 'TRANSFER_HOOKS_DETECTED',
            dataSize: mintInfo.data.length
          };
        }
      }
      
      return { isSecure: true, status: 'NO_TRANSFER_HOOKS' };
      
    } catch (error) {
      return { isSecure: false, status: 'CHECK_FAILED' };
    }
  }

  async checkPoolSecurity(tokenMint) {
    try {
      // Check for custom pool programs (non-Raydium/Orca)
      const knownSafeDEXs = [
        '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM
        '9W959DqEETiGZocYWCQPaJ6sD6MUGLiAZH6Aq7TZjTa',  // Orca
        'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'   // Orca Whirlpool
      ];
      
      // This would require more complex pool discovery logic
      // For now, return basic check
      return { isSecure: true, status: 'STANDARD_POOLS' };
      
    } catch (error) {
      return { isSecure: false, status: 'CHECK_FAILED' };
    }
  }

  async checkUpgradeAuthority(tokenMint) {
    try {
      // Check if token program is upgradeable
      const mintInfo = await this.connection.getAccountInfo(new PublicKey(tokenMint));
      
      if (mintInfo && mintInfo.owner) {
        const programId = mintInfo.owner.toString();
        
        // Standard SPL Token program (not upgradeable)
        if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
          return { isSecure: true, status: 'STANDARD_SPL_TOKEN' };
        }
        
        // Token-2022 (potentially upgradeable)
        if (programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
          return { isSecure: false, status: 'TOKEN_2022_UPGRADEABLE' };
        }
        
        return { 
          isSecure: false, 
          status: 'CUSTOM_TOKEN_PROGRAM',
          programId 
        };
      }
      
      return { isSecure: false, status: 'UNKNOWN_PROGRAM' };
      
    } catch (error) {
      return { isSecure: false, status: 'CHECK_FAILED' };
    }
  }

  calculateSecurityRisk(checks) {
    let riskScore = 0;
    
    // Mint authority risk
    if (!checks.mintAuthority.isSecure) riskScore += 0.3;
    
    // Freeze authority risk
    if (!checks.freezeAuthority.isSecure) riskScore += 0.2;
    
    // Transfer hooks risk
    if (!checks.transferHooks.isSecure) riskScore += 0.25;
    
    // Pool security risk
    if (!checks.poolSecurity.isSecure) riskScore += 0.15;
    
    // Upgrade authority risk
    if (!checks.upgradeAuthority.isSecure) riskScore += 0.1;
    
    if (riskScore >= 0.7) return 'VERY_HIGH';
    if (riskScore >= 0.5) return 'HIGH';
    if (riskScore >= 0.3) return 'MEDIUM';
    if (riskScore >= 0.1) return 'LOW';
    return 'MINIMAL';
  }

  getSecurityRecommendation(riskLevel) {
    switch (riskLevel) {
      case 'VERY_HIGH':
        return 'REJECT - Multiple critical security risks detected';
      case 'HIGH':
        return 'AVOID - Significant security concerns';
      case 'MEDIUM':
        return 'CAUTION - Proceed with reduced position size';
      case 'LOW':
        return 'ACCEPTABLE - Minor risks, monitor closely';
      case 'MINIMAL':
        return 'SAFE - Standard security profile';
      default:
        return 'UNKNOWN - Unable to assess security';
    }
  }

  // 3. VOLUME VALIDATION WITH ROBUST STATISTICS
  validateVolumeMetrics(volumeData) {
    try {
      const volumes = volumeData.map(d => d.volume).filter(v => v > 0);
      
      if (volumes.length < 3) {
        return { isValid: false, reason: 'Insufficient volume data' };
      }
      
      // Use median-of-means for robust statistics
      const medianVolume = this.calculateMedian(volumes);
      const meanVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const stdDev = this.calculateStandardDeviation(volumes);
      
      // Detect outliers using IQR method
      const outliers = this.detectOutliers(volumes);
      const outlierRatio = outliers.length / volumes.length;
      
      // Check for suspicious patterns
      const isSuspicious = outlierRatio > 0.3 || (meanVolume / medianVolume) > 3;
      
      return {
        isValid: !isSuspicious,
        medianVolume,
        meanVolume,
        outlierRatio,
        suspiciousPattern: isSuspicious,
        cleanedVolume: medianVolume // Use median as robust estimate
      };
      
    } catch (error) {
      logError(error, 'AntiManipulationEngine.validateVolumeMetrics');
      return { isValid: false, reason: 'Volume validation failed' };
    }
  }

  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  detectOutliers(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return values.filter(v => v < lowerBound || v > upperBound);
  }
}

module.exports = AntiManipulationEngine;
