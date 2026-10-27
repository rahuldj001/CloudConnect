import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { Login } from '../pages/Login';
import { AuthContext } from '../contexts/AuthContext';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockHasRole = vi.fn();

const renderLoginComponent = (user: any = null) => {
  return render(
    <AuthContext.Provider
      value={{
        user,
        token: user ? 'fake-token' : null,
        login: mockLogin,
        logout: mockLogout,
        hasRole: mockHasRole,
        isAuthenticated: !!user,
        isLoading: false,
      }}
    >
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </AuthContext.Provider>
  );
};

describe('Login Component', () => {
  it('renders CloudConnect login header and credentials form', () => {
    renderLoginComponent();
    expect(screen.getByText('CloudConnect')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Workspace/i })).toBeInTheDocument();
  });

  it('populates fields when Admin quick-fill demo button is clicked', () => {
    renderLoginComponent();
    const adminBtn = screen.getByText('Admin');
    fireEvent.click(adminBtn);

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;

    expect(emailInput.value).toBe('admin@cloudconnect.dev');
    expect(passwordInput.value).toBe('AdminPass123!');
  });

  it('populates fields when Agent quick-fill button is clicked', () => {
    renderLoginComponent();
    const agentBtn = screen.getByText('Agent');
    fireEvent.click(agentBtn);

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    expect(emailInput.value).toBe('agent1@cloudconnect.dev');
  });

  it('calls login function on form submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLoginComponent();

    const adminBtn = screen.getByText('Admin');
    fireEvent.click(adminBtn);

    const submitBtn = screen.getByRole('button', { name: /Sign In to Workspace/i });
    fireEvent.click(submitBtn);

    expect(mockLogin).toHaveBeenCalledWith('admin@cloudconnect.dev', 'AdminPass123!');
  });
});
