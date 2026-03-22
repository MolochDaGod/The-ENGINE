import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, SphereGeometry, CylinderGeometry, ConeGeometry, MeshStandardMaterial, Vector3, AdditiveBlending, OctahedronGeometry, TorusGeometry } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { ObjectPool } from '@/utils/ObjectPool';
import EliteRenderer from './EliteRenderer';

interface EliteEnemyRendererProps {
  entityId: number;
  world: World;
  onMeshReady?: (mesh: Group) => void;
}

// Object pools for performance optimization
const geometryPool = new ObjectPool(
  () => ({
    octahedron: new OctahedronGeometry(0.8, 0),
    sphere: new SphereGeometry(0.325, 16, 16),
    cylinder: new CylinderGeometry(0.15, 0.15, 1.0, 6),
    torus: new TorusGeometry(0.4, 0.05, 8, 16),
    cone: new ConeGeometry(0.075, 0.3, 6),
    aura: new SphereGeometry(1.35, 16, 16)
  }),
  (geometries) => {
    // Geometries don't need reset
  },
  10
);

const materialPool = new ObjectPool(
  () => ({
    body: new MeshStandardMaterial({
      color: "#4FC3F7",
      emissive: "#29B6F6",
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
      metalness: 0.8,
      roughness: 0.2
    }),
    head: new MeshStandardMaterial({
      color: "#81D4FA",
      emissive: "#4FC3F7",
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
      metalness: 0.7,
      roughness: 0.3
    }),
    shoulder: new MeshStandardMaterial({
      color: "#81D4FA",
      emissive: "#4FC3F7",
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
      metalness: 0.7,
      roughness: 0.3
    }),
    ring: new MeshStandardMaterial({
      color: "#E1F5FE",
      emissive: "#B3E5FC",
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.9,
      metalness: 0.8,
      roughness: 0.2
    }),
    arm: new MeshStandardMaterial({
      color: "#4FC3F7",
      emissive: "#29B6F6",
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.675,
      metalness: 0.6,
      roughness: 0.4
    }),
    aura: new MeshStandardMaterial({
      color: "#29B6F6",
      emissive: "#0277BD",
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: AdditiveBlending
    }),
    icicle: new MeshStandardMaterial({
      color: "#CCFFFF",
      emissive: "#CCFFFF",
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 1.0
    })
  }),
  (materials) => {
    // Reset material properties
    Object.values(materials).forEach(material => {
      material.needsUpdate = true;
    });
  },
  10
);

export default function EliteEnemyRenderer({ 
  entityId, 
  world,
  onMeshReady
}: EliteEnemyRendererProps) {
  const groupRef = useRef<Group>(null);
  const positionRef = useRef(new Vector3());
  const healthRef = useRef(1.0);
  const isDeadRef = useRef(false);
  
  // Memoized materials and geometries for performance
  const { geometries, materials } = useMemo(() => {
    return {
      geometries: geometryPool.acquire(),
      materials: materialPool.acquire()
    };
  }, []);

  // Update entity data from ECS
  useFrame(() => {
    const entity = world.getEntity(entityId);
    if (!entity) return;

    const transform = entity.getComponent(Transform);
    const health = entity.getComponent(Health);
    const enemy = entity.getComponent(Enemy);

    if (transform) {
      positionRef.current.copy(transform.position);
    }

    if (health) {
      healthRef.current = health.currentHealth / health.maxHealth;
    }

    if (enemy) {
      isDeadRef.current = enemy.isDead;
    }

    // Handle death state
    if (isDeadRef.current && groupRef.current) {
      groupRef.current.visible = false;
    } else if (groupRef.current) {
      groupRef.current.visible = true;
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      geometryPool.release(geometries);
      materialPool.release(materials);
    };
  }, [geometries, materials]);

  // Health-based material opacity
  useEffect(() => {
    const opacity = Math.max(0.3, healthRef.current);
    materials.body.opacity = 0.9 * opacity;
    materials.head.opacity = 0.85 * opacity;
    materials.shoulder.opacity = 0.85 * opacity;
    materials.arm.opacity = 0.675 * opacity;
  }, [materials, healthRef.current]);

  return (
    <EliteRenderer
      entityId={entityId}
      position={positionRef.current}
      world={world}
      onMeshReady={onMeshReady}
    />
  );
}
