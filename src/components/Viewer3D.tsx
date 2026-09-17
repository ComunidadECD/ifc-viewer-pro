import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LoadedIFCModel } from '../types/ifc';
import { Eye, Layers, Maximize2, Scissors } from 'lucide-react';

export interface Viewer3DRef {
  selectElement: (expressID: number | null) => void;
  isolateElement: (expressID: number) => void;
  hideElement: (expressID: number) => void;
  showAll: () => void;
  fitView: () => void;
  setCameraView: (view: 'top' | 'front' | 'right' | 'iso') => void;
  takeScreenshot: () => string;
}

interface Viewer3DProps {
  model: LoadedIFCModel | null;
  selectedExpressID: number | null;
  onSelectElement: (expressID: number | null) => void;
}

export const Viewer3D = forwardRef<Viewer3DRef, Viewer3DProps>(({
  model,
  selectedExpressID,
  onSelectElement
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const [clippingActive, setClippingActive] = useState<boolean>(false);
  const [clippingAxis, setClippingAxis] = useState<'x' | 'y' | 'z'>('z');
  const [clippingOffset, setClippingOffset] = useState<number>(0);
  const [clippingRange, setClippingRange] = useState<{ min: number; max: number }>({ min: -50, max: 50 });
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);

  const clipPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0));
  const highlightMaterialRef = useRef<THREE.MeshStandardMaterial>(
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.3,
      side: THREE.DoubleSide
    })
  );

  const hiddenElementsRef = useRef<Set<number>>(new Set());

  // Setup Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(20, 20, 20);
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(50, 100, 50);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 2048;
    dirLight1.shadow.mapSize.height = 2048;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.4);
    dirLight2.position.set(-50, -30, -50);
    scene.add(dirLight2);

    const grid = new THREE.GridHelper(100, 50, 0x3b82f6, 0x1e293b);
    grid.position.y = -0.01;
    scene.add(grid);

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
      if (model?.meshGroup) {
        const intersects = raycaster.intersectObjects(model.meshGroup.children, true);
        const visibleIntersects = intersects.filter(hit => hit.object.visible);

        if (visibleIntersects.length > 0) {
          const hitMesh = visibleIntersects[0].object as THREE.Mesh;
          const expID = hitMesh.userData?.expressID || hitMesh.parent?.userData?.expressID;
          if (expID) {
            onSelectElement(expID);
            return;
          }
        }
      }
      onSelectElement(null);
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

  // Update Model in Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const toRemove: THREE.Object3D[] = [];
    scene.children.forEach(c => {
      if (c.name && c.name.startsWith('IFCModel_')) {
        toRemove.push(c);
      }
    });
    toRemove.forEach(c => scene.remove(c));

    hiddenElementsRef.current.clear();

    if (model?.meshGroup) {
      scene.add(model.meshGroup);

      const box = new THREE.Box3().setFromObject(model.meshGroup);
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
  }, [model]);

  // Apply Selection Highlight
  useEffect(() => {
    if (!model?.meshGroup) return;

    model.meshGroup.traverse((child: any) => {
      if (child.isMesh && child.userData.originalMaterial) {
        const isSelected = child.userData.expressID === selectedExpressID || child.parent?.userData?.expressID === selectedExpressID;
        if (isSelected) {
          child.material = highlightMaterialRef.current;
        } else {
          child.material = child.userData.originalMaterial;
          child.material.wireframe = wireframeMode;
        }
      }
    });
  }, [selectedExpressID, model, wireframeMode]);

  // Apply Clipping Plane
  useEffect(() => {
    if (!model?.meshGroup) return;

    const normal = new THREE.Vector3(
      clippingAxis === 'x' ? -1 : 0,
      clippingAxis === 'y' ? -1 : 0,
      clippingAxis === 'z' ? -1 : 0
    );

    clipPlaneRef.current.set(normal, clippingOffset);

    model.meshGroup.traverse((child: any) => {
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
  }, [clippingActive, clippingAxis, clippingOffset, model]);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    selectElement: (expressID: number | null) => {
      onSelectElement(expressID);
    },
    isolateElement: (expressID: number) => {
      if (!model?.meshGroup) return;
      model.meshGroup.traverse((child: any) => {
        if (child.isMesh) {
          const match = child.userData?.expressID === expressID || child.parent?.userData?.expressID === expressID;
          child.visible = match;
        }
      });
    },
    hideElement: (expressID: number) => {
      if (!model?.meshGroup) return;
      hiddenElementsRef.current.add(expressID);
      model.meshGroup.traverse((child: any) => {
        if (child.isMesh) {
          if (child.userData?.expressID === expressID || child.parent?.userData?.expressID === expressID) {
            child.visible = false;
          }
        }
      });
      if (selectedExpressID === expressID) {
        onSelectElement(null);
      }
    },
    showAll: () => {
      if (!model?.meshGroup) return;
      hiddenElementsRef.current.clear();
      model.meshGroup.traverse((child: any) => {
        if (child.isMesh) {
          child.visible = true;
        }
      });
    },
    fitView: () => {
      if (!model?.meshGroup || !cameraRef.current || !controlsRef.current) return;
      const box = new THREE.Box3().setFromObject(model.meshGroup);
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
      if (!model?.meshGroup || !cameraRef.current || !controlsRef.current) return;
      const box = new THREE.Box3().setFromObject(model.meshGroup);
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
              if (model?.meshGroup && cameraRef.current && controlsRef.current) {
                const box = new THREE.Box3().setFromObject(model.meshGroup);
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
              if (model?.meshGroup && cameraRef.current && controlsRef.current) {
                const box = new THREE.Box3().setFromObject(model.meshGroup);
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
              if (model?.meshGroup && cameraRef.current && controlsRef.current) {
                const box = new THREE.Box3().setFromObject(model.meshGroup);
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
              if (model?.meshGroup && cameraRef.current && controlsRef.current) {
                const box = new THREE.Box3().setFromObject(model.meshGroup);
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

        {/* View Mode & Clipping Buttons */}
        <div className="bg-bim-900/90 backdrop-blur border border-bim-700/60 rounded-xl p-1.5 shadow-2xl flex flex-col gap-1">
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

          <button
            title="Mostrar todos los elementos"
            onClick={() => {
              if (model?.meshGroup) {
                hiddenElementsRef.current.clear();
                model.meshGroup.traverse((child: any) => {
                  if (child.isMesh) child.visible = true;
                });
              }
            }}
            className="p-2 text-slate-300 hover:text-white hover:bg-bim-800 rounded-lg transition"
          >
            <Eye size={18} />
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
