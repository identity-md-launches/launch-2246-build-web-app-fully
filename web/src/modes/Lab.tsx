import { useEffect, useMemo, useState } from 'react';
import { TECHNIQUE_BY_ID } from '../data/techniques';
import { makeRig } from '../rig/dimensions';
import { buildSkeleton } from '../rig/skeleton';
import { useSettings } from '../store/settings';
import { CameraBar, OverlayToggles, Segmented, Transport } from '../ui/components';
import { Player, usePlayerTick } from '../ui/player';
import { DEFAULT_OVERLAYS, Stage, type CameraPreset, type OverlayFlags } from '../ui/Stage';
import s from '../ui/ui.module.css';
import { baseConfig, demoFor } from './demo';

/** Foundational clips (M2) for visual verification. */
const FOUNDATION = ['FW01', 'FW02', 'FW03', 'FW04', 'FW05', 'FW06', 'PA01', 'PA02', 'PA03', 'PA04', 'PA05', 'PA06', 'PA07', 'PA08', 'AT01', 'AT02'];

export default function Lab() {
  const settings = useSettings();
  const [id, setId] = useState('FW04');
  const [camera, setCamera] = useState<CameraPreset>('referee');
  const [overlays, setOverlays] = useState<OverlayFlags>({ ...DEFAULT_OVERLAYS, zones: true });
  const player = useMemo(() => new Player(), []);
  const key = JSON.stringify(baseConfig(settings));
  const result = useMemo(() => demoFor(id, JSON.parse(key)), [id, key]);
  useEffect(() => {
    player.setResult(result);
    player.speed = 0.5;
  }, [player, result]);
  const tick = usePlayerTick(player);
  const f = result.frames[Math.min(result.frames.length - 1, Math.round(tick))];
  const sk = buildSkeleton(f.left, makeRig(settings.heightLeft));
  return (
    <div className={s.page}>
      <div>
        <h1 className={s.pageTitle}>Animation lab</h1>
        <p className={s.lead}>Foundational clips with live joint angles, for checking poses against the spec.</p>
      </div>
      <Segmented label="Clip" value={id} options={FOUNDATION.map((x) => ({ value: x, label: `${x} ${TECHNIQUE_BY_ID[x].name}` }))} onChange={setId} />
      <div className={s.split}>
        <div className={s.panel}>
          <Stage player={player} camera={camera} overlays={overlays} label={`Lab view of ${TECHNIQUE_BY_ID[id].name}`} className={s.stage} />
          <Transport player={player} />
          <CameraBar value={camera} onChange={setCamera} />
          <OverlayToggles value={overlays} onChange={setOverlays} />
        </div>
        <div className={s.panel}>
          <h2 className={s.sectionTitle}>Joint readout (left fencer)</h2>
          <ul className={s.list}>
            <li>Elbow flexion: {sk.elbowFlex.toFixed(1)}°</li>
            <li>Front knee flexion: {sk.frontKneeFlex.toFixed(1)}°</li>
            <li>Rear knee flexion: {sk.rearKneeFlex.toFixed(1)}°</li>
            <li>Torso lean: {sk.lean.toFixed(1)}°</li>
            <li>Head height: {sk.joints.head[1].toFixed(3)} m</li>
            <li>Arm reached target: {sk.armReached ? 'yes' : 'no'}</li>
          </ul>
          <h3>Sync markers</h3>
          <ul className={s.list}>
            {Object.entries(TECHNIQUE_BY_ID[id].syncMarkers).map(([k, v]) => (
              <li key={k}>
                {k}: {v.toFixed(2)} T
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
