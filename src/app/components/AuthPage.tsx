import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, Music2, ShieldCheck, UserRound } from 'lucide-react';
import { loginLocalAccount, registerLocalAccount } from '../auth/authStore';
import { isCloudMode, loginCloudAccount, registerCloudAccount, requestCloudPasswordReset, resetCloudPassword } from '../cloud/cloudClient';
import type { AuthUser } from '../types';

interface Props {
  onAuthenticated: (user: AuthUser) => void;
  onGuest: () => void;
}

export function AuthPage({ onAuthenticated, onGuest }: Props) {
  const cloudMode = isCloudMode();
  const initialResetToken = new URLSearchParams(window.location.search).get('resetToken') ?? '';
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialResetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await requestCloudPasswordReset(email);
        setNotice(result.message);
        if (result.resetToken) {
          setResetToken(result.resetToken);
          setMode('reset');
        } else {
          setMode('login');
        }
        return;
      }
      if (mode === 'reset') {
        await resetCloudPassword(resetToken, password);
        setNotice('密码已更新，请使用新密码登录');
        setMode('login');
        setPassword('');
        return;
      }
      const user = cloudMode
        ? mode === 'register'
          ? await registerCloudAccount({ email, password, nickname })
          : await loginCloudAccount(email, password)
        : mode === 'register'
          ? await registerLocalAccount({ email, password, nickname })
          : await loginLocalAccount(email, password);
      onAuthenticated(user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setPassword('');
    setNotice('');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'radial-gradient(circle at 50% 12%, #12304A 0%, #0A0E1A 42%, #070A12 100%)', padding: '68px 24px 36px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ width: 68, height: 68, borderRadius: 22, background: 'linear-gradient(135deg,#00C9B1,#087F8C)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 40px rgba(0,201,177,0.28)', marginBottom: 14 }}>
          <Music2 size={30} color="#051015" />
        </div>
        <h1 style={{ color: '#E2EAF8', fontSize: 25, margin: 0, fontWeight: 800 }}>口琴练习室</h1>
        <p style={{ color: '#6B80A8', fontSize: 12, margin: '6px 0 0' }}>让每一次吹奏都有清晰反馈</p>
      </div>

      <div style={{ display: 'flex', padding: 4, borderRadius: 14, background: 'rgba(255,255,255,0.05)', marginBottom: 18 }}>
        {(['login', 'register'] as const).map((item) => (
          <button key={item} type="button" onClick={() => switchMode(item)} aria-pressed={mode === item} style={{ flex: 1, height: 38, border: 'none', borderRadius: 11, background: mode === item ? 'rgba(0,201,177,0.16)' : 'transparent', color: mode === item ? '#00C9B1' : '#6B80A8', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {item === 'login' ? '登录' : '注册'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'register' && (
          <label style={{ position: 'relative' }}>
            <UserRound size={16} color="#6B80A8" style={{ position: 'absolute', left: 14, top: 15 }} />
            <input value={nickname} onChange={(event) => setNickname(event.target.value)} autoComplete="nickname" placeholder="昵称" required minLength={2} style={inputStyle} />
          </label>
        )}
        {mode !== 'reset' && <label style={{ position: 'relative' }}>
          <Mail size={16} color="#6B80A8" style={{ position: 'absolute', left: 14, top: 15 }} />
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="邮箱地址" required style={inputStyle} />
        </label>}
        {mode === 'reset' && <label style={{ position: 'relative' }}>
          <LockKeyhole size={16} color="#6B80A8" style={{ position: 'absolute', left: 14, top: 15 }} />
          <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="密码重置令牌" required style={inputStyle} />
        </label>}
        {mode !== 'forgot' && <label style={{ position: 'relative' }}>
          <LockKeyhole size={16} color="#6B80A8" style={{ position: 'absolute', left: 14, top: 15 }} />
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? '密码（至少 8 个字符）' : mode === 'reset' ? '新密码（至少 8 个字符）' : '密码'} required minLength={8} style={{ ...inputStyle, paddingRight: 46 }} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'} style={{ position: 'absolute', right: 8, top: 7, width: 34, height: 34, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {showPassword ? <EyeOff size={16} color="#6B80A8" /> : <Eye size={16} color="#6B80A8" />}
          </button>
        </label>}

        {error && <div role="alert" style={{ color: '#FCA5A5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '9px 11px', fontSize: 11 }}>{error}</div>}
        {notice && <div role="status" style={{ color: '#86EFAC', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '9px 11px', fontSize: 11 }}>{notice}</div>}

        <button type="submit" disabled={loading} style={{ height: 50, border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#00C9B1,#0099A0)', color: '#051015', fontWeight: 800, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 2 }}>
          {loading ? '正在处理…' : mode === 'login' ? '登录并继续' : mode === 'register' ? (cloudMode ? '创建云端账户' : '创建本地账户') : mode === 'forgot' ? '发送重置邮件' : '更新密码'}
        </button>
      </form>

      {cloudMode && mode === 'login' && <button type="button" onClick={() => { setMode('forgot'); setError(''); setNotice(''); }} style={{ width: '100%', marginTop: 12, border: 'none', background: 'transparent', color: '#6B80A8', fontSize: 11, cursor: 'pointer' }}>忘记密码？</button>}
      {(mode === 'forgot' || mode === 'reset') && <button type="button" onClick={() => switchMode('login')} style={{ width: '100%', marginTop: 12, border: 'none', background: 'transparent', color: '#6B80A8', fontSize: 11, cursor: 'pointer' }}>返回登录</button>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' }}>
        <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ color: '#4A5A78', fontSize: 11 }}>或者</span>
        <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
      </div>

      <button type="button" onClick={onGuest} style={{ width: '100%', height: 46, borderRadius: 14, border: '1px solid rgba(255,255,255,0.11)', background: 'rgba(255,255,255,0.04)', color: '#A8BCD8', fontWeight: 600, cursor: 'pointer' }}>
        先以游客身份体验
      </button>

      <div style={{ display: 'flex', gap: 8, marginTop: 18, color: '#4A5A78', fontSize: 10, lineHeight: 1.55 }}>
        <ShieldCheck size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>{cloudMode ? '云端模式使用短时访问令牌和 HttpOnly 刷新 Cookie；密码仅以加盐 scrypt 哈希保存。' : '当前为离线本地账户模式：资料和加盐密码校验值仅保存在此浏览器。配置 VITE_API_URL 后可启用云同步。'}</span>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  height: 48,
  borderRadius: 13,
  border: '1px solid rgba(255,255,255,0.09)',
  background: 'rgba(255,255,255,0.055)',
  color: '#E2EAF8',
  padding: '0 14px 0 42px',
  outline: 'none',
  fontSize: 13,
} as const;
