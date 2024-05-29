import React from 'react';
import { usePlane } from '@react-three/cannon';

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

function Wall({ position, rotation }) {
  const [ref] = usePlane(() => ({
    position,
    rotation,
    material: {
      friction: 1 
    }
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} /> {/* Large plane to simulate infinity */}
      <meshStandardMaterial color="gray" />
    </mesh>
  );
};

function Walls() {
  return (
    <>
      <Wall position={[-10, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Wall position={[+10, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </>
  );
};

function Scene() {
  return (
    <>
      <Walls />
      <Floor />
    </>
  );
}

export default Scene;