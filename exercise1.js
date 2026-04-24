import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * Initializes the scene.
 * Returns { scene, camera, renderer, controls }.
 */
export function initExercise1() {
  const SCENE_BACKGROUND = 0x0f1115; // dark gray

  function createStandardMaterial({ color, roughness, metalness }) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness }); // for lighting in Ex3
  }

  function createBoxMesh(
    size,
    material,
    position,
    { castShadow = false, receiveShadow = false } = {},
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.width, size.height, size.depth),
      material,
    );
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    return mesh;
  }

  function createCylinderMesh(
    geomProps,
    material,
    position,
    { castShadow = true, receiveShadow = true } = {}, //will be overridden later on ex3
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        geomProps.radiusTop,
        geomProps.radiusBottom,
        geomProps.height,
        geomProps.radialSegments,
      ),
      material,
    );
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    scene.add(mesh);
    return mesh;
  }

  // scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // Context loss handling (from https://www.khronos.org/webgl/wiki/HandlingContextLost)
  renderer.domElement.addEventListener(
    "webglcontextlost",
    (e) => {
      e.preventDefault();
    },
    false,
  );

  renderer.domElement.addEventListener(
    "webglcontextrestored",
    () => {
      // Re-apply settings that live on the context (lost when GPU resets).
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(window.devicePixelRatio);
    },
    false,
  );

  var fov = 50;
  var aspect = window.innerWidth / window.innerHeight;
  var near = 0.1;
  var far = 1000;
  var cameraPos = { x: 0, y: 6, z: 12 };
  var cameraUp = { x: 0, y: 1, z: 0 };
  var lookAt = { x: 0, y: 0, z: 0 };
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(cameraPos.x, cameraPos.y, cameraPos.z);
  camera.up.set(cameraUp.x, cameraUp.y, cameraUp.z);
  camera.lookAt(lookAt.x, lookAt.y, lookAt.z);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(lookAt.x, lookAt.y, lookAt.z);
  controls.update();

  // Lighting
  var ambientColor = 0xffffff;
  var ambientIntensity = 0.35;
  const ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
  scene.add(ambientLight);

  // Room
  // Tile Texture
  var floorProps = { roughness: 0.7, metalness: 0.0 };
  var loader = new THREE.TextureLoader();
  var tileTexture = loader.load("Materials/tiles.jpg");
  tileTexture.wrapS = THREE.RepeatWrapping;
  tileTexture.wrapT = THREE.RepeatWrapping;
  tileTexture.repeat.set(2, 2);

  const floorMat = new THREE.MeshStandardMaterial({
    map: tileTexture,
    roughness: floorProps.roughness,
    metalness: floorProps.metalness,
    side: THREE.DoubleSide,
  });

  // Floor
  var floorSize = { width: 10, depth: 10 };
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorSize.width, floorSize.depth),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2; //lie flat
  floor.receiveShadow = true;
  scene.add(floor);

  // Walls
  var wallProps = { color: 0xf0ece4, roughness: 0.9, metalness: 0.0 };
  const wallMat = createStandardMaterial(wallProps);

  // Back wall
  var backWallSize = { width: 10, height: 5, depth: 0.15 };
  var backWallPos = { x: 0, y: 2.5, z: -5 };
  createBoxMesh(backWallSize, wallMat, backWallPos, {
    receiveShadow: true,
  });

  // Left wall
  var leftWallSize = { width: 0.15, height: 5, depth: 10 };
  var leftWallPos = { x: -5, y: 2.5, z: 0 };
  createBoxMesh(leftWallSize, wallMat, leftWallPos, {
    receiveShadow: true,
  });

  //  Counter
  var counterProps = { color: 0xd0d4d8, roughness: 0.25, metalness: 0.7 };
  const counterMat = createStandardMaterial(counterProps);

  var countertopSize = { width: 3.4, height: 0.08, depth: 1.15 };
  var countertopPos = { x: 0, y: 0.94, z: 0 };
  createBoxMesh(countertopSize, counterMat, countertopPos, {
    castShadow: true,
    receiveShadow: true,
  });

  // Cabinet body
  var cabinetProps = { color: 0x8a8a8a, roughness: 0.6, metalness: 0.1 };
  const cabinetMat = createStandardMaterial(cabinetProps);

  var cabinetSize = { width: 3.2, height: 0.9, depth: 1.0 };
  var cabinetPos = { x: 0, y: 0.451, z: 0 };
  createBoxMesh(cabinetSize, cabinetMat, cabinetPos, {
    castShadow: true,
    receiveShadow: true,
  });

  // Kitchen utilities
  // Cup
  var cupProps = { color: 0x3a7abf, roughness: 0.5, metalness: 0.05 };
  var cupGeometryProps = {
    radiusTop: 0.08,
    radiusBottom: 0.065,
    height: 0.18,
    radialSegments: 24,
  };
  var cupPos = { x: -0.6, y: 1.07, z: -0.1 };
  const cupMat = createStandardMaterial(cupProps);
  createCylinderMesh(cupGeometryProps, cupMat, cupPos);

  // Plate
  var plateProps = { color: 0xfafafa, roughness: 0.45, metalness: 0.0 };
  var plateGeometryProps = {
    radiusTop: 0.22,
    radiusBottom: 0.22,
    height: 0.025, //flatted cylinder
    radialSegments: 36,
  };
  var platePos = { x: 0.5, y: 0.9925, z: 0.0 };
  const plateMat = createStandardMaterial(plateProps);
  createCylinderMesh(plateGeometryProps, plateMat, platePos);

  // Resize listener
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, controls };
}
