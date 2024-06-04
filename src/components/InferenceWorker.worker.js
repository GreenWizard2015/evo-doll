const { Brain } = require("../helpers/NN.js");

let queue = {}; // uuid -> { model, state, callback }
let running = false; // dumb way to check if worker is busy

async function processQueue() {
  const keys = Object.keys(queue);
  running = keys.length > 0;
  if (!running) return; // No tasks to process

  // Get next task
  const taskId = keys[0];
  const task = queue[taskId];
  delete queue[taskId];

  const { model, state, extras } = task;
  const brain = Brain.fromTransferable(model);
  const results = brain.predict(state);
  brain.dispose();
  self.postMessage({
    status: "done", data: results, uuid: taskId,
    extras
  });
  
  processQueue(); // Process next task
}

self.onmessage = async function({ data }) {
  if (data.type === "runInference") {
    const { model, state, uuid, extras } = data;
    queue[uuid] = { model, state, extras };
    if (!running) {
      processQueue();
    }
  }
}