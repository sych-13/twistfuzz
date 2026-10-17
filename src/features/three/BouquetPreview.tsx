import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {useMemo} from 'react';
import type {ReactNode} from 'react';
import * as THREE from 'three';
import type {FlowerKind,FlowerSpec} from '../studio/design';
function Stem({kind,color,x,y,z}:{kind:FlowerKind;color:string;x:number;y:number;z:number}){
 const geometry=useMemo(()=>new THREE.CatmullRomCurve3([
   new THREE.Vector3(0,-1.3,0),new THREE.Vector3(x*.15,-.65,z*.1),new THREE.Vector3(x*.3,0,0)
 ]),[x,z]);
 const petals=kind==='Daisy'?10:kind==='Sunflower'?14:kind==='Gerbera'?13:kind==='Lily'?6:kind==='Rose'?9:5;
 const length=kind==='Tulip'?.37:kind==='Lily'?.6:.46;
 const scale=kind==='Sunflower'||kind==='Gerbera'?1.1:kind==='Rose'?.82:1;
 return <group position={[x*.42,y,z*.45]} rotation={[0,z*.18,x*.1]}>
   <mesh position={[0,-.45,0]}><tubeGeometry args={[geometry,14,.025,6,false]}/><meshStandardMaterial color="#4a7658"/></mesh>
   <mesh position={[.12,-.55,0]} rotation={[0,0,.6]}><sphereGeometry args={[.12,10,10]}/><meshStandardMaterial color="#548562"/></mesh>
   <group scale={scale}>
     {Array.from({length:petals},(_,i)=><mesh key={i} position={[Math.sin(i*2*Math.PI/petals)*.18,Math.cos(i*2*Math.PI/petals)*.18,0]} rotation={[0,0,i*2*Math.PI/petals]} scale={[.8,length*3,.5]}>
       <sphereGeometry args={[.13,12,10]}/><meshStandardMaterial color={color} roughness={.93}/>
     </mesh>)}
     <mesh position={[0,0,.05]}><sphereGeometry args={[kind==='Sunflower'?.17:.105,20,12]}/><meshStandardMaterial color={kind==='Sunflower'?'#573d2d':'#f4c45f'} roughness={1}/></mesh>
   </group>
 </group>
}
function Bouquet({flowers,wrapper,ribbon}:{flowers:FlowerSpec[];wrapper:string;ribbon:string}){
 const instances=flowers.flatMap(f=>Array.from({length:f.count},()=>({kind:f.kind,color:f.color})));
 const total=instances.length;
 return <group position={[0,.18,0]}>
   <mesh rotation={[Math.PI,0,0]} position={[0,-.9,0]}><coneGeometry args={[.72,1.32,18,1,true]}/><meshStandardMaterial color={({"Kraft Brown":"#b99873","Pastel Pink":"#db9fb1","White":"#f4e7df","Lavender":"#b49acb","Elegant Black":"#3f3542"} as Record<string,string>)[wrapper]||"#db9fb1"} side={THREE.DoubleSide} roughness={.85}/></mesh>
   {ribbon!=="No Ribbon"&&<mesh position={[0,-1.45,0]}><cylinderGeometry args={[.17,.22,.23,20]}/><meshStandardMaterial color="#e0bac3"/></mesh>}
   {instances.map((flower,i)=>{const t=i*2.39996;const r=Math.sqrt((i+.5)/Math.max(total,1));return <Stem key={i} kind={flower.kind} color={flower.color} x={r*Math.cos(t)*1.7} y={.25+r*.1} z={r*Math.sin(t)*1.7}/>})}
   {ribbon!=="No Ribbon"&&<mesh position={[0,-1.16,.63]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[.25,.13,.065]}/><meshStandardMaterial color={ribbon==="Personalized Printed"?"#f1d4d9":"#a45473"}/></mesh>}
 </group>
}
export default function BouquetPreview({flowers,wrapper="Pastel Pink",ribbon="Standard Satin",fallback}:{flowers:FlowerSpec[];wrapper?:string;ribbon?:string;fallback?:ReactNode}){
 return <Canvas fallback={fallback} camera={{position:[2.4,1.5,3.9],fov:36}} shadows dpr={[1,1.7]}>
  <color attach="background" args={['#fff2f6']}/><ambientLight intensity={2.2}/><directionalLight position={[5,5,4]} intensity={2.5}/>
  <Bouquet flowers={flowers} wrapper={wrapper} ribbon={ribbon}/><OrbitControls enablePan={false} minDistance={2.8} maxDistance={7} target={[0,-.1,0]}/>
 </Canvas>
}
