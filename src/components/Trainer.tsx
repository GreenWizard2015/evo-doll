import React, { MutableRefObject } from "react";
import { ReplayBuffer } from "./ReplayBuffer";
import { CActorNetwork } from "../networks/ActorNetwork";

type TrainedEventCallback = (model: CActorNetwork, uuid: string, data?: any) => void;
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

function TrainerProvider({ children, trainable}) {
  const worker = React.useRef<Worker | null>(null);
  const callbacksByUUID = React.useRef<
    Map<string, MutableRefObject<TrainedEventCallback>
  >>(new Map());
  const nextEpoch = React.useCallback(() => {
    if (!worker.current) return; // FIXME: handle this case on start
    if (!trainable) return;
    worker.current.postMessage({
      type: 'dataset',
      dataset: ReplayBuffer.raw() // clone the replay buffer
    });
  }, [trainable, worker]);

  const train = React.useCallback(
    (model: CActorNetwork, callback: MutableRefObject<TrainedEventCallback>, uuid: string) => {
      if (!worker.current) {
        throw new Error('Worker not ready');
      }
      if (!trainable) {
        callback.current(model, uuid); // immediately return the model
        return;
      }
      callbacksByUUID.current[uuid] = callback;      
      worker.current.postMessage({
        type: 'train',
        model: model.toTranserable(),
        uuid
      });
    }
  , [trainable, callbacksByUUID, worker]);

  React.useEffect(() => {
    const newWorker = new Worker(new URL('../workers/trainer.worker.js', import.meta.url));
    worker.current = newWorker;
    newWorker.onmessage = (event) => {
      const { type, model, uuid } = event.data;
      if (type === 'trained') {
        console.log('Trained', uuid);
        const callback = callbacksByUUID.current[uuid];
        if (callback && callback.current) {
          const network = CActorNetwork.fromTransferable(model);
          callback.current(network, uuid);
          delete callbacksByUUID[uuid];
        } else {
          throw new Error('Callback not found for ' + uuid);
        }
      }
      if (type === 'stopped') {
        console.log('Worker is stopped');
        newWorker.terminate();
      }
    };
    newWorker.onerror = (error) => {
      console.error('Worker error', error);
    };
    return () => {
      newWorker.postMessage({ type: 'stop' });
    };
  }, [callbacksByUUID]);

  const api = React.useMemo(
    () => ({ nextEpoch, train }),
    [nextEpoch, train]
  );

  return (
    <TrainerContext.Provider value={api}>
      {children}
    </TrainerContext.Provider>
  );
};

function Trainer({ children, trainable }) {
  return (
    <TrainerProvider trainable={trainable}>
      {children}
    </TrainerProvider>
  );
}

export default Trainer;
export type { TrainedEventCallback };