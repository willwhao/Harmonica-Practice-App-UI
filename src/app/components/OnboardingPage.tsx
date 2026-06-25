import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Headphones, Mic, Music2, Play, ShieldCheck, Target } from 'lucide-react';
import type { UserPreferences } from '../types';
import {
  createOnboardingProfile,
  type OnboardingProfile,
  type PracticeGoal,
} from '../onboarding/onboardingProfile';

interface Props {
  initialPreferences?: UserPreferences;
  onComplete: (profile: OnboardingProfile) => void;
  onSkip: () => void;
}

const GOALS: { value: PracticeGoal; label: string; detail: string }[] = [
  { value: 'daily-habit', label: '养成每日练习', detail: '每天 10–20 分钟，稳定建立肌肉记忆。' },
  { value: 'intonation', label: '提升音准判定', detail: '更关注实时音高、校准和错音复练。' },
  { value: 'song-library', label: '学会完整曲目', detail: '从简单旋律开始，把分段练习串起来。' },
];

const SKILL_LEVELS: { value: UserPreferences['skillLevel']; label: string }[] = [
  { value: 'beginner', label: '初学者' },
  { value: 'intermediate', label: '中级' },
  { value: 'advanced', label: '进阶' },
];

export function OnboardingPage({ initialPreferences, onComplete, onSkip }: Props) {
  const [goal, setGoal] = useState<PracticeGoal>('daily-habit');
  const [defaultHarmonica, setDefaultHarmonica] = useState<UserPreferences['defaultHarmonica']>(initialPreferences?.defaultHarmonica ?? 'diatonic');
  const [skillLevel, setSkillLevel] = useState<UserPreferences['skillLevel']>(initialPreferences?.skillLevel ?? 'beginner');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(initialPreferences?.dailyGoalMinutes ?? 15);
  const [deviceChecklist, setDeviceChecklist] = useState<OnboardingProfile['deviceChecklist']>({
    quietRoom: false,
    micPermission: false,
    headphones: false,
  });
  const checkedCount = useMemo(() => Object.values(deviceChecklist).filter(Boolean).length, [deviceChecklist]);
  const readyForPractice = checkedCount >= 2;

  const complete = () => {
    onComplete(createOnboardingProfile({
      goal,
      defaultHarmonica,
      dailyGoalMinutes,
      skillLevel,
      deviceChecklist,
    }));
  };

  const toggleChecklist = (key: keyof OnboardingProfile['deviceChecklist']) => {
    setDeviceChecklist((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0A0E1A', padding: '52px 20px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 3 }}>欢迎开始</div>
          <h1 style={{ color: '#E2EAF8', fontSize: 24, lineHeight: 1.2, margin: 0 }}>三步设置你的练习方式</h1>
        </div>
        <button type="button" onClick={onSkip} style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#A8BCD8', borderRadius: 18, padding: '7px 11px', fontSize: 11, cursor: 'pointer' }}>跳过</button>
      </div>

      <section style={{ marginTop: 20, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,rgba(0,201,177,0.14),rgba(8,145,178,0.06))', border: '1px solid rgba(0,201,177,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Target size={18} color="#00C9B1" />
          <h2 style={{ color: '#E2EAF8', fontSize: 14, margin: 0 }}>1. 你的练习目标</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GOALS.map((item) => (
            <button
              type="button"
              key={item.value}
              onClick={() => setGoal(item.value)}
              aria-pressed={goal === item.value}
              style={{
                textAlign: 'left',
                border: `1px solid ${goal === item.value ? 'rgba(0,201,177,0.42)' : 'rgba(255,255,255,0.08)'}`,
                background: goal === item.value ? 'rgba(0,201,177,0.11)' : 'rgba(255,255,255,0.035)',
                borderRadius: 13,
                padding: '11px 12px',
                cursor: 'pointer',
              }}
            >
              <div style={{ color: goal === item.value ? '#00C9B1' : '#DCE8F8', fontSize: 12, fontWeight: 800 }}>{item.label}</div>
              <div style={{ color: '#7D8FAE', fontSize: 10, marginTop: 3, lineHeight: 1.45 }}>{item.detail}</div>
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 14, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Music2 size={18} color="#A855F7" />
          <h2 style={{ color: '#E2EAF8', fontSize: 14, margin: 0 }}>2. 口琴与水平</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { value: 'diatonic' as const, label: '十孔口琴', detail: '推荐新手' },
            { value: 'chromatic' as const, label: '半音阶', detail: '进阶曲目' },
          ].map((item) => (
            <button key={item.value} type="button" onClick={() => setDefaultHarmonica(item.value)} aria-pressed={defaultHarmonica === item.value} style={{ border: `1px solid ${defaultHarmonica === item.value ? 'rgba(168,85,247,0.45)' : 'rgba(255,255,255,0.08)'}`, background: defaultHarmonica === item.value ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.035)', borderRadius: 13, padding: '12px 10px', cursor: 'pointer' }}>
              <div style={{ color: defaultHarmonica === item.value ? '#C084FC' : '#DCE8F8', fontSize: 12, fontWeight: 800 }}>{item.label}</div>
              <div style={{ color: '#7D8FAE', fontSize: 9, marginTop: 3 }}>{item.detail}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
          {SKILL_LEVELS.map((item) => (
            <button key={item.value} type="button" onClick={() => setSkillLevel(item.value)} aria-pressed={skillLevel === item.value} style={{ flex: 1, border: `1px solid ${skillLevel === item.value ? 'rgba(0,201,177,0.35)' : 'rgba(255,255,255,0.08)'}`, background: skillLevel === item.value ? 'rgba(0,201,177,0.1)' : 'rgba(255,255,255,0.035)', color: skillLevel === item.value ? '#00C9B1' : '#A8BCD8', borderRadius: 11, padding: '9px 6px', fontSize: 11, fontWeight: 750, cursor: 'pointer' }}>
              {item.label}
            </button>
          ))}
        </div>
        <label style={{ display: 'block', color: '#A8BCD8', fontSize: 11 }}>
          每日目标 · {dailyGoalMinutes} 分钟
          <input type="range" min={5} max={60} step={5} value={dailyGoalMinutes} onChange={(event) => setDailyGoalMinutes(Number(event.target.value))} style={{ width: '100%', accentColor: '#00C9B1', marginTop: 8 }} />
        </label>
      </section>

      <section style={{ marginTop: 14, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Mic size={18} color="#F59E0B" />
          <h2 style={{ color: '#E2EAF8', fontSize: 14, margin: 0 }}>3. 麦克风与设备检查</h2>
        </div>
        <div style={{ color: '#8EA4C6', fontSize: 10, lineHeight: 1.6, padding: 11, borderRadius: 13, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.16)', marginBottom: 10 }}>
          麦克风只用于实时识别你的口琴音高；默认在本机浏览器内处理。开始练习后浏览器会请求权限，拒绝后仍可看谱练习，但不会计入真实音准。
        </div>
        <ChecklistItem checked={deviceChecklist.quietRoom} icon={<ShieldCheck size={15} />} label="我现在处在相对安静的环境" onClick={() => toggleChecklist('quietRoom')} />
        <ChecklistItem checked={deviceChecklist.micPermission} icon={<Mic size={15} />} label="我知道开始练习时需要允许麦克风" onClick={() => toggleChecklist('micPermission')} />
        <ChecklistItem checked={deviceChecklist.headphones} icon={<Headphones size={15} />} label="我会优先使用耳机或降低外放音量" onClick={() => toggleChecklist('headphones')} />
        <div style={{ color: readyForPractice ? '#00C9B1' : '#F59E0B', fontSize: 10, marginTop: 10 }}>
          {readyForPractice ? '检查完成，可以开始第一首练习。' : '建议至少确认 2 项，让第一次练习更稳。'}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button type="button" onClick={onSkip} style={{ flex: 1, height: 48, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, background: 'rgba(255,255,255,0.04)', color: '#A8BCD8', fontWeight: 750, cursor: 'pointer' }}>稍后再说</button>
        <button type="button" onClick={complete} style={{ flex: 2, height: 48, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#00C9B1,#0099A0)', color: '#051015', fontWeight: 850, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <Play size={16} fill="#051015" /> 完成引导
        </button>
      </div>
    </div>
  );
}

function ChecklistItem({ checked, icon, label, onClick }: { checked: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={checked} style={{ width: '100%', border: `1px solid ${checked ? 'rgba(0,201,177,0.26)' : 'rgba(255,255,255,0.08)'}`, background: checked ? 'rgba(0,201,177,0.08)' : 'rgba(255,255,255,0.035)', borderRadius: 12, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 9, color: checked ? '#00C9B1' : '#A8BCD8', fontSize: 11, cursor: 'pointer', marginTop: 7, textAlign: 'left' }}>
      {checked ? <CheckCircle2 size={15} /> : icon}
      <span>{label}</span>
    </button>
  );
}
