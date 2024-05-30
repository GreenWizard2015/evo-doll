import React, { createContext, useContext, useRef, useEffect } from 'react';
import { useBox, useConeTwistConstraint } from '@react-three/cannon';
import { createRagdoll } from '../helpers/createRagdoll';
import { useDragConstraint } from '../helpers/Drag';
import { Block } from '../helpers/Block';
import * as THREE from 'three';

const { shapes, joints } = createRagdoll(1.5, Math.PI / 16, Math.PI / 16, 0);
const context = createContext();

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
  const [group, setgroup] = React.useState(null);
  useEffect(() => onState && onState(state), [onState, state]);

  function bind(api, ref) {
    const name = ref.current.name;
    state.current[name] = { api, ref };
  }

  props = React.useMemo(() => {
    console.log(group);
    
    return {
      ...props,
      collisionFilterGroup: group,
      collisionFilterMask: group
    };
  }, [props, group]);

  return (
    <group ref={g => setgroup(g ? g.id : null)}>
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
  const OHEBase = new Array(validNames.length).fill(0);
  for (let i = 0; i < 360; i += step) {
    const angle = THREE.MathUtils.degToRad(i);
    // in XY plane
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    raycaster.set(headPosition, direction);

    const intersects = raycaster.intersectObjects(scene.children, true);
    let intersection = [-1, ...OHEBase];
    if (intersects.length > 0) {
      // Filter out own parts
      const filteredIntersects = intersects.filter(
        intersect => (
          validNames.includes(intersect.object.name) &&
          !ownParts.includes(intersect.object.uuid)
        )
      );
      if (filteredIntersects.length > 0) {
        const idx = validNames.indexOf(filteredIntersects[0].object.name);
        // convert to OHE
        const OHE = [...OHEBase];
        OHE[idx] = 1;
        intersection = [
          filteredIntersects[0].distance,
          ...OHE
        ];
      }
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