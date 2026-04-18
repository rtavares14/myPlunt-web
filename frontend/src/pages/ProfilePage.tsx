import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SessionsSection from '../components/SessionsSection';

function ProfilePage() {
  const { user, logout, authFetch, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleLinkGoogle = async (resp: CredentialResponse) => {
    if (!resp.credential) return;
    setLinkError('');
    setLinkSuccess(false);
    if (!linkPassword) {
      setLinkError('Enter your current password to link Google');
      return;
    }
    try {
      const res = await authFetch('/api/auth/link-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: resp.credential, currentPassword: linkPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLinkError(data.error || 'Failed to link Google account');
        return;
      }
      setLinkPassword('');
      await refreshUser();
      setLinkSuccess(true);
    } catch {
      setLinkError('Unable to connect to server');
    }
  };

  const handleResendVerification = async () => {
    setResendState('sending');
    try {
      const res = await authFetch('/api/auth/resend-verification', { method: 'POST' });
      setResendState(res.ok ? 'sent' : 'error');
    } catch {
      setResendState('error');
    }
  };

  return (
    <Box className="flex-1 bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center px-4 py-8">
      <Paper
        elevation={0}
        className="w-full max-w-[480px] p-8 rounded-2xl border border-plunt-200"
      >
        <Box className="text-center">
          <Avatar
            src={user.avatarUrl || undefined}
            sx={{
              width: 80,
              height: 80,
              bgcolor: '#16a34a',
              fontSize: '1.8rem',
              fontWeight: 700,
              mx: 'auto',
              mb: 2,
            }}
          >
            {initials}
          </Avatar>
          <Typography variant="h5" className="!font-bold !text-plunt-900">
            {user.name}
          </Typography>
          <Typography variant="body2" className="!text-gray-500 !mt-1">
            {user.email}
          </Typography>
        </Box>

        {!user.emailVerified && (
          <Alert
            severity={resendState === 'sent' ? 'success' : 'warning'}
            className="!mt-4"
            action={
              resendState === 'sent' ? undefined : (
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleResendVerification}
                  disabled={resendState === 'sending'}
                >
                  {resendState === 'sending' ? 'Sending…' : 'Resend email'}
                </Button>
              )
            }
          >
            {resendState === 'sent'
              ? 'Verification email sent. Check your inbox.'
              : resendState === 'error'
                ? "Couldn't send the email. Try again in a minute."
                : "Your email isn't verified yet. Check your inbox for the verification link."}
          </Alert>
        )}

        <Divider className="!my-6" />

        <Typography variant="subtitle2" className="!font-bold !text-gray-700 !mb-3">
          Account
        </Typography>

        <Box className="flex flex-col gap-2 mb-4">
          <Box className="flex items-center justify-between">
            <Typography variant="body2" className="!text-gray-600">
              Email password
            </Typography>
            {user.hasPassword ? (
              <Chip
                icon={<CheckCircleIcon />}
                label="Set"
                size="small"
                sx={{ backgroundColor: '#dcfce7', color: '#166534' }}
              />
            ) : (
              <Chip label="Not set" size="small" variant="outlined" />
            )}
          </Box>
          <Box className="flex items-center justify-between">
            <Typography variant="body2" className="!text-gray-600">
              Google
            </Typography>
            {user.hasGoogleLink ? (
              <Chip
                icon={<CheckCircleIcon />}
                label="Linked"
                size="small"
                sx={{ backgroundColor: '#dcfce7', color: '#166534' }}
              />
            ) : (
              <Chip label="Not linked" size="small" variant="outlined" />
            )}
          </Box>
        </Box>

        {!user.hasGoogleLink && user.hasPassword && (
          <Box className="mb-4">
            {linkError && (
              <Alert severity="error" className="!mb-2" onClose={() => setLinkError('')}>
                {linkError}
              </Alert>
            )}
            {linkSuccess && (
              <Alert severity="success" className="!mb-2" onClose={() => setLinkSuccess(false)}>
                Google account linked.
              </Alert>
            )}
            <Typography variant="caption" className="!text-gray-500 !block !mb-2">
              Confirm your current password before linking Google.
            </Typography>
            <TextField
              type="password"
              size="small"
              fullWidth
              placeholder="Current password"
              value={linkPassword}
              onChange={(e) => setLinkPassword(e.target.value)}
              className="!mb-3"
              autoComplete="current-password"
            />
            <Box className="flex justify-center">
              <GoogleLogin
                onSuccess={handleLinkGoogle}
                onError={() => setLinkError('Google sign-in failed')}
                theme="outline"
                size="large"
                text="continue_with"
                shape="rectangular"
                width="356"
              />
            </Box>
          </Box>
        )}

        <Divider className="!my-6" />

        <Typography variant="subtitle2" className="!font-bold !text-gray-700 !mb-3">
          Active sessions
        </Typography>
        <SessionsSection />

        <Divider className="!my-4" />

        <Box className="flex justify-center">
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Log out
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default ProfilePage;
