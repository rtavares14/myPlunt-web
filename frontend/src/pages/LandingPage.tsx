import { useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import YardIcon from '@mui/icons-material/Yard';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; alreadyRegistered: boolean }
  | { kind: 'error'; message: string };

function LandingPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: 'submitting' });

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({ kind: 'error', message: data?.error ?? 'Something went wrong' });
        return;
      }

      setStatus({ kind: 'success', alreadyRegistered: Boolean(data?.alreadyRegistered) });
      setEmail('');
    } catch {
      setStatus({ kind: 'error', message: 'Network error — please try again' });
    }
  }

  const isSubmitting = status.kind === 'submitting';

  return (
    <Box className="flex-1 bg-cream flex items-center justify-center">
      <Container maxWidth="sm">
        <Box className="text-center p-8">
          <YardIcon
            sx={{ fontSize: 80 }}
            className="text-green-second mb-4"
          />
          <Typography
            variant="h2"
            component="h1"
            className="!font-bold !mb-4 !text-green-main"
          >
            Welcome to myPlunt
          </Typography>
          <Typography
            variant="h5"
            className="!text-green-light !mb-6 !font-light"
          >
            Connecting plant lovers everywhere
          </Typography>
          <Box className="w-16 h-1 bg-green-second mx-auto rounded-full mb-6" />
          <Typography
            variant="h6"
            className="!text-gray-600 !mb-6 !font-light"
          >
            We're launching soon (I hope....)
            <br />
            Join the waitlist to be the first to know.
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 justify-center items-stretch max-w-md mx-auto"
          >
            <TextField
              type="email"
              required
              fullWidth
              size="small"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status.kind !== 'submitting' && status.kind !== 'idle') {
                  setStatus({ kind: 'idle' });
                }
              }}
              disabled={isSubmitting}
              slotProps={{ htmlInput: { 'aria-label': 'Email address' } }}
              sx={(theme) => {
                const cream = theme.palette.background.default;
                return {
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: cream,
                    '&:hover': { backgroundColor: cream },
                    '&.Mui-focused': { backgroundColor: cream },
                  },
                  '& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus':
                    {
                      WebkitBoxShadow: `0 0 0 1000px ${cream} inset`,
                      WebkitTextFillColor: 'inherit',
                    },
                };
              }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isSubmitting || email.trim().length === 0}
              className="!whitespace-nowrap"
              sx={{ textTransform: 'none', minWidth: 130 }}
            >
              {isSubmitting ? 'Joining…' : 'Join waitlist'}
            </Button>
          </Box>

          {status.kind === 'success' && (
            <Alert severity="success" className="!mt-4 !text-left">
              {status.alreadyRegistered
                ? "You're already on the list — we'll be in touch soon."
                : "You're in! We'll email you when Plunt is live."}
            </Alert>
          )}
          {status.kind === 'error' && (
            <Alert severity="error" className="!mt-4 !text-left">
              {status.message}
            </Alert>
          )}
        </Box>
      </Container>
    </Box>
  );
}

export default LandingPage;
