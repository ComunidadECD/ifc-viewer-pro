import React from 'react';
import { LoadedIFCModel, ColorMode } from '../types/ifc';
import { CATEGORY_COLORS, STOREY_PALETTE } from '../services/ifcLoader';
import { Palette, X, Eye, EyeOff, Layers, Sparkles } from 'lucide-react';

interface ColorFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: LoadedIFCModel[];
  colorMode: ColorMode;
  onChangeColorMode: (mode: ColorMode) => void;
  hiddenNodeIds: Set<string>;
  onToggleCategoryVisibility: (categoryName: string) => void;
  onToggleStoreyVisibility: (storeyName: string) => void;
  onShowAll: () => void;
}

export const ColorFilterModal: React.FC<ColorFilterModalProps> = ({
  isOpen,
  onClose,
  models,
  colorMode,
  onChangeColorMode,
  hiddenNodeIds,
  onToggleCategoryVisibility,
  onToggleStoreyVisibility,
  onShowAll
}) => {
  if (!isOpen) return null;

  // Aggregate categories across all loaded models
  const categoriesMap = new Map<string, { count: number; colorHex: number }>();
  // Aggregate storeys across all loaded models
  const storeysMap = new Map<string, { count: number; colorHex: number }>();

  let storeyColorIdx = 0;
  models.forEach(m => {
    m.elements.forEach(el => {
      // Category
      const catName = el.ifcType;
      const curCat = categoriesMap.get(catName) || { count: 0, colorHex: CATEGORY_COLORS[catName.toUpperCase()] || 0x94a3b8 };
      curCat.count++;
      categoriesMap.set(catName, curCat);

      // Storey
      const sName = el.storeyName || 'Sin Nivel';
      if (!storeysMap.has(sName)) {
        storeysMap.set(sName, { count: 0, colorHex: STOREY_PALETTE[storeyColorIdx % STOREY_PALETTE.length] });
        storeyColorIdx++;
      }
      storeysMap.get(sName)!.count++;
    });
  });

  const sortedCategories = Array.from(categoriesMap.entries()).sort((a, b) => b[1].count - a[1].count);
  const sortedStoreys = Array.from(storeysMap.entries());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-bim-900 border border-bim-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-bim-800 bg-bim-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Palette size={18} />
            <span>Coloreo y Filtros de Visibilidad</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Color Mode Switcher */}
        <div className="p-4 border-b border-bim-800 bg-bim-950/40">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
            Modo de Coloreo de Elementos
          </span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onChangeColorMode('category')}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                colorMode === 'category'
                  ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-bim-900 border-bim-800 text-slate-400 hover:text-white hover:bg-bim-800'
              }`}
            >
              <Sparkles size={16} />
              <span>Por Categoría IFC</span>
            </button>

            <button
              onClick={() => onChangeColorMode('storey')}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                colorMode === 'storey'
                  ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-bim-900 border-bim-800 text-slate-400 hover:text-white hover:bg-bim-800'
              }`}
            >
              <Layers size={16} />
              <span>Por Nivel / Planta</span>
            </button>

            <button
              onClick={() => onChangeColorMode('original')}
              className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                colorMode === 'original'
                  ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-bim-900 border-bim-800 text-slate-400 hover:text-white hover:bg-bim-800'
              }`}
            >
              <Palette size={16} />
              <span>Original / Neutro</span>
            </button>
          </div>
        </div>

        {/* List of items with colors and eye toggles */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {colorMode === 'storey' ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-300">Niveles / Plantas ({sortedStoreys.length})</span>
                <button onClick={onShowAll} className="text-[11px] text-cyan-400 hover:underline">Mostrar Todos</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sortedStoreys.map(([sName, data]) => {
                  const isHidden = hiddenNodeIds.has(`global_storey_${sName}`);
                  const colorHexStr = `#${data.colorHex.toString(16).padStart(6, '0')}`;
                  return (
                    <div
                      key={sName}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isHidden ? 'bg-bim-950/40 border-bim-800/40 text-slate-500' : 'bg-bim-950/80 border-bim-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: colorHexStr }}
                        />
                        <div className="min-w-0">
                          <span className={`text-xs font-semibold block truncate ${isHidden ? 'line-through opacity-60' : ''}`}>
                            {sName}
                          </span>
                          <span className="text-[10px] text-slate-500">{data.count} elementos</span>
                        </div>
                      </div>

                      <button
                        title={isHidden ? "Mostrar Nivel" : "Ocultar Nivel"}
                        onClick={() => onToggleStoreyVisibility(sName)}
                        className={`p-1.5 rounded-lg transition ${
                          isHidden ? 'bg-bim-800 text-red-400 hover:bg-bim-700' : 'bg-bim-800/80 text-slate-300 hover:text-white hover:bg-bim-700'
                        }`}
                      >
                        {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-slate-300">Categorías IFC ({sortedCategories.length})</span>
                <button onClick={onShowAll} className="text-[11px] text-cyan-400 hover:underline">Mostrar Todas</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sortedCategories.map(([catName, data]) => {
                  const isHidden = hiddenNodeIds.has(`global_cat_${catName}`);
                  const colorHexStr = `#${data.colorHex.toString(16).padStart(6, '0')}`;
                  return (
                    <div
                      key={catName}
                      className={`flex items-center justify-between p-3 rounded-xl border transition ${
                        isHidden ? 'bg-bim-950/40 border-bim-800/40 text-slate-500' : 'bg-bim-950/80 border-bim-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: colorHexStr }}
                        />
                        <div className="min-w-0">
                          <span className={`text-xs font-semibold block truncate ${isHidden ? 'line-through opacity-60' : ''}`}>
                            {catName}
                          </span>
                          <span className="text-[10px] text-slate-500">{data.count} elementos</span>
                        </div>
                      </div>

                      <button
                        title={isHidden ? "Mostrar Categoría" : "Ocultar Categoría"}
                        onClick={() => onToggleCategoryVisibility(catName)}
                        className={`p-1.5 rounded-lg transition ${
                          isHidden ? 'bg-bim-800 text-red-400 hover:bg-bim-700' : 'bg-bim-800/80 text-slate-300 hover:text-white hover:bg-bim-700'
                        }`}
                      >
                        {isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
