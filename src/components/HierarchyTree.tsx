import React, { useState } from 'react';
import { SpatialNode } from '../types/ifc';
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
  Building,
  Home,
  Compass
} from 'lucide-react';

interface HierarchyTreeProps {
  rootNode: SpatialNode | null;
  selectedExpressID: number | null;
  onSelectElement: (expressID: number) => void;
  onIsolateElement?: (expressID: number) => void;
  onHideElement?: (expressID: number) => void;
}

export const HierarchyTree: React.FC<HierarchyTreeProps> = ({
  rootNode,
  selectedExpressID,
  onSelectElement,
  onIsolateElement,
  onHideElement
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'root': true,
    'storeys': true
  });

  if (!rootNode) {
    return (
      <div className="p-6 text-center text-slate-500 text-sm">
        No hay modelo cargado
      </div>
    );
  }

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNode = (node: SpatialNode, path: string, depth = 0) => {
    const isExpanded = expandedNodes[path] ?? (depth < 2);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.expressID > 0 && node.expressID === selectedExpressID;

    if (searchTerm.trim()) {
      const matchSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(node.expressID).includes(searchTerm);

      const hasMatchingChild = (n: SpatialNode): boolean => {
        if (n.name.toLowerCase().includes(searchTerm.toLowerCase()) || String(n.expressID).includes(searchTerm)) {
          return true;
        }
        return (n.children || []).some(hasMatchingChild);
      };

      if (!matchSearch && !hasMatchingChild(node)) {
        return null;
      }
    }

    const getNodeIcon = () => {
      if (node.type === 'IfcProject') return <Compass size={15} className="text-cyan-400" />;
      if (node.type === 'IfcSite') return <Home size={15} className="text-emerald-400" />;
      if (node.type === 'IfcBuilding') return <Building size={15} className="text-amber-400" />;
      if (node.type === 'IfcBuildingStorey') return <Layers size={15} className="text-indigo-400" />;
      if (node.type === 'CategoryGroup') return isExpanded ? <FolderOpen size={15} className="text-blue-400" /> : <Folder size={15} className="text-blue-400" />;
      return <Box size={14} className="text-slate-400 group-hover:text-cyan-400" />;
    };

    return (
      <div key={path} className="flex flex-col">
        <div
          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer transition text-xs font-medium group ${
            isSelected
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-300 hover:bg-bim-800/80 hover:text-white'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          onClick={() => {
            if (node.expressID > 0) {
              onSelectElement(node.expressID);
            } else if (hasChildren) {
              toggleNode(path);
            }
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(path);
              }}
              className="p-0.5 text-slate-500 hover:text-slate-200"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          <span className="shrink-0">{getNodeIcon()}</span>

          <span className="truncate flex-1" title={node.name}>
            {node.name}
          </span>

          {node.expressID > 0 && (
            <span className="font-mono text-[10px] text-slate-500 shrink-0">
              #{node.expressID}
            </span>
          )}

          {node.expressID > 0 && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
              <button
                title="Aislar elemento"
                onClick={(e) => {
                  e.stopPropagation();
                  onIsolateElement?.(node.expressID);
                }}
                className="p-1 text-slate-400 hover:text-cyan-400 hover:bg-bim-700 rounded"
              >
                <Eye size={12} />
              </button>
              <button
                title="Ocultar elemento"
                onClick={(e) => {
                  e.stopPropagation();
                  onHideElement?.(node.expressID);
                }}
                className="p-1 text-slate-400 hover:text-red-400 hover:bg-bim-700 rounded"
              >
                <EyeOff size={12} />
              </button>
            </div>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="flex flex-col">
            {node.children.map((child, idx) => renderNode(child, `${path}_${idx}`, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-bim-900 border-r border-bim-800 select-none overflow-hidden">
      <div className="p-3 border-b border-bim-800 bg-bim-950/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Estructura Espacial BIM
          </span>
          <span className="text-[10px] bg-bim-800 text-cyan-400 px-2 py-0.5 rounded-full font-mono font-semibold">
            {rootNode.children.length} Niveles
          </span>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por clase, nombre o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-bim-900 border border-bim-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {renderNode(rootNode, 'root', 0)}
      </div>
    </div>
  );
};
