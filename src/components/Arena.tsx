import React, { useRef } from "react";
import { CollisionEvent } from "../helpers/CollisionEvent";
import { RAGDOLL_PARTS, Ragdoll, encodeObservation } from "./Ragdoll";
import { useFrame } from "@react-three/fiber";
import { createModel } from "../helpers/NN";
import * as THREE from 'three';
import { runInference } from "./InferenceWorker";

function Arena({ ZPos, updateScores, uuid, timeLimit}) {
  const startTimestamp = useRef(Date.now());
  const UUID2player = useRef({ });
  const [scores, setScores] = React.useState({ playerA: 0, playerB: 0 });

  const playerAData = useRef({
    model: createModel({inputSize: 240, outputSize: RAGDOLL_PARTS.length}),
    state: null,
    action: null,
    scores: 0,
    ref: null,
  });
  const playerBData = useRef({
    model: createModel({inputSize: 240, outputSize: RAGDOLL_PARTS.length}),
    state: null,
    action: null,
    scores: 0,
    ref: null,
  });
  const raycaster = useRef(new THREE.Raycaster());

  // Save the mapping between the UUID of the body and the player
  function saveMapping(ref, player) {
    for (const partName in ref.current) {
      const { ref: rf, ...data } = ref.current[partName];
      UUID2player.current[rf.current.uuid] = {
        ...data, ref: rf, partName, player
      };
    }
  }

  function bindPlayerA(ref) {
    saveMapping(ref, 'playerA');
    playerAData.current.ref = ref;
  }
  function bindPlayerB(ref) {
    saveMapping(ref, 'playerB');
    playerBData.current.ref = ref;
  }

  React.useEffect(() => {
    playerAData.current.scores = scores.playerA;
    playerBData.current.scores = scores.playerB;
    updateScores(scores, uuid);
  }, [scores, updateScores, uuid]);

  const onInference = React.useCallback(({ data, uuid }) => {
    if (uuid === 'playerA') {
      playerAData.current.action = data;
    } else if (uuid === 'playerB') {
      playerBData.current.action = data;
    }
  }, []);

  useFrame(({ scene }) => {    
    const process = (playerData) => {
      if (!playerData.current) return;
      const { player, action } = playerData.current;
      const state = encodeObservation({
        raycaster: raycaster.current,
        player,
        scene
      });

      runInference({
        model: playerData.current.model,
        state: state,
        callback: onInference,
        uuid: player
      });
      
      if(action) { // apply action if available
        const maxForce = 25;
        for (let i = 0; i < RAGDOLL_PARTS.length; i++) {
          const { api } = player[RAGDOLL_PARTS[i]];
          api.applyImpulse([action[i] * maxForce, 0, 0], [0, 0, 0]);
        }
      }
    };
    
    if (Date.now() - startTimestamp.current > timeLimit) {
      return;
    }
    process(playerAData);
    process(playerBData);
  });
  

  function onCollide(e: CollisionEvent) {
    const { body, target } = e;
    const targetData = UUID2player.current[target.uuid];
    const bodyData = UUID2player.current[body.uuid];
    
    const bodyVelocity = bodyData?.velocity.current || new THREE.Vector3();
    const targetVelocity = targetData?.velocity.current || new THREE.Vector3();

    const bodySpeed = bodyVelocity.length();
    const targetSpeed = targetVelocity.length();
    if (bodySpeed > targetSpeed) return; // only count if the body is faster

    const tmp = bodyVelocity.clone().sub(targetVelocity);
    const score = tmp.length() - 20;
    setScores((prevScores) => {
      const scoresNew = { ...prevScores };
      // penalize the player that is hit
      if(targetData) {
        scoresNew[targetData.player] -= score;
      }
      // reward the player that hits
      if (bodyData) {
        // penalize the player that if the player hits anything that is not the other player
        scoresNew[bodyData.player] += targetData ? score : -score;
      }
      return scoresNew;
    });
  }
  // common player props
  const playerProps = {
    onCollide,
    // moving only on x and z axis
    linearFactor: [1, 1, 0],
    angularFactor: [0, 1, 0],
  };
  return (
    <>
      <Ragdoll onState={bindPlayerA} props={{ position: [-2, 0, ZPos], ...playerProps }} />
      <Ragdoll onState={bindPlayerB} props={{ position: [2, 0, ZPos], ...playerProps }} />
    </>
  );
}

export default Arena;