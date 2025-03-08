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
  if(!MODELS_BY_UUID[uuid]) { // if the model is not sent to the worker
    MODELS_BY_UUID[uuid] = true; // mark the model as sent
    worker.postMessage({ // send the model to the worker
      type: 'model',
      model: model.toTranserable(),
      uuid
    });
  }
  // request the worker to run the inference
  worker.postMessage({
    type: 'runInference',
    state, uuid, extras
  });
}

function InferenceWorker({ updateSpeed }) {
  // a bit weird way to estimate the speed
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
  //////////////////////////////////////////////
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
        for(const uuid in models) { // remove disposed models
          delete MODELS_BY_UUID[uuid];
        }
        // console.log('Models disposed', models);
        return;
      }
      if('stopped' === status) {
        console.log('Worker stopped');
        worker.terminate();
        return;
      }
      if ('error' === status) {
        console.error('Worker error', e.data);
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