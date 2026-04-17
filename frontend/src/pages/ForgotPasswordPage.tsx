import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import EmailIcon from '@mui/icons-material/Email';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Something went wrong');
        return;
      }
      setSent(true);
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
          <EmailIcon sx={{ fontSize: 44 }} className="text-plunt-600" />
          <Typography variant="h5" className="!font-bold !text-plunt-900 !mt-2">
            Reset your password
          </Typography>
        </Box>

        {sent ? (
          <>
            <Alert severity="success">
              If an account exists for that email, we've sent a reset link. Check your inbox.
            </Alert>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => navigate('/auth')}
              sx={{ mt: 3, textTransform: 'none' }}
            >
              Back to sign in
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
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                fullWidth
                size="small"
                autoComplete="email"
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
                {loading ? <CircularProgress size={22} color="inherit" /> : 'Send reset link'}
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default ForgotPasswordPage;
