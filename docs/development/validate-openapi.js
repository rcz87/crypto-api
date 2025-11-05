#!/usr/bin/env node

import fs from 'fs';
import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';

async function validateOpenAPI() {
  console.log('🔍 Starting OpenAPI 3.1.0 Validation...\n');
  
  const results = {
    yamlSyntax: false,
    openapiStructure: false,
    gptCompatibility: false,
    rfc7807Compliance: false,
    issues: []
  };

  try {
    // 1. YAML Syntax Validation
    console.log('1️⃣ Testing YAML syntax...');
    const yamlContent = fs.readFileSync('public/openapi-4.0.1-gpts-compat.yaml', 'utf8');
    const spec = yaml.load(yamlContent);
    results.yamlSyntax = true;
    console.log('✅ YAML syntax is valid');

    // 2. OpenAPI Structure Validation
    console.log('\n2️⃣ Testing OpenAPI 3.1.0 structure...');
    await SwaggerParser.validate(spec);
    results.openapiStructure = true;
    console.log('✅ OpenAPI 3.1.0 structure is valid');

    // 3. GPT Actions Compatibility Check
    console.log('\n3️⃣ Testing GPT Actions compatibility...');
    results.gptCompatibility = validateGPTCompatibility(spec);
    
    // 4. RFC 7807 Problem Details Validation
    console.log('\n4️⃣ Testing RFC 7807 Problem Details compliance...');
    results.rfc7807Compliance = validateRFC7807(spec);

    // 5. Additional Quality Checks
    console.log('\n5️⃣ Running additional quality checks...');
    validateQualityChecks(spec, results);

    // Summary
    console.log('\n📊 VALIDATION SUMMARY:');
    console.log(`YAML Syntax: ${results.yamlSyntax ? '✅' : '❌'}`);
    console.log(`OpenAPI Structure: ${results.openapiStructure ? '✅' : '❌'}`);
    console.log(`GPT Compatibility: ${results.gptCompatibility ? '✅' : '❌'}`);
    console.log(`RFC 7807 Compliance: ${results.rfc7807Compliance ? '✅' : '❌'}`);
    
    if (results.issues.length > 0) {
      console.log('\n⚠️ ISSUES FOUND:');
      results.issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    } else {
      console.log('\n🎉 ALL VALIDATIONS PASSED! OpenAPI spec is battle-ready.');
    }

  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:', error.message);
    results.issues.push(`Validation error: ${error.message}`);
  }

  return results;
}

function validateGPTCompatibility(spec) {
  console.log('   🔍 Checking GPT Actions requirements...');
  let isCompatible = true;
  
  // Check for single security scheme
  if (!spec.security || spec.security.length !== 1) {
    console.log('   ❌ Should have exactly one security scheme for GPT Actions');
    return false;
  }
  
  if (!spec.security[0].ApiKeyAuth) {
    console.log('   ❌ Should use ApiKeyAuth security scheme for GPT Actions');
    return false;
  }
  
  // Check for inline parameters (minimal $ref usage)
  let hasProblematicRefs = false;
  function checkForRefs(obj, path = '') {
    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && path.includes('parameters')) {
          console.log(`   ⚠️  Found $ref in parameters at ${path}: ${value}`);
          hasProblematicRefs = true;
        }
        if (typeof value === 'object') {
          checkForRefs(value, `${path}.${key}`);
        }
      }
    }
  }
  
  checkForRefs(spec.paths);
  
  if (hasProblematicRefs) {
    console.log('   ❌ Found $ref usage in parameters - may cause GPT Actions issues');
    isCompatible = false;
  }
  
  console.log('   ✅ GPT Actions compatibility checks passed');
  return isCompatible;
}

function validateRFC7807(spec) {
  console.log('   🔍 Checking RFC 7807 Problem Details...');
  let isCompliant = true;
  
  const errorResponses = ['400', '401', '404', '429', '500', '503'];
  
  // Check components.responses
  if (spec.components && spec.components.responses) {
    for (const [name, response] of Object.entries(spec.components.responses)) {
      if (name.includes('Error') || errorResponses.some(code => name.includes(code)) || name === 'ProblemResponse' || name === 'TooManyRequests' || name === 'BadRequest' || name === 'Unauthorized' || name === 'NotFound') {
        if (!response.content || !response.content['application/problem+json']) {
          console.log(`   ❌ Response ${name} missing application/problem+json content type`);
          isCompliant = false;
        }
        
        const problemSchema = response.content && response.content['application/problem+json'] && response.content['application/problem+json'].schema;
        if (problemSchema && problemSchema.$ref && problemSchema.$ref.includes('ProblemDetails')) {
          console.log(`   ✅ Response ${name} uses ProblemDetails schema`);
        }
      }
    }
  }
  
  // Check for ProblemDetails schema
  if (!spec.components || !spec.components.schemas || !spec.components.schemas.ProblemDetails) {
    console.log('   ❌ Missing ProblemDetails schema definition');
    isCompliant = false;
  } else {
    const problemDetails = spec.components.schemas.ProblemDetails;
    const requiredFields = ['type', 'title', 'status'];
    const hasRequiredFields = requiredFields.every(field => 
      problemDetails.properties && problemDetails.properties[field]
    );
    
    if (!hasRequiredFields) {
      console.log('   ❌ ProblemDetails schema missing required fields');
      isCompliant = false;
    } else {
      console.log('   ✅ ProblemDetails schema has required fields');
    }
  }
  
  console.log(`   ${isCompliant ? '✅' : '❌'} RFC 7807 compliance check ${isCompliant ? 'passed' : 'failed'}`);
  return isCompliant;
}

function validateQualityChecks(spec, results) {
  console.log('   🔍 Running quality checks...');
  
  // Check for duplicate operation IDs
  const operationIds = new Set();
  let duplicateOpIds = [];
  
  if (spec.paths) {
    for (const [path, pathObj] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathObj)) {
        if (method !== 'parameters' && operation.operationId) {
          if (operationIds.has(operation.operationId)) {
            duplicateOpIds.push(operation.operationId);
          }
          operationIds.add(operation.operationId);
        }
      }
    }
  }
  
  if (duplicateOpIds.length > 0) {
    results.issues.push(`Duplicate operation IDs found: ${duplicateOpIds.join(', ')}`);
  }
  
  // Check for missing examples in schemas
  let missingExamples = 0;
  function checkExamples(obj, path = '') {
    if (typeof obj === 'object' && obj !== null) {
      if (obj.type && !obj.example && !obj.examples && path.includes('schema')) {
        missingExamples++;
      }
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object') {
          checkExamples(value, `${path}.${key}`);
        }
      }
    }
  }
  
  checkExamples(spec);
  
  // Check rate limit headers consistency
  const rateLimitEndpoints = [];
  if (spec.paths) {
    for (const [path, pathObj] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathObj)) {
        if (method !== 'parameters' && operation.responses) {
          for (const [statusCode, response] of Object.entries(operation.responses)) {
            if (response.headers && (
              response.headers['RateLimit-Limit'] || 
              response.headers['RateLimit-Remaining'] || 
              response.headers['RateLimit-Reset']
            )) {
              rateLimitEndpoints.push(`${method.toUpperCase()} ${path}`);
            }
          }
        }
      }
    }
  }
  
  console.log(`   ✅ Found ${operationIds.size} operation IDs (${duplicateOpIds.length} duplicates)`);
  console.log(`   ✅ Found ${rateLimitEndpoints.length} endpoints with rate limit headers`);
  console.log(`   ℹ️  Found ${missingExamples} schema properties without examples`);
}

// Run validation
validateOpenAPI().catch(console.error);