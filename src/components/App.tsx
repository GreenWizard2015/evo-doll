import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { RAGDOLL_PARTS, Ragdoll, encodeObservation } from './Ragdoll';
import { OrbitControls } from '@react-three/drei';
import Scene from './Scene';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createModel } from '../helpers/NN';
import * as tf from '@tensorflow/tfjs';

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
  const model = useRef(createModel({inputSize: 240, outputSize: RAGDOLL_PARTS.length}));
  const stateA = useRef<any>(null);
  const actionA = useRef<any>(null);

  const stateB = useRef<any>(null);
  const actionB = useRef<any>(null);
  
  const raycaster = useRef(new THREE.Raycaster());

  useFrame(({ scene }) => {
    if (!playerA.current || !playerB.current) return;
    
    stateA.current = encodeObservation({
      raycaster: raycaster.current,
      player: playerA.current,
      scene
    })

    stateB.current = encodeObservation({
      raycaster: raycaster.current,
      player: playerB.current,
      scene
    });

    // apply action
    const maxForce = 10;
    if (actionA.current) {
      for (let i = 0; i < RAGDOLL_PARTS.length; i++) {
        const { api } = playerA.current[RAGDOLL_PARTS[i]];
        api.applyImpulse([actionA.current[i] * maxForce, 0, 0], [0, 0, 0]);
      }
    }

    if (actionB.current) {
      for (let i = 0; i < RAGDOLL_PARTS.length; i++) {
        const { api } = playerB.current[RAGDOLL_PARTS[i]];
        api.applyImpulse([actionB.current[i] * maxForce, 0, 0], [0, 0, 0]);
      }
    }
  });

  const onTick = React.useCallback(() => {
    if (!model.current) return;
    if (!stateA.current || !stateB.current) return;
    console.log('predicting');

    let state = tf.tensor2d(stateA.current, [1, stateA.current.length]);
    actionA.current = model.current.predict(state).arraySync()[0];
    console.log('actionA', actionA.current);

    state = tf.tensor2d(stateB.current, [1, stateB.current.length]);
    actionB.current = model.current.predict(state).arraySync()[0];
    console.log('actionB', actionB.current);
  }, [model, stateA, stateB]);

  useEffect(() => {
    const intervalHandle = setInterval(onTick, 10); 
    return () => clearInterval(intervalHandle);
  }, [onTick]);    

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