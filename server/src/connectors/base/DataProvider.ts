import {
  ProviderMetadata,
  ProviderHealthMetrics,
  NormalizedObservation,
  ProviderHealthState
} from './types.js';

export abstract class DataProvider {
  public readonly metadata: ProviderMetadata;
  protected health: ProviderHealthMetrics;
  
  // Rate limiting & Circuit breaker state
  private tokens: number;
  private lastTokenRefill: number = Date.now();
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private circuitBreakerOpenedAt: number = 0;
  private readonly failureThreshold: number = 3;
  private readonly circuitResetTimeoutMs: number = 30000; // 30s backoff
  
  // In-memory cache for TTL
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();

  constructor(metadata: ProviderMetadata) {
    this.metadata = metadata;
    this.tokens = metadata.rateLimit.requestsPerMinute;
    this.health = {
      status: 'HEALTHY',
      consecutiveFailures: 0,
      lastSuccessfulUpdate: null,
      lastError: null,
      lastErrorTimestamp: null,
      latencyMs: 0,
      recordsReceived: 0,
      recordsRejected: 0,
      recordsNormalized: 0,
      rateLimitRemaining: metadata.rateLimit.requestsPerMinute,
      rateLimitResetEpoch: Math.floor(Date.now() / 1000) + 60,
      stalenessMs: 0,
    };
  }

  public get id(): string {
    return this.metadata.id;
  }

  public get name(): string {
    return this.metadata.name;
  }

  public get category(): string {
    return this.metadata.category;
  }

  public getHealth(): ProviderHealthMetrics {
    const now = Date.now();
    if (this.health.lastSuccessfulUpdate) {
      this.health.stalenessMs = now - new Date(this.health.lastSuccessfulUpdate).getTime();
    } else {
      this.health.stalenessMs = -1; // Never updated
    }
    return { ...this.health };
  }

  /**
   * Refill token bucket for rate limit protection
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastTokenRefill) / 60000;
    if (elapsedMinutes >= 1) {
      this.tokens = this.metadata.rateLimit.requestsPerMinute;
      this.lastTokenRefill = now;
      this.health.rateLimitRemaining = this.tokens;
      this.health.rateLimitResetEpoch = Math.floor(now / 1000) + 60;
    }
  }

  /**
   * Check if rate limit permits request
   */
  protected checkRateLimit(): boolean {
    this.refillTokens();
    if (this.tokens > 0) {
      this.tokens--;
      this.health.rateLimitRemaining = this.tokens;
      return true;
    }
    this.health.status = 'RATE_LIMITED';
    return false;
  }

  /**
   * Circuit breaker validation
   */
  protected isCircuitOpen(): boolean {
    if (this.circuitBreakerState === 'OPEN') {
      const now = Date.now();
      if (now - this.circuitBreakerOpenedAt > this.circuitResetTimeoutMs) {
        this.circuitBreakerState = 'HALF_OPEN';
        this.health.status = 'DEGRADED';
        return false; // Allow a probe request
      }
      return true;
    }
    return false;
  }

  protected recordSuccess(latencyMs: number, receivedCount: number, normalizedCount: number, rejectedCount: number): void {
    this.health.consecutiveFailures = 0;
    this.circuitBreakerState = 'CLOSED';
    this.health.status = 'HEALTHY';
    this.health.lastSuccessfulUpdate = new Date().toISOString();
    this.health.lastError = null;
    this.health.latencyMs = Math.round(this.health.latencyMs === 0 ? latencyMs : (this.health.latencyMs * 0.7 + latencyMs * 0.3));
    this.health.recordsReceived += receivedCount;
    this.health.recordsNormalized += normalizedCount;
    this.health.recordsRejected += rejectedCount;
  }

  protected recordFailure(error: string): void {
    this.health.consecutiveFailures++;
    this.health.lastError = error;
    this.health.lastErrorTimestamp = new Date().toISOString();

    if (this.health.consecutiveFailures >= this.failureThreshold) {
      this.circuitBreakerState = 'OPEN';
      this.circuitBreakerOpenedAt = Date.now();
      this.health.status = 'CIRCUIT_OPEN';
    } else {
      this.health.status = 'DEGRADED';
    }
  }

  /**
   * In-memory TTL cache lookup
   */
  protected getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return cached.data as T;
  }

  protected setCached(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }

  /**
   * Rigorous coordinate validation: Latitude [-90, 90], Longitude [-180, 180]
   */
  public isValidCoordinate(lat: any, lon: any): boolean {
    if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
    const nLat = Number(lat);
    const nLon = Number(lon);
    if (isNaN(nLat) || isNaN(nLon)) return false;
    if (!isFinite(nLat) || !isFinite(nLon)) return false;
    if (nLat < -90 || nLat > 90) return false;
    if (nLon < -180 || nLon > 180) return false;
    return true;
  }

  /**
   * Resilient HTTP fetcher with timeout and auth headers
   */
  protected async secureFetch(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<any> {
    if (this.isCircuitOpen()) {
      throw new Error(`[CircuitBreaker: OPEN] Provider ${this.metadata.id} is temporarily blocked due to repeated failures.`);
    }

    if (!this.checkRateLimit()) {
      throw new Error(`[RateLimit: EXCEEDED] Provider ${this.metadata.id} rate limit exceeded. Backing off.`);
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'AegisIntel-WorldModel/2.0',
      ...(options.headers as Record<string, string> || {})
    };

    // Inject API key if configured
    if (this.metadata.authentication === 'api_key' && this.metadata.envKeyName) {
      const apiKey = process.env[this.metadata.envKeyName];
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 429) {
          this.health.status = 'RATE_LIMITED';
          throw new Error(`Provider returned 429 Too Many Requests`);
        }
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch (_) {
          data = text;
        }
      }

      return { data, latency };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }
      throw err;
    }
  }

  /**
   * Health check implementation
   */
  public async health_check(): Promise<ProviderHealthMetrics> {
    try {
      const pingStart = Date.now();
      const isOk = await this.performHealthPing();
      const latency = Date.now() - pingStart;
      if (isOk) {
        this.health.latencyMs = latency;
        if (this.health.status === 'DOWN' || this.health.status === 'CIRCUIT_OPEN') {
          this.health.status = 'HEALTHY';
        }
      } else {
        this.health.status = 'DEGRADED';
      }
    } catch (err: any) {
      this.recordFailure(err.message || 'Health check failed');
    }
    return this.getHealth();
  }

  protected async performHealthPing(): Promise<boolean> {
    return true;
  }

  /**
   * Core abstraction: fetch raw payload from source
   */
  public abstract fetch(params?: any): Promise<{ rawData: any; latencyMs: number }>;

  /**
   * Core abstraction: normalize provider-specific raw payload to standard NormalizedObservation[]
   */
  public abstract normalize(rawData: any): Promise<NormalizedObservation[]>;
}
