import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw, Mic, MicOff, TimerReset, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { GameResults, NoteJudgment, NotePracticeResult, PracticeSettings, Song } from '../types';
import { centsFromTarget, type PitchSample } from '../audio/pitchDetection';
import { usePitchDetection, type LivePitchSample } from '../hooks/usePitchDetection';
import { getPracticeChart } from '../data/practiceCharts';
import { getPlaybackPosition, getPracticeWindow } from '../practice/practiceWindow';
import { useMetronome } from '../hooks/useMetronome';
import { useGuideAccompaniment } from '../hooks/useGuideAccompaniment';
import { adjustJudgment } from '../practice/practiceInsights';

interface Props {
  song: Song;
  settings: PracticeSettings;
  onBack: () => void;
  onFinish: (results: GameResults) => void;
}

const NUM_TRACKS = 7;
const JUDGMENT_FRAC = 0.82; // judgment line at 82% of field height

const SCORE_TABLE: Record<string, number> = {
  Perfect: 100, Great: 80, Good: 60, Bad: 20, Miss: 0,
};
const FEEDBACK_COLORS: Record<string, string> = {
  Perfect: '#A855F7',
  Great: '#22C55E',
  Good: '#60A5FA',
  Bad: '#FBCFE8',
  Miss: '#6B7280',
};

function judgePitch(sample: PitchSample | null, targetFrequency: number): NoteJudgment {
  if (!sample || !targetFrequency) return 'Miss';
  const difference = Math.abs(centsFromTarget(sample.frequency, targetFrequency));
  if (difference <= 15) return 'Perfect';
  if (difference <= 30) return 'Great';
  if (difference <= 50) return 'Good';
  if (difference <= 80) return 'Bad';
  return 'Miss';
}

const DIATONIC_C = [
  { blow: 'C', draw: 'D' },
  { blow: 'E', draw: 'G' },
  { blow: 'G', draw: 'B' },
  { blow: 'C', draw: 'D' },
  { blow: 'E', draw: 'F' },
  { blow: 'G', draw: 'A' },
  { blow: 'C', draw: 'B' },
  { blow: 'E', draw: 'D' },
  { blow: 'G', draw: 'F' },
  { blow: 'C', draw: 'A' },
];

/* ───── Harmonica Strip ───── */
function HarmonicaStrip({
  activeHole,
  activeType,
  harmonicaType,
}: {
  activeHole: number;
  activeType: 'blow' | 'draw';
  harmonicaType: 'diatonic' | 'chromatic';
}) {
  const holes = harmonicaType === 'chromatic'
    ? Array.from({ length: 12 }, () => ({ blow: '', draw: '' }))
    : DIATONIC_C;
  return (
    <div
      style={{
        background: 'linear-gradient(180deg,#d0d0d0 0%,#e8e8e8 20%,#b8b8b8 50%,#c8c8c8 80%,#a8a8a8 100%)',
        borderTop: '1px solid rgba(255,255,255,0.3)',
        borderBottom: '1px solid rgba(0,0,0,0.3)',
        padding: '6px 4px 4px',
        display: 'flex',
        alignItems: 'stretch',
        gap: 2,
      }}
    >
      {holes.map((h, i) => {
        const holeNum = i + 1;
        const isActive = holeNum === activeHole;
        const blowColor = '#00C9B1';
        const drawColor = '#FF6B9D';
        return (
          <div
            key={holeNum}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {/* Blow note label */}
            <div style={{ fontSize: 7, color: isActive && activeType === 'blow' ? blowColor : '#666', fontWeight: isActive ? 700 : 400, lineHeight: 1 }}>
              {isActive && activeType === 'blow' ? '↑吹' : h.blow}
            </div>

            {/* Hole body */}
            <div
              style={{
                width: '100%',
                height: 36,
                borderRadius: 3,
                background: isActive
                  ? `linear-gradient(180deg, ${activeType === 'blow' ? blowColor + '40' : drawColor + '40'} 0%, #1a1a1a 100%)`
                  : 'linear-gradient(180deg,#444 0%,#222 40%,#1a1a1a 60%,#2a2a2a 100%)',
                border: `1.5px solid ${isActive ? (activeType === 'blow' ? blowColor : drawColor) : 'rgba(0,0,0,0.6)'}`,
                boxShadow: isActive
                  ? `0 0 10px ${activeType === 'blow' ? blowColor : drawColor}80, inset 0 2px 4px rgba(0,0,0,0.6)`
                  : 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? (activeType === 'blow' ? blowColor : drawColor) : 'rgba(255,255,255,0.5)', transition: 'color 0.15s' }}>
                {holeNum}
              </span>
            </div>

            {/* Draw note label */}
            <div style={{ fontSize: 7, color: isActive && activeType === 'draw' ? drawColor : '#666', fontWeight: isActive ? 700 : 400, lineHeight: 1 }}>
              {isActive && activeType === 'draw' ? '↓吸' : h.draw}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───── Main Component ───── */
export function PracticePage({ song, settings, onBack, onFinish }: Props) {
  const { chart, isFallback: isFallbackChart } = getPracticeChart(song.id);
  const songNotes = chart.notes;
  const scoreMeasures = chart.measures;
  const noteFrequencies = chart.noteFrequencies;
  const noteNames = chart.noteNames;
  const lookAheadBeats = chart.lookAheadBeats;
  const practiceWindow = useMemo(
    () => getPracticeWindow(scoreMeasures.length, settings.practiceRange, settings.repeatCount, settings.customStartMeasure, settings.customEndMeasure),
    [scoreMeasures.length, settings.customEndMeasure, settings.customStartMeasure, settings.practiceRange, settings.repeatCount],
  );
  const practiceNotes = useMemo(
    () => songNotes.filter((note) => note.beat >= practiceWindow.startBeat && note.beat < practiceWindow.endBeat),
    [practiceWindow.endBeat, practiceWindow.startBeat, songNotes],
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [metronomeOn, setMetronomeOn] = useState(settings.metronomeEnabled);
  const [accompanimentOn, setAccompanimentOn] = useState(settings.accompaniment !== 'none');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [counts, setCounts] = useState({ perfect: 0, great: 0, good: 0, bad: 0, miss: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
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
  const { prepare: prepareMetronome, tick: tickMetronome } = useMetronome();
  const { prepare: prepareAccompaniment, playBeat: playAccompanimentBeat } = useGuideAccompaniment();

  const gameFieldRef = useRef<HTMLDivElement>(null);
  const gameTimeRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const scoredRef = useRef(new Set<string>());
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const countsRef = useRef({ perfect: 0, great: 0, good: 0, bad: 0, miss: 0 });
  const noteResultsRef = useRef<NotePracticeResult[]>([]);
  const pitchSampleRef = useRef<LivePitchSample | null>(null);
  const lastOnsetSampleRef = useRef<LivePitchSample | null>(null);
  const lastMetronomeBeatRef = useRef(-1);
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
  const judgmentY = gameFieldH * JUDGMENT_FRAC;
  const beatHeight = judgmentY / lookAheadBeats;

  const start = useCallback(() => {
    scoredRef.current.clear();
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    countsRef.current = { perfect: 0, great: 0, good: 0, bad: 0, miss: 0 };
    noteResultsRef.current = [];
    lastOnsetSampleRef.current = null;
    gameTimeRef.current = 0;
    lastMetronomeBeatRef.current = -1;
    setScore(0);
    setCombo(0);
    setCounts({ perfect: 0, great: 0, good: 0, bad: 0, miss: 0 });
    setDisplayTime(0);
    startRef.current = performance.now();
    setIsPlaying(true);
  }, []);

  const resume = useCallback(() => {
    startRef.current = performance.now() - gameTimeRef.current * 1000;
    setIsPlaying(true);
  }, []);

  const beginPractice = useCallback(async () => {
    if (metronomeOn) await prepareMetronome();
    if (accompanimentOn) await prepareAccompaniment();
    if (micOn) await startMicrophone();
    start();
  }, [accompanimentOn, metronomeOn, micOn, prepareAccompaniment, prepareMetronome, start, startMicrophone]);

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
      const elapsed = (now - startRef.current) / 1000;
      gameTimeRef.current = elapsed;

      const playbackBeat = elapsed / beatDurationSec;
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
          const pitchJudgment = micOn ? judgePitch(detectedSample, targetFrequency) : 'Miss';
          const scheduledPlaybackBeat = playbackPosition.loopIndex * practiceWindow.segmentBeats + (note.beat - practiceWindow.startBeat);
          const scheduledTime = startRef.current + scheduledPlaybackBeat * beatDurationSec * 1000;
          const onsetSample = micOn ? lastOnsetSampleRef.current : null;
          const onsetMatchesNote = Boolean(
            onsetSample
            && Math.abs(onsetSample.capturedAt - scheduledTime) <= beatDurationSec * 1000
            && targetFrequency
            && Math.abs(centsFromTarget(onsetSample.frequency, targetFrequency)) <= 80,
          );
          const timingDifferenceMs = onsetMatchesNote && onsetSample
            ? Math.round(onsetSample.capturedAt - scheduledTime)
            : null;
          const stabilityCents = detectedSample ? detectedSample.stabilityCents : null;
          const fb = adjustJudgment(pitchJudgment, timingDifferenceMs, stabilityCents);
          noteResultsRef.current.push({
            loopIndex: playbackPosition.loopIndex,
            beat: note.beat,
            measure: Math.floor(note.beat / 4) + 1,
            noteNumber: note.number,
            hole: note.hole,
            breath: note.type,
            judgment: fb,
            centsDifference: detectedSample && targetFrequency ? Math.round(centsFromTarget(detectedSample.frequency, targetFrequency)) : null,
            detectedNote: detectedSample?.note ?? null,
            timingDifferenceMs,
            stabilityCents,
          });
          const pts = SCORE_TABLE[fb];
          scoreRef.current += pts;
          if (fb !== 'Miss' && fb !== 'Bad') {
            comboRef.current += 1;
          } else {
            comboRef.current = 0;
          }
          if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
          const key = fb.toLowerCase() as keyof typeof countsRef.current;
          countsRef.current[key] = (countsRef.current[key] || 0) + 1;

          setScore(scoreRef.current);
          setCombo(comboRef.current);
          setCounts({ ...countsRef.current });
          setFeedback(fb);
          setFeedbackKey((k) => k + 1);
        }
      });

      // End of song
      if (playbackBeat >= practiceWindow.totalPlaybackBeats) {
        setIsPlaying(false);
        const total = practiceNotes.length * practiceWindow.repeatCount;
        const perfect = countsRef.current.perfect;
        const great = countsRef.current.great;
        const good = countsRef.current.good;
        const accuracy = total > 0 ? Math.round(((perfect + great * 0.9 + good * 0.7) / total) * 100) : 0;
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
          noteResults: [...noteResultsRef.current],
        });
        return;
      }

      setDisplayTime(elapsed);
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [accompanimentOn, isPlaying, beatDurationSec, metronomeOn, micOn, noteFrequencies, onFinish, playAccompanimentBeat, practiceNotes, practiceWindow, settings.accompaniment, tickMetronome]);

  // Derived display values
  const playbackBeatFloat = displayTime / beatDurationSec;
  const playbackPosition = getPlaybackPosition(playbackBeatFloat, practiceWindow.startBeat, practiceWindow.segmentBeats, practiceWindow.repeatCount);
  const currentBeatFloat = playbackPosition.chartBeat;
  const currentBeatInt = Math.floor(currentBeatFloat);
  const currentMeasure = Math.floor(currentBeatInt / 4);
  const beatInMeasure = currentBeatInt % 4;

  // Find the nearest upcoming/current note
  const upcomingNote = practiceNotes.find(
    (n) => n.beat >= currentBeatInt && n.beat <= currentBeatInt + 1
  ) ?? [...practiceNotes].reverse().find((n) => n.beat <= currentBeatInt);

  const activeHole = upcomingNote?.hole ?? 4;
  const activeType = upcomingNote?.type ?? 'blow';
  const activeTechnique = upcomingNote?.technique ?? 'natural';
  const targetHz = upcomingNote ? (noteFrequencies[upcomingNote.number] ?? 330) : 0;
  const targetMidi = upcomingNote ? (noteNames[upcomingNote.number] ?? 'E4') : '--';
  const microphoneActive = micOn && microphoneStatus === 'listening';
  const hasPitch = microphoneActive && Boolean(pitchSample);
  const tuningDev = hasPitch && pitchSample ? Math.round(centsFromTarget(pitchSample.frequency, targetHz)) : 0;
  const confidence = hasPitch && pitchSample ? pitchSample.confidence : 0;
  const tuningPosition = Math.max(-30, Math.min(30, tuningDev));
  const microphoneError = ['denied', 'no-device', 'unsupported', 'error'].includes(microphoneStatus);

  // Score card measures
  const m1 = scoreMeasures[currentMeasure % scoreMeasures.length] ?? scoreMeasures[0];
  const m2 = scoreMeasures[(currentMeasure + 1) % scoreMeasures.length] ?? scoreMeasures[0];

  // Accuracy
  const totalScored = counts.perfect + counts.great + counts.good + counts.bad + counts.miss;
  const accuracy = totalScored > 0 ? Math.round(((counts.perfect + counts.great * 0.9 + counts.good * 0.7) / totalScored) * 100) : 100;

  // Visible notes for rendering
  const visibleNotes = practiceNotes.filter((n) => {
    const btu = n.beat - currentBeatFloat;
    return btu >= -0.8 && btu <= lookAheadBeats + 0.5;
  });

  const trackW = gameFieldW / NUM_TRACKS;
  const noteR = 21; // note radius

  const progressPct = Math.min(100, (playbackBeatFloat / practiceWindow.totalPlaybackBeats) * 100);
  const rangeLabel = settings.practiceRange === 'full'
    ? '整曲'
    : settings.practiceRange === 'firstHalf'
      ? 'A 段'
      : settings.practiceRange === 'secondHalf'
        ? 'B 段'
        : `第${practiceWindow.startMeasure + 1}-${practiceWindow.endMeasure}节`;

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

      {/* Top bar */}
      <div
        style={{
          height: 50,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          flexShrink: 0,
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="返回练习设置"
          style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <ArrowLeft size={16} color="#E2EAF8" />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#E2EAF8', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {song.title}
          </div>
          <div style={{ color: '#6B80A8', fontSize: 10 }}>{song.key}调 · {effectiveBpm} BPM · {rangeLabel} ×{settings.repeatCount}</div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ color: '#00C9B1', fontSize: 16, fontWeight: 700 }}>{score.toLocaleString()}</div>
          <div style={{ color: '#6B80A8', fontSize: 10 }}>准确率 {accuracy}%</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,#00C9B1,#0099A0)', transition: 'width 0.3s linear' }} />
      </div>

      {/* Score card – traditional notation */}
      <div
        style={{
          height: 68,
          padding: '6px 12px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 12,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Current measure */}
          {m1.map((beat, i) => (
            <div
              key={`m1-${i}`}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '2px 2px',
                borderRadius: 6,
                background: isPlaying && i === beatInMeasure ? '#FFE4F0' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700, color: isPlaying && i === beatInMeasure ? '#FF6B9D' : beat.t === 'rest' ? '#C0C8D8' : '#1a1a2e', lineHeight: 1.1 }}>
                {beat.n}
              </span>
              <span style={{ fontSize: 8, color: beat.t === 'blow' ? '#00C9B1' : beat.t === 'draw' ? '#FF6B9D' : 'transparent', lineHeight: 1 }}>
                {beat.t === 'blow' ? '↑吹' : beat.t === 'draw' ? '↓吸' : '·'}
              </span>
            </div>
          ))}

          {/* Measure bar */}
          <div style={{ width: 1.5, height: 36, background: '#CBD5E1', flexShrink: 0, margin: '0 4px' }} />

          {/* Next measure (dimmed) */}
          {m2.map((beat, i) => (
            <div key={`m2-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 2px' }}>
              <span style={{ fontSize: 16, fontWeight: 400, color: '#9AAAB8', lineHeight: 1.1 }}>{beat.n}</span>
              <span style={{ fontSize: 8, color: beat.t === 'blow' ? 'rgba(0,201,177,0.4)' : beat.t === 'draw' ? 'rgba(255,107,157,0.4)' : 'transparent', lineHeight: 1 }}>
                {beat.t === 'blow' ? '↑' : beat.t === 'draw' ? '↓' : '·'}
              </span>
            </div>
          ))}

          {/* Measure number */}
          <div style={{ width: 24, textAlign: 'center', flexShrink: 0, marginLeft: 2 }}>
            <span style={{ fontSize: 9, color: '#9AAAB8' }}>第{currentMeasure + 1}节</span>
          </div>
        </div>

        {/* Combo */}
        {combo >= 5 && (
          <div style={{ marginLeft: 8, textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#F59E0B' }}>COMBO</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>{combo}</div>
          </div>
        )}
      </div>

      {/* ═══ GAME FIELD ═══ */}
      <div
        ref={gameFieldRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: '#070B14',
        }}
      >
        {/* Track backgrounds & dividers */}
        {Array.from({ length: NUM_TRACKS }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * trackW,
              width: trackW,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          />
        ))}

        {/* Note labels at top of each track */}
        {['1', '2', '3', '5', '6', '1̇', '2̇'].map((label, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 6,
              left: i * trackW,
              width: trackW,
              textAlign: 'center',
              fontSize: 10,
              color: 'rgba(255,255,255,0.18)',
              fontWeight: 600,
            }}
          >
            {label}
          </div>
        ))}

        {/* Falling notes */}
        {visibleNotes.map((note) => {
          const btu = note.beat - currentBeatFloat;
          const noteY = judgmentY - btu * beatHeight;
          const trackCenterX = (note.track + 0.5) * trackW;
          const opacity = btu < 0 ? Math.max(0, 1 + btu * 2) : 1;
          const isAtJudge = Math.abs(btu) < 0.15;
          const blowColor = '#00C9B1';
          const drawColor = '#FF6B9D';
          const color = note.type === 'blow' ? blowColor : drawColor;
          const scale = isAtJudge ? 1.12 : 1;

          return (
            <div
              key={`${note.beat}-${note.track}`}
              style={{
                position: 'absolute',
                left: trackCenterX - noteR,
                top: noteY - noteR,
                width: noteR * 2,
                height: noteR * 2,
                borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${color}ff, ${color}bb)`,
                border: `2px solid ${color}`,
                boxShadow: `0 0 ${isAtJudge ? 18 : 8}px ${color}${isAtJudge ? 'cc' : '66'}`,
                opacity,
                transform: `scale(${scale})`,
                transition: 'box-shadow 0.1s, transform 0.1s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1, letterSpacing: '-0.5px' }}>
                {note.number}
              </span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.8)', lineHeight: 1 }}>
                {note.type === 'blow' ? '↑' : '↓'}
              </span>
            </div>
          );
        })}

        {/* Judgment line */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: judgmentY,
            height: 2,
            background: 'rgba(255,107,157,0.6)',
            boxShadow: '0 0 16px rgba(255,107,157,0.5), 0 0 4px rgba(255,107,157,0.8)',
          }}
        />

        {/* Judgment line markers at each track */}
        {Array.from({ length: NUM_TRACKS }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: judgmentY - 14,
              left: (i + 0.5) * trackW - 14,
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '1.5px solid rgba(255,107,157,0.3)',
              background: 'rgba(255,107,157,0.05)',
            }}
          />
        ))}

        {/* Feedback popup */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedbackKey}
              initial={{ opacity: 0, y: 16, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: '50%',
                top: judgmentY - 44,
                transform: 'translateX(-50%)',
                padding: '4px 18px',
                borderRadius: 20,
                background: `${FEEDBACK_COLORS[feedback]}22`,
                border: `1.5px solid ${FEEDBACK_COLORS[feedback]}88`,
                color: FEEDBACK_COLORS[feedback],
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '1px',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: `0 4px 20px ${FEEDBACK_COLORS[feedback]}44`,
              }}
            >
              {feedback === 'Perfect' ? '完美！' : feedback === 'Great' ? '太棒！' : feedback === 'Good' ? '不错' : feedback === 'Bad' ? '一般' : '未命中'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start overlay */}
        {!isPlaying && displayTime === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(7,11,20,0.85)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
            }}
          >
            <button
              type="button"
              onClick={() => void beginPractice()}
              aria-label="开始练习"
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                background: 'linear-gradient(135deg,#00C9B1,#0099A0)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 40px rgba(0,201,177,0.5)',
              }}
            >
              <Play size={30} color="#051015" fill="#051015" />
            </button>
            <div style={{ color: '#6B80A8', fontSize: 11, textAlign: 'center', padding: '0 24px' }}>
              {microphoneStatus === 'requesting' || microphoneStatus === 'calibrating'
                ? `${microphoneMessage}${microphoneStatus === 'calibrating' ? ` ${calibrationProgress}%` : ''}`
                : isFallbackChart
                ? '该曲目的专属谱面仍在制作，当前使用 C 调基础练习谱'
                : micOn
                  ? '开始后将请求麦克风权限，用真实音高进行判定'
                  : '麦克风已关闭，本次练习将记录为未命中'}
            </div>
          </div>
        )}

        {microphoneError && micOn && (
          <button
            type="button"
            onClick={() => void startMicrophone()}
            style={{ position: 'absolute', top: 32, left: 20, right: 20, zIndex: 10, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(127,29,29,0.9)', color: '#FECACA', borderRadius: 12, padding: '9px 12px', fontSize: 11, cursor: 'pointer' }}
          >
            {microphoneMessage} · 点击重试
          </button>
        )}
      </div>

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
        <HarmonicaStrip activeHole={activeHole} activeType={activeType} harmonicaType={chart.harmonicaType} />
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
        </div>
        <span style={{ color: '#4A5A78', fontSize: 10 }}>→</span>
        <span style={{ color: '#A8BCD8', fontSize: 11, fontWeight: 600, minWidth: 24 }}>
          {hasPitch && pitchSample ? pitchSample.note : targetMidi}
        </span>
        <span style={{ color: '#4A5A78', fontSize: 10 }}>→</span>
        {/* Tuning bar */}
        <div style={{ flex: 1, position: 'relative', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.2)' }} />
          {hasPitch && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                height: '100%',
                width: 6,
                borderRadius: 3,
                background: Math.abs(tuningDev) < 8 ? '#00C9B1' : '#FF6B9D',
                left: `calc(50% + ${tuningPosition}px)`,
                transform: 'translateX(-50%)',
                transition: 'left 0.2s',
              }}
            />
          )}
          {!hasPitch && microphoneActive && (
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${inputLevel}%`, maxWidth: '100%', borderRadius: 3, background: inputLevel <= noiseFloor ? '#4A5A78' : '#60A5FA', transition: 'width 0.1s' }} />
          )}
        </div>
        <span style={{ color: tuningDev > 0 ? '#F59E0B' : tuningDev < 0 ? '#F59E0B' : '#22C55E', fontSize: 10, minWidth: 28, textAlign: 'right' }}>
          {hasPitch ? `${tuningDev > 0 ? '+' : ''}${tuningDev}¢` : '0¢'}
        </span>
        <span style={{ color: '#6B80A8', fontSize: 10, minWidth: 36 }}>
          {hasPitch ? `${confidence}%` : microphoneActive ? `${inputLevel}%` : '--'}
        </span>
      </div>

      {/* ═══ CONTROLS ═══ */}
      <div
        style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 20px',
          background: '#0A0E1A',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        {/* Retry */}
        <button
          type="button"
          onClick={() => { setIsPlaying(false); window.setTimeout(() => void beginPractice(), 100); }}
          aria-label="重新开始"
          style={{ width: 40, height: 40, borderRadius: 20, background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RotateCcw size={17} color="#A8BCD8" />
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={() => {
            if (!isPlaying && displayTime === 0) { void beginPractice(); }
            else if (isPlaying) { setIsPlaying(false); }
            else { resume(); }
          }}
          aria-label={isPlaying ? '暂停练习' : '继续练习'}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: 'linear-gradient(135deg,#00C9B1,#0099A0)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,201,177,0.4)',
          }}
        >
          {isPlaying ? <Pause size={22} color="#051015" fill="#051015" /> : <Play size={22} color="#051015" fill="#051015" />}
        </button>

        {/* Mic */}
        <button
          type="button"
          onClick={() => void toggleMicrophone()}
          aria-label={micOn ? '关闭麦克风音高识别' : '开启麦克风音高识别'}
          aria-pressed={micOn}
          style={{ width: 40, height: 40, borderRadius: 20, background: micOn ? 'rgba(0,201,177,0.12)' : 'rgba(255,255,255,0.07)', border: '1px solid', borderColor: micOn ? 'rgba(0,201,177,0.3)' : 'rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {micOn ? <Mic size={17} color="#00C9B1" /> : <MicOff size={17} color="#6B80A8" />}
        </button>

        {/* Speaker */}
        <button
          type="button"
          onClick={() => setMetronomeOn((value) => { const next = !value; if (next) void prepareMetronome(); return next; })}
          aria-label={metronomeOn ? '关闭节拍器' : '开启节拍器'}
          aria-pressed={metronomeOn}
          style={{ width: 40, height: 40, borderRadius: 20, background: metronomeOn ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${metronomeOn ? 'rgba(245,158,11,0.3)' : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <TimerReset size={17} color={metronomeOn ? '#F59E0B' : '#A8BCD8'} />
        </button>

        {/* Accompaniment */}
        <button
          type="button"
          onClick={() => setAccompanimentOn((value) => { const next = !value; if (next) void prepareAccompaniment(); return next; })}
          disabled={settings.accompaniment === 'none'}
          aria-label={accompanimentOn ? '关闭练习伴奏' : '开启练习伴奏'}
          aria-pressed={accompanimentOn}
          style={{ width: 40, height: 40, borderRadius: 20, background: accompanimentOn ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${accompanimentOn ? 'rgba(96,165,250,0.3)' : 'transparent'}`, cursor: settings.accompaniment === 'none' ? 'not-allowed' : 'pointer', opacity: settings.accompaniment === 'none' ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {accompanimentOn ? <Volume2 size={17} color="#60A5FA" /> : <VolumeX size={17} color="#A8BCD8" />}
        </button>
      </div>

      {/* Bottom safe area */}
      <div style={{ height: 20, background: '#0A0E1A', flexShrink: 0 }} />
    </div>
  );
}
