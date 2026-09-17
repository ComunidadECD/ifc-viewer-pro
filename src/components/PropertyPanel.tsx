import React, { useState } from 'react';
import { IFCElementData } from '../types/ifc';
import {
  Copy,
  Check,
  Search,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Calculator,
  Tag,
  Info,
  Sliders,
  Box
} from 'lucide-react';

interface PropertyPanelProps {
  elementData: IFCElementData | null;
  onClose?: () => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  elementData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'psets' | 'qto' | 'type' | 'materials'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'identification': true,
    'psets': true,
    'qto': true,
    'type': true,
    'materials': true,
    'attributes': false
  });

  if (!elementData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-bim-900 border-l border-bim-800 text-slate-500 select-none">
        <div className="p-4 bg-bim-950 rounded-2xl border border-bim-800/80 mb-3 shadow-inner">
          <Sliders size={32} className="text-slate-600" />
        </div>
        <h4 className="text-sm font-semibold text-slate-300 mb-1">Inspector de Parámetros</h4>
        <p className="text-xs text-slate-500 max-w-[220px]">
          Selecciona un elemento en el modelo 3D o en el árbol espacial para inspeccionar todos sus parámetros IFC 2.3 / 4.
        </p>
      </div>
    );
  }

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const filterMatches = (key: string, value: any): boolean => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return key.toLowerCase().includes(term) || String(value).toLowerCase().includes(term);
  };

  return (
    <div className="flex flex-col h-full bg-bim-900 border-l border-bim-800 select-none overflow-hidden animate-fade-in">
      {/* Element Header */}
      <div className="p-4 border-b border-bim-800 bg-bim-950/60 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {elementData.ifcType}
              </span>
              <span className="text-xs font-mono text-slate-400">
                #{elementData.expressID}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mt-1 truncate max-w-[260px]" title={elementData.name}>
              {elementData.name || 'Sin Nombre'}
            </h3>
          </div>

          <button
            onClick={() => copyToClipboard(JSON.stringify(elementData, null, 2), 'json')}
            title="Copiar todos los parámetros en JSON"
            className="p-1.5 bg-bim-800 hover:bg-bim-700 text-slate-300 hover:text-white rounded-lg transition"
          >
            {copiedField === 'json' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>

        {/* GlobalId / GUID */}
        <div className="flex items-center justify-between bg-bim-900/90 px-2.5 py-1.5 rounded-lg border border-bim-800 text-[11px] font-mono">
          <span className="text-slate-500 truncate mr-2">GUID: {elementData.globalId || 'N/A'}</span>
          <button
            onClick={() => copyToClipboard(elementData.globalId, 'guid')}
            className="text-slate-400 hover:text-cyan-400 p-0.5 transition"
            title="Copiar GUID"
          >
            {copiedField === 'guid' ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'psets', label: `Psets (${elementData.propertySets.length})` },
            { id: 'qto', label: `Cantidades (${elementData.quantitySets.length})` },
            { id: 'type', label: 'Tipo' },
            { id: 'materials', label: 'Materiales' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                activeTab === tab.id
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-bim-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search inside parameters */}
        <div className="relative mt-2.5">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filtrar parámetros o valores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 bg-bim-900 border border-bim-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      {/* Properties Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* 1. Identification Section */}
        {activeTab === 'all' && (
          <div className="bg-bim-950/40 rounded-xl border border-bim-800/80 overflow-hidden">
            <button
              onClick={() => toggleSection('identification')}
              className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-300 hover:bg-bim-800/50 transition bg-bim-900/50"
            >
              <div className="flex items-center gap-2">
                <Info size={14} className="text-cyan-400" />
                <span>Identificación & Localización</span>
              </div>
              {expandedSections['identification'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {expandedSections['identification'] && (
              <div className="p-2.5 space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-bim-800/40">
                  <span className="text-slate-400">Nivel / Piso:</span>
                  <span className="font-medium text-slate-200">{elementData.storeyName}</span>
                </div>
                {elementData.tag && (
                  <div className="flex justify-between py-1 border-b border-bim-800/40">
                    <span className="text-slate-400">Tag IFC:</span>
                    <span className="font-mono text-slate-200">{elementData.tag}</span>
                  </div>
                )}
                {elementData.objectType && (
                  <div className="flex justify-between py-1 border-b border-bim-800/40">
                    <span className="text-slate-400">ObjectType:</span>
                    <span className="font-medium text-slate-200">{elementData.objectType}</span>
                  </div>
                )}
                {elementData.description && (
                  <div className="flex flex-col py-1 border-b border-bim-800/40">
                    <span className="text-slate-400 mb-0.5">Descripción:</span>
                    <span className="font-medium text-slate-200">{elementData.description}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Property Sets (Psets) */}
        {(activeTab === 'all' || activeTab === 'psets') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-bold text-cyan-400">
              <Sparkles size={14} />
              <span>CONJUNTOS DE PROPIEDADES (PSETS)</span>
            </div>

            {elementData.propertySets.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3 bg-bim-950/40 rounded-xl border border-bim-800">
                No se encontraron Property Sets asociados
              </div>
            ) : (
              elementData.propertySets.map(pset => {
                const isPsetExpanded = expandedSections[`pset_${pset.id}`] ?? true;
                const propEntries = Object.entries(pset.properties).filter(([k, v]) => filterMatches(k, v));

                if (searchTerm.trim() && propEntries.length === 0 && !pset.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                  return null;
                }

                return (
                  <div key={pset.id} className="bg-bim-950/40 rounded-xl border border-bim-800/80 overflow-hidden">
                    <button
                      onClick={() => toggleSection(`pset_${pset.id}`)}
                      className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-200 hover:bg-bim-800/50 transition bg-bim-900/60"
                    >
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-indigo-400" />
                        <span className="truncate max-w-[240px]" title={pset.name}>{pset.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 bg-bim-800 px-1.5 py-0.5 rounded">
                          {Object.keys(pset.properties).length}
                        </span>
                        {isPsetExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </button>

                    {isPsetExpanded && (
                      <div className="p-2.5 space-y-1.5 text-xs">
                        {propEntries.length === 0 ? (
                          <div className="text-slate-500 italic text-[11px]">Sin propiedades coincidentes</div>
                        ) : (
                          propEntries.map(([pKey, pVal]) => (
                            <div key={pKey} className="flex justify-between items-start py-1 border-b border-bim-800/30 gap-2">
                              <span className="text-slate-400 font-medium shrink-0 max-w-[140px] truncate" title={pKey}>
                                {pKey}
                              </span>
                              <span className="font-mono text-slate-200 text-right break-all select-text">
                                {typeof pVal === 'boolean' ? (pVal ? 'TRUE' : 'FALSE') : (typeof pVal === 'object' ? JSON.stringify(pVal) : String(pVal ?? ''))}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 3. Quantity Sets (Qto) */}
        {(activeTab === 'all' || activeTab === 'qto') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-bold text-amber-400">
              <Calculator size={14} />
              <span>CANTIDADES & DIMENSIONES (QTO)</span>
            </div>

            {elementData.quantitySets.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3 bg-bim-950/40 rounded-xl border border-bim-800">
                No se encontraron Quantity Sets asociados
              </div>
            ) : (
              elementData.quantitySets.map(qto => {
                const isQtoExpanded = expandedSections[`qto_${qto.id}`] ?? true;
                const quantEntries = Object.entries(qto.quantities).filter(([k, v]) => filterMatches(k, (v as any)?.value));

                if (searchTerm.trim() && quantEntries.length === 0 && !qto.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                  return null;
                }

                return (
                  <div key={qto.id} className="bg-bim-950/40 rounded-xl border border-bim-800/80 overflow-hidden">
                    <button
                      onClick={() => toggleSection(`qto_${qto.id}`)}
                      className="w-full flex items-center justify-between p-2.5 text-xs font-bold text-slate-200 hover:bg-bim-800/50 transition bg-bim-900/60"
                    >
                      <div className="flex items-center gap-2">
                        <Calculator size={13} className="text-amber-400" />
                        <span className="truncate max-w-[240px]">{qto.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 bg-bim-800 px-1.5 py-0.5 rounded">
                          {Object.keys(qto.quantities).length}
                        </span>
                        {isQtoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </button>

                    {isQtoExpanded && (
                      <div className="p-2.5 space-y-1.5 text-xs">
                        {quantEntries.map(([qKey, qObj]) => (
                          <div key={qKey} className="flex justify-between items-center py-1 border-b border-bim-800/30 gap-2">
                            <div>
                              <span className="text-slate-300 font-medium block">{qKey}</span>
                              <span className="text-[10px] text-slate-500">{(qObj as any).type}</span>
                            </div>
                            <span className="font-mono text-cyan-300 font-semibold select-text">
                              {String((qObj as any).value)} {(qObj as any).unit || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. Type Data */}
        {(activeTab === 'all' || activeTab === 'type') && elementData.typeData && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-bold text-emerald-400">
              <Box size={14} />
              <span>PROPIEDADES DE TIPO (IFCTYPE)</span>
            </div>

            <div className="bg-bim-950/40 rounded-xl border border-bim-800/80 p-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-bim-800/40">
                <span className="text-slate-400">Nombre de Tipo:</span>
                <span className="font-bold text-slate-200">{elementData.typeData.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-bim-800/40">
                <span className="text-slate-400">Entidad IFC:</span>
                <span className="font-mono text-emerald-400">{elementData.typeData.ifcType}</span>
              </div>

              {elementData.typeData.propertySets.map(p => (
                <div key={p.id} className="mt-2 pt-2 border-t border-bim-800/60">
                  <span className="font-bold text-slate-300 block mb-1 text-[11px]">{p.name}</span>
                  {Object.entries(p.properties).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-0.5 text-[11px]">
                      <span className="text-slate-500">{k}:</span>
                      <span className="font-mono text-slate-300">{String(v ?? '')}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Materials */}
        {(activeTab === 'all' || activeTab === 'materials') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs font-bold text-purple-400">
              <Layers size={14} />
              <span>MATERIALES & CAPAS</span>
            </div>

            {!elementData.materials || elementData.materials.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3 bg-bim-950/40 rounded-xl border border-bim-800">
                No hay materiales asignados en el modelo IFC
              </div>
            ) : (
              elementData.materials.map((mat, i) => (
                <div key={i} className="bg-bim-950/40 rounded-xl border border-bim-800/80 p-3 text-xs space-y-2">
                  <div className="flex justify-between font-bold text-slate-200">
                    <span>{mat.name}</span>
                  </div>
                  {mat.layers && (
                    <div className="space-y-1 mt-2">
                      <span className="text-[10px] text-slate-500 uppercase">Capas del Elemento:</span>
                      {mat.layers.map((l, idx) => (
                        <div key={idx} className="flex justify-between bg-bim-900/60 p-1.5 rounded text-[11px]">
                          <span className="text-slate-300">{l.material}</span>
                          <span className="font-mono text-purple-300">{l.thickness} mm</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
