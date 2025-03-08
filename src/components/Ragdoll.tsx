import React, { createContext, useContext, useRef, useEffect } from 'react';
import { useBox, useConeTwistConstraint } from '@react-three/cannon';
import { createRagdoll } from '../helpers/createRagdoll';
import { useDragConstraint } from '../helpers/Drag';
import { Block } from '../helpers/Block';
import * as THREE from 'three';

const { shapes, joints } = createRagdoll(1.5, Math.PI / 16, Math.PI / 16, 0);
const context = createContext(null);

const RAGDOLL_PARTS = [
  'upperBody', 'head', 'upperLeftArm', 'lowerLeftArm', 'upperRightArm', 'lowerRightArm',
  'pelvis', 'upperLeftLeg', 'lowerLeftLeg', 'upperRightLeg', 'lowerRightLeg'
];
RAGDOLL_PARTS.sort(); // for consistent
export { RAGDOLL_PARTS };

const BodyPart = ({ setApi, config, children, render, name, ...props }: 
   { setApi?: any, config?: any, children?: any, render?: any, name: string }) => {
  const { color, args, mass, position } = shapes[name];
  const parent = useContext(context);
  const [boxRef, api] = useBox(() => ({ mass, args, position, ...props }));
  const velocityRef = useRef(new THREE.Vector3());
  useEffect(() => {
    if (setApi) setApi({api, ref: boxRef, velocity: velocityRef});
  }, [api, setApi, boxRef, velocityRef]);

  useEffect(() => {
    const unsubscribe = api.velocity.subscribe((velocity) => {
      velocityRef.current.set(velocity[0], velocity[1], velocity[2]);
    });

    return () => unsubscribe();
  }, [api.velocity]);

  useConeTwistConstraint(boxRef, parent, config);
  const bind = useDragConstraint(boxRef);
  return (
    <context.Provider value={boxRef}>
      {/* @ts-ignore */}
      <Block castShadow receiveShadow ref={boxRef} {...props} {...bind} scale={args} name={name} color={color}>
        {render}
      </Block>
      {children}
    </context.Provider>
  );
};

export function Ragdoll({ onState, props }: { onState: (state: any) => void, props: any}) {
  const state = useRef({ });
  const [group, setGroup] = React.useState(null);
  useEffect(() => onState && onState(state), [onState, state]);

  function bind(bindData) {
    const name = bindData.ref.current.name;
    state.current[name] = bindData;
  }

  props = React.useMemo(() => {
    return {
      ...props,
      collisionFilterGroup: group,
      collisionFilterMask: group
    };
  }, [props, group]);

  return (
    <group ref={g => setGroup(g ? g.id : null)}>
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
    </group>
  );
}

function encodeObservation({raycaster, player, scene, N=15}) {
  const headPosition = new THREE.Vector3();
  player['head'].ref.current.getWorldPosition(headPosition);
  const validNames = [...RAGDOLL_PARTS, 'floor', 'wall'];
  validNames.sort();
  const ownParts = [];
  for (const part in player) { // collect own parts uuids
    ownParts.push(player[part].ref.current.uuid);
  }

  const res = [];
  // add raycast results
  const step = 360 / N;
  for (let i = 0; i < 360; i += step) {
    const angle = THREE.MathUtils.degToRad(i);
    res.push(angle); // store angle as well
    // in XY plane
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    raycaster.set(headPosition, direction);

    const intersects = raycaster.intersectObjects(scene.children, true);
    let intersection = new Array(validNames.length).fill(-1);
    // Filter out own parts
    const filteredIntersects = intersects.filter(
      intersect => (
        validNames.includes(intersect.object.name) &&
        !ownParts.includes(intersect.object.uuid)
      )
    );
    // Store distances to objects
    for (const intersect of filteredIntersects) {
      const idx = validNames.indexOf(intersect.object.name);
      intersection[idx] = intersect.distance;
    }
    res.push(...intersection);
  }
  // add own parts positions relative to head
  const names = [...RAGDOLL_PARTS];
  names.splice(names.indexOf('head'), 1);
  for (const part of names) {
    const partPosition = new THREE.Vector3();
    player[part].ref.current.getWorldPosition(partPosition);
    partPosition.sub(headPosition);
    res.push(partPosition.x, partPosition.y, partPosition.z);
  }

  if(res.length !== 240) {
    throw new Error(`Observation encoding failed: ${res.length}, but expected 240`);
  }
  return res;
}

export { encodeObservation };