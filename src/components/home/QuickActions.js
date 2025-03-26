import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Grid, 
  Paper, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Avatar
} from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SearchIcon from '@mui/icons-material/Search';
import NearMeIcon from '@mui/icons-material/NearMe';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InsertEmoticonIcon from '@mui/icons-material/InsertEmoticon';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import BatterySaverIcon from '@mui/icons-material/BatterySaver';
import FavoriteIcon from '@mui/icons-material/Favorite';
import SpaIcon from '@mui/icons-material/Spa';
import { useUser } from '../../contexts/UserContext';

/**
 * 홈 화면의 빠른 액션 버튼 모음 컴포넌트
 * 사용자가 자주 사용하는 기능에 빠르게 접근할 수 있는 바로가기 제공
 */
function QuickActions() {
  const [moodDialogOpen, setMoodDialogOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState('');
  const { userProfile, updateUserProfile } = useUser();
  const navigate = useNavigate();

  // 모든 추천 보기 화면으로 이동
  const handleExploreAll = () => {
    navigate('/recommendations');
  };

  // 저장한 장소 화면으로 이동
  const handleSavedPlaces = () => {
    navigate('/saved-places');
  };

  // 검색 화면으로 이동 (미구현 시 안내 메시지)
  const handleSearch = () => {
    // 검색 기능이 구현되지 않았다면 모든 추천으로 이동
    navigate('/recommendations');
  };

  // 내 주변 장소 화면으로 이동
  const handleNearbyPlaces = () => {
    // 위치 권한 확인
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // 위치 정보를 state에 저장하고 페이지 이동
          navigate('/recommendations', { 
            state: { 
              filterType: 'nearby',
              coordinates: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              }
            } 
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          // 위치 권한이 없어도 페이지 이동은 가능하게
          navigate('/recommendations', { state: { filterType: 'nearby' } });
        }
      );
    } else {
      // 위치 기능을 지원하지 않는 브라우저
      navigate('/recommendations');
    }
  };

  // 방문 계획 화면으로 이동
  const handleVisitPlans = () => {
    navigate('/visit-history', { state: { tabIndex: 1 } }); // 방문 계획 탭
  };

  // 감정 상태 변경 다이얼로그 열기
  const handleMoodUpdate = () => {
    setMoodDialogOpen(true);
  };
  
  // 감정 상태 다이얼로그 닫기
  const handleCloseMoodDialog = () => {
    setMoodDialogOpen(false);
    setSelectedMood('');
  };
  
  // 감정 상태 선택 처리
  const handleMoodChange = (event) => {
    setSelectedMood(event.target.value);
  };
  
  // 감정 상태 저장
  const handleSaveMood = async () => {
    if (selectedMood && userProfile) {
      try {
        // 현재 프로필에 감정 상태 업데이트
        await updateUserProfile({
          ...userProfile,
          currentMood: {
            mood: selectedMood,
            timestamp: new Date()
          }
        });
        
        // 다이얼로그 닫기
        setMoodDialogOpen(false);
        
        // 감정 상태 기반 추천 페이지로 이동
        navigate('/recommendations', { 
          state: { 
            filterType: 'mood',
            mood: selectedMood
          } 
        });
      } catch (error) {
        console.error('Error updating mood:', error);
      }
    }
  };

  // 함수 제거 (사용되지 않음)

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" component="h2" gutterBottom>
        빠른 액션
      </Typography>
      
      <Grid container spacing={2}>
        {/* 모든 추천 보기 */}
        <Grid item xs={6} md={3}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: 'primary.light',
                '& .MuiAvatar-root': {
                  backgroundColor: 'primary.main',
                },
                '& .MuiTypography-root': {
                  color: 'primary.main',
                }
              }
            }}
            onClick={handleExploreAll}
          >
            <Avatar 
              sx={{ 
                backgroundColor: 'primary.light', 
                color: 'primary.main',
                mb: 1
              }}
            >
              <ExploreIcon />
            </Avatar>
            <Typography variant="body2" align="center">
              모든 추천
            </Typography>
          </Paper>
        </Grid>
        
        {/* 내 주변 */}
        <Grid item xs={6} md={3}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: 'info.light',
                '& .MuiAvatar-root': {
                  backgroundColor: 'info.main',
                },
                '& .MuiTypography-root': {
                  color: 'info.main',
                }
              }
            }}
            onClick={handleNearbyPlaces}
          >
            <Avatar 
              sx={{ 
                backgroundColor: 'info.light', 
                color: 'info.main',
                mb: 1
              }}
            >
              <NearMeIcon />
            </Avatar>
            <Typography variant="body2" align="center">
              내 주변
            </Typography>
          </Paper>
        </Grid>
        
        {/* 감정 상태 변경 */}
        <Grid item xs={6} md={3}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: 'success.light',
                '& .MuiAvatar-root': {
                  backgroundColor: 'success.main',
                },
                '& .MuiTypography-root': {
                  color: 'success.main',
                }
              }
            }}
            onClick={handleMoodUpdate}
          >
            <Avatar 
              sx={{ 
                backgroundColor: 'success.light', 
                color: 'success.main',
                mb: 1
              }}
            >
              <InsertEmoticonIcon />
            </Avatar>
            <Typography variant="body2" align="center">
              감정 상태 변경
            </Typography>
          </Paper>
        </Grid>
        
        {/* 저장한 장소 */}
        <Grid item xs={6} md={3}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: 'warning.light',
                '& .MuiAvatar-root': {
                  backgroundColor: 'warning.main',
                },
                '& .MuiTypography-root': {
                  color: 'warning.main',
                }
              }
            }}
            onClick={handleSavedPlaces}
          >
            <Avatar 
              sx={{ 
                backgroundColor: 'warning.light', 
                color: 'warning.main',
                mb: 1
              }}
            >
              <BookmarkIcon />
            </Avatar>
            <Typography variant="body2" align="center">
              저장한 장소
            </Typography>
          </Paper>
        </Grid>
        
        {/* 방문 계획 */}
        <Grid item xs={6} md={3}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: 'secondary.light',
                '& .MuiAvatar-root': {
                  backgroundColor: 'secondary.main',
                },
                '& .MuiTypography-root': {
                  color: 'secondary.main',
                }
              }
            }}
            onClick={handleVisitPlans}
          >
            <Avatar 
              sx={{ 
                backgroundColor: 'secondary.light', 
                color: 'secondary.main',
                mb: 1
              }}
            >
              <LocationOnIcon />
            </Avatar>
            <Typography variant="body2" align="center">
              방문 계획
            </Typography>
          </Paper>
        </Grid>
        
        {/* 검색 */}
        <Grid item xs={6} md={3}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                backgroundColor: 'error.light',
                '& .MuiAvatar-root': {
                  backgroundColor: 'error.main',
                },
                '& .MuiTypography-root': {
                  color: 'error.main',
                }
              }
            }}
            onClick={handleSearch}
          >
            <Avatar 
              sx={{ 
                backgroundColor: 'error.light', 
                color: 'error.main',
                mb: 1
              }}
            >
              <SearchIcon />
            </Avatar>
            <Typography variant="body2" align="center">
              검색
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      
      {/* 감정 상태 변경 다이얼로그 */}
      <Dialog open={moodDialogOpen} onClose={handleCloseMoodDialog}>
        <DialogTitle>감정 상태 변경</DialogTitle>
        <DialogContent>
          <FormControl component="fieldset">
            <FormLabel component="legend">현재 감정 상태를 선택해주세요</FormLabel>
            <RadioGroup value={selectedMood} onChange={handleMoodChange}>
              <FormControlLabel 
                value="기쁨" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SentimentSatisfiedAltIcon sx={{ mr: 1, color: '#4CAF50' }} />
                    <Typography>기쁨</Typography>
                  </Box>
                } 
              />
              <FormControlLabel 
                value="스트레스" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SentimentDissatisfiedIcon sx={{ mr: 1, color: '#F44336' }} />
                    <Typography>스트레스</Typography>
                  </Box>
                } 
              />
              <FormControlLabel 
                value="피곤함" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <BatterySaverIcon sx={{ mr: 1, color: '#9E9E9E' }} />
                    <Typography>피곤함</Typography>
                  </Box>
                } 
              />
              <FormControlLabel 
                value="설렘" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FavoriteIcon sx={{ mr: 1, color: '#E91E63' }} />
                    <Typography>설렘</Typography>
                  </Box>
                } 
              />
              <FormControlLabel 
                value="평온함" 
                control={<Radio />} 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SpaIcon sx={{ mr: 1, color: '#009688' }} />
                    <Typography>평온함</Typography>
                  </Box>
                } 
              />
            </RadioGroup>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMoodDialog}>취소</Button>
          <Button 
            onClick={handleSaveMood} 
            variant="contained" 
            disabled={!selectedMood}
          >
            적용하기
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default QuickActions;
