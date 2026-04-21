import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { initExercise2 } from "./exercise2.js";

export function initExercise3Hints() {
  const { scene, camera, renderer, controls, robot } = initExercise2();

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const refs = collectExercise3References(scene, robot);
  const ambient = getOrCreateAmbientLight(scene);
  const mainLight = createMainSpotLight(scene, refs.counterTopPositionGuess);

  // Overwrite casting and recieving shadows for meshes createed previously.
  // Mostly redundant as already set up while materials initializations.
  // TODO 1 (build robot shadow behavior):
  refs.robotMeshes.forEach((mesh) => {
    mesh.material = ensureMeshStandard(mesh.material); //ensure they react to lighting
    mesh.castShadow = true; //robot to create shadows
  });

  // TODO 2 (build counter-object shadow behavior):
  refs.counterObjects.forEach((mesh) => {
    mesh.material = ensureMeshStandard(mesh.material);
    mesh.castShadow = true; //objects to create sshadows
  });

  // TODO 3 (build floor receiving surface):
  if (refs.floor) {
    refs.floor.material = ensureMeshStandard(refs.floor.material);
    refs.floor.receiveShadow = true;
  }

  // TODO 4 (build counter receiving surface):
  if (refs.counterTop) {
    refs.counterTop.material = ensureMeshStandard(refs.counterTop.material);
    refs.counterTop.receiveShadow = true;
  }

  if (refs.counterBody) {
    refs.counterBody.material = ensureMeshStandard(refs.counterBody.material);
    refs.counterBody.receiveShadow = true;
  }

  const gui = createExercise3Gui({ ambient, mainLight, refs }); //build GUI with lighting controls
  gui.close();

  return {
    scene,
    camera,
    renderer,
    controls,
    robot,
    ambient,
    mainLight,
    refs,
    gui,
  };
}

function collectExercise3References(scene, robot) {
  const robotMeshes = [];
  robot.root?.traverse((obj) => {
    // '?' => optional chaining in case robot or root is undefined
    if (obj.isMesh) robotMeshes.push(obj); //collect meshes in robot
  });

  let floor = null;
  let counterTop = null;
  let counterBody = null;
  const counterObjects = [];

  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;

    if (obj.geometry.type === "PlaneGeometry") {
      floor = obj;
      return;
    }

    // TODO 5 (build countertop detection logic):
    if (obj.geometry.type === "BoxGeometry") {
      obj.geometry.computeBoundingBox();
      const boundingBox = obj.geometry.boundingBox;
      if (!boundingBox) return;
      const h = boundingBox.max.y - boundingBox.min.y;
      const w = boundingBox.max.x - boundingBox.min.x;
      const d = boundingBox.max.z - boundingBox.min.z;
      //checkers
      const counterY = obj.position.y > 0.85 && obj.position.y < 1.05; //counter top is at 0.94 in ex1
      const counterDim = h < 0.12 && w > 2.5 && d > 0.8; //counter top is width: 3.4, height: 0.08, depth: 1.15
      if (counterY && counterDim) {
        //countertop detected
        counterTop = obj;
        return;
      }

      // cabinet body detection: y≈0.451, 3.2×0.9×1.0
      const cabinetY = obj.position.y > 0.3 && obj.position.y < 0.6;
      const cabinetDim = h > 0.8 && w > 2.5 && d > 0.8;
      if (cabinetY && cabinetDim) {
        counterBody = obj;
        return;
      }
    }

    // TODO 6 (build counter objects filtering):
    const onCounterHieght = obj.position.y > 0.95 && obj.position.y < 1.25; //Range for cup and plate
    const notRobot = !robotMeshes.includes(obj);
    if (
      onCounterHieght &&
      notRobot
    ) // above the table and not part of the robot
    {
      counterObjects.push(obj);
    }
  });

  const counterTopPositionGuess = new THREE.Vector3(0, 0.95, 0); //default error handler
  if (counterTop) {
    counterTop.getWorldPosition(counterTopPositionGuess);
  } //get actual position if found

  return {
    robotMeshes,
    floor,
    counterTop,
    counterBody,
    counterObjects,
    counterTopPositionGuess,
  };
}

function getOrCreateAmbientLight(scene) {
  let ambient = null;
  scene.traverse((obj) => {
    if (obj.isAmbientLight && !ambient) ambient = obj; //find existing ambient light (set up in ex1)
  });
  if (!ambient) {
    // default fall back for ex3 implementation (redundant most probably xD)
    ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);
  } else {
    ambient.intensity = 0.35; //overwrite intensity
  }
  return ambient;
}

function createMainSpotLight(scene, targetPosition) {
  const light = new THREE.SpotLight(0xfff1dc, 2.2, 16, Math.PI / 5, 0.35, 1); // color, intensity, distance, angle, penumbra, decay

  // TODO 7 (build spotlight setup):
  light.position.set(0, 3.8, 0); //place light above counter
  light.target.position.copy(targetPosition); //point towards counter
  light.castShadow = true;
  //shadow quality
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.00015; //reduce shadow acne
  light.shadow.normalBias = 0.02; //reduce peter-panning
  //shadow camera
  light.shadow.camera.near = 0.5;
  light.shadow.camera.far = 25;
  light.shadow.camera.focus = 1;

  scene.add(light);
  scene.add(light.target);
  return light;
}

function ensureMeshStandard(material) {
  if (!material) {
    return new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.6 }); //default fallback material
  }
  if (material.isMeshStandardMaterial) return material;

  // TODO 8 (build safe material conversion):
  return new THREE.MeshStandardMaterial({
    color: material.color ? material.color.getHex() : 0xbbbbbb, //preserve color if exists, otherwise fallback
    map: material.map || null, //preserve texture map if exists otherwise null
    roughness: 0.6,
    metalness: 0.2,
  });
}

function applyMaterialParams(meshes, sourceMaterial) {
  // TODO 9 (build shared material propagation):
  meshes.forEach((mesh) => {
    const mat = mesh.material;
    if (!mat || !mat.isMeshStandardMaterial) return;
    mat.roughness = sourceMaterial.roughness;
    mat.metalness = sourceMaterial.metalness;
  });
}

function createExercise3Gui({ ambient, mainLight, refs }) {
  const gui = new GUI({ title: "Lighting and Materials Controls" });

  // TODO 10 (build ambient controls):
  // Add intensity slider for ambient light.
  // Suggested range: 0..1.5, step 0.01.
  const ambientFolder = gui.addFolder("Ambient Light");
  ambientFolder.add(ambient, "intensity", 0, 1.5, 0.01).name("intensity"); //start , end, step, name

  const lightFolder = gui.addFolder("Main Spot Light");
  // TODO 11 (build main light controls):
  lightFolder.add(mainLight, "intensity", 0, 5, 0.01).name("intensity");
  lightFolder.add(mainLight, "angle", 0.1, Math.PI / 2, 0.001).name("angle");
  lightFolder.add(mainLight, "penumbra", 0, 1, 0.01).name("penumbra");
  lightFolder.add(mainLight, "distance", 0, 30, 0.1).name("distance");
  lightFolder.add(mainLight.position, "x", -5, 5, 0.01).name("position x");
  lightFolder.add(mainLight.position, "y", 1.5, 8, 0.01).name("position y");
  lightFolder.add(mainLight.position, "z", -5, 5, 0.01).name("position z");

  const shadowFolder = gui.addFolder("Shadow Quality");
  // TODO 12 (build shadow quality controls):
  shadowFolder.add(mainLight.shadow, "bias", -0.01, 0.01, 0.00001).name("bias");
  shadowFolder
    .add(mainLight.shadow, "normalBias", 0, 1, 0.001)
    .name("normalBias");
  const shadowMapOptions = { size: 1024 }; // default value for dropdown
  shadowFolder
    .add(shadowMapOptions, "size", [512, 1024, 2048])
    .name("map size")
    .onChange((newVal) => {
      const size = Number(newVal); //convert from string
      mainLight.shadow.mapSize.set(size, size); //update shadow map size
      mainLight.shadow.map?.dispose(); //dispose existing shadow map to free memory =>"?"" for optional chaining in case map is undefined
      mainLight.shadow.map = null; //force re-creation of shadow map with new size on next render
      // as the default THREE.js behavior is to create the shadow map on demand when rendering if it doesn't exist,
      //  setting it to null after disposing ensures that the new size will take effect immediately without waiting for another change to trigger it.
    });

  const robotMaterial = refs.robotMeshes[0]?.material; //assume all robot meshes share the same material
  const objectMaterial = refs.counterObjects[0]?.material; //assume all counter objects share the same material
  const counterMaterial = refs.counterTop?.material; //assume the countertop has a single material
  const counterBodyMaterial = refs.counterBody?.material;

  // TODO 13 (build robot material controls):
  if (robotMaterial?.isMeshStandardMaterial) {
    const robotMatFolder = gui.addFolder("Robot Material");
    robotMatFolder
      .add(robotMaterial, "roughness", 0, 1, 0.01)
      .name("roughness")
      .onChange(() => {
        applyMaterialParams(refs.robotMeshes, robotMaterial);
      }); //update all robot meshes when roughness changes

    robotMatFolder
      .add(robotMaterial, "metalness", 0, 1, 0.01)
      .name("metalness")
      .onChange(() => {
        applyMaterialParams(refs.robotMeshes, robotMaterial); //update all robot meshes when metalness changes
      });
  }

  // TODO 14 (build counter-object material controls):
  if (objectMaterial?.isMeshStandardMaterial) {
    const objectMatFolder = gui.addFolder("Objects Material");
    objectMatFolder
      .add(objectMaterial, "roughness", 0, 1, 0.01)
      .name("roughness")
      .onChange(() => {
        applyMaterialParams(refs.counterObjects, objectMaterial);
      });

    objectMatFolder
      .add(objectMaterial, "metalness", 0, 1, 0.001)
      .name("metalness")
      .onChange(() => {
        applyMaterialParams(refs.counterObjects, objectMaterial);
      });
  }

  // TODO 15 (build countertop material controls):
  if (counterMaterial?.isMeshStandardMaterial) {
    const counterFolder = gui.addFolder("Counter Material");
    counterFolder
      .add(counterMaterial, "roughness", 0, 1, 0.01)
      .name("roughness")
      .onChange(() => {
        if (counterBodyMaterial?.isMeshStandardMaterial)
          counterBodyMaterial.roughness = counterMaterial.roughness;
      });
    counterFolder
      .add(counterMaterial, "metalness", 0, 1, 0.01)
      .name("metalness")
      .onChange(() => {
        if (counterBodyMaterial?.isMeshStandardMaterial)
          counterBodyMaterial.metalness = counterMaterial.metalness;
      });
  }

  // Keep references used so the variable is meaningful while TODO 12 is unfinished.
  void shadowMapOptions;

  return gui;
}
