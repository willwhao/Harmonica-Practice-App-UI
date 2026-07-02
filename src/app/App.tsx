/* MARKER-MAKE-KIT-INVOKED */
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { HomePage } from './components/HomePage';
import { PrepPage } from './components/PrepPage';
import { PracticePage } from './components/PracticePage';
import { ResultsPage } from './components/ResultsPage';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { LearningPage } from './components/LearningPage';
import { CalibrationPage } from './components/CalibrationPage';
import { OnboardingPage } from './components/OnboardingPage';
import { LegalPage } from './components/LegalPage';
import { SONGS } from './data';
import type { AuthUser, GameResults, LearningTrackProgress, PracticeBookmark, PracticeHistoryEntry, PracticeSettings, Song } from './types';
import type { PracticeChart } from './data/practiceCharts';
import { findChartForSong, loadPracticeSongPack, mergeSongs } from './content/songPack';
import { deleteLocalAccount, getLocalUserExport, loadSessionUser, logoutLocalAccount, updateLocalUser } from './auth/authStore';
import { summarizeWeakMeasures } from './practice/practiceInsights';
import { loadPitchProfile } from './practice/pitchProfile';
import { createOnboardingProfile, hasCompletedOnboarding, saveOnboardingProfile, type OnboardingProfile } from './onboarding/onboardingProfile';
import { deleteCloudAccount, isCloudMode, logoutCloudAccount, refreshCloudSession, syncCloudHistory, syncCloudLearning, updateCloudUser } from './cloud/cloudClient';
import { getLearningTrackProgress } from './learning/learningStats';

const GUEST_HISTORY_KEY = 'harmonica-practice-history';
const GUEST_MODE_KEY = 'harmonica-guest-mode';
const BOOKMARKS_KEY = 'harmonica-practice-bookmarks';
const DEFAULT_SETTINGS: PracticeSettings = {
  accompaniment: 'original',
  harmonicaType: 'diatonic',
  scoreMode: 'dynamic',
  speed: 100,
  accompanimentVolume: 70,
  metronomeVolume: 65,
  demoVolume: 55,
  practiceRange: 'full',
  customStartMeasure: 0,
  customEndMeasure: 12,
  repeatCount: 1,
  metronomeEnabled: true,
};

function historyKey(userId?: string) {
  return userId ? `${GUEST_HISTORY_KEY}:${userId}` : GUEST_HISTORY_KEY;
}

function loadHistory(userId?: string): PracticeHistoryEntry[] {
  try {
    const saved = window.localStorage.getItem(historyKey(userId));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: PracticeHistoryEntry[], userId?: string) {
  window.localStorage.setItem(historyKey(userId), JSON.stringify(history));
}

function mergeHistory(primary: PracticeHistoryEntry[], incoming: PracticeHistoryEntry[]) {
  const byId = new Map([...primary, ...incoming].map((entry) => [entry.id, entry]));
  return [...byId.values()].sort((a, b) => b.practicedAt.localeCompare(a.practicedAt)).slice(0, 20);
}

function bookmarksKey(userId?: string) {
  return userId ? `${BOOKMARKS_KEY}:${userId}` : BOOKMARKS_KEY;
}

function loadBookmarks(userId?: string): PracticeBookmark[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(bookmarksKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: PracticeBookmark[], userId?: string) {
  window.localStorage.setItem(bookmarksKey(userId), JSON.stringify(bookmarks));
}

function getSongById(songs: Song[], songId?: string) {
  return songs.find((item) => item.id === songId) ?? songs[0] ?? SONGS[0];
}

/* Phone status bar */
function StatusBar() {
  const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return (
    <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 20px', zIndex: 100 }}>
      <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{time}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
        {/* Signal */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill="white" opacity={0.9}>
          <rect x="0" y="8.5" width="3" height="3.5" rx="0.5" />
          <rect x="4.5" y="5.5" width="3" height="6.5" rx="0.5" />
          <rect x="9" y="2" width="3" height="10" rx="0.5" />
          <rect x="13.5" y="0" width="3" height="12" rx="0.5" />
        </svg>
        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" opacity={0.9}>
          <circle cx="8" cy="10.5" r="1.5" fill="white" />
          <path d="M3.8 6.8A5.9 5.9 0 0 1 8 5.2a5.9 5.9 0 0 1 4.2 1.6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M1.2 4A9.8 9.8 0 0 1 8 1.2 9.8 9.8 0 0 1 14.8 4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {/* Battery */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 24, height: 12, border: '1.5px solid rgba(255,255,255,0.8)', borderRadius: 3, padding: '2px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '82%', height: '100%', background: 'white', borderRadius: 1.5 }} />
          </div>
          <div style={{ width: 2, height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 1, marginLeft: 1 }} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(() => isCloudMode() ? null : loadSessionUser());
  const [guestMode, setGuestMode] = useState(() => window.localStorage.getItem(GUEST_MODE_KEY) === 'true');
  const [catalogSongs, setCatalogSongs] = useState<Song[]>(SONGS);
  const [catalogCharts, setCatalogCharts] = useState<PracticeChart[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song>(SONGS[0]);
  const [results, setResults] = useState<GameResults | null>(null);
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [importedChart, setImportedChart] = useState<PracticeChart | null>(null);
  const [history, setHistory] = useState<PracticeHistoryEntry[]>(() => loadHistory(isCloudMode() ? undefined : loadSessionUser()?.id));
  const [bookmarks, setBookmarks] = useState<PracticeBookmark[]>(() => loadBookmarks(isCloudMode() ? undefined : loadSessionUser()?.id));
  const [learningProgress, setLearningProgress] = useState<LearningTrackProgress[]>(() => getLearningTrackProgress(loadHistory(isCloudMode() ? undefined : loadSessionUser()?.id)));
  const [pitchProfile, setPitchProfile] = useState(() => loadPitchProfile(isCloudMode() ? undefined : loadSessionUser()?.id));
  const [onboardingCompleted, setOnboardingCompleted] = useState(() => hasCompletedOnboarding(isCloudMode() ? undefined : loadSessionUser()?.id));

  useEffect(() => {
    let cancelled = false;
    void loadPracticeSongPack().then((pack) => {
      if (cancelled) return;
      setCatalogSongs(mergeSongs(SONGS, pack.songs));
      setCatalogCharts(pack.charts);
    }).catch(() => {
      if (!cancelled) {
        setCatalogSongs(SONGS);
        setCatalogCharts([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncLearningState = (nextBookmarks: PracticeBookmark[], nextHistory: PracticeHistoryEntry[], activeUser = user) => {
    const nextProgress = getLearningTrackProgress(nextHistory);
    setLearningProgress(nextProgress);
    if (!activeUser || !isCloudMode()) return;
    void syncCloudLearning(nextBookmarks, nextProgress).then((synced) => {
      saveBookmarks(synced.bookmarks, activeUser.id);
      setBookmarks(synced.bookmarks);
      setLearningProgress(synced.progress);
    }).catch(() => {
      // Local learning data remains available and will retry in the next authenticated session.
    });
  };

  const activateGuest = () => {
    window.localStorage.setItem(GUEST_MODE_KEY, 'true');
    setGuestMode(true);
    setHistory(loadHistory());
    setBookmarks(loadBookmarks());
    setLearningProgress(getLearningTrackProgress(loadHistory()));
    setPitchProfile(loadPitchProfile());
    setOnboardingCompleted(hasCompletedOnboarding());
    navigate('/');
  };

  const authenticate = (nextUser: AuthUser) => {
    const migrated = mergeHistory(loadHistory(nextUser.id), loadHistory());
    const migratedBookmarks = [...loadBookmarks(nextUser.id), ...loadBookmarks()].filter((bookmark, index, items) => items.findIndex((item) => item.songId === bookmark.songId && item.startMeasure === bookmark.startMeasure && item.endMeasure === bookmark.endMeasure) === index);
    saveHistory(migrated, nextUser.id);
    saveBookmarks(migratedBookmarks, nextUser.id);
    window.localStorage.removeItem(GUEST_HISTORY_KEY);
    window.localStorage.removeItem(BOOKMARKS_KEY);
    window.localStorage.removeItem(GUEST_MODE_KEY);
    setUser(nextUser);
    setGuestMode(false);
    setHistory(migrated);
    setBookmarks(migratedBookmarks);
    setLearningProgress(getLearningTrackProgress(migrated));
    setPitchProfile(loadPitchProfile(nextUser.id));
    setOnboardingCompleted(hasCompletedOnboarding(nextUser.id));
    navigate('/');
    if (isCloudMode()) {
      void syncCloudHistory(migrated).then((synced) => {
        saveHistory(synced, nextUser.id);
        setHistory(synced);
        syncLearningState(migratedBookmarks, synced, nextUser);
      }).catch(() => {
        // Keep the local cache usable while the cloud is temporarily unavailable.
      });
    }
  };

  useEffect(() => {
    if (!isCloudMode() || user || guestMode) return;
    void refreshCloudSession().then((restored) => {
      if (restored) authenticate(restored);
    });
  }, [guestMode, user]);

  const finishPractice = (nextResults: GameResults) => {
    setResults(nextResults);
    setHistory((current) => {
      const now = new Date().toISOString();
      const next = [{
        id: `${Date.now()}-${selectedSong.id}`,
        songId: selectedSong.id,
        score: nextResults.score,
        accuracy: nextResults.accuracy,
        practicedAt: now,
        durationSeconds: nextResults.durationSeconds,
        weakMeasures: summarizeWeakMeasures(nextResults.noteResults ?? []).slice(0, 3),
        revision: 0,
        updatedAt: now,
      }, ...current].slice(0, 20);
      try {
        saveHistory(next, user?.id);
      } catch {
        // The practice result still works when storage is unavailable.
      }
      if (user && isCloudMode()) {
        void syncCloudHistory(next).then((synced) => {
          saveHistory(synced, user.id);
          setHistory(synced);
          syncLearningState(bookmarks, synced, user);
        }).catch(() => {
          // The unsynced local entry will retry at the next authenticated session.
        });
      }
      syncLearningState(bookmarks, next);
      return next;
    });
    navigate('/results');
  };

  const logout = () => {
    if (isCloudMode()) void logoutCloudAccount();
    else logoutLocalAccount();
    window.localStorage.removeItem(GUEST_MODE_KEY);
    setUser(null);
    setGuestMode(false);
    setHistory(loadHistory());
    setBookmarks(loadBookmarks());
    setLearningProgress(getLearningTrackProgress(loadHistory()));
    setPitchProfile(loadPitchProfile());
    setOnboardingCompleted(hasCompletedOnboarding());
    navigate('/');
  };

  const saveUser = (nextUser: AuthUser) => {
    if (isCloudMode()) {
      void updateCloudUser(nextUser).then(setUser);
    } else {
      setUser(updateLocalUser(nextUser));
    }
  };

  const deleteAccount = () => {
    if (!user) return;
    if (isCloudMode()) void deleteCloudAccount();
    else deleteLocalAccount(user.id);
    window.localStorage.removeItem(historyKey(user.id));
    window.localStorage.removeItem(bookmarksKey(user.id));
    setUser(null);
    setGuestMode(false);
    setHistory([]);
    setBookmarks([]);
    setLearningProgress(getLearningTrackProgress([]));
    setPitchProfile(loadPitchProfile());
    setOnboardingCompleted(hasCompletedOnboarding());
    navigate('/');
  };

  const completeOnboarding = (profile: OnboardingProfile) => {
    saveOnboardingProfile(profile, user?.id);
    setOnboardingCompleted(true);
    setSettings((current) => ({ ...current, harmonicaType: profile.defaultHarmonica }));
    if (user) {
      const nextUser = {
        ...user,
        preferences: {
          ...user.preferences,
          defaultHarmonica: profile.defaultHarmonica,
          dailyGoalMinutes: profile.dailyGoalMinutes,
          skillLevel: profile.skillLevel,
        },
      };
      saveUser(nextUser);
    }
    navigate('/');
  };

  const skipOnboarding = () => {
    completeOnboarding(createOnboardingProfile({
      goal: 'daily-habit',
      defaultHarmonica: user?.preferences.defaultHarmonica ?? settings.harmonicaType,
      dailyGoalMinutes: user?.preferences.dailyGoalMinutes ?? 15,
      skillLevel: user?.preferences.skillLevel ?? 'beginner',
      deviceChecklist: { quietRoom: false, micPermission: false, headphones: false },
    }));
  };

  const exportData = () => {
    if (!user) return;
    const blob = new Blob([getLocalUserExport(user, history, bookmarks)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `harmonica-data-${user.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const bookmarkWeakMeasure = (measure: number) => {
    const nextBookmark: PracticeBookmark = {
      id: `${selectedSong.id}-${measure}`,
      songId: selectedSong.id,
      startMeasure: measure - 1,
      endMeasure: measure,
      label: `第 ${measure} 小节`,
      createdAt: new Date().toISOString(),
    };
    setBookmarks((current) => {
      const next = [nextBookmark, ...current.filter((item) => item.id !== nextBookmark.id)].slice(0, 20);
      saveBookmarks(next, user?.id);
      syncLearningState(next, history);
      return next;
    });
  };

  const practiceBookmark = (bookmark: PracticeBookmark) => {
    const song = catalogSongs.find((item) => item.id === bookmark.songId);
    if (!song) return;
    setSelectedSong(song);
    setSettings((current) => ({ ...current, speed: 80, practiceRange: 'custom', customStartMeasure: bookmark.startMeasure, customEndMeasure: bookmark.endMeasure, repeatCount: 3, metronomeEnabled: true }));
    setImportedChart(null);
    navigate('/practice');
  };

  const requireAuthentication = !user && !guestMode;
  const shouldShowOnboarding = !requireAuthentication && !onboardingCompleted && history.length === 0;

  return (
    <main className="app-stage">
      <div className="phone-shell">
        {/* Notch */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 130, height: 34, background: '#111827', borderRadius: '0 0 18px 18px', zIndex: 200 }} />

        {/* Status bar (always on top) */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, zIndex: 150 }}>
          <StatusBar />
        </div>

        {/* Pages */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {requireAuthentication ? (
            <AuthPage onAuthenticated={authenticate} onGuest={activateGuest} />
          ) : shouldShowOnboarding ? (
            <OnboardingPage
              initialPreferences={user?.preferences}
              onComplete={completeOnboarding}
              onSkip={skipOnboarding}
            />
          ) : (
            <Routes>
              <Route
                path="/"
                element={(
                  <HomePage
                    songs={catalogSongs}
                    history={history}
                    user={user}
                    onAccount={() => navigate('/account')}
                    onLearning={() => navigate('/learning')}
                    onCalibrate={() => navigate('/calibration')}
                    onSelect={(song) => { setSelectedSong(song); setImportedChart(null); navigate(`/prep/${song.id}`); }}
                  />
                )}
              />
              <Route
                path="/prep/:songId"
                element={(
                  <PrepRoute
                    songs={catalogSongs}
                    charts={catalogCharts}
                    onBack={() => navigate('/')}
                    pitchProfile={pitchProfile}
                    onCalibrate={() => navigate('/calibration')}
                    onSelectedSongChange={setSelectedSong}
                    onStart={(nextSettings, nextImportedChart) => {
                      setSettings(nextSettings);
                      setImportedChart(nextImportedChart ?? null);
                      navigate('/practice');
                    }}
                  />
                )}
              />
              <Route
                path="/practice"
                element={(
                  <PracticePage
                    song={selectedSong}
                    settings={settings}
                    importedChart={importedChart ?? undefined}
                    catalogChart={findChartForSong(catalogCharts, selectedSong.id) ?? undefined}
                    pitchProfile={pitchProfile}
                    onBack={() => navigate(`/prep/${selectedSong.id}`)}
                    onFinish={finishPractice}
                  />
                )}
              />
              <Route
                path="/calibration"
                element={(
                  <CalibrationPage
                    song={selectedSong}
                    userId={user?.id}
                    onBack={() => navigate(`/prep/${selectedSong.id}`)}
                    onComplete={(profile) => {
                      setPitchProfile(profile);
                      navigate(`/prep/${selectedSong.id}`);
                    }}
                  />
                )}
              />
              <Route
                path="/onboarding"
                element={(
                  <OnboardingPage
                    initialPreferences={user?.preferences}
                    onComplete={completeOnboarding}
                    onSkip={skipOnboarding}
                  />
                )}
              />
              <Route
                path="/results"
                element={results ? (
                  <ResultsPage
                    results={results}
                    song={selectedSong}
                    onBookmarkWeakMeasure={bookmarkWeakMeasure}
                    onRetry={() => navigate('/practice')}
                    onHome={() => navigate('/')}
                  />
                ) : <Navigate to="/" replace />}
              />
              <Route
                path="/account"
                element={(
                  <AccountPage
                    user={user}
                    historyCount={history.length}
                    onBack={() => navigate('/')}
                    onSave={saveUser}
                    onLogout={logout}
                    onCreateAccount={() => { window.localStorage.removeItem(GUEST_MODE_KEY); setGuestMode(false); navigate('/'); }}
                    onDelete={deleteAccount}
                    onExport={exportData}
                    onLegal={(type) => navigate(`/legal/${type}`)}
                  />
                )}
              />
              <Route
                path="/legal/:type"
                element={<LegalRoute onBack={() => navigate('/account')} />}
              />
              <Route
                path="/learning"
                element={(
                  <LearningPage
                    user={user}
                    songs={catalogSongs}
                    history={history}
                    bookmarks={bookmarks}
                    learningProgress={learningProgress}
                    onBack={() => navigate('/')}
                    onSelectSong={(song) => { setSelectedSong(song); setImportedChart(null); navigate(`/prep/${song.id}`); }}
                    onPracticeBookmark={practiceBookmark}
                  />
                )}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </div>

        {/* Bottom home indicator */}
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 134, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3, zIndex: 150 }} />
      </div>
    </main>
  );
}

function LegalRoute({ onBack }: { onBack: () => void }) {
  const { type } = useParams();
  return <LegalPage type={type === 'terms' ? 'terms' : 'privacy'} onBack={onBack} />;
}

function PrepRoute({
  songs,
  charts,
  onBack,
  pitchProfile,
  onCalibrate,
  onSelectedSongChange,
  onStart,
}: {
  songs: Song[];
  charts: PracticeChart[];
  onBack: () => void;
  pitchProfile: ReturnType<typeof loadPitchProfile>;
  onCalibrate: () => void;
  onSelectedSongChange: (song: Song) => void;
  onStart: (settings: PracticeSettings, importedChart?: PracticeChart) => void;
}) {
  const { songId } = useParams();
  const song = getSongById(songs, songId);
  const practiceChart = findChartForSong(charts, song.id) ?? undefined;

  useEffect(() => {
    onSelectedSongChange(song);
  }, [onSelectedSongChange, song]);

  return <PrepPage song={song} practiceChart={practiceChart} pitchProfile={pitchProfile} onBack={onBack} onStart={onStart} onCalibrate={onCalibrate} />;
}
