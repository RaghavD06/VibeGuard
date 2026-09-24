import fs from 'fs';
import path from 'path';
import os from 'os';

export const DEFAULT_API_URL = 'https://dmq6n7ylabsgx.cloudfront.net';
export const LEGACY_API_URL = 'https://vibeguard-eep3.onrender.com';

export function normalizeApiUrl(apiUrl?: string): string {
  const configured = (apiUrl || process.env.VIBEGUARD_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
  return configured === LEGACY_API_URL ? DEFAULT_API_URL : configured;
}

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
  return process.env.VIBEGUARD_CONFIG_DIR || path.join(os.homedir(), '.vibeguard');
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
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const credsPath = getCredentialsPath();
  const payload: StoredCredentials = {
    token: creds.token,
    user: creds.user,
    apiUrl: normalizeApiUrl(creds.apiUrl),
    savedAt: new Date().toISOString()
  };

  fs.writeFileSync(credsPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', mode: 0o600 });
  if (process.platform !== 'win32') {
    fs.chmodSync(credsPath, 0o600);
  }
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
    parsed.apiUrl = normalizeApiUrl(parsed.apiUrl);
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
