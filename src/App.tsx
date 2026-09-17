import React, { useState, useRef } from 'react';
import { Viewer3D, Viewer3DRef } from './components/Viewer3D';
import { HierarchyTree } from './components/HierarchyTree';
import { PropertyPanel } from './components/PropertyPanel';
import { Toolbar } from './components/Toolbar';
import { SearchModal } from './components/SearchModal';
import { StatisticsModal } from './components/StatisticsModal';
import { ColorFilterModal } from './components/ColorFilterModal';
import { loadIFCFile } from './services/ifcLoader';
import { exportModelToExcel, downloadFile } from './services/exporter';
import { LoadedIFCModel, ColorMode, IFCElementData } from '../src/types/ifc';
import { Loader2, FolderOpen, Box } from 'lucide-react';

export const App: React.FC = () => {
  const [models, setModels] = useState<LoadedIFCModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<ColorMode>('category');
  const [hiddenNodeIds, setHiddenNodeIds] = useState<Set<string>>(new Set());

  const [loadingProgress, setLoadingProgress] = useState<{ active: boolean; stage: string; percent: number }>({
    active: false,
    stage: '',
    percent: 0
  });

  const [showLeftPanel, setShowLeftPanel] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [statsModalOpen, setStatsModalOpen] = useState<boolean>(false);
  const [colorFilterModalOpen, setColorFilterModalOpen] = useState<boolean>(false);

  const viewerRef = useRef<Viewer3DRef>(null);

  // Load an IFC file and append it to the federated models list
  const handleOpenIFC = async (fileData: Uint8Array, fileName: string) => {
    try {
      setLoadingProgress({ active: true, stage: `Cargando ${fileName}...`, percent: 10 });

      const modelId = 'model_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const loadedModel = await loadIFCFile(fileData, fileName, modelId, (stage, percent) => {
        setLoadingProgress({ active: true, stage, percent });
      });

      setModels(prev => [...prev, loadedModel]);
      setLoadingProgress({ active: false, stage: '', percent: 100 });
    } catch (err: any) {
      console.error('Error cargando IFC:', err);
      alert(`Error al procesar el archivo IFC: ${err?.message || err}`);
      setLoadingProgress({ active: false, stage: '', percent: 0 });
    }
  };

  const handleRemoveModel = (modelId: string) => {
    setModels(prev => prev.filter(m => m.id !== modelId));
    if (selectedModelId === modelId) {
      setSelectedModelId(null);
      setSelectedExpressID(null);
    }
  };

  const handleToggleNodeVisibility = (nodeId: string) => {
    setHiddenNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleToggleCategoryVisibility = (categoryName: string) => {
    const globalKey = `global_cat_${categoryName}`;
    setHiddenNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(globalKey)) {
        next.delete(globalKey);
      } else {
        next.add(globalKey);
      }
      return next;
    });
  };

  const handleToggleStoreyVisibility = (storeyName: string) => {
    const globalKey = `global_storey_${storeyName}`;
    setHiddenNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(globalKey)) {
        next.delete(globalKey);
      } else {
        next.add(globalKey);
      }
      return next;
    });
  };

  const handleShowAll = () => {
    setHiddenNodeIds(new Set());
    viewerRef.current?.showAll();
  };

  const handleExportExcel = () => {
    if (models.length === 0) return;
    const targetModel = (selectedModelId ? models.find(m => m.id === selectedModelId) : null) || models[0];
    const buffer = exportModelToExcel(targetModel.metadata, targetModel.elements);
    const outName = `${targetModel.metadata.fileName.replace(/\.ifc$/i, '')}_parametros.xlsx`;
    downloadFile(buffer, outName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleTakeScreenshot = () => {
    if (!viewerRef.current || models.length === 0) return;
    const dataUrl = viewerRef.current.takeScreenshot();
    if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `BIM_captura_${Date.now()}.png`;
      a.click();
    }
  };

  // Find currently selected element data
  let selectedElementData: IFCElementData | null = null;
  if (selectedExpressID !== null) {
    if (selectedModelId) {
      const targetM = models.find(m => m.id === selectedModelId);
      selectedElementData = targetM?.elements.get(selectedExpressID) || null;
    } else {
      for (const m of models) {
        if (m.elements.has(selectedExpressID)) {
          selectedElementData = m.elements.get(selectedExpressID)!;
          break;
        }
      }
    }
  }

  return (
    <div className="flex flex-col w-screen h-screen bg-bim-950 overflow-hidden text-slate-100 select-none">
      {/* Top Application Toolbar */}
      <Toolbar
        models={models}
        onOpenIFCFile={handleOpenIFC}
        onRemoveModel={handleRemoveModel}
        onOpenSearch={() => setSearchModalOpen(true)}
        onOpenStats={() => setStatsModalOpen(true)}
        onOpenColorFilter={() => setColorFilterModalOpen(true)}
        onExportExcel={handleExportExcel}
        onTakeScreenshot={handleTakeScreenshot}
        colorMode={colorMode}
        showLeftPanel={showLeftPanel}
        setShowLeftPanel={setShowLeftPanel}
        showRightPanel={showRightPanel}
        setShowRightPanel={setShowRightPanel}
      />

      {/* Main Workspace Area (Tree | 3D Viewport | Property Panel) */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Sidebar: Spatial Hierarchy Tree */}
        {showLeftPanel && (
          <div className="w-80 h-full shrink-0 animate-fade-in z-10 shadow-2xl">
            <HierarchyTree
              models={models}
              selectedModelId={selectedModelId}
              selectedExpressID={selectedExpressID}
              onSelectElement={(mId, expId) => {
                setSelectedModelId(mId);
                setSelectedExpressID(expId);
              }}
              onIsolateElement={(mId, expId) => viewerRef.current?.isolateElement(mId, expId)}
              onHideElement={(mId, expId) => viewerRef.current?.hideElement(mId, expId)}
              hiddenNodeIds={hiddenNodeIds}
              onToggleNodeVisibility={handleToggleNodeVisibility}
              onShowAll={handleShowAll}
            />
          </div>
        )}

        {/* Center: 3D Viewport */}
        <div className="flex-1 h-full relative">
          <Viewer3D
            ref={viewerRef}
            models={models}
            selectedModelId={selectedModelId}
            selectedExpressID={selectedExpressID}
            onSelectElement={(mId, expId) => {
              setSelectedModelId(mId);
              setSelectedExpressID(expId);
            }}
            colorMode={colorMode}
            hiddenNodeIds={hiddenNodeIds}
          />

          {/* Loading Progress Indicator Overlay */}
          {loadingProgress.active && (
            <div className="absolute inset-0 bg-bim-950/80 backdrop-blur-md z-40 flex flex-col items-center justify-center p-6 select-none">
              <div className="bg-bim-900 border border-bim-700/80 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full text-center">
                <Loader2 size={40} className="text-cyan-400 animate-spin mb-4" />
                <h3 className="text-base font-bold text-white mb-1">Cargando Modelo IFC</h3>
                <p className="text-xs text-slate-400 mb-4">{loadingProgress.stage}</p>

                <div className="w-full bg-bim-950 rounded-full h-2.5 overflow-hidden border border-bim-800">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${loadingProgress.percent}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-cyan-400 font-bold mt-2">
                  {loadingProgress.percent}%
                </span>
              </div>
            </div>
          )}

          {/* Clean Empty State Prompt without samples */}
          {models.length === 0 && !loadingProgress.active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none pointer-events-none">
              <div className="p-8 bg-bim-900/90 backdrop-blur border border-bim-800 rounded-3xl shadow-2xl flex flex-col items-center max-w-md pointer-events-auto">
                <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400 mb-4">
                  <Box size={44} />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Visualizador IFC Local Nativo</h2>
                <p className="text-xs text-slate-400 mb-6">
                  Soporte para esquemas <strong>IFC 2x3</strong> e <strong>IFC 4</strong>. Visualización 3D acelerada, federación de modelos múltiples e inspección completa de parámetros.
                </p>
                <button
                  onClick={() => {
                    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                    input?.click();
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-cyan-900/30"
                >
                  <FolderOpen size={16} />
                  <span>Abrir Archivo IFC</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Comprehensive IFC Parameter Inspector */}
        {showRightPanel && (
          <div className="w-96 h-full shrink-0 animate-fade-in z-10 shadow-2xl">
            <PropertyPanel
              elementData={selectedElementData}
              onClose={() => {
                setSelectedExpressID(null);
                setSelectedModelId(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Color Mode & Visibility Legend Modal */}
      {models.length > 0 && (
        <ColorFilterModal
          isOpen={colorFilterModalOpen}
          onClose={() => setColorFilterModalOpen(false)}
          models={models}
          colorMode={colorMode}
          onChangeColorMode={setColorMode}
          hiddenNodeIds={hiddenNodeIds}
          onToggleCategoryVisibility={handleToggleCategoryVisibility}
          onToggleStoreyVisibility={handleToggleStoreyVisibility}
          onShowAll={handleShowAll}
        />
      )}

      {/* Global Search & Filter Modal */}
      {models.length > 0 && (
        <SearchModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          models={models}
          onSelectElement={(mId, id) => {
            setSelectedModelId(mId);
            setSelectedExpressID(id);
            viewerRef.current?.fitView();
          }}
        />
      )}

      {/* Statistics & Metadata Modal */}
      {models.length > 0 && (
        <StatisticsModal
          isOpen={statsModalOpen}
          onClose={() => setStatsModalOpen(false)}
          models={models}
        />
      )}
    </div>
  );
};
