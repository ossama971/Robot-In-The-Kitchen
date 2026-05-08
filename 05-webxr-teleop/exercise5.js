import * as THREE from "three";
import { VRButton } from "three/addons/webxr/VRButton.js";
import { ARButton } from "three/addons/webxr/ARButton.js";
import { initExercise4 } from "../04-animation-interaction/exercise4.js";

const ARM_LENGTHS = {
  // matching the height values in createArm() of ex2
  upper: 0.3,
  forearm: 0.3,
};

// more limits than ex4 to keep the teleoperation in a comfortable range in MR.
// leave limits to the actual human body limitation.
const ARM_LIMITS = {
  left: {
    shoulderZ: [0, Math.PI], // allow left shoulder to rotate forward and outward
    shoulderX: [-2 * Math.PI, 2 * Math.PI], // allow left shoulder to lift up and  back
    elbowX: [-Math.PI / 1.25, 0], // allow left elbow to flex and extend
  },
  right: {
    // same for right arm but mirrored Z
    shoulderZ: [-Math.PI, 0],
    shoulderX: [-2 * Math.PI, 2 * Math.PI],
    elbowX: [-Math.PI / 1.25, 0],
  },
};

const DEFAULT_AR_WORLD_Y_OFFSET = 0.0;

// Rotate the world -90° around Y in XR so the robot's forward direction (-X) maps to
// the user's natural forward direction (-Z). Reset to 0 on desktop.
const XR_WORLD_ROTATION_Y = -Math.PI / 2;

function createOverlay() {
  // simple overlay to show instructions and session mode.
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "16px";
  overlay.style.left = "16px";
  overlay.style.padding = "10px 14px";
  overlay.style.borderRadius = "8px";
  overlay.style.background = "rgba(0,0,0,0.55)";
  overlay.style.color = "#ffffff";
  overlay.style.fontFamily = "sans-serif";
  overlay.style.fontSize = "13px";
  overlay.style.lineHeight = "1.5";
  overlay.style.pointerEvents = "none";
  overlay.style.zIndex = "50";
  overlay.innerHTML = `
    <strong>Exercise 5</strong><br />
    Press VR/AR Button at the bottom. <br />
    Move the VR/AR controllers to tele-operate the robot arms.<br />
    Session: <span data-session-mode>Desktop</span>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

// create a parent object for the whole world so we can move it for better AR alignment
function createWorldRoot(scene) {
  const worldRoot = new THREE.Group();
  worldRoot.name = "xrWorldRoot";

  // re-parent existing scene objects under the world root
  [...scene.children].forEach((child) => {
    // "..." to clone the array since we'll be modifying it
    worldRoot.add(child);
  });

  scene.add(worldRoot);
  return worldRoot;
}

// robotEye: position of the robot's eye center in worldRoot local space (computed after robot rotation)
// In XR: worldRoot is rotated XR_WORLD_ROTATION_Y so the robot's forward (-X) aligns with the
// user's natural forward (-Z), then translated so the rotated eye sits at the XR origin (XZ).
// Y is calibrated separately on the first XR frame.
function applyWorldPlacement(worldRoot, robotEye, teleop, session) {
  const isPassthrough = Boolean(
    session &&
    ["alpha-blend", "additive"].includes(session.environmentBlendMode),
  );

  if (session) {
    worldRoot.rotation.y = XR_WORLD_ROTATION_Y;
    // Rotate the eye vector by the world rotation to find where it ends up in XR space,
    // then negate XZ so it lands at the origin.
    const rotatedEye = robotEye
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), XR_WORLD_ROTATION_Y);
    worldRoot.position.set(
      -rotatedEye.x,
      worldRoot.position.y, // Y calibrated on first XR frame in updateTeleoperation
      -rotatedEye.z,
    );
  } else {
    // desktop: reset to no rotation or translation so the robot is front-and-center.
    worldRoot.rotation.y = 0;
    worldRoot.position.set(0, 0, 0);
  }

  return isPassthrough;
}
// Capture the current camera pose (position, orientation, and controls target)
function snapshotCameraPose(camera, controls) {
  return {
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    target: controls.target.clone(),
  };
}
// Apply a captured camera pose
function applyDesktopCameraPose(camera, controls, pose) {
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  controls.target.copy(pose.target);
  controls.update();
}
// For AR, we want the camera pose to be controlled by the XR device, so we reset it on each frame.
function applyXRBaseCameraPose(camera, controls) {
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();
  controls.target.set(0, 0, -1);
}

function forceXRWebGLLayerFallback() {
  const originalXRWebGLBinding = globalThis.XRWebGLBinding;

  if (typeof originalXRWebGLBinding === "undefined") {
    return () => {};
  }

  try {
    globalThis.XRWebGLBinding = undefined;
  } catch {
    return () => {};
  }

  return () => {
    globalThis.XRWebGLBinding = originalXRWebGLBinding;
  };
}

function createControllers(renderer, scene) {
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ]); // unit ray pointing forward in -Z, scaled to desired length in the line material.

  return [0, 1].map((index) => {
    const color = index === 0 ? 0x66ccff : 0xff6688;
    const controller = renderer.xr.getController(index); // get the controller grip for this index (0 = left, 1 = right)

    // add a ray and a tip to visualize the controller pose and pointing direction.
    const ray = new THREE.Line(
      rayGeometry,
      new THREE.LineBasicMaterial({ color }),
    );
    ray.scale.z = 1.0;
    controller.add(ray);

    const tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 16, 12),
      new THREE.MeshBasicMaterial({ color }),
    );
    tip.position.z = -0.05;
    controller.add(tip);

    controller.userData.handedness = null; // to be set to "left" or "right" on connected event
    controller.visible = false;

    controller.addEventListener("connected", (event) => {
      controller.userData.handedness = event.data.handedness || null;
      controller.visible = true;
    }); // set handedness and show controller when connected

    controller.addEventListener("disconnected", () => {
      controller.userData.handedness = null;
      controller.visible = false;
    }); // clear handedness and hide controller when disconnected

    scene.add(controller);
    return controller;
  });
}

function findController(controllers, handedness, fallbackIndex) {
  return (
    controllers.find(
      (controller) =>
        controller.visible && controller.userData.handedness === handedness,
    ) ??
    controllers[fallbackIndex] ?? // fallback to index if no matching handedness, or null if index out of bounds
    null
  );
}

function getBoxSize(mesh) {
  mesh.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  mesh.geometry.boundingBox?.getSize(size);
  return size;
}
// get references to the walls in the scene so we can toggle their transparency in AR passthrough mode.
function collectRoomReferences(scene) {
  const walls = [];

  scene.traverse((object) => {
    if (!object.isMesh || object.geometry?.type !== "BoxGeometry") return;

    const size = getBoxSize(object);
    const looksLikeBackWall =
      size.x > 9 && size.y > 4.5 && size.z < 0.3 && object.position.z < -4;
    const looksLikeLeftWall =
      size.x < 0.3 && size.y > 4.5 && size.z > 9 && object.position.x < -4;

    if (looksLikeBackWall || looksLikeLeftWall) {
      walls.push(object);
    }
  });

  return { walls };
}
// Take a snapshot of the materials of the given meshes so we can restore them later.
function snapshotMaterials(meshes) {
  const byMaterial = new Map();

  meshes.forEach((mesh) => {
    const material = mesh.material;
    if (!material || byMaterial.has(material.uuid)) return;

    byMaterial.set(material.uuid, {
      material,
      transparent: material.transparent,
      opacity: material.opacity,
      depthWrite: material.depthWrite,
    });
  });

  return [...byMaterial.values()]; // "..." to convert Map values iterator to array
}

function setWallTransparency(materialSnapshots, enabled) {
  materialSnapshots.forEach((entry) => {
    if (enabled) {
      entry.material.transparent = true; // enable transparency and set a low opacity for AR passthrough mode
      entry.material.opacity = 0.14;
      entry.material.depthWrite = false;
    } else {
      entry.material.transparent = entry.transparent; // restore original material settings when not in passthrough mode
      entry.material.opacity = entry.opacity;
      entry.material.depthWrite = entry.depthWrite;
    }

    entry.material.needsUpdate = true;
  });
}
// create simple debug markers to visualize the controller targets in the scene.
function createDebugTargets(scene) {
  const makeTarget = (color) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 16, 12),
      new THREE.MeshBasicMaterial({ color }),
    );
    marker.visible = false;
    scene.add(marker);
    return marker;
  };

  return {
    left: makeTarget(0x66ccff),
    right: makeTarget(0xff6688),
  };
}
// Get the controller target position in world space and relative to the shoulder.
function getControllerTarget(robot, side, controller) {
  const targetWorld = controller.getWorldPosition(new THREE.Vector3());
  const targetLocal = robot.torso.worldToLocal(targetWorld.clone());
  const shoulderLocal = robot.arms[side].shoulder.position.clone();
  const shoulderToTarget = targetLocal.sub(shoulderLocal); // vector from shoulder to target in torso local space, used for IK calculations

  return { targetWorld, shoulderToTarget };
}

function computeShoulderPose(side, shoulderToTarget, reachScale) {
  const len = shoulderToTarget.length();
  if (len < 0.01) return { shoulderZ: 0, shoulderX: 0, reach: 0 };

  // Work on a unit vector so atan2 denominators never collapse near shoulder height.
  const d = shoulderToTarget.clone().divideScalar(len);
  const outward = side === "left" ? d.x : -d.x;
  const downward = -d.y; // positive when target is below shoulder

  // Abduction (Z): angle from arm-hanging-down toward the lateral direction.
  const shoulderZMag = Math.atan2(outward, downward);

  // Flexion (X): forward/back tilt beyond the coronal plane.
  // lateralMag is the projection length onto the coronal (XY) plane.
  const lateralMag = Math.hypot(outward, downward);
  // d.z > 0 = robot forward (torso +Z) → negative shoulderX = flexion.
  const shoulderX = -Math.atan2(d.z, Math.max(0.001, lateralMag));

  return {
    shoulderZ: side === "left" ? shoulderZMag : -shoulderZMag, // mirror Z for right arm
    shoulderX,
    reach: len * reachScale,
  };
}

function computeElbowAngle(reach) {
  const maxReach = ARM_LENGTHS.upper + ARM_LENGTHS.forearm - 0.02;
  const clampedReach = THREE.MathUtils.clamp(reach, 0.12, maxReach);

  // Law of cosines: c^2 = a^2 + b^2 - 2ab*cos(C)
  // → C = acos((a^2 + b^2 - c^2) / (2ab))
  // where C is the elbow angle, a and b are the upper and forearm lengths, and c is the shoulder-to-target distance (reach).
  const cosine = THREE.MathUtils.clamp(
    (ARM_LENGTHS.upper ** 2 + ARM_LENGTHS.forearm ** 2 - clampedReach ** 2) /
      (2 * ARM_LENGTHS.upper * ARM_LENGTHS.forearm),
    -1,
    1,
  );

  return Math.acos(cosine) - Math.PI;
}

function applyArmPose(robot, side, targetPose, smoothing) {
  const arm = robot.arms[side];
  const limits = ARM_LIMITS[side];

  const nextShoulderZ = THREE.MathUtils.clamp(
    targetPose.shoulderZ,
    limits.shoulderZ[0],
    limits.shoulderZ[1],
  );
  const nextShoulderX = THREE.MathUtils.clamp(
    targetPose.shoulderX,
    limits.shoulderX[0],
    limits.shoulderX[1],
  );
  const nextElbowX = THREE.MathUtils.clamp(
    targetPose.elbowX,
    limits.elbowX[0],
    limits.elbowX[1],
  );

  arm.shoulder.rotation.z = THREE.MathUtils.lerp(
    arm.shoulder.rotation.z,
    nextShoulderZ,
    smoothing,
  );
  arm.shoulder.rotation.x = THREE.MathUtils.lerp(
    arm.shoulder.rotation.x,
    nextShoulderX,
    smoothing,
  );
  arm.elbow.rotation.x = THREE.MathUtils.lerp(
    arm.elbow.rotation.x,
    nextElbowX,
    smoothing,
  );
}

function updateHandOrientation(robot, side, controller, handFollow) {
  if (handFollow <= 0) return;

  const arm = robot.arms[side];
  const controllerWorldQuat = controller.getWorldQuaternion(
    new THREE.Quaternion(),
  );
  // Clone before invert so we don't mutate the temp returned by getWorldQuaternion.
  const elbowWorldQuat = arm.elbow.getWorldQuaternion(new THREE.Quaternion());
  // q_hand_local = q_elbow_world^-1 * q_controller_world
  // Makes the hand's world orientation match the controller's world orientation.
  const handLocalQuat = elbowWorldQuat
    .clone()
    .invert()
    .multiply(controllerWorldQuat);

  arm.hand.quaternion.slerp(handLocalQuat, handFollow);
}

function updateArmFromController(robot, side, controller, teleop, debugMarker) {
  if (!controller || !controller.visible) {
    debugMarker.visible = false;
    return;
  }

  const { targetWorld, shoulderToTarget } = getControllerTarget(
    robot,
    side,
    controller,
  );
  const shoulderPose = computeShoulderPose(
    side,
    shoulderToTarget,
    teleop.reachScale,
  );
  const elbowX = computeElbowAngle(shoulderPose.reach);

  applyArmPose(
    robot,
    side,
    {
      shoulderZ: shoulderPose.shoulderZ,
      shoulderX: shoulderPose.shoulderX,
      elbowX,
    },
    teleop.smoothing,
  );

  updateHandOrientation(robot, side, controller, teleop.handFollow);

  debugMarker.visible = teleop.showDebugTargets;
  if (teleop.showDebugTargets) {
    debugMarker.position.copy(targetWorld);
  }
}

export function initExercise5() {
  // Force the XRWebGLLayer fallback path in three.js to avoid issues with shared WebGL contexts in some browsers.
  const restoreXRWebGLBinding = forceXRWebGLLayerFallback();

  let exercise4State;

  try {
    exercise4State = initExercise4();
  } finally {
    restoreXRWebGLBinding();
  }

  const {
    scene,
    camera,
    renderer,
    controls,
    robot,
    animateRobot,
    gui: exercise4Gui,
  } = exercise4State;

  //remove all instances of lil-gui created in ex4 (lighting controls) since we'll use the GUI for teleop controls in ex5.
  document.querySelectorAll(".lil-gui").forEach((el) => el.remove());

  // Rotate robot -90° around Y so it faces the counter (which is at x=0, robot is at x=3)
  robot.root.rotation.y = -Math.PI / 2;

  // Compute the robot's eye world position after the rotation.
  // From exercise2.js: torso at (0, 0.8, 0) relative to root, eye centre at (0, 1.06, 0.13) relative to torso.
  // Total local offset: (0, 1.86, 0.13). After rotation.y = -π/2 this becomes (-0.13, 1.86, 0).
  const _eyeLocalOffset = new THREE.Vector3(0, 1.86, 0.13);
  _eyeLocalOffset.applyEuler(robot.root.rotation);
  const robotEye = new THREE.Vector3().addVectors(
    robot.root.position,
    _eyeLocalOffset,
  );

  const overlay = createOverlay();
  const sessionLabel = overlay.querySelector("[data-session-mode]");
  const worldRoot = createWorldRoot(scene);
  const desktopCameraPose = snapshotCameraPose(camera, controls); // preserve ex4 camera for desktop
  const desktopBackground = scene.background;

  renderer.xr.enabled = true;

  document.body.appendChild(VRButton.createButton(renderer));
  document.body.appendChild(
    ARButton.createButton(renderer, {
      optionalFeatures: ["dom-overlay", "local-floor"],
      domOverlay: { root: overlay },
    }),
  );

  const controllers = createControllers(renderer, scene);
  const roomRefs = collectRoomReferences(scene);
  const wallSnapshots = snapshotMaterials(roomRefs.walls);
  const debugTargets = createDebugTargets(scene);

  const teleop = {
    enabled: true,
    smoothing: 0.4, // fraction of remaining error closed per frame
    reachScale: 1.0,
    handFollow: 0.85, // near-instant wrist tracking, eliminates accumulated lag
    showDebugTargets: false,
    arWorldYOffset: DEFAULT_AR_WORLD_Y_OFFSET,
  };

  function updateSessionState() {
    const session = renderer.xr.getSession();
    const isPassthrough = applyWorldPlacement(
      worldRoot,
      robotEye,
      teleop,
      session,
    );
    scene.background = isPassthrough ? null : desktopBackground;

    if (session) {
      controls.enabled = false;
      applyXRBaseCameraPose(camera, controls);
    } else {
      controls.enabled = true;
      applyDesktopCameraPose(camera, controls, desktopCameraPose);
    }

    setWallTransparency(wallSnapshots, isPassthrough);

    if (sessionLabel) {
      sessionLabel.textContent = isPassthrough
        ? "AR/MR"
        : session
          ? "VR"
          : "Desktop";
    }
  }

  // xrEyeAligned: flags whether the one-time Y calibration has run for the current session.
  // xrBaseY: the worldRoot.y set at calibration (used by the AR Y offset slider).
  let xrEyeAligned = false;
  let xrBaseY = 0;

  renderer.xr.addEventListener("sessionstart", () => {
    xrEyeAligned = false;
    updateSessionState();
  });
  renderer.xr.addEventListener("sessionend", () => {
    xrEyeAligned = false;
    updateSessionState();
  });
  updateSessionState();

  function updateTeleoperation() {
    const session = renderer.xr.getSession();

    // On the first XR frame the headset pose is available via camera.position.
    // Shift worldRoot.y so the robot eye lands exactly at the user's eye height.
    if (session && !xrEyeAligned) {
      const isPassthrough = ["alpha-blend", "additive"].includes(
        session.environmentBlendMode,
      );
      xrBaseY = camera.position.y - robotEye.y;
      worldRoot.position.y =
        xrBaseY + (isPassthrough ? teleop.arWorldYOffset : 0);
      xrEyeAligned = true;
    }
    if (!session || !teleop.enabled) {
      debugTargets.left.visible = false;
      debugTargets.right.visible = false;
      animateRobot();
      return;
    }

    const leftController = findController(controllers, "left", 0);
    const rightController = findController(controllers, "right", 1);

    updateArmFromController(
      robot,
      "left",
      leftController,
      teleop,
      debugTargets.left,
    );
    updateArmFromController(
      robot,
      "right",
      rightController,
      teleop,
      debugTargets.right,
    );
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    robot,
    worldRoot,
    controllers,
    teleop,
    updateTeleoperation,
  };
}

export function animateExercise5(app) {
  app.renderer.setAnimationLoop(() => {
    app.updateTeleoperation();
    if (!app.renderer.xr.isPresenting) {
      app.controls.update();
    }
    app.renderer.render(app.scene, app.camera);
  });
}
