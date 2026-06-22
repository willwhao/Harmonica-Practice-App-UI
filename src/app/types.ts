export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  difficulty: 1 | 2 | 3;
  harmonicaType: 'diatonic' | 'chromatic';
  genre: string;
  color: string;
  color2: string;
}

export interface GameResults {
  score: number;
  accuracy: number;
  maxCombo: number;
  perfect: number;
  great: number;
  good: number;
  bad: number;
  miss: number;
  total: number;
  durationSeconds?: number;
  noteResults?: NotePracticeResult[];
}

export type NoteJudgment = 'Perfect' | 'Great' | 'Good' | 'Bad' | 'Miss';

export interface NotePracticeResult {
  loopIndex: number;
  beat: number;
  measure: number;
  noteNumber: string;
  hole: number;
  breath: 'blow' | 'draw';
  judgment: NoteJudgment;
  centsDifference: number | null;
  detectedNote: string | null;
  timingDifferenceMs: number | null;
  stabilityCents: number | null;
}

export interface WeakMeasureSummary {
  measure: number;
  errors: number;
  total: number;
  averageCents: number | null;
}

export interface PracticeSettings {
  accompaniment: 'original' | 'simplified' | 'none';
  harmonicaType: 'diatonic' | 'chromatic';
  scoreMode: 'dynamic' | 'traditional';
  speed: number;
  practiceRange: 'full' | 'firstHalf' | 'secondHalf' | 'custom';
  customStartMeasure: number;
  customEndMeasure: number;
  repeatCount: 1 | 2 | 3;
  metronomeEnabled: boolean;
}

export interface PracticeHistoryEntry {
  id: string;
  songId: string;
  score: number;
  accuracy: number;
  practicedAt: string;
  durationSeconds?: number;
  weakMeasures?: WeakMeasureSummary[];
}

export interface PracticeBookmark {
  id: string;
  songId: string;
  startMeasure: number;
  endMeasure: number;
  label: string;
  createdAt: string;
}

export interface UserPreferences {
  defaultHarmonica: 'diatonic' | 'chromatic';
  dailyGoalMinutes: number;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
}

export interface AuthUser {
  id: string;
  email: string;
  nickname: string;
  createdAt: string;
  preferences: UserPreferences;
}
