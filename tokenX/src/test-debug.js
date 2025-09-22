// Debug test to see what's happening
console.log('Starting debug test...');

try {
  console.log('Current directory:', process.cwd());
  console.log('Node version:', process.version);
  
  // Test basic require
  console.log('Testing require...');
  const path = require('path');
  console.log('Path module loaded');
  
  // Test config
  console.log('Testing config...');
  const config = require('./config/index.js');
  console.log('Config keys:', Object.keys(config));
  
  // Test simple connection
  console.log('Testing Solana Web3...');
  const { Connection } = require('@solana/web3.js');
  console.log('Web3 loaded');
  
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  console.log('Connection created');
  
  // Test async operation
  connection.getSlot()
    .then(slot => {
      console.log('✅ SUCCESS! Current slot:', slot);
      console.log('🎉 All basic components working!');
    })
    .catch(error => {
      console.error('❌ Connection failed:', error.message);
    });
    
} catch (error) {
  console.error('💥 Error:', error.message);
  console.error('Stack:', error.stack);
}
