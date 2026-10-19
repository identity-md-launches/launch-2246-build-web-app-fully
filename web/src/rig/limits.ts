/**
 * Anatomical limits in degrees. Flexion angles are measured as the bend away from straight
 * (0 = fully extended). Rotations are measured from the anatomical neutral.
 */
export const JOINT_LIMITS = {
  pelvisTilt: { min: -20, max: 25 },
  lumbarFlex: { min: -15, max: 30 },
  chestTwist: { min: -60, max: 60 },
  neckFlex: { min: -40, max: 50 },
  clavicleElevate: { min: -10, max: 30 },
  shoulderFlex: { min: -60, max: 180 },
  shoulderAbduct: { min: -30, max: 180 },
  elbowFlex: { min: 0, max: 150 },
  forearmTwist: { min: 0, max: 180 },
  wristFlex: { min: -70, max: 80 },
  hipFlex: { min: -30, max: 125 },
  kneeFlex: { min: 0, max: 145 },
  ankleFlex: { min: -45, max: 30 },
  toeFlex: { min: -40, max: 60 },
} as const;

export type JointName = keyof typeof JOINT_LIMITS;

export function withinLimit(joint: JointName, deg: number, tolerance = 0.5): boolean {
  const l = JOINT_LIMITS[joint];
  return deg >= l.min - tolerance && deg <= l.max + tolerance;
}
