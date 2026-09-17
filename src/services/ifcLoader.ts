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

const CATEGORY_COLORS: Record<string, number> = {
  IFCWALL: 0xe2e8f0,
  IFCWALLSTANDARDCASE: 0xe2e8f0,
  IFCSLAB: 0xcbd5e1,
  IFCCOLUMN: 0x94a3b8,
  IFCBEAM: 0x64748b,
  IFCDOOR: 0x93c5fd,
  IFCWINDOW: 0x38bdf8,
  IFCROOF: 0xf87171,
  IFCSTAIR: 0xfcd34d,
  IFCSTAIRFLIGHT: 0xfcd34d,
  IFCRAILING: 0xa8a29e,
  IFCMEMBER: 0x64748b,
  IFCPLATE: 0x94a3b8,
  IFCCURTAINWALL: 0x7dd3fc,
  IFCFLOWTERMINAL: 0x4ade80,
  IFCFLOWSEGMENT: 0x22c55e,
  IFCFURNISHINGELEMENT: 0xfb923c,
  IFCSPACE: 0xa78bfa,
  IFCBUILDINGELEMENTPROXY: 0xd1d5db
};

function getCategoryName(rawType: string): string {
  const upper = rawType.toUpperCase();
  const map: Record<string, string> = {
    IFCWALL: 'Muros (IfcWall)',
    IFCWALLSTANDARDCASE: 'Muros Estandar (IfcWallStandardCase)',
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
    IFCFLOWSEGMENT: 'Tuberias / Conductos (IfcFlowSegment)',
    IFCSPACE: 'Espacios / Ambientes (IfcSpace)',
    IFCBUILDINGELEMENTPROXY: 'Objetos Genericos (IfcBuildingElementProxy)'
  };
  return map[upper] || upper.replace(/^IFC/, '');
}

export async function loadIFCFile(
  data: Uint8Array,
  fileName: string,
  onProgress?: (stage: string, percent: number) => void
): Promise<LoadedIFCModel> {
  const api = await getIfcAPI();
  onProgress?.('Iniciando motor WebAssembly de IFC...', 10);

  const modelID = api.OpenModel(data, {
    COORDINATE_TO_ORIGIN: true
  } as any);

  onProgress?.('Indexando parametros y relaciones IFC...', 30);
  const extractor = new IFCDataExtractor(api, modelID);
  await extractor.indexAllRelationships();

  onProgress?.('Generando geometrias 3D de alta precision...', 50);

  const meshGroup = new THREE.Group();
  meshGroup.name = `IFCModel_${modelID}`;

  const elements = new Map<number, IFCElementData>();
  const expressIDToMeshIndex = new Map<number, { meshIndex: number }>();
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

    const catName = getCategoryName(ifcType);
    categoriesCount[catName] = (categoriesCount[catName] || 0) + 1;

    const elementData = extractor.getElementCompleteData(expressID, ifcType);
    elements.set(expressID, elementData);

    const geomGroup = new THREE.Group();
    geomGroup.name = `Element_${expressID}`;
    geomGroup.userData = { expressID, ifcType, name: elementData.name };

    const geomSize = flatMesh.geometries.size();
    for (let i = 0; i < geomSize; i++) {
      const placedGeom = flatMesh.geometries.get(i);
      const geomData = api.GetGeometry(modelID, placedGeom.geometryExpressID);
      const rawVerts = api.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize());
      const rawIndices = api.GetIndexArray(geomData.GetIndexData(), geomData.GetIndexDataSize());

      if (rawVerts.length === 0 || rawIndices.length === 0) continue;

      const bufferGeometry = new THREE.BufferGeometry();
      const posArray: number[] = [];
      const normArray: number[] = [];

      for (let v = 0; v < rawVerts.length; v += 6) {
        posArray.push(rawVerts[v], rawVerts[v + 1], rawVerts[v + 2]);
        normArray.push(rawVerts[v + 3], rawVerts[v + 4], rawVerts[v + 5]);
      }

      bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(posArray, 3));
      bufferGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normArray, 3));
      bufferGeometry.setIndex(Array.from(rawIndices));

      const transformMatrix = new THREE.Matrix4();
      transformMatrix.fromArray(placedGeom.flatTransformation);

      const color = placedGeom.color;
      const mat = getMaterial(color, ifcType);

      const mesh = new THREE.Mesh(bufferGeometry, mat);
      mesh.applyMatrix4(transformMatrix);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { expressID, ifcType, originalMaterial: mat };

      geomGroup.add(mesh);
    }

    if (geomGroup.children.length > 0) {
      meshGroup.add(geomGroup);
    }
  });

  onProgress?.('Estructurando arbol espacial BIM...', 85);

  const spatialTree = buildSpatialHierarchy(api, modelID, elements);

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
    fileName,
    fileSize: data.byteLength,
    schema,
    description: `Modelo BIM ${schema}`,
    author: 'Usuario BIM',
    organization: 'Organizacion',
    originatingSystem: 'Visualizador IFC Pro',
    timestamp: new Date().toLocaleString(),
    totalElements: elements.size,
    categories: categoriesCount,
    storeys: Array.from(storeysMap.values())
  };

  onProgress?.('Modelo cargado exitosamente!', 100);

  return {
    metadata,
    elements,
    spatialTree,
    meshGroup,
    expressIDToMeshIndex,
    allExpressIDs
  };
}

function buildSpatialHierarchy(
  api: IfcAPI,
  modelID: number,
  elements: Map<number, IFCElementData>
): SpatialNode {
  const rootNode: SpatialNode = {
    expressID: 0,
    type: 'IfcProject',
    name: 'Proyecto BIM',
    children: []
  };

  const storeyGroups = new Map<string, Map<string, IFCElementData[]>>();

  for (const [_, el] of elements) {
    const sName = el.storeyName || 'Sin Nivel';
    if (!storeyGroups.has(sName)) {
      storeyGroups.set(sName, new Map());
    }
    const catMap = storeyGroups.get(sName)!;
    const catName = getCategoryName(el.ifcType);
    if (!catMap.has(catName)) {
      catMap.set(catName, []);
    }
    catMap.get(catName)!.push(el);
  }

  for (const [storeyName, catMap] of storeyGroups) {
    const storeyNode: SpatialNode = {
      expressID: 0,
      type: 'IfcBuildingStorey',
      name: storeyName,
      children: [],
      elementCount: 0
    };

    let storeyCount = 0;
    for (const [catName, elemList] of catMap) {
      storeyCount += elemList.length;
      const catNode: SpatialNode = {
        expressID: 0,
        type: 'CategoryGroup',
        name: `${catName} (${elemList.length})`,
        category: catName,
        children: elemList.map(el => ({
          expressID: el.expressID,
          type: el.ifcType,
          name: el.name,
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
