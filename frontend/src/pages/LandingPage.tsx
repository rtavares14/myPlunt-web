import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import YardIcon from '@mui/icons-material/Yard';

function LandingPage() {
  return (
    <Box className="min-h-screen bg-gradient-to-br from-plunt-50 via-white to-plunt-100 flex items-center justify-center">
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
          <Typography
            variant="h6"
            className="!text-gray-500 !italic"
          >
            We will be live soon 🌱
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default LandingPage;
