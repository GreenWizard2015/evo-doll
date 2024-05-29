import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { Ragdoll } from './Ragdoll';
import { OrbitControls } from '@react-three/drei';
import Scene from './Scene';
import { useEffect, useRef } from 'react';

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

const App: React.FC = () => {
  return (
    <Canvas id='canvas' style={{ position: 'absolute' }}>
      <CustomCamera />
      <ambientLight />
      <pointLight position={[10, 10, 10]} />
      <Physics>
        <Scene />

        <Ragdoll />
      </Physics>
      <OrbitControls />
    </Canvas>
  );
}

export default App;