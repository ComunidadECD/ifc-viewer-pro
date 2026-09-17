import React, { useRef } from 'react';
import {
  FolderOpen,
  FileSpreadsheet,
  Search,
  BarChart3,
  Camera,
  Layers,
  Sliders
} from 'lucide-react';
import { LoadedIFCModel } from '../types/ifc';
import { SAMPLE_IFC_2X3 } from '../samples/sampleIfc2x3';
import { SAMPLE_IFC_4 } from '../samples/sampleIfc4';

interface ToolbarProps {
  model: LoadedIFCModel | null;
  onOpenIFCFile: (fileData: Uint8Array, fileName: string) => void;
  onOpenSearch: () => void;
  onOpenStats: () => void;
  onExportExcel: () => void;
  onTakeScreenshot: () => void;
  showLeftPanel: boolean;
  setShowLeftPanel: (v: boolean | ((prev: boolean) => boolean)) => void;
  showRightPanel: boolean;
  setShowRightPanel: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  model,
  onOpenIFCFile,
  onOpenSearch,
  onOpenStats,
  onExportExcel,
  onTakeScreenshot,
  showLeftPanel,
  setShowLeftPanel,
  showRightPanel,
  setShowRightPanel
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNativeOpen = async () => {
    if (window.electronAPI?.openIFCDialog) {
      const res = await window.electronAPI.openIFCDialog();
      if (res && res.buffer) {
        onOpenIFCFile(new Uint8Array(res.buffer), res.fileName);
        return;
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        onOpenIFCFile(new Uint8Array(buffer), file.name);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const loadSample = (type: '2x3' | '4') => {
    const text = type === '2x3' ? SAMPLE_IFC_2X3 : SAMPLE_IFC_4;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const fileName = type === '2x3' ? 'Muestra_Edificio_IFC2X3.ifc' : 'Muestra_Complejo_IFC4.ifc';
    onOpenIFCFile(data, fileName);
  };

  return (
    <div className="h-14 bg-bim-900 border-b border-bim-800 px-4 flex items-center justify-between select-none z-30 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".ifc"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Left: App Logo & Open IFC */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-sm">
            IFC
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>Visualizador IFC Pro</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded">
                2.3 & 4
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 leading-none">
              {model ? `${model.metadata.fileName} (${model.metadata.schema})` : 'Visor BIM Local Nativo'}
            </p>
          </div>
        </div>

        <button
          onClick={handleNativeOpen}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-900/30 transition active:scale-95"
        >
          <FolderOpen size={16} />
          <span>Abrir Archivo IFC</span>
        </button>

        {/* Sample Loaders */}
        <div className="hidden lg:flex items-center gap-1 bg-bim-950/80 p-1 rounded-xl border border-bim-800 text-[11px]">
          <span className="text-slate-500 px-2 font-semibold">Ejemplos:</span>
          <button
            onClick={() => loadSample('2x3')}
            className="px-2.5 py-1 bg-bim-800 hover:bg-bim-700 text-slate-300 hover:text-white rounded-lg font-medium transition"
          >
            IFC 2.3
          </button>
          <button
            onClick={() => loadSample('4')}
            className="px-2.5 py-1 bg-bim-800 hover:bg-bim-700 text-slate-300 hover:text-white rounded-lg font-medium transition"
          >
            IFC 4
          </button>
        </div>
      </div>

      {/* Middle & Right: Actions & Tools */}
      <div className="flex items-center gap-2">
        {model && (
          <>
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bim-800 hover:bg-bim-750 text-slate-200 rounded-xl text-xs font-semibold transition"
              title="Buscar elementos por cualquier parámetro"
            >
              <Search size={14} className="text-cyan-400" />
              <span className="hidden sm:inline">Buscar</span>
            </button>

            <button
              onClick={onOpenStats}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bim-800 hover:bg-bim-750 text-slate-200 rounded-xl text-xs font-semibold transition"
              title="Ver estadísticas y desglose de clases"
            >
              <BarChart3 size={14} className="text-indigo-400" />
              <span className="hidden sm:inline">Estadísticas</span>
            </button>

            <button
              onClick={onExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-sm"
              title="Exportar todos los parámetros a Excel (.xlsx)"
            >
              <FileSpreadsheet size={14} />
              <span className="hidden md:inline">Exportar Excel</span>
            </button>

            <button
              onClick={onTakeScreenshot}
              className="p-2 bg-bim-800 hover:bg-bim-750 text-slate-300 hover:text-white rounded-xl transition"
              title="Capturar pantalla en HD"
            >
              <Camera size={16} />
            </button>
          </>
        )}

        <div className="h-5 w-[1px] bg-bim-800 mx-1" />

        {/* Panel Toggles */}
        <button
          onClick={() => setShowLeftPanel(prev => !prev)}
          className={`p-2 rounded-xl transition ${showLeftPanel ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'bg-bim-800 text-slate-400 hover:text-white'}`}
          title="Alternar Árbol Espacial"
        >
          <Layers size={16} />
        </button>

        <button
          onClick={() => setShowRightPanel(prev => !prev)}
          className={`p-2 rounded-xl transition ${showRightPanel ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30' : 'bg-bim-800 text-slate-400 hover:text-white'}`}
          title="Alternar Panel de Parámetros"
        >
          <Sliders size={16} />
        </button>
      </div>
    </div>
  );
};
