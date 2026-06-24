import { useState } from 'react';
import { Search, Music2, Clock, ChevronRight, Star, Sliders, UserRound, RotateCcw, GraduationCap } from 'lucide-react';
import type { AuthUser, PracticeHistoryEntry, Song } from '../types';

interface Props {
  songs: Song[];
  history: PracticeHistoryEntry[];
  user: AuthUser | null;
  onAccount: () => void;
  onLearning: () => void;
  onCalibrate?: () => void;
  onSelect: (song: Song) => void;
}

const GENRES = ['全部', '流行', '经典', '民谣', '动漫', '古典', '轻音乐'];
const HARP_TYPES = ['全部', '十孔', '半音阶'];

const DIFF_LABEL = ['', '初级', '中级', '高级'];
const DIFF_COLOR = ['', '#22C55E', '#F59E0B', '#EF4444'];

function formatPracticeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '最近';
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

function DiffDots({ level }: { level: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3].map((d) => (
        <div
          key={d}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: d <= level ? DIFF_COLOR[level] : 'rgba(255,255,255,0.15)',
          }}
        />
      ))}
    </div>
  );
}

function SongCard({ song, onSelect }: { song: Song; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${song.title}，${song.artist}，${DIFF_LABEL[song.difficulty]}`}
      style={{
        width: '100%',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '14px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {/* Cover */}
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${song.color}, ${song.color2})`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 16px ${song.color}55`,
        }}
      >
        <Music2 size={24} color="rgba(255,255,255,0.85)" />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ color: '#E2EAF8', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>
            {song.title}
          </span>
          <DiffDots level={song.difficulty} />
        </div>
        <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 7 }}>{song.artist}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(0,201,177,0.12)', color: '#00C9B1', fontSize: 10, padding: '2px 7px', borderRadius: 20, border: '1px solid rgba(0,201,177,0.2)' }}>
            {song.key}调
          </span>
          <span style={{ background: 'rgba(255,255,255,0.06)', color: '#A8BCD8', fontSize: 10, padding: '2px 7px', borderRadius: 20 }}>
            {song.bpm} BPM
          </span>
          <span style={{
            background: song.harmonicaType === 'diatonic' ? 'rgba(168,85,247,0.12)' : 'rgba(249,115,22,0.12)',
            color: song.harmonicaType === 'diatonic' ? '#C084FC' : '#FB923C',
            fontSize: 10, padding: '2px 7px', borderRadius: 20,
            border: `1px solid ${song.harmonicaType === 'diatonic' ? 'rgba(168,85,247,0.2)' : 'rgba(249,115,22,0.2)'}`,
          }}>
            {song.harmonicaType === 'diatonic' ? '十孔' : '半音阶'}
          </span>
        </div>
      </div>

      <ChevronRight size={16} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0 }} />
    </button>
  );
}

export function HomePage({ songs, history, user, onAccount, onLearning, onCalibrate, onSelect }: Props) {
  const [genre, setGenre] = useState('全部');
  const [harpType, setHarpType] = useState('全部');
  const [search, setSearch] = useState('');

  const filtered = songs.filter((s) => {
    const matchGenre = genre === '全部' || s.genre === genre;
    const matchType =
      harpType === '全部' ||
      (harpType === '十孔' && s.harmonicaType === 'diatonic') ||
      (harpType === '半音阶' && s.harmonicaType === 'chromatic');
    const query = search.trim().toLocaleLowerCase('zh-CN');
    const matchSearch =
      !search ||
      s.title.toLocaleLowerCase('zh-CN').includes(query) ||
      s.artist.toLocaleLowerCase('zh-CN').includes(query) ||
      s.key.toLocaleLowerCase('zh-CN').includes(query);
    return matchGenre && matchType && matchSearch;
  });
  const recent = history.slice(0, 6).map((entry) => ({
    ...entry,
    song: songs.find((song) => song.id === entry.songId),
  })).filter((entry): entry is typeof entry & { song: Song } => Boolean(entry.song));
  const resetFilters = () => {
    setSearch('');
    setGenre('全部');
    setHarpType('全部');
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
      {/* Header */}
      <div style={{ paddingTop: 52, paddingLeft: 20, paddingRight: 20, paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ color: '#6B80A8', fontSize: 12, marginBottom: 2 }}>探索曲库</div>
            <h1 style={{ color: '#E2EAF8', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>练习曲目</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onCalibrate && (
              <button type="button" onClick={onCalibrate} aria-label="打开口琴校准" style={{ width: 40, height: 40, borderRadius: 20, border: '1px solid rgba(0,201,177,0.18)', background: 'rgba(0,201,177,0.09)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Sliders size={18} color="#00C9B1" /></button>
            )}
            <button type="button" onClick={onLearning} aria-label="打开学习中心" style={{ width: 40, height: 40, borderRadius: 20, border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.055)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><GraduationCap size={18} color="#A8BCD8" /></button>
            <button type="button" onClick={onAccount} aria-label={user ? `打开${user.nickname}的账户设置` : '打开游客账户设置'} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: 'linear-gradient(135deg,#00C9B1,#0891B2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#051015', fontWeight: 850 }}>
              {user ? user.nickname.slice(0, 1).toUpperCase() : <UserRound size={18} />}
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} color="#6B80A8" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索歌曲、歌手..."
            aria-label="搜索歌曲或歌手"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '10px 12px 10px 36px',
              color: '#E2EAF8',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Harp type toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {HARP_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setHarpType(t)}
              aria-pressed={harpType === t}
              style={{
                padding: '5px 14px',
                borderRadius: 20,
                border: '1px solid',
                borderColor: harpType === t ? '#00C9B1' : 'rgba(255,255,255,0.1)',
                background: harpType === t ? 'rgba(0,201,177,0.15)' : 'transparent',
                color: harpType === t ? '#00C9B1' : '#6B80A8',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#6B80A8', fontSize: 12 }}>
            <Sliders size={12} />
            <span>筛选</span>
          </div>
        </div>

        {/* Genre tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {GENRES.map((g) => (
            <button
              type="button"
              key={g}
              onClick={() => setGenre(g)}
              aria-pressed={genre === g}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: 'none',
                background: genre === g ? '#00C9B1' : 'rgba(255,255,255,0.06)',
                color: genre === g ? '#051015' : '#A8BCD8',
                fontSize: 13,
                fontWeight: genre === g ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Practice */}
      <div style={{ padding: '16px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Clock size={13} color="#6B80A8" />
          <span style={{ color: '#6B80A8', fontSize: 12 }}>最近练习</span>
        </div>
        {recent.length > 0 ? (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4 }}>
          {recent.map((entry) => (
            <button
              type="button"
              key={entry.id}
              onClick={() => onSelect(entry.song)}
              style={{
                flexShrink: 0,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                padding: '10px 12px',
                width: 120,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{ color: '#E2EAF8', fontSize: 12, fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.song.title}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
                <Star size={10} color="#F59E0B" fill="#F59E0B" />
                <span style={{ color: '#F59E0B', fontSize: 10 }}>{entry.accuracy}%</span>
              </div>
              <div style={{ color: '#00C9B1', fontSize: 11, fontWeight: 600 }}>{entry.score.toLocaleString()}</div>
              <div style={{ color: '#4A5A78', fontSize: 10, marginTop: 2 }}>{formatPracticeDate(entry.practicedAt)}</div>
            </button>
          ))}
          </div>
        ) : (
          <div style={{ color: '#4A5A78', fontSize: 11, padding: '2px 0 6px' }}>完成一次练习后，成绩会保存在这里。</div>
        )}
      </div>

      {/* Song list */}
      <div style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#A8BCD8', fontSize: 13, fontWeight: 600 }}>
            {filtered.length} 首歌曲
          </span>
          <span style={{ color: '#6B80A8', fontSize: 12 }}>按难度排序</span>
        </div>
        {filtered.map((song) => (
          <SongCard key={song.id} song={song} onSelect={() => onSelect(song)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '36px 20px', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16 }}>
            <Music2 size={26} color="#4A5A78" style={{ margin: '0 auto 10px' }} />
            <div style={{ color: '#A8BCD8', fontSize: 13, marginBottom: 12 }}>没有找到匹配的曲目</div>
            <button type="button" onClick={resetFilters} style={{ border: 'none', background: 'rgba(0,201,177,0.12)', color: '#00C9B1', borderRadius: 20, padding: '7px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <RotateCcw size={13} /> 重置筛选
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
