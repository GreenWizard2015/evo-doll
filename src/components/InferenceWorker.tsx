import React, { useEffect } from 'react';

export interface InferenceResult {
  data: any;
  uuid: string;
};

let worker;
const MODELS_BY_UUID = {};
const CALLBACKS_BY_UUID = {};
function runInference({ model, state, callback, uuid, extras}) {
  if(!worker) {
    throw new Error('Worker not initialized');
  }
  CALLBACKS_BY_UUID[uuid] = callback; // store the callback
  if(!MODELS_BY_UUID[uuid]) {
    MODELS_BY_UUID[uuid] = true;
    worker.postMessage({
      type: 'model',
      model: model.toTranserable(),
      uuid
    });
  }
  worker.postMessage({
    type: 'runInference',
    model: model.toTranserable(),
    state, uuid, extras
  });
}

function InferenceWorker({ updateSpeed }) {
  const inferences = React.useRef(0);
  const startTime = React.useRef(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      updateSpeed(inferences.current / elapsed * 1000);
      inferences.current = 0;
      startTime.current = Date.now();
    }, 1500);
    return () => clearInterval(interval);
  }, [updateSpeed]);

  useEffect(() => {
    const newWorker = new Worker(new URL('../workers/inference.worker.js', import.meta.url));
    worker = newWorker;

    newWorker.onmessage = function(e) {
      const { status } = e.data;
      if('done' === status) {
        const { data, uuid, state, extras } = e.data;
        const callback = CALLBACKS_BY_UUID[uuid];
        if(!callback || !callback.current) {
          throw new Error('Callback not found for ' + uuid);
        }
        callback.current({ data, uuid, state, extras });
        inferences.current++;
        return;
      }
      if('disposed' === status) {
        const { models } = e.data;
        for(const uuid in models) {
          delete MODELS_BY_UUID[uuid];
        }
        console.log('Models disposed', models);
        return;
      }
      if('stopped' === status) {
        console.log('Worker stopped');
        worker.terminate();
        return;
      }
    };

    return () => {
      newWorker.postMessage({ type: 'stop' });
    };
  }, []);
  return null;
};

export default InferenceWorker;
export { runInference };