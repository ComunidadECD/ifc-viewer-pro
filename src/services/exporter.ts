import * as XLSX from 'xlsx';
import { IFCElementData, IFCModelMetadata } from '../types/ifc';

export function exportModelToExcel(
  metadata: IFCModelMetadata,
  elements: Map<number, IFCElementData>
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['REPORTE DE MODELO BIM IFC', ''],
    ['Archivo', metadata.fileName],
    ['Esquema IFC', metadata.schema],
    ['Total de Elementos', metadata.totalElements],
    ['Fecha de Exportacion', new Date().toLocaleString()],
    ['', ''],
    ['DESGLOSE POR CATEGORIA', 'CANTIDAD'],
    ...Object.entries(metadata.categories).map(([cat, count]) => [cat, count]),
    ['', ''],
    ['DESGLOSE POR NIVEL', 'CANTIDAD DE ELEMENTOS'],
    ...metadata.storeys.map(s => [s.name, s.elementCount])
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

  const elementsRows: any[] = [];
  const psetsRows: any[] = [];
  const qtoRows: any[] = [];

  for (const [expressID, el] of elements) {
    const materialsStr = el.materials?.map(m => m.name).join(', ') || '';
    elementsRows.push({
      'ID IFC': expressID,
      'GlobalId (GUID)': el.globalId,
      'Clase IFC': el.ifcType,
      'Nombre': el.name,
      'Nivel / Piso': el.storeyName,
      'Tipo': el.typeData?.name || '',
      'Tag': el.tag,
      'Descripcion': el.description,
      'Material': materialsStr,
      'Num Psets': el.propertySets.length,
      'Num Cantidades': el.quantitySets.length
    });

    for (const pset of el.propertySets) {
      for (const [propName, propVal] of Object.entries(pset.properties)) {
        psetsRows.push({
          'ID Elemento': expressID,
          'GlobalId': el.globalId,
          'Clase IFC': el.ifcType,
          'Nombre Elemento': el.name,
          'Conjunto (Pset)': pset.name,
          'Propiedad': propName,
          'Valor': typeof propVal === 'object' ? JSON.stringify(propVal) : String(propVal ?? '')
        });
      }
    }

    for (const qto of el.quantitySets) {
      for (const [qName, qObj] of Object.entries(qto.quantities)) {
        psetsRows.push({
          'ID Elemento': expressID,
          'GlobalId': el.globalId,
          'Clase IFC': el.ifcType,
          'Nombre Elemento': el.name,
          'Conjunto Cantidad (Qto)': qto.name,
          'Cantidad': qName,
          'Tipo Cantidad': qObj.type,
          'Valor': qObj.value,
          'Unidad': qObj.unit || ''
        });
      }
    }
  }

  const wsElements = XLSX.utils.json_to_sheet(elementsRows);
  XLSX.utils.book_append_sheet(wb, wsElements, 'Elementos');

  if (psetsRows.length > 0) {
    const wsPsets = XLSX.utils.json_to_sheet(psetsRows);
    XLSX.utils.book_append_sheet(wb, wsPsets, 'Propiedades (Psets)');
  }

  if (qtoRows.length > 0) {
    const wsQto = XLSX.utils.json_to_sheet(qtoRows);
    XLSX.utils.book_append_sheet(wb, wsQto, 'Cantidades (Qto)');
  }

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbOut);
}

export function exportModelToCSV(elements: Map<number, IFCElementData>): string {
  const rows: string[] = [
    'ID IFC,GlobalId,Clase IFC,Nombre,Nivel,Tipo,Material,Tag'
  ];

  for (const [expressID, el] of elements) {
    const mat = (el.materials?.map(m => m.name).join(';') || '').replace(/,/g, ' ');
    const name = (el.name || '').replace(/,/g, ' ');
    const storey = (el.storeyName || '').replace(/,/g, ' ');
    const type = (el.typeData?.name || '').replace(/,/g, ' ');
    const tag = (el.tag || '').replace(/,/g, ' ');

    rows.push(`${expressID},${el.globalId},${el.ifcType},"${name}","${storey}","${type}","${mat}","${tag}"`);
  }

  return rows.join('\n');
}

export function exportModelToJSON(
  metadata: IFCModelMetadata,
  elements: Map<number, IFCElementData>
): string {
  const elementsObj: Record<number, IFCElementData> = {};
  for (const [id, el] of elements) {
    elementsObj[id] = el;
  }

  return JSON.stringify(
    {
      metadata,
      elements: elementsObj
    },
    null,
    2
  );
}

export function downloadFile(buffer: any, fileName: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
