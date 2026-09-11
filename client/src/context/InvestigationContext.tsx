import React, { createContext, useContext, useState, useEffect } from 'react';
import { Entity, Investigation, Anomaly, TimelineEvent, LocationRecord, GraphData, DataSource, Dataset } from '../types';
import { api } from '../services/api';

export type ActiveView = 
  | 'overview'
  | 'sources'
  | 'entities'
  | 'investigation'
  | 'graph'
  | 'map'
  | 'resolution'
  | 'dashboard'
  | 'anomalies'
  | 'explorer'
  | 'ingestion'
  | 'ai-analyst'
  | 'entity-profile';

interface InvestigationContextType {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  selectedEntityId: string | null;
  selectedEntity: Entity | null;
  selectEntity: (id: string | null) => void;
  activeInvestigationId: string | null;
  activeInvestigation: Investigation | null;
  setActiveInvestigationId: (id: string | null) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  quickNavigateToEntity: (entityId: string, view?: ActiveView) => void;
  activeNlResult: any | null;
  setActiveNlResult: (res: any | null) => void;
  aiStatus: any | null;
  sources: DataSource[];
  sourceFilter: string[];
  toggleSourceFilter: (sourceId: string) => void;
  setSourceFilter: (sources: string[]) => void;
  refreshSources: () => Promise<void>;
  syncSource: (sourceId: string) => Promise<void>;
  syncAllSources: () => Promise<void>;
  loading: boolean;
  setLoading: (l: boolean) => void;
  activeDataset: Dataset | null;
  refreshActiveDataset: () => Promise<void>;
  switchActiveDataset: (id: string) => Promise<void>;
}

const InvestigationContext = createContext<InvestigationContextType | undefined>(undefined);

export const InvestigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [activeInvestigationId, setActiveInvestigationId] = useState<string | null>(null);
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [activeNlResult, setActiveNlResult] = useState<any | null>(null);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeDataset, setActiveDatasetState] = useState<Dataset | null>(null);

  const refreshActiveDataset = async () => {
    try {
      const active = await api.getActiveDataset();
      setActiveDatasetState(active);
    } catch (err) {
      console.error('Error fetching active dataset:', err);
    }
  };

  const switchActiveDataset = async (id: string) => {
    setLoading(true);
    try {
      const updated = await api.setActiveDataset(id);
      setActiveDatasetState(updated);
    } catch (err) {
      console.error('Error switching active dataset:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshSources = async () => {
    try {
      const list = await api.getSources();
      setSources(list);
    } catch (err) {
      console.error('Error fetching sources:', err);
    }
  };

  const syncSource = async (sourceId: string) => {
    setLoading(true);
    try {
      await api.syncSource(sourceId);
      await refreshSources();
      if (selectedEntityId) await fetchSelectedEntity(selectedEntityId);
    } catch (err) {
      console.error(`Error syncing source ${sourceId}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const syncAllSources = async () => {
    setLoading(true);
    try {
      await api.syncAllSources();
      await refreshSources();
      if (selectedEntityId) await fetchSelectedEntity(selectedEntityId);
    } catch (err) {
      console.error('Error syncing all sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSourceFilter = (sourceId: string) => {
    setSourceFilter((prev) =>
      prev.includes(sourceId) ? prev.filter((s) => s !== sourceId) : [...prev, sourceId]
    );
  };

  const fetchSelectedEntity = async (id: string) => {
    try {
      const res = await api.getEntityProfile(id);
      if (res && res.entity) {
        setSelectedEntity({
          ...res.entity,
          provenance: res.provenance,
        });
      }
    } catch (err) {
      console.error('Error fetching entity profile:', err);
    }
  };

  const fetchActiveInvestigation = async (id: string) => {
    try {
      const res = await api.getInvestigation(id);
      setActiveInvestigation(res);
    } catch (err) {
      console.error('Error fetching investigation:', err);
    }
  };

  useEffect(() => {
    refreshSources();
    refreshActiveDataset();
  }, []);

  useEffect(() => {
    if (selectedEntityId) {
      fetchSelectedEntity(selectedEntityId);
    } else {
      setSelectedEntity(null);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    if (activeInvestigationId) {
      fetchActiveInvestigation(activeInvestigationId);
    } else {
      setActiveInvestigation(null);
    }
  }, [activeInvestigationId]);

  const selectEntity = (id: string | null) => {
    setSelectedEntityId(id);
  };

  const quickNavigateToEntity = (entityId: string, targetView: ActiveView = 'entities') => {
    setSelectedEntityId(entityId);
    setActiveView(targetView);
  };

  return (
    <InvestigationContext.Provider
      value={{
        activeView,
        setActiveView,
        selectedEntityId,
        selectedEntity,
        selectEntity,
        activeInvestigationId,
        activeInvestigation,
        setActiveInvestigationId,
        globalSearchQuery,
        setGlobalSearchQuery,
        quickNavigateToEntity,
        activeNlResult,
        setActiveNlResult,
        aiStatus: null,
        sources,
        sourceFilter,
        toggleSourceFilter,
        setSourceFilter,
        refreshSources,
        syncSource,
        syncAllSources,
        loading,
        setLoading,
        activeDataset,
        refreshActiveDataset,
        switchActiveDataset,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
};

export const useInvestigation = () => {
  const context = useContext(InvestigationContext);
  if (!context) throw new Error('useInvestigation must be used within an InvestigationProvider');
  return context;
};
