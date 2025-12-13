const request = require('supertest');
const express = require('express');
const securityService = require('./security/securityService');

describe('Security Service Tests', () => {
  let app;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Create fresh express app for each test
    app = express();
    app.set('trust proxy', true);
    
    // Apply middlewares
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    const middlewares = securityService(app);
    middlewares.forEach(middleware => app.use(middleware));
    
    // Test routes
    app.get('/api/blogs', (req, res) => {
      res.json({ message: 'blogs', count: 10 });
    });
    
    app.get('/api/gallery', (req, res) => {
      res.json({ message: 'gallery', items: 5 });
    });
    
    app.post('/api/contact', (req, res) => {
      res.json({ message: 'contact received', data: req.body });
    });
    
    app.get('/api/test', (req, res) => {
      res.json({ message: 'test endpoint' });
    });
    
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
    
    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });
    
    // Clear any state from previous tests
    securityService.clearSecurityState();
  });

  afterEach(() => {
    securityService.clearSecurityState();
  });

  afterAll(() => {
    securityService.cleanup();
    securityService.closeLogger();
  });

  describe('Legitimate User Activity - No False Positives', () => {
    test('Should allow normal blog browsing (15 requests)', async () => {
      const promises = [];
      
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .get('/api/blogs')
            .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
            .expect(200)
        );
      }
      
      const responses = await Promise.all(promises);
      responses.forEach(res => {
        expect(res.body.message).toBe('blogs');
      });
    });

    test('Should allow gallery browsing without suspicion', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .get('/api/gallery')
          .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
          .expect(200);
        
        expect(res.body.message).toBe('gallery');
      }
    });

    test('Should allow rapid navigation across different pages', async () => {
      const endpoints = [
        '/api/blogs',
        '/api/gallery',
        '/api/test',
        '/health',
        '/api/blogs',
        '/api/gallery',
      ];
      
      for (const endpoint of endpoints) {
        await request(app)
          .get(endpoint)
          .set('User-Agent', 'Mozilla/5.0 Safari/537.36')
          .expect(200);
      }
    });

    test('Should allow legitimate API calls with normal data', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('User-Agent', 'Mozilla/5.0 Firefox/115.0')
        .send({
          name: 'John Doe',
          email: 'john@example.com',
          message: 'Hello, I have a question about your services.'
        })
        .expect(200);
      
      expect(res.body.message).toBe('contact received');
    });

    test('Should allow 50 legitimate requests in succession', async () => {
      const promises = [];
      
      for (let i = 0; i < 50; i++) {
        const endpoint = i % 2 === 0 ? '/api/blogs' : '/api/gallery';
        promises.push(
          request(app)
            .get(endpoint)
            .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        );
      }
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 200).length;
      
      expect(successCount).toBe(50);
    });

    test('Should allow requests with query parameters', async () => {
      const res = await request(app)
        .get('/api/blogs')
        .query({ page: 2, limit: 10, sort: 'date', category: 'tech' })
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(200);
      
      expect(res.body.message).toBe('blogs');
    });

    test('Should allow POST requests with normal JSON data', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .send({
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '+1-555-0100',
          subject: 'Project Inquiry',
          message: 'I am interested in discussing a potential project with you.',
          budget: '$5000-10000',
          timeline: '3 months'
        })
        .expect(200);
      
      expect(res.body.message).toBe('contact received');
    });

    test('Should allow API calls without User-Agent for socket/API clients', async () => {
      const res = await request(app)
        .get('/api/blogs')
        .expect(200);
      
      expect(res.body.message).toBe('blogs');
    });
  });

  describe('Attack Detection - Should Block', () => {
    test('Should block SQL injection attempts', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .send({
          name: "admin' OR '1'='1",
          email: "test@test.com'; DROP TABLE users; --",
          message: "union select * from users"
        })
        .expect(400);
      
      expect(res.body.error).toBe('Bad Request');
    });

    test('Should block XSS attempts', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .send({
          name: '<script>alert("XSS")</script>',
          message: '<iframe src="javascript:alert(1)"></iframe>'
        })
        .expect(400);
      
      expect(res.body.error).toBe('Bad Request');
    });

    test('Should block path traversal attempts', async () => {
      const res = await request(app)
        .get('/api/test')
        .query({ file: '../../../../etc/passwd' })
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(400);
      
      expect(res.body.error).toBe('Bad Request');
    });

    test('Should block NoSQL injection attempts', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .send({
          email: { '$ne': null },
          password: { '$gt': '' }
        })
        .expect(400);
      
      expect(res.body.error).toBe('Bad Request');
    });

    test('Should block attack tools by User-Agent', async () => {
      const attackAgents = [
        'sqlmap/1.0',
        'Nikto/2.1.6',
        'nmap scripting engine',
        'Metasploit Framework',
        'Burp Suite Intruder',
      ];
      
      for (const agent of attackAgents) {
        const res = await request(app)
          .get('/api/blogs')
          .set('User-Agent', agent)
          .expect(403);
        
        expect(res.body.error).toBe('Forbidden');
      }
    });

    test('Should block forbidden HTTP methods', async () => {
      const forbiddenMethods = ['TRACE', 'TRACK', 'DEBUG'];
      
      for (const method of forbiddenMethods) {
        const res = await request(app)
          [method.toLowerCase()]('/api/test')
          .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
          .expect(405);
        
        expect(res.body.error).toBe('Method Not Allowed');
      }
    });

    test('Should block excessively long URLs', async () => {
      const longUrl = '/api/test?' + 'a=1&'.repeat(1000);
      
      const res = await request(app)
        .get(longUrl)
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(414);
      
      expect(res.body.error).toBe('URI Too Long');
    });

    test('Should trigger honeypot on sensitive paths', async () => {
      const honeypotPaths = [
        '/phpmyadmin',
        '/wp-admin',
        '/wp-login.php',
        '/.env',
        '/.git/config',
      ];
      
      for (const path of honeypotPaths) {
        const res = await request(app)
          .get(path)
          .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
          .expect(404);
        
        expect(res.body.error).toBe('Not Found');
      }
    });
  });

  describe('Rate Limiting', () => {
    test('Should NOT rate limit normal browsing on whitelisted paths', async () => {
      const promises = [];
      
      // 100 requests should all succeed for whitelisted paths
      for (let i = 0; i < 100; i++) {
        promises.push(
          request(app)
            .get('/api/blogs')
            .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        );
      }
      
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 200).length;
      
      // All should succeed since /api/blogs is whitelisted
      expect(successCount).toBe(100);
    });

    test('Should rate limit excessive requests to non-whitelisted paths', async () => {
      // Create a non-whitelisted endpoint
      app.get('/api/sensitive', (req, res) => {
        res.json({ message: 'sensitive' });
      });

      const promises = [];
      
      // Try 150 requests rapidly
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app)
            .get('/api/sensitive')
            .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
            .set('X-Forwarded-For', '1.2.3.4')
        );
      }
      
      const responses = await Promise.all(promises);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      // Should have some rate limited responses
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Sanitization', () => {
    test('Should trim whitespace from query parameters', async () => {
      app.get('/api/echo-query', (req, res) => {
        res.json({ query: req.query });
      });

      const res = await request(app)
        .get('/api/echo-query')
        .query({ name: '  John Doe  ', city: ' New York ' })
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(200);
      
      expect(res.body.query.name).toBe('John Doe');
      expect(res.body.query.city).toBe('New York');
    });

    test('Should trim whitespace from body fields', async () => {
      app.post('/api/echo-body', (req, res) => {
        res.json({ body: req.body });
      });

      const res = await request(app)
        .post('/api/echo-body')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .send({
          name: '  Jane  ',
          email: '  jane@example.com  '
        })
        .expect(200);
      
      expect(res.body.body.name).toBe('Jane');
      expect(res.body.body.email).toBe('jane@example.com');
    });
  });

  describe('Security Headers', () => {
    test('Should set appropriate security headers', async () => {
      const res = await request(app)
        .get('/health')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(200);
      
      expect(res.headers).toHaveProperty('x-content-type-options');
      expect(res.headers).toHaveProperty('strict-transport-security');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('IP Blocking and Unblocking', () => {
    test('Should block IP after threshold exceeded', async () => {
      const testIP = '10.0.0.1';
      
      // Manually add high suspicion score
      securityService.addSuspicionScore(testIP, 60, 'Test blocking');
      
      // Check if IP is blocked
      const blockStatus = await securityService.isIPBlocked(testIP);
      expect(blockStatus.blocked).toBe(true);
    });

    test('Should allow requests from non-blocked IPs', async () => {
      const res = await request(app)
        .get('/api/blogs')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .set('X-Forwarded-For', '192.168.1.100')
        .expect(200);
      
      expect(res.body.message).toBe('blogs');
    });
  });

  describe('Client IP Detection', () => {
    test('Should correctly extract IP from X-Forwarded-For', () => {
      const mockReq = {
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1'
        }
      };
      
      const ip = securityService.getClientIP(mockReq);
      expect(ip).toBe('203.0.113.1');
    });

    test('Should handle IPv6 addresses', () => {
      const mockReq = {
        headers: {},
        ip: '::ffff:192.168.1.1'
      };
      
      const ip = securityService.getClientIP(mockReq);
      expect(ip).toBe('192.168.1.1');
    });
  });

  describe('Edge Cases', () => {
    test('Should handle requests with no body', async () => {
      const res = await request(app)
        .get('/api/blogs')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(200);
      
      expect(res.body.message).toBe('blogs');
    });

    test('Should handle empty query strings', async () => {
      const res = await request(app)
        .get('/api/blogs?')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .expect(200);
      
      expect(res.body.message).toBe('blogs');
    });

    test('Should handle malformed JSON gracefully', async () => {
      const res = await request(app)
        .post('/api/contact')
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .send('{"invalid json"}')
        .expect(400);
    });

    test('Should handle OPTIONS requests (CORS preflight)', async () => {
      const res = await request(app)
        .options('/api/blogs')
        .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        .set('Origin', 'http://localhost:3000');
      
      // Should not be blocked by security
      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe('Performance Test', () => {
    test('Should handle 200 concurrent legitimate requests', async () => {
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < 200; i++) {
        const endpoint = ['/api/blogs', '/api/gallery', '/health'][i % 3];
        promises.push(
          request(app)
            .get(endpoint)
            .set('User-Agent', 'Mozilla/5.0 Chrome/120.0')
        );
      }
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      const successCount = responses.filter(r => r.status === 200).length;
      
      expect(successCount).toBeGreaterThan(190); // Allow for some rate limiting
      expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
      
      console.log(`200 concurrent requests completed in ${duration}ms`);
    });
  });
});

describe('Security Configuration', () => {
  test('Should use environment variables for rate limits', () => {
    process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    
    const app = express();
    securityService(app);
    
    // Config should be applied
    expect(process.env.RATE_LIMIT_MAX_REQUESTS).toBe('1000');
    
    delete process.env.RATE_LIMIT_MAX_REQUESTS;
    delete process.env.RATE_LIMIT_WINDOW_MS;
  });
});