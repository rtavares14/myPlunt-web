import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import YardIcon from '@mui/icons-material/Yard';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navButtonClass =
  'hover:!bg-cream hover:!text-green-main !bg-green-second !text-cream disabled:!opacity-60 disabled:!text-cream';

function Navbar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = user
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : null;

  return (
    <AppBar position="fixed" className="!bg-green-second">
      <Toolbar className="flex justify-between">
        <Box className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <YardIcon />
          <Typography variant="h6" component="span" className="!font-bold">
            Plunt
          </Typography>
        </Box>

        <Box className="flex items-center gap-2">
          <IconButton
            disabled
            aria-label="Friends (coming soon)"
            className={navButtonClass}
          >
            <PeopleIcon />
          </IconButton>
          <IconButton
            disabled
            aria-label="Notifications (coming soon)"
            className={navButtonClass}
          >
            <NotificationsIcon />
          </IconButton>

          <IconButton
            className="!ml-1"
            aria-label={user ? 'Profile' : 'Sign in'}
            onClick={() => navigate(user ? '/profile' : '/auth')}
          >
            <Avatar
              src={user?.avatarUrl || undefined}
              sx={{ width: 32, height: 32, bgcolor: '#dcfce7', color: '#166534' }}
            >
              {initials || 'U'}
            </Avatar>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
