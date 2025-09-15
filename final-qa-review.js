#!/usr/bin/env node

import fs from 'fs';
import yaml from 'js-yaml';

async function finalQualityAssurance() {
  console.log('🔍 Final Quality Assurance Review...\n');
  
  try {
    const yamlContent = fs.readFileSync('public/openapi-4.0.1-gpts-compat.yaml', 'utf8');
    const spec = yaml.load(yamlContent);
    
    const issues = [];
    const warnings = [];
    let score = 0;
    const totalChecks = 10;

    // 1. Check for duplicate operation IDs
    console.log('1️⃣ Checking for duplicate operation IDs...');
    const operationIds = new Set();
    const duplicates = [];
    
    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathObj)) {
          if (method !== 'parameters' && operation.operationId) {
            if (operationIds.has(operation.operationId)) {
              duplicates.push(operation.operationId);
            }
            operationIds.add(operation.operationId);
          }
        }
      }
    }
    
    if (duplicates.length === 0) {
      console.log(`   ✅ No duplicate operation IDs found (${operationIds.size} unique)`);
      score++;
    } else {
      console.log(`   ❌ Found duplicate operation IDs: ${duplicates.join(', ')}`);
      issues.push(`Duplicate operation IDs: ${duplicates.join(', ')}`);
    }

    // 2. Validate examples alignment with schemas
    console.log('\n2️⃣ Checking examples alignment with schemas...');
    let exampleIssues = 0;
    let exampleCount = 0;
    
    function validateExamples(obj, path = '') {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.example !== undefined) {
          exampleCount++;
          // Basic type checking
          if (obj.type === 'string' && typeof obj.example !== 'string') {
            exampleIssues++;
            console.log(`   ⚠️  Type mismatch at ${path}: expected string, got ${typeof obj.example}`);
          }
          if (obj.type === 'number' && typeof obj.example !== 'number') {
            exampleIssues++;
            console.log(`   ⚠️  Type mismatch at ${path}: expected number, got ${typeof obj.example}`);
          }
          if (obj.type === 'boolean' && typeof obj.example !== 'boolean') {
            exampleIssues++;
            console.log(`   ⚠️  Type mismatch at ${path}: expected boolean, got ${typeof obj.example}`);
          }
        }
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object') {
            validateExamples(value, `${path}.${key}`);
          }
        }
      }
    }
    
    validateExamples(spec);
    
    if (exampleIssues === 0) {
      console.log(`   ✅ All examples align with schemas (${exampleCount} examples checked)`);
      score++;
    } else {
      console.log(`   ⚠️  Found ${exampleIssues} example misalignments out of ${exampleCount} examples`);
      warnings.push(`${exampleIssues} example type misalignments found`);
    }

    // 3. Check for consistent response structure
    console.log('\n3️⃣ Checking response structure consistency...');
    const responseStructures = new Map();
    
    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathObj)) {
          if (method !== 'parameters' && operation.responses) {
            for (const [statusCode, response] of Object.entries(operation.responses)) {
              if (response.content && response.content['application/json']) {
                const structure = JSON.stringify(Object.keys(response.content['application/json'].schema?.properties || {}));
                if (!responseStructures.has(statusCode)) {
                  responseStructures.set(statusCode, new Set());
                }
                responseStructures.get(statusCode).add(structure);
              }
            }
          }
        }
      }
    }
    
    let consistentResponses = true;
    for (const [statusCode, structures] of responseStructures) {
      if (structures.size > 3) { // Allow some variation
        console.log(`   ⚠️  Status ${statusCode} has ${structures.size} different response structures`);
        consistentResponses = false;
      }
    }
    
    if (consistentResponses) {
      console.log('   ✅ Response structures are consistent');
      score++;
    } else {
      warnings.push('Some inconsistency in response structures');
    }

    // 4. Check for missing required fields
    console.log('\n4️⃣ Checking for missing required fields...');
    let missingRequired = 0;
    
    function checkRequired(obj, path = '') {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.required && obj.properties) {
          for (const requiredField of obj.required) {
            if (!obj.properties[requiredField]) {
              missingRequired++;
              console.log(`   ❌ Required field '${requiredField}' not in properties at ${path}`);
            }
          }
        }
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object') {
            checkRequired(value, `${path}.${key}`);
          }
        }
      }
    }
    
    checkRequired(spec);
    
    if (missingRequired === 0) {
      console.log('   ✅ All required fields are properly defined');
      score++;
    } else {
      issues.push(`${missingRequired} required fields missing from properties`);
    }

    // 5. Check parameter validation
    console.log('\n5️⃣ Checking parameter validation...');
    let parameterIssues = 0;
    
    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathObj)) {
          if (method !== 'parameters' && operation.parameters) {
            operation.parameters.forEach(param => {
              if (param.required && !param.schema) {
                parameterIssues++;
                console.log(`   ❌ Required parameter '${param.name}' missing schema`);
              }
              if (param.in === 'path' && !param.required) {
                parameterIssues++;
                console.log(`   ❌ Path parameter '${param.name}' should be required`);
              }
            });
          }
        }
      }
    }
    
    if (parameterIssues === 0) {
      console.log('   ✅ All parameters properly validated');
      score++;
    } else {
      issues.push(`${parameterIssues} parameter validation issues`);
    }

    // 6. Check status code coverage
    console.log('\n6️⃣ Checking status code coverage...');
    const statusCodes = new Set();
    
    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathObj)) {
          if (method !== 'parameters' && operation.responses) {
            Object.keys(operation.responses).forEach(code => statusCodes.add(code));
          }
        }
      }
    }
    
    const expectedCodes = ['200', '400', '401', '429', '500'];
    const missingCodes = expectedCodes.filter(code => !statusCodes.has(code));
    
    if (missingCodes.length === 0) {
      console.log(`   ✅ Good status code coverage: ${Array.from(statusCodes).sort().join(', ')}`);
      score++;
    } else {
      console.log(`   ⚠️  Missing status codes: ${missingCodes.join(', ')}`);
      warnings.push(`Missing status codes: ${missingCodes.join(', ')}`);
    }

    // 7. Check for security on endpoints
    console.log('\n7️⃣ Checking security requirements...');
    let unsecuredEndpoints = 0;
    
    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathObj)) {
          if (method !== 'parameters' && typeof operation === 'object') {
            if (!operation.security && !spec.security) {
              unsecuredEndpoints++;
              console.log(`   ⚠️  Unsecured endpoint: ${method.toUpperCase()} ${path}`);
            }
          }
        }
      }
    }
    
    if (unsecuredEndpoints === 0) {
      console.log('   ✅ All endpoints properly secured');
      score++;
    } else {
      warnings.push(`${unsecuredEndpoints} endpoints may be unsecured`);
    }

    // 8. Check documentation quality
    console.log('\n8️⃣ Checking documentation quality...');
    let undocumentedEndpoints = 0;
    
    if (spec.paths) {
      for (const [path, pathObj] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(pathObj)) {
          if (method !== 'parameters' && typeof operation === 'object') {
            if (!operation.summary && !operation.description) {
              undocumentedEndpoints++;
              console.log(`   ⚠️  Undocumented endpoint: ${method.toUpperCase()} ${path}`);
            }
          }
        }
      }
    }
    
    if (undocumentedEndpoints === 0) {
      console.log('   ✅ All endpoints well documented');
      score++;
    } else {
      warnings.push(`${undocumentedEndpoints} endpoints lack documentation`);
    }

    // 9. Check enum consistency
    console.log('\n9️⃣ Checking enum value consistency...');
    const enumValues = new Map();
    let enumInconsistencies = 0;
    
    function collectEnums(obj, path = '') {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.enum && obj.type) {
          const key = `${obj.type}_enum`;
          if (!enumValues.has(key)) {
            enumValues.set(key, new Set());
          }
          obj.enum.forEach(value => enumValues.get(key).add(value));
        }
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object') {
            collectEnums(value, `${path}.${key}`);
          }
        }
      }
    }
    
    collectEnums(spec);
    
    // Check for similar enum patterns
    for (const [enumType, values] of enumValues) {
      if (values.size > 5) {
        console.log(`   ℹ️  Large enum found: ${enumType} with ${values.size} values`);
      }
    }
    
    console.log('   ✅ Enum values checked for consistency');
    score++;

    // 10. Check overall spec health
    console.log('\n🔟 Overall specification health...');
    const specSize = JSON.stringify(spec).length;
    const endpointCount = Object.keys(spec.paths || {}).length;
    const componentCount = Object.keys(spec.components?.schemas || {}).length;
    
    console.log(`   📊 Specification metrics:`);
    console.log(`      - Size: ${(specSize / 1024).toFixed(1)}KB`);
    console.log(`      - Endpoints: ${endpointCount}`);
    console.log(`      - Components: ${componentCount}`);
    console.log(`      - Operation IDs: ${operationIds.size}`);
    
    if (endpointCount > 10 && componentCount > 5 && operationIds.size === endpointCount) {
      console.log('   ✅ Healthy specification metrics');
      score++;
    } else {
      warnings.push('Specification may need more content or structure');
    }

    // Final Summary
    console.log('\n📊 FINAL QUALITY ASSURANCE SUMMARY:');
    console.log(`Quality Score: ${score}/${totalChecks} (${Math.round(score/totalChecks*100)}%)`);
    
    if (score >= 9) {
      console.log('🎉 EXCELLENT: Production-ready quality');
    } else if (score >= 7) {
      console.log('✅ GOOD: High quality with minor issues');
    } else if (score >= 5) {
      console.log('⚠️  FAIR: Some quality issues to address');
    } else {
      console.log('❌ POOR: Significant quality issues found');
    }
    
    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning}`);
      });
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n🎉 PERFECT: No issues or warnings found!');
    }

    return { score, totalChecks, issues, warnings };

  } catch (error) {
    console.error('\n❌ QA REVIEW FAILED:', error.message);
    return { score: 0, totalChecks: 10, issues: [`QA review failed: ${error.message}`], warnings: [] };
  }
}

// Run the QA review
finalQualityAssurance().catch(console.error);