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

function FightManager({
  fightersPerEpoch = 10,
  seedsN=3,
  updateStats,
}) {
  const colosseum = useColosseum(); // get the addFighter function from the context
  const trainer = useTrainer(); // get the trainer context
  const [fighters, setFighters] = React.useState<Map<string, IFighter>>(new Map()); // store the fighters
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
    fighters[uuid].score = score; // update the score
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
    setFighters((prevFighters) => ({...prevFighters, [uuid]: player})); 
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

    const fightersArray: IFighter[] = Object.values(fighters);
    setFighters(new Map()); // clear the fighters
    setLeft(fightersPerEpoch); // set the number of fighters left to evaluate
    if (fightersArray.length === 0) { // we just started
      console.log('Creating fighters at the start');
      // create fighters
      for (let i = 0; i < fightersPerEpoch; i++) {
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
      return probabilities.length - 1;
    }

    // first, add the top fighters to the new fighters
    for (const fighter of topN) {
      const { uuid, model } = fighter;
      onTrained.current(model, uuid, {score: null, prevScore: score(fighter)});
    }
    // then, create new fighters by combining the top fighters with mutations
    for (let i = 0; i < fightersPerEpoch; i++) {
      const uuid = generateUUID(Date.now().toString(), generateUUID.DNS);
      const parentA = topN[getFighterIndex()].model;
      const parentB = topN[getFighterIndex()].model;
      const factor = 0.5; // average the weights
      const model = parentA.combine({model: parentB, factor});
      model.mutate({ rate: 0.5, std: 0.001 });
      
      trainer.train(model, onTrained, uuid);
    }
  }, [
    left, fighters, fightersPerEpoch, onFinished, seedsN, colosseum, onTrained, trainer,
    highestScore, lastHighest
  ]);

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