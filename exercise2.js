import * as THREE from "three";
import { initExercise1 } from "./exercise1.js"; //Scene setup + kitchen objects

/**
 * Initializes the Exercise 2 scene that consists of Exercise 1 kitchen + The robot.
 * Returns { scene, camera, renderer, controls, robot(object) }
 */
export function initExercise2() {
  const { scene, camera, renderer, controls } = initExercise1();

  // Materials
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2e3d4f, // dark blue-grey
    metalness: 0.7,
    roughness: 0.3,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0x607080, // medium grey
    metalness: 0.5,
    roughness: 0.4,
  });
  const handMat = new THREE.MeshStandardMaterial({
    color: 0x8ba0b0, // slightly lighter
    metalness: 0.6,
    roughness: 0.2,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0xd0dde8, // bright chrome color
    metalness: 0.95,
    roughness: 0.05,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x3a5068, // darker blue-grey
    metalness: 0.6,
    roughness: 0.3,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff, //Light BLueish
    metalness: 0.2,
    roughness: 0.1,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.6,
  });

  /**
   * Creates a joint Group with an offset BoxMesh, a chrome sphere at the
   * joint origin, and an AxesHelper. Adds the group to The 'parent'.
   */
  function createLimb(parent, position, size, offsetY, material) {
    const group = new THREE.Group();
    group.position.copy(position);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.w, size.h, size.d),
      material,
    );
    mesh.position.y = offsetY;
    mesh.castShadow = true;
    group.add(mesh);

    const jointSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 12), // (radius, widthSegments, heightSegments)
      jointMat,
    );
    jointSphere.castShadow = true;
    group.add(jointSphere);

    group.add(new THREE.AxesHelper(0.3));

    parent.add(group);
    return group;
  }

  /**
   * Builds a hand: wrist Group + chrome sphere + palm + 2 fingers.
   * Returns the wrist Group.
   */
  function createHand(parent, position, handMaterial, jointMaterial) {
    const group = new THREE.Group();
    group.position.copy(position);

    const wristSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 12),
      jointMaterial,
    );
    wristSphere.castShadow = true;
    group.add(wristSphere);

    group.add(new THREE.AxesHelper(0.3));

    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.07, 0.09),
      handMaterial,
    );
    palm.position.y = -0.035;
    palm.castShadow = true;
    group.add(palm);

    // 2 fingers extending from palm bottom
    [-0.04, 0.04].forEach((xOff) => {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.09, 0.03),
        handMaterial,
      );
      finger.position.set(xOff, -0.115, 0);
      finger.castShadow = true;
      group.add(finger);
    });

    parent.add(group);
    return group;
  }

  /**
   * Builds a full arm chain: shoulder → elbow → hand.
   * Returns { shoulderGroup, elbowGroup, handGroup } for animation access.
   */
  function createArm(
    torsoGroup,
    side,
    xOffset,
    yOffset,
    limbMaterial,
    jointMaterial,
    handMaterial,
  ) {
    const sign = side === "left" ? 1 : -1;

    const shoulderGroup = createLimb(
      torsoGroup,
      new THREE.Vector3(sign * xOffset, yOffset, 0), // position at shoulder pivot
      { w: 0.12, h: 0.3, d: 0.12 }, // limb size
      -0.15, // offset to align limb top with shoulder pivot
      limbMaterial,
    );

    const elbowGroup = createLimb(
      shoulderGroup,
      new THREE.Vector3(0, -0.3, 0), // position at elbow pivot
      { w: 0.1, h: 0.3, d: 0.1 }, // limb size
      -0.15, // offset to align limb top with elbow pivot
      limbMaterial,
    );

    const handGroup = createHand(
      elbowGroup,
      new THREE.Vector3(0, -0.3, 0), // position at wrist pivot
      handMaterial,
      jointMaterial,
    );

    return { shoulderGroup, elbowGroup, handGroup };
  }

  /**
   * Assembles the full robot: legs, hips, torso, neck, head, eyes. All attached to a fixed root
   */
  function createRobotRoot(scene, materials) {
    const { bodyMat, limbMat, jointMat, handMat, headMat, eyeMat } = materials;

    const robotRoot = new THREE.Group();
    robotRoot.position.set(3.0, 0, 0);

    // Legs
    [-0.13, 0.13].forEach((xPos) => {
      // two offsets for left and right leg
      const legMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.5, 0.2),
        bodyMat,
      );
      legMesh.position.set(xPos, 0.251, 0.0);
      legMesh.castShadow = true;
      robotRoot.add(legMesh);
    });

    // Hips — sits on top of legs (legs top 0.5, half hips 0.15 → center 0.65)
    const hipsMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.3),
      bodyMat,
    );
    hipsMesh.position.y = 0.65;
    hipsMesh.castShadow = true;
    robotRoot.add(hipsMesh);

    // Torso — pivot at top of hips (y = 0.8)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.8;
    torsoGroup.add(new THREE.AxesHelper(0.2));

    const torsoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.8, 0.3),
      bodyMat,
    );
    torsoMesh.position.y = 0.4;
    torsoMesh.castShadow = true;
    torsoGroup.add(torsoMesh);

    // Neck
    const neckMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16),
      bodyMat,
    );
    neckMesh.position.y = 0.86;
    neckMesh.castShadow = true;
    torsoGroup.add(neckMesh);

    // Head
    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.25, 0.25),
      headMat,
    );
    headMesh.position.y = 1.045;
    headMesh.castShadow = true;
    torsoGroup.add(headMesh);

    // Eyes
    [-0.07, 0.07].forEach((xPos) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), eyeMat);
      eye.position.set(xPos, 1.06, 0.13);
      torsoGroup.add(eye);
    });

    // Arms, shoulder x = half torso (0.225) + half arm (0.06) = 0.285
    const leftArm = createArm(
      torsoGroup,
      "left",
      0.285,
      0.72,
      limbMat,
      jointMat,
      handMat,
    );
    const rightArm = createArm(
      torsoGroup,
      "right",
      0.285,
      0.72,
      limbMat,
      jointMat,
      handMat,
    );

    robotRoot.add(torsoGroup); // attach torso (+ neck, head, eyes, arms) to root

    scene.add(robotRoot);
    return {
      root: robotRoot,
      torso: torsoGroup,
      arms: {
        left: {
          shoulder: leftArm.shoulderGroup,
          elbow: leftArm.elbowGroup,
          hand: leftArm.handGroup,
        },
        right: {
          shoulder: rightArm.shoulderGroup,
          elbow: rightArm.elbowGroup,
          hand: rightArm.handGroup,
        },
      },
    };
  }

  const robot = createRobotRoot(scene, {
    bodyMat,
    limbMat,
    jointMat,
    handMat,
    headMat,
    eyeMat,
  });

  return { scene, camera, renderer, controls, robot };
}
