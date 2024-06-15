import * as tf from '@tensorflow/tfjs';
import { CMLPNetwork } from '../networks/MLPNetwork';

class CriticNetwork {
  private modelA: CMLPNetwork;
  private modelB: CMLPNetwork;
  private _stateSize: number;
  private _actionSize: number;
  private _tau: number;

  constructor({ stateSize, actionSize, learningRate=1e-4}) {
    this.modelA = new CMLPNetwork({
      inputSize: stateSize + actionSize,
      outputSize: 1,
      hiddenLayers: 4,
      hiddenUnits: 164,
      finalActivation: 'linear'
    }, tf.train.adam(learningRate));
    this.modelB = new CMLPNetwork({
      inputSize: stateSize + actionSize,
      outputSize: 1,
      hiddenLayers: 4,
      hiddenUnits: 164,
      finalActivation: 'linear'
    });

    this._stateSize = stateSize;
    this._actionSize = actionSize;
    
    this._tau = 0.001;
  }

  predict(state: tf.Tensor2D, action: tf.Tensor2D, target=false) {
    const model = target ? this.modelB : this.modelA;
    return tf.tidy(() => {
      const input = tf.concat([state, action], -1);
      return model.predictRaw(input);
    });
  }

  fit(params) {
    const { state, nextState, action, nextAction, reward, discount } = params;
    // check shape of state, action, target
    const B = state.length;
    for(const key in params) {
      if (params[key].length !== B) { // check batch size
        throw new Error(`The shape of ${key} is invalid.`);
      }
    }
    
    // calculate target Q values
    const target = tf.tidy(() => {
      const NSTensor = tf.tensor2d(nextState, [B, this._stateSize]);
      const NATensor = tf.tensor2d(nextAction, [B, this._actionSize]);
      const nextQ = this.predict(NSTensor, NATensor, true) as tf.Tensor2D;
      
      const gamma = tf.tensor2d(discount, [B, 1]);
      const targetQ = tf.add(reward, tf.mul(nextQ, gamma));
      return targetQ.dataSync();
    });
    
    // train the model
    const loss = this.modelA.fit(() => {
      const stateTensor = tf.tensor2d(state, [B, this._stateSize]);
      const actionTensor = tf.tensor2d(action, [B, this._actionSize]);
      const targetTensor = tf.tensor2d(target, [B, 1]);

      const predicted = this.predict(stateTensor, actionTensor) as tf.Tensor2D;
      const loss = tf.losses.meanSquaredError(targetTensor, predicted);
      return tf.mean(loss);
    });

    // update target model
    this.modelB.combine({ model: this.modelA, factor: this._tau, inplace: true});
    return loss.dataSync();
  }
  
  dispose() {
    this.modelA.dispose();
    this.modelB.dispose();
  }
}

export { CriticNetwork };