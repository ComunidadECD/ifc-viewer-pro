import React, { useState } from 'react';
import { SpatialNode, LoadedIFCModel } from '../types/ifc';
import {
  Folder,
  FolderOpen,
  Box,
  Layers,
  Search,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Building2,
  FileCode2,
  SlidersHorizontal
} from 'lucide-react';

interface HierarchyTreeProps {
  models: LoadedIFCModel[];
  selectedModelId: string | null;
  selectedExpressID: number | null;
  onSelectElement: (modelId: string, expressID: number) => void;
  onIsolateElement?: (modelId: string, expressID: number) => void;
  onHideElement?: (modelId: string, expressID: number) => void;
  hiddenNodeIds: Set<string>;
  onToggleNodeVisibility: (nodeId: string) => void;
  onShowAll: () => void;
}

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  models,
  selectedModelId,
  selectedExpressID,
  onSelectElement,
  onIsolateElement,
  onHideElement,
  hiddenNodeIds,
  onToggleNodeVisibility,
  onShowAll
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'all_root': true
  });

  if (models.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        No hay modelos IFC cargados
      </div>
    );
  }

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const isNodeHidden = (node: SpatialNode): boolean => {
    if (hiddenNodeIds.has(node.id)) return true;
    if (node.modelId && hiddenNodeIds.has(`model_${node.modelId}`)) return true;
    if (node.storeyName && (hiddenNodeIds.has(`storey_${node.modelId}_${node.storeyName}`) || hiddenNodeIds.has(`global_storey_${node.storeyName}`))) return true;
    if (node.category && (hiddenNodeIds.has(`cat_${node.modelId}_${node.storeyName}_${node.category}`) || hiddenNodeIds.has(`global_cat_${node.category}`))) return true;
    if (node.expressID && (hiddenNodeIds.has(`elem_${node.modelId}_${node.expressID}`) || hiddenNodeIds.has(`global_elem_${node.expressID}`))) return true;
    return false;
  };

  const renderNode = (node: SpatialNode, depth = 0) => {
    const isExpanded = expandedNodes[node.id] ?? (depth < 2);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.expressID > 0 &&
      node.expressID === selectedExpressID &&
      (!selectedModelId || node.modelId === selectedModelId);

    const hidden = isNodeHidden(node);

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchSearch = node.name.toLowerCase().includes(term) || String(node.expressID).includes(term);

      const hasMatchingChild = (n: SpatialNode): boolean => {
        if (n.name.toLowerCase().includes(term) || String(n.expressID).includes(term)) {
          return true;
        }
        return (n.children || []).some(hasMatchingChild);
      };

      if (!matchSearch && !hasMatchingChild(node)) {
        return null;
      }
    }

    const getNodeIcon = () => {
      if (node.type === 'ModelRoot') return <FileCode2 size={15} className="text-cyan-400" />;
      if (node.type === 'IfcBuildingStorey') return <Layers size={15} className="text-indigo-400" />;
      if (node.type === 'CategoryGroup') return isExpanded ? <FolderOpen size={15} className="text-amber-400" /> : <Folder size={15} className="text-amber-400" />;
      return <Box size={14} className="text-slate-400 group-hover:text-cyan-400" />;
    };

    return (
      <div key={node.id} className="flex flex-col">
        <div
          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition text-xs font-medium group ${
            isSelected
              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-sm'
              : hidden
              ? 'text-slate-600 hover:bg-bim-800/40'
              : 'text-slate-300 hover:bg-bim-800/80 hover:text-white'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => {
            if (node.expressID > 0 && node.modelId) {
              onSelectElement(node.modelId, node.expressID);
            } else if (hasChildren) {
              toggleExpand(node.id);
            }
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 text-slate-500 hover:text-slate-200"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          <span className="shrink-0">{getNodeIcon()}</span>

          <span className={`truncate flex-1 ${hidden ? 'line-through opacity-60' : ''}`} title={node.name}>
            {node.name}
          </span>

          {node.expressID > 0 && (
            <span className="font-mono text-[10px] text-slate-500 shrink-0">
              #{node.expressID}
            </span>
          )}

          {/* Visibility Controls for Folders, Levels & Elements */}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              title={hidden ? "Mostrar en 3D" : "Ocultar en 3D"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleNodeVisibility(node.id);
              }}
              className={`p-1 rounded transition ${
                hidden
                  ? 'text-slate-600 hover:text-cyan-400 hover:bg-bim-800'
                  : 'text-slate-400 hover:text-white hover:bg-bim-750 opacity-0 group-hover:opacity-100'
              }`}
            >
              {hidden ? <EyeOff size={13} className="text-red-400" /> : <Eye size={13} />}
            </button>

            {node.expressID > 0 && node.modelId && (
              <button
                title="Aislar este elemento"
                onClick={(e) => {
                  e.stopPropagation();
                  onIsolateElement?.(node.modelId!, node.expressID);
                }}
                className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-bim-750 rounded opacity-0 group-hover:opacity-100 transition hidden sm:block"
              >
                <SlidersHorizontal size={11} />
              </button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const totalElementsCount = models.reduce((acc, m) => acc + m.metadata.totalElements, 0);

  return (
    <div className="flex flex-col h-full bg-bim-900 border-r border-bim-800 select-none overflow-hidden">
      {/* Header & Search */}
      <div className="p-3 border-b border-bim-800 bg-bim-950/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Building2 size={15} className="text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Estructura Espacial
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-bim-800 text-cyan-400 px-2 py-0.5 rounded-full font-mono font-semibold">
              {models.length} {models.length === 1 ? 'IFC' : 'IFCs'} ({totalElementsCount})
            </span>
            {hiddenNodeIds.size > 0 && (
              <button
                onClick={onShowAll}
                className="text-[10px] bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white px-2 py-0.5 rounded-full transition font-semibold"
                title="Mostrar todos los elementos ocultos"
              >
                Ver Todo
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por clase, nivel, nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-bim-900 border border-bim-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      {/* Spatial Trees Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {models.map(m => m.spatialTree ? renderNode(m.spatialTree, 0) : null)}
      </div>
    </div>
  );
};
