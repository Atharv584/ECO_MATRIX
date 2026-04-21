import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Center } from '@react-three/drei';
import * as THREE from 'three';
import { ROLE_COLORS } from '../utils';

const getBounds = (entity) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (entity.type === 'LWPOLYLINE' || entity.type === 'LINE') {
        const pts = entity.type === 'LINE' ? [entity.start, entity.end] : entity.points;
        pts.forEach(p => {
            if (p[0] < minX) minX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] > maxY) maxY = p[1];
        });
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

const getCentroid = (bounds) => {
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
};

const Entity = ({ entity, layerConfig, defaultColor, rccSettings, floorHeight }) => {
    const { type } = entity;
    const role = layerConfig?.role || 'generic';

    const color = ROLE_COLORS[role] || layerConfig?.color || defaultColor || '#ffffff';
    const isMeters = rccSettings?.unitSystem === 'm';

    const defaults = {
        floorHeight: isMeters ? 5 : 5000,
        windowHeight: isMeters ? 2 : 2000,
        windowSill: isMeters ? 1 : 1000,
        doorHeight: isMeters ? 2 : 2000,
        beamDepth: isMeters ? 0.45 : 450,
        slabThickness: isMeters ? 1 : 1000
    };

    let extrusionDepth = 0;
    let zOffset = 0;

    if (role === 'column') {
        extrusionDepth = floorHeight;
    } else if (role === 'wall' || role === 'brick_wall') {
        const beamDepth = rccSettings?.beamDepth || defaults.beamDepth;
        extrusionDepth = Math.max(0, floorHeight - beamDepth);
    } else if (role === 'beam') {
        extrusionDepth = rccSettings?.beamDepth || defaults.beamDepth;
        zOffset = floorHeight - extrusionDepth; // Top of floor
    } else if (role === 'slab') {
        extrusionDepth = rccSettings?.slabThickness || defaults.slabThickness;
        zOffset = 0;
    } else if (role === 'window') {
        extrusionDepth = layerConfig.height !== undefined ? layerConfig.height : defaults.windowHeight;
        zOffset = layerConfig.sill !== undefined ? layerConfig.sill : defaults.windowSill;
    } else if (role === 'door') {
        extrusionDepth = layerConfig.height !== undefined ? layerConfig.height : defaults.doorHeight;
        zOffset = 0;
    } else if (role === 'wc') {
        extrusionDepth = rccSettings?.slabThickness || defaults.slabThickness;
        zOffset = 0;
    } else if (role === 'footing_base') {
        extrusionDepth = layerConfig.height || 0.5;
        zOffset = 0;
    } else if (role === 'footing_slope') {
        // Standard geometric rendering for slope if visible as a flat shape (e.g. cross lines)
        // We will render the 3D volume separately in Viewer, but here we can render the 2D lines/shapes flat at Z=0
        extrusionDepth = 0;
        zOffset = 0;
    } else {
        extrusionDepth = 0;
    }

    const material = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.5,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
    }, [color]);

    const lineMaterial = useMemo(() => {
        return new THREE.LineBasicMaterial({ color: color });
    }, [color]);

    const renderExtrudedShape = (shape, depth, zPos, keySuffix) => {
        const extrudeSettings = { depth: depth, bevelEnabled: false };
        return (
            <mesh key={keySuffix} position={[0, 0, zPos]} material={material}>
                <extrudeGeometry args={[shape, extrudeSettings]} />
            </mesh>
        );
    };

    // 1. Prepare Geometry
    let shapes = [];
    let geometry = null;

    if (type === 'HATCH' && entity.paths) {
        entity.paths.forEach(path => {
            const s = new THREE.Shape();
            path.forEach((p, i) => i === 0 ? s.moveTo(p[0], p[1]) : s.lineTo(p[0], p[1]));
            if (path.length) s.lineTo(path[0][0], path[0][1]);
            shapes.push(s);
        });
    } else if (type === 'LWPOLYLINE' && entity.closed) {
        const s = new THREE.Shape();
        entity.points.forEach((p, i) => i === 0 ? s.moveTo(p[0], p[1]) : s.lineTo(p[0], p[1]));
        shapes.push(s);
    } else if (type === 'CIRCLE') {
        const s = new THREE.Shape();
        s.absarc(entity.center[0], entity.center[1], entity.radius, 0, Math.PI * 2, false);
        shapes.push(s);
    } else if (type === 'LWPOLYLINE' && !entity.closed && role === 'generic') {
        const points = entity.points.map(p => new THREE.Vector3(p[0], p[1], 0));
        geometry = new THREE.BufferGeometry().setFromPoints(points);
    } else if (type === 'LINE' && role === 'generic') {
        const points = [new THREE.Vector3(...entity.start), new THREE.Vector3(...entity.end)];
        geometry = new THREE.BufferGeometry().setFromPoints(points);
    }

    // 2. Render
    const renderInstances = [];

    if (shapes.length > 0 && extrusionDepth > 0) {
        shapes.forEach((s, i) => {
            renderInstances.push(renderExtrudedShape(s, extrusionDepth, zOffset, `shape-${i}`));

            if (role === 'window' || role === 'door') {
                const wallColor = ROLE_COLORS.wall;
                const wallMaterial = new THREE.MeshStandardMaterial({
                    color: wallColor,
                    roughness: 0.5,
                    metalness: 0.1,
                    transparent: true,
                    opacity: 0.8,
                    side: THREE.DoubleSide
                });

                const renderFiller = (depth, z, key) => {
                    if (depth <= 0) return null;
                    const extrudeSettings = { depth: depth, bevelEnabled: false };
                    return (
                        <mesh key={key} position={[0, 0, z]} material={wallMaterial}>
                            <extrudeGeometry args={[s, extrudeSettings]} />
                        </mesh>
                    );
                };

                const beamDepth = rccSettings?.beamDepth || defaults.beamDepth;
                const totalWallHeight = floorHeight - beamDepth;

                if (role === 'window') {
                    const sillHeight = layerConfig.sill !== undefined ? layerConfig.sill : defaults.windowSill;
                    const windowHeight = layerConfig.height !== undefined ? layerConfig.height : defaults.windowHeight;
                    renderInstances.push(renderFiller(sillHeight, 0, `sill-${i}`));
                    const topOfWindow = sillHeight + windowHeight;
                    const heightAbove = Math.max(0, totalWallHeight - topOfWindow);
                    renderInstances.push(renderFiller(heightAbove, topOfWindow, `lintel-${i}`));
                } else if (role === 'door') {
                    const doorHeight = layerConfig.height !== undefined ? layerConfig.height : defaults.doorHeight;
                    const heightAbove = Math.max(0, totalWallHeight - doorHeight);
                    renderInstances.push(renderFiller(heightAbove, doorHeight, `door-lintel-${i}`));
                }
            }
        });
    } else if (shapes.length > 0) {
        shapes.forEach((s, i) => {
            renderInstances.push(<mesh key={i} material={material}><shapeGeometry args={[s]} /></mesh>);
        });
    } else if (geometry) {
        renderInstances.push(<line key="line" geometry={geometry} material={lineMaterial} />);
    }

    return <group>{renderInstances}</group>;
};

export default function Viewer({ floors, rccSettings, foundation }) {
    const isMeters = rccSettings?.unitSystem === 'm';
    const floorHeightDefault = isMeters ? 5 : 5000;

    return (
        <div className="w-full h-full bg-slate-900">
            <Canvas shadows camera={{ position: [100, 100, 100], fov: 45 }}>
                <OrbitControls makeDefault autoRotate={rccSettings?.autoRotate} />

                <Stage environment="city" intensity={0.5} contactShadow={false}>
                    <group rotation={[-Math.PI / 2, 0, 0]}>
                        {/* Foundation Rendering */}
                        {foundation && foundation.dxfData && (
                            <group position={[0, 0, -(foundation.depthOffset || 2)]}>
                                {(() => {
                                    // 1. Identify Roles and Collect Entities
                                    const baseEntities = [];
                                    const columnEntities = [];
                                    let slopeLayerConfig = null;

                                    foundation.dxfData.layers.forEach(l => {
                                        const config = foundation.config[l.id];
                                        if (!config || config.visible === false) return;

                                        if (config.role === 'footing_base') {
                                            l.entities.forEach(ent => baseEntities.push({ entity: ent, bounds: getBounds(ent), centroid: getCentroid(getBounds(ent)), layerConfig: config }));
                                        } else if (config.role === 'column') {
                                            l.entities.forEach(ent => columnEntities.push({ entity: ent, bounds: getBounds(ent), centroid: getCentroid(getBounds(ent)) }));
                                        } else if (config.role === 'footing_slope') {
                                            slopeLayerConfig = config;
                                        }
                                    });

                                    // 2. Render Standard Entities (Base, Columns, Generic)
                                    // We skip rendering 'footing_slope' entities here as 3D volumes to avoid double counting or weird shapes.
                                    // We ONLY render them if they are just 2D lines/shapes (handled by Entity default logic for flat shapes).
                                    // Actually, let's render everything via Entity, but Entity handles slope as flat/zero extrusion now.

                                    const renderedStandardLayers = foundation.dxfData.layers.map(layer => {
                                        const layerConfig = foundation.config[layer.id];
                                        if (layerConfig?.visible === false) return null;

                                        let zPos = 0;
                                        let extrusion = layerConfig.height || 0.5;

                                        if (layerConfig.role === 'footing_slope') {
                                            // Slopes are rendered procedurally below.
                                            // But if the user has drawing content (lines), let them be flat at Z=0 (Top of foundation)
                                            zPos = 0;
                                            extrusion = 0;
                                        } else if (layerConfig.role === 'footing_base') {
                                            const slopeH = slopeLayerConfig ? (slopeLayerConfig.height || 0.5) : 0;
                                            // Base sits below the slope.
                                            zPos = -slopeH - extrusion;
                                        } else if (layerConfig.role === 'column') {
                                            // Column in foundation usually sits on top of the slope (Z=0) going UP?
                                            // Or is it a pedestal going down?
                                            // "Rectangular prism connecting footing corners to column corners".
                                            // This implies column is at the top.
                                            // So Column Stump starts at 0 and goes UP (or stays at 0).
                                            zPos = 0;
                                            extrusion = foundation.depthOffset || 2; // Default stump height
                                        } else {
                                            zPos = 0;
                                        }

                                        return (
                                            <group key={layer.id} position={[0, 0, zPos]}>
                                                {layer.entities.map((entity, i) => (
                                                    <Entity
                                                        key={i}
                                                        entity={entity}
                                                        layerConfig={{ ...layerConfig, height: extrusion }}
                                                        defaultColor={layerConfig.color}
                                                        rccSettings={rccSettings}
                                                        floorHeight={rccSettings.floorHeight || floorHeightDefault}
                                                    />
                                                ))}
                                            </group>
                                        );
                                    });

                                    // 3. Render Procedural Slopes (Frustums)
                                    const proceduralSlopes = [];
                                    if (slopeLayerConfig && slopeLayerConfig.visible !== false) {
                                        const slopeHeight = slopeLayerConfig.height || 0.5;
                                        const slopeColor = slopeLayerConfig.color || ROLE_COLORS.footing_slope || '#FFFF00';

                                        const slopeMaterial = new THREE.MeshStandardMaterial({
                                            color: slopeColor,
                                            roughness: 0.5,
                                            metalness: 0.1,
                                            transparent: true,
                                            opacity: 0.8,
                                            side: THREE.DoubleSide
                                        });

                                        baseEntities.forEach((base, i) => {
                                            // Find matching Column
                                            let bestCol = null;
                                            let minDist = Infinity;

                                            // Threshold: e.g. 1 unit (Meter) or 1000 units (mm)
                                            // If units are unknown, we rely on centroid proximity relative to size.
                                            // Let's use a dynamic threshold based on Base Width?
                                            const threshold = Math.max(base.bounds.width, base.bounds.height) * 0.5;

                                            columnEntities.forEach(col => {
                                                const dist = Math.sqrt(Math.pow(base.centroid.x - col.centroid.x, 2) + Math.pow(base.centroid.y - col.centroid.y, 2));
                                                if (dist < threshold && dist < minDist) {
                                                    minDist = dist;
                                                    bestCol = col;
                                                }
                                            });

                                            if (bestCol) {
                                                // Create Frustum
                                                const topBounds = bestCol.bounds;
                                                const botBounds = base.bounds; // Base is at -slopeH.
                                                // We render the Frustum at Z=0 (Top) down to -slopeH?
                                                // Or geometry from 0 to -slopeH?
                                                // Entity standard was 0 to H.
                                                // Let's create geometry from Z=-slopeH (Base Top) to Z=0 (Column Bottom).

                                                const h = slopeHeight;
                                                // Vertices
                                                const vertices = new Float32Array([
                                                    // Bottom (at z = -h) -> Base Top
                                                    botBounds.minX, botBounds.minY, -h, // 0 BL
                                                    botBounds.maxX, botBounds.minY, -h, // 1 BR
                                                    botBounds.maxX, botBounds.maxY, -h, // 2 TR
                                                    botBounds.minX, botBounds.maxY, -h, // 3 TL

                                                    // Top (at z = 0) -> Column Bottom
                                                    topBounds.minX, topBounds.minY, 0, // 4 BL
                                                    topBounds.maxX, topBounds.minY, 0, // 5 BR
                                                    topBounds.maxX, topBounds.maxY, 0, // 6 TR
                                                    topBounds.minX, topBounds.maxY, 0  // 7 TL
                                                ]);

                                                const indices = [
                                                    0, 2, 1, 0, 3, 2, // Bottom
                                                    4, 5, 6, 4, 6, 7, // Top
                                                    0, 1, 5, 0, 5, 4, // Front
                                                    1, 2, 6, 1, 6, 5, // Right
                                                    2, 3, 7, 2, 7, 6, // Back
                                                    3, 0, 4, 3, 4, 7  // Left
                                                ];

                                                const bufferGeo = new THREE.BufferGeometry();
                                                bufferGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                                                bufferGeo.setIndex(indices);
                                                bufferGeo.computeVertexNormals();

                                                proceduralSlopes.push(
                                                    <mesh key={`slope-${i}`} geometry={bufferGeo} material={slopeMaterial} />
                                                );
                                            }
                                        });
                                    }

                                    return <group>{renderedStandardLayers}{proceduralSlopes}</group>;
                                })()}
                            </group>
                        )}

                        {floors.map((floor, idx) => {
                            if (!floor || !floor.dxfData) return null; // Skip if no code uploaded for this floor

                            const floorGap = rccSettings.floorGap ?? (isMeters ? 0.3 : 300);
                            const zLevel = idx * ((rccSettings.floorHeight || floorHeightDefault) + floorGap);

                            // Render this floor's entities
                            return (
                                <group key={idx} position={[0, 0, zLevel]}>
                                    {floor.dxfData.layers.map(layer => {
                                        const layerConfig = floor.config[layer.id];
                                        if (layerConfig?.visible === false) return null;

                                        return (
                                            <group key={layer.id}>
                                                {layer.entities.map((entity, i) => (
                                                    <Entity
                                                        key={i}
                                                        entity={entity}
                                                        layerConfig={layerConfig}
                                                        defaultColor={layerConfig.color}
                                                        rccSettings={rccSettings}
                                                        floorHeight={rccSettings.floorHeight || floorHeightDefault}
                                                    />
                                                ))}
                                            </group>
                                        );
                                    })}
                                </group>
                            );
                        })}
                    </group>
                </Stage>
            </Canvas>
        </div>
    );
}
