import * as THREE from 'three';
import { IfcAPI, FlatMesh } from 'web-ifc';
import { IFCDataExtractor, decodeIFCString } from './ifcProperties';
import {
  IFCElementData,
  IFCModelMetadata,
  LoadedIFCModel,
  SpatialNode
} from '../types/ifc';

let ifcApiInstance: IfcAPI | null = null;

export async function getIfcAPI(): Promise<IfcAPI> {
  if (!ifcApiInstance) {
    const api = new IfcAPI();
    api.SetWasmPath('./wasm/');
    await api.Init((path: string) => {
      return `./wasm/${path}`;
    });
    ifcApiInstance = api;
  }
  return ifcApiInstance;
}

export const CATEGORY_COLORS: Record<string, number> = {
  IFCWALL: 0xdce2ec,
  IFCWALLSTANDARDCASE: 0xdce2ec,
  IFCSLAB: 0x94a3b8,
  IFCCOLUMN: 0x3b82f6,
  IFCBEAM: 0x6366f1,
  IFCDOOR: 0xf59e0b,
  IFCWINDOW: 0x06b6d4,
  IFCROOF: 0xef4444,
  IFCSTAIR: 0x10b981,
  IFCSTAIRFLIGHT: 0x10b981,
  IFCRAILING: 0x8b5cf6,
  IFCMEMBER: 0x475569,
  IFCPLATE: 0x64748b,
  IFCCURTAINWALL: 0x38bdf8,
  IFCFLOWTERMINAL: 0x14b8a6,
  IFCFLOWSEGMENT: 0x22c55e,
  IFCFURNISHINGELEMENT: 0xf97316,
  IFCSPACE: 0xa855f7,
  IFCBUILDINGELEMENTPROXY: 0x6b7280
};

export const STOREY_PALETTE = [
  0x3b82f6, // Blue
  0x10b981, // Emerald
  0xf59e0b, // Amber
  0xec4899, // Pink
  0x8b5cf6, // Violet
  0x06b6d4, // Cyan
  0xf97316, // Orange
  0x14b8a6, // Teal
  0xa855f7, // Purple
  0x64748b  // Slate
];

export function getCategoryDisplayName(rawType: string): string {
  const upper = rawType.toUpperCase();
  const map: Record<string, string> = {
    IFCWALL: 'Muros (IfcWall)',
    IFCWALLSTANDARDCASE: 'Muros Estándar (IfcWallStandardCase)',
    IFCSLAB: 'Forjados / Losas (IfcSlab)',
    IFCCOLUMN: 'Pilares / Columnas (IfcColumn)',
    IFCBEAM: 'Vigas (IfcBeam)',
    IFCDOOR: 'Puertas (IfcDoor)',
    IFCWINDOW: 'Ventanas (IfcWindow)',
    IFCROOF: 'Cubiertas / Techos (IfcRoof)',
    IFCSTAIR: 'Escaleras (IfcStair)',
    IFCSTAIRFLIGHT: 'Tramos Escalera (IfcStairFlight)',
    IFCRAILING: 'Barandillas (IfcRailing)',
    IFCMEMBER: 'Elementos Estructurales (IfcMember)',
    IFCPLATE: 'Placas (IfcPlate)',
    IFCCURTAINWALL: 'Muro Cortina (IfcCurtainWall)',
    IFCFURNISHINGELEMENT: 'Mobiliario (IfcFurnishingElement)',
    IFCFLOWTERMINAL: 'Instalaciones (IfcFlowTerminal)',
    IFCFLOWSEGMENT: 'Tuberías / Conductos (IfcFlowSegment)',
    IFCSPACE: 'Espacios / Ambientes (IfcSpace)',
    IFCBUILDINGELEMENTPROXY: 'Objetos Genéricos (IfcBuildingElementProxy)'
  };
  return map[upper] || upper.replace(/^IFC/, '');
}

export async function loadIFCFile(
  data: Uint8Array,
  fileName: string,
  modelId: string = 'model_' + Date.now(),
  onProgress?: (stage: string, percent: number) => void
): Promise<LoadedIFCModel> {
  const api = await getIfcAPI();
  onProgress?.('Iniciando motor WebAssembly de IFC...', 10);

  const modelID = api.OpenModel(data, {
    COORDINATE_TO_ORIGIN: true
  } as any);

  onProgress?.('Indexando parámetros y relaciones IFC...', 30);
  const extractor = new IFCDataExtractor(api, modelID, modelId);
  await extractor.indexAllRelationships();

  onProgress?.('Generando geometrías 3D de alta precisión...', 50);

  const meshGroup = new THREE.Group();
  meshGroup.name = `IFCModel_${modelId}`;
  meshGroup.userData = { modelId, fileName };

  const elements = new Map<number, IFCElementData>();
  const allExpressIDs: number[] = [];
  const categoriesCount: Record<string, number> = {};

  const materialCache = new Map<string, THREE.MeshStandardMaterial>();

  function getMaterial(color: { x: number; y: number; z: number; w: number }, ifcType: string): THREE.MeshStandardMaterial {
    const isTransparent = color.w < 0.95;
    const key = `${color.x}_${color.y}_${color.z}_${color.w}_${ifcType}`;
    if (materialCache.has(key)) return materialCache.get(key)!;

    let baseColor = new THREE.Color(color.x, color.y, color.z);
    const defaultColor = CATEGORY_COLORS[ifcType.toUpperCase()];
    if ((color.x === 1 && color.y === 1 && color.z === 1) || (color.x === 0.8 && color.y === 0.8 && color.z === 0.8)) {
      if (defaultColor) {
        baseColor = new THREE.Color(defaultColor);
      }
    }

    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.45,
      metalness: 0.1,
      transparent: isTransparent,
      opacity: color.w,
      side: THREE.DoubleSide,
      depthWrite: !isTransparent
    });

    materialCache.set(key, mat);
    return mat;
  }

  // Index storeys to assign storey colors
  const storeyColorMap = new Map<string, number>();
  let storeyColorIdx = 0;

  function getStoreyColor(storeyName: string): number {
    if (!storeyColorMap.has(storeyName)) {
      storeyColorMap.set(storeyName, STOREY_PALETTE[storeyColorIdx % STOREY_PALETTE.length]);
      storeyColorIdx++;
    }
    return storeyColorMap.get(storeyName)!;
  }

  // Stream meshes and create 3D geometries synchronously within WASM callback
  api.StreamAllMeshes(modelID, (flatMesh: FlatMesh) => {
    const expressID = flatMesh.expressID;
    allExpressIDs.push(expressID);

    let ifcType = 'IfcProduct';
    try {
      const line = api.GetLine(modelID, expressID);
      if (line && line.__proto__?.constructor?.name) {
        ifcType = line.__proto__.constructor.name;
      }
    } catch (e) {}

    const catName = getCategoryDisplayName(ifcType);
    categoriesCount[catName] = (categoriesCount[catName] || 0) + 1;

    const elementData = extractor.getElementCompleteData(expressID, ifcType);
    elements.set(expressID, elementData);

    const sName = elementData.storeyName || 'Sin Nivel';
    const storeyColor = getStoreyColor(sName);
    const catColor = CATEGORY_COLORS[ifcType.toUpperCase()] || 0x94a3b8;

    const geomGroup = new THREE.Group();
    geomGroup.name = `Element_${modelId}_${expressID}`;
    geomGroup.userData = {
      modelId,
      expressID,
      ifcType,
      name: elementData.name,
      storeyName: sName,
      categoryName: catName,
      categoryColor: catColor,
      storeyColor: storeyColor
    };

    const geomSize = flatMesh.geometries.size();
    for (let i = 0; i < geomSize; i++) {
      const placedGeom = flatMesh.geometries.get(i);
      const geomData = api.GetGeometry(modelID, placedGeom.geometryExpressID);
      const rawVerts = api.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize());
      const rawIndices = api.GetIndexArray(geomData.GetIndexData(), geomData.GetIndexDataSize());

      if (rawVerts.length === 0 || rawIndices.length === 0) continue;

      const bufferGeometry = new THREE.BufferGeometry();
      const posArray = new Float32Array(rawVerts.length / 2);
      const normArray = new Float32Array(rawVerts.length / 2);

      let pIdx = 0;
      let nIdx = 0;
      for (let v = 0; v < rawVerts.length; v += 6) {
        posArray[pIdx++] = rawVerts[v];
        posArray[pIdx++] = rawVerts[v + 1];
        posArray[pIdx++] = rawVerts[v + 2];

        normArray[nIdx++] = rawVerts[v + 3];
        normArray[nIdx++] = rawVerts[v + 4];
        normArray[nIdx++] = rawVerts[v + 5];
      }

      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
      bufferGeometry.setIndex(Array.from(rawIndices));

      const transformMatrix = new THREE.Matrix4();
      transformMatrix.fromArray(placedGeom.flatTransformation);

      const color = placedGeom.color;
      const mat = getMaterial(color, ifcType);

      const mesh = new THREE.Mesh(bufferGeometry, mat);
      mesh.applyMatrix4(transformMatrix);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = {
        modelId,
        expressID,
        ifcType,
        storeyName: sName,
        categoryName: catName,
        categoryColor: catColor,
        storeyColor: storeyColor,
        originalMaterial: mat
      };

      geomGroup.add(mesh);
    }

    if (geomGroup.children.length > 0) {
      meshGroup.add(geomGroup);
    }
  });

  onProgress?.('Estructurando árbol espacial BIM...', 85);

  const spatialTree = buildSpatialHierarchy(modelId, fileName, elements);

  const storeysMap = new Map<string, { id: number; name: string; elementCount: number }>();
  for (const [_, el] of elements) {
    if (el.storeyName) {
      const s = storeysMap.get(el.storeyName) || { id: el.storeyId || 0, name: el.storeyName, elementCount: 0 };
      s.elementCount++;
      storeysMap.set(el.storeyName, s);
    }
  }

  let schema = 'IFC2X3';
  try {
    const rawHeader = api.GetHeaderLine(modelID, 1);
    if (rawHeader && rawHeader.includes('IFC4')) {
      schema = 'IFC4';
    }
  } catch (e) {}

  const metadata: IFCModelMetadata = {
    id: modelId,
    fileName,
    fileSize: data.byteLength,
    schema,
    description: `Modelo BIM ${schema}`,
    author: 'Usuario BIM',
    organization: 'Organización',
    originatingSystem: 'Visualizador IFC Pro',
    timestamp: new Date().toLocaleString(),
    totalElements: elements.size,
    categories: categoriesCount,
    storeys: Array.from(storeysMap.values())
  };

  onProgress?.('¡Modelo cargado exitosamente!', 100);

  return {
    id: modelId,
    metadata,
    elements,
    spatialTree,
    meshGroup,
    allExpressIDs,
    visible: true
  };
}

function buildSpatialHierarchy(
  modelId: string,
  fileName: string,
  elements: Map<number, IFCElementData>
): SpatialNode {
  const rootNode: SpatialNode = {
    id: `model_${modelId}`,
    modelId,
    expressID: 0,
    type: 'ModelRoot',
    name: fileName,
    children: []
  };

  const storeyGroups = new Map<string, Map<string, IFCElementData[]>>();

  for (const [_, el] of elements) {
    const sName = el.storeyName || 'Sin Nivel';
    if (!storeyGroups.has(sName)) {
      storeyGroups.set(sName, new Map());
    }
    const catMap = storeyGroups.get(sName)!;
    const catName = getCategoryDisplayName(el.ifcType);
    if (!catMap.has(catName)) {
      catMap.set(catName, []);
    }
    catMap.get(catName)!.push(el);
  }

  for (const [storeyName, catMap] of storeyGroups) {
    const storeyNode: SpatialNode = {
      id: `storey_${modelId}_${storeyName}`,
      modelId,
      expressID: 0,
      type: 'IfcBuildingStorey',
      name: storeyName,
      storeyName: storeyName,
      children: [],
      elementCount: 0
    };

    let storeyCount = 0;
    for (const [catName, elemList] of catMap) {
      storeyCount += elemList.length;
      const catNode: SpatialNode = {
        id: `cat_${modelId}_${storeyName}_${catName}`,
        modelId,
        expressID: 0,
        type: 'CategoryGroup',
        name: `${catName} (${elemList.length})`,
        category: catName,
        storeyName: storeyName,
        children: elemList.map(el => ({
          id: `elem_${modelId}_${el.expressID}`,
          modelId,
          expressID: el.expressID,
          type: 'Element',
          name: el.name,
          category: catName,
          storeyName: storeyName,
          children: []
        }))
      };
      storeyNode.children.push(catNode);
    }
    storeyNode.elementCount = storeyCount;
    rootNode.children.push(storeyNode);
  }

  return rootNode;
}
