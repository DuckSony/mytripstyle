// src/components/layout/BottomNavigation.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home as HomeIcon, 
  Map as MapIcon, 
  Favorite as FavoriteIcon, 
  Person as PersonIcon 
} from '@mui/icons-material';
import { Paper, BottomNavigation as MuiBottomNavigation, BottomNavigationAction } from '@mui/material';

const BottomNavigation = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const getValue = () => {
    if (pathname === '/') return 0;
    if (pathname.startsWith('/recommendations')) return 1;
    if (pathname.startsWith('/saved')) return 2;
    if (pathname.startsWith('/profile-setup')) return 3;
    return 0;
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderRadius: 0,
        boxShadow: '0 -2px 5px rgba(0,0,0,0.1)'
      }} 
      elevation={3}
    >
      <MuiBottomNavigation
        value={getValue()}
        showLabels
        sx={{
          '& .MuiBottomNavigationAction-root': {
            minWidth: 'auto',
          },
          '& .Mui-selected': {
            color: 'primary.main',
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.75rem',
              fontWeight: 'bold',
            }
          }
        }}
      >
        <BottomNavigationAction 
          component={Link} 
          to="/" 
          label="홈" 
          icon={<HomeIcon />} 
        />
        <BottomNavigationAction 
          component={Link} 
          to="/recommendations" 
          label="추천" 
          icon={<MapIcon />} 
        />
        <BottomNavigationAction 
          component={Link} 
          to="/saved" 
          label="저장" 
          icon={<FavoriteIcon />} 
        />
        <BottomNavigationAction 
          component={Link} 
          to="/profile-setup" 
          label="프로필" 
          icon={<PersonIcon />} 
        />
      </MuiBottomNavigation>
    </Paper>
  );
};

export default BottomNavigation;
