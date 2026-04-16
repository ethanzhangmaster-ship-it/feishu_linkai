import fs from 'fs';
import path from 'path';
import { AppConfig } from '../types.js';

const CONFIG_PATH = path.join(process.cwd(), 'app-config.json');

export function getAppConfig(): AppConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to read app config", e);
  }
  return null;
}
