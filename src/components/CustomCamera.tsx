import { useEffect, useRef } from "react";
import * as THREE from "three";

function CustomCamera() {
  const PerspectiveCamera = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    if (PerspectiveCamera.current) {
      PerspectiveCamera.current.position.set(0, 5, 10);
      PerspectiveCamera.current.fov = 95;
      PerspectiveCamera.current.near = 0.1;
      PerspectiveCamera.current.far = 1000;
      PerspectiveCamera.current.updateProjectionMatrix();
    }
  }, [PerspectiveCamera]);

  return (
    <perspectiveCamera ref={PerspectiveCamera} />
  );
}

export default CustomCamera;