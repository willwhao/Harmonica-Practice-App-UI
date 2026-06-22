import { useState, type ReactNode } from 'react';
import { ArrowLeft, CloudOff, Download, LogOut, Save, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import type { AuthUser, UserPreferences } from '../types';

interface Props {
  user: AuthUser | null;
  historyCount: number;
  onBack: () => void;
  onSave: (user: AuthUser) => void;
  onLogout: () => void;
  onCreateAccount: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function AccountPage({ user, historyCount, onBack, onSave, onLogout, onCreateAccount, onDelete, onExport }: Props) {
  const [nickname, setNickname] = useState(user?.nickname ?? '游客');
  const [preferences, setPreferences] = useState<UserPreferences>(user?.preferences ?? { defaultHarmonica: 'diatonic', dailyGoalMinutes: 15, skillLevel: 'beginner' });
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!user) return;
    onSave({ ...user, nickname: nickname.trim() || user.nickname, preferences });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0A0E1A', padding: '52px 20px 40px' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onBack} aria-label="返回曲库" style={iconButtonStyle}><ArrowLeft size={17} /></button>
        <div style={{ color: '#E2EAF8', fontSize: 18, fontWeight: 750 }}>账户与设置</div>
      </div>

      <div style={{ marginTop: 18, padding: 18, borderRadius: 18, background: 'linear-gradient(135deg,rgba(0,201,177,0.14),rgba(8,145,178,0.06))', border: '1px solid rgba(0,201,177,0.18)', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, background: 'linear-gradient(135deg,#00C9B1,#0891B2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#051015', fontSize: 21, fontWeight: 900 }}>
          {user ? user.nickname.slice(0, 1).toUpperCase() : <UserRound size={24} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#E2EAF8', fontSize: 16, fontWeight: 700 }}>{user?.nickname ?? '游客用户'}</div>
          <div style={{ color: '#6B80A8', fontSize: 11, marginTop: 3 }}>{user?.email ?? '练习记录仅保存在当前浏览器'}</div>
          <div style={{ color: '#00C9B1', fontSize: 10, marginTop: 5 }}>{historyCount} 条练习记录</div>
        </div>
      </div>

      {!user ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ color: '#A8BCD8', fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>创建本地账户后，现有游客练习记录会自动迁移到你的账户空间。</div>
          <button type="button" onClick={onCreateAccount} style={primaryButtonStyle}>注册或登录</button>
        </div>
      ) : (
        <>
          <Section title="个人资料">
            <FieldLabel label="昵称"><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={24} style={inputStyle} /></FieldLabel>
          </Section>

          <Section title="练习偏好">
            <FieldLabel label="默认口琴">
              <select value={preferences.defaultHarmonica} onChange={(event) => setPreferences({ ...preferences, defaultHarmonica: event.target.value as UserPreferences['defaultHarmonica'] })} style={inputStyle}>
                <option value="diatonic">十孔口琴</option><option value="chromatic">半音阶口琴</option>
              </select>
            </FieldLabel>
            <FieldLabel label="当前水平">
              <select value={preferences.skillLevel} onChange={(event) => setPreferences({ ...preferences, skillLevel: event.target.value as UserPreferences['skillLevel'] })} style={inputStyle}>
                <option value="beginner">初学者</option><option value="intermediate">中级</option><option value="advanced">进阶</option>
              </select>
            </FieldLabel>
            <FieldLabel label={`每日目标 · ${preferences.dailyGoalMinutes} 分钟`}>
              <input type="range" min={5} max={60} step={5} value={preferences.dailyGoalMinutes} onChange={(event) => setPreferences({ ...preferences, dailyGoalMinutes: Number(event.target.value) })} style={{ width: '100%', accentColor: '#00C9B1' }} />
            </FieldLabel>
            <button type="button" onClick={save} style={primaryButtonStyle}><Save size={15} /> {saved ? '已保存' : '保存设置'}</button>
          </Section>

          <Section title="数据与会话">
            <InfoRow icon={<CloudOff size={17} />} title="云同步尚未连接" detail="当前账户和记录仅保存在本机" />
            <button type="button" onClick={onExport} style={secondaryButtonStyle}><Download size={15} /> 导出我的数据</button>
            <button type="button" onClick={onLogout} style={secondaryButtonStyle}><LogOut size={15} /> 退出登录</button>
            <button type="button" onClick={() => { if (window.confirm('确定删除本地账户及其账户练习记录吗？此操作无法撤销。')) onDelete(); }} style={{ ...secondaryButtonStyle, color: '#FCA5A5', borderColor: 'rgba(239,68,68,0.2)' }}><Trash2 size={15} /> 删除本地账户</button>
          </Section>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, color: '#4A5A78', fontSize: 10, lineHeight: 1.55, marginTop: 22 }}><ShieldCheck size={16} style={{ flexShrink: 0 }} />本地账户用于验证产品流程，不等同于正式云端身份系统。</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section style={{ marginTop: 22 }}><h2 style={{ color: '#6B80A8', fontSize: 11, fontWeight: 600, margin: '0 0 10px' }}>{title}</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div></section>;
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ color: '#A8BCD8', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>{label}{children}</label>;
}

function InfoRow({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', gap: 10, color: '#6B80A8' }}>{icon}<div><div style={{ color: '#A8BCD8', fontSize: 12 }}>{title}</div><div style={{ fontSize: 10, marginTop: 2 }}>{detail}</div></div></div>;
}

const iconButtonStyle = { width: 34, height: 34, borderRadius: 17, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#E2EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
const inputStyle = { width: '100%', height: 42, borderRadius: 11, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.05)', color: '#E2EAF8', padding: '0 12px', outline: 'none' } as const;
const primaryButtonStyle = { width: '100%', height: 46, border: 'none', borderRadius: 13, background: 'linear-gradient(135deg,#00C9B1,#0099A0)', color: '#051015', fontWeight: 750, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' } as const;
const secondaryButtonStyle = { width: '100%', height: 44, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', color: '#A8BCD8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' } as const;
