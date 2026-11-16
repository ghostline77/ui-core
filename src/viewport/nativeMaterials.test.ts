import assert from 'node:assert/strict';
import test from 'node:test';
import {BoxGeometry,Mesh,MeshStandardMaterial,Texture} from 'three';
import {nativeMaterials} from './nativeMaterials.js';

test('native XY normal maps reconstruct positive Z without altering generic RGB normal maps',()=>{
  const material=new MeshStandardMaterial({normalMap:new Texture()});
  material.userData['ghostline_preview_notes']=[];
  const mesh=new Mesh(new BoxGeometry(),material);nativeMaterials(mesh);
  assert.ok(Object.hasOwn(material.defines ?? {},'USE_PACKED_NORMALMAP'));
  const generic=new MeshStandardMaterial({normalMap:new Texture()});mesh.material=generic;nativeMaterials(mesh);
  assert.equal(Object.hasOwn(generic.defines ?? {},'USE_PACKED_NORMALMAP'),false);
  const xyz=new MeshStandardMaterial({normalMap:new Texture()});xyz.userData={ghostline_preview_notes:[],ghostline_normal_encoding:'xyz'};
  mesh.material=xyz;nativeMaterials(mesh);assert.equal(Object.hasOwn(xyz.defines ?? {},'USE_PACKED_NORMALMAP'),false);
  mesh.geometry.dispose();for(const m of [material,generic,xyz]){m.normalMap?.dispose();m.dispose()}
});
