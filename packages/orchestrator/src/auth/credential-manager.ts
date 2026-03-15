import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Credentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  provider: string;
}

export class CredentialManager {
  private configDir: string;
  private credentialsPath: string;

  constructor(customPath?: string) {
    this.configDir = customPath || path.join(os.homedir(), '.apex');
    this.credentialsPath = path.join(this.configDir, 'credentials.json');
    
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  async saveCredentials(provider: string, creds: Credentials): Promise<void> {
    const allCreds = this.loadAll();
    allCreds[provider] = creds;
    fs.writeFileSync(this.credentialsPath, JSON.stringify(allCreds, null, 2), { mode: 0o600 });
  }

  async getCredentials(provider: string): Promise<Credentials | null> {
    const allCreds = this.loadAll();
    return allCreds[provider] || null;
  }

  async deleteCredentials(provider: string): Promise<void> {
    const allCreds = this.loadAll();
    delete allCreds[provider];
    fs.writeFileSync(this.credentialsPath, JSON.stringify(allCreds, null, 2));
  }

  private loadAll(): Record<string, Credentials> {
    if (!fs.existsSync(this.credentialsPath)) {
      return {};
    }
    try {
      const data = fs.readFileSync(this.credentialsPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
}
