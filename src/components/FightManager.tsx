import React from "react";
import { useColosseum } from "./Colosseum";
import { v5 as generateUUID } from "uuid";
import { Brain } from "../helpers/NN";
import { RAGDOLL_PARTS } from "./Ragdoll";
import { IPlayerData } from "./Arena";

interface IFighter extends IPlayerData {
  score: number | null; // null if the fighter is not evaluated yet
}

function FightManager({
  fightersPerEpoch = 10,
  seedsN=3,
  updateStats,
}) {
  const colosseum = useColosseum();
  const { addFighter } = colosseum; // get the addFighter function from the context
  const fighters = React.useRef<Map<string, IFighter>>(new Map()); // store the fighters
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

  const onFinished = React.useCallback(({score, uuid, model}) => {
    fighters.current[uuid].score = score; // update the score
    console.log('Fighter', uuid, 'scored', score);
    
    setLeft((prevLeft) => prevLeft - 1); // decrease the number of fighters left to evaluate
    setHighestScore((prevHighest) => Math.max(prevHighest, score)); // update the highest score
  }, [fighters]);
    
  // when all fighters are evaluated
  React.useEffect(() => {
    if (left > 0) return;
    setEpoch(epoch => epoch + 1); // next epoch
    setLastHighest(highestScore); // update the last highest score
    setHighestScore(Number.MIN_VALUE); // reset the highest score

    const fightersArray: IFighter[] = Array.from(fighters.current.values());
    if (fightersArray.length === 0) { // we just started
      // create fighters
      const fightersLocal: Map<string, IFighter> = new Map();
      for (let i = 0; i < fightersPerEpoch; i++) {
        const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
        const model = new Brain({ inputSize: 240, outputSize: RAGDOLL_PARTS.length });
        // apply huge mutation to the model
        model.mutate({ rate: 1.0, std: 10.0 });
        const player: IFighter = { model, callback: onFinished, uuid, score: null };
        fightersLocal[uuid] = player;
        // add the fighter to the colosseum
        addFighter(player, player.uuid);
        setLeft(left => left + 1);
      }
      fighters.current = fightersLocal;
      return;
    }
    
    const N = seedsN; // number of seeds
    // sort the fighters by score, in ascending order, higher score is last
    fightersArray.sort((a, b) => (a.score || 0) - (b.score || 0));
    const topN = fightersArray.slice(-N); // get the top N fighters
    const badFighters = fightersArray.slice(0, -N); // get the bad fighters
    // dispose the bad fighters models
    for (const fighter of badFighters) {
      fighter.model.dispose();
    }

    // create new fighters from the best ones
    const newFighters: Map<string, IFighter> = new Map();
    // first, add the top fighters to the new fighters
    for (const fighter of topN) {
      newFighters[fighter.uuid] = fighter;
    }
    // then, create new fighters by combining the top fighters with mutations
    for (let i = 0; i < fightersPerEpoch; i++) {
      const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
      const parentA = topN[Math.floor(Math.random() * topN.length)].model;
      const parentB = topN[Math.floor(Math.random() * topN.length)].model;
      const factor = 0.5;
      const model = parentA.combine(parentB, factor);
      model.mutate({ rate: 0.5, std: 0.01 });
      const player: IFighter = { model, callback: onFinished, uuid, score: null };
      newFighters[uuid] = player;
      addFighter(player, player.uuid);
      setLeft(left => left + 1);
    }
  }, [left, fighters, fightersPerEpoch, addFighter, onFinished, seedsN]);

  React.useEffect(() => {
    return () => {
      // dispose the models when the component is unmounted
      const all = Array.from(fighters.current.values());
      for (const fighter of all) {
        fighter.model.dispose();
      }
    };
  }, []);
  return null;
}

export default FightManager;