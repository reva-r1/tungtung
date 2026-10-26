import React from 'react';
import { InvestigationProvider, useInvestigation } from './context/InvestigationContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewPage } from './components/overview/OverviewPage';
import { DataSourcesPage } from './components/sources/DataSourcesPage';
import { GraphInvestigationDashboard } from './components/investigation/GraphInvestigationDashboard';
import { EntityProfileView } from './components/entities/EntityProfileView';
import { TacticalMap } from './components/map/TacticalMap';
import { EntityResolutionView } from './components/resolution/EntityResolutionView';
import { DataIngestionView } from './components/ingestion/DataIngestionView';
import { DigitalMirrorView } from './components/mirror/DigitalMirrorView';
import { DockedAiPanel } from './components/ai/DockedAiPanel';

const MainContent: React.FC = () => {
  const { activeView } = useInvestigation();

  return (
    <main className="flex-1 flex overflow-hidden bg-[#080D16] relative">
      {activeView === 'overview' && <OverviewPage />}
      {activeView === 'mirror' && <DigitalMirrorView />}
      {activeView === 'sources' && <DataSourcesPage />}
      {activeView === 'ingestion' && <DataIngestionView />}
      {activeView === 'investigation' && <GraphInvestigationDashboard />}
      {activeView === 'entities' && <EntityProfileView />}
      {activeView === 'graph' && <GraphInvestigationDashboard />}
      {activeView === 'map' && (
        <div className="flex-1 h-full w-full bg-[#080D16] overflow-hidden relative">
          <TacticalMap />
        </div>
      )}
      {activeView === 'resolution' && <EntityResolutionView />}
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <InvestigationProvider>
      <div className="flex flex-col h-screen w-screen bg-[#080D16] text-[#E6EDF7] overflow-hidden font-sans select-none relative">
        <Header />
        <div className="flex-1 flex overflow-hidden relative">
          <Sidebar />
          <MainContent />
          <DockedAiPanel />
        </div>
      </div>
    </InvestigationProvider>
  );
};

export default App;
