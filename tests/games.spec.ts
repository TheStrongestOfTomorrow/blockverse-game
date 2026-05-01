import { test, expect } from '@playwright/test';

test.describe('Games API', () => {
  test('should list public games', async ({ request }) => {
    const response = await request.get('/api/games');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('games');
    expect(Array.isArray(data.games)).toBeTruthy();
  });

  test('should filter games by category', async ({ request }) => {
    const response = await request.get('/api/games?category=sandbox');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('games');
  });

  test('should return pagination info', async ({ request }) => {
    const response = await request.get('/api/games');
    const data = await response.json();
    expect(data).toHaveProperty('total');
  });

  test('should require auth to create game', async ({ request }) => {
    const response = await request.post('/api/games', {
      data: {
        name: 'Test Game',
        description: 'Test',
        category: 'sandbox',
        template: 'flat',
      },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Auth API', () => {
  test('should return 401 when not authenticated', async ({ request }) => {
    const response = await request.get('/api/auth/me');
    expect(response.status()).toBe(401);
  });

  test('should signup a new user', async ({ request }) => {
    const uniqueUsername = `api_${Date.now()}`;
    const response = await request.post('/api/auth/signup', {
      data: {
        username: uniqueUsername,
        password: 'testpass123',
      },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data).toHaveProperty('username', uniqueUsername);
    expect(data).not.toHaveProperty('passwordHash');
  });

  test('should reject short username on signup', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {
        username: 'ab', // Less than 3 chars
        password: 'testpass123',
      },
    });
    expect(response.status()).toBe(400);
  });

  test('should reject short password on signup', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {
        username: 'validuser123',
        password: '12345', // Less than 6 chars
      },
    });
    expect(response.status()).toBe(400);
  });

  test('should reject invalid username characters on signup', async ({ request }) => {
    const response = await request.post('/api/auth/signup', {
      data: {
        username: 'invalid user!',
        password: 'testpass123',
      },
    });
    expect(response.status()).toBe(400);
  });

  test('should reject duplicate username on signup', async ({ request }) => {
    const uniqueUsername = `dup_${Date.now()}`;
    // First signup
    await request.post('/api/auth/signup', {
      data: { username: uniqueUsername, password: 'testpass123' },
    });
    // Second signup with same username
    const response = await request.post('/api/auth/signup', {
      data: { username: uniqueUsername, password: 'testpass123' },
    });
    expect(response.status()).toBe(409);
  });

  test('should login with valid credentials', async ({ request }) => {
    const uniqueUsername = `lp${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    // Signup first
    const signupRes = await request.post('/api/auth/signup', {
      data: { username: uniqueUsername, password: 'testpass123' },
    });
    if (signupRes.status() !== 201) {
      const errBody = await signupRes.json();
      console.log('Signup failed:', errBody, 'username:', uniqueUsername);
    }
    expect(signupRes.status()).toBe(201);
    // Login
    const response = await request.post('/api/auth/login', {
      data: { username: uniqueUsername, password: 'testpass123' },
    });
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('username', uniqueUsername);
  });

  test('should reject wrong password on login', async ({ request }) => {
    const uniqueUsername = `wrongapi_${Date.now()}`;
    await request.post('/api/auth/signup', {
      data: { username: uniqueUsername, password: 'correctpass1' },
    });
    const response = await request.post('/api/auth/login', {
      data: { username: uniqueUsername, password: 'wrongpass1' },
    });
    expect(response.status()).toBe(401);
  });

  test('should reject non-existent user on login', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { username: 'nonexistent_user_xyz', password: 'testpass123' },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe('Friends API', () => {
  test('should require auth to list friends', async ({ request }) => {
    const response = await request.get('/api/friends');
    expect(response.status()).toBe(401);
  });
});
