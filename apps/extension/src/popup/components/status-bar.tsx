interface StatusBarProps {
  user?: { id: string; email: string };
  onLogout: () => void;
}

export function StatusBar({ user, onLogout }: StatusBarProps) {
  return (
    <div className="status">
      {user?.email && <span>{user.email}</span>}
      <button
        onClick={onLogout}
        style={{
          marginLeft: 8,
          background: 'none',
          border: 'none',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: 12,
          textDecoration: 'underline',
        }}
      >
        Logout
      </button>
    </div>
  );
}
