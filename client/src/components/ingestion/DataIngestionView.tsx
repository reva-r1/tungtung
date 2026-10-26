import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Dataset } from '../../types';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Layers,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  AlertTriangle
} from 'lucide-react';

import { useInvestigation } from '../../context/InvestigationContext';

export const DataIngestionView: React.FC = () => {
  const { activeDataset, refreshActiveDataset, switchActiveDataset } = useInvestigation();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inspecting, setInspecting] = useState<boolean>(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [committing, setCommitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string; isAll?: boolean } | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Selected Dataset for viewing actual records
  const [viewingDataset, setViewingDataset] = useState<Dataset | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [recordColumns, setRecordColumns] = useState<string[]>([]);
  const [recordsTotal, setRecordsTotal] = useState<number>(0);
  const [recordsLimit, setRecordsLimit] = useState<number>(15);
  const [recordsOffset, setRecordsOffset] = useState<number>(0);
  const [recordsSearch, setRecordsSearch] = useState<string>('');
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);

  const loadDatasets = async () => {
    setLoading(true);
    try {
      const data = await api.getDatasets();
      setDatasets(data);
    } catch (err) {
      console.error('Error fetching datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleProcessFile = async (file: File) => {
    if (!file) return;

    setSelectedFile(file);
    setInspecting(true);
    setPreview(null);
    setIngestSuccess(null);
    setIngestError(null);
    setViewingDataset(null);

    try {
      const result = await api.inspectFile(file);
      setPreview(result);
    } catch (err: any) {
      console.error('File inspect error:', err);
      setIngestError(err.message || 'The file could not be parsed.');
      setSelectedFile(null);
    } finally {
      setInspecting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleProcessFile(file);
    }
    e.target.value = '';
  };

  const handleCommitIngestion = async () => {
    if (!preview) return;
    setCommitting(true);
    setIngestSuccess(null);
    setIngestError(null);
    try {
      const res = await api.commitIngestion({
        datasetName: preview.datasetName,
        format: preview.format,
        rows: preview.allRows || preview.sampleRows,
      });
      setIngestSuccess(`Successfully committed dataset "${preview.datasetName}" (${preview.totalRows} records). Marked as ACTIVE.`);
      setPreview(null);
      setSelectedFile(null);
      await loadDatasets();
      await refreshActiveDataset();
    } catch (err: any) {
      console.error('Ingestion commit error:', err);
      setIngestError(err.message || 'Failed to commit dataset.');
    } finally {
      setCommitting(false);
    }
  };

  const promptDeleteDataset = (datasetId: string, datasetName: string) => {
    setDeleteConfirmTarget({ id: datasetId, name: datasetName, isAll: false });
  };

  const promptDeleteAll = () => {
    setDeleteConfirmTarget({ id: 'ALL', name: 'ALL DATASETS', isAll: true });
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirmTarget) return;
    const { id, name, isAll } = deleteConfirmTarget;
    setDeleteConfirmTarget(null);

    if (isAll) {
      setIsDeleting('ALL');
      setIngestSuccess(null);
      setIngestError(null);
      try {
        await api.deleteAllDatasets();
        setIngestSuccess('All uploaded datasets and intelligence graph data purged successfully.');
        setViewingDataset(null);
        await loadDatasets();
        await refreshActiveDataset();
      } catch (err: any) {
        console.error('Purge all datasets error:', err);
        setIngestError(err.message || 'Failed to purge datasets.');
      } finally {
        setIsDeleting(null);
      }
    } else {
      setIsDeleting(id);
      setIngestSuccess(null);
      setIngestError(null);
      try {
        await api.deleteDataset(id);
        setIngestSuccess(`Dataset "${name}" and its correlated graph nodes were permanently deleted.`);
        if (viewingDataset?.id === id) {
          setViewingDataset(null);
        }
        await loadDatasets();
        await refreshActiveDataset();
      } catch (err: any) {
        console.error('Delete dataset error:', err);
        setIngestError(err.message || 'Failed to delete dataset.');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const loadDatasetRecords = async (dataset: Dataset, offsetVal: number = 0, searchVal: string = '') => {

    setRecordsLoading(true);
    try {
      const result = await api.getDatasetRecords(dataset.id, recordsLimit, offsetVal, searchVal);
      setRecords(result.records);
      setRecordColumns(result.columns);
      setRecordsTotal(result.total);
      setRecordsOffset(offsetVal);
      setViewingDataset(dataset);
      setPreview(null);
      setSelectedFile(null);
    } catch (err) {
      console.error('Error loading dataset records:', err);
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (viewingDataset) {
      loadDatasetRecords(viewingDataset, 0, recordsSearch);
    }
  };

  const clearSelected = () => {
    setPreview(null);
    setSelectedFile(null);
    setIngestError(null);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#0E0F11] font-sans text-xs text-[#E6E7E9]">
      {/* Top Banner */}
      <div className="p-4 bg-[#151618] border-b border-[#26292D] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#4C90F0]" />
            <h1 className="text-sm font-semibold text-[#E6E7E9] tracking-tight">
              Datasets Ledger & Ingestion
            </h1>
          </div>
          <p className="text-[#8B9097] text-xs mt-0.5">
            Ingest and verify multi-format datasets, documents, and scanned manifests into the unified intelligence store.
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Main Section */}
        <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-4">
          {/* Notification Alerts */}
          {ingestSuccess && (
            <div className="p-3 rounded bg-[#151618] border border-[#3DB46D]/40 text-[#3DB46D] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#3DB46D]" />
                <span>{ingestSuccess}</span>
              </div>
              <button onClick={() => setIngestSuccess(null)} className="text-[#8B9097] hover:text-[#E6E7E9]">✕</button>
            </div>
          )}

          {ingestError && (
            <div className="p-3 rounded bg-[#151618] border border-[#E5484D]/40 text-[#E5484D] flex flex-col gap-1 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#E5484D]" />
                  <span className="font-semibold">Import Notice</span>
                </div>
                <button onClick={() => setIngestError(null)} className="text-[#8B9097] hover:text-[#E6E7E9]">✕</button>
              </div>
              <pre className="text-[10px] bg-[#0E0F11] p-2 rounded border border-[#26292D] text-[#E5484D] mt-1 whitespace-pre-wrap font-mono">
                {ingestError}
              </pre>
            </div>
          )}

          {/* Initial File Upload Interface */}
          {!preview && !viewingDataset && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  handleProcessFile(file);
                }
              }}
              className={`flex-1 flex flex-col justify-center items-center min-h-[320px] p-8 rounded border-2 border-dashed transition text-center ${
                isDragging ? 'border-[#4C90F0] bg-[#1a2333]' : 'border-[#26292D] bg-[#151618]'
              }`}
            >
              <div className="w-12 h-12 rounded bg-[#1C1E21] border border-[#26292D] flex items-center justify-center mb-3 text-[#4C90F0]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-[#E6E7E9]">
                Upload Document or Dataset (CSV, PDF, DOCX, Image, Excel)
              </h2>
              <p className="text-[#8B9097] text-xs max-w-md mt-1 mb-5 leading-relaxed">
                Drag and drop or select your files: analytical spreadsheets (.csv), PDF documents, Word field memos (.docx), or scanned stencils (.png, .jpg) to run through the OCR and entity correlation engine.
              </p>

              <div>
                <label htmlFor="document-file-upload" className="cursor-pointer">
                  <span className="px-4 py-2 rounded bg-[#4C90F0] hover:bg-[#3A7FE0] text-white text-xs font-medium transition inline-flex items-center gap-2">
                    <UploadCloud className="w-4 h-4" />
                    Select Document or Dataset
                  </span>
                  <input
                    id="document-file-upload"
                    type="file"
                    accept=".csv,.xlsx,.xls,.json,.pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/pdf,text/csv,image/*,*/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {inspecting && (
                <div className="mt-6 flex items-center gap-2 text-[#4C90F0] text-xs font-mono">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Parsing dataset schema and indexing fields...</span>
                </div>
              )}
            </div>
          )}

          {/* CSV File Preview Interface */}
          {preview && (
            <div className="space-y-5">
              {/* Preview Header Card */}
              <div className="p-5 rounded-lg bg-[#0b1120] border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-bold text-[10px]">
                      PREVIEW
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-wide">{preview.datasetName}</h3>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-2 flex flex-wrap gap-4 font-mono">
                    <span>Dataset Name: <strong className="text-cyan-300">{preview.datasetName}</strong></span>
                    <span>Total Rows: <strong className="text-cyan-300">{preview.totalRows.toLocaleString()}</strong></span>
                    <span>Format: <strong className="text-cyan-300">{preview.format}</strong></span>
                  </div>
                  {preview.ocrMetadata && (
                    <div className="mt-2.5 flex flex-wrap gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono">
                        Engine: {preview.ocrMetadata.engineUsed?.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono">
                        Document Confidence: {Math.round(preview.ocrMetadata.documentConfidence * 100)}%
                      </span>
                      <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono">
                        Pages: {preview.ocrMetadata.totalPages}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={clearSelected}
                    className="px-3.5 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    CANCEL
                  </button>
                  <button
                    onClick={handleCommitIngestion}
                    disabled={committing}
                    className="px-5 py-2 rounded bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 font-bold transition flex items-center gap-2 shadow"
                  >
                    {committing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>STORING RECORDS...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>IMPORT DATA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Data Schema Diagnostics & Statistics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-3.5 rounded bg-[#0f172a] border border-[#1e293b]">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Columns</div>
                  <div className="text-lg font-bold text-slate-200 mt-1">{preview.columns.length}</div>
                </div>
                <div className="p-3.5 rounded bg-[#0f172a] border border-[#1e293b]">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Missing Values Detected</div>
                  <div className={`text-lg font-bold mt-1 ${preview.missingValueCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {preview.missingValueCount}
                  </div>
                </div>
                <div className="p-3.5 rounded bg-[#0f172a] border border-[#1e293b]">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Duplicate Rows</div>
                  <div className={`text-lg font-bold mt-1 ${preview.duplicateRowCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {preview.duplicateRowCount}
                  </div>
                </div>
              </div>

              {/* Detected Column Schema Grid */}
              <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-3">
                <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider block">
                  Column Profiler & Detected Data Types
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {preview.columns.map((col: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-[#090d16] border border-[#1e293b] space-y-1">
                      <div className="font-bold text-slate-300 truncate text-[11px]">{col.name}</div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Type</span>
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/40 text-cyan-400 font-bold font-mono">
                          {col.dataType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Rows Preview Table */}
              <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b] space-y-3">
                <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider block">
                  Raw Records Preview (First {preview.sampleRows.length} Rows)
                </span>
                <div className="overflow-x-auto border border-[#1e293b] rounded">
                  <table className="w-full text-left font-mono text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#090d16] border-b border-[#1e293b] text-slate-400">
                        <th className="py-2 px-3 border-r border-[#1e293b] w-12 text-center">Row</th>
                        {preview.columns.map((col: any) => (
                          <th key={col.name} className="py-2 px-3 border-r border-[#1e293b]">
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="border-b border-[#1e293b] hover:bg-slate-800/40 text-slate-300">
                          <td className="py-1.5 px-3 border-r border-[#1e293b] text-slate-500 text-center">{rIdx + 1}</td>
                          {preview.columns.map((col: any) => (
                            <td key={col.name} className="py-1.5 px-3 border-r border-[#1e293b] truncate max-w-xs">
                              {row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : 'NULL'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Viewing Dataset Raw Records */}
          {viewingDataset && (
            <div className="space-y-4">
              {/* Viewer Header */}
              <div className="p-4 rounded-lg bg-[#0b1120] border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-sm font-bold text-white tracking-wide">{viewingDataset.name}</h3>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      viewingDataset.format === 'SYNTHETIC' 
                        ? 'bg-amber-950 border border-amber-800/40 text-amber-400' 
                        : 'bg-emerald-950 border border-emerald-800/40 text-emerald-400'
                    }`}>
                      {viewingDataset.format === 'SYNTHETIC' ? 'DEMO / SYNTHETIC' : 'USER IMPORTED'}
                    </span>
                  </div>
                  <div className="text-[11px] mt-1.5 text-slate-400 flex flex-wrap gap-4">
                    <span>ID: <strong className="text-slate-300">{viewingDataset.id}</strong></span>
                    <span>Total Stored Records: <strong className="text-cyan-400">{recordsTotal}</strong></span>
                    <span>Uploaded: <strong className="text-slate-300">{new Date(viewingDataset.uploadedAt).toLocaleString()}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => promptDeleteDataset(viewingDataset.id, viewingDataset.name)}
                    disabled={isDeleting === viewingDataset.id}
                    className="px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400 pointer-events-none" />
                    <span>{isDeleting === viewingDataset.id ? 'DELETING...' : 'DELETE DATASET'}</span>
                  </button>

                  <button
                    onClick={() => setViewingDataset(null)}
                    className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-[#1e293b] text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    CLOSE VIEWER
                  </button>
                </div>
              </div>

              {/* Records Filter Search Bar */}
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={recordsSearch}
                    onChange={(e) => setRecordsSearch(e.target.value)}
                    placeholder="Search raw text content in this dataset..."
                    className="w-full pl-9 pr-4 py-2 bg-[#0b1120] border border-[#1e293b] rounded focus:outline-none focus:border-cyan-500 text-xs text-slate-200"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1e293b] hover:bg-slate-700 border border-[#334155] rounded text-slate-200 font-bold transition"
                >
                  SEARCH
                </button>
              </form>

              {/* Data Table */}
              <div className="p-4 rounded-lg bg-[#0f172a] border border-[#1e293b]">
                {recordsLoading ? (
                  <div className="py-20 text-center text-cyan-400 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                    <span>FETCHING STORED DATA RECORDS...</span>
                  </div>
                ) : records.length === 0 ? (
                  <div className="py-20 text-center text-slate-500">
                    No matching records found in this dataset.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto border border-[#1e293b] rounded">
                      <table className="w-full text-left font-mono text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-[#090d16] border-b border-[#1e293b] text-slate-400">
                            <th className="py-2 px-3 border-r border-[#1e293b] w-12 text-center">Row</th>
                            {recordColumns.map((col) => (
                              <th key={col} className="py-2 px-3 border-r border-[#1e293b]">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((r) => (
                            <tr key={r.id} className="border-b border-[#1e293b] hover:bg-slate-800/40 text-slate-300">
                              <td className="py-1.5 px-3 border-r border-[#1e293b] text-slate-500 text-center">{r.rowIndex}</td>
                              {recordColumns.map((col) => (
                                <td key={col} className="py-1.5 px-3 border-r border-[#1e293b] truncate max-w-xs">
                                  {r.data[col] !== null && r.data[col] !== undefined ? String(r.data[col]) : 'NULL'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between border-t border-[#1e293b] pt-3 text-[11px] text-slate-500 font-mono">
                      <div>
                        Showing <strong className="text-slate-300">{recordsOffset + 1}</strong> - <strong className="text-slate-300">{Math.min(recordsOffset + recordsLimit, recordsTotal)}</strong> of <strong className="text-slate-300">{recordsTotal}</strong> records
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={recordsOffset === 0}
                          onClick={() => loadDatasetRecords(viewingDataset!, Math.max(0, recordsOffset - recordsLimit), recordsSearch)}
                          className="p-1 rounded bg-[#090d16] border border-[#1e293b] hover:border-slate-600 disabled:opacity-40 transition"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-300" />
                        </button>
                        <button
                          disabled={recordsOffset + recordsLimit >= recordsTotal}
                          onClick={() => loadDatasetRecords(viewingDataset!, recordsOffset + recordsLimit, recordsSearch)}
                          className="p-1 rounded bg-[#090d16] border border-[#1e293b] hover:border-slate-600 disabled:opacity-40 transition"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Datasets Ledger List Panel */}
        <div className="w-80 bg-[#0b1120] border-l border-[#1e293b] flex flex-col shrink-0 overflow-y-auto p-4 space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#1e293b] pb-2">
            <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>DATASETS LEDGER ({datasets.length})</span>
            </span>

            {datasets.length > 0 && (
              <button
                type="button"
                onClick={promptDeleteAll}
                disabled={isDeleting === 'ALL'}
                className="text-[10px] text-rose-400 hover:text-rose-300 px-1.5 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 transition flex items-center gap-1 cursor-pointer"
                title="Purge all uploaded datasets"
              >
                <Trash2 className="w-3 h-3 text-rose-400 pointer-events-none" />
                <span>PURGE ALL</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 animate-pulse">
              Loading datasets ledger...
            </div>
          ) : datasets.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-[11px]">
              No datasets ingested.
            </div>
          ) : (
            <div className="space-y-2.5">
              {datasets.map((ds) => {
                const isDemo = ds.format === 'SYNTHETIC';
                const isSelected = viewingDataset?.id === ds.id;
                const isItemDeleting = isDeleting === ds.id;

                return (
                  <div
                    key={ds.id}
                    onClick={() => loadDatasetRecords(ds, 0, '')}
                    className={`p-3 rounded border transition cursor-pointer text-left relative group ${
                      isSelected 
                        ? 'bg-[#1e293b]/40 border-cyan-500/50 shadow-md shadow-cyan-950/30' 
                        : 'bg-[#090d16] hover:bg-[#0f172a] border-[#1e293b] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-100 font-bold truncate block flex-1 text-[11px]">{ds.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {ds.isActive || activeDataset?.id === ds.id ? (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-cyan-950 border border-cyan-500/50 text-cyan-300">
                            ACTIVE
                          </span>
                        ) : null}
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          isDemo 
                            ? 'bg-amber-950/80 border border-amber-800/40 text-amber-400' 
                            : 'bg-emerald-950/80 border border-emerald-800/40 text-emerald-400'
                        }`}>
                          {isDemo ? 'DEMO' : 'USER'}
                        </span>
                        <button
                          type="button"
                          data-testid={`delete-dataset-${ds.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            promptDeleteDataset(ds.id, ds.name);
                          }}
                          disabled={isItemDeleting}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                          title={`Delete ${ds.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 pointer-events-none" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 mt-2 font-mono space-y-0.5">
                      <div>Records: <strong className="text-cyan-400">{ds.recordCount}</strong></div>
                      <div>Uploaded: {new Date(ds.uploadedAt).toLocaleDateString()}</div>
                    </div>

                    {!(ds.isActive || activeDataset?.id === ds.id) && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          await switchActiveDataset(ds.id);
                          await loadDatasets();
                        }}
                        className="mt-2 text-[9px] font-bold px-2 py-1 rounded bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/40 text-cyan-300 transition w-full text-center"
                      >
                        SET AS ACTIVE
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#151618] border border-[#26292D] rounded max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#E5484D]">
              <div className="p-2 rounded bg-[#1C1E21] border border-[#26292D]">
                <AlertTriangle className="w-5 h-5 text-[#E5484D]" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#E6E7E9] uppercase tracking-wide">
                  {deleteConfirmTarget.isAll ? 'Purge All Datasets' : 'Delete Dataset'}
                </h3>
                <p className="text-[11px] text-[#8B9097]">Irreversible Action</p>
              </div>
            </div>

            <div className="text-xs text-[#E6E7E9] leading-relaxed bg-[#1C1E21] border border-[#26292D] p-3 rounded">
              {deleteConfirmTarget.isAll ? (
                <span>
                  Are you sure you want to permanently delete <strong className="text-[#E5484D]">ALL uploaded datasets</strong>? This will purge all associated raw records and extracted graph entities.
                </span>
              ) : (
                <span>
                  Are you sure you want to permanently delete dataset <strong className="text-[#4C90F0]">"{deleteConfirmTarget.name}"</strong>? All correlated raw records will be purged.
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-3 py-1.5 rounded bg-[#1C1E21] hover:bg-[#26292D] text-[#8B9097] hover:text-[#E6E7E9] text-xs font-medium border border-[#26292D] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-delete-action-btn"
                onClick={handleExecuteDelete}
                className="px-3 py-1.5 rounded bg-[#E5484D] hover:bg-[#d43d42] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm & Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

