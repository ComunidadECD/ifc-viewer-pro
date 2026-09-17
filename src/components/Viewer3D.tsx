import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LoadedIFCModel, ColorMode, SpatialNode } from '../types/ifc';
import { Eye, Layers, Maximize2, Scissors, Grid } from 'lucide-react';

export interface Viewer3DRef {
  selectElement: (modelId: string | null, expressID: number | null) => void;
  toggleNodeVisibility: (node: SpatialNode, visible: boolean) => void;
  toggleStoreyVisibility: (storeyName: string, visible: boolean) => void;
  toggleCategoryVisibility: (categoryName: string, visible: boolean) => void;
  toggleModelVisibility: (modelId: string, visible: boolean) => void;
  isolateElement: (modelId: string, expressID: number) => void;
  hideElement: (modelId: string, expressID: number) => void;
  showAll: () => void;
  fitView: () => void;
  setCameraView: (view: 'top' | 'front' | 'right' | 'iso') => void;
  takeScreenshot: () => string;
}

interface Viewer3DProps {
  models: LoadedIFCModel[];
  selectedModelId: string | null;
  selectedExpressID: number | null;
  onSelectElement: (modelId: string | null, expressID: number | null) => void;
  colorMode: ColorMode;
  hiddenNodeIds: Set<string>;
}

export const Viewer3D = forwardRef<Viewer3DRef, Viewer3DProps>(({
  models,
  selectedModelId,
  selectedExpressID,
  onSelectElement,
  colorMode,
  hiddenNodeIds
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const [clippingActive, setClippingActive] = useState<boolean>(false);
  const [clippingAxis, setClippingAxis] = useState<'x' | 'y' | 'z'>('z');
  const [clippingOffset, setClippingOffset] = useState<number>(0);
  const [clippingRange, setClippingRange] = useState<{ min: number; max: number }>({ min: -50, max: 50 });
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);

  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0));
  const modelsRootGroupRef = useRef<THREE.Group>(new THREE.Group());

  const highlightMaterialRef = useRef<THREE.MeshStandardMaterial>(
    new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.4,
      side: THREE.DoubleSide
    })
  );

  // Material caches for color modes
  const colorMaterialCache = useRef<Map<string, THREE.MeshStandardMaterial>>(new Map());

  const getColoredMaterial = (colorHex: number, isTransparent?: boolean, opacity?: number): THREE.MeshStandardMaterial => {
    const safeOpacity = (typeof opacity === 'number' && !isNaN(opacity)) ? opacity : 1.0;
    const trans = Boolean(isTransparent && safeOpacity < 0.99);
    const key = `${colorHex}_${trans}_${safeOpacity.toFixed(2)}`;
    const cache = colorMaterialCache.current;
    if (cache.has(key)) return cache.get(key)!;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: 0.45,
      metalness: 0.1,
      transparent: trans,
      opacity: safeOpacity,
      side: THREE.DoubleSide,
      depthWrite: !trans
    });
    cache.set(key, mat);
    return mat;
  };

  // Setup Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 3000);
    camera.position.set(25, 25, 25);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    rendererRef.current = renderer;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.65);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight1.position.set(60, 120, 60);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.45);
    dirLight2.position.set(-60, -40, -60);
    scene.add(dirLight2);

    const grid = new THREE.GridHelper(120, 60, 0x3b82f6, 0x1e293b);
    grid.position.y = -0.01;
    scene.add(grid);
    gridHelperRef.current = grid;

    scene.add(modelsRootGroupRef.current);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const onMouseDown = (e: MouseEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelsRootGroupRef.current.children, true);
      const visibleIntersects = intersects.filter(hit => hit.object.visible && hit.object.parent?.visible);

      if (visibleIntersects.length > 0) {
        const hitMesh = visibleIntersects[0].object as THREE.Mesh;
        const mId = hitMesh.userData?.modelId || hitMesh.parent?.userData?.modelId;
        const expID = hitMesh.userData?.expressID || hitMesh.parent?.userData?.expressID;
        if (expID !== undefined) {
          onSelectElement(mId || null, expID);
          return;
        }
      }
      onSelectElement(null, null);
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
    };
  }, []);

  // Update Grid Visibility
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  // Update Models in Scene
  useEffect(() => {
    const rootGroup = modelsRootGroupRef.current;
    rootGroup.clear();

    models.forEach(m => {
      if (m.meshGroup && m.visible !== false) {
        rootGroup.add(m.meshGroup);
      }
    });

    if (models.length > 0 && rootGroup.children.length > 0) {
      const box = new THREE.Box3().setFromObject(rootGroup);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = cameraRef.current?.fov || 45;
      let cameraDistance = (maxDim / 2) / Math.tan((fov * Math.PI) / 360) * 1.5;
      cameraDistance = Math.max(cameraDistance, 10);

      if (cameraRef.current && controlsRef.current) {
        cameraRef.current.position.set(center.x + cameraDistance * 0.7, center.y + cameraDistance * 0.5, center.z + cameraDistance * 0.7);
        cameraRef.current.lookAt(center);
        controlsRef.current.target.copy(center);
        controlsRef.current.update();
      }

      setClippingRange({
        min: Math.floor(Math.min(box.min.x, box.min.y, box.min.z) - 5),
        max: Math.ceil(Math.max(box.max.x, box.max.y, box.max.z) + 5)
      });
      setClippingOffset(Math.round(center.y));
    }
  }, [models]);

  // Apply Material Colors, Wireframe and Selection Highlights
  useEffect(() => {
    const rootGroup = modelsRootGroupRef.current;

    rootGroup.traverse((child: any) => {
      if (child.isMesh && child.userData.originalMaterial) {
        const u = child.userData;
        const isSelected = (selectedExpressID !== null) &&
          (u.expressID === selectedExpressID || child.parent?.userData?.expressID === selectedExpressID) &&
          (!selectedModelId || u.modelId === selectedModelId || child.parent?.userData?.modelId === selectedModelId);

        if (isSelected) {
          child.material = highlightMaterialRef.current;
        } else {
          let baseMat = u.originalMaterial;

          if (colorMode === 'category' && u.categoryColor) {
            baseMat = getColoredMaterial(u.categoryColor, u.originalMaterial.transparent, u.originalMaterial.opacity);
          } else if (colorMode === 'storey' && u.storeyColor) {
            baseMat = getColoredMaterial(u.storeyColor, u.originalMaterial.transparent, u.originalMaterial.opacity);
          }

          child.material = baseMat;
          child.material.wireframe = wireframeMode;
        }
      }
    });
  }, [models, selectedModelId, selectedExpressID, colorMode, wireframeMode]);

  // Apply Node Visibility Filter from Spatial Tree
  useEffect(() => {
    const rootGroup = modelsRootGroupRef.current;

    rootGroup.traverse((child: any) => {
      if (child.isMesh || child.isGroup) {
        const u = child.userData;
        if (!u) return;

        let shouldBeHidden = false;

        // Check if model is hidden
        if (u.modelId && hiddenNodeIds.has(`model_${u.modelId}`)) {
          shouldBeHidden = true;
        }
        // Check if storey is hidden
        if (u.storeyName && (hiddenNodeIds.has(`storey_${u.modelId}_${u.storeyName}`) || hiddenNodeIds.has(`global_storey_${u.storeyName}`))) {
          shouldBeHidden = true;
        }
        // Check if category is hidden
        if (u.categoryName && (hiddenNodeIds.has(`cat_${u.modelId}_${u.storeyName}_${u.categoryName}`) || hiddenNodeIds.has(`global_cat_${u.categoryName}`))) {
          shouldBeHidden = true;
        }
        // Check if element is hidden
        if (u.expressID !== undefined && (hiddenNodeIds.has(`elem_${u.modelId}_${u.expressID}`) || hiddenNodeIds.has(`global_elem_${u.expressID}`))) {
          shouldBeHidden = true;
        }

        child.visible = !shouldBeHidden;
      }
    });
  }, [hiddenNodeIds, models]);

  // Apply Clipping Plane
  useEffect(() => {
    const rootGroup = modelsRootGroupRef.current;

    const normal = new THREE.Vector3(
      clippingAxis === 'x' ? -1 : 0,
      clippingAxis === 'y' ? -1 : 0,
      clippingAxis === 'z' ? -1 : 0
    );

    clipPlaneRef.current.set(normal, clippingOffset);

    rootGroup.traverse((child: any) => {
      if (child.isMesh && child.material) {
        if (clippingActive) {
          child.material.clippingPlanes = [clipPlaneRef.current];
          child.material.clipShadows = true;
        } else {
          child.material.clippingPlanes = [];
        }
        child.material.needsUpdate = true;
      }
    });
  }, [clippingActive, clippingAxis, clippingOffset, models]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    selectElement: (modelId: string | null, expressID: number | null) => {
      onSelectElement(modelId, expressID);
    },
    toggleNodeVisibility: (node: SpatialNode, visible: boolean) => {
      // Managed via hiddenNodeIds in App state
    },
    toggleStoreyVisibility: (storeyName: string, visible: boolean) => {
      // Managed via App state
    },
    toggleCategoryVisibility: (categoryName: string, visible: boolean) => {
      // Managed via App state
    },
    toggleModelVisibility: (modelId: string, visible: boolean) => {
      // Managed via App state
    },
    isolateElement: (modelId: string, expressID: number) => {
      const rootGroup = modelsRootGroupRef.current;
      rootGroup.traverse((child: any) => {
        if (child.isMesh) {
          const match = child.userData?.expressID === expressID && (!modelId || child.userData?.modelId === modelId);
          child.visible = match;
        }
      });
    },
    hideElement: (modelId: string, expressID: number) => {
      const rootGroup = modelsRootGroupRef.current;
      rootGroup.traverse((child: any) => {
        if (child.isMesh) {
          const match = child.userData?.expressID === expressID && (!modelId || child.userData?.modelId === modelId);
          if (match) child.visible = false;
        }
      });
      if (selectedExpressID === expressID) {
        onSelectElement(null, null);
      }
    },
    showAll: () => {
      const rootGroup = modelsRootGroupRef.current;
      rootGroup.traverse((child: any) => {
        if (child.isMesh || child.isGroup) {
          child.visible = true;
        }
      });
    },
    fitView: () => {
      const rootGroup = modelsRootGroupRef.current;
      if (!cameraRef.current || !controlsRef.current || rootGroup.children.length === 0) return;
      const box = new THREE.Box3().setFromObject(rootGroup);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      const cameraDistance = (maxDim / 2) / Math.tan((45 * Math.PI) / 360) * 1.5;
      cameraRef.current.position.set(center.x + cameraDistance * 0.7, center.y + cameraDistance * 0.5, center.z + cameraDistance * 0.7);
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    },
    setCameraView: (view: 'top' | 'front' | 'right' | 'iso') => {
      const rootGroup = modelsRootGroupRef.current;
      if (!cameraRef.current || !controlsRef.current || rootGroup.children.length === 0) return;
      const box = new THREE.Box3().setFromObject(rootGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const dist = Math.max(size.x, size.y, size.z) * 1.8;

      if (view === 'top') {
        cameraRef.current.position.set(center.x, center.y + dist, center.z);
      } else if (view === 'front') {
        cameraRef.current.position.set(center.x, center.y, center.z + dist);
      } else if (view === 'right') {
        cameraRef.current.position.set(center.x + dist, center.y, center.z);
      } else {
        cameraRef.current.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
      }
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    },
    takeScreenshot: () => {
      if (!rendererRef.current) return '';
      return rendererRef.current.domElement.toDataURL('image/png');
    }
  }));

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-bim-950">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Navigation Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <div className="bg-bim-900/90 backdrop-blur border border-bim-700/60 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1">
          <button
            title="Ajustar a la vista (Fit)"
            onClick={() => {
              const rootGroup = modelsRootGroupRef.current;
              if (cameraRef.current && controlsRef.current && rootGroup.children.length > 0) {
                const box = new THREE.Box3().setFromObject(rootGroup);
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size);
                box.getCenter(center);
                const maxDim = Math.max(size.x, size.y, size.z);
                const cameraDistance = (maxDim / 2) / Math.tan((45 * Math.PI) / 360) * 1.5;
                cameraRef.current.position.set(center.x + cameraDistance * 0.7, center.y + cameraDistance * 0.5, center.z + cameraDistance * 0.7);
                controlsRef.current.target.copy(center);
                controlsRef.current.update();
              }
            }}
            className="p-2 text-slate-300 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            <Maximize2 size={18} />
          </button>

          <button
            title="Vista Superior (Planta)"
            onClick={() => {
              const rootGroup = modelsRootGroupRef.current;
              if (cameraRef.current && controlsRef.current && rootGroup.children.length > 0) {
                const box = new THREE.Box3().setFromObject(rootGroup);
                const center = box.getCenter(new THREE.Vector3());
                const dist = box.getSize(new THREE.Vector3()).length() * 1.2;
                cameraRef.current.position.set(center.x, center.y + dist, center.z);
                controlsRef.current.target.copy(center);
                controlsRef.current.update();
              }
            }}
            className="p-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            TOP
          </button>

          <button
            title="Vista Frontal"
            onClick={() => {
              const rootGroup = modelsRootGroupRef.current;
              if (cameraRef.current && controlsRef.current && rootGroup.children.length > 0) {
                const box = new THREE.Box3().setFromObject(rootGroup);
                const center = box.getCenter(new THREE.Vector3());
                const dist = box.getSize(new THREE.Vector3()).length() * 1.2;
                cameraRef.current.position.set(center.x, center.y, center.z + dist);
                controlsRef.current.target.copy(center);
                controlsRef.current.update();
              }
            }}
            className="p-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            FRONT
          </button>

          <button
            title="Vista Isométrica 3D"
            onClick={() => {
              const rootGroup = modelsRootGroupRef.current;
              if (cameraRef.current && controlsRef.current && rootGroup.children.length > 0) {
                const box = new THREE.Box3().setFromObject(rootGroup);
                const center = box.getCenter(new THREE.Vector3());
                const dist = box.getSize(new THREE.Vector3()).length() * 1.2;
                cameraRef.current.position.set(center.x + dist * 0.7, center.y + dist * 0.5, center.z + dist * 0.7);
                controlsRef.current.target.copy(center);
                controlsRef.current.update();
              }
            }}
            className="p-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            3D ISO
          </button>
        </div>

        {/* View Mode, Clipping & Grid Toggle Buttons */}
        <div className="bg-bim-900/90 backdrop-blur border border-bim-700/60 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1">
          <button
            title={showGrid ? "Ocultar Rejilla de Fondo" : "Mostrar Rejilla de Fondo"}
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition ${showGrid ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-bim-800'}`}
          >
            <Grid size={18} />
          </button>

          <button
            title="Corte / Sección interactiva"
            onClick={() => setClippingActive(!clippingActive)}
            className={`p-2 rounded-lg transition ${clippingActive ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-bim-800'}`}
          >
            <Scissors size={18} />
          </button>

          <button
            title="Modo Alámbrico / Sólido"
            onClick={() => setWireframeMode(!wireframeMode)}
            className={`p-2 rounded-lg transition ${wireframeMode ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-bim-800'}`}
          >
            <Layers size={18} />
          </button>
        </div>
      </div>

      {/* Interactive Section / Clipping Plane Drawer */}
      {clippingActive && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-bim-900/95 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-2xl z-20 flex items-center gap-4 text-xs font-medium text-slate-200">
          <div className="flex items-center gap-2 font-bold text-cyan-400">
            <Scissors size={16} />
            <span>PLANO DE CORTE</span>
          </div>

          <div className="flex items-center gap-1 bg-bim-950 p-1 rounded-lg border border-bim-800">
            <button
              onClick={() => setClippingAxis('x')}
              className={`px-3 py-1 rounded-md transition font-semibold ${clippingAxis === 'x' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              EJE X
            </button>
            <button
              onClick={() => setClippingAxis('y')}
              className={`px-3 py-1 rounded-md transition font-semibold ${clippingAxis === 'y' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              EJE Y (Altura)
            </button>
            <button
              onClick={() => setClippingAxis('z')}
              className={`px-3 py-1 rounded-md transition font-semibold ${clippingAxis === 'z' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              EJE Z
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-[200px]">
            <input
              type="range"
              min={clippingRange.min}
              max={clippingRange.max}
              step={0.1}
              value={clippingOffset}
              onChange={(e) => setClippingOffset(parseFloat(e.target.value))}
              className="w-full h-2 bg-bim-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="w-12 text-right font-mono text-cyan-300">{clippingOffset.toFixed(1)}m</span>
          </div>

          <button
            onClick={() => setClippingActive(false)}
            className="px-2.5 py-1 text-slate-400 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
});
