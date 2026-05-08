import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { initExercise3Hints } from "../03-pbr-lighting/exercise3.js";

export function initExercise4() {
  // The robot object exposes:
  //   robot.arms.left.shoulder  → THREE.Group (rotates whole left arm)
  //   robot.arms.left.elbow     → THREE.Group (rotates forearm + hand)
  //   robot.arms.left.hand      → THREE.Group
  //   (same structure for robot.arms.right)
  const {
    scene,
    camera,
    renderer,
    controls,
    robot,
    gui: ex3Gui,
  } = initExercise3Hints();

  ex3Gui.close(); // close ex3 gui(lighting)
  // Animation State
  // auto-animation behaviour.
  const animState = {
    autoAnimate: true,
    speed: 1.0, // multiplier applied to the time variable
    waveAmplitude: 0.6, // max default shoulder-Z rotation in radians
  };

  // Manual Joint Angles
  // When autoAnimate is false the GUI sliders write into this object,
  // and animateRobot() reads from it.
  const jointAngles = {
    leftShoulderZ: 0, // Abduction/adduction
    leftShoulderX: 0, // Flexion/extension
    leftElbowX: 0, // elbow flexion
    rightShoulderZ: 0,
    rightShoulderX: 0,
    rightElbowX: 0,
  };

  function animateRobot() {
    const t = Date.now() * 0.001 * animState.speed; // time in seconds, scaled by speed multiplier

    if (animState.autoAnimate) {
      robot.arms.left.shoulder.rotation.z = Math.abs(
        Math.sin(t) * animState.waveAmplitude,
      );
      robot.arms.left.elbow.rotation.x = -Math.abs(Math.sin(t));

      robot.arms.right.shoulder.rotation.z = -Math.abs(
        Math.sin(t) * animState.waveAmplitude,
      );
      robot.arms.right.elbow.rotation.x = -Math.abs(Math.sin(t));
    } else {
      // Manual mode: read from jointAngles object (populated by GUI sliders).
      robot.arms.left.shoulder.rotation.z = jointAngles.leftShoulderZ;
      robot.arms.left.shoulder.rotation.x = jointAngles.leftShoulderX;
      robot.arms.left.elbow.rotation.x = jointAngles.leftElbowX;
      robot.arms.right.shoulder.rotation.z = jointAngles.rightShoulderZ;
      robot.arms.right.shoulder.rotation.x = jointAngles.rightShoulderX;
      robot.arms.right.elbow.rotation.x = jointAngles.rightElbowX;
    }
  }

  // GUI
  const gui = new GUI({ title: "Animation Controls" });
  const Animation = gui.addFolder("Automatic Animation");
  const autoAnimateController = Animation.add(animState, "autoAnimate")
    .name("Auto Animate")
    .onChange((value) => {
      if (!value) {
        // Switching to manual snapshot the robot's current animated pose into
        // jointAngles so the sliders pick up exactly where the animation left off.
        jointAngles.leftShoulderZ = robot.arms.left.shoulder.rotation.z;
        jointAngles.leftShoulderX = robot.arms.left.shoulder.rotation.x;
        jointAngles.leftElbowX = robot.arms.left.elbow.rotation.x;
        jointAngles.rightShoulderZ = robot.arms.right.shoulder.rotation.z;
        jointAngles.rightShoulderX = robot.arms.right.shoulder.rotation.x;
        jointAngles.rightElbowX = robot.arms.right.elbow.rotation.x;

        // Refresh slider displays to match the new values.
        manualControl.controllersRecursive().forEach((c) => c.updateDisplay());
      }
    });

  Animation.add(animState, "speed", 0.1, 5, 0.1).name("Speed");
  Animation.add(animState, "waveAmplitude", 0, Math.PI / 2, 0.01).name(
    //maximum angle 90 (horizontal)
    "Amplitude",
  );
  const manualControl = gui.addFolder("Manual Controls");

  // When a manual slider is moved while auto-animate is active, automatically
  // switch to manual mode so the slider has immediate effect.
  function onManualSliderChange(key, value) {
    if (!animState.autoAnimate) return; // already manual, slider drives directly

    // Snapshot all animated joint positions so other joints don't snap to zero
    jointAngles.leftShoulderZ = robot.arms.left.shoulder.rotation.z;
    jointAngles.leftShoulderX = robot.arms.left.shoulder.rotation.x;
    jointAngles.leftElbowX = robot.arms.left.elbow.rotation.x;
    jointAngles.rightShoulderZ = robot.arms.right.shoulder.rotation.z;
    jointAngles.rightShoulderX = robot.arms.right.shoulder.rotation.x;
    jointAngles.rightElbowX = robot.arms.right.elbow.rotation.x;

    jointAngles[key] = value; // update the one slider that triggered this change
    animState.autoAnimate = false; // switch to manual mode
    autoAnimateController.updateDisplay(); // update the autoAnimate checkbox to reflect the change

    // Refresh all slider displays to show the snapshotted values.
    manualControl.controllersRecursive().forEach((c) => c.updateDisplay());
  }

  // GUI sliders for each joint.
  const leftArm = manualControl.addFolder("Left Arm");
  leftArm
    .add(jointAngles, "leftShoulderZ", 0, Math.PI / 2, 0.01) // limit to 90 degrees abduction
    .name("Abduction/adduction")
    .onChange((v) => onManualSliderChange("leftShoulderZ", v));

  leftArm
    .add(jointAngles, "leftShoulderX", -Math.PI / 2, Math.PI / 4, 0.01) // limit to 90 degrees flexion and 45 degrees hyperextension
    .name("flexion/extension")
    .onChange((v) => onManualSliderChange("leftShoulderX", v));

  leftArm
    .add(jointAngles, "leftElbowX", -Math.PI / 1.25, 0, 0.01) // limit to 144 degrees flexion (like a human elbow)
    .name("Elbow Flexion")
    .onChange((v) => onManualSliderChange("leftElbowX", v));

  const rightArm = manualControl.addFolder("Right Arm");
  rightArm
    .add(jointAngles, "rightShoulderZ", -Math.PI / 2, 0, 0.01) // limit to 90 degrees abduction
    .name("Abduction/adduction")
    .onChange((v) => onManualSliderChange("rightShoulderZ", v));

  rightArm
    .add(jointAngles, "rightShoulderX", -Math.PI / 2, Math.PI / 4, 0.01) // limit to 90 degrees flexion and 45 degrees hyperextension
    .name("flexion/extension")
    .onChange((v) => onManualSliderChange("rightShoulderX", v));

  rightArm
    .add(jointAngles, "rightElbowX", -Math.PI / 1.25, 0, 0.01) // limit to 144 degrees flexion (like a human elbow)
    .name("Elbow Flexion")
    .onChange((v) => onManualSliderChange("rightElbowX", v));

  gui.close();

  return { scene, camera, renderer, controls, robot, animateRobot, gui };
}
