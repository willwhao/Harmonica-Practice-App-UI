import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Mic, RotateCcw, Save, SlidersHorizontal } from 'lucide-react';
import type { Song } from '../types';
import { centsFromTarget } from '../audio/pitchDetection';
import { usePitchDetection } from '../hooks/usePitchDetection';
import { getPracticeChart } from '../data/practiceCharts';
import {
  buildCalibrationSample,
  buildCalibrationTargets,
  createPitchProfile,
  formatPitchOffset,
  savePitchProfile,
  type PersonalPitchProfile,
  type PitchProfileCalibrationSample,
} from '../practice/pitchProfile';

interface Props {
  song: Song;
  userId?: string;
  onBack: () => void;
  onComplete: (profile: PersonalPitchProfile) => void;
}

const BREATH_TEXT = {
  blow: '吹气',
  draw: '吸气',
} as const;

function getCentsColor(cents: number | null) {
  if (cents === null) return '#6B80A8';
  const absolute = Math.abs(cents);
  if (absolute <= 20) return '#00C9B1';
  if (absolute <= 60) return '#F59E0B';
  return '#FF6B9D';
}

export function CalibrationPage({ song, userId, onBack, onComplete }: Props) {
  const chart = getPracticeChart(song.id).chart;
  const targets = useMemo(() => buildCalibrationTargets(chart, 4), [chart]);
  const [samples, setSamples] = useState<PitchProfileCalibrationSample[]>([]);
  const [profile, setProfile] = useState<PersonalPitchProfile | null>(null);
  const [error, setError] = useState('');
  const activeTarget = targets[Math.min(samples.length, Math.max(0, targets.length - 1))];
  const progress = targets.length ? Math.round(samples.length / targets.length * 100) : 0;
  const {
    status,
    sample,
    message,
    inputLevel,
    calibrationProgress,
    start,
    stop,
  } = usePitchDetection();
  const activeCents = sample && activeTarget
    ? Math.round(centsFromTarget(sample.frequency, activeTarget.targetFrequency))
    : null;
  const isListening = status === 'listening';
  const canCapture = Boolean(
    activeTarget
    && sample
    && activeCents !== null
    && Math.abs(activeCents) <= 160
    && sample.confidence >= 55
    && sample.stabilityCents <= 70,
  );

  const captureSample = () => {
    if (!activeTarget || !sample || activeCents === null) return;
    const nextSample = buildCalibrationSample(activeTarget, sample.frequency, sample.confidence);
    const nextSamples = [...samples, nextSample];
    setSamples(nextSamples);
    setError('');

    if (nextSamples.length >= targets.length) {
      try {
        const nextProfile = createPitchProfile({
          userId,
          harmonicaType: chart.harmonicaType,
          key: chart.key,
          samples: nextSamples,
        });
        savePitchProfile(nextProfile, userId);
        setProfile(nextProfile);
        stop();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : '校准样本不可用，请重新记录。');
      }
    }
  };

  const restart = () => {
    setSamples([]);
    setProfile(null);
    setError('');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0A0E1A', padding: '52px 20px 40px' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onBack} aria-label="返回练习设置" style={iconButtonStyle}><ArrowLeft size={17} /></button>
        <div>
          <div style={{ color: '#E2EAF8', fontSize: 18, fontWeight: 800 }}>口琴校准向导</div>
          <div style={{ color: '#6B80A8', fontSize: 10, marginTop: 2 }}>{song.title} · {chart.key} 调 · {chart.harmonicaType === 'diatonic' ? '十孔口琴' : '半音阶口琴'}</div>
        </div>
      </div>

      <section style={{ marginTop: 18, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,rgba(0,201,177,0.14),rgba(8,145,178,0.06))', border: '1px solid rgba(0,201,177,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(0,201,177,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SlidersHorizontal size={21} color="#00C9B1" />
          </div>
          <div>
            <div style={{ color: '#E2EAF8', fontSize: 14, fontWeight: 800 }}>建立个人音高校准表</div>
            <div style={{ color: '#8EA4C6', fontSize: 10, lineHeight: 1.55, marginTop: 3 }}>记录几枚稳定音，练习判定会自动抵消这支口琴、麦克风和吹奏习惯带来的整体偏差。</div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: '#6B80A8', fontSize: 11 }}>校准进度</span>
          <span style={{ color: '#00C9B1', fontSize: 11, fontWeight: 800 }}>{samples.length}/{targets.length}</span>
        </div>
        <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#00C9B1,#0891B2)', transition: 'width 0.2s' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, targets.length)}, minmax(0, 1fr))`, gap: 7, marginTop: 11 }}>
          {targets.map((target, index) => {
            const done = index < samples.length;
            const active = index === samples.length && !profile;
            return (
              <div key={target.id} style={{ padding: '8px 7px', borderRadius: 11, border: `1px solid ${done ? 'rgba(0,201,177,0.25)' : active ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.07)'}`, background: done ? 'rgba(0,201,177,0.08)' : active ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.035)', textAlign: 'center' }}>
                <div style={{ color: done ? '#00C9B1' : active ? '#F59E0B' : '#6B80A8', fontSize: 12, fontWeight: 800 }}>{target.noteNumber}</div>
                <div style={{ color: '#6B80A8', fontSize: 8, marginTop: 2 }}>孔 {target.hole}</div>
              </div>
            );
          })}
        </div>
      </section>

      {!profile && activeTarget && (
        <section style={{ marginTop: 18, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ color: '#6B80A8', fontSize: 11, marginBottom: 8 }}>当前目标</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div>
              <div style={{ color: '#E2EAF8', fontSize: 26, fontWeight: 900 }}>{activeTarget.noteNumber}</div>
              <div style={{ color: '#A8BCD8', fontSize: 12, marginTop: 2 }}>{activeTarget.targetNote} · 第 {activeTarget.hole} 孔{BREATH_TEXT[activeTarget.breath]}</div>
              <div style={{ color: '#6B80A8', fontSize: 10, marginTop: 7, lineHeight: 1.5 }}>{activeTarget.instruction}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: getCentsColor(activeCents), fontSize: 24, fontWeight: 900 }}>
                {activeCents === null ? '--' : formatPitchOffset(activeCents)}
              </div>
              <div style={{ color: '#6B80A8', fontSize: 9, marginTop: 4 }}>当前偏差</div>
            </div>
          </div>

          <div style={{ marginTop: 14, padding: 12, borderRadius: 13, background: 'rgba(10,14,26,0.72)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div>
                <div style={{ color: isListening ? '#00C9B1' : '#A8BCD8', fontSize: 12, fontWeight: 800 }}>{message}</div>
                <div style={{ color: '#6B80A8', fontSize: 9, marginTop: 3 }}>
                  {status === 'calibrating' ? `环境校准 ${calibrationProgress}%` : sample ? `${sample.note} · ${sample.frequency.toFixed(1)} Hz · 置信度 ${sample.confidence}%` : `输入电平 ${inputLevel}%`}
                </div>
              </div>
              <div style={{ width: 44, height: 44, borderRadius: 16, background: isListening ? 'rgba(0,201,177,0.14)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mic size={20} color={isListening ? '#00C9B1' : '#A8BCD8'} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            <button type="button" onClick={() => void start()} style={secondaryButtonStyle}>
              <Mic size={15} /> {status === 'idle' ? '开启麦克风' : '重新检测'}
            </button>
            <button type="button" onClick={captureSample} disabled={!canCapture} style={{ ...primaryButtonStyle, opacity: canCapture ? 1 : 0.45, cursor: canCapture ? 'pointer' : 'not-allowed' }}>
              <CheckCircle2 size={15} /> 记录当前音
            </button>
          </div>
          {!canCapture && isListening && (
            <div style={{ color: '#F59E0B', fontSize: 10, lineHeight: 1.5, marginTop: 9 }}>请保持单音稳定、靠近目标音后再记录；过远的音会被视为误吹。</div>
          )}
          {error && <div style={{ color: '#FCA5A5', fontSize: 10, lineHeight: 1.5, marginTop: 9 }}>{error}</div>}
        </section>
      )}

      {profile && (
        <section style={{ marginTop: 18, padding: 18, borderRadius: 18, background: 'rgba(0,201,177,0.08)', border: '1px solid rgba(0,201,177,0.22)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle2 size={24} color="#00C9B1" />
            <div>
              <div style={{ color: '#E2EAF8', fontSize: 15, fontWeight: 850 }}>校准完成</div>
              <div style={{ color: '#8EA4C6', fontSize: 10, marginTop: 3 }}>已保存 {profile.sampleCount} 个样本，整体偏移 {formatPitchOffset(profile.averageOffsetCents)}。</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
            <button type="button" onClick={restart} style={secondaryButtonStyle}><RotateCcw size={15} /> 重新校准</button>
            <button type="button" onClick={() => onComplete(profile)} style={primaryButtonStyle}><Save size={15} /> 应用并返回</button>
          </div>
        </section>
      )}

      <div style={{ color: '#4A5A78', fontSize: 10, lineHeight: 1.65, marginTop: 20 }}>
        小提示：这里保存的是本机浏览器里的个人 profile；换口琴、换麦克风或明显感觉判定偏紧时，可以重新校准。
      </div>
    </div>
  );
}

const iconButtonStyle = { width: 34, height: 34, borderRadius: 17, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#E2EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
const primaryButtonStyle = { flex: 1, height: 44, border: 'none', borderRadius: 13, background: 'linear-gradient(135deg,#00C9B1,#0099A0)', color: '#051015', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' } as const;
const secondaryButtonStyle = { flex: 1, height: 44, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: '#A8BCD8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' } as const;
