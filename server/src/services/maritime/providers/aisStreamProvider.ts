import { AisProvider, AisProviderStatus } from './aisProvider.js';
import { AisVesselRawUpdate } from '../../../types/index.js';

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

export class AisStreamProvider implements AisProvider {
  name = 'AISStream.io (Live Global WebSocket)';
  private ws: any = null;
  private apiKey: string;
  private onUpdateCallback: ((update: AisVesselRawUpdate) => void) | null = null;
  private isRunning = false;
  private messageCount = 0;
  private lastMessageAt?: string;
  private lastError?: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.AISSTREAM_API_KEY || '';
  }

  async connect(onUpdate: (update: AisVesselRawUpdate) => void): Promise<void> {
    this.onUpdateCallback = onUpdate;
    this.isRunning = true;
    this.initWebSocket();
  }

  private initWebSocket() {
    if (!this.isRunning) return;

    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey.includes('your_')) {
      this.lastError = 'AISSTREAM_API_KEY not configured';
      return;
    }

    try {
      // Use Node native WebSocket
      const wsClass = (globalThis as any).WebSocket;
      if (!wsClass) {
        this.lastError = 'WebSocket client unavailable in runtime';
        return;
      }

      this.ws = new wsClass(AISSTREAM_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.lastError = undefined;

        // Regional bounding box: Indian Ocean / Arabian Sea / Bay of Bengal / Malacca
        const latMin = Number(process.env.AIS_BBOX_LAT_MIN ?? 0.0);
        const latMax = Number(process.env.AIS_BBOX_LAT_MAX ?? 26.0);
        const lonMin = Number(process.env.AIS_BBOX_LON_MIN ?? 60.0);
        const lonMax = Number(process.env.AIS_BBOX_LON_MAX ?? 105.0);

        // Send AISStream subscription envelope
        const subscription = {
          APIKey: this.apiKey,
          BoundingBoxes: [[[latMin, lonMin], [latMax, lonMax]]],
          FilterMessageTypes: [
            'PositionReport',
            'StandardClassBPositionReport',
            'ExtendedClassBPositionReport',
            'ShipStaticData',
            'StaticDataReport',
          ],
        };

        this.ws.send(JSON.stringify(subscription));
      };

      this.ws.onmessage = async (event: any) => {
        try {
          let raw: string;
          if (typeof event.data === 'string') {
            raw = event.data;
          } else if (event.data instanceof Blob) {
            raw = await event.data.text();
          } else if (Buffer.isBuffer(event.data)) {
            raw = event.data.toString('utf-8');
          } else if (event.data instanceof ArrayBuffer) {
            raw = Buffer.from(event.data).toString('utf-8');
          } else {
            raw = String(event.data);
          }
          const envelope = JSON.parse(raw);
          this.handleEnvelope(envelope);
        } catch (_) { }
      };

      this.ws.onerror = (err: any) => {
        this.lastError = err?.message || 'AISStream WebSocket error';
      };

      this.ws.onclose = () => {
        if (this.isRunning) {
          const backoff = Math.min(30000, 2000 * Math.pow(1.5, this.reconnectAttempts++));
          this.reconnectTimer = setTimeout(() => this.initWebSocket(), backoff);
        }
      };
    } catch (err: any) {
      this.lastError = err?.message || 'Failed to initialize WebSocket';
    }
  }

  private handleEnvelope(envelope: any) {
    const messageType = envelope?.MessageType;
    const message = envelope?.Message?.[messageType] || {};
    const metadata = envelope?.MetaData || envelope?.Metadata || {};

    const mmsi = String(metadata.MMSI ?? message.UserID ?? message.UserId ?? message.Mmsi ?? '').trim();
    if (!mmsi) return;

    const lat = Number(metadata.latitude ?? metadata.Latitude ?? message.Latitude);
    const lon = Number(metadata.longitude ?? metadata.Longitude ?? message.Longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    this.messageCount++;
    this.lastMessageAt = new Date().toISOString();

    const speed = message.Sog != null ? Number(message.Sog) : (message.SOG != null ? Number(message.SOG) : undefined);
    const course = message.Cog != null ? Number(message.Cog) : (message.COG != null ? Number(message.COG) : undefined);
    const heading = message.TrueHeading != null ? Number(message.TrueHeading) : (message.Heading != null ? Number(message.Heading) : undefined);

    let etaStr: string | undefined = undefined;
    if (message.Eta) {
      if (typeof message.Eta === 'object' && message.Eta.Month && message.Eta.Day) {
        etaStr = `${message.Eta.Month}/${message.Eta.Day} ${message.Eta.Hour ?? 0}:${String(message.Eta.Minute ?? 0).padStart(2, '0')} UTC`;
      } else {
        etaStr = String(message.Eta).trim() || undefined;
      }
    }

    const shipName = metadata.ShipName ? String(metadata.ShipName).trim() : (message.Name ? String(message.Name).trim() : undefined);

    const update: AisVesselRawUpdate = {
      mmsi,
      imo: message.ImoNumber ? String(message.ImoNumber) : (message.IMO ? String(message.IMO) : undefined),
      name: shipName,
      type: message.Type != null ? `Type ${message.Type}` : (message.ShipType ? String(message.ShipType) : undefined),
      latitude: lat,
      longitude: lon,
      speed: Number.isFinite(speed) && (speed as number) < 102 ? speed : undefined,
      course: Number.isFinite(course) && (course as number) < 360 ? course : undefined,
      heading: Number.isFinite(heading) && (heading as number) < 360 && (heading as number) !== 511 ? heading : undefined,
      destination: message.Destination ? String(message.Destination).trim() : undefined,
      eta: etaStr,
      timestamp: metadata.time_utc || new Date().toISOString(),
    };

    if (this.onUpdateCallback) {
      this.onUpdateCallback(update);
    }
  }

  async disconnect(): Promise<void> {
    this.isRunning = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (_) { }
      this.ws = null;
    }
  }

  getStatus(): AisProviderStatus {
    return {
      connected: this.ws && this.ws.readyState === 1,
      source: this.name,
      mode: 'LIVE_STREAM',
      messageCount: this.messageCount,
      lastMessageAt: this.lastMessageAt,
      error: this.lastError || (!this.apiKey || this.apiKey.trim() === '' ? 'AISSTREAM_API_KEY not configured' : undefined),
    };
  }
}
