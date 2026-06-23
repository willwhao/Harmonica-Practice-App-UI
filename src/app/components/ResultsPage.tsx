import { useRef, useState } from 'react';
import { AlertTriangle, BookmarkPlus, Share2, RotateCcw, Home, CheckCircle, PlayCircle } from 'lucide-react';
import { motion } from 'motion/react';
import type { GameResults, Song } from '../types';
import { getWeakestMeasure, summarizeTimingAndStability } from '../practice/practiceInsights';

interface Props {
  results: GameResults;
  song: Song;
  onBookmarkWeakMeasure: (measure: number) => void;
  onRetry: () => void;
  onHome: () => void;
}

function getRank(score: number, accuracy: number): { label: string; color: string; bg: string } {
  if (accuracy >= 95 && score >= 3000) return { label: 'S', color: '#A855F7', bg: 'rgba(168,85,247,0.15)' };
  if (accuracy >= 88) return { label: 'A', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' };
  if (accuracy >= 75) return { label: 'B', color: '#60A5FA', bg: 'rgba(96,165,250,0.12)' };
  if (accuracy >= 60) return { label: 'C', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' };
  return { label: 'D', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
}

function CircleProgress({ value, color }: { value: number; color: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={104} height={104} viewBox="0 0 104 104">
      <circle cx={52} cy={52} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
      <circle
        cx={52}
        cy={52}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 52 52)"
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
      <text x={52} y={50} textAnchor="middle" fill={color} fontSize={18} fontWeight={800}>{value}%</text>
      <text x={52} y={64} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9}>准确率</text>
    </svg>
  );
}

const JUDGMENT_LABEL: Record<string, { label: string; color: string }> = {
  perfect: { label: '完美', color: '#A855F7' },
  great:   { label: '太棒', color: '#22C55E' },
  good:    { label: '不错', color: '#60A5FA' },
  bad:     { label: '一般', color: '#FBCFE8' },
  miss:    { label: '未命中', color: '#6B7280' },
};

export function ResultsPage({ results, song, onBookmarkWeakMeasure, onRetry, onHome }: Props) {
  const [shareStatus, setShareStatus] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rank = getRank(results.score, results.accuracy);
  const totalHit = results.perfect + results.great + results.good;
  const completionPct = Math.round((totalHit / results.total) * 100);
  const weakestMeasure = getWeakestMeasure(results.noteResults ?? []);
  const errorNotes = (results.noteResults ?? []).filter((item) => item.judgment === 'Bad' || item.judgment === 'Miss').slice(0, 8);
  const performanceDimensions = summarizeTimingAndStability(results.noteResults ?? []);
  const seekRecording = (startMs: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = startMs / 1000;
    void audio.play();
  };
  const shareResult = async () => {
    const text = `我在《${song.title}》口琴练习中获得 ${results.score.toLocaleString()} 分，准确率 ${results.accuracy}%！`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '口琴练习成绩', text });
        setShareStatus('已打开分享');
      } else {
        await navigator.clipboard.writeText(text);
        setShareStatus('成绩已复制');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('暂时无法分享');
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0A0E1A',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Hero gradient */}
      <div
        style={{
          height: 200,
          background: `linear-gradient(160deg, ${song.color}cc 0%, ${song.color2}88 50%, #0A0E1A 100%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 0 20px',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div style={{ position: 'absolute', top: 52, left: 16 }}>
          <button
            type="button"
            onClick={onHome}
            aria-label="返回曲库"
            style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Home size={16} color="white" />
          </button>
        </div>

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: rank.bg,
            border: `3px solid ${rank.color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 40px ${rank.color}66`,
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 42, fontWeight: 900, color: rank.color }}>{rank.label}</span>
        </motion.div>

        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{song.title} · 演奏完成</div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'center', padding: '20px 0 10px', flexShrink: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 4 }}>最终得分</div>
          <div style={{ color: '#E2EAF8', fontSize: 42, fontWeight: 800, letterSpacing: '-1px' }}>
            {results.score.toLocaleString()}
          </div>
        </motion.div>
      </div>

      {/* Stats row */}
      <div style={{ padding: '10px 20px', display: 'flex', justifyContent: 'center', gap: 16, flexShrink: 0 }}>
        <CircleProgress value={results.accuracy} color="#00C9B1" />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <div>
            <div style={{ color: '#6B80A8', fontSize: 11 }}>最高连击</div>
            <div style={{ color: '#F59E0B', fontSize: 22, fontWeight: 800 }}>{results.maxCombo}x</div>
          </div>
          <div>
            <div style={{ color: '#6B80A8', fontSize: 11 }}>完成度</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 80, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${completionPct}%`, background: 'linear-gradient(90deg,#00C9B1,#0099A0)', borderRadius: 3 }} />
              </div>
              <span style={{ color: '#00C9B1', fontSize: 12, fontWeight: 700 }}>{completionPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Judgment breakdown */}
      <div style={{ padding: '12px 20px', flexShrink: 0 }}>
        <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 10 }}>判定明细</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(['perfect', 'great', 'good', 'bad', 'miss'] as const).map((k) => {
            const { label, color } = JUDGMENT_LABEL[k];
            const count = results[k];
            const pct = results.total > 0 ? Math.round((count / results.total) * 100) : 0;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, fontSize: 11, color, fontWeight: 700, flexShrink: 0 }}>{label}</div>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ delay: 0.3 + ['perfect','great','good','bad','miss'].indexOf(k) * 0.05, duration: 0.5 }}
                    style={{ height: '100%', background: color, borderRadius: 3, opacity: 0.85 }}
                  />
                </div>
                <div style={{ width: 28, textAlign: 'right', color, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note-level review */}
      <div style={{ padding: '6px 20px 14px', flexShrink: 0 }}>
        <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 10 }}>演奏维度</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            {
              label: '节奏偏差',
              value: performanceDimensions.averageTimingDeviationMs === null ? '--' : `${performanceDimensions.averageTimingDeviationMs}ms`,
              detail: `早 ${performanceDimensions.earlyNotes} · 晚 ${performanceDimensions.lateNotes}`,
              color: '#60A5FA',
            },
            {
              label: '音高稳定度',
              value: performanceDimensions.averageStabilityCents === null ? '--' : `${performanceDimensions.averageStabilityCents}¢`,
              detail: '越小越稳定',
              color: '#00C9B1',
            },
            {
              label: '输入质量',
              value: results.noteResults?.some((item) => item.timingDifferenceMs !== null) ? '有效' : '待校准',
              detail: '基于起音样本',
              color: '#F59E0B',
            },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 8px', borderRadius: 11, background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <div style={{ color: '#6B80A8', fontSize: 9 }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: 16, fontWeight: 800, margin: '4px 0 2px' }}>{item.value}</div>
              <div style={{ color: '#607391', fontSize: 8 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {results.recordingUrl && (
        <div style={{ padding: '6px 20px 14px', flexShrink: 0 }}>
          <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 10 }}>录音回放与错音定位</div>
          <div style={{ border: '1px solid rgba(0,201,177,0.16)', background: 'rgba(0,201,177,0.055)', borderRadius: 14, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ color: '#D8FFF8', fontSize: 12, fontWeight: 750 }}>本次练习录音</div>
                <div style={{ color: '#6B80A8', fontSize: 10, marginTop: 2 }}>
                  {results.recordingDurationMs ? `${Math.round(results.recordingDurationMs / 1000)} 秒` : '临时回放'} · 仅保存在当前页面
                </div>
              </div>
              <PlayCircle size={22} color="#00C9B1" />
            </div>
            <audio ref={audioRef} src={results.recordingUrl} controls style={{ width: '100%', height: 36 }} />
            {results.errorSegments && results.errorSegments.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.errorSegments.map((segment) => (
                  <button
                    type="button"
                    key={segment.id}
                    onClick={() => seekRecording(segment.startMs)}
                    style={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      color: '#A8BCD8',
                      borderRadius: 10,
                      padding: '8px 10px',
                      display: 'grid',
                      gridTemplateColumns: '54px 1fr',
                      gap: 8,
                      alignItems: 'center',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ color: '#00C9B1', fontSize: 10, fontWeight: 800 }}>{(segment.startMs / 1000).toFixed(1)}s</span>
                    <span>
                      <span style={{ display: 'block', color: '#E2EAF8', fontSize: 10, fontWeight: 700 }}>{segment.label}</span>
                      <span style={{ display: 'block', color: '#6B80A8', fontSize: 9, marginTop: 2 }}>{segment.reason}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '6px 20px 14px', flexShrink: 0 }}>
        <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 10 }}>音符复盘</div>
        {weakestMeasure ? (
          <>
            <button type="button" onClick={() => onBookmarkWeakMeasure(weakestMeasure.measure)} style={{ width: '100%', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.07)', borderRadius: 13, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', marginBottom: 8 }}>
              <AlertTriangle size={17} color="#F59E0B" />
              <div style={{ flex: 1 }}><div style={{ color: '#FBCB75', fontSize: 11 }}>最需巩固：第 {weakestMeasure.measure} 小节</div><div style={{ color: '#6B80A8', fontSize: 9, marginTop: 2 }}>{weakestMeasure.errors}/{weakestMeasure.total} 个明显错误{weakestMeasure.averageCents !== null ? ` · 平均偏差 ${weakestMeasure.averageCents}¢` : ''}</div></div>
              <BookmarkPlus size={16} color="#F59E0B" />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {errorNotes.map((item, index) => (
                <div key={`${item.loopIndex}-${item.beat}-${index}`} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: 'rgba(255,255,255,0.035)' }}>
                  <span style={{ color: '#6B80A8', fontSize: 9 }}>第{item.measure}节</span>
                  <span style={{ color: '#A8BCD8', fontSize: 10 }}>{item.noteNumber} · {item.hole}孔{item.breath === 'blow' ? '吹' : '吸'}{item.detectedNote ? ` → ${item.detectedNote}` : ' · 未识别'}</span>
                  <span style={{ color: item.judgment === 'Miss' ? '#6B7280' : '#FBCFE8', fontSize: 9 }}>{item.centsDifference === null ? item.judgment : `${item.centsDifference > 0 ? '+' : ''}${item.centsDifference}¢`}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ padding: 12, borderRadius: 12, background: 'rgba(34,197,94,0.07)', color: '#86EFAC', fontSize: 11 }}>本次没有明显错音，继续保持！</div>
        )}
      </div>

      {/* Track stars */}
      <div style={{ padding: '8px 20px 16px', flexShrink: 0 }}>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle size={20} color="#22C55E" />
          <div>
            <div style={{ color: '#E2EAF8', fontSize: 13, fontWeight: 600 }}>
              {results.accuracy >= 90 ? '演奏非常出色！' : results.accuracy >= 75 ? '继续加油练习！' : '基础很好，坚持练习！'}
            </div>
            <div style={{ color: '#6B80A8', fontSize: 11 }}>
              命中 {totalHit}/{results.total} 个音符 · 准确率 {results.accuracy}%
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ padding: '4px 20px 40px', display: 'flex', gap: 10, flexShrink: 0 }}>
        {/* Share */}
        <button
          type="button"
          onClick={shareResult}
          style={{
            height: 50,
            flex: 0,
            paddingLeft: 20,
            paddingRight: 20,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: '#A8BCD8',
            fontSize: 14,
          }}
        >
          <Share2 size={16} />
          {shareStatus || '分享'}
        </button>

        {/* Retry */}
        <button
          type="button"
          onClick={onRetry}
          style={{
            height: 50,
            flex: 1,
            borderRadius: 14,
            border: 'none',
            background: 'rgba(255,255,255,0.08)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: '#E2EAF8',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <RotateCcw size={16} />
          再练一次
        </button>

        {/* Home */}
        <button
          type="button"
          onClick={onHome}
          style={{
            height: 50,
            flex: 1,
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg,#00C9B1,#0099A0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            color: '#051015',
            fontSize: 14,
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(0,201,177,0.3)',
          }}
        >
          <Home size={16} />
          曲库
        </button>
      </div>
    </div>
  );
}
