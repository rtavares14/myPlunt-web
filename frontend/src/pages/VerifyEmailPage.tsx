import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import { useAuth } from '../context/AuthContext';

type Status = 'pending' | 'success' | 'error';

function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('pending');
  const [error, setError] = useState('');
  const didRun = useRef(false);

  useEffect(() => {
    // Guard: one-shot tokens must only be consumed once, regardless of
    // StrictMode double-invocation or effect re-runs.
    if (didRun.current) return;
    didRun.current = true;

    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setError('Missing verification token');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Verification failed');
          setStatus('error');
          return;
        }
        setStatus('success');
        refreshUser().catch(() => {
          // ignore — user may not be signed in on this device
        });
      } catch {
        setError('Unable to connect to server');
        setStatus('error');
      }
    })();
  }, [params, refreshUser]);

  return (
    <Box className="min-h-screen bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center px-4">
      <Paper
        elevation={0}
        className="w-full max-w-[420px] p-8 rounded-2xl border border-plunt-200 text-center"
      >
        {status === 'pending' && (
          <>
            <CircularProgress size={40} className="!text-plunt-600" />
            <Typography variant="h6" className="!mt-4 !font-bold">
              Verifying your email…
            </Typography>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircleIcon sx={{ fontSize: 48 }} className="text-plunt-600" />
            <Typography variant="h5" className="!mt-2 !font-bold !text-plunt-900">
              Email verified
            </Typography>
            <Typography variant="body2" className="!text-gray-500 !mt-2">
              {user
                ? "You're all set. Welcome to Plunt."
                : 'Your email is confirmed. Sign in to continue.'}
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate(user ? '/' : '/auth')}
              sx={{ mt: 3, textTransform: 'none', backgroundColor: '#16a34a' }}
            >
              {user ? 'Go to your plants' : 'Sign in'}
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <ErrorOutlineIcon sx={{ fontSize: 48 }} className="text-red-500" />
            <Typography variant="h5" className="!mt-2 !font-bold">
              Verification failed
            </Typography>
            <Typography variant="body2" className="!text-gray-500 !mt-2">
              {error}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => navigate('/auth')}
              sx={{ mt: 3, textTransform: 'none' }}
            >
              Back to sign in
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default VerifyEmailPage;
