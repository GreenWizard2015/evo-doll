import React, { MutableRefObject } from "react";
import { ReplayBuffer } from "./ReplayBuffer";
import { CActorNetwork } from "../networks/ActorNetwork";

type TrainedEventCallback = (model: CActorNetwork, uuid: string) => void;
interface ITrainerContext {
  nextEpoch: () => void;
  train: (model: CActorNetwork, callback: MutableRefObject<TrainedEventCallback>, uuid: string) => void;
}

const TrainerContext = React.createContext<ITrainerContext | undefined>(undefined);

export const useTrainer = () => {
  const context = React.useContext(TrainerContext);
  if (!context) {
    throw new Error('useTrainer must be used within a TrainerProvider');
  }
  return context;
};

function TrainerProvider({ children }) {
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [callbacksByUUID, setCallbacksByUUID] = React.useState<
    Record<string, MutableRefObject<TrainedEventCallback>
  >>({});
  const nextEpoch = React.useCallback(() => {
    if (!worker) return; // FIXME: handle this case on start
    worker.postMessage({
      type: 'dataset',
      dataset: ReplayBuffer.raw() // clone the replay buffer
    });
  }, [worker]);

  const train = React.useCallback(
    (model: CActorNetwork, callback: MutableRefObject<TrainedEventCallback>, uuid: string) => {
      console.log('Training', uuid);
      if (!worker) {
        throw new Error('Worker not ready');
      }
      setCallbacksByUUID((prev) => ({ ...prev, [uuid]: callback }));
      worker.postMessage({
        type: 'train',
        model: model.toTranserable(),
        uuid
      }); 
    }
  , [worker]);

  React.useEffect(() => {
    const worker = new Worker(new URL('../workers/trainer.worker.js', import.meta.url));
    setWorker(worker);
    worker.onmessage = (event) => {
      const { type, model, uuid } = event.data;
      if (type === 'trained') {
        console.log('Trained', uuid);
        const callback = callbacksByUUID[uuid];
        if (callback && callback.current) {
          callback.current(CActorNetwork.fromTransferable(model), uuid);
        }
      }
    };
    return () => worker.terminate();
  }, []);

  return (
    <TrainerContext.Provider value={{ nextEpoch, train }}>
      {children}
    </TrainerContext.Provider>
  );
};

function Trainer({ children }) {
  return (
    <TrainerProvider>
      {children}
    </TrainerProvider>
  );
}

export default Trainer;
export type { TrainedEventCallback };