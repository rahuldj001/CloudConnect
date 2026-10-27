import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBadge } from '../components/StatusBadge';

describe('StatusBadge Component', () => {
  it('renders available presence state with emerald styling', () => {
    render(<StatusBadge status="available" />);
    const badge = screen.getByText(/available/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-emerald');
  });

  it('renders busy presence state with amber styling', () => {
    render(<StatusBadge status="busy" />);
    const badge = screen.getByText(/busy/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber');
  });

  it('renders offline presence state with slate styling', () => {
    render(<StatusBadge status="offline" />);
    const badge = screen.getByText(/offline/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-slate');
  });

  it('renders priority status badge with critical tier styling', () => {
    render(<StatusBadge status="critical" type="priority" />);
    const badge = screen.getByText(/critical/i);
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-rose');
  });

  it('renders channel type voice and chat correctly', () => {
    const { rerender } = render(<StatusBadge status="voice" type="channel" />);
    expect(screen.getByText(/voice/i)).toBeInTheDocument();

    rerender(<StatusBadge status="chat" type="channel" />);
    expect(screen.getByText(/chat/i)).toBeInTheDocument();
  });
});
