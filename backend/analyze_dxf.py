import ezdxf

def analyze_dxf(file_path):
    try:
        doc = ezdxf.readfile(file_path)
        msp = doc.modelspace()
        
        layer_stats = {}
        
        for entity in msp:
            layer = entity.dxf.layer
            type_ = entity.dxftype()
            
            if layer not in layer_stats:
                layer_stats[layer] = {"types": {}, "colors": set()}
            
            if type_ not in layer_stats[layer]["types"]:
                layer_stats[layer]["types"][type_] = 0
            layer_stats[layer]["types"][type_] += 1
            
            if entity.dxf.hasattr('color'):
                layer_stats[layer]["colors"].add(entity.dxf.color)
                
        print("Layer Analysis:")
        for layer, stats in layer_stats.items():
            print(f"Layer: {layer}")
            print(f"  Types: {stats['types']}")
            print(f"  Colors: {stats['colors']}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_dxf("c:/Users/Atharv/Desktop/THREE/DEMO.dxf")
