import React, { useRef } from "react";
import { CollisionEvent } from "../helpers/CollisionEvent";
import { RAGDOLL_PARTS, Ragdoll, encodeObservation } from "./Ragdoll";
import { useFrame } from "@react-three/fiber";
import * as THREE from 'three';
import { runInference } from "./InferenceWorker";
import { useBox } from "@react-three/cannon";

interface IPlayerData {
  model: any; // the brain model
  uuid: any; // the UUID of the player
  callback?: any; // the callback when the player is evaluated
}

interface IFighterData extends IPlayerData {
  ref: any; // the ref of the player
  state: any; // the state of the player
  action: number[]; // the action of the player
}

interface IScores {
  playerA: number;
  playerB: number;
}

interface IFightFinishedEvent {
  playerA: IPlayerData;
  playerB: IPlayerData;
  uuid: string; // the UUID of the arena
  scores: IScores; // the scores of the fight
}

type IOnFinished = (event: IFightFinishedEvent) => void;
type IArenaProps = {
  ZPos: number; // the Z position of the arena
  uuid: any; // the UUID of the arena
  timeLimit: number; // the time limit of the arena in milliseconds
  
  playerA: IPlayerData; // the player A
  playerB: IPlayerData; // the player B
  
  onFinished: IOnFinished; // the callback when the fight is finished
  updateScores: (scores: IScores, uuid: any) => void;
};

function Wall({ position, rotation, args, opacity, transparent }) {
  const [ref] = useBox(() => ({
    position,
    rotation,
    args,
    material: {
      friction: 1 
    }
  }));

  return (
    <>
      {/* @ts-ignore */}
      <mesh ref={ref} name='wall' receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color="gray" transparent={transparent} opacity={opacity} />
      </mesh>
    </>
  );
}

function Arena({
  ZPos, updateScores, uuid, timeLimit, playerA, playerB,
  onFinished
}: IArenaProps) {
  const startTimestamp = useRef(Date.now());
  const UUID2player = useRef({ });
  const [scores, setScores] = React.useState<IScores>({ playerA: 0, playerB: 0 });

  const fighterA = useRef<IFighterData>({
    ...playerA,
    state: null,
    action: null,
    ref: null,
  });
  const fighterB = useRef<IFighterData>({
    ...playerB,
    state: null,
    action: null,
    ref: null,
  });
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
    fighterA.current.ref = ref;
  }
  function bindPlayerB(ref) {
    saveMapping(ref, 'playerB');
    fighterB.current.ref = ref;
  }

  React.useEffect(() => {
    updateScores(scores, uuid);
  }, [scores, updateScores, uuid]); // update the scores when the scores change

  const onInference = React.useCallback(({ data, uuid }) => {
    if (uuid === 'playerA') {
      fighterA.current.action = data;
    } else if (uuid === 'playerB') {
      fighterB.current.action = data;
    } else {
      console.error('Unknown player', uuid);
      throw new Error(`Unknown player ${uuid}!`);
    }
  }, []);

  const raycaster = useRef(new THREE.Raycaster());
  const isFinished = useRef(false);
  const onFrame = React.useCallback(({ scene }) => {
    const process = (playerData) => {
      if (playerData) return;
      const { player, action, model } = playerData
      const state = encodeObservation({
        raycaster: raycaster.current,
        player: playerData.ref,
        scene
      });

      runInference({
        model, state,
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
    ////////////////////////////
    if (Date.now() - startTimestamp.current > timeLimit) {
      if (!isFinished.current) {
        isFinished.current = true;
        const playerA: IPlayerData = {
          model: fighterA.current.model,
          uuid: fighterA.current.uuid,
          callback: fighterA.current.callback
        };
        const playerB: IPlayerData = {
          model: fighterB.current.model,
          uuid: fighterB.current.uuid,
          callback: fighterB.current.callback
        };
        onFinished({
          playerA,
          playerB,
          uuid,
          scores
        });
      }
      return;
    }
    process(fighterA.current);
    process(fighterB.current);
  }, [onInference, timeLimit, onFinished, uuid, scores]);

  useFrame(onFrame);

  function onCollide(e: CollisionEvent) {
    const { body, target } = e;
    const targetData = UUID2player.current[target.uuid];
    const bodyData = UUID2player.current[body.uuid];

    if (bodyData?.player === targetData?.player) return; // ignore collision between the same player
    
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
        scoresNew[bodyData.player] += targetData ? score : -0.1 * score;
      }
      return scoresNew;
    });
  }
  // common player props
  const playerProps = {
    onCollide,
  };
  return (
    <>
      <Ragdoll onState={bindPlayerA} props={{ position: [-2, 0, ZPos], ...playerProps }} />
      <Ragdoll onState={bindPlayerB} props={{ position: [2, 0, ZPos], ...playerProps }} />
      {/* Invisible Walls to restrict the players */}
      <Wall 
        position={[0, 0, ZPos-1]} rotation={[0, 0, 0]} args={[100, 100, 0.1]} 
        opacity={0.} transparent 
      />
      <Wall 
        position={[0, 0, ZPos-1]} rotation={[0, 0, 0]} args={[100, 100, 0.1]} 
        opacity={0.} transparent
      />
    </>
  );
}

export default Arena;
export type { 
  IScores, IOnFinished, IArenaProps, IPlayerData, IFighterData, IFightFinishedEvent 
};