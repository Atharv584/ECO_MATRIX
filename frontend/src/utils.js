export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const aciToHex = (aci) => {
    // Basic ACI color mapping for standard 7 colors.
    // 1: Red, 2: Yellow, 3: Green, 4: Cyan, 5: Blue, 6: Magenta, 7: White
    const standardColors = [
        '#000000', // 0 (often byblock)
        '#FF0000', // 1
        '#FFFF00', // 2
        '#00FF00', // 3
        '#00FFFF', // 4
        '#0000FF', // 5
        '#FF00FF', // 6
        '#FFFFFF', // 7
        '#808080', // 8
        '#C0C0C0', // 9
    ];
    if (aci >= 0 && aci < standardColors.length) {
        return standardColors[aci];
    }
    // For other colors, just return white or a generated color logic could be added
    return '#FFFFFF';
};

export const ROLE_COLORS = {
    column: '#FACC15', // Yellow-400
    beam: '#4ADE80',   // Green-400
    slab: '#60A5FA',   // Blue-400
    wall: '#F87171',   // Red-400
    brick_wall: '#EA580C', // Orange-600
    window: '#22D3EE', // Cyan-400
    door: '#A97142',   // Brown (custom)
    wc: '#C084FC',     // Purple-400
    footing_base: '#f97316', // Orange
    footing_slope: '#3b82f6', // Blue
    generic: null      // Use layer color
};

export const calculateMeasurements = (layers, config, rccSettings = {}) => {
    let totalLength = 0;
    let totalArea2D = 0;
    let totalVolume = 0;
    let totalSurfaceArea = 0;
    let extraWallVolume = 0;
    let extraWallArea = 0; // Plan area of the openings
    let extraExcavationVolume = 0;

    const byLayer = {};

    // Unit Conversion Factors
    // Source -> Target (Meters)
    const unitSystem = rccSettings.unitSystem || 'mm'; // 'mm' or 'm'
    const scaleToMeters = unitSystem === 'm' ? 1 : 0.001;
    const areaScale = scaleToMeters * scaleToMeters;
    const volScale = scaleToMeters * scaleToMeters * scaleToMeters;

    const floorHeight = rccSettings.floorHeight || (unitSystem === 'm' ? 5 : 5000);
    const beamDepth = rccSettings.beamDepth || (unitSystem === 'm' ? 0.45 : 450);
    const numFloors = rccSettings.numFloors || 1;
    const slabThickness = rccSettings.slabThickness || (unitSystem === 'm' ? 1 : 1000);

    // Default Dims
    const defaultWinH = unitSystem === 'm' ? 2 : 2000;
    const defaultDoorH = unitSystem === 'm' ? 2 : 2000;

    // We need to track extra wall volume from Windows/Doors
    // let extraWallVolume = 0; // Moved to top
    // let extraWallArea = 0; // Plan area of the openings // Moved to top

    layers.forEach(layer => {
        const layerConfig = config[layer.id] || {};
        // Initialize layer stats
        let layerLength = 0;
        let layerArea = 0;
        let layerVolume = 0;
        let layerSurfaceArea = 0;

        const extrusion = layerConfig.extrusion || 0;
        const role = layerConfig.role || 'generic';

        // Entity Processing
        layer.entities.forEach(entity => {
            // Length / Perimeter
            let effectiveHeight = extrusion;
            let countMultiplier = 1;

            // --- HEIGHT LOGIC ---
            if (role === 'wall' || role === 'brick_wall') {
                const h = extrusion > 0 ? extrusion : Math.max(0, floorHeight - beamDepth);
                effectiveHeight = h * numFloors;
                countMultiplier = numFloors;
            } else if (role === 'slab') {
                const thickness = extrusion > 0 ? extrusion : slabThickness;
                effectiveHeight = thickness * numFloors;
                countMultiplier = numFloors;
            } else if (role === 'beam') {
                const thickness = extrusion > 0 ? extrusion : beamDepth;
                effectiveHeight = thickness * numFloors;
                countMultiplier = numFloors;
            } else if (role === 'column') {
                effectiveHeight = floorHeight * numFloors;
            } else if (role === 'window') {
                // Window Entity Volume: Area * WindowHeight
                const winH = layerConfig.height !== undefined ? layerConfig.height : defaultWinH;
                effectiveHeight = winH;
            } else if (role === 'door') {
                // Door Entity Volume: Area * DoorHeight
                const doorH = layerConfig.height !== undefined ? layerConfig.height : defaultDoorH;
                effectiveHeight = doorH;
            } else if (role === 'wc') {
                // WC Volume: Usually implies floor area * height? Or just area.
                // Let's calc volume as if it's a room zone.
                effectiveHeight = floorHeight;
            } else if (role === 'footing_base') {
                effectiveHeight = layerConfig.height || 0.5; // Default 0.5m
            } else if (role === 'footing_slope') {
                effectiveHeight = layerConfig.height || 0; // Default 0.
                // We calc as Prism for now.
                // If user wants Frustum volume, we need more complex logic.
            }

            // --- GEOMETRY CALCS ---
            let calculatedLen = 0;
            let calculatedArea = 0;

            if (entity.type === 'LINE') {
                const dx = entity.end[0] - entity.start[0];
                const dy = entity.end[1] - entity.start[1];
                calculatedLen += Math.sqrt(dx * dx + dy * dy);
            }
            else if (entity.type === 'CIRCLE') {
                calculatedLen += 2 * Math.PI * entity.radius;
                calculatedArea += Math.PI * entity.radius * entity.radius;
            }
            else if (entity.type === 'LWPOLYLINE') {
                let perimeter = 0;
                for (let i = 0; i < entity.points.length - 1; i++) {
                    const p1 = entity.points[i];
                    const p2 = entity.points[i + 1];
                    const dx = p2[0] - p1[0];
                    const dy = p2[1] - p1[1];
                    perimeter += Math.sqrt(dx * dx + dy * dy);
                }
                if (entity.closed) {
                    const p1 = entity.points[entity.points.length - 1];
                    const p2 = entity.points[0];
                    const dx = p2[0] - p1[0];
                    const dy = p2[1] - p1[1];
                    perimeter += Math.sqrt(dx * dx + dy * dy);
                }
                calculatedLen += perimeter;

                if (entity.closed) {
                    let area = 0;
                    for (let i = 0; i < entity.points.length; i++) {
                        const j = (i + 1) % entity.points.length;
                        area += entity.points[i][0] * entity.points[j][1];
                        area -= entity.points[j][0] * entity.points[i][1];
                    }
                    calculatedArea = Math.abs(area) / 2;
                }
            }
            else if (entity.type === 'HATCH') {
                if (entity.paths) {
                    entity.paths.forEach(path => {
                        let perimeter = 0;
                        for (let i = 0; i < path.length - 1; i++) {
                            const p1 = path[i];
                            const p2 = path[i + 1];
                            const dx = p2[0] - p1[0];
                            const dy = p2[1] - p1[1];
                            perimeter += Math.sqrt(dx * dx + dy * dy);
                        }
                        if (path.length > 2) {
                            const p1 = path[path.length - 1];
                            const p0 = path[0];
                            if (p1[0] !== p0[0] || p1[1] !== p0[1]) {
                                const dx = p0[0] - p1[0];
                                const dy = p0[1] - p1[1];
                                perimeter += Math.sqrt(dx * dx + dy * dy);
                            }
                        }
                        calculatedLen += perimeter;

                        let area = 0;
                        for (let i = 0; i < path.length; i++) {
                            const j = (i + 1) % path.length;
                            area += path[i][0] * path[j][1];
                            area -= path[j][0] * path[i][1];
                        }
                        calculatedArea += Math.abs(area) / 2;
                    });
                }
            }

            layerLength += calculatedLen;
            layerArea += calculatedArea;

            // Standard Volume
            if (effectiveHeight > 0) {
                layerVolume += calculatedArea * effectiveHeight;
                layerSurfaceArea += (2 * calculatedArea) + (calculatedLen * effectiveHeight);
            }

            // --- EXTRA WALL CALCULATION (Lintels/Sills) ---
            // If this is a Window or Door, the space above/below it is WALL.
            if (role === 'window') {
                const winH = layerConfig.height !== undefined ? layerConfig.height : defaultWinH;
                // Wall H = FloorH - BeamD. If window is there, the remaining vertical space is wall.
                // Assuming wall runs full floor height (minus beam).
                // Wall Part = max(0, (FloorHeight - BeamDepth) - WindowHeight)
                const wallTotalH = Math.max(0, floorHeight - beamDepth);
                const wallFillerH = Math.max(0, wallTotalH - winH);

                extraWallArea += calculatedArea * areaScale;
                extraWallVolume += calculatedArea * wallFillerH * numFloors;
            } else if (role === 'door') {
                const doorH = layerConfig.height !== undefined ? layerConfig.height : defaultDoorH;
                // Wall Part = max(0, (FloorHeight - BeamDepth) - DoorHeight)
                const wallTotalH = Math.max(0, floorHeight - beamDepth);
                const wallFillerH = Math.max(0, wallTotalH - doorH);

                extraWallArea += calculatedArea * areaScale;
                extraWallVolume += calculatedArea * wallFillerH * numFloors;
            }

            // --- FOOTING EXCAVATION CALCULATION ---
            if (role === 'footing_base') {
                const excavationDepth = layerConfig.depth !== undefined ? layerConfig.depth : 1.5;
                const perimeter_M = calculatedLen * scaleToMeters;
                const area_M2 = calculatedArea * areaScale;
                // Add 1m offset on all sides -> area increases by perimeter * 1 + 4 (for 4 square corners)
                const excavationArea_M2 = area_M2 + (perimeter_M * 1) + 4;
                extraExcavationVolume += excavationArea_M2 * excavationDepth * numFloors;
            }

        });

        // Store per layer stats
        byLayer[layer.id] = {
            length: (layerLength * scaleToMeters).toFixed(3),
            area: (layerArea * areaScale).toFixed(3),
            volume: (layerVolume * volScale).toFixed(3),
            surfaceArea: (layerSurfaceArea * areaScale).toFixed(3)
        };

        if (layerConfig?.visible !== false) {
            totalLength += layerLength * scaleToMeters;
            // For Total Area, we usually sum up slabs. Summing up everything might double count.
            // But let's keep consistent sum for now.
            totalArea2D += layerArea * areaScale;
            totalVolume += layerVolume * volScale;
            totalSurfaceArea += layerSurfaceArea * areaScale;
        }
    });

    // ATTRIBUTE EXTRA WALL VOLUME TO 'WALL' LAYERS? or Just global total?
    // Since we return 'byLayer', we can't easily inject it into a specific wall layer
    // without knowing which one "owns" the window.
    // However, the BOQ component aggregates by ROLE.
    // So we can return a special property `extraWallStats` which BOQ can add to the 'wall' role.

    return {
        totalLength: totalLength.toFixed(3),
        totalArea2D: totalArea2D.toFixed(3),
        totalVolume: totalVolume.toFixed(3),
        totalSurfaceArea: totalSurfaceArea.toFixed(3),
        totalSurfaceArea: totalSurfaceArea.toFixed(3),
        byLayer: byLayer,
        extraWallStats: {
            area: extraWallArea.toFixed(3),
            volume: extraWallVolume.toFixed(3)
        },
        footingExcavationStats: {
            volume: extraExcavationVolume.toFixed(3)
        }
    };
};
