// src/hooks/useWeather.js
import { useState, useEffect, useCallback } from 'react';
import { getCurrentWeather } from '../services/weatherService';

/**
 * 날씨 정보를 가져오고 관리하는 커스텀 훅
 * 
 * @param {Object} options - 훅 옵션
 * @param {Object} options.initialLocation - 초기 위치 정보 {latitude, longitude}
 * @param {boolean} options.autoLoad - 훅 마운트 시 자동으로 데이터 로드 여부
 * @param {number} options.refreshInterval - 데이터 자동 갱신 간격 (밀리초, 0이면 비활성화)
 * @returns {Object} 날씨 관련 상태 및 함수
 */
const useWeather = ({ 
  initialLocation = null,
  autoLoad = true,
  refreshInterval = 0 // 기본값으로 자동 갱신 비활성화
}) => {
  const [location, setLocation] = useState(initialLocation);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // 날씨 데이터 로드 함수
  const loadWeatherData = useCallback(async (loc = location) => {
    if (!loc || !loc.latitude || !loc.longitude) {
      setError('위치 정보가 없습니다.');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const data = await getCurrentWeather(loc.latitude, loc.longitude);
      
      if (data) {
        setWeatherData(data);
        setLastUpdated(new Date());
        return data;
      } else {
        setError('날씨 데이터를 가져올 수 없습니다.');
        return null;
      }
    } catch (err) {
      console.error('날씨 데이터 로드 오류:', err);
      setError(err.message || '날씨 정보를 불러오지 못했습니다.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [location]);
  
  // 위치 설정 함수
  const updateLocation = useCallback((newLocation) => {
    setLocation(newLocation);
  }, []);
  
  // 현재 위치 가져오기
  const getCurrentLocation = useCallback(() => {
    setLoading(true);
    setError(null);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          setLocation(newLocation);
          loadWeatherData(newLocation);
        },
        (err) => {
          console.error('위치 정보 가져오기 오류:', err);
          setError('위치 정보를 가져올 수 없습니다: ' + err.message);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      );
    } else {
      setError('브라우저가 위치 정보를 지원하지 않습니다.');
      setLoading(false);
    }
  }, [loadWeatherData]);
  
  // 초기 데이터 로드
  useEffect(() => {
    if (autoLoad && location) {
      loadWeatherData();
    }
  }, [autoLoad, location, loadWeatherData]);
  
  // 주기적 데이터 갱신
  useEffect(() => {
    let intervalId = null;
    
    if (refreshInterval > 0 && location) {
      intervalId = setInterval(() => {
        loadWeatherData();
      }, refreshInterval);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refreshInterval, location, loadWeatherData]);
  
  // 네트워크 재연결 시 데이터 갱신
  useEffect(() => {
    const handleOnline = () => {
      if (location) {
        loadWeatherData();
      }
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [location, loadWeatherData]);
  
  return {
    weatherData,
    loading,
    error,
    lastUpdated,
    loadWeatherData,
    updateLocation,
    getCurrentLocation,
    location
  };
};

export default useWeather;
