import React from "react";
import { useColosseum } from "./Colosseum";
import { v5 as generateUUID } from "uuid";
import { Brain } from "../helpers/NN";
import { RAGDOLL_PARTS } from "./Ragdoll";
import { IPlayerData } from "./Arena";

interface IFighter extends IPlayerData {
  score: number | null; // null if the fighter is not evaluated yet
  prevScore: number | null; // the previous score
}

function FightManager({
  fightersPerEpoch = 10,
  seedsN=3,
  updateStats,
}) {
  const { addFighter } = useColosseum(); // get the addFighter function from the context
  const [fighters, setFighters] = React.useState<Map<string, IFighter>>(new Map()); // store the fighters
  const [left, setLeft] = React.useState<number>(0); // number of fighters left to evaluate
  const [epoch, setEpoch] = React.useState<number>(0); // current epoch
  const [highestScore, setHighestScore] = React.useState<number>(Number.MIN_VALUE);
  const [lastHighest, setLastHighest] = React.useState<number>(Number.MIN_VALUE);

  React.useEffect(() => {
    const stats = [
      <div key={'epoch'}>Epoch: {epoch}</div>,
      <div key={'left'}>Fighters to evaluate: {left}</div>,
      <div key={'lastHighest'}>Last highest score: {lastHighest}</div>,
      <div key={'highest'}>Highest score: {highestScore}</div>,
    ];
    updateStats(stats);
  }, [left, epoch, updateStats, highestScore]);

  const onFinishedFun = React.useCallback(({score, uuid, model}) => {
    fighters[uuid].score = score; // update the score
    setLeft((prevLeft) => prevLeft - 1); // decrease the number of fighters left to evaluate
    setHighestScore((prevHighest) => Math.max(prevHighest, score)); // update the highest score
  }, [fighters]);
  const onFinished = React.useRef(onFinishedFun);

  React.useEffect(() => {
    onFinished.current = onFinishedFun;
  }, [onFinishedFun]);
    
  // when all fighters are evaluated
  React.useEffect(() => {
    if (left > 0) return;
    setEpoch(epoch => epoch + 1); // next epoch
    setLastHighest(highestScore); // update the last highest score
    setHighestScore(Number.MIN_VALUE); // reset the highest score

    const fightersArray: IFighter[] = Object.values(fighters);
    if (fightersArray.length === 0) { // we just started
      console.log('Creating fighters at the start');
      // create fighters
      const fightersLocal: Map<string, IFighter> = new Map();
      for (let i = 0; i < fightersPerEpoch; i++) {
        const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
        const model = new Brain({ inputSize: 240, outputSize: RAGDOLL_PARTS.length });
        // apply huge mutation to the model
        model.mutate({ rate: 1.0, std: 10.0 });
        const player: IFighter = { 
          model, callback: onFinished, uuid, score: null, prevScore: null
        };
        fightersLocal[uuid] = player;
        // add the fighter to the colosseum
        addFighter(player, player.uuid);
        setLeft(left => left + 1);
      }
      setFighters(fightersLocal);
      return;
    }
    
    const N = seedsN; // number of seeds
    // sort the fighters by score, in ascending order, higher score is last
    function score(fighter: IFighter) {
      return Math.max(fighter.score, fighter.prevScore || 0);
    }

    fightersArray.sort((a, b) => score(a) - score(b));
    const topN = fightersArray.slice(-N); // get the top N fighters
    const badFighters = fightersArray.slice(0, -N); // get the bad fighters
    // dispose the bad fighters models
    for (const fighter of badFighters) {
      fighter.model.dispose();
    }

    const scores = topN.map(fighter => score(fighter));
    // normalize the scores to sum to 1
    const sum = scores.reduce((a, b) => a + b, 0);
    const probabilities = scores.map(score => score / sum);

    function getFighterIndex() {
      const r = Math.random();
      let cumulative = 0;
      for (let i = 0; i < probabilities.length; i++) {
        cumulative += probabilities[i];
        if (r <= cumulative) {
          return i;
        }
      }
    }

    // create new fighters from the best ones
    const newFighters: Map<string, IFighter> = new Map();
    // first, add the top fighters to the new fighters
    for (const fighter of topN) {
      fighter.prevScore = score(fighter);
      fighter.score = null;
      newFighters[fighter.uuid] = fighter;
    }
    // then, create new fighters by combining the top fighters with mutations
    for (let i = 0; i < fightersPerEpoch; i++) {
      const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
      const parentA = topN[getFighterIndex()].model;
      const parentB = topN[getFighterIndex()].model;
      const factor = 0.5;
      const model = parentA.combine(parentB, factor);
      model.mutate({ rate: 0.5, std: 0.1 });
      
      const player: IFighter = { model, callback: onFinished, uuid, score: null };
      newFighters[uuid] = player;
      addFighter(player, player.uuid);
      setLeft(left => left + 1);
    }
    setFighters(newFighters);
  }, [left, fighters, fightersPerEpoch, seedsN, addFighter, onFinished, epoch, setFighters, setLeft, setEpoch, setLastHighest, setHighestScore]);

  React.useEffect(() => {
    return () => {
      // dispose the models when the component is unmounted
      const all = Array.from(fighters.values());
      for (const fighter of all) {
        fighter.model.dispose();
      }
    };
  }, []);
  return null;
}

export default FightManager;