# Visualizador IFC Pro 🏢

Visualizador BIM nativo de escritorio para Windows diseñado para cargar modelos en esquemas **IFC 2x3** e **IFC 4**, renderizar la geometría 3D acelerada por hardware GPU e inspeccionar la totalidad de parámetros, conjuntos de propiedades (Psets), cantidades (Qto), tipos y materiales.

![Visualizador IFC Pro](public/logo.svg)

---

## ✨ Características Principales

- 🚀 **Soporte Completo para IFC 2.3 e IFC 4**: Motor WebAssembly de alto rendimiento (`web-ifc`) local y 100% offline.
- 🔍 **Inspección Exhaustiva de Parámetros**:
  - Identificación y atributos directos (GUID, Tag, Nombre, Clase IFC, Storey, ObjectType, etc.).
  - Conjuntos de Propiedades (**Psets**) estándar y personalizados (Revit, ArchiCAD, Tekla, etc.).
  - Cantidades y Dimensiones (**Qto**) con volúmenes, áreas, longitudes y unidades.
  - Propiedades de Tipo (**IfcTypeObject**).
  - Definición de materiales y desglose de capas compuestas en mm.
- 🌳 **Árbol Espacial Jerárquico**: Navegación por `IfcProject` $\rightarrow$ `IfcSite` $\rightarrow$ `IfcBuilding` $\rightarrow$ `IfcBuildingStorey` $\rightarrow$ Categorías $\rightarrow$ Elementos.
- 📐 **Herramientas de Análisis 3D**:
  - Navegación orbital suave, Pan y Zoom.
  - Vistas ortogonales (Planta, Fachadas) e Isométrica 3D.
  - Plano de corte interactivo en ejes X, Y y Z.
  - Modos de visibilidad: Aislar elemento, Ocultar elemento, Mostrar todo y Modo alámbrico/sólido.
- 📊 **Búsqueda Global y Estadísticas**:
  - Búsqueda instantánea en tiempo real por GUID, Nombre, Tag o valor de parámetro.
  - Gráficos y resumen de distribución por categorías IFC y niveles.
- 📑 **Exportación de Datos**:
  - Exportación a **Excel (.xlsx)** con pestañas organizadas (*Resumen*, *Elementos*, *Psets*, *Cantidades*).
  - Exportación a **CSV** y **JSON**.
  - Capturas de pantalla en HD.

---

## 🛠️ Tecnologías

- **Plataforma Desktop**: [Electron](https://www.electronjs.org/) + [Vite](https://vitejs.dev/)
- **Frontend UI**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **Motor 3D**: [Three.js](https://threejs.org/) + [web-ifc](https://github.com/ThatOpen/engine_web-ifc)
- **Iconografía**: [Lucide React](https://lucide.dev/)
- **Procesamiento de Datos**: [SheetJS (xlsx)](https://sheetjs.com/)

---

## 🚀 Instalación y Desarrollo

### Requisitos previos
- [Node.js](https://nodejs.org/) v18+ (recomendado v20+)
- npm o pnpm

### Pasos
```bash
# 1. Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd "3. Visualizador IFC"

# 2. Instalar dependencias
npm install

# 3. Iniciar en modo desarrollo
npm run dev
```

---

## 📦 Compilación para Windows (.exe)

Para generar el instalador y la versión portable:

```bash
npm run package
```

Los ejecutables se generarán en la carpeta `release/`:
- **Instalador NSIS**: `release/Visualizador IFC Pro Setup 1.0.0.exe`
- **Versión Portable**: `release/Visualizador IFC Pro 1.0.0.exe`

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
