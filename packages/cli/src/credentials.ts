import fs from 'fs';
import path from 'path';
import os from 'os';

export interface StoredCredentials {
  token: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  apiUrl: string;
  savedAt: string;
}

export function getCredentialsDir(): string {
  return path.join(os.homedir(), '.vibeguard');
}

export function getCredentialsPath(): string {
  return path.join(getCredentialsDir(), 'credentials.json');
}

export function saveCredentials(creds: {
  token: string;
  user: { id: string; email: string; name?: string | null };
  apiUrl?: string;
}): void {
  const dir = getCredentialsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const credsPath = getCredentialsPath();
  const payload: StoredCredentials = {
    token: creds.token,
    user: creds.user,
    apiUrl: creds.apiUrl || process.env.VIBEGUARD_API_URL || 'http://localhost:3001',
    savedAt: new Date().toISOString()
  };

  fs.writeFileSync(credsPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function loadCredentials(): StoredCredentials | null {
  const credsPath = getCredentialsPath();
  if (!fs.existsSync(credsPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(credsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.token || !parsed.user?.email) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCredentials(): boolean {
  const credsPath = getCredentialsPath();
  if (fs.existsSync(credsPath)) {
    try {
      fs.unlinkSync(credsPath);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
