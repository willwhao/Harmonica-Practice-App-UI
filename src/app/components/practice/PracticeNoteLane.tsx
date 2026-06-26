import type { RefObject } from 'react';
import { Play } from 'lucide-react';
import type { PracticeNote } from '../../data/practiceCharts';
import type { NoteJudgment } from '../../types';
import { getFallingNoteGeometry } from '../../../engine/scoreLayout';

const FEEDBACK_COLORS: Record<NoteJudgment, string> = {
  Perfect: '#A855F7',
  Great: '#22C55E',
  Good: '#60A5FA',
  Bad: '#FBCFE8',
  Miss: '#6B7280',
};

const FEEDBACK_LABELS: Record<NoteJudgment, string> = {
  Perfect: '完美！',
  Great: '太棒！',
  Good: '不错',
  Bad: '一般',
  Miss: '未命中',
};

function formatDurationBeats(durationBeats: number) {
  if (durationBeats === 0.5) return '半拍';
  if (Number.isInteger(durationBeats)) return `${durationBeats}拍`;
  return `${durationBeats.toFixed(1).replace(/\.0$/, '')}拍`;
}

interface PracticeNoteLaneProps {
  gameFieldRef: RefObject<HTMLDivElement | null>;
  trackCount: number;
  trackWidth: number;
  noteWidth: number;
  visibleNotes: PracticeNote[];
  currentBeatFloat: number;
  judgmentY: number;
  beatHeight: number;
  activeHole: number;
  activeType: 'blow' | 'draw';
  feedback: NoteJudgment | null;
  feedbackKey: number;
  isPlaying: boolean;
  displayTime: number;
  microphoneStatus: string;
  microphoneMessage: string;
  calibrationProgress: number;
  isFallbackChart: boolean;
  micOn: boolean;
  microphoneError: boolean;
  onBeginPractice: () => void;
  onRetryMicrophone: () => void;
}

export function PracticeNoteLane({
  gameFieldRef,
  trackCount,
  trackWidth,
  noteWidth,
  visibleNotes,
  currentBeatFloat,
  judgmentY,
  beatHeight,
  activeHole,
  activeType,
  feedback,
  feedbackKey,
  isPlaying,
  displayTime,
  microphoneStatus,
  microphoneMessage,
  calibrationProgress,
  isFallbackChart,
  micOn,
  microphoneError,
  onBeginPractice,
  onRetryMicrophone,
}: PracticeNoteLaneProps) {
  return (
    <div
      ref={gameFieldRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(180deg,#080D18 0%,#050914 100%)',
      }}
    >
      {Array.from({ length: trackCount }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: i * trackWidth,
            width: trackWidth,
            background: i + 1 === activeHole
              ? `linear-gradient(180deg, ${activeType === 'blow' ? 'rgba(0,201,177,0.13)' : 'rgba(255,107,157,0.13)'} 0%, rgba(255,255,255,0.015) 100%)`
              : i % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(255,255,255,0.005)',
            borderLeft: i > 0 ? '1px solid rgba(148,163,184,0.08)' : 'none',
            boxShadow: i + 1 === activeHole ? `inset 0 0 24px ${activeType === 'blow' ? 'rgba(0,201,177,0.1)' : 'rgba(255,107,157,0.1)'}` : 'none',
          }}
        />
      ))}

      {Array.from({ length: trackCount }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: 6,
            left: i * trackWidth,
            width: trackWidth,
            textAlign: 'center',
            fontSize: 10,
            color: 'rgba(148,163,184,0.34)',
            fontWeight: 750,
          }}
        >
          {i + 1}
        </div>
      ))}

      {visibleNotes.map((note, noteIndex) => {
        const beatsUntilNote = note.beat - currentBeatFloat;
        const { startY: noteY, durationHeight, centerX: trackCenterX } = getFallingNoteGeometry({
          note,
          currentBeat: currentBeatFloat,
          judgmentY,
          beatHeight,
          trackWidth,
        });
        const opacity = beatsUntilNote < 0 ? Math.max(0, 1 + beatsUntilNote * 2) : 1;
        const isAtJudge = Math.abs(beatsUntilNote) < 0.15;
        const color = note.type === 'blow' ? '#00C9B1' : '#FF6B9D';
        const nextSameLane = visibleNotes
          .slice(noteIndex + 1)
          .find((item) => item.hole === note.hole && item.beat > note.beat);
        const maxHeightBeforeNext = nextSameLane
          ? Math.max(24, (nextSameLane.beat - note.beat) * beatHeight - 8)
          : durationHeight;
        const visualHeight = Math.min(durationHeight, maxHeightBeforeNext);
        const compact = visualHeight < 44;

        return (
          <div
            key={`${note.beat}-${note.track}`}
            style={{
              position: 'absolute',
              left: trackCenterX - noteWidth / 2,
              top: noteY - visualHeight,
              width: noteWidth,
              height: visualHeight,
              borderRadius: 0,
              background: `linear-gradient(180deg, ${color}44 0%, ${color}dd 38%, ${color}ff 100%)`,
              border: `1px solid ${color}`,
              borderTop: `3px solid ${color}`,
              borderBottom: `3px solid ${color}`,
              boxShadow: `0 0 ${isAtJudge ? 22 : 10}px ${color}${isAtJudge ? 'cc' : '66'}, inset 0 8px 12px rgba(255,255,255,0.14), inset 0 -8px 12px rgba(0,0,0,0.14)`,
              opacity,
              transform: `scaleX(${isAtJudge ? 1.04 : 1})`,
              transition: 'box-shadow 0.1s, transform 0.1s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: compact ? 13 : 15, fontWeight: 850, color: 'white', lineHeight: 1, letterSpacing: '-0.5px', textShadow: '0 1px 4px rgba(0,0,0,0.24)' }}>
              {note.number}
            </span>
            <span style={{ fontSize: compact ? 8 : 10, color: 'rgba(255,255,255,0.9)', lineHeight: 1, marginTop: compact ? 1 : 3 }}>
              {note.type === 'blow' ? '↑' : '↓'}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.78)', lineHeight: 1, marginTop: 2 }}>
              {formatDurationBeats(note.durationBeats)}
            </span>
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: judgmentY,
          height: 2,
          background: 'rgba(255,107,157,0.55)',
          boxShadow: '0 0 18px rgba(255,107,157,0.5), 0 0 4px rgba(255,107,157,0.8)',
        }}
      />

      {Array.from({ length: trackCount }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: judgmentY - 14,
            left: (i + 0.5) * trackWidth - 14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '1.4px solid rgba(255,107,157,0.34)',
            background: 'rgba(255,107,157,0.045)',
            boxShadow: 'inset 0 0 10px rgba(255,107,157,0.08)',
          }}
        />
      ))}

      {feedback && (
        <div
          key={feedbackKey}
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
          {FEEDBACK_LABELS[feedback]}
        </div>
      )}

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
            onClick={onBeginPractice}
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
                ? '该曲目的专属谱面仍在制作，当前使用 C 调基础练习谱。'
                : micOn
                  ? '开始后将请求麦克风权限，用真实音高进行判定'
                  : '麦克风已关闭，本次练习将记录为未命中'}
          </div>
        </div>
      )}

      {microphoneError && micOn && (
        <button
          type="button"
          onClick={onRetryMicrophone}
          style={{
            position: 'absolute',
            top: 32,
            left: 20,
            right: 20,
            zIndex: 10,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(127,29,29,0.9)',
            color: '#FECACA',
            borderRadius: 12,
            padding: '9px 12px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          {microphoneMessage} · 点击重试
        </button>
      )}
    </div>
  );
}
