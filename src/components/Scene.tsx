import React from 'react';
import { useBox, usePlane } from '@react-three/cannon';

function Floor() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0], // Rotate the plane to be horizontal
    position: [0, -1, 0]
  }));

  return (
    <mesh ref={ref}>
      <planeGeometry args={[100, 100]} /> {/* Large plane to simulate infinity */}
      <meshStandardMaterial color="green" />
    </mesh>
  );
}


function Wall({ position, rotation, args }) {
  const [ref] = useBox(() => ({
    position,
    rotation,
    args,
    material: {
      friction: 1 
    }
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color="gray" />
    </mesh>
  );
}

function Walls() {
  return (
    <>
      <Wall position={[-10, 5, 0]} rotation={[0, 0, 0]} args={[1, 10, 20]} /> {/* Left wall */}
      <Wall position={[10, 5, 0]} rotation={[0, 0, 0]} args={[1, 10, 20]} /> {/* Right wall */}
    </>
  );
}

function Scene() {
  return (
    <>
      <Walls />
      <Floor />
    </>
  );
}

export default Scene;