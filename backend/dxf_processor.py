import ezdxf
import json
import hashlib
from typing import Dict, List, Any

def process_dxf(file_path: str) -> Dict[str, Any]:
    try:
        doc = ezdxf.readfile(file_path)
        msp = doc.modelspace()
        
        layers = {}
        
        # Helper to get RGB from ACI color
        def get_color(entity):
            if entity.dxf.hasattr('color'):
                # Basic ACI to Hex mapping would be ideal, but for now we return the ACI index
                # Front end can map frequently used colors or we can add a robust mapper
                return entity.dxf.color
            return 7 # Default white/black
            
        def get_layer_id(name: str) -> str:
             return hashlib.sha256(name.encode('utf-8')).hexdigest()

        for entity in msp:
            layer_name = entity.dxf.layer
            if layer_name not in layers:
                layers[layer_name] = {
                    "id": get_layer_id(layer_name),
                    "name": layer_name,
                    "entities": [],
                    "color": 0 # Will be updated
                }
            
            # Extract geometry data based on entity type
            entity_data = {
                "type": entity.dxftype(),
                "color": get_color(entity)
            }
            
            if entity.dxftype() == 'LINE':
                entity_data.update({
                    "start": list(entity.dxf.start),
                    "end": list(entity.dxf.end)
                })
            elif entity.dxftype() == 'CIRCLE':
                 entity_data.update({
                    "center": list(entity.dxf.center),
                    "radius": entity.dxf.radius
                })
            elif entity.dxftype() == 'LWPOLYLINE':
                points = []
                # LWPolyline points are (x, y, [start_width, [end_width, [bulge]]])
                # We only need x, y for now.
                for i in range(len(entity)):
                     points.append(list(entity[i][:2]))
                
                entity_data.update({
                    "points": points,
                    "closed": entity.is_closed
                })

            elif entity.dxftype() == 'ARC':
                 entity_data.update({
                    "center": list(entity.dxf.center),
                    "radius": entity.dxf.radius,
                    "start_angle": entity.dxf.start_angle,
                    "end_angle": entity.dxf.end_angle
                })
            elif entity.dxftype() == 'HATCH':
                # Hatches can have multiple internal loops/paths
                # We need to extract them as polylines
                paths = []
                for path in entity.paths:
                    # Convert path to points
                    # simplified handling for polyline paths
                    # (Curve paths are more complex, handling basic polyline paths first)
                    if hasattr(path, 'vertices'): 
                        # Vertices are (x, y, bulge) or just (x, y)
                        pts = []
                        for v in path.vertices:
                            pts.append([v[0], v[1]])
                        if pts:
                            paths.append(pts)
                
                entity_data.update({
                    "paths": paths,
                    "color": entity.dxf.color if entity.dxf.hasattr('color') else 0 # Explicit color or layer
                })

            # Only add supported entities for now
            if entity.dxftype() in ['LINE', 'CIRCLE', 'LWPOLYLINE', 'ARC', 'HATCH']:
                 layers[layer_name]["entities"].append(entity_data)
                 # Update layer color if not set (taking first entity's color as approximate layer color)
                 if layers[layer_name]["color"] == 0:
                     layers[layer_name]["color"] = entity_data["color"]

        # Convert to list
        layer_list = list(layers.values())
        
        # Basic bounds calculation could be done here or in frontend
        # For this version we return the structured data
        
        return {"layers": layer_list}

    except Exception as e:
        print(f"Error processing DXF: {e}")
        return {"error": str(e)}
