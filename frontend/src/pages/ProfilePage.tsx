import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import LogoutIcon from '@mui/icons-material/Logout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import SessionsSection from '../components/SessionsSection';

function ProfilePage() {
  const { user, logout, authFetch } = useAuth();
  const navigate = useNavigate();
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
