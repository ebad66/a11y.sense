import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { VisualizerIssue, BodyRegion, WCAGPrinciple } from '@/visualization/types';
import { REGION_MESHES, PRINCIPLE_TO_REGION } from '@/visualization/bodyPartMapping';
import { getSeverityStyle, getHighestSeverity } from '@/visualization/skeletonHighlight';

interface SkeletonViewerProps {
  issues: VisualizerIssue[];
  activeRegion: BodyRegion | null;
  onRegionSelect: (region: BodyRegion) => void;
}

const UI_ANCHORS: Record<BodyRegion, [number, number, number]> = {
  Brain: [-2.5, 2.8, 0],
  EyesEars: [-2.5, 1.8, 0],
  Hands: [-2.5, 0.5, 0],
  Spine: [-2.5, -0.5, 0]
};

function CyberLine({
  scene,
  localStart,
  endPoint,
  color
}: {
  scene: THREE.Group;
  localStart: THREE.Vector3;
  endPoint: [number, number, number];
  color: THREE.Color;
}) {
  const lineRef = useRef<any>(null);

  useFrame(() => {
    if (lineRef.current) {
      const worldStart = localStart.clone();
      scene.localToWorld(worldStart);

      const positions = [
        worldStart.x, worldStart.y, worldStart.z,
        // Adds a cybernetic bend: halfway across X, maintain Y of start, then go to end point
        (worldStart.x + endPoint[0]) / 2, worldStart.y, worldStart.z / 2,
        endPoint[0], endPoint[1], endPoint[2]
      ];
      lineRef.current.geometry.setPositions(positions);
    }
  });

  return (
    <>
      <Line
        ref={lineRef}
        points={[[0, 0, 0], [0, 0, 0], [0, 0, 0]]} // Initialize with 3 arbitrary points
        color={color}
        lineWidth={2}
        transparent
        opacity={0.8}
      />
      <Html position={new THREE.Vector3(...endPoint)} center>
        <div style={{
          width: 8, height: 8,
          backgroundColor: color.getStyle(),
          borderRadius: '50%',
          boxShadow: `0 0 12px ${color.getStyle()}`,
          border: '1px solid #fff'
        }} />
      </Html>
    </>
  );
}

export function SkeletonViewer({ issues, activeRegion, onRegionSelect }: SkeletonViewerProps) {
  const { scene: skeletonScene } = useGLTF('/skeleton.glb');
  const { scene: brainScene } = useGLTF('/brain_point_cloud.glb');
  const clonedSkeleton = useMemo(() => skeletonScene.clone(), [skeletonScene]);
  const clonedBrain = useMemo(() => brainScene.clone(), [brainScene]);
  
  const timeRef = useRef(0);
  const [centers, setCenters] = useState<Partial<Record<BodyRegion, THREE.Vector3>>>({});

  const regionSeverities = useMemo(() => {
    const map: Partial<Record<BodyRegion, ReturnType<typeof getHighestSeverity>>> = {};
    (['EyesEars', 'Hands', 'Brain', 'Spine'] as BodyRegion[]).forEach(region => {
      const relevantIssues = issues.filter(i => PRINCIPLE_TO_REGION[i.principle] === region);
      if (relevantIssues.length > 0) {
        map[region] = getHighestSeverity(relevantIssues);
      }
    });
    return map;
  }, [issues]);

  useMemo(() => {
    clonedSkeleton.updateMatrixWorld(true);
    const tempCenters: Partial<Record<BodyRegion, THREE.Vector3>> = {};

    clonedSkeleton.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        // Clone materials to preserve colors but allow localized glow changes
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => m.clone());
        } else {
          mesh.material = mesh.material.clone();
        }

        // Region detection
        let targetRegion: BodyRegion | null = null;
        for (const [region, meshNames] of Object.entries(REGION_MESHES)) {
          if (meshNames.some(n => mesh.name.toLowerCase().includes(n.toLowerCase()))) {
            targetRegion = region as BodyRegion;
            break;
          }
        }
        mesh.userData.region = targetRegion;

        if (targetRegion && !tempCenters[targetRegion]) {
          mesh.geometry.computeBoundingBox();
          const centerLocal = new THREE.Vector3();
          mesh.geometry.boundingBox?.getCenter(centerLocal);
          tempCenters[targetRegion] = centerLocal;
        }
      }
    });
    setCenters(tempCenters);
  }, [clonedSkeleton]);
  
  // Setup brain materials and center its geometry so it rotates perfectly evenly
  useMemo(() => {
    clonedBrain.traverse((child) => {
      // Basic setup in case it needs custom materials for the point cloud
      if ((child as THREE.Points).isPoints || (child as THREE.Mesh).isMesh) {
        if ((child as THREE.Mesh).geometry) {
           (child as THREE.Mesh).geometry.center();
        }
      }
    });
  }, [clonedBrain]);

  const controlsRef = useRef<OrbitControlsImpl>(null);

  // Region camera targets mapping (Pos = Camera position, Target = lookAt point on character)
  const REGION_TARGETS: Record<BodyRegion, { pos: THREE.Vector3, target: THREE.Vector3 }> = useMemo(() => ({
    // Brain point cloud floats at 0,0,0 - Zoomed in tighter to fill the screen
    Brain: { pos: new THREE.Vector3(0, 0, 3.2), target: new THREE.Vector3(0, 0, 0) },
    // EyesEars: Flat look from top of head to mid chest (lowered slightly)
    EyesEars: { pos: new THREE.Vector3(0, 0.8, 4.0), target: new THREE.Vector3(0, 0.8, 0) },
    // Hands: focusing specifically on the right hand (viewer's left side). X: -2 offset.
    Hands: { pos: new THREE.Vector3(-2, -1, 4), target: new THREE.Vector3(-1.5, -3, 0) },
    Spine: { pos: new THREE.Vector3(0, 0.5, 7), target: new THREE.Vector3(0, 0.5, 0) },
  }), []);

  // Default camera target - matching the Hands region exactly
  const DEFAULT_CAMERA = { pos: new THREE.Vector3(0, -0.5, 6), target: new THREE.Vector3(0, -0.5, 0) };

  useFrame((state, delta) => {
    timeRef.current += delta;

    // Slighly bob around base Y
    clonedSkeleton.position.y = -2.5 + Math.sin(timeRef.current * 1.5) * 0.05;
    
    // Rotate and bob brain
    clonedBrain.position.y = Math.sin(timeRef.current * 2) * 0.1;
    clonedBrain.rotation.y += delta * 0.2;

    // Smooth camera interpolation
    if (controlsRef.current) {
      const targetState = activeRegion ? REGION_TARGETS[activeRegion] : DEFAULT_CAMERA;
      if (targetState) {
        state.camera.position.lerp(targetState.pos, 0.08);
        controlsRef.current.target.lerp(targetState.target, 0.08);
        controlsRef.current.update();
      }
    }

    clonedSkeleton.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const region = mesh.userData.region as BodyRegion | null;

        const applyGlow = (mat: THREE.Material) => {
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            // Ensure material preserves texture but adds a cyber vibe
            mat.transparent = true;
            mat.opacity = Math.min(mat.opacity, 0.95);

            let emissiveColor = new THREE.Color(0x000000);
            let emissiveIntensity = 0;

            if (region) {
              const isHighlighted = activeRegion === null || activeRegion === region;
              const severity = regionSeverities[region];

              if (isHighlighted && severity && severity !== 'Pass') {
                const style = getSeverityStyle(severity);
                emissiveColor = style.color;
                emissiveIntensity = style.intensity * (0.5 + 0.5 * Math.sin(timeRef.current * 4));
              }
            }

            mat.emissive = emissiveColor;
            mat.emissiveIntensity = emissiveIntensity;
          }
        };

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(applyGlow);
        } else {
          applyGlow(mesh.material);
        }
      }
    });
    
    // Brain pulse animation
    const brainSeverity = regionSeverities['Brain'];
    clonedBrain.traverse((child) => {
       const mat = (child as any).material;
       if (mat) {
          if (brainSeverity && brainSeverity !== 'Pass') {
            const style = getSeverityStyle(brainSeverity);
            if (mat.color) {
               // Base color mixed with hazard color
               mat.color.lerp(style.color, 0.1); 
            }
            if (mat.emissive) {
               mat.emissive.copy(style.color);
               mat.emissiveIntensity = style.intensity * (0.5 + 0.5 * Math.sin(timeRef.current * 3));
            }
          }
       }
    });
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    const obj = e.object;
    if (obj && obj.userData && obj.userData.region) {
      onRegionSelect(obj.userData.region);
    }
  };

  const activeRegionsToDraw = Object.entries(regionSeverities).filter(([r, sev]) => {
    return sev && sev !== 'Pass' && (activeRegion === null || activeRegion === r);
  });

  return (
    <>
      <ambientLight intensity={0.8} color="#ffffff" />
      <directionalLight position={[5, 10, 5]} intensity={1} color="#6366f1" />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#10b981" />
      <directionalLight position={[0, -10, 0]} intensity={0.5} color="#8b5cf6" />

      <primitive
        object={clonedSkeleton}
        position={[0, -2.5, 0]}
        scale={3.6}
        visible={activeRegion !== 'Brain'}
        onClick={handleClick}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          if (e.object.userData.region) {
            document.body.style.cursor = 'pointer';
          }
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      />
      
      {/* Brain Point Cloud Model */}
      <primitive
         object={clonedBrain}
         position={[0, 0, 0]}
         scale={3.0} // Adjust scale as needed based on the file's natural size
         visible={activeRegion === 'Brain'}
      />

      {activeRegionsToDraw.map(([region, severity]) => {
        // Hide the connection line completely when viewing the specific Brain model
        if (activeRegion === 'Brain') return null;
        
        // At this point activeRegion is guaranteed to not be 'Brain' due to the return above.
        // The skeleton regions handles lines normally:
        const centerLocal = centers[region as BodyRegion];
        if (!centerLocal) return null;
        const color = getSeverityStyle(severity as any).color;

        return (
          <CyberLine
            key={region}
            scene={clonedSkeleton}
            localStart={centerLocal}
            endPoint={UI_ANCHORS[region as BodyRegion]}
            color={color}
          />
        );
      })}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={false}
        enableRotate={false}
      />
    </>
  );
}

useGLTF.preload('/skeleton.glb');
useGLTF.preload('/brain_point_cloud.glb');
