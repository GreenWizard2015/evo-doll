import React, { useRef, useEffect, useCallback } from "react";
import { CollisionEvent } from "../helpers/CollisionEvent";
import { RAGDOLL_PARTS, Ragdoll, encodeObservation } from "./Ragdoll";
import { useFrame } from "@react-three/fiber";
import * as THREE from 'three';
import { runInference } from "./InferenceWorker";
import { useBox } from "@react-three/cannon";
import { ReplayBuffer } from "./ReplayBuffer";

interface IPlayerData {
  model: any; // the brain model
  uuid: any; // the UUID of the player
  // reference to the callback function
  callback?: React.MutableRefObject<(any) => void>;
}

interface IFighterData extends IPlayerData {
  ref: React.MutableRefObject<any>; // the reference to the ragdoll object
  action: number[]; // the action of the player
  state: number[]; // the last state of the player
  player: string; // the player name
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

  isPaused: boolean; // the pause flag
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
  onFinished, isPaused
}: IArenaProps) {
  const elapsed = useRef(0);
  const UUID2player = useRef({ });
  const [scores, setScores] = React.useState<IScores>({ playerA: 0, playerB: 0 });

  const fighterA = useRef<IFighterData>({
    ...playerA,
    action: null,
    state: null,
    ref: null,
    player: 'playerA'
  });
  const fighterB = useRef<IFighterData>({
    ...playerB,
    action: null,
    state: null,
    ref: null,
    player: 'playerB'
  });
  // Save the mapping between the UUID of the body and the player
  function saveMapping(ref, player, fighter) {
    for (const partName in ref.current) {
      const { ref: rf, ...data } = ref.current[partName];
      UUID2player.current[rf.current.uuid] = {
        ...data, ref: rf, partName, player,
        parts: ref, fighter
      };
    }
  }

  function bindPlayerA(ref) {
    saveMapping(ref, 'playerA', fighterA);
    fighterA.current.ref = ref;
  }
  function bindPlayerB(ref) {
    saveMapping(ref, 'playerB', fighterB);
    fighterB.current.ref = ref;
  }

  useEffect(() => {
    updateScores(scores, uuid);
  }, [scores, updateScores, uuid]); // update the scores when the scores change

  const onInferenceFun = useCallback(({ data, uuid, state, extras }) => {
    // UUID is the UUID of the head
    const playerData = UUID2player.current[uuid];
    if (!playerData) {
      console.error('Unknown player', uuid);
      throw new Error(`Unknown player ${uuid}!`);
    }
    const { fighter } = playerData;
    fighter.current.action = data;
    ReplayBuffer.add({
      state, action: data, 
      score: extras.time,
      time: extras.time,
      runId: uuid, isDone: false
    });
  }, []);
  const onInference = useRef(onInferenceFun);
  React.useEffect(() => {
    onInference.current = onInferenceFun;
  }, [onInferenceFun]);

  const raycaster = useRef(new THREE.Raycaster());
  const isFinished = useRef(false);
  const onFrame = useCallback(({ scene }, delta) => {
    if (isPaused) return; // Skip processing if the arena is paused
    elapsed.current += delta * 1000; // ms to seconds

    const process = (playerData: IFighterData) => {
      if (!playerData) return;
      const { action, model, ref } = playerData;
      
      const state = encodeObservation({
        raycaster: raycaster.current,
        player: ref.current,
        scene
      });
      // store the state
      playerData.state = state;

      const head = ref.current['head'].ref.current;
      runInference({
        model, state,
        callback: onInference,
        uuid: head.uuid,
        extras: { time: elapsed.current }
      });
      
      if(action) { // apply action if available
        const maxForce = 0.5;
        for (let i = 0; i < RAGDOLL_PARTS.length; i++) {
          const { api } = playerData.ref.current[RAGDOLL_PARTS[i]];
          const vec = [
            action[i * 3] * maxForce,
            action[i * 3 + 1] * maxForce,
            action[i * 3 + 2] * maxForce
          ];
          api.applyImpulse(vec, [0, 0, 0]);
        }
      }
    };

    if (elapsed.current < timeLimit) {
      process(fighterA.current);
      process(fighterB.current);
      return;
    }
    // we beyond the time limit
    if (isFinished.current) return; // we already finished

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
    // call the onFinished callback with all necessary data
    onFinished({ playerA, playerB, uuid, scores });
    // save data to the replay buffer
    ReplayBuffer.add({
      state: fighterA.current.state,
      action: fighterA.current.action,
      time: elapsed.current,
      score: scores.playerA,
      runId: fighterA.current.ref.current['head'].ref.current.uuid,
      isDone: true
    });
    ReplayBuffer.add({
      state: fighterB.current.state,
      action: fighterB.current.action,
      time: elapsed.current,
      score: scores.playerB,
      runId: fighterB.current.ref.current['head'].ref.current.uuid,
      isDone: true
    });
  }, [onInference, timeLimit, onFinished, uuid, scores, isPaused, elapsed]);

  useFrame(onFrame);

  function onCollide(e: CollisionEvent) {
    if (isPaused) return; // Skip collision processing if the arena is paused

    const { body, target } = e;
    if (!body || !target) return; // sometimes the body or target is null
    const targetData = UUID2player.current[target.uuid];
    const bodyData = UUID2player.current[body.uuid];

    if (bodyData?.player === targetData?.player) return; // ignore collision between the same player
    
    const bodyVelocity = bodyData?.velocity.current || new THREE.Vector3();
    const targetVelocity = targetData?.velocity.current || new THREE.Vector3();

    const bodySpeed = bodyVelocity.length();
    const targetSpeed = targetVelocity.length();
    if (bodySpeed > targetSpeed) return; // only count if the body is faster

    let distance_between_players = 0;
    if(bodyData?.player !== undefined) {
      const oponent = (bodyData.player === 'playerA') ? fighterA : fighterB;
      const oponentHead = new THREE.Vector3();
      oponent.current.ref.current['head'].ref.current.getWorldPosition(oponentHead);

      const self = (targetData.player === 'playerA') ? fighterA : fighterB;
      const head = new THREE.Vector3();
      self.current.ref.current['head'].ref.current.getWorldPosition(head);
      distance_between_players = head.distanceTo(oponentHead);
    }
    // penalize the player that is hit

    const tmp = bodyVelocity.clone().sub(targetVelocity);
    const score = tmp.length() - distance_between_players;
    setScores((prevScores) => {
      const scoresNew = { ...prevScores };
      // penalize the player that is hit
      if(targetData) {
        // add head position to the score
        const head = targetData.parts.current['head'].ref.current;
        const globalHead = new THREE.Vector3();
        head.getWorldPosition(globalHead);
        scoresNew[targetData.player] += Math.max(0, globalHead.y);
        scoresNew[targetData.player] -= score;
      }
      // reward the player that hits
      if (bodyData) {
        const head = bodyData.parts.current['head'].ref.current;
        const globalHead = new THREE.Vector3();
        head.getWorldPosition(globalHead);
        scoresNew[bodyData.player] += Math.max(0, globalHead.y);
        
        // penalize the player that if the player hits anything that is not the other player
        scoresNew[bodyData.player] += targetData ? score : -100;
      }
      return scoresNew;
    });
  }
  // common player props
  const playerProps = { onCollide };
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
        position={[0, 0, ZPos+1]} rotation={[0, 0, 0]} args={[100, 100, 0.1]} 
        opacity={0.} transparent
      />
    </>
  );
}

export default Arena;
export type { 
  IScores, IOnFinished, IArenaProps, IPlayerData, IFighterData, IFightFinishedEvent 
};