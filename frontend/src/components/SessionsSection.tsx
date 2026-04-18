import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAuth } from '../context/AuthContext';

interface Session {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  let os = 'Unknown OS';
  if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';
  return `${browser} on ${os}`;
}

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SessionsSection() {
  const { authFetch } = useAuth();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await authFetch('/api/auth/sessions');
      if (!res.ok) {
        setError('Failed to load sessions');
        return;
      }
      const data = await res.json();
      setSessions(data.sessions);
      setError('');
    } catch {
      setError('Unable to connect to server');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const revoke = async (id: string) => {
    setBusy(id);
    try {
      const res = await authFetch(`/api/auth/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  const logoutElsewhere = async () => {
    setBusy('all');
    try {
      const res = await authFetch('/api/auth/logout-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepCurrent: true }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  if (sessions === null) {
    return (
      <Box className="flex justify-center py-4">
        <CircularProgress size={20} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Typography variant="body2" className="!text-red-600 !mb-2">
          {error}
        </Typography>
      )}
      <Box className="flex flex-col gap-2">
        {sessions.map((s) => (
          <Box
            key={s.id}
            className="flex items-center justify-between p-3 rounded-lg border border-gray-200"
          >
            <Box className="min-w-0 flex-1">
              <Box className="flex items-center gap-2 mb-1">
                <Typography variant="body2" className="!font-medium !text-gray-800 truncate">
                  {parseUserAgent(s.userAgent)}
                </Typography>
                {s.isCurrent && (
                  <Chip
                    label="This device"
                    size="small"
                    sx={{ backgroundColor: '#dcfce7', color: '#166534', height: 20 }}
                  />
                )}
              </Box>
              <Typography variant="caption" className="!text-gray-500 block">
                {s.ip || 'Unknown IP'} · signed in {timeAgo(s.createdAt)}
              </Typography>
            </Box>
            {!s.isCurrent && (
              <IconButton
                size="small"
                onClick={() => revoke(s.id)}
                disabled={busy === s.id}
                aria-label="Revoke session"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}
      </Box>
      {sessions.filter((s) => !s.isCurrent).length > 0 && (
        <Box className="flex justify-end mt-3">
          <Button
            size="small"
            color="warning"
            onClick={logoutElsewhere}
            disabled={busy === 'all'}
            sx={{ textTransform: 'none' }}
          >
            {busy === 'all' ? 'Working…' : 'Log out everywhere else'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
