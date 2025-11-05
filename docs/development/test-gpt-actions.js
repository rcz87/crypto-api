#!/usr/bin/env node

import fs from 'fs';
import yaml from 'js-yaml';

async function testGPTActionsCompatibility() {
  console.log('🤖 Testing GPT Actions Compatibility...\n');
  
  try {
    const yamlContent = fs.readFileSync('public/openapi-4.0.1-gpts-compat.yaml', 'utf8');
    const spec = yaml.load(yamlContent);
    
    const issues = [];
    let score = 0;
    const totalTests = 7;

    // Test 1: Single Security Scheme
    console.log('1️⃣ Checking security scheme...');
    if (spec.security && spec.security.length === 1 && spec.security[0].ApiKeyAuth) {
      console.log('   ✅ Single ApiKeyAuth security scheme found');
      score++;
    } else {
      console.log('   ❌ Should have exactly one ApiKeyAuth security scheme');
      issues.push('Missing or incorrect security scheme for GPT Actions');
    }

    // Test 2: Security Scheme Definition
    console.log('\n2️⃣ Checking security scheme definition...');
    const apiKeyAuth = spec.components?.securitySchemes?.ApiKeyAuth;
    if (apiKeyAuth && apiKeyAuth.type === 'apiKey' && apiKeyAuth.in === 'header' && apiKeyAuth.name === 'X-API-Key') {
      console.log('   ✅ ApiKeyAuth properly defined');
      score++;
    } else {
      console.log('   ❌ ApiKeyAuth not properly defined');
      issues.push('ApiKeyAuth security scheme missing or incorrect');
    }

    // Test 3: Minimal $ref Usage in Parameters
    console.log('\n3️⃣ Checking parameter inline definitions...');
    let refCount = 0;
    let inlineCount = 0;
    
    function countParameterRefs(obj, path = '') {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'parameters' && Array.isArray(value)) {
            value.forEach((param, i) => {
              if (param.$ref) {
                refCount++;
                console.log(`   📎 Found $ref parameter: ${param.$ref} at ${path}`);
              } else if (param.name) {
                inlineCount++;
              }
            });
          }
          if (typeof value === 'object') {
            countParameterRefs(value, `${path}.${key}`);
          }
        }
      }
    }
    
    countParameterRefs(spec.paths);
    
    console.log(`   📊 Inline parameters: ${inlineCount}, $ref parameters: ${refCount}`);
    if (inlineCount > refCount * 2) {
      console.log('   ✅ Good ratio of inline vs $ref parameters');
      score++;
    } else {
      console.log('   ⚠️  Consider more inline parameters for better GPT Actions compatibility');
    }

    // Test 4: Required Fields for GPT Actions
    console.log('\n4️⃣ Checking required OpenAPI fields...');
    const requiredFields = ['openapi', 'info', 'paths'];
    const hasRequired = requiredFields.every(field => spec[field]);
    
    if (hasRequired && spec.info.title && spec.info.version) {
      console.log('   ✅ All required fields present');
      score++;
    } else {
      console.log('   ❌ Missing required fields for GPT Actions');
      issues.push('Missing required OpenAPI fields');
    }

    // Test 5: Operation IDs
    console.log('\n5️⃣ Checking operation IDs...');
    let operationIdCount = 0;
    let totalOperations = 0;
    
    for (const [path, pathObj] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathObj)) {
        if (method !== 'parameters' && typeof operation === 'object') {
          totalOperations++;
          if (operation.operationId) {
            operationIdCount++;
          }
        }
      }
    }
    
    console.log(`   📊 Operations with operationId: ${operationIdCount}/${totalOperations}`);
    if (operationIdCount === totalOperations) {
      console.log('   ✅ All operations have operationId');
      score++;
    } else {
      console.log('   ❌ Some operations missing operationId');
      issues.push('Missing operationId on some operations');
    }

    // Test 6: Server URL
    console.log('\n6️⃣ Checking server configuration...');
    if (spec.servers && spec.servers.length > 0 && spec.servers[0].url) {
      console.log(`   ✅ Server URL configured: ${spec.servers[0].url}`);
      score++;
    } else {
      console.log('   ❌ No server URL configured');
      issues.push('Missing server URL configuration');
    }

    // Test 7: Error Response Formats
    console.log('\n7️⃣ Checking error response formats...');
    const errorResponses = ['400', '401', '404', '429', '500'];
    let properErrorResponses = 0;
    
    if (spec.components?.responses) {
      for (const [name, response] of Object.entries(spec.components.responses)) {
        if (response.content && response.content['application/problem+json']) {
          properErrorResponses++;
        }
      }
    }
    
    console.log(`   📊 Proper error responses: ${properErrorResponses}`);
    if (properErrorResponses >= 4) {
      console.log('   ✅ Good error response coverage');
      score++;
    } else {
      console.log('   ⚠️  Limited error response coverage');
    }

    // Summary
    console.log('\n📊 GPT ACTIONS COMPATIBILITY SUMMARY:');
    console.log(`Score: ${score}/${totalTests} (${Math.round(score/totalTests*100)}%)`);
    
    if (score >= 6) {
      console.log('🎉 EXCELLENT: Highly compatible with GPT Actions');
    } else if (score >= 4) {
      console.log('✅ GOOD: Compatible with GPT Actions, minor issues');
    } else {
      console.log('⚠️  NEEDS WORK: Some compatibility issues found');
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️ ISSUES TO ADDRESS:');
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    } else {
      console.log('\n🎉 NO COMPATIBILITY ISSUES FOUND!');
    }

    return { score, totalTests, issues };

  } catch (error) {
    console.error('\n❌ GPT ACTIONS TEST FAILED:', error.message);
    return { score: 0, totalTests: 7, issues: [`Test failed: ${error.message}`] };
  }
}

// Run the test
testGPTActionsCompatibility().catch(console.error);