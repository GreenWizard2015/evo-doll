const { CReplayBuffer } = require("../components/ReplayBuffer.tsx");
const { CriticNetwork } = require("../networks/CriticNetwork.tsx");
const { CActorNetwork } = require("../networks/ActorNetwork.tsx");

let dataset = null;
let critic = new CriticNetwork({
  stateSize: 60,
  actionSize: 11 * 3,
});
let running = false;
let BATCH_SIZE = 32;
const fightersConfigs = [];
let fighter = null;
let fighterUUID = null;
let fighterEpoch = 0;
const MAX_EPOCHS = 100;

async function loop() {
  if (null === dataset) return; // dataset is not ready
  if (null === critic) return; // critic is disposed

  const batch = dataset.sample(BATCH_SIZE);
  if(fighter) { // Train the fighter, if it's available
    const fighterLoss = await fighter.fit(batch, critic);
    console.log("Fighter Loss", fighterLoss);
    fighterEpoch++;
    if(fighterEpoch === MAX_EPOCHS) {
      // Send the trained fighter to the main thread
      self.postMessage({
        type: "trained",
        uuid: fighterUUID,
        model: fighter.toTranserable()
      });
      // clean up the fighter
      fighter.dispose();
      fighter = null;
      fighterEpoch = 0;
    }
  } else {
    if(fightersConfigs.length == 0) { // Train the critic, if there are no fighters
      const loss = await critic.fit(batch);
      // console.log("Loss", loss);
    } else { // take the next fighter from the queue
      const { model, uuid } = fightersConfigs.pop();
      fighterUUID = uuid;
      fighter = CActorNetwork.fromTransferable(model);
      fighter.compile({
        optimizer: "adam",
        loss: [null]
      });
      fighterEpoch = 0; // reset the epoch
    }
  }
  setTimeout(loop, 0); // Process next batch
}

self.onmessage = async function({ data }) {
  if (data.type === "stop") {
    console.log("Stopping the worker");
    critic.dispose();
    critic = null;
    if(fighter) { // clean up the fighter, if it's available
      fighter.dispose();
      fighter = null;
    }
    self.postMessage({ type: "stopped" });
    return;
  }

  if (data.type === "dataset") {
    dataset = new CReplayBuffer(data.dataset);
    console.log("Dataset received", dataset);
  }

  if (data.type === "train") {
    const { model, uuid } = data;
    fightersConfigs.push({ model, uuid });
  }

  if(!running) { // Start the loop, if it's not already running
    running = true;
    loop();
  }
}