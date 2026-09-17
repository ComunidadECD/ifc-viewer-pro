import React from 'react';
import { IFCModelMetadata, IFCElementData } from '../types/ifc';
import { BarChart3, X, FileSpreadsheet, Download, Layers, Box, Cpu, HardDrive } from 'lucide-react';
import { exportModelToExcel, exportModelToCSV, exportModelToJSON, downloadFile } from '../services/exporter';

interface StatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: IFCModelMetadata | null;
  elements: Map<number, IFCElementData>;
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export const StatisticsModal: React.FC<StatisticsModalProps> = ({
  isOpen,
  onClose,
  metadata,
  elements
}) => {
  if (!isOpen || !metadata) return null;

  const handleExportExcel = () => {
    const buffer = exportModelToExcel(metadata, elements);
    const outName = `${metadata.fileName.replace(/\.ifc$/i, '')}_parametros.xlsx`;
    downloadFile(buffer, outName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleExportCSV = () => {
    const csv = exportModelToCSV(elements);
    const outName = `${metadata.fileName.replace(/\.ifc$/i, '')}_elementos.csv`;
    downloadFile(csv, outName, 'text/csv');
  };

  const handleExportJSON = () => {
    const json = exportModelToJSON(metadata, elements);
    const outName = `${metadata.fileName.replace(/\.ifc$/i, '')}_completo.json`;
    downloadFile(json, outName, 'application/json');
  };

  const sortedCategories = Object.entries(metadata.categories).sort((a, b) => (b[1] as number) - (a[1] as number));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bim-900 border border-bim-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-bim-800 bg-bim-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <BarChart3 size={18} />
            <span>Estadísticas & Resumen del Modelo BIM</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-bim-950/60 border border-bim-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs uppercase font-semibold">Esquema IFC</span>
                <Cpu size={16} className="text-cyan-400" />
              </div>
              <div className="text-xl font-extrabold text-cyan-300 font-mono">{metadata.schema}</div>
            </div>

            <div className="bg-bim-950/60 border border-bim-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs uppercase font-semibold">Total Elementos</span>
                <Box size={16} className="text-indigo-400" />
              </div>
              <div className="text-xl font-extrabold text-white font-mono">{metadata.totalElements}</div>
            </div>

            <div className="bg-bim-950/60 border border-bim-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs uppercase font-semibold">Niveles / Pisos</span>
                <Layers size={16} className="text-emerald-400" />
              </div>
              <div className="text-xl font-extrabold text-emerald-300 font-mono">{metadata.storeys.length}</div>
            </div>

            <div className="bg-bim-950/60 border border-bim-800 p-4 rounded-xl">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs uppercase font-semibold">Tamaño Archivo</span>
                <HardDrive size={16} className="text-amber-400" />
              </div>
              <div className="text-xl font-extrabold text-amber-300 font-mono">{formatBytes(metadata.fileSize)}</div>
            </div>
          </div>

          {/* Categories Breakdown */}
          <div className="bg-bim-950/40 border border-bim-800 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Desglose de Elementos por Categoría IFC
            </h4>

            <div className="space-y-2">
              {sortedCategories.map(([cat, count]) => {
                const numCount = count as number;
                const percent = metadata.totalElements > 0 ? ((numCount / metadata.totalElements) * 100).toFixed(1) : '0';
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-300">{cat}</span>
                      <span className="font-mono text-cyan-400 font-semibold">{numCount} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-bim-900 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Storeys Breakdown */}
          <div className="bg-bim-950/40 border border-bim-800 p-4 rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Distribución por Niveles / Pisos
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {metadata.storeys.map(s => (
                <div key={s.name} className="flex justify-between items-center p-3 bg-bim-900/60 border border-bim-800 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-indigo-400" />
                    <span className="font-semibold text-slate-200">{s.name}</span>
                  </div>
                  <span className="font-mono text-cyan-300 font-bold">{s.elementCount} elementos</span>
                </div>
              ))}
            </div>
          </div>

          {/* Export Actions */}
          <div className="bg-bim-950/80 border border-bim-800 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white mb-0.5">Exportación de Datos BIM</h4>
              <p className="text-xs text-slate-400">
                Descarga la totalidad de parámetros, Psets y Qto del modelo completo.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportExcel}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20 transition"
              >
                <FileSpreadsheet size={15} />
                <span>Exportar Excel (.xlsx)</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-bim-800 hover:bg-bim-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <Download size={14} />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-bim-800 hover:bg-bim-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <Download size={14} />
                <span>JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
