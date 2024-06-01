import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

function CustomCamera() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 5, 10);
    // @ts-ignore
    camera.fov = 95;
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
  }, [camera]);

  return (
    <perspectiveCamera />
  );
}

export default CustomCamera;