import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import Arena, { IFightFinishedEvent, IPlayerData, IScores } from './Arena';

interface IArenaData {
  brainA: IPlayerData;
  brainB: IPlayerData;
  uuid: any;
}
type IArenaDataItem = IArenaData | null;

type IColosseumProps = {
  totalArenas?: number; // the total number of arenas
  updateScores: (scores: IScores[]) => void; // the callback to update the scores per arena
  brainQueue: IPlayerData[]; // the queue of brains to fight
  setBrainQueue: React.Dispatch<React.SetStateAction<IPlayerData[]>>;
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

function ColosseumComponent({
  totalArenas = 2, updateScores, brainQueue, setBrainQueue
}: IColosseumProps) {
  const arenas = useRef<IArenaDataItem[]>(Array(totalArenas).fill(null));
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

  const startNextFight = useCallback(() => {    
    const freeArenaIndex = arenas.current.indexOf(null);
    if (freeArenaIndex < 0) {
      console.log('No free arena');
      return;
    }
    if (brainQueue.length < 2) {
      console.log('Not enough brains to fight');
      console.log('Queue:', brainQueue);
      return;
    }

    // take the next two brains from the queue
    const brainA = brainQueue[0];
    const brainB = brainQueue[1];
    const newArenaData: IArenaData = {
      brainA: brainA,
      brainB: brainB,
      uuid: freeArenaIndex, // the UUID of the arena is the index
    };
    // remove the brains from the queue
    setBrainQueue((prevQueue) => prevQueue.slice(2)); // remove the brains from the queue
    arenas.current[freeArenaIndex] = newArenaData; // assign the new fight to the arena
  }, [brainQueue, setBrainQueue]);

  useEffect(() => {
    startNextFight();
  }, [brainQueue]); // start the next fight when the queue changes

  const handleFinished = React.useCallback((ev: IFightFinishedEvent) => {
    const { playerA, playerB, scores, uuid } = ev;
    console.log('Fight finished:', playerA, playerB, scores, uuid);
    
    // send evaluation results to the players
    playerA.callback({
      score: scores.playerA,
      uuid: playerA.uuid,
      model: playerA.model,
      arena: uuid
    });
    playerB.callback({
      score: scores.playerB,
      uuid: playerB.uuid,
      model: playerB.model,
      arena: uuid
    });

    // update the arena data
    arenas.current[uuid] = null; // free the arena
    startNextFight(); // start the next fight if possible
  }, [startNextFight]);

  return (
    <>
      {arenas.current.map((arena, i) => 
        arena ? (
          <Arena
            key={i}
            uuid={arena.uuid}
            ZPos={i * 2}
            timeLimit={10 * 1000}
            playerA={arena.brainA}
            playerB={arena.brainB}
            updateScores={onUpdateScores}
            onFinished={handleFinished}
          />
        ) : null
      )}
    </>
  );
};

interface IColosseumPublicProps {
  children?: any;
  totalArenas?: number;
  updateScores: (scores: IScores[]) => void;
}

function Colosseum({ children, totalArenas = 2, updateScores}: IColosseumPublicProps) {
  const [brainQueue, setBrainQueue] = useState<IPlayerData[]>([]);

  const addFighter = React.useCallback((brain, uuid) => {
    const player: IPlayerData = { ...brain, uuid };
    if(!player.callback) {
      throw new Error('The player must have a callback function');
    }
    console.log('Adding fighter', player);
    
    setBrainQueue((prevQueue) => [...prevQueue, player]);
  }, []);

  return (
    <ColosseumProvider addFighter={addFighter}>
      <ColosseumComponent 
        brainQueue={brainQueue} setBrainQueue={setBrainQueue}
        totalArenas={totalArenas} updateScores={updateScores}
      />
      {children}
    </ColosseumProvider>
  );
};

export default Colosseum;