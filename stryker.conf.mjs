/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  _comment:
    "This config was generated using 'stryker init'. Please take a look at: https://stryker-mutator.io/docs/stryker/configuration/ for more information.",
  packageManager: "npm",
  reporters: ["html", "clear-text", "progress", "dashboard"],
  testRunner: "jest",
  testRunnerNodeArgs: ["--loader=tsx"],
  coverageAnalysis: "perTest",
  
  // Target critical algorithm files for mutation testing
  mutate: [
    "server/services/whaleDetection.ts",
    "server/services/smc.ts", 
    "server/services/cvd.ts",
    "server/services/orderFlow.ts"
  ],
  
  // Performance optimizations
  concurrency: 4,
  maxConcurrentTestRunners: 2,
  
  // Quality thresholds for institutional-grade standards
  thresholds: {
    high: 90,
    low: 80,
    break: 75
  },
  
  // Focus on critical algorithm functions
  mutator: {
    plugins: ["typescript"],
    excludedMutations: [
      "StringLiteral", // Skip string mutation for cleaner results
      "ConditionalExpression" // Focus on logic mutations
    ]
  },
  
  // Test selection
  jest: {
    projectType: "custom",
    configFile: "jest.config.js",
    enableFindRelatedTests: true
  },
  
  // Timeouts for complex algorithms
  timeoutMS: 60000,
  timeoutFactor: 2,
  
  // Ignore non-critical files
  ignorePatterns: [
    "tests/**",
    "server/index.ts",
    "server/vite.ts",
    "**/*.d.ts",
    "**/node_modules/**"
  ]
};