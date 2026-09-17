import React, { useState, useMemo } from 'react';
import { IFCElementData } from '../types/ifc';
import { Search, X, Box, Filter } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  elements: Map<number, IFCElementData>;
  onSelectElement: (expressID: number) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  elements,
  onSelectElement
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const [_, el] of elements) {
      set.add(el.ifcType);
    }
    return Array.from(set).sort();
  }, [elements]);

  const filteredResults = useMemo(() => {
    if (!query.trim() && selectedCategory === 'all') return [];

    const q = query.toLowerCase().trim();
    const results: IFCElementData[] = [];

    for (const [_, el] of elements) {
      if (selectedCategory !== 'all' && el.ifcType !== selectedCategory) {
        continue;
      }

      if (!q) {
        results.push(el);
        if (results.length >= 100) break;
        continue;
      }

      const matchId = String(el.expressID).includes(q);
      const matchName = el.name.toLowerCase().includes(q);
      const matchGuid = el.globalId.toLowerCase().includes(q);
      const matchTag = el.tag.toLowerCase().includes(q);
      const matchType = el.ifcType.toLowerCase().includes(q);
      const matchStorey = el.storeyName.toLowerCase().includes(q);

      let matchPset = false;
      for (const p of el.propertySets) {
        for (const [pk, pv] of Object.entries(p.properties)) {
          if (pk.toLowerCase().includes(q) || String(pv).toLowerCase().includes(q)) {
            matchPset = true;
            break;
          }
        }
        if (matchPset) break;
      }

      if (matchId || matchName || matchGuid || matchTag || matchType || matchStorey || matchPset) {
        results.push(el);
        if (results.length >= 100) break;
      }
    }

    return results;
  }, [query, selectedCategory, elements]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bim-900 border border-bim-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-bim-800 bg-bim-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Search size={18} />
            <span>Búsqueda Global y Filtros de Elementos IFC</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters and Inputs */}
        <div className="p-4 border-b border-bim-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              autoFocus
              placeholder="Buscar por Nombre, GUID, Tag, Nivel, Parámetro o Valor..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bim-950 border border-bim-700 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-bim-950 border border-bim-700 text-slate-200 text-xs py-2 px-3 rounded-xl focus:outline-none focus:border-cyan-500 transition max-w-[200px]"
            >
              <option value="all">Todas las clases IFC ({categories.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="px-4 py-2 bg-bim-950/40 text-xs text-slate-400 flex justify-between items-center border-b border-bim-800/60">
          <span>Resultados encontrados: <strong className="text-cyan-400">{filteredResults.length}</strong> {filteredResults.length === 100 ? '(primeros 100)' : ''}</span>
          <span className="text-[11px] text-slate-500">Haz clic en un elemento para seleccionarlo en 3D</span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {filteredResults.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              {query || selectedCategory !== 'all' ? 'No se encontraron elementos con los criterios seleccionados' : 'Escribe un término o selecciona una categoría para buscar'}
            </div>
          ) : (
            filteredResults.map(el => (
              <div
                key={el.expressID}
                onClick={() => {
                  onSelectElement(el.expressID);
                  onClose();
                }}
                className="p-3 bg-bim-950/60 hover:bg-bim-800/80 border border-bim-800/80 hover:border-cyan-500/50 rounded-xl cursor-pointer transition flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-bim-900 rounded-lg text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition shrink-0">
                    <Box size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200 text-sm truncate">{el.name}</span>
                      <span className="text-[10px] bg-bim-800 px-2 py-0.5 rounded text-slate-400 font-mono">#{el.expressID}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="text-cyan-400 font-semibold">{el.ifcType}</span>
                      <span>•</span>
                      <span>{el.storeyName}</span>
                      {el.tag && (
                        <>
                          <span>•</span>
                          <span className="font-mono">Tag: {el.tag}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] font-mono text-slate-500 group-hover:text-cyan-400 transition block">
                    {el.globalId ? el.globalId.substring(0, 16) + '...' : ''}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {el.propertySets.length} Psets | {el.quantitySets.length} Qto
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
