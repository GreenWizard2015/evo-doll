import React from "react";
import { useColosseum } from "./Colosseum";
import { v5 as generateUUID } from "uuid";
import { CActorNetwork } from "../networks/ActorNetwork";
import { RAGDOLL_PARTS } from "./Ragdoll";
import { IPlayerData } from "./Arena";
import { TrainedEventCallback, useTrainer } from "./Trainer";

interface IFighter extends IPlayerData {
  score: number | null; // null if the fighter is not evaluated yet
  prevScore: number | null; // the previous score
}

// helper functions
function generateUniquePairs(N) {
  const newPairs = [];
  for (let i = 0; i <= N; i++) {
    for (let j = i + 1; j <= N; j++) {
      newPairs.push([i, j]);
    }
  }
  return newPairs;
}

function generateSplits(crossoversSplits) {
  if (crossoversSplits < 1) return [];
  const splits = [];
  for (let i = 1; i <= crossoversSplits; i++) {
    splits.push(i / (crossoversSplits + 1));
  }
  return splits;
}

function FightManager({
  seedsN,
  updateStats,
  addStatistic,
  additiveNoiseStd,
  crossoversSplits,
}) {
  const colosseum = useColosseum(); // get the addFighter function from the context
  const trainer = useTrainer(); // get the trainer context
  const fighters = React.useRef<Map<string, IFighter>>(new Map()); // store the fighters
  const [left, setLeft] = React.useState<number>(0); // number of fighters left to evaluate
  const [epoch, setEpoch] = React.useState<number>(0); // current epoch
  const [highestScore, setHighestScore] = React.useState<number>(-Number.MAX_VALUE); // highest score
  const [lastHighest, setLastHighest] = React.useState<number>(-Number.MAX_VALUE); // last highest score

  React.useEffect(() => {
    const stats = [
      <div key={'epoch'}>Epoch: {epoch}</div>,
      <div key={'left'}>Fighters to evaluate: {left}</div>,
      <div key={'lastHighest'}>Last highest score: {lastHighest}</div>,
      <div key={'highest'}>Highest score: {highestScore}</div>,
    ];
    updateStats(stats);
  }, [left, epoch, updateStats, highestScore, lastHighest]);

  const onFinishedFun = React.useCallback(({score, uuid, model}) => {
    fighters.current[uuid].score = score; // update the score
    // decrease the number of fighters left to evaluate
    setLeft((prevLeft) => prevLeft - 1);
    setHighestScore((prevHighest) => Math.max(prevHighest, score)); // update the highest score
  }, [fighters]);
  const onFinished = React.useRef(onFinishedFun);

  React.useEffect(() => {
    onFinished.current = onFinishedFun;
  }, [onFinishedFun]);
  
  const onTrainedFun: TrainedEventCallback = React.useCallback((model, uuid, data=null) => {
    console.log(`Fighter ${uuid} trained`);
    if(!data) {
      data = {score: null, prevScore: null};
    }
    const player: IFighter = { // create a new player
      model, callback: onFinished, uuid, ...data
    };
    // add the player to the fighters    
    fighters.current[uuid] = player;
    // increase the number of fighters left to evaluate
    // setLeft((prevLeft) => prevLeft + 1);
    colosseum.addFighter(player, uuid); // add the fighter to the colosseum
  }, [fighters, colosseum, onFinished]);

  const onTrained = React.useRef(onTrainedFun);
  // when all fighters are evaluated
  React.useEffect(() => {
    if (left > 0) return;
    setEpoch(epoch => epoch + 1); // next epoch
    trainer.nextEpoch(); // tell the trainer to start the next epoch
    setLastHighest(highestScore); // update the last highest score
    setHighestScore(-Number.MAX_VALUE); // reset the highest score

    const fightersArray: IFighter[] = Object.values(fighters.current);
    fighters.current = new Map(); // clear the fighters
    if (fightersArray.length === 0) { // we just started
      console.log('Creating fighters at the start');
      // create fighters
      setLeft(seedsN); // set the number of fighters left to evaluate
      for (let i = 0; i < seedsN; i++) {
        const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
        const model = new CActorNetwork({
          stateSize: 240,
          actionSize: RAGDOLL_PARTS.length * 3
        });
        // apply huge mutation to the model
        model.mutate({ rate: 1.0, std: 10.0 });
        onTrained.current(model, uuid); // imitate the training process
      }
      return;
    }
    // add the statistics only if we have scored fighters
    addStatistic({
      epoch,
      scores: fightersArray.map(fighter => fighter.score),
    });
    const N = seedsN; // number of seeds
    // sort the fighters by score, in ascending order, higher score is last
    function score(fighter: IFighter) {
      return Math.max(fighter.score, fighter.prevScore || 0);
    }

    fightersArray.sort((a, b) => score(a) - score(b));
    const topN = fightersArray.slice(-N); // get the top N fighters
    // dispose the bad fighters models
    for (const fighter of fightersArray.slice(0, -N)) {
      fighter.model.dispose();
    }

    setLeft(topN.length); // set the number of fighters left to evaluate
    // first, add the top fighters to the new fighters
    for (const fighter of topN) {
      const { uuid, model } = fighter;
      onTrained.current(model, uuid, {score: null, prevScore: score(fighter)});
    }
    const newFighters = [];
    // add each fighter to the new fighters with noise
    if (0 < additiveNoiseStd) {
      for (const fighter of topN) {
        const { model } = fighter;
        const newModel = model.copy();
        newModel.mutate({ rate: 1.0, std: additiveNoiseStd });
        newFighters.push(newModel);
      }
    }
    // create unique pairs and combine them
    const pairs = generateUniquePairs(topN.length - 1);
    for (const [indxA, indxB] of pairs) {
      const parentA = topN[indxA].model;
      const parentB = topN[indxB].model;
      const splits = generateSplits(crossoversSplits);
      for (const split of splits) {
        const model = parentA.combine({model: parentB, factor: split});
        model.mutate({ rate: 1.0, std: additiveNoiseStd });
        newFighters.push(model);
      }
    }
    // make sure the number of new fighters is even always
    // so we can create pairs for the fights
    if ((topN.length + newFighters.length) % 2 === 1) {
      newFighters.push(topN[topN.length - 1].model.copy());
    }
    setLeft(oldValue => oldValue + newFighters.length); // add the number of new fighters
    for (const model of newFighters) {      
      const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
      trainer.train(model, onTrained, uuid);
    }
  }, [
    left, fighters, onFinished, seedsN, colosseum, onTrained, trainer,
    highestScore, lastHighest, addStatistic, epoch, additiveNoiseStd, crossoversSplits
  ]);

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