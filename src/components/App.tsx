import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { Ragdoll } from './Ragdoll';
import { OrbitControls } from '@react-three/drei';
import Scene from './Scene';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const CustomCamera: React.FC = () => {
  const { camera } = useThree();
  const ref = useRef();
  
  useEffect(() => {
    if (ref.current) {
      camera.position.set(0, 5, 10);
      camera.fov = 95;
      camera.near = 0.1;
      camera.far = 1000;
      camera.updateProjectionMatrix();
    }
  }, [camera, ref]);

  return (
    <perspectiveCamera ref={ref} makeDefault />
  );
};

function Debug({playerA, playerB}) {
  const raycaster = useRef(new THREE.Raycaster());
  useFrame(({ scene }) => {
    if (!playerA.current || !playerB.current) return;
    const headA = playerA.current['head'].ref.current;
    const ownParts = [];
    for (const part in playerA.current) {
      if (playerA.current[part].ref.current) {
        ownParts.push(playerA.current[part].ref.current.uuid);
      }
    }
    const globalObjects = ['floor', 'wall'];

    const headPosition = new THREE.Vector3();
    headA.getWorldPosition(headPosition);

    const intersections = [];
    const raycaster_ = raycaster.current;
    const step = 360 / 15;
    for (let i = 0; i < 360; i += step) {
      const angle = THREE.MathUtils.degToRad(i);
      // in XY plane
      const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      raycaster_.set(headPosition, direction);

      const intersects = raycaster_.intersectObjects(scene.children, true);
      let intersection = null;
      if (intersects.length > 0) {
        // Filter out own parts
        const filteredIntersects = intersects.filter(
          intersect => globalObjects.includes(intersect.object.name) || 
            !ownParts.includes(intersect.object.uuid)
        );

        if (filteredIntersects.length > 0) {
          intersection = filteredIntersects[0];
        }
      }

      intersections.push(intersection);
    }

    console.log(intersections);
  });

  return null;
}

const App: React.FC = () => {
  const playerA = useRef<any>(null);
  const playerB = useRef<any>(null);

  function bindPlayerA(ref) {
    playerA.current = ref.current;
  }

  function bindPlayerB(ref) {
    playerB.current = ref.current;
  }

  return (
    <Canvas id='canvas' style={{ position: 'absolute' }}>
      <CustomCamera />
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <Physics>
        <Scene />

        <Ragdoll onState={bindPlayerA} props={{ position: [-2, 0, 0] }} />
        <Ragdoll onState={bindPlayerB} props={{ position: [2, 0, 0] }} />
      </Physics>
      <OrbitControls />
      <Debug playerA={playerA} playerB={playerB} />
    </Canvas>
  );
}

export default App;