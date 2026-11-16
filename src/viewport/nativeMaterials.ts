import {Mesh,MeshStandardMaterial,type Object3D} from 'three';

/** Adapt native preview materials to Three.js without changing studio illumination. */
export function nativeMaterials(object:Object3D):void {
  object.traverse(child=>{
    if(!(child instanceof Mesh))return;
    for(const material of Array.isArray(child.material)?child.material:[child.material]){
      if(material instanceof MeshStandardMaterial && material.normalMap && 'ghostline_preview_notes' in material.userData && material.userData['ghostline_normal_encoding']!=='xyz'){
        // Native BC5 maps store XY; their unused blue channel is not a signed Z.
        // Three.js provides the same positive-Z reconstruction as the native shader.
        material.defines={...material.defines,USE_PACKED_NORMALMAP:''};
        material.needsUpdate=true;
      }
      if(material.userData['ghostline_decal']){
        material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-1;
        material.depthWrite=false;child.renderOrder=-1;
      }
      if(material.userData['ghostline_hair']){
        material.alphaHash=false;material.transparent=true;material.alphaTest=Math.max(material.alphaTest,0.001);material.depthWrite=false;
        if(material instanceof MeshStandardMaterial)material.roughness=Math.max(material.roughness,0.65);
      }
    }
  });
}
