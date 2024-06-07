const { CActorNetwork } = require("../networks/ActorNetwork.tsx");

let queue = {}; // uuid -> { model, state, callback }
let keys = []; // uuids
let running = false; // dumb way to check if worker is busy

async function processQueue() {
  running = keys.length > 0;
  if (!running) return; // No tasks to process
  
  // Get next task
  const taskId = keys.pop();
  const task = queue[taskId];
  delete queue[taskId];

  const { model, state, extras } = task;
  const network = CActorNetwork.fromTransferable(model);
  const results = network.predict([state]);
  network.dispose();
  self.postMessage({
    status: "done", 
    data: results, 
    uuid: taskId,
    state,
    extras
  });
  
  processQueue(); // Process next task
}

self.onmessage = async function({ data }) {
  if (data.type === "runInference") {
    const { model, state, uuid, extras } = data;
    queue[uuid] = { model, state, extras };
    if (!keys.includes(uuid)) keys.push(uuid);
    if (!running) {
      processQueue();
    }
  }
}