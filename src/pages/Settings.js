// src/pages/Settings.js
import React from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Palette as PaletteIcon,
  Lock as LockIcon,
  Storage as StorageIcon,
  Info as InfoIcon,
  Help as HelpIcon
} from '@mui/icons-material';

const Settings = () => {
  // 나중에 실제 기능 구현 시 useState 등으로 상태 관리 필요
  const [darkMode, setDarkMode] = React.useState(false);
  const [notifications, setNotifications] = React.useState(true);
  
  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
  };
  
  const handleNotificationsToggle = () => {
    setNotifications(!notifications);
  };
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          설정
        </Typography>
        
        <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
          {/* 앱 테마 설정 */}
          <ListItem>
            <ListItemIcon>
              <PaletteIcon />
            </ListItemIcon>
            <ListItemText primary="다크 모드" />
            <FormControlLabel
              control={<Switch checked={darkMode} onChange={handleDarkModeToggle} />}
              label=""
            />
          </ListItem>
          <Divider />
          
          {/* 알림 설정 */}
          <ListItem>
            <ListItemIcon>
              <NotificationsIcon />
            </ListItemIcon>
            <ListItemText 
              primary="알림" 
              secondary="앱 알림을 켜고 끌 수 있습니다"
            />
            <FormControlLabel
              control={<Switch checked={notifications} onChange={handleNotificationsToggle} />}
              label=""
            />
          </ListItem>
          <Divider />
          
          {/* 개인정보 설정 */}
          <ListItem button>
            <ListItemIcon>
              <LockIcon />
            </ListItemIcon>
            <ListItemText 
              primary="개인정보 설정" 
              secondary="개인정보 보호 관련 설정을 변경합니다"
            />
          </ListItem>
          <Divider />
          
          {/* 데이터 및 저장소 */}
          <ListItem button>
            <ListItemIcon>
              <StorageIcon />
            </ListItemIcon>
            <ListItemText 
              primary="데이터 및 저장소" 
              secondary="앱이 사용하는 데이터 및 저장 공간을 관리합니다"
            />
          </ListItem>
          <Divider />
          
          {/* 정보 */}
          <ListItem button>
            <ListItemIcon>
              <InfoIcon />
            </ListItemIcon>
            <ListItemText 
              primary="앱 정보" 
              secondary="버전, 개발자 정보, 라이선스"
            />
          </ListItem>
          <Divider />
          
          {/* 도움말 */}
          <ListItem button>
            <ListItemIcon>
              <HelpIcon />
            </ListItemIcon>
            <ListItemText 
              primary="도움말" 
              secondary="자주 묻는 질문 및 고객 지원"
            />
          </ListItem>
        </List>
      </Box>
    </Container>
  );
};

export default Settings;
