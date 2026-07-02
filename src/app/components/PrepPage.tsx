import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Music2, Play, Headphones, Volume2, TimerReset, UploadCloud, Sliders } from 'lucide-react';
import type { PracticeSettings, Song } from '../types';
import { getPracticeChart, type PracticeChart } from '../data/practiceCharts';
import { getPracticeAudioAssets } from '../audio/practiceAudioAssets';
import type { PracticeAudioAssetStatus } from '../audio/practiceAudioAssets';
import { transcribeAudioFile, type AudioTranscription } from '../audio/audioTranscription';
import { createPracticeChartFromTranscription } from '../audio/transcriptionChart';
import { buildReleaseConfig, isFeatureEnabled } from '../ops/releaseConfig';
import { formatPitchOffset, type PersonalPitchProfile } from '../practice/pitchProfile';

interface Props {
  song: Song;
  practiceChart?: PracticeChart;
  pitchProfile?: PersonalPitchProfile | null;
  onBack: () => void;
  onStart: (settings: PracticeSettings, importedChart?: PracticeChart) => void;
  onCalibrate?: () => void;
}

type Accompaniment = 'original' | 'simplified' | 'none';
type HarpType = 'diatonic' | 'chromatic';
type ScoreMode = 'dynamic' | 'traditional';
type PracticeRange = PracticeSettings['practiceRange'];
type RepeatChoice = '1' | '2' | '3';

const DIFF_TEXT = ['', '初级', '中级', '高级'];
const DIFF_COLOR = ['', '#22C55E', '#F59E0B', '#EF4444'];

const AUDIO_STATUS_TEXT: Record<PracticeAudioAssetStatus, string> = {
  available: '可用',
  'requires-license': '需授权',
  'license-expired': '授权过期',
  'cdn-missing': '待配置 CDN',
};

const AUDIO_STATUS_COLOR: Record<PracticeAudioAssetStatus, string> = {
  available: '#00C9B1',
  'requires-license': '#F59E0B',
  'license-expired': '#EF4444',
  'cdn-missing': '#60A5FA',
};

function getChartMeasureCount(chart: PracticeChart) {
  return chart.notation?.lines.reduce((count, line) => count + line.measures.length, 0) ?? chart.measures.length;
}

function OptionGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; sub?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {options.map((opt) => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 12,
              border: '1.5px solid',
              borderColor: value === opt.value ? '#00C9B1' : 'rgba(255,255,255,0.08)',
              background: value === opt.value ? 'rgba(0,201,177,0.12)' : 'rgba(255,255,255,0.03)',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <div style={{ color: value === opt.value ? '#00C9B1' : '#A8BCD8', fontSize: 13, fontWeight: 500 }}>
              {opt.label}
            </div>
            {opt.sub && (
              <div style={{ color: '#4A5A78', fontSize: 10, marginTop: 2 }}>{opt.sub}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeSlider({
  label,
  value,
  onChange,
  suffix = '%',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
        <span style={{ color: '#6B80A8', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#00C9B1', fontSize: 12, fontWeight: 700 }}>{value}{suffix}</span>
      </div>
      <div style={{ position: 'relative', height: 24, display: 'flex', alignItems: 'center' }}>
        <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
          <div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg,#00C9B1,#0891B2)', borderRadius: 2 }} />
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

export function PrepPage({ song, practiceChart, pitchProfile, onBack, onStart, onCalibrate }: Props) {
  const basePracticeChart = practiceChart ?? getPracticeChart(song.id).chart;
  const measureCount = getChartMeasureCount(basePracticeChart);
  const audioAssets = getPracticeAudioAssets(song);
  const releaseConfig = buildReleaseConfig();
  const audioUploadEnabled = isFeatureEnabled(releaseConfig, 'audioUploadTranscription');
  const [accompaniment, setAccompaniment] = useState<Accompaniment>('original');
  const [harpType, setHarpType] = useState<HarpType>(song.harmonicaType);
  const [scoreMode, setScoreMode] = useState<ScoreMode>('dynamic');
  const [speed, setSpeed] = useState(100);
  const [practiceRange, setPracticeRange] = useState<PracticeRange>('full');
  const [customStartMeasure, setCustomStartMeasure] = useState(0);
  const [customEndMeasure, setCustomEndMeasure] = useState(measureCount);
  const [repeatChoice, setRepeatChoice] = useState<RepeatChoice>('1');
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [accompanimentVolume, setAccompanimentVolume] = useState(70);
  const [metronomeVolume, setMetronomeVolume] = useState(65);
  const [demoVolume, setDemoVolume] = useState(55);
  const [transcription, setTranscription] = useState<AudioTranscription | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState('');
  const [audioPrivacyAccepted, setAudioPrivacyAccepted] = useState(false);
  useEffect(() => {
    setHarpType(song.harmonicaType);
    setCustomStartMeasure(0);
    setCustomEndMeasure(measureCount);
    setPracticeRange('full');
  }, [measureCount, song.harmonicaType, song.id]);
  const importedChart = useMemo(() => transcription ? createPracticeChartFromTranscription({
    song,
    transcription,
    harmonicaType: harpType,
  }) : null, [harpType, song, transcription]);
  const speedFill = ((speed - 50) / (120 - 50)) * 100;
  const buildSettings = (): PracticeSettings => ({
    accompaniment,
    harmonicaType: harpType,
    scoreMode,
    speed,
    accompanimentVolume,
    metronomeVolume,
    demoVolume,
    practiceRange,
    customStartMeasure,
    customEndMeasure,
    repeatCount: Number(repeatChoice) as 1 | 2 | 3,
    metronomeEnabled,
  });
  const handleAudioUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!audioPrivacyAccepted) {
      setTranscriptionStatus('请先确认音频仅在本机浏览器内处理，再选择文件。');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setTranscriptionStatus('音频文件过大，请先裁剪到 25MB 以内。');
      return;
    }
    setTranscription(null);
    setTranscriptionStatus(`正在识别《${file.name}》…`);
    try {
      const nextTranscription = await transcribeAudioFile(file, song.key);
      setTranscription(nextTranscription);
      const nextChart = createPracticeChartFromTranscription({ song, transcription: nextTranscription, harmonicaType: harpType });
      setTranscriptionStatus(nextTranscription.warning ?? (nextChart ? `已识别 ${nextTranscription.notes.length} 个音符，可生成临时练习谱` : '识别到音符，但未能生成有效练习谱，请尝试更清晰的独奏音频。'));
    } catch {
      setTranscriptionStatus('音频解码或识别失败，请尝试 MP3、WAV、M4A 等浏览器支持的格式。');
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0E1A',
        overflowY: 'auto',
      }}
    >
      {/* Hero cover */}
      <div
        style={{
          height: 280,
          background: `linear-gradient(160deg, ${song.color} 0%, ${song.color2} 60%, #0A0E1A 100%)`,
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          aria-label="返回曲库"
          style={{
            position: 'absolute',
            top: 52,
            left: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            background: 'rgba(0,0,0,0.35)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} color="white" />
        </button>

        {/* Cover center art */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 100,
            height: 100,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 16px 48px ${song.color}66`,
          }}
        >
          <Music2 size={44} color="rgba(255,255,255,0.8)" />
        </div>

        {/* Headphone / Speaker toggle */}
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 16,
            display: 'flex',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 20,
            padding: 4,
          }}
        >
          {[
            { Icon: Headphones, label: '耳机' },
            { Icon: Volume2, label: '外放' },
          ].map(({ Icon, label }, i) => (
            <div
              key={label}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                background: i === 0 ? 'rgba(255,255,255,0.15)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={15} color={i === 0 ? 'white' : 'rgba(255,255,255,0.5)'} />
            </div>
          ))}
        </div>
      </div>

      {/* Song info */}
      <div style={{ padding: '20px 20px 16px', flexShrink: 0 }}>
        <h2 style={{ color: '#E2EAF8', fontSize: 24, fontWeight: 700, marginBottom: 4, lineHeight: 1.2 }}>
          {song.title}
        </h2>
        <div style={{ color: '#6B80A8', fontSize: 13, marginBottom: 14 }}>{song.artist}</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'rgba(0,201,177,0.12)', border: '1px solid rgba(0,201,177,0.2)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ color: '#6B80A8', fontSize: 10, marginBottom: 1 }}>调性</div>
            <div style={{ color: '#00C9B1', fontSize: 15, fontWeight: 700 }}>{song.key} 调</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '6px 12px', textAlign: 'center' }}>
            <div style={{ color: '#6B80A8', fontSize: 10, marginBottom: 1 }}>速度</div>
            <div style={{ color: '#E2EAF8', fontSize: 15, fontWeight: 700 }}>{song.bpm} BPM</div>
          </div>
          <div style={{
            background: `rgba(${song.difficulty === 1 ? '34,197,94' : song.difficulty === 2 ? '245,158,11' : '239,68,68'},0.1)`,
            border: `1px solid rgba(${song.difficulty === 1 ? '34,197,94' : song.difficulty === 2 ? '245,158,11' : '239,68,68'},0.2)`,
            borderRadius: 10, padding: '6px 12px', textAlign: 'center',
          }}>
            <div style={{ color: '#6B80A8', fontSize: 10, marginBottom: 1 }}>难度</div>
            <div style={{ color: DIFF_COLOR[song.difficulty], fontSize: 15, fontWeight: 700 }}>{DIFF_TEXT[song.difficulty]}</div>
          </div>
        </div>
      </div>

      {/* Options */}
      <div style={{ padding: '0 20px', flex: 1 }}>
        <div style={{ marginBottom: 16, padding: 13, borderRadius: 14, background: pitchProfile ? 'rgba(0,201,177,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${pitchProfile ? 'rgba(0,201,177,0.16)' : 'rgba(245,158,11,0.15)'}`, display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 13, background: pitchProfile ? 'rgba(0,201,177,0.13)' : 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sliders size={18} color={pitchProfile ? '#00C9B1' : '#F59E0B'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#E2EAF8', fontSize: 12, fontWeight: 800 }}>音高校准</div>
            <div style={{ color: '#7D8FAE', fontSize: 10, lineHeight: 1.45, marginTop: 2 }}>
              {pitchProfile
                ? `已应用 ${pitchProfile.sampleCount} 个样本，整体偏移 ${formatPitchOffset(pitchProfile.averageOffsetCents)}`
                : '未建立个人校准表；可先校准再开始练习。'}
            </div>
          </div>
          {onCalibrate && (
            <button type="button" onClick={onCalibrate} style={{ border: 'none', borderRadius: 11, background: pitchProfile ? 'rgba(0,201,177,0.13)' : 'rgba(245,158,11,0.13)', color: pitchProfile ? '#00C9B1' : '#F59E0B', fontSize: 11, fontWeight: 800, padding: '9px 10px', cursor: 'pointer', flexShrink: 0 }}>
              {pitchProfile ? '重校' : '校准'}
            </button>
          )}
        </div>

        {/* Speed slider */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#6B80A8', fontSize: 12 }}>练习速度</span>
            <span style={{ color: '#00C9B1', fontSize: 13, fontWeight: 600 }}>{speed}%</span>
          </div>
          <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
            <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.08)', borderRadius: 2, position: 'relative' }}>
              <div style={{ height: '100%', width: `${speedFill}%`, background: 'linear-gradient(90deg,#00C9B1,#0891B2)', borderRadius: 2 }} />
            </div>
            <input
              type="range"
              min={50}
              max={120}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              aria-label="练习速度"
              aria-valuetext={`${speed}%（${Math.round(song.bpm * speed / 100)} BPM）`}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#4A5A78', fontSize: 10 }}>50%</span>
            <span style={{ color: '#4A5A78', fontSize: 10 }}>原速</span>
            <span style={{ color: '#4A5A78', fontSize: 10 }}>120%</span>
          </div>
        </div>

        <OptionGroup<PracticeRange>
          label="练习区间"
          options={[
            { value: 'full', label: '整曲', sub: '完整练习' },
            { value: 'firstHalf', label: '前半段', sub: 'A 段' },
            { value: 'secondHalf', label: '后半段', sub: 'B 段' },
            { value: 'custom', label: '自定义', sub: 'A-B' },
          ]}
          value={practiceRange}
          onChange={setPracticeRange}
        />

        {practiceRange === 'custom' && (
          <div style={{ margin: '-6px 0 16px', padding: 12, borderRadius: 12, background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.16)' }}>
            <div style={{ color: '#A8BCD8', fontSize: 11, marginBottom: 8 }}>自定义 A-B 小节</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ flex: 1, color: '#6B80A8', fontSize: 10 }}>起点 A
                <select value={customStartMeasure} onChange={(event) => { const next = Number(event.target.value); setCustomStartMeasure(next); if (customEndMeasure <= next) setCustomEndMeasure(Math.min(measureCount, next + 1)); }} style={selectStyle}>
                  {Array.from({ length: measureCount }, (_, index) => <option key={index} value={index}>第 {index + 1} 小节</option>)}
                </select>
              </label>
              <span style={{ color: '#A855F7', marginTop: 17 }}>→</span>
              <label style={{ flex: 1, color: '#6B80A8', fontSize: 10 }}>终点 B
                <select value={customEndMeasure} onChange={(event) => setCustomEndMeasure(Number(event.target.value))} style={selectStyle}>
                  {Array.from({ length: measureCount - customStartMeasure }, (_, index) => customStartMeasure + index + 1).map((value) => <option key={value} value={value}>第 {value} 小节末</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        <OptionGroup<RepeatChoice>
          label="区间重复"
          options={[
            { value: '1', label: '1 次', sub: '单遍' },
            { value: '2', label: '2 次', sub: '巩固' },
            { value: '3', label: '3 次', sub: '强化' },
          ]}
          value={repeatChoice}
          onChange={setRepeatChoice}
        />

        <button type="button" onClick={() => setMetronomeEnabled((value) => !value)} aria-pressed={metronomeEnabled} style={{ width: '100%', marginBottom: 16, padding: '11px 13px', borderRadius: 12, border: `1px solid ${metronomeEnabled ? 'rgba(0,201,177,0.35)' : 'rgba(255,255,255,0.08)'}`, background: metronomeEnabled ? 'rgba(0,201,177,0.1)' : 'rgba(255,255,255,0.03)', color: metronomeEnabled ? '#00C9B1' : '#A8BCD8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TimerReset size={16} />节拍器</span>
          <span style={{ fontSize: 11 }}>{metronomeEnabled ? '已开启' : '已关闭'}</span>
        </button>

        <OptionGroup<Accompaniment>
          label="伴奏选择"
          options={[
            { value: 'original', label: '练习和弦', sub: '合成' },
            { value: 'simplified', label: '简化根音', sub: '合成' },
            { value: 'none', label: '无伴奏', sub: '纯练习' },
          ]}
          value={accompaniment}
          onChange={setAccompaniment}
        />

        <div style={{ margin: '-2px 0 16px', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <RangeSlider label="伴奏音量" value={accompanimentVolume} onChange={setAccompanimentVolume} />
          <RangeSlider label="节拍器音量" value={metronomeVolume} onChange={setMetronomeVolume} />
          <RangeSlider label="示范音量" value={demoVolume} onChange={setDemoVolume} />
          <div style={{ color: '#607391', fontSize: 10, lineHeight: 1.5 }}>
            当前使用浏览器合成伴奏；原曲伴奏和教师示范音轨需取得授权资源后启用。
          </div>
        </div>

        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: '#6B80A8', fontSize: 12 }}>音频资源状态</div>
          {audioAssets.map((asset) => (
            <div key={asset.id} style={{ padding: '8px 10px', borderRadius: 10, background: asset.status === 'available' ? 'rgba(0,201,177,0.07)' : 'rgba(245,158,11,0.07)', border: `1px solid ${asset.status === 'available' ? 'rgba(0,201,177,0.15)' : 'rgba(245,158,11,0.14)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: '#E2EAF8', fontSize: 11, fontWeight: 700 }}>{asset.label}</span>
                <span style={{ color: AUDIO_STATUS_COLOR[asset.status], fontSize: 10, fontWeight: 700 }}>{AUDIO_STATUS_TEXT[asset.status]}</span>
              </div>
              <div style={{ color: '#607391', fontSize: 9, marginTop: 3 }}>{asset.source}{asset.rightsHolder ? ` · ${asset.rightsHolder}` : ''}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16, padding: 12, borderRadius: 14, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.16)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ color: '#E9D5FF', fontSize: 12, fontWeight: 800 }}>上传音频识别简谱</div>
              <div style={{ color: '#7D8FAE', fontSize: 10, marginTop: 2 }}>{audioUploadEnabled ? '支持 MP3/WAV/M4A；适合清晰口琴独奏或示范音轨' : `当前 ${releaseConfig.channel} 通道未开放该实验功能`}</div>
            </div>
            <UploadCloud size={20} color="#A855F7" />
          </div>
          {audioUploadEnabled ? (
            <>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#A8BCD8', fontSize: 10, lineHeight: 1.5, marginBottom: 9 }}>
                <input
                  type="checkbox"
                  checked={audioPrivacyAccepted}
                  onChange={(event) => setAudioPrivacyAccepted(event.target.checked)}
                  style={{ marginTop: 2, accentColor: '#A855F7' }}
                />
                我了解：上传音频只在本机浏览器内解码和识别，不会自动上传；识别结果为草稿，需要自行确认版权与准确性。
              </label>
              <label style={{ display: 'block', border: '1px dashed rgba(168,85,247,0.35)', borderRadius: 12, padding: '10px 12px', color: '#C4B5FD', fontSize: 11, textAlign: 'center', cursor: 'pointer', background: 'rgba(168,85,247,0.05)' }}>
                选择音频文件并生成简谱草稿
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/*"
                  onChange={(event) => void handleAudioUpload(event.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </>
          ) : (
            <div style={{ color: '#A8BCD8', fontSize: 10, lineHeight: 1.55, border: '1px dashed rgba(168,85,247,0.25)', borderRadius: 12, padding: '10px 12px', background: 'rgba(168,85,247,0.04)' }}>
              该功能仍处于实验阶段，正式发布通道默认关闭；可通过 `VITE_FEATURE_AUDIO_UPLOAD=true` 在预览环境或内部测试环境开启。
            </div>
          )}
          {transcriptionStatus && (
            <div style={{ color: transcription?.warning ? '#F59E0B' : '#A8BCD8', fontSize: 10, lineHeight: 1.5, marginTop: 8 }}>
              {transcriptionStatus}
            </div>
          )}
          {transcription && transcription.notes.length > 0 && (
            <div style={{ marginTop: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', padding: 10 }}>
              <div style={{ color: '#6B80A8', fontSize: 10, marginBottom: 5 }}>简谱草稿（{song.key} 调）</div>
              <div style={{ color: '#E2EAF8', fontSize: 18, fontWeight: 800, lineHeight: 1.6, wordBreak: 'break-word' }}>
                {transcription.jianpuLine}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginTop: 8, maxHeight: 126, overflowY: 'auto' }}>
                {transcription.notes.slice(0, 32).map((note, index) => (
                  <div key={`${note.startSec}-${index}`} style={{ padding: '6px 5px', borderRadius: 8, background: 'rgba(255,255,255,0.045)', textAlign: 'center' }}>
                    <div style={{ color: '#E2EAF8', fontSize: 13, fontWeight: 800 }}>{note.jianpu}</div>
                    <div style={{ color: '#7D8FAE', fontSize: 8, marginTop: 2 }}>{note.noteName} · {note.startSec.toFixed(1)}s</div>
                  </div>
                ))}
              </div>
              <div style={{ color: '#607391', fontSize: 9, marginTop: 8, lineHeight: 1.5 }}>
                这是自动识别草稿，复杂伴奏或人声会影响结果；后续可把草稿转成正式练习谱。
              </div>
              {importedChart && (
                <button
                  type="button"
                  onClick={() => onStart({ ...buildSettings(), practiceRange: 'full', customStartMeasure: 0, customEndMeasure: importedChart.measures.length }, importedChart)}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    border: 'none',
                    borderRadius: 11,
                    padding: '11px 12px',
                    background: 'linear-gradient(135deg,#A855F7,#7C3AED)',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  用识别草稿开始练习 · {importedChart.notes.length} 音
                </button>
              )}
            </div>
          )}
        </div>

        <OptionGroup<HarpType>
          label="口琴类型"
          options={[
            { value: 'diatonic', label: '十孔口琴', sub: '推荐' },
            { value: 'chromatic', label: '半音阶', sub: '进阶' },
          ]}
          value={harpType}
          onChange={setHarpType}
        />

        <OptionGroup<ScoreMode>
          label="乐谱模式"
          options={[
            { value: 'dynamic', label: '动态下落', sub: '游戏模式' },
            { value: 'traditional', label: '传统乐谱', sub: '跟谱模式' },
          ]}
          value={scoreMode}
          onChange={setScoreMode}
        />
      </div>

      {/* Start button */}
      <div style={{ padding: '16px 20px 40px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onStart(buildSettings())}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 16,
            border: 'none',
            background: `linear-gradient(135deg, #00C9B1, #0099A0)`,
            color: '#051015',
            fontSize: 17,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            boxShadow: '0 8px 32px rgba(0,201,177,0.35)',
          }}
        >
          <Play size={20} fill="#051015" />
          开始练习
        </button>
      </div>
    </div>
  );
}

const selectStyle = { width: '100%', height: 36, marginTop: 5, borderRadius: 9, border: '1px solid rgba(255,255,255,0.1)', background: '#141B2D', color: '#E2EAF8', padding: '0 8px', fontSize: 11 } as const;
