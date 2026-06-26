import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { GameResults, NoteJudgment, PracticeSettings, Song } from '../types';
import type { PitchSample } from '../audio/pitchDetection';
import { usePitchDetection, type LivePitchSample } from '../hooks/usePitchDetection';
import { getPracticeChart } from '../data/practiceCharts';
import type { PracticeChart } from '../data/practiceCharts';
import { getPlaybackPosition, getPracticeWindow } from '../../engine/practiceWindow';
import { useMetronome } from '../hooks/useMetronome';
import { useGuideAccompaniment } from '../hooks/useGuideAccompaniment';
import { usePracticeRecorder } from '../hooks/usePracticeRecorder';
import { usePracticeSession } from '../hooks/usePracticeSession';
import { calculateAccuracy, usePracticeScoring } from '../hooks/usePracticeScoring';
import { adjustJudgment } from '../../engine/practiceInsights';
import { buildRecordingErrorSegments } from '../../engine/recordingSegments';
import { getHarmonicaTrackCount } from '../../engine/scoreLayout';
import { buildPlaybackSyncPlan, getSelectedSyntheticAsset } from '../audio/practiceAudioAssets';
import { BreathGuideBar, HarmonicaStrip } from './practice/PracticeHoleGuide';
import { PracticeControls } from './practice/PracticeControls';
import { PracticeNoteLane } from './practice/PracticeNoteLane';
import { PracticeScoreboard } from './practice/PracticeScoreboard';
import { TraditionalScorePanel } from './practice/TraditionalScorePanel';
import { calibratedCentsFromTarget, formatPitchOffset, type PersonalPitchProfile } from '../practice/pitchProfile';

interface Props {
  song: Song;
  settings: PracticeSettings;
  importedChart?: PracticeChart;
  pitchProfile?: PersonalPitchProfile | null;
  onBack: () => void;
  onFinish: (results: GameResults) => void;
}

const JUDGMENT_FRAC = 0.82; // judgment line at 82% of field height

function judgePitch(sample: PitchSample | null, targetFrequency: number, pitchProfile?: PersonalPitchProfile | null): NoteJudgment {
  if (!sample || !targetFrequency) return 'Miss';
  const difference = Math.abs(calibratedCentsFromTarget(sample.frequency, targetFrequency, pitchProfile));
  if (difference <= 15) return 'Perfect';
  if (difference <= 30) return 'Great';
  if (difference <= 50) return 'Good';
  if (difference <= 80) return 'Bad';
  return 'Miss';
}

/* ───── Main Component ───── */
export function PracticePage({ song, settings, importedChart, pitchProfile, onBack, onFinish }: Props) {
  const builtInChart = getPracticeChart(song.id);
  const chart = importedChart ?? builtInChart.chart;
  const isFallbackChart = importedChart ? false : builtInChart.isFallback;
  const songNotes = chart.notes;
  const scoreMeasures = chart.measures;
  const noteFrequencies = chart.noteFrequencies;
  const noteNames = chart.noteNames;
  const lookAheadBeats = chart.lookAheadBeats;
  const displayHarmonicaType = settings.harmonicaType;
  const practiceWindow = useMemo(
    () => getPracticeWindow(scoreMeasures.length, settings.practiceRange, settings.repeatCount, settings.customStartMeasure, settings.customEndMeasure),
    [scoreMeasures.length, settings.customEndMeasure, settings.customStartMeasure, settings.practiceRange, settings.repeatCount],
  );
  const practiceNotes = useMemo(
    () => songNotes.filter((note) => note.beat >= practiceWindow.startBeat && note.beat < practiceWindow.endBeat),
    [practiceWindow.endBeat, practiceWindow.startBeat, songNotes],
  );
  const [micOn, setMicOn] = useState(true);
  const [metronomeOn, setMetronomeOn] = useState(settings.metronomeEnabled);
  const [accompanimentOn, setAccompanimentOn] = useState(settings.accompaniment !== 'none');
  const [gameFieldH, setGameFieldH] = useState(380);
  const [gameFieldW, setGameFieldW] = useState(390);
  const {
    status: microphoneStatus,
    sample: pitchSample,
    message: microphoneMessage,
    inputLevel,
    noiseFloor,
    calibrationProgress,
    start: startMicrophone,
    stop: stopMicrophone,
  } = usePitchDetection();
  const { prepare: prepareMetronome, tick: tickMetronome } = useMetronome(settings.metronomeVolume);
  const { prepare: prepareAccompaniment, playBeat: playAccompanimentBeat } = useGuideAccompaniment(settings.accompanimentVolume);
  const { status: recorderStatus, start: startRecording, stop: stopRecording, reset: resetRecording } = usePracticeRecorder();
  const {
    isPlaying,
    displayTime,
    startRef,
    rafRef,
    startSession,
    resumeSession,
    pauseSession,
    advanceSession,
    getPlaybackSnapshot,
  } = usePracticeSession();
  const {
    score,
    combo,
    counts,
    feedback,
    feedbackKey,
    scoredRef,
    scoreRef,
    maxComboRef,
    countsRef,
    noteResultsRef,
    resetScoring,
    recordJudgment,
  } = usePracticeScoring();

  const gameFieldRef = useRef<HTMLDivElement>(null);
  const pitchSampleRef = useRef<LivePitchSample | null>(null);
  const lastOnsetSampleRef = useRef<LivePitchSample | null>(null);
  const lastMetronomeBeatRef = useRef(-1);
  const finishingRef = useRef(false);
  pitchSampleRef.current = pitchSample;
  if (pitchSample?.onset) lastOnsetSampleRef.current = pitchSample;

  // Measure field height
  useEffect(() => {
    const field = gameFieldRef.current;
    if (!field) return;
    const measure = () => {
      setGameFieldH(field.clientHeight);
      setGameFieldW(field.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  const effectiveBpm = Math.round(song.bpm * settings.speed / 100);
  const beatDurationSec = 60 / effectiveBpm;
  const playbackSyncPlan = useMemo(() => buildPlaybackSyncPlan({
    song,
    speed: settings.speed,
    segmentStartBeat: practiceWindow.startBeat,
    segmentEndBeat: practiceWindow.endBeat,
    repeatCount: practiceWindow.repeatCount,
  }), [practiceWindow.endBeat, practiceWindow.repeatCount, practiceWindow.startBeat, settings.speed, song]);
  const activeAudioAsset = getSelectedSyntheticAsset(settings.accompaniment);
  const judgmentY = gameFieldH * JUDGMENT_FRAC;
  const beatHeight = judgmentY / lookAheadBeats;

  const start = useCallback(() => {
    resetScoring();
    lastOnsetSampleRef.current = null;
    finishingRef.current = false;
    resetRecording();
    lastMetronomeBeatRef.current = -1;
    startSession();
  }, [resetRecording, resetScoring, startSession]);

  const beginPractice = useCallback(async () => {
    if (metronomeOn) await prepareMetronome();
    if (accompanimentOn) await prepareAccompaniment();
    const stream = micOn ? await startMicrophone() : null;
    if (stream) startRecording(stream);
    start();
  }, [accompanimentOn, metronomeOn, micOn, prepareAccompaniment, prepareMetronome, start, startMicrophone, startRecording]);

  const toggleMicrophone = useCallback(async () => {
    if (micOn) {
      setMicOn(false);
      stopMicrophone();
      return;
    }
    setMicOn(true);
    await startMicrophone();
  }, [micOn, startMicrophone, stopMicrophone]);

  // Game loop
  useEffect(() => {
    if (!isPlaying) return;

    const animate = (now: number) => {
      const { elapsed, playbackBeat } = advanceSession(now, beatDurationSec);
      const playbackPosition = getPlaybackPosition(playbackBeat, practiceWindow.startBeat, practiceWindow.segmentBeats, practiceWindow.repeatCount);
      const currentBeat = playbackPosition.chartBeat;
      const currentBeatInt = Math.floor(currentBeat);

      if (currentBeatInt !== lastMetronomeBeatRef.current) {
        if (metronomeOn) tickMetronome(currentBeatInt % 4 === 0);
        if (accompanimentOn) playAccompanimentBeat(currentBeatInt, beatDurationSec, settings.accompaniment);
        lastMetronomeBeatRef.current = currentBeatInt;
      }

      // Auto-score notes
      practiceNotes.forEach((note) => {
        const scoreKey = `${playbackPosition.loopIndex}:${note.beat}:${note.track}`;
        if (note.beat <= currentBeat && !scoredRef.current.has(scoreKey)) {
          scoredRef.current.add(scoreKey);
          const targetFrequency = noteFrequencies[note.number] ?? 0;
          const detectedSample = micOn ? pitchSampleRef.current : null;
          const pitchJudgment = micOn ? judgePitch(detectedSample, targetFrequency, pitchProfile) : 'Miss';
          const scheduledPlaybackBeat = playbackPosition.loopIndex * practiceWindow.segmentBeats + (note.beat - practiceWindow.startBeat);
          const scheduledTime = startRef.current + scheduledPlaybackBeat * beatDurationSec * 1000;
          const onsetSample = micOn ? lastOnsetSampleRef.current : null;
          const onsetMatchesNote = Boolean(
            onsetSample
            && Math.abs(onsetSample.capturedAt - scheduledTime) <= beatDurationSec * 1000
            && targetFrequency
            && Math.abs(calibratedCentsFromTarget(onsetSample.frequency, targetFrequency, pitchProfile)) <= 80,
          );
          const timingDifferenceMs = onsetMatchesNote && onsetSample
            ? Math.round(onsetSample.capturedAt - scheduledTime)
            : null;
          const stabilityCents = detectedSample ? detectedSample.stabilityCents : null;
          const fb = adjustJudgment(pitchJudgment, timingDifferenceMs, stabilityCents);
          recordJudgment({
            loopIndex: playbackPosition.loopIndex,
            beat: note.beat,
            measure: Math.floor(note.beat / 4) + 1,
            noteNumber: note.number,
            hole: note.hole,
            breath: note.type,
            judgment: fb,
            centsDifference: detectedSample && targetFrequency ? Math.round(calibratedCentsFromTarget(detectedSample.frequency, targetFrequency, pitchProfile)) : null,
            detectedNote: detectedSample?.note ?? null,
            timingDifferenceMs,
            stabilityCents,
          });
        }
      });

      // End of song
      if (playbackBeat >= practiceWindow.totalPlaybackBeats) {
        if (finishingRef.current) return;
        finishingRef.current = true;
        pauseSession();
        const total = practiceNotes.length * practiceWindow.repeatCount;
        const accuracy = calculateAccuracy(countsRef.current, total);
        const noteResults = [...noteResultsRef.current];
        void stopRecording().then((recording) => {
          onFinish({
            score: scoreRef.current,
            accuracy,
            maxCombo: maxComboRef.current,
            perfect: countsRef.current.perfect,
            great: countsRef.current.great,
            good: countsRef.current.good,
            bad: countsRef.current.bad,
            miss: countsRef.current.miss,
            total,
            durationSeconds: Math.round(elapsed),
            noteResults,
            recordingUrl: recording?.url,
            recordingDurationMs: recording?.durationMs,
            errorSegments: buildRecordingErrorSegments({
              results: noteResults,
              beatDurationSec,
              startBeat: practiceWindow.startBeat,
              segmentBeats: practiceWindow.segmentBeats,
            }),
          });
        });
        return;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [accompanimentOn, isPlaying, advanceSession, beatDurationSec, metronomeOn, micOn, noteFrequencies, onFinish, pauseSession, pitchProfile, playAccompanimentBeat, practiceNotes, practiceWindow, recordJudgment, settings.accompaniment, stopRecording, tickMetronome]);

  // Derived display values
  const {
    currentBeatFloat,
    currentBeatInt,
    progressPct,
  } = getPlaybackSnapshot(beatDurationSec, practiceWindow);

  // Find the nearest upcoming/current note
  const sustainingNote = practiceNotes.find(
    (n) => n.beat <= currentBeatFloat && currentBeatFloat < n.beat + n.durationBeats
  );
  const upcomingNote = sustainingNote ?? practiceNotes.find(
    (n) => n.beat >= currentBeatInt && n.beat <= currentBeatInt + 1
  ) ?? [...practiceNotes].reverse().find((n) => n.beat <= currentBeatInt);

  const activeHole = upcomingNote?.hole ?? 4;
  const activeType = upcomingNote?.type ?? 'blow';
  const activeTechnique = upcomingNote?.technique ?? 'natural';
  const targetHz = upcomingNote ? (noteFrequencies[upcomingNote.number] ?? 330) : 0;
  const targetMidi = upcomingNote ? (noteNames[upcomingNote.number] ?? 'E4') : '--';
  const microphoneActive = micOn && microphoneStatus === 'listening';
  const hasPitch = microphoneActive && Boolean(pitchSample);
  const tuningDev = hasPitch && pitchSample ? Math.round(calibratedCentsFromTarget(pitchSample.frequency, targetHz, pitchProfile)) : 0;
  const confidence = hasPitch && pitchSample ? pitchSample.confidence : 0;
  const tuningPosition = Math.max(-30, Math.min(30, tuningDev));
  const microphoneError = ['denied', 'no-device', 'unsupported', 'error'].includes(microphoneStatus);

  // Accuracy
  const accuracy = calculateAccuracy(counts);

  // Visible notes for rendering
  const visibleNotes = practiceNotes.filter((n) => {
    const btu = n.beat - currentBeatFloat;
    return btu + n.durationBeats >= -0.8 && btu <= lookAheadBeats + 0.5;
  });

  const trackCount = getHarmonicaTrackCount(displayHarmonicaType);
  const trackW = gameFieldW / trackCount;
  const noteWidth = Math.max(24, Math.min(42, trackW * 0.72));

  const rangeLabel = settings.practiceRange === 'full'
    ? '整曲'
    : settings.practiceRange === 'firstHalf'
      ? 'A 段'
      : settings.practiceRange === 'secondHalf'
        ? 'B 段'
        : `第${practiceWindow.startMeasure + 1}-${practiceWindow.endMeasure}节`;
  const assistivePracticeStatus = `当前目标 ${upcomingNote?.number ?? '--'}，第 ${activeHole} 孔，${activeType === 'blow' ? '吹气' : '吸气'}，分数 ${score}，准确率 ${accuracy}%${feedback ? `，判定 ${feedback}` : ''}`;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0E1A',
        userSelect: 'none',
      }}
    >
      {/* Status bar spacer */}
      <div style={{ height: 44, flexShrink: 0 }} />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {assistivePracticeStatus}
      </div>

      <PracticeScoreboard
        title={song.title}
        subtitle={`${importedChart ? '上传草稿 · ' : ''}${song.key}调 · ${playbackSyncPlan.effectiveBpm} BPM · ${playbackSyncPlan.playbackRate.toFixed(2)}× · ${rangeLabel} ×${settings.repeatCount}${pitchProfile ? ` · 校准 ${formatPitchOffset(pitchProfile.averageOffsetCents)}` : ''}`}
        score={score}
        accuracy={accuracy}
        progressPct={progressPct}
        onBack={onBack}
      />

      <TraditionalScorePanel
        scoreMeasures={scoreMeasures}
        currentBeatFloat={currentBeatFloat}
        isPlaying={isPlaying}
        combo={combo}
      />

      <BreathGuideBar activeType={activeType} activeHole={activeHole} />

      <div style={{ height: 24, flexShrink: 0, padding: '0 12px', background: '#080D18', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: '#6B80A8', fontSize: 9 }}>
          音画同步：{playbackSyncPlan.segmentStartBeat}-{playbackSyncPlan.segmentEndBeat} 拍 · {playbackSyncPlan.repeatCount} 遍
        </span>
        <span style={{ color: activeAudioAsset ? '#00C9B1' : '#6B80A8', fontSize: 9 }}>
          {activeAudioAsset ? activeAudioAsset.label : '无伴奏'} · 伴奏 {settings.accompanimentVolume}% · 节拍 {settings.metronomeVolume}%
        </span>
      </div>

      <PracticeNoteLane
        gameFieldRef={gameFieldRef}
        trackCount={trackCount}
        trackWidth={trackW}
        noteWidth={noteWidth}
        visibleNotes={visibleNotes}
        currentBeatFloat={currentBeatFloat}
        judgmentY={judgmentY}
        beatHeight={beatHeight}
        activeHole={activeHole}
        activeType={activeType}
        feedback={feedback}
        feedbackKey={feedbackKey}
        isPlaying={isPlaying}
        displayTime={displayTime}
        microphoneStatus={microphoneStatus}
        microphoneMessage={microphoneMessage}
        calibrationProgress={calibrationProgress}
        isFallbackChart={isFallbackChart}
        micOn={micOn}
        microphoneError={microphoneError}
        onBeginPractice={() => void beginPractice()}
        onRetryMicrophone={() => void startMicrophone()}
      />
      {/* ═══ HARMONICA STRIP ═══ */}
      <div style={{ flexShrink: 0, height: 76 }}>
        {/* Current note indicator */}
        <div
          style={{
            height: 20,
            background: '#0D1220',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              padding: '2px 12px',
              borderRadius: 12,
              background: activeType === 'blow' ? 'rgba(0,201,177,0.15)' : 'rgba(255,107,157,0.15)',
              border: `1px solid ${activeType === 'blow' ? 'rgba(0,201,177,0.4)' : 'rgba(255,107,157,0.4)'}`,
              color: activeType === 'blow' ? '#00C9B1' : '#FF6B9D',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {activeType === 'blow' ? '↑ 吹气' : '↓ 吸气'} · 第 {activeHole} 孔
            {activeTechnique === 'slide' ? ' · 按滑键' : activeTechnique === 'bend-half' ? ' · 半音压音' : activeTechnique === 'bend-whole' ? ' · 全音压音' : activeTechnique === 'overblow' ? ' · 超吹' : ''}
          </div>
        </div>
        <HarmonicaStrip activeHole={activeHole} activeType={activeType} harmonicaType={displayHarmonicaType} />
      </div>

      {/* ═══ RECOGNITION AREA ═══ */}
      <div
        style={{
          height: 42,
          background: '#0D1220',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          gap: 8,
          borderTop: '1px solid rgba(255,255,255,0.05)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: microphoneError ? '#EF4444' : microphoneActive ? '#00C9B1' : microphoneStatus === 'requesting' || microphoneStatus === 'calibrating' ? '#F59E0B' : '#4A5A78', boxShadow: microphoneActive ? '0 0 6px #00C9B1' : 'none' }} />
          <span style={{ color: '#00C9B1', fontSize: 11, fontWeight: 600 }}>
            {hasPitch && pitchSample ? `${pitchSample.frequency.toFixed(1)} Hz` : '--- Hz'}
          </span>
          <span title={microphoneMessage} style={{ color: microphoneActive ? '#00C9B1' : '#6B80A8', fontSize: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '1px 4px' }}>{microphoneActive ? '实时' : '待机'}</span>
          <span style={{ color: recorderStatus === 'recording' ? '#FF6B9D' : '#6B80A8', fontSize: 8, border: `1px solid ${recorderStatus === 'recording' ? 'rgba(255,107,157,0.28)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '1px 4px' }}>
            {recorderStatus === 'recording' ? '录音中' : recorderStatus === 'ready' ? '可回放' : '未录音'}
          </span>
        </div>
        <span style={{ color: '#4A5A78', fontSize: 10 }}>→</span>
        <span style={{ color: '#A8BCD8', fontSize: 11, fontWeight: 600, minWidth: 24 }}>
          {hasPitch && pitchSample ? pitchSample.note : targetMidi}
        </span>
        <span style={{ color: '#4A5A78', fontSize: 10 }}>→</span>
        {/* Tuning meter */}
        <div
          aria-label="音准偏差指示"
          style={{
            flex: 1,
            position: 'relative',
            height: 12,
            borderRadius: 999,
            background: 'linear-gradient(90deg,rgba(245,158,11,0.12),rgba(255,255,255,0.1) 38%,rgba(0,201,177,0.18) 50%,rgba(255,255,255,0.1) 62%,rgba(245,158,11,0.12))',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', left: '50%', top: 1, bottom: 1, width: 2, borderRadius: 2, background: '#00C9B1', boxShadow: '0 0 8px rgba(0,201,177,0.75)' }} />
          {[-24, -12, 12, 24].map((tick) => (
            <div
              key={tick}
              style={{
                position: 'absolute',
                left: `calc(50% + ${tick}px)`,
                top: 3,
                bottom: 3,
                width: 1,
                background: 'rgba(255,255,255,0.18)',
              }}
            />
          ))}
          {hasPitch && (
            <div
              style={{
                position: 'absolute',
                top: 1,
                bottom: 1,
                width: 8,
                borderRadius: 999,
                background: Math.abs(tuningDev) < 8 ? '#00C9B1' : '#FF6B9D',
                left: `calc(50% + ${tuningPosition}px)`,
                transform: 'translateX(-50%)',
                transition: 'left 0.16s ease',
                boxShadow: `0 0 10px ${Math.abs(tuningDev) < 8 ? 'rgba(0,201,177,0.75)' : 'rgba(255,107,157,0.75)'}`,
              }}
            />
          )}
          {!hasPitch && microphoneActive && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${inputLevel}%`,
                maxWidth: '100%',
                borderRadius: 999,
                background: inputLevel <= noiseFloor ? 'rgba(74,90,120,0.75)' : 'rgba(96,165,250,0.55)',
                transition: 'width 0.1s',
              }}
            />
          )}
        </div>
        <span style={{ color: tuningDev > 0 ? '#F59E0B' : tuningDev < 0 ? '#F59E0B' : '#22C55E', fontSize: 10, minWidth: 28, textAlign: 'right' }}>
          {hasPitch ? `${tuningDev > 0 ? '+' : ''}${tuningDev}¢` : '0¢'}
        </span>
        <span style={{ color: '#6B80A8', fontSize: 10, minWidth: 36 }}>
          {hasPitch ? `${confidence}%` : microphoneActive ? `${inputLevel}%` : '--'}
        </span>
      </div>

      <PracticeControls
        isPlaying={isPlaying}
        displayTime={displayTime}
        micOn={micOn}
        metronomeOn={metronomeOn}
        accompanimentOn={accompanimentOn}
        accompaniment={settings.accompaniment}
        onRestart={() => { pauseSession(); window.setTimeout(() => void beginPractice(), 100); }}
        onBeginPractice={() => void beginPractice()}
        onPause={pauseSession}
        onResume={resumeSession}
        onToggleMicrophone={() => void toggleMicrophone()}
        setMetronomeOn={setMetronomeOn}
        setAccompanimentOn={setAccompanimentOn}
        prepareMetronome={prepareMetronome}
        prepareAccompaniment={prepareAccompaniment}
      />

      {/* Bottom safe area */}
      <div style={{ height: 20, background: '#0A0E1A', flexShrink: 0 }} />
    </div>
  );
}

