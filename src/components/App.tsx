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
  const UUID2player = useRef({ });
  const [scores, setScores] = React.useState({ playerA: 0, playerB: 0 });

  function saveMapping(ref, player) {
    for (const partName in ref.current) {
      const { ref: rf, ...data } = ref.current[partName];
      UUID2player.current[rf.current.uuid] = {
        ...data, ref: rf, partName, player
      };
    }
  }

  function bindPlayerA(ref) {
    playerA.current = ref.current;
    saveMapping(ref, 'playerA');
  }

  function bindPlayerB(ref) {
    playerB.current = ref.current;
    saveMapping(ref, 'playerB');
  }

  function onCollide(e: CollisionEvent) {
    if (!playerA.current || !playerB.current) return;
    if (!playerA.current['head'] || !playerB.current['head']) return;
    const { body, target } = e;
    const targetData = UUID2player.current[target.uuid];
    const bodyData = UUID2player.current[body.uuid];
    
    const bodyVelocity = bodyData?.velocity.current || new THREE.Vector3();
    const targetVelocity = targetData?.velocity.current || new THREE.Vector3();

    const tmp = bodyVelocity.clone().sub(targetVelocity);
    const total = Math.max(0, tmp.length() * 100 - 20);
    
    const scoresNew = { ...scores };
    const score = total;
    // penalize the player that is hit
    if(targetData) {
      scoresNew[targetData.player] -= score;
    }
    // reward the player that hits
    if(bodyData) {
      scoresNew[bodyData.player] += score;
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