import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import YardIcon from '@mui/icons-material/Yard';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = user
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : null;

  return (
    <AppBar position="sticky" sx={{ backgroundColor: '#15803d' }}>
      <Toolbar className="flex justify-between">
        <Box className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <YardIcon />
          <Typography variant="h6" component="span" className="!font-bold">
            Plunt
          </Typography>
        </Box>

        <Box className="flex items-center gap-1">
          <IconButton color="inherit">
            <PeopleIcon />
          </IconButton>

          <IconButton color="inherit">
            <Badge badgeContent={0} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          <IconButton
            className="!ml-1"
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
