import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';

// Mirror of green-main / green-second in tailwind.config.js
const theme = createTheme({
  palette: {
    primary:    { main: '#14532d' },
    secondary:  { main: '#0f7033' },
    background: { default: '#ebe1d3' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box className="min-h-screen flex flex-col">
        <Navbar />
        <Box className="pt-16 flex-1 flex flex-col">
          <LandingPage />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
