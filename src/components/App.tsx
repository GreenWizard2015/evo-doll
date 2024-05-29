import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { Ragdoll } from './Ragdoll';
import { OrbitControls } from '@react-three/drei';
import Scene from './Scene';

const App: React.FC = () => {
  const cameraOptions = {
    zoom: 1,
    position: [0, 0, 10],
    left: -10,
    right: 10,
    top: 10,
    bottom: -2,
    near: -100,
    far: 100
  };
  return (
    <Canvas orthographic camera={cameraOptions} id='canvas' style={{ position: 'absolute' }}>
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