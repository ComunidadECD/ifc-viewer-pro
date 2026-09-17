import { IfcAPI } from 'web-ifc';
import {
  IFCElementData,
  IFCPropertySet,
  IFCQuantitySet,
  IFCTypeData,
  IFCMaterialData,
  IFCClassificationData
} from '../types/ifc';

export function decodeIFCString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && val.value !== undefined) {
    val = val.value;
  }
  if (typeof val !== 'string') return String(val);

  return val
    .replace(/\\X2\\([0-9A-Fa-f]+)\\X0\\/g, (_: any, hex: string) => {
      let result = '';
      for (let i = 0; i < hex.length; i += 4) {
        result += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
      }
      return result;
    })
    .replace(/\\X\\([0-9A-Fa-f]{2})/g, (_: any, hex: string) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

export function extractPropertyValue(propVal: any): any {
  if (propVal === null || propVal === undefined) return null;
  if (typeof propVal === 'object') {
    if (propVal.value !== undefined) {
      return decodeIFCString(propVal.value);
    }
    if (Array.isArray(propVal)) {
      return propVal.map(extractPropertyValue);
    }
  }
  return decodeIFCString(propVal);
}

export class IFCDataExtractor {
  private api: IfcAPI;
  private modelID: number;
  private modelUuid: string;

  private elementToStorey = new Map<number, { id: number; name: string }>();
  private elementToPsets = new Map<number, IFCPropertySet[]>();
  private elementToQto = new Map<number, IFCQuantitySet[]>();
  private elementToType = new Map<number, IFCTypeData>();
  private elementToMaterials = new Map<number, IFCMaterialData[]>();
  private elementToClassifications = new Map<number, IFCClassificationData[]>();

  constructor(api: IfcAPI, modelID: number, modelUuid: string = 'model_1') {
    this.api = api;
    this.modelID = modelID;
    this.modelUuid = modelUuid;
  }

  public async indexAllRelationships(): Promise<void> {
    this.scanRelationships();
  }

  private scanRelationships(): void {
    const api = this.api;
    const modelID = this.modelID;
    const totalLines = api.GetMaxExpressID(modelID);

    for (let id = 1; id <= totalLines; id++) {
      let line: any;
      try {
        line = api.GetLine(modelID, id);
      } catch (e) {
        continue;
      }
      if (!line) continue;

      // Spatial Containment
      if (line.RelatingStructure && line.RelatedElements) {
        try {
          const storeyLine = api.GetLine(modelID, line.RelatingStructure.value);
          const storeyName = decodeIFCString(storeyLine?.Name?.value || storeyLine?.Name || `Nivel ${line.RelatingStructure.value}`);
          const storeyInfo = { id: line.RelatingStructure.value, name: storeyName };

          const related = Array.isArray(line.RelatedElements) ? line.RelatedElements : [line.RelatedElements];
          for (const rel of related) {
            const elId = rel.value ?? rel;
            this.elementToStorey.set(elId, storeyInfo);
          }
        } catch (err) {}
      }

      // Property Sets and Quantities
      if (line.RelatingPropertyDefinition && line.RelatedObjects) {
        try {
          const psetDefId = line.RelatingPropertyDefinition.value ?? line.RelatingPropertyDefinition;
          const psetDef = api.GetLine(modelID, psetDefId);
          if (psetDef) {
            const related = Array.isArray(line.RelatedObjects) ? line.RelatedObjects : [line.RelatedObjects];

            if (psetDef.HasProperties) {
              const pset = this.extractSinglePset(psetDef, psetDefId);
              for (const rel of related) {
                const elId = rel.value ?? rel;
                const list = this.elementToPsets.get(elId) || [];
                list.push(pset);
                this.elementToPsets.set(elId, list);
              }
            } else if (psetDef.Quantities) {
              const qto = this.extractSingleQto(psetDef, psetDefId);
              for (const rel of related) {
                const elId = rel.value ?? rel;
                const list = this.elementToQto.get(elId) || [];
                list.push(qto);
                this.elementToQto.set(elId, list);
              }
            }
          }
        } catch (err) {}
      }

      // Type Definition
      if (line.RelatingType && line.RelatedObjects) {
        try {
          const typeId = line.RelatingType.value ?? line.RelatingType;
          const typeLine = api.GetLine(modelID, typeId);
          if (typeLine) {
            const typeData = this.extractTypeData(typeLine, typeId);
            const related = Array.isArray(line.RelatedObjects) ? line.RelatedObjects : [line.RelatedObjects];
            for (const rel of related) {
              const elId = rel.value ?? rel;
              this.elementToType.set(elId, typeData);
            }
          }
        } catch (err) {}
      }

      // Materials
      if (line.RelatingMaterial && line.RelatedObjects) {
        try {
          const matId = line.RelatingMaterial.value ?? line.RelatingMaterial;
          const matLine = api.GetLine(modelID, matId);
          if (matLine) {
            const matData = this.extractMaterialData(matLine, matId);
            const related = Array.isArray(line.RelatedObjects) ? line.RelatedObjects : [line.RelatedObjects];
            for (const rel of related) {
              const elId = rel.value ?? rel;
              const list = this.elementToMaterials.get(elId) || [];
              list.push(matData);
              this.elementToMaterials.set(elId, list);
            }
          }
        } catch (err) {}
      }
    }
  }

  private extractSinglePset(psetDef: any, id: number): IFCPropertySet {
    const api = this.api;
    const modelID = this.modelID;
    const psetName = decodeIFCString(psetDef.Name) || `Pset_${id}`;
    const psetDescription = decodeIFCString(psetDef.Description);
    const properties: Record<string, any> = {};

    const props = Array.isArray(psetDef.HasProperties) ? psetDef.HasProperties : [psetDef.HasProperties];
    for (const pRef of props) {
      if (!pRef) continue;
      const propId = pRef.value ?? pRef;
      try {
        const prop = api.GetLine(modelID, propId);
        if (!prop) continue;
        const propName = decodeIFCString(prop.Name) || `Prop_${propId}`;

        if (prop.NominalValue !== undefined) {
          properties[propName] = extractPropertyValue(prop.NominalValue);
        } else if (prop.EnumerationValues !== undefined) {
          properties[propName] = extractPropertyValue(prop.EnumerationValues);
        } else if (prop.ListValues !== undefined) {
          properties[propName] = extractPropertyValue(prop.ListValues);
        } else {
          properties[propName] = extractPropertyValue(prop);
        }
      } catch (e) {}
    }

    return {
      id,
      name: psetName,
      description: psetDescription,
      properties
    };
  }

  private extractSingleQto(qtoDef: any, id: number): IFCQuantitySet {
    const api = this.api;
    const modelID = this.modelID;
    const qtoName = decodeIFCString(qtoDef.Name) || `Qto_${id}`;
    const quantities: Record<string, any> = {};

    const quants = Array.isArray(qtoDef.Quantities) ? qtoDef.Quantities : [qtoDef.Quantities];
    for (const qRef of quants) {
      if (!qRef) continue;
      const qId = qRef.value ?? qRef;
      try {
        const qLine = api.GetLine(modelID, qId);
        if (!qLine) continue;
        const qName = decodeIFCString(qLine.Name) || `Quantity_${qId}`;
        let val: any = null;
        let type = 'Quantity';

        if (qLine.LengthValue !== undefined) {
          val = extractPropertyValue(qLine.LengthValue);
          type = 'Length';
        } else if (qLine.AreaValue !== undefined) {
          val = extractPropertyValue(qLine.AreaValue);
          type = 'Area';
        } else if (qLine.VolumeValue !== undefined) {
          val = extractPropertyValue(qLine.VolumeValue);
          type = 'Volume';
        } else if (qLine.CountValue !== undefined) {
          val = extractPropertyValue(qLine.CountValue);
          type = 'Count';
        } else if (qLine.WeightValue !== undefined) {
          val = extractPropertyValue(qLine.WeightValue);
          type = 'Weight';
        }

        quantities[qName] = {
          name: qName,
          value: typeof val === 'number' ? Math.round(val * 1000) / 1000 : val,
          type,
          unit: decodeIFCString(qLine.Unit)
        };
      } catch (e) {}
    }

    return {
      id,
      name: qtoName,
      quantities
    };
  }

  private extractTypeData(typeLine: any, id: number): IFCTypeData {
    const typeName = decodeIFCString(typeLine.Name) || `Tipo #${id}`;
    const ifcType = typeLine.__proto__?.constructor?.name || 'IfcTypeObject';
    const attributes: Record<string, any> = {};
    const propertySets: IFCPropertySet[] = [];

    if (typeLine.Tag) attributes['Tag'] = decodeIFCString(typeLine.Tag);
    if (typeLine.ElementType) attributes['ElementType'] = decodeIFCString(typeLine.ElementType);
    if (typeLine.Description) attributes['Description'] = decodeIFCString(typeLine.Description);

    if (typeLine.HasPropertySets) {
      const psets = Array.isArray(typeLine.HasPropertySets) ? typeLine.HasPropertySets : [typeLine.HasPropertySets];
      for (const pRef of psets) {
        const pId = pRef.value ?? pRef;
        try {
          const pDef = this.api.GetLine(this.modelID, pId);
          if (pDef && pDef.HasProperties) {
            propertySets.push(this.extractSinglePset(pDef, pId));
          }
        } catch (e) {}
      }
    }

    return {
      id,
      name: typeName,
      ifcType,
      attributes,
      propertySets
    };
  }

  private extractMaterialData(matLine: any, id: number): IFCMaterialData {
    const api = this.api;
    const modelID = this.modelID;
    const name = decodeIFCString(matLine.Name) || `Material #${id}`;
    const description = decodeIFCString(matLine.Description);
    const layers: Array<{ material: string; thickness: number }> = [];

    if (matLine.ForLayerSet) {
      try {
        const layerSet = api.GetLine(modelID, matLine.ForLayerSet.value ?? matLine.ForLayerSet);
        if (layerSet && layerSet.MaterialLayers) {
          const mlayers = Array.isArray(layerSet.MaterialLayers) ? layerSet.MaterialLayers : [layerSet.MaterialLayers];
          for (const ml of mlayers) {
            const mlLine = api.GetLine(modelID, ml.value ?? ml);
            if (mlLine) {
              const layerMat = mlLine.Material ? api.GetLine(modelID, mlLine.Material.value ?? mlLine.Material) : null;
              layers.push({
                material: decodeIFCString(layerMat?.Name || 'Capa'),
                thickness: extractPropertyValue(mlLine.LayerThickness) || 0
              });
            }
          }
        }
      } catch (e) {}
    }

    return {
      name,
      description,
      layers: layers.length > 0 ? layers : undefined
    };
  }

  public getElementCompleteData(expressID: number, ifcType: string, rawLine?: any): IFCElementData {
    const api = this.api;
    const modelID = this.modelID;

    let line = rawLine;
    if (!line) {
      try {
        line = api.GetLine(modelID, expressID);
      } catch (e) {}
    }

    const globalId = decodeIFCString(line?.GlobalId) || '';
    const name = decodeIFCString(line?.Name) || `${ifcType} #${expressID}`;
    const tag = decodeIFCString(line?.Tag) || '';
    const description = decodeIFCString(line?.Description) || '';
    const objectType = decodeIFCString(line?.ObjectType) || '';

    const attributes: Record<string, any> = {};
    if (line) {
      for (const key of Object.keys(line)) {
        if (['expressID', 'type', 'GlobalId', 'Name', 'Tag', 'Description', 'ObjectType'].includes(key)) continue;
        const val = line[key];
        if (val !== null && val !== undefined && typeof val !== 'function') {
          attributes[key] = extractPropertyValue(val);
        }
      }
    }

    const storey = this.elementToStorey.get(expressID);
    const propertySets = this.elementToPsets.get(expressID) || [];
    const quantitySets = this.elementToQto.get(expressID) || [];
    const typeData = this.elementToType.get(expressID);
    const materials = this.elementToMaterials.get(expressID);
    const classifications = this.elementToClassifications.get(expressID);

    return {
      modelId: this.modelUuid,
      expressID,
      globalId,
      ifcType,
      name,
      tag,
      description,
      objectType,
      storeyName: storey ? storey.name : 'Sin Nivel Asignado',
      storeyId: storey?.id,
      attributes,
      propertySets,
      quantitySets,
      typeData,
      materials,
      classifications
    };
  }
}
