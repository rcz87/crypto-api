// Minimal test in root directory
console.log('🧪 Minimal Test Starting...');

// Test 1: Basic Node.js
console.log('Node version:', process.version);
console.log('Current directory:', process.cwd());

// Test 2: Basic require
try {
  const fs = require('fs');
  console.log('✅ Basic require working');
} catch (error) {
  console.error('❌ Basic require failed:', error.message);
}

// Test 3: Check if package.json exists
try {
  const fs = require('fs');
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log('✅ Package.json found:', packageJson.name);
} catch (error) {
  console.error('❌ Package.json issue:', error.message);
}

// Test 4: Check dependencies
try {
  const { Connection } = require('@solana/web3.js');
  console.log('✅ Solana Web3.js loaded');
  
  // Test connection
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  
  connection.getSlot()
    .then(slot => {
      console.log('✅ Solana RPC working! Slot:', slot);
      console.log('🎉 SYSTEM IS WORKING!');
    })
    .catch(error => {
      console.error('❌ RPC failed:', error.message);
    });
    
} catch (error) {
  console.error('❌ Dependency issue:', error.message);
}
