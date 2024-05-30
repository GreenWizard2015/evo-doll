import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { RAGDOLL_PARTS, Ragdoll, encodeObservation } from './Ragdoll';
import { Html, OrbitControls } from '@react-three/drei';
import Scene from './Scene';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createModel } from '../helpers/NN';
import * as tf from '@tensorflow/tfjs';
import { CollisionEvent } from '../helpers/CollisionEvent';

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
  const modelA = useRef(createModel({inputSize: 240, outputSize: RAGDOLL_PARTS.length}));
  const modelB = useRef(createModel({inputSize: 240, outputSize: RAGDOLL_PARTS.length}));
  const raycaster = useRef(new THREE.Raycaster());
  const tick = useRef(0);

  useFrame(({ scene }) => {    
    const process = (player, model) => {
      if (!player) return;
      if (!model) return;

      const state = encodeObservation({
        raycaster: raycaster.current,
        player,
        scene
      });
      
      const action = model.predict(
        tf.tensor2d([state], [1, state.length])
      ).arraySync()[0];
      
      const maxForce = 25;
      for (let i = 0; i < RAGDOLL_PARTS.length; i++) {
        const { api } = player[RAGDOLL_PARTS[i]];
        api.applyImpulse([action[i] * maxForce, 0, 0], [0, 0, 0]);
      }
    };

    if (tick.current > 25) return;
    tick.current += 1;
    
    process(playerA.current, modelA.current);
    process(playerB.current, modelB.current);
  });

  return null;
}

const App: React.FC = () => {
  const playerA = useRef<any>(null);
  const playerB = useRef<any>(null);
  const [scores, setScores] = React.useState({ playerA: 0, playerB: 0 });

  function bindPlayerA(ref) {
    playerA.current = ref.current;
  }

  function bindPlayerB(ref) {
    playerB.current = ref.current;
  }

  function onCollide(e: CollisionEvent) {
    if (!playerA.current || !playerB.current) return;
    if (!playerA.current['head'] || !playerB.current['head']) return;
    const { body, target, contact: { impactVelocity } } = e;
    if (impactVelocity < 0) return;
    const playerAGroup = playerA.current['head'].ref.current.collisionFilterGroup;
    const playerBGroup = playerB.current['head'].ref.current.collisionFilterGroup;
    const score = Math.max(0, impactVelocity);
    const scoresNew = { ...scores };
    // penalize the player that is hit
    if(target.collisionFilterGroup === playerAGroup) {
      scoresNew.playerA -= score;
      console.log('playerA hit', e);
      
    }
    if(target.collisionFilterGroup === playerBGroup) {
      scoresNew.playerB -= score;
    }
    // reward the player that hits
    if(body.collisionFilterGroup === playerAGroup) {
      scoresNew.playerA += score;
      console.log('playerB hit by playerA', e);
    }
    if(body.collisionFilterGroup === playerBGroup) {
      scoresNew.playerB += score;
    }
    
    setScores(scoresNew); // update the scores
  }

  const playerProps = {
    onCollide,
    // moving only on x and z axis
    linearFactor: [1, 1, 0],
    angularFactor: [0, 1, 0],
  };

  return (
    <>
      <Canvas id='canvas' style={{ position: 'absolute' }}>
        <CustomCamera />
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <Physics>
          <Scene />

          <Ragdoll onState={bindPlayerA} props={{ position: [-2, 0, 0], ...playerProps }} />
          <Ragdoll onState={bindPlayerB} props={{ position: [2, 0, 0], ...playerProps }} />
        </Physics>
        <OrbitControls />
        <Debug playerA={playerA} playerB={playerB} />
      </Canvas>

      <div style={{ position: 'absolute', top: 0, left: 0, color: 'white', padding: '10px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '5px' }}>
        <div>Player A: {scores.playerA}</div>
        <div>Player B: {scores.playerB}</div>
      </div>
    </>
  );
}

export default App;