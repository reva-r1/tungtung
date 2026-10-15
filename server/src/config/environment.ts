import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export type AppEnvironment = 'production' | 'development' | 'test';

export interface EnvironmentConfig {
  nodeEnv: AppEnvironment;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
  port: number;
  dataDir: string;
  databaseFile: string;
  isDemoMode: boolean;
  isMaritimeDemoMode: boolean;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv: AppEnvironment = (process.env.NODE_ENV as AppEnvironment) || 'development';
  const isProduction = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';
  const isDevelopment = !isProduction && !isTest;

  // Strict Fail-Closed Rule: Demo modes are FORBIDDEN in production
  const isDemoMode = !isProduction && process.env.REVANA_DEMO_MODE === 'true';
  const isMaritimeDemoMode = !isProduction && process.env.MARITIME_DEMO_MODE === 'true';

  const defaultDataDir = path.join(process.cwd(), 'data');
  const dataDir = process.env.DATA_DIR || defaultDataDir;
  
  // Test isolation default
  let databaseFile = process.env.DATABASE_FILE || path.join(dataDir, 'aegis_intel.db');
  if (isTest && !process.env.DATABASE_FILE) {
    databaseFile = path.join(dataDir, 'test_aegis_intel.db');
  }

  return {
    nodeEnv,
    isProduction,
    isDevelopment,
    isTest,
    port: Number(process.env.PORT) || 5000,
    dataDir,
    databaseFile,
    isDemoMode,
    isMaritimeDemoMode,
  };
}

export const envConfig = getEnvironmentConfig();

/**
 * Validates environment configuration at startup.
 * Throws on dangerous or invalid configuration.
 */
export function validateEnvironment(): void {
  const config = getEnvironmentConfig();

  if (config.isProduction) {
    if (process.env.REVANA_DEMO_MODE === 'true') {
      throw new Error('[SECURITY FAULT] REVANA_DEMO_MODE=true is strictly forbidden in production mode. System halting.');
    }
    if (process.env.MARITIME_DEMO_MODE === 'true') {
      throw new Error('[SECURITY FAULT] MARITIME_DEMO_MODE=true is strictly forbidden in production mode. System halting.');
    }
    if (config.databaseFile.includes('test_')) {
      throw new Error(`Production environment must not run against a test database: ${config.databaseFile}`);
    }
  }

  console.log(`🛡️ [Environment] Mode: ${config.nodeEnv.toUpperCase()} | Demo Allowed: ${!config.isProduction} | Active Demo Mode: ${config.isDemoMode}`);
}

/**
 * Asserts that the current runtime is not in production mode.
 * Useful as a guard inside test harnesses or demo scripts.
 */
export function assertNotProduction(featureName: string): void {
  if (getEnvironmentConfig().isProduction) {
    throw new Error(`[Security Violation] ${featureName} is strictly forbidden in production environments.`);
  }
}
