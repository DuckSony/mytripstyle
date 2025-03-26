// src/components/WeatherInfo.js
import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, CircularProgress, Paper, Tooltip } from '@mui/material';
import { 
  WbSunny, Cloud, Opacity, AcUnit, Thunderstorm, 
  WbTwilight, Air, DeviceThermostat, Visibility
} from '@mui/icons-material';
import { getCurrentWeather, translateWeatherCondition, getWeatherIconUrl } from '../services/weatherService';

/**
 * 현재 날씨 정보를 표시하는 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {Object} props.location - 위치 정보 {latitude, longitude}
 * @param {Function} props.onWeatherDataLoaded - 날씨 데이터 로드 완료 시 콜백
 * @param {string} props.variant - 표시 스타일 ('compact', 'full')
 */
const WeatherInfo = ({ 
  location, 
  onWeatherDataLoaded = () => {},
  variant = 'compact'
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // 위치 정보가 있으면 날씨 데이터 로드
    if (location && location.latitude && location.longitude) {
      setLoading(true);
      setError(null);
      
      getCurrentWeather(location.latitude, location.longitude)
        .then(data => {
          setWeatherData(data);
          onWeatherDataLoaded(data); // 부모 컴포넌트에 데이터 전달
        })
        .catch(err => {
          console.error('날씨 데이터 로드 실패:', err);
          setError('날씨 정보를 불러오지 못했습니다.');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
      setError('위치 정보가 없습니다.');
    }
  }, [location, onWeatherDataLoaded]);
  
  // 날씨 아이콘 선택
  const getWeatherIcon = (weatherId) => {
    if (!weatherId) return <WbSunny />;
    
    if (weatherId === 800) return <WbSunny color="warning" />; // 맑음
    if (weatherId >= 801 && weatherId <= 804) return <Cloud color="primary" />; // 구름
    if (weatherId >= 300 && weatherId <= 321) return <Opacity color="info" />; // 이슬비
    if (weatherId >= 500 && weatherId <= 531) return <Opacity color="primary" />; // 비
    if (weatherId >= 200 && weatherId <= 232) return <Thunderstorm color="error" />; // 뇌우
    if (weatherId >= 600 && weatherId <= 622) return <AcUnit color="info" />; // 눈
    if (weatherId >= 700 && weatherId <= 781) return <Air color="disabled" />; // 안개, 연무 등
    
    return <WbTwilight />;
  };
  
  // 로딩 중일 때 표시
  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" p={1}>
        <CircularProgress size={20} sx={{ mr: 1 }} />
        <Typography variant="body2">날씨 정보 로드 중...</Typography>
      </Box>
    );
  }
  
  // 오류 발생 시 표시
  if (error) {
    return (
      <Chip 
        label={error} 
        color="default" 
        size="small" 
        icon={<WbTwilight />}
      />
    );
  }
  
  // 날씨 데이터가 없을 때 표시
  if (!weatherData) {
    return (
      <Chip 
        label="날씨 정보 없음" 
        color="default" 
        size="small" 
        icon={<WbTwilight />}
      />
    );
  }
  
  // 간단한 표시 스타일
  if (variant === 'compact') {
    return (
      <Tooltip title={`체감 온도: ${weatherData.feelsLike}°C, 습도: ${weatherData.humidity}%`}>
        <Chip 
          icon={getWeatherIcon(weatherData.weather.id)}
          label={`${Math.round(weatherData.temperature)}°C ${translateWeatherCondition(weatherData.weather.main)}`}
          color="primary"
          size="small"
          variant="outlined"
          sx={{ 
            borderRadius: '16px',
            '& .MuiChip-label': { 
              px: 1 
            }
          }}
        />
      </Tooltip>
    );
  }
  
  // 상세 표시 스타일
  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center">
          <Box 
            component="img" 
            src={getWeatherIconUrl(weatherData.weather.icon)} 
            alt={weatherData.weather.description}
            sx={{ width: 50, height: 50 }}
          />
          <Box ml={1}>
            <Typography variant="h6" component="div">
              {Math.round(weatherData.temperature)}°C
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {translateWeatherCondition(weatherData.weather.main)}
            </Typography>
          </Box>
        </Box>
        
        <Box>
          <Box display="flex" alignItems="center" mb={0.5}>
            <DeviceThermostat fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
            <Typography variant="body2">
              체감 온도: {Math.round(weatherData.feelsLike)}°C
            </Typography>
          </Box>
          <Box display="flex" alignItems="center">
            <Opacity fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
            <Typography variant="body2">
              습도: {weatherData.humidity}%
            </Typography>
          </Box>
        </Box>
      </Box>
      
      {weatherData.wind && (
        <Box mt={1} display="flex" alignItems="center">
          <Air fontSize="small" sx={{ mr: 1, opacity: 0.7 }} />
          <Typography variant="body2">
            풍속: {weatherData.wind.speed}m/s
          </Typography>
        </Box>
      )}
      
      <Box mt={1}>
        <Typography variant="body2" color="text.secondary">
          날씨 기반 추천이 활성화되었습니다.
        </Typography>
      </Box>
    </Paper>
  );
};

export default WeatherInfo;
