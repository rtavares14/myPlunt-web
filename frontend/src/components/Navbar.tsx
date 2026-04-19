import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import YardIcon from '@mui/icons-material/Yard';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PeopleIcon from '@mui/icons-material/People';

const navButtonClass =
  'hover:!bg-cream hover:!text-green-main !bg-green-second !text-cream';

function Navbar() {
  return (
    <AppBar position="fixed" className="!bg-green-second">
      <Toolbar className="flex justify-between">
        <Box className="flex items-center gap-2 text-cream">
          <YardIcon />
          <Typography variant="h6" component="span" className="!font-bold">
            Plunt
          </Typography>
        </Box>

        <Box className="flex items-center gap-2">
          <IconButton aria-label="Friends" className={navButtonClass}>
            <PeopleIcon />
          </IconButton>
          <IconButton aria-label="Notifications" className={navButtonClass}>
            <NotificationsIcon />
          </IconButton>
          <IconButton aria-label="Account" className={navButtonClass}>
            <AccountCircleIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
