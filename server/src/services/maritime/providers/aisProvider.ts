import { AisVesselRawUpdate } from '../../../types/index.js';

export interface AisProviderStatus {
  connected: boolean;
  source: string;
  mode: 'LIVE_STREAM' | 'REPLAY_FEED';
  messageCount: number;
  lastMessageAt?: string;
  error?: string;
}

export interface AisProvider {
  name: string;
  connect(onUpdate: (update: AisVesselRawUpdate) => void): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): AisProviderStatus;
}
