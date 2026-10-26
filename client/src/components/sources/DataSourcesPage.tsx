import React, { useState, useEffect } from 'react';
import { useInvestigation } from '../../context/InvestigationContext';
import { api } from '../../services/api';
import { DataSource, SourceInspection, SourceRecord } from '../../types';
import {
  Database,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Table,
  Layers,
  FileText,
  X,
  Play,
} from 'lucide-react';

export const DataSourcesPage: React.FC = () => {
  const { sources, refreshSources, syncSource, syncAllSources, loading } = useInvestigation();
  const [selectedInspection, setSelectedInspection] = useState<SourceInspection | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [rawRecordsSource, setRawRecordsSource] = useState<{ id: string; name: string } | null>(null);
  const [rawRecords, setRawRecords] = useState<SourceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    refreshSources();
  }, []);

  const handleInspect = async (sourceId: string) => {
    setInspectLoading(true);
    try {
      const data = await api.getSourceSchema(sourceId);
      setSelectedInspection(data);
    } catch (err: any) {
      alert(`Inspection failed: ${err.message}`);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleViewRecords = async (sourceId: string, sourceName: string) => {
    setRawRecordsSource({ id: sourceId, name: sourceName });
    setRecordsLoading(true);
    try {
      const data = await api.getSourceRecords(sourceId, 50, 0);
      setRawRecords(data.records);
    } catch (err: any) {
      alert(`Failed to fetch records: ${err.message}`);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleConnect = async (sourceId: string) => {
    try {
      await api.connectSource(sourceId);
      await refreshSources();
    } catch (err: any) {
      alert(`Connection error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 bg-[#0E0F11] p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-sm font-semibold text-[#E6E7E9] flex items-center gap-2">
            <Database className="w-4 h-4 text-[#4C90F0]" />
            Source Database Connections
          </h1>
          <p className="text-xs text-[#8B9097] mt-1">
            Independent SQLite source databases and extraction connectors.
          </p>
        </div>
        <button
          onClick={syncAllSources}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#4C90F0] hover:bg-[#3A7FE0] disabled:opacity-40 text-white rounded text-xs font-medium transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Sync All Sources
        </button>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {sources.map((src) => {
          const isConnected = src.status === 'CONNECTED';
          return (
            <div
              key={src.id}
              className="bg-[#151618] border border-[#26292D] rounded p-4 flex flex-col justify-between hover:border-[#4C90F0]/50 transition"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-[#1C1E21] border border-[#26292D] flex items-center justify-center">
                      <Database className="w-3.5 h-3.5 text-[#4C90F0]" />
                    </div>
                    <div>
                      <h2 className="text-xs font-semibold text-[#E6E7E9]">{src.name}</h2>
                      <span className="font-mono text-[10px] text-[#8B9097]">{src.id}</span>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                      isConnected
                        ? 'bg-[#1C1E21] text-[#3DB46D] border border-[#3DB46D]/40'
                        : 'bg-[#1C1E21] text-[#8B9097] border border-[#26292D]'
                    }`}
                  >
                    {isConnected ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#3DB46D]" /> Connected
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-[#8B9097]" /> Standby
                      </>
                    )}
                  </span>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-3 gap-2 my-3 py-2 px-3 bg-[#1C1E21] rounded border border-[#26292D] text-xs">
                  <div>
                    <div className="text-[10px] text-[#8B9097] uppercase">Engine</div>
                    <div className="font-mono text-[#E6E7E9] font-medium uppercase">{src.dbType}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Tables</div>
                    <div className="font-mono text-slate-300 font-semibold">{src.tableCount}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase">Last Sync</div>
                    <div className="font-mono text-slate-300 text-[11px]">
                      {src.lastSync ? new Date(src.lastSync).toLocaleTimeString() : 'Never'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-[#1e293b]">
                <button
                  onClick={() => handleInspect(src.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  Inspect Schema
                </button>
                <button
                  onClick={() => handleViewRecords(src.id, src.name)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  View Records
                </button>
                <button
                  onClick={() => syncSource(src.id)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1 py-1.5 px-3 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium border border-blue-500/40 transition disabled:opacity-50"
                  title="Synchronize records from this database into the unified model"
                >
                  <Play className="w-3 h-3" />
                  Sync
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schema Inspection Modal / Drawer */}
      {selectedInspection && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-700 rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-slate-200">
                  Schema Inspection: {selectedInspection.sourceName} ({selectedInspection.sourceId})
                </h2>
              </div>
              <button
                onClick={() => setSelectedInspection(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {selectedInspection.tables.map((tbl) => (
                <div key={tbl.tableName} className="border border-slate-800 rounded bg-[#090d16] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      Table: {tbl.tableName}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {tbl.rowCount} total records
                    </span>
                  </div>

                  {/* Columns */}
                  <div className="mb-3">
                    <div className="text-[11px] text-slate-500 mb-1 font-semibold uppercase">Columns:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {tbl.columns.map((c) => (
                        <span
                          key={c.name}
                          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300"
                        >
                          {c.name} <span className="text-slate-500">({c.type})</span>
                          {c.isPrimaryKey && <span className="ml-1 text-amber-400 font-bold">PK</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sample Records */}
                  {tbl.sampleRows.length > 0 && (
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1 font-semibold uppercase">Sample Data:</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px] font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              {tbl.columns.map((c) => (
                                <th key={c.name} className="py-1 px-2">
                                  {c.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tbl.sampleRows.map((r, i) => (
                              <tr key={i} className="border-b border-slate-900 hover:bg-slate-800/40 text-slate-300">
                                {tbl.columns.map((c) => (
                                  <td key={c.name} className="py-1 px-2 truncate max-w-xs">
                                    {r[c.name] !== null && r[c.name] !== undefined ? String(r[c.name]) : 'NULL'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedInspection(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Records Modal */}
      {rawRecordsSource && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1120] border border-slate-700 rounded-lg max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-slate-200">
                  Extracted Raw Records: {rawRecordsSource.name} ({rawRecords.length} records)
                </h2>
              </div>
              <button
                onClick={() => setRawRecordsSource(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {rawRecords.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No records extracted yet. Click "Sync" to ingest records from this source database.
                </div>
              ) : (
                rawRecords.map((rec) => (
                  <div key={rec.id} className="p-3 bg-[#090d16] border border-slate-800 rounded text-xs font-mono">
                    <div className="flex items-center justify-between text-slate-400 mb-1 text-[11px]">
                      <span>
                        Table: <span className="text-blue-400 font-semibold">{rec.sourceTable}</span> | Record PK:{' '}
                        <span className="text-slate-200">{rec.sourceRecordId}</span>
                      </span>
                      <span className="text-slate-500">{new Date(rec.extractedAt).toLocaleString()}</span>
                    </div>
                    <pre className="text-slate-300 bg-slate-900/80 p-2 rounded overflow-x-auto text-[11px]">
                      {JSON.stringify(rec.rawData, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setRawRecordsSource(null)}
                className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
