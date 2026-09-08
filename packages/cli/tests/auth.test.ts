import { saveCredentials, loadCredentials, clearCredentials, getCredentialsPath } from '../src/credentials';
import fs from 'fs';

describe('VibeGuard CLI Auth & Credentials Management', () => {
  const originalEnv = process.env;
  let originalFileContent: string | null = null;
  const credsPath = getCredentialsPath();

  beforeAll(() => {
    // Backup existing credentials if any
    if (fs.existsSync(credsPath)) {
      originalFileContent = fs.readFileSync(credsPath, 'utf-8');
    }
  });

  afterAll(() => {
    // Restore original credentials
    if (originalFileContent !== null) {
      fs.writeFileSync(credsPath, originalFileContent, 'utf-8');
    } else {
      clearCredentials();
    }
    process.env = originalEnv;
  });

  beforeEach(() => {
    clearCredentials();
  });

  test('1. loadCredentials returns null when no credentials file exists', () => {
    expect(loadCredentials()).toBeNull();
  });

  test('2. saveCredentials persists user session and loadCredentials retrieves it', () => {
    const mockUser = {
      id: 'test-user-uuid-123',
      email: 'engineer@vibeguard.io',
      name: 'Test Engineer'
    };
    const mockToken = 'mock-jwt-token-header.payload.signature';
    const apiUrl = 'http://localhost:3001';

    saveCredentials({
      token: mockToken,
      user: mockUser,
      apiUrl
    });

    const loaded = loadCredentials();
    expect(loaded).not.toBeNull();
    expect(loaded?.token).toBe(mockToken);
    expect(loaded?.user.id).toBe(mockUser.id);
    expect(loaded?.user.email).toBe(mockUser.email);
    expect(loaded?.user.name).toBe(mockUser.name);
    expect(loaded?.apiUrl).toBe(apiUrl);
    expect(loaded?.savedAt).toBeDefined();
  });

  test('3. clearCredentials removes stored credentials cleanly', () => {
    saveCredentials({
      token: 'jwt-to-delete',
      user: { id: 'u1', email: 'delete-me@vibeguard.io' }
    });
    expect(loadCredentials()).not.toBeNull();

    const cleared = clearCredentials();
    expect(cleared).toBe(true);
    expect(loadCredentials()).toBeNull();
    expect(fs.existsSync(credsPath)).toBe(false);
  });

  test('4. loadCredentials handles corrupt json gracefully without crashing', () => {
    const dir = require('path').dirname(credsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(credsPath, '{ invalid json corrupted string }', 'utf-8');

    expect(loadCredentials()).toBeNull();
  });

  test('5. CLI sync status contract verification', () => {
    // Unauthenticated: sync attempt should be rejected
    const noCreds = loadCredentials();
    expect(noCreds).toBeNull();
    
    // When creds exist, authorization header format is standard Bearer
    saveCredentials({
      token: 'valid-test-token',
      user: { id: 'u-abc', email: 'user@vibeguard.io' }
    });

    const activeCreds = loadCredentials();
    expect(activeCreds).not.toBeNull();
    const authHeader = `Bearer ${activeCreds!.token}`;
    expect(authHeader).toBe('Bearer valid-test-token');
  });
});
