import React from 'react';
import { InvestigationProvider, useInvestigation } from './context/InvestigationContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewPage } from './components/overview/OverviewPage';
import { DataSourcesPage } from './components/sources/DataSourcesPage';
import { InvestigationPage } from './components/investigation/InvestigationPage';
import { EntityProfileView } from './components/entities/EntityProfileView';
import { EntityGraph } from './components/graph/EntityGraph';
import { TacticalMap } from './components/map/TacticalMap';
import { EntityResolutionView } from './components/resolution/EntityResolutionView';
import { DataIngestionView } from './components/ingestion/DataIngestionView';

const MainContent: React.FC = () => {
  const { activeView } = useInvestigation();

  return (
    <div className="flex-1 flex overflow-hidden">
      {activeView === 'overview' && <OverviewPage />}
      {activeView === 'sources' && <DataSourcesPage />}
      {activeView === 'ingestion' && <DataIngestionView />}
      {activeView === 'investigation' && <InvestigationPage />}
      {activeView === 'entities' && <EntityProfileView />}
      {activeView === 'graph' && (
        <div className="flex-1 p-4 bg-[#090d16]">
          <EntityGraph />
        </div>
      )}
      {activeView === 'map' && (
        <div className="flex-1 p-4 bg-[#090d16]">
          <TacticalMap />
        </div>
      )}
      {activeView === 'resolution' && <EntityResolutionView />}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <InvestigationProvider>
      <div className="flex flex-col h-screen w-screen bg-[#090d16] text-[#e2e8f0] overflow-hidden font-sans select-none">
        <Header />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <MainContent />
        </div>
      </div>
    </InvestigationProvider>
  );
};

export default App;
