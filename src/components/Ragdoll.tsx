import React, { createContext, useContext, useRef, useEffect } from 'react';
import { useBox, useConeTwistConstraint } from '@react-three/cannon';
import { createRagdoll } from '../helpers/createRagdoll';
import { useDragConstraint } from '../helpers/Drag';
import { Block } from '../helpers/Block';
import { useFrame } from '@react-three/fiber';

const { shapes, joints } = createRagdoll(1.5, Math.PI / 16, Math.PI / 16, 0);
const context = createContext();

const BodyPart = ({ setApi, config, children, render, name, ...props }: 
   { setApi?: any, config?: any, children?: any, render?: any, name: string }) => {
  const { color, args, mass, position } = shapes[name];
  const parent = useContext(context);
  const [boxRef, api] = useBox(() => ({ mass, args, position, ...props }));
  useEffect(() => {
    if (setApi) setApi(api, boxRef);
  }, [api, setApi, boxRef]);
  useConeTwistConstraint(boxRef, parent, config);
  const bind = useDragConstraint(boxRef);
  return (
    <context.Provider value={boxRef}>
      <Block castShadow receiveShadow ref={boxRef} {...props} {...bind} scale={args} name={name} color={color}>
        {render}
      </Block>
      {children}
    </context.Provider>
  );
};

export function Ragdoll({ onState, props }: { onState: (state: any) => void, props: any}) {
  const state = useRef({ });
  useEffect(() => onState && onState(state), [onState, state]);

  function bind(api, ref) {
    const name = ref.current.name;
    state.current[name] = { api, ref };
  }

  return (
    <BodyPart name="upperBody" setApi={bind} {...props}>
      <BodyPart {...props} name="head" setApi={bind} config={joints['neckJoint']} />
      <BodyPart {...props} name="upperLeftArm" setApi={bind} config={joints['leftShoulder']}>
        <BodyPart {...props} name="lowerLeftArm" setApi={bind} config={joints['leftElbowJoint']} />
      </BodyPart>
      <BodyPart {...props} name="upperRightArm" setApi={bind} config={joints['rightShoulder']}>
        <BodyPart {...props} name="lowerRightArm" setApi={bind} config={joints['rightElbowJoint']} />
      </BodyPart>
      <BodyPart {...props} name="pelvis" setApi={bind} config={joints['spineJoint']}>
        <BodyPart {...props} name="upperLeftLeg" setApi={bind} config={joints['leftHipJoint']}>
          <BodyPart {...props} name="lowerLeftLeg" setApi={bind} config={joints['leftKneeJoint']} />
        </BodyPart>
        <BodyPart {...props} name="upperRightLeg" setApi={bind} config={joints['rightHipJoint']}>
          <BodyPart {...props} name="lowerRightLeg" setApi={bind} config={joints['rightKneeJoint']} />
        </BodyPart>
      </BodyPart>
    </BodyPart>
  );
}
