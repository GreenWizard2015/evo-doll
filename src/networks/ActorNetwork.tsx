import * as tf from '@tensorflow/tfjs';
import { CMLPNetwork } from './MLPNetwork';

class CActorNetwork {
  private model: CMLPNetwork;
  private _stateSize: number;
  private _actionSize: number;

  constructor({ stateSize, actionSize, learningRate=1e-4, model=null}) {
    this.model = model ?? new CMLPNetwork({
      inputSize: stateSize,
      outputSize: actionSize,
      hiddenLayers: 4,
      hiddenUnits: 164,
      finalActivation: 'tanh'
    }, tf.train.adam(learningRate));

    this._stateSize = stateSize;
    this._actionSize = actionSize;
  }

  predict(state) {
    return this.model.predict(state);
  }

  fit(batch, critic) {
    const { state, nextState, action, nextAction, reward, discount } = batch;
    // check shape of state, action, target
    const B = state.length;
    for(const key in batch) {
      if (batch[key].length !== B) { // check batch size
        throw new Error(`The shape of ${key} is invalid.`);
      }
    }

    return this.model.fit(() => {
      const stateT = tf.tensor2d(state, [B, this._stateSize]);
      // const actionT = tf.tensor2d(action, [B, this._actionSize]);
      const nextAction = this.model.predictRaw(stateT);
      const nextStateT = tf.tensor2d(nextState, [B, this._stateSize]);
      const Q = critic.predict(nextStateT, nextAction);

      return tf.mean(tf.mul(Q, -1)); // maximize Q
    }).dataSync();
  }
  
  static fromTransferable({ stateSize, actionSize, model }): CActorNetwork {
    return new CActorNetwork({
      stateSize, actionSize,
      model: CMLPNetwork.fromTransferable(model) 
    });
  }

  toTranserable() {
    return {
      stateSize: this._stateSize,
      actionSize: this._actionSize,
      model: this.model.toTranserable()
    }
  }
  
  mutate({ rate, std }) {
    this.model.mutate({ rate, std });
  }

  copy() {
    return new CActorNetwork({
      stateSize: this._stateSize,
      actionSize: this._actionSize,
      model: this.model.copy()
    });
  }

  combine({ model, factor, inplace=false }) {
    const modelNew = this.model.combine({ model: model.model, factor, inplace });
    if (inplace) {
      this.model = modelNew;
      return this;
    }

    return new CActorNetwork({
      stateSize: this._stateSize,
      actionSize: this._actionSize,
      model: modelNew
    });
  }

  dispose() {
    this.model.dispose();
  }

  compile(params) {
    this.model.compile(params);
  }
}

export { CActorNetwork };