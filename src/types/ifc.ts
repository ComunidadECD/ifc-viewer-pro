export interface IFCProperty {
  name: string;
  value: any;
  type?: string;
}

export interface IFCPropertySet {
  id: number;
  name: string;
  description?: string;
  properties: Record<string, any>;
}

export interface IFCQuantity {
  name: string;
  value: number | string;
  type: string;
  unit?: string;
}

export interface IFCQuantitySet {
  id: number;
  name: string;
  quantities: Record<string, IFCQuantity>;
}

export interface IFCTypeData {
  id: number;
  name: string;
  ifcType: string;
  attributes: Record<string, any>;
  propertySets: IFCPropertySet[];
}

export interface IFCMaterialLayer {
  material: string;
  thickness: number;
}

export interface IFCMaterialData {
  name: string;
  description?: string;
  layerSetName?: string;
  layers?: IFCMaterialLayer[];
}

export interface IFCClassificationData {
  source?: string;
  edition?: string;
  name?: string;
  itemReference?: string;
}

export interface IFCElementData {
  modelId: string;
  expressID: number;
  globalId: string;
  ifcType: string;
  name: string;
  tag: string;
  description: string;
  objectType: string;
  storeyName: string;
  storeyId?: number;
  attributes: Record<string, any>;
  propertySets: IFCPropertySet[];
  quantitySets: IFCQuantitySet[];
  typeData?: IFCTypeData;
  materials?: IFCMaterialData[];
  classifications?: IFCClassificationData[];
  color?: { r: number; g: number; b: number; a: number };
}

export interface SpatialNode {
  id: string;
  modelId?: string;
  expressID: number;
  type: 'IfcProject' | 'IfcSite' | 'IfcBuilding' | 'IfcBuildingStorey' | 'CategoryGroup' | 'Element' | 'ModelRoot';
  name: string;
  children: SpatialNode[];
  elementCount?: number;
  category?: string;
  storeyName?: string;
}

export interface IFCModelMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  schema: string;
  description: string;
  author: string;
  organization: string;
  originatingSystem: string;
  timestamp: string;
  totalElements: number;
  categories: Record<string, number>;
  storeys: Array<{ id: number; name: string; elevation?: number; elementCount: number }>;
}

export interface LoadedIFCModel {
  id: string;
  metadata: IFCModelMetadata;
  elements: Map<number, IFCElementData>;
  spatialTree: SpatialNode | null;
  meshGroup: any;
  allExpressIDs: number[];
  visible: boolean;
}

export type ColorMode = 'category' | 'storey' | 'original';
