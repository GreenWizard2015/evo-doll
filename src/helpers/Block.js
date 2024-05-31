import React, { forwardRef } from 'react';
import { RoundedBox } from '@react-three/drei';

const defaultProps = {
  transparent: false,
  opacity: 1,
  color: 'white',
  args: [1, 1, 1],
};

const Block = forwardRef(({ children, params }, ref) => {
  const { args, color, transparent, opacity, ...props } = { ...defaultProps, ...params };
  return (
    <RoundedBox args={args} receiveShadow castShadow ref={ref} {...props}>
      <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      {children}
    </RoundedBox>
  );
});

Block.displayName = 'Block';

export default Block;
export { Block };