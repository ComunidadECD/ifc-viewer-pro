import React, { useState, useRef, useEffect } from 'react';
import { Viewer3D, Viewer3DRef } from './components/Viewer3D';
import { HierarchyTree } from './components/HierarchyTree';
import { PropertyPanel } from './components/PropertyPanel';
import { Toolbar } from './components/Toolbar';
import { SearchModal } from './components/SearchModal';
import { StatisticsModal } from './components/StatisticsModal';
import { loadIFCFile } from './services/ifcLoader';
import { exportModelToExcel, downloadFile } from './services/exporter';
import { LoadedIFCModel } from './types/ifc';
import { SAMPLE_IFC_2X3 } from './samples/sampleIfc2x3';
import { SAMPLE_IFC_4 } from './samples/sampleIfc4';
import { Loader2, Box } from 'lucide-react';

export const App: React.FC = () => {
  const [model, setModel] = useState<LoadedIFCModel | null>(null);
  const [selectedExpressID, setSelectedExpressID] = useState<number | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<{ active: boolean; stage: string; percent: number }>({
    active: false,
    stage: '',
    percent: 0
  });

  const [showLeftPanel, setShowLeftPanel] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [statsModalOpen, setStatsModalOpen] = useState<boolean>(false);

  const viewerRef = useRef<Viewer3DRef>(null);

  const handleOpenIFC = async (fileData: Uint8Array, fileName: string) => {
    try {
      setLoadingProgress({ active: true, stage: 'Cargando archivo IFC...', percent: 5 });
      setSelectedExpressID(null);

      const loadedModel = await loadIFCFile(fileData, fileName, (stage, percent) => {
        setLoadingProgress({ active: true, stage, percent });
      });

      setModel(loadedModel);
      setLoadingProgress({ active: false, stage: '', percent: 100 });
    } catch (err: any) {
      console.error('Error cargando IFC:', err);
      alert(`Error al procesar el archivo IFC: ${err?.message || err}`);
      setLoadingProgress({ active: false, stage: '', percent: 0 });
    }
  };

  useEffect(() => {
    const encoder = new TextEncoder();
    const data = encoder.encode(SAMPLE_IFC_2X3);
    handleOpenIFC(data, 'Edificio_Muestra_IFC2X3.ifc');
  }, []);

  const handleExportExcel = () => {
    if (!model) return;
    const buffer = exportModelToExcel(model.metadata, model.elements);
    const outName = `${model.metadata.fileName.replace(/\.ifc$/i, '')}_parametros.xlsx`;
    downloadFile(buffer, outName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const handleTakeScreenshot = () => {
    if (!viewerRef.current || !model) return;
    const dataUrl = viewerRef.current.takeScreenshot();
    if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${model.metadata.fileName}_captura.png`;
      a.click();
    }
  };

  const selectedElementData = (selectedExpressID && model) ? model.elements.get(selectedExpressID) || null : null;

  return (
    <div className="flex flex-col w-screen h-screen bg-bim-950 overflow-hidden text-slate-100 select-none">
      {/* Top Application Toolbar */}
      <Toolbar
        model={model}
        onOpenIFCFile={handleOpenIFC}
        onOpenSearch={() => setSearchModalOpen(true)}
        onOpenStats={() => setStatsModalOpen(true)}
        onExportExcel={handleExportExcel}
        onTakeScreenshot={handleTakeScreenshot}
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
              rootNode={model?.spatialTree || null}
              selectedExpressID={selectedExpressID}
              onSelectElement={(id) => setSelectedExpressID(id)}
              onIsolateElement={(id) => viewerRef.current?.isolateElement(id)}
              onHideElement={(id) => viewerRef.current?.hideElement(id)}
            />
          </div>
        )}

        {/* Center: 3D Viewport */}
        <div className="flex-1 h-full relative">
          <Viewer3D
            ref={viewerRef}
            model={model}
            selectedExpressID={selectedExpressID}
            onSelectElement={(id) => setSelectedExpressID(id)}
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

          {/* Empty State Prompt if no model */}
          {!model && !loadingProgress.active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center select-none pointer-events-none">
              <div className="p-6 bg-bim-900/80 backdrop-blur border border-bim-800 rounded-3xl shadow-2xl flex flex-col items-center max-w-md pointer-events-auto">
                <div className="p-4 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-400 mb-4">
                  <Box size={40} />
                </div>
                <h2 className="text-lg font-bold text-white mb-1">Visualizador IFC Local Nativo</h2>
                <p className="text-xs text-slate-400 mb-5">
                  Compatible con esquemas <strong>IFC 2x3</strong> e <strong>IFC 4</strong>. Lee geometrías 3D, jerarquías y todos los parámetros, Psets y Qto.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const encoder = new TextEncoder();
                      handleOpenIFC(encoder.encode(SAMPLE_IFC_2X3), 'Muestra_IFC2X3.ifc');
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition"
                  >
                    Probar IFC 2.3
                  </button>
                  <button
                    onClick={() => {
                      const encoder = new TextEncoder();
                      handleOpenIFC(encoder.encode(SAMPLE_IFC_4), 'Muestra_IFC4.ifc');
                    }}
                    className="px-4 py-2 bg-bim-800 hover:bg-bim-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                  >
                    Probar IFC 4
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Comprehensive IFC Parameter Inspector */}
        {showRightPanel && (
          <div className="w-96 h-full shrink-0 animate-fade-in z-10 shadow-2xl">
            <PropertyPanel
              elementData={selectedElementData}
              onClose={() => setSelectedExpressID(null)}
            />
          </div>
        )}
      </div>

      {/* Global Search & Filter Modal */}
      {model && (
        <SearchModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          elements={model.elements}
          onSelectElement={(id) => {
            setSelectedExpressID(id);
            viewerRef.current?.fitView();
          }}
        />
      )}

      {/* Statistics & Metadata Modal */}
      {model && (
        <StatisticsModal
          isOpen={statsModalOpen}
          onClose={() => setStatsModalOpen(false)}
          metadata={model.metadata}
          elements={model.elements}
        />
      )}
    </div>
  );
};
