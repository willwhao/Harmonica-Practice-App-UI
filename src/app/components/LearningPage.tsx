import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Award, BarChart3, Bookmark, BookOpen, CalendarDays, ChevronRight, Clock3, Flame, Target, TrendingUp } from 'lucide-react';
import { LEARNING_TRACKS } from '../data/learningTracks';
import { entryMinutes, getLearningSummary, getWeeklyActivity } from '../learning/learningStats';
import { buildGrowthSummary } from '../growth/growthSystem';
import type { AuthUser, LearningTrackProgress, PracticeBookmark, PracticeHistoryEntry, Song } from '../types';

interface Props {
  user: AuthUser | null;
  songs: Song[];
  history: PracticeHistoryEntry[];
  bookmarks: PracticeBookmark[];
  learningProgress?: LearningTrackProgress[];
  onBack: () => void;
  onSelectSong: (song: Song) => void;
  onPracticeBookmark: (bookmark: PracticeBookmark) => void;
}

export function LearningPage({ user, songs, history, bookmarks, learningProgress = [], onBack, onSelectSong, onPracticeBookmark }: Props) {
  const [tab, setTab] = useState<'plan' | 'history'>('plan');
  const summary = useMemo(() => getLearningSummary(history), [history]);
  const week = useMemo(() => getWeeklyActivity(history), [history]);
  const dailyGoal = user?.preferences.dailyGoalMinutes ?? 15;
  const dailyProgress = Math.min(100, Math.round(summary.todayMinutes / dailyGoal * 100));
  const maxWeekMinutes = Math.max(1, ...week.map((day) => day.minutes));
  const growth = useMemo(() => buildGrowthSummary(history, bookmarks, learningProgress), [history, bookmarks, learningProgress]);
  const earnedBadges = growth.badges.filter((badge) => badge.earned);

  const weakSong = useMemo(() => {
    const averages = songs.map((song) => {
      const entries = history.filter((entry) => entry.songId === song.id);
      return { song, count: entries.length, average: entries.length ? entries.reduce((total, entry) => total + entry.accuracy, 0) / entries.length : 101 };
    });
    return averages.sort((a, b) => a.average - b.average || a.count - b.count)[0]?.song ?? songs[0];
  }, [history, songs]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0A0E1A', padding: '52px 20px 40px' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={onBack} aria-label="返回曲库" style={iconButtonStyle}><ArrowLeft size={17} /></button>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#E2EAF8', fontSize: 18, fontWeight: 750 }}>学习中心</div>
          <div style={{ color: '#6B80A8', fontSize: 10 }}>今天也积累一点点</div>
        </div>
        <div style={{ color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}><Flame size={16} />{summary.streak} 天</div>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 13, background: 'rgba(255,255,255,0.045)', margin: '16px 0' }}>
        {(['plan', 'history'] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} aria-pressed={tab === item} style={{ flex: 1, border: 'none', height: 36, borderRadius: 10, background: tab === item ? 'rgba(0,201,177,0.14)' : 'transparent', color: tab === item ? '#00C9B1' : '#6B80A8', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{item === 'plan' ? '学习计划' : '练习历史'}</button>)}
      </div>

      {tab === 'plan' ? (
        <>
          <section style={{ borderRadius: 18, padding: 17, background: 'linear-gradient(135deg,rgba(0,201,177,0.18),rgba(8,145,178,0.06))', border: '1px solid rgba(0,201,177,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ color: '#E2EAF8', fontSize: 14, fontWeight: 700 }}>今日目标</div><div style={{ color: '#6B80A8', fontSize: 10, marginTop: 3 }}>{summary.todayMinutes}/{dailyGoal} 分钟</div></div>
              <div style={{ width: 52, height: 52, borderRadius: 26, border: '5px solid rgba(0,201,177,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00C9B1', fontSize: 11, fontWeight: 800 }}>{dailyProgress}%</div>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginTop: 14, overflow: 'hidden' }}><div style={{ height: '100%', width: `${dailyProgress}%`, background: 'linear-gradient(90deg,#00C9B1,#22C55E)', borderRadius: 4 }} /></div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
            <Metric icon={<CalendarDays size={15} />} value={summary.sessions} label="累计练习" color="#60A5FA" />
            <Metric icon={<Target size={15} />} value={`${summary.averageAccuracy}%`} label="平均准确率" color="#00C9B1" />
            <Metric icon={<Award size={15} />} value={summary.bestScore.toLocaleString()} label="最高分" color="#F59E0B" />
          </div>

          <section style={{ marginTop: 12, borderRadius: 18, padding: 15, background: 'linear-gradient(135deg,rgba(168,85,247,0.14),rgba(245,158,11,0.06))', border: '1px solid rgba(168,85,247,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ color: '#E2EAF8', fontSize: 14, fontWeight: 750 }}>成长等级 Lv.{growth.level.level}</div>
                <div style={{ color: '#7D8FAE', fontSize: 10, marginTop: 3 }}>{growth.level.totalXp.toLocaleString()} XP · 本级 {growth.level.currentLevelXp}/{growth.level.nextLevelXp}</div>
              </div>
              <div style={{ color: '#F59E0B', fontSize: 12, fontWeight: 800 }}>{earnedBadges.length}/{growth.badges.length} 徽章</div>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}><div style={{ height: '100%', width: `${growth.level.progressPercent}%`, background: 'linear-gradient(90deg,#A855F7,#F59E0B)', borderRadius: 4 }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
              <Metric icon={<Flame size={15} />} value={growth.monthlyReport.xp} label="本月 XP" color="#F59E0B" />
              <Metric icon={<Clock3 size={15} />} value={growth.monthlyReport.minutes} label="本月分钟" color="#00C9B1" />
              <Metric icon={<Award size={15} />} value={growth.monthlyReport.activeDays} label="活跃天数" color="#A855F7" />
            </div>
          </section>

          <SectionTitle icon={<Award size={14} />} title="成长徽章" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {growth.badges.slice(0, 4).map((badge) => (
              <div key={badge.id} style={{ padding: 11, borderRadius: 13, background: badge.earned ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.035)', border: badge.earned ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ color: badge.earned ? '#FBCB75' : '#7D8FAE', fontSize: 11, fontWeight: 750 }}>{badge.label}</div>
                <div style={{ color: '#6B80A8', fontSize: 9, lineHeight: 1.45, marginTop: 4 }}>{badge.description}</div>
                <div style={{ color: badge.earned ? '#F59E0B' : '#4A5A78', fontSize: 9, marginTop: 7 }}>{Math.min(badge.progress, badge.target)}/{badge.target} · {badge.earned ? '已获得' : '进行中'}</div>
              </div>
            ))}
          </div>

          <SectionTitle icon={<TrendingUp size={14} />} title="最近 7 天" />
          <div style={{ height: 116, padding: '12px 10px 8px', borderRadius: 15, background: 'rgba(255,255,255,0.035)', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            {week.map((day) => <div key={day.key} style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 5 }}><div style={{ color: '#6B80A8', fontSize: 8 }}>{day.minutes || ''}</div><div title={`${day.minutes} 分钟`} style={{ width: '100%', minHeight: 3, height: `${Math.max(3, day.minutes / maxWeekMinutes * 68)}px`, borderRadius: 5, background: day.minutes ? 'linear-gradient(180deg,#00C9B1,#087F8C)' : 'rgba(255,255,255,0.06)' }} /><div style={{ color: '#4A5A78', fontSize: 9 }}>{day.label}</div></div>)}
          </div>

          {weakSong && history.length > 0 && (
            <button type="button" onClick={() => onSelectSong(weakSong)} style={{ width: '100%', border: '1px solid rgba(245,158,11,0.18)', background: 'rgba(245,158,11,0.07)', borderRadius: 15, padding: 13, marginTop: 12, display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}>
              <Target size={18} color="#F59E0B" /><div style={{ marginLeft: 10, flex: 1 }}><div style={{ color: '#FBCB75', fontSize: 11 }}>建议巩固</div><div style={{ color: '#E2EAF8', fontSize: 13, fontWeight: 650, marginTop: 2 }}>{weakSong.title}</div></div><ChevronRight size={15} color="#6B80A8" />
            </button>
          )}

          {bookmarks.length > 0 && (
            <>
              <SectionTitle icon={<Bookmark size={14} />} title="难点专项" />
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 3 }}>
                {bookmarks.map((bookmark) => {
                  const song = songs.find((item) => item.id === bookmark.songId);
                  if (!song) return null;
                  return <button key={bookmark.id} type="button" onClick={() => onPracticeBookmark(bookmark)} style={{ width: 142, flexShrink: 0, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.07)', borderRadius: 14, padding: 12, textAlign: 'left', cursor: 'pointer' }}><div style={{ color: '#C084FC', fontSize: 9, marginBottom: 5 }}>80% 速度 · 循环 3 次</div><div style={{ color: '#E2EAF8', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div><div style={{ color: '#6B80A8', fontSize: 10, marginTop: 3 }}>{bookmark.label}</div></button>;
                })}
              </div>
            </>
          )}

          <SectionTitle icon={<BookOpen size={14} />} title="分级课程" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {LEARNING_TRACKS.map((track) => {
              const sessions = history.filter((entry) => track.songIds.includes(entry.songId)).length;
              const cloudProgress = learningProgress.find((item) => item.trackId === track.id && !item.deletedAt);
              const progress = cloudProgress?.progressPercent ?? Math.min(100, Math.round(sessions / track.targetSessions * 100));
              const nextSongId = cloudProgress?.nextSongId ?? track.songIds.find((songId) => !history.some((entry) => entry.songId === songId)) ?? track.songIds[sessions % track.songIds.length];
              const nextSong = songs.find((song) => song.id === nextSongId);
              return <button key={track.id} type="button" disabled={!nextSong} onClick={() => nextSong && onSelectSong(nextSong)} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 14, background: `linear-gradient(135deg,${track.color}22,${track.color2}0D)`, display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left', cursor: nextSong ? 'pointer' : 'default' }}><div style={{ width: 45, height: 45, borderRadius: 14, background: `linear-gradient(135deg,${track.color},${track.color2})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={19} color="white" /></div><div style={{ flex: 1, minWidth: 0 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#E2EAF8', fontSize: 13, fontWeight: 700 }}>{track.title}</span><span style={{ color: track.color2, fontSize: 9 }}>{track.level}</span></div><div style={{ color: '#6B80A8', fontSize: 9, margin: '3px 0 7px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.description}</div><div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2 }}><div style={{ height: '100%', width: `${progress}%`, background: track.color2, borderRadius: 2 }} /></div></div><ChevronRight size={15} color="#4A5A78" /></button>;
            })}
          </div>
        </>
      ) : (
        <HistoryView history={history} songs={songs} onSelectSong={onSelectSong} />
      )}
    </div>
  );
}

function HistoryView({ history, songs, onSelectSong }: { history: PracticeHistoryEntry[]; songs: Song[]; onSelectSong: (song: Song) => void }) {
  if (!history.length) return <div style={{ padding: '70px 20px', textAlign: 'center', color: '#6B80A8' }}><BarChart3 size={32} style={{ margin: '0 auto 12px' }} /><div style={{ fontSize: 13 }}>还没有练习记录</div><div style={{ fontSize: 10, marginTop: 5 }}>完成第一首曲目后，这里会生成趋势。</div></div>;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{history.map((entry) => { const song = songs.find((item) => item.id === entry.songId); if (!song) return null; return <button key={entry.id} type="button" onClick={() => onSelectSong(song)} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 13, background: 'rgba(255,255,255,0.035)', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', cursor: 'pointer' }}><div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg,${song.color},${song.color2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 800 }}>{entry.accuracy}%</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ color: '#E2EAF8', fontSize: 12, fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div><div style={{ color: '#6B80A8', fontSize: 9, marginTop: 3, display: 'flex', gap: 8 }}><span><Clock3 size={9} /> {entryMinutes(entry)} 分钟</span><span>{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(entry.practicedAt))}</span></div></div><div style={{ color: '#00C9B1', fontSize: 11, fontWeight: 700 }}>{entry.score.toLocaleString()}</div></button>; })}</div>;
}

function Metric({ icon, value, label, color }: { icon: ReactNode; value: string | number; label: string; color: string }) { return <div style={{ padding: '11px 8px', borderRadius: 13, background: 'rgba(255,255,255,0.035)', textAlign: 'center' }}><div style={{ color, display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div><div style={{ color: '#E2EAF8', fontSize: 13, fontWeight: 750 }}>{value}</div><div style={{ color: '#4A5A78', fontSize: 8, marginTop: 2 }}>{label}</div></div>; }
function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B80A8', fontSize: 11, margin: '20px 0 9px' }}>{icon}{title}</div>; }
const iconButtonStyle = { width: 34, height: 34, borderRadius: 17, border: 'none', background: 'rgba(255,255,255,0.07)', color: '#E2EAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } as const;
