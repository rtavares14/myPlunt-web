import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import LockResetIcon from '@mui/icons-material/LockReset';

function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <Box className="min-h-screen bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center px-4">
        <Paper elevation={0} className="w-full max-w-[420px] p-8 rounded-2xl border border-plunt-200">
          <Alert severity="error">Missing reset token.</Alert>
        </Paper>
      </Box>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Reset failed');
        return;
      }
      setDone(true);
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="min-h-screen bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center px-4">
      <Paper
        elevation={0}
        className="w-full max-w-[420px] p-8 rounded-2xl border border-plunt-200"
      >
        <Box className="text-center mb-6">
          <LockResetIcon sx={{ fontSize: 44 }} className="text-plunt-600" />
          <Typography variant="h5" className="!font-bold !text-plunt-900 !mt-2">
            Choose a new password
          </Typography>
        </Box>

        {done ? (
          <>
            <Alert severity="success">
              Your password has been reset. You've been signed out of all devices.
            </Alert>
            <Button
              fullWidth
              variant="contained"
              onClick={() => navigate('/auth')}
              sx={{ mt: 3, textTransform: 'none', backgroundColor: '#16a34a' }}
            >
              Sign in
            </Button>
          </>
        ) : (
          <>
            {error && (
              <Alert severity="error" className="!mb-4" onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit} className="flex flex-col gap-3">
              <TextField
                label="New password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                size="small"
                autoComplete="new-password"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                fullWidth
                sx={{
                  mt: 1,
                  py: 1.2,
                  textTransform: 'none',
                  fontWeight: 600,
                  backgroundColor: '#16a34a',
                  '&:hover': { backgroundColor: '#15803d' },
                }}
              >
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Reset password'}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default ResetPasswordPage;
