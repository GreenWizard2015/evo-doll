import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls } from '@react-three/drei';
import Scene from './Scene';
import Arena from './Arena';
import CustomCamera from './CustomCamera';
import InferenceWorker from './InferenceWorker';

const App: React.FC = () => {
  const [scores, setScores] = React.useState([
    { playerA: 0, playerB: 0 }, // Arena 1
    { playerA: 0, playerB: 0 }, // Arena 2
  ]);

  function updateScores(scores, uuid) {
    setScores((prevScores) => {
      const scoresNew = [...prevScores];
      scoresNew[uuid] = scores;
      return scoresNew;
    });
  }

  return (
    <>
      <Canvas id='canvas' style={{ position: 'absolute' }}>
        <CustomCamera />
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <Physics>
          <Scene />

          <Arena ZPos={0} updateScores={updateScores} uuid={0} timeLimit={100} />
          <Arena ZPos={2} updateScores={updateScores} uuid={1} timeLimit={100} />
        </Physics>
        <OrbitControls />
      </Canvas>

      <div style={{ position: 'absolute', top: 0, left: 0, color: 'white', padding: '10px', background: 'rgba(0, 0, 0, 0.5)', borderRadius: '5px' }}>
        {scores.map((scores, i) => (
          <div key={i}>
            <div>Arena {i + 1} | Player A: {scores.playerA} | Player B: {scores.playerB}</div>
          </div>
        ))}
      </div>
      <InferenceWorker />
    </>
  );
}

export default App;