import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import YardIcon from '@mui/icons-material/Yard';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <Box className="flex-1 bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center">
      <Container maxWidth="sm">
        <Box className="text-center p-8">
          <YardIcon
            sx={{ fontSize: 80 }}
            className="text-plunt-600 mb-4"
          />
          <Typography
            variant="h2"
            component="h1"
            className="!font-bold !mb-4 !text-plunt-900"
          >
            Welcome to Plunt
          </Typography>
          <Typography
            variant="h5"
            className="!text-plunt-700 !mb-6"
          >
            Connecting plant lovers everywhere
          </Typography>
          <Box className="w-16 h-1 bg-plunt-400 mx-auto rounded-full mb-6" />
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/auth')}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              backgroundColor: '#16a34a',
              '&:hover': { backgroundColor: '#15803d' },
            }}
          >
            Get Started
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

export default LandingPage;
