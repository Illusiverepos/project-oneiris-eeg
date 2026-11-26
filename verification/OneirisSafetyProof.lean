/-
  Project ONEIRIS — Formal Safety Specification & Machine-Checkable Proof (Lean 4)
  Target: `GoldilocksCueController` (`mode = irt-tmr`) in `toolkit/cueing-system/closed_loop_engine.js`

  Proves 4 ironclad clinical anti-startle invariants:
    Theorem 1 (no_cue_during_wake_guard):
      No acoustic chord can EVER fire during warmup, lockout, or WAKE_GUARD breach.
    Theorem 2 (no_cue_during_ptsd_nrem_watchtower):
      No acoustic chord can EVER fire during hyperaroused PTSD NREM watchtower.
    Theorem 3 (silent_inside_lucid_corridor):
      Whenever Right-Frontal executive agency is inside the Goldilocks lucid corridor,
      the controller MUST hold silent (action = holdSilent).
    Theorem 4 (no_cue_during_eog_artifact):
      No acoustic chord can EVER fire during an EOG saccade artifact.
-/

namespace OneirisSafety

inductive Action where
  | wait
  | abortAndLockout
  | holdSilent
  | fireGentleIRTChord
  deriving DecidableEq, Repr

structure SensorFrame where
  inWarmup          : Bool
  inLockout         : Bool
  wakeGuardBreach   : Bool  -- alphaFrac > 0.36 ∨ rfBetaFrac > 0.28 ∨ zRF > 1.4
  eogArtifact       : Bool
  ptsdNremWatch     : Bool  -- deltaFrac > 0.45 ∨ (deltaFrac > 0.30 ∧ zRF > 0.5)
  inLucidCorridor   : Bool  -- 0.65 ≤ zRF ≤ 1.8 ∧ zPost ≥ 0
  inRemTarget       : Bool  -- deltaFrac ≤ 0.45 ∧ (zPost ≥ -0.25 ∨ zDFA ≤ -0.65) ∧ zRF < 0.65
  cooldownReady     : Bool

/-- Exact discrete decision kernel of `GoldilocksCueController.step` in `irt-tmr` mode. -/
def decideIRT (f : SensorFrame) : Action :=
  if f.inWarmup then Action.wait
  else if f.inLockout then Action.wait
  else if f.wakeGuardBreach then Action.abortAndLockout
  else if f.eogArtifact then Action.wait
  else if f.ptsdNremWatch then Action.wait
  else if f.inLucidCorridor then Action.holdSilent
  else if f.inRemTarget && f.cooldownReady then Action.fireGentleIRTChord
  else Action.wait

/-- Theorem 1: No acoustic cue can EVER fire during warmup, lockout, or WAKE_GUARD. -/
theorem no_cue_during_wake_guard (f : SensorFrame)
    (h : f.inWarmup = true ∨ f.inLockout = true ∨ f.wakeGuardBreach = true) :
    decideIRT f ≠ Action.fireGentleIRTChord := by
  unfold decideIRT
  rcases h with h1 | h2 | h3
  · simp [h1]
  · cases hw : f.inWarmup <;> simp [hw, h2]
  · cases hw : f.inWarmup <;> cases hl : f.inLockout <;> simp [hw, hl, h3]

/-- Theorem 2: No acoustic cue can EVER fire during hyperaroused PTSD NREM watchtower. -/
theorem no_cue_during_ptsd_nrem_watchtower (f : SensorFrame)
    (h : f.ptsdNremWatch = true) :
    decideIRT f ≠ Action.fireGentleIRTChord := by
  unfold decideIRT
  cases hw : f.inWarmup <;> cases hl : f.inLockout <;> cases wg : f.wakeGuardBreach <;>
    cases eo : f.eogArtifact <;> simp [hw, hl, wg, eo, h]

/-- Theorem 3: Inside the Goldilocks Lucid Corridor (when awake/artifact/NREM clear), controller holds silent. -/
theorem silent_inside_lucid_corridor (f : SensorFrame)
    (hClear : f.inWarmup = false ∧ f.inLockout = false ∧ f.wakeGuardBreach = false ∧
              f.eogArtifact = false ∧ f.ptsdNremWatch = false)
    (hLucid : f.inLucidCorridor = true) :
    decideIRT f = Action.holdSilent := by
  unfold decideIRT
  rcases hClear with ⟨h1, h2, h3, h4, h5⟩
  simp [h1, h2, h3, h4, h5, hLucid]

/-- Theorem 4: No acoustic cue can EVER fire during an EOG saccade artifact. -/
theorem no_cue_during_eog_artifact (f : SensorFrame)
    (h : f.eogArtifact = true) :
    decideIRT f ≠ Action.fireGentleIRTChord := by
  unfold decideIRT
  cases hw : f.inWarmup <;> cases hl : f.inLockout <;> cases wg : f.wakeGuardBreach <;>
    simp [hw, hl, wg, h]

/-- Master Soundness Theorem: Firing a gentle IRT chord implies ALL safety preconditions hold. -/
theorem fire_implies_all_safety_invariants (f : SensorFrame)
    (hFire : decideIRT f = Action.fireGentleIRTChord) :
    f.inWarmup = false ∧ f.inLockout = false ∧ f.wakeGuardBreach = false ∧
    f.eogArtifact = false ∧ f.ptsdNremWatch = false ∧ f.inLucidCorridor = false ∧
    f.inRemTarget = true ∧ f.cooldownReady = true := by
  unfold decideIRT at hFire
  cases hw : f.inWarmup <;> cases hl : f.inLockout <;> cases wg : f.wakeGuardBreach <;>
    cases eo : f.eogArtifact <;> cases nw : f.ptsdNremWatch <;> cases lc : f.inLucidCorridor <;>
    cases rt : f.inRemTarget <;> cases cd : f.cooldownReady <;>
    simp [hw, hl, wg, eo, nw, lc, rt, cd] at hFire ⊢

end OneirisSafety
