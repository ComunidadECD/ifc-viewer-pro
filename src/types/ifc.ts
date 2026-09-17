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
  expressID: number;
  type: string;
  name: string;
  children: SpatialNode[];
  elementCount?: number;
  category?: string;
}

export interface IFCModelMetadata {
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
  metadata: IFCModelMetadata;
  elements: Map<number, IFCElementData>;
  spatialTree: SpatialNode | null;
  meshGroup: any;
  expressIDToMeshIndex: Map<number, { meshIndex: number; instanceIndex?: number }>;
  allExpressIDs: number[];
}
