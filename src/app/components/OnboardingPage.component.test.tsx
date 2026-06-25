import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from './OnboardingPage';

describe('OnboardingPage', () => {
  it('submits selected beginner practice preferences', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<OnboardingPage onComplete={onComplete} onSkip={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /提升音准判定/ }));
    await user.click(screen.getByRole('button', { name: /半音阶/ }));
    await user.click(screen.getByRole('button', { name: '中级' }));
    await user.click(screen.getByRole('button', { name: /我现在处在相对安静的环境/ }));
    await user.click(screen.getByRole('button', { name: /我知道开始练习时需要允许麦克风/ }));
    await user.click(screen.getByRole('button', { name: /完成引导/ }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      goal: 'intonation',
      defaultHarmonica: 'chromatic',
      skillLevel: 'intermediate',
      microphoneExplained: true,
      deviceChecklist: expect.objectContaining({
        quietRoom: true,
        micPermission: true,
      }),
    }));
  });

  it('allows users to skip onboarding', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<OnboardingPage onComplete={vi.fn()} onSkip={onSkip} />);

    await user.click(screen.getByRole('button', { name: '跳过' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
