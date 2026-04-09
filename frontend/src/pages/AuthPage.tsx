import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import YardIcon from '@mui/icons-material/Yard';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import GoogleIcon from '@mui/icons-material/Google';
import AppleIcon from '@mui/icons-material/Apple';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type AuthMode = 'login' | 'signup';

function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login'
      ? { email, password }
      : { email, name, password };

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/';
    } catch {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (provider: 'google' | 'apple') => {
    // TODO: Integrate real OAuth SDK (Google Identity Services / Sign in with Apple JS)
    // For now, show a placeholder message
    setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in will be available soon`);
  };

  return (
    <Box className="min-h-screen bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center px-4">
      <Paper
        elevation={0}
        className="w-full max-w-[420px] p-8 rounded-2xl border border-plunt-200"
      >
        {/* Branding */}
        <Box className="text-center mb-6">
          <YardIcon sx={{ fontSize: 48 }} className="text-plunt-600 mb-2" />
          <Typography variant="h4" className="!font-bold !text-plunt-900">
            {mode === 'login' ? 'Welcome back' : 'Join Plunt'}
          </Typography>
          <Typography variant="body2" className="!text-gray-500 !mt-1">
            {mode === 'login'
              ? 'Sign in to your plant community'
              : 'Create your account and start sharing'}
          </Typography>
        </Box>

        {/* Social buttons */}
        <Box className="flex flex-col gap-3 mb-4">
          <Button
            variant="outlined"
            fullWidth
            startIcon={<GoogleIcon />}
            onClick={() => handleOAuth('google')}
            sx={{
              borderColor: '#e5e7eb',
              color: '#374151',
              textTransform: 'none',
              fontWeight: 500,
              py: 1.2,
              '&:hover': { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
            }}
          >
            Continue with Google
          </Button>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<AppleIcon />}
            onClick={() => handleOAuth('apple')}
            sx={{
              borderColor: '#e5e7eb',
              color: '#374151',
              textTransform: 'none',
              fontWeight: 500,
              py: 1.2,
              '&:hover': { borderColor: '#d1d5db', backgroundColor: '#f9fafb' },
            }}
          >
            Continue with Apple
          </Button>
        </Box>

        <Divider className="!my-4">
          <Typography variant="body2" className="!text-gray-400 !px-2">
            or
          </Typography>
        </Divider>

        {/* Email/password form */}
        {error && (
          <Alert severity="error" className="!mb-4" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              size="small"
              autoComplete="name"
            />
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
            size="small"
            autoComplete="email"
          />

          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            fullWidth
            size="small"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            fullWidth
            disabled={loading}
            sx={{
              mt: 1,
              py: 1.2,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              backgroundColor: '#16a34a',
              '&:hover': { backgroundColor: '#15803d' },
            }}
          >
            {loading ? (
              <CircularProgress size={22} color="inherit" />
            ) : mode === 'login' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </Button>
        </Box>

        {/* Toggle mode */}
        <Typography variant="body2" className="!text-center !mt-5 !text-gray-500">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <Box
            component="span"
            onClick={toggleMode}
            className="text-plunt-600 font-semibold cursor-pointer hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </Box>
        </Typography>
      </Paper>
    </Box>
  );
}

export default AuthPage;
