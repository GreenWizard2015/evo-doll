import * as tf from '@tensorflow/tfjs';

// Define the model
const createModel = ({inputSize, outputSize}) => {
  const model = tf.sequential();
  
  // Input layer
  model.add(tf.layers.dense({ inputShape: [inputSize], units: 256, activation: 'relu' }));
  
  // Hidden layers
  for (let i = 0; i < 4; i++) {
    model.add(tf.layers.dense({ units: 256, activation: 'relu' }));
  }

  // Output layer
  model.add(tf.layers.dense({ units: outputSize, activation: 'sigmoid' }));
  return model;
};

export { createModel };