export interface LearningTrack {
  id: string;
  title: string;
  description: string;
  level: '入门' | '进阶' | '挑战';
  songIds: string[];
  targetSessions: number;
  color: string;
  color2: string;
}

export const LEARNING_TRACKS: LearningTrack[] = [
  {
    id: 'foundation',
    title: '十孔口琴入门',
    description: '熟悉吹吸方向、基础孔位和稳定长音。',
    level: '入门',
    songIds: ['1', '2', '5'],
    targetSessions: 6,
    color: '#047857',
    color2: '#00C9B1',
  },
  {
    id: 'rhythm',
    title: '节奏与换气',
    description: '通过中速曲目训练连续乐句和换气节奏。',
    level: '进阶',
    songIds: ['3', '4', '6'],
    targetSessions: 8,
    color: '#0369A1',
    color2: '#3B82F6',
  },
  {
    id: 'intonation',
    title: '音准挑战',
    description: '在更高速度和更复杂旋律中保持音准稳定。',
    level: '挑战',
    songIds: ['7', '8', '10'],
    targetSessions: 10,
    color: '#7C3AED',
    color2: '#EC4899',
  },
];
