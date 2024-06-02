import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import Arena, { IFightFinishedEvent, IPlayerData, IScores } from './Arena';
import { v5 as generateUUID } from "uuid";

type IColosseumProps = {
  children?: React.ReactNode; // the children components
  totalArenas?: number; // the total number of arenas
  updateScores: (scores: IScores[]) => void; // the callback to update the scores per arena
};

// AddFighter context
interface ICollesseumContext {
  addFighter: (brain: IPlayerData, uuid: any) => void;
}

const ColosseumContext = createContext<ICollesseumContext | undefined>(undefined);

export const useColosseum = () => {
  const context = useContext(ColosseumContext);
  if (!context) {
    throw new Error('useColosseum must be used within a ColosseumProvider');
  }
  return context;
};

function ColosseumProvider({ children, addFighter }) {
  return (
    <ColosseumContext.Provider value={{ addFighter }}>
      {children}
    </ColosseumContext.Provider>
  );
};

function Colosseum({
  totalArenas = 2, updateScores, children
}: IColosseumProps) {
  // for provider
  const [brainQueue, setBrainQueue] = useState<IPlayerData[]>([]);
  const addFighter = useCallback((brain, uuid) => {
    const player: IPlayerData = { ...brain, uuid };
    if(!player.callback) {
      throw new Error('The player must have a callback function');
    }
    // console.log('Adding fighter', player);
    
    setBrainQueue((prevQueue) => [...prevQueue, player]);
  }, []);

  const takeBrains = useCallback(() => {
    const [brainA, brainB, ...rest] = brainQueue;
    setBrainQueue(([_a, _b, ...rest]) => rest);
    return [brainA, brainB];
  }, [brainQueue]);
  ///////////////////
  const [arenas, setArenas] = useState<Array<JSX.Element | null>>(Array(totalArenas).fill(null));
  const [scores, setScores] = useState<IScores[]>(
    Array(totalArenas).fill({ playerA: 0, playerB: 0 })
  );

  useEffect(() => {
    updateScores(scores);
  }, [scores, updateScores]); // propagate the scores to the parent component

  const onUpdateScores = useCallback((scores: IScores, uuid: any) => {
    setScores((prevScores) => {
      const newScores = [...prevScores];
      newScores[uuid] = scores; // update the scores of the arena
      return newScores;
    });
  }, []);

  const [startNextFightFlag, setStartNextFightFlag] = useState(false);
  const handleFinished = useCallback((ev: IFightFinishedEvent) => {
    const { playerA, playerB, scores, uuid } = ev;
    // console.log('Fight finished:', playerA, playerB, scores, uuid);
    
    // send evaluation results to the players
    playerA.callback.current({
      score: scores.playerA,
      uuid: playerA.uuid,
      model: playerA.model,
      arena: uuid
    });
    playerB.callback.current({
      score: scores.playerB,
      uuid: playerB.uuid,
      model: playerB.model,
      arena: uuid
    });

    // update the arena data
    setArenas((prevArenas) => {
      const newArenas = [...prevArenas];
      newArenas[uuid] = null; // free the arena
      return newArenas;
    });
    // trigger the next fight
    setStartNextFightFlag(generateUUID(Date.now().toString(), generateUUID.DNS));
  }, []);

  /* eslint-disable react-hooks/exhaustive-deps */
  const startNextFight = useCallback(() => {
    const freeArenaIndex = arenas.indexOf(null);
    if (freeArenaIndex < 0) {
      // console.log('No free arena');
      return;
    }
    // console.log(brainQueue.length, 'brains left');
    
    if (brainQueue.length < 2) {
      // console.log('Not enough brains to fight');
      // console.log('Queue:', brainQueue);
      return;
    }

    // take the next two brains from the queue
    const [brainA, brainB] = takeBrains();
    const newArena = ( // create the new arena
      <Arena
        key={generateUUID(Date.now().toString(), generateUUID.DNS)}
        uuid={freeArenaIndex}
        ZPos={freeArenaIndex * 2}
        timeLimit={10 * 1000}
        playerA={brainA}
        playerB={brainB}
        updateScores={onUpdateScores}
        onFinished={handleFinished}
      />
    );
    setArenas((prevArenas) => {
      const newArenas = [...prevArenas];
      newArenas[freeArenaIndex] = newArena; // add the new arena data
      return newArenas;
    });
  }, [
    arenas, brainQueue, handleFinished, onUpdateScores, takeBrains,
    startNextFightFlag // trigger the next fight when the flag changes
  ]);

  useEffect(() => {
    startNextFight();
  }, [brainQueue, startNextFight]); // start the next fight when the queue changes

  return (
    <ColosseumProvider addFighter={addFighter}>
      {arenas}
      {children}
    </ColosseumProvider>
  );
}

export default Colosseum;