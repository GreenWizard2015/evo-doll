import { createContext, useContext, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useBox, useConeTwistConstraint } from '@react-three/cannon';
import { createRagdoll } from '../helpers/createRagdoll';
import { useDragConstraint } from '../helpers/Drag';
import { Block } from '../helpers/Block';

const { shapes, joints } = createRagdoll(.5, Math.PI / 16, Math.PI / 16, 0);
const context = createContext();

const BodyPart = ({ config, children, render, name, ...props }) => {
  const { color, args, mass, position } = shapes[name];
  const parent = useContext(context);
  const [ref] = useBox(() => ({ mass, args, position, linearDamping: 0.99, ...props }))
  useConeTwistConstraint(ref, parent, config)
  const bind = useDragConstraint(ref)
  return (
    <context.Provider value={ref}>
      <Block castShadow receiveShadow ref={ref} {...props} {...bind} scale={args} name={name} color={color}>
        {render}
      </Block>
      {children}
    </context.Provider>
  );
}

export function Ragdoll(props) {
  return (
    <BodyPart name="upperBody" {...props}>
      <BodyPart {...props} name="head" config={joints['neckJoint']} />
        <BodyPart {...props} name="upperLeftArm" config={joints['leftShoulder']}>
          <BodyPart {...props} name="lowerLeftArm" config={joints['leftElbowJoint']} />
        </BodyPart>
        <BodyPart {...props} name="upperRightArm" config={joints['rightShoulder']}>
          <BodyPart {...props} name="lowerRightArm" config={joints['rightElbowJoint']} />
        </BodyPart>
        <BodyPart {...props} name="pelvis" config={joints['spineJoint']}>
          <BodyPart {...props} name="upperLeftLeg" config={joints['leftHipJoint']}>
            <BodyPart {...props} name="lowerLeftLeg" config={joints['leftKneeJoint']} />
          </BodyPart>
          <BodyPart {...props} name="upperRightLeg" config={joints['rightHipJoint']}>
            <BodyPart {...props} name="lowerRightLeg" config={joints['rightKneeJoint']} />
          </BodyPart>
        </BodyPart>
      </BodyPart>
  );
}
