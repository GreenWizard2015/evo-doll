import { forwardRef } from 'react';
import { RoundedBox } from '@react-three/drei';

const defaultArgs = [1, 1, 1]

const defaultProps = {
  transparent: false,
  opacity: 1,
  color: 'white',
  args: defaultArgs
};

const Block = forwardRef((params, ref) => {
  const { children, args, color, transparent, opacity, ...props } = { ...defaultProps, ...params };
  return (
    <RoundedBox args={args} receiveShadow castShadow ref={ref} {...props}>
      <meshStandardMaterial color={color} transparent={transparent} opacity={opacity} />
      {children}
    </RoundedBox>
  )
});

Block.displayName = 'Block';

export default Block;
export { Block };