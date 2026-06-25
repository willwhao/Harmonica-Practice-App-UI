import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LegalPage } from './LegalPage';

describe('LegalPage', () => {
  it('renders the versioned privacy policy', () => {
    render(<LegalPage type="privacy" onBack={vi.fn()} />);
    expect(screen.getByText('隐私政策')).toBeInTheDocument();
    expect(screen.getByText(/版本 1.0.0/)).toBeInTheDocument();
    expect(screen.getByText(/麦克风、录音与上传音频/)).toBeInTheDocument();
  });

  it('renders the terms of service', () => {
    render(<LegalPage type="terms" onBack={vi.fn()} />);
    expect(screen.getByText('用户协议')).toBeInTheDocument();
    expect(screen.getByText(/内容与版权/)).toBeInTheDocument();
  });
});
