import { Matrix4, Quaternion, Vector3 } from 'three/webgpu';

const worldUp = new Vector3(0, 1, 0);
const right = new Vector3();
const roadUp = new Vector3();
const basis = new Matrix4();

/** Align +Z to the road while preserving its upright frame. A shortest-arc
 * rotation from +Z alone can pitch the whole vehicle upside down near -Z. */
export function roadOrientation(forward: Vector3, rotation: Quaternion) {
  right.crossVectors(worldUp, forward).normalize();
  roadUp.crossVectors(forward, right).normalize();
  return rotation.setFromRotationMatrix(basis.makeBasis(right, roadUp, forward));
}
