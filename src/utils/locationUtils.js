// src/utils/locationUtils.js

/**
 * 위치 관련 유틸리티 함수들
 */

// 현재 위치 정보 가져오기
export const getCurrentPosition = (options = {}) => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    
    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };
    
    const geolocationOptions = { ...defaultOptions, ...options };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(position);
      },
      (error) => {
        console.error('Geolocation error:', error);
        reject(error);
      },
      geolocationOptions
    );
  });
};

// 위치 지속적 감시
export const watchPosition = (callback, options = {}) => {
  if (!navigator.geolocation) {
    console.error('Geolocation is not supported by your browser');
    return null;
  }
  
  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000
  };
  
  const geolocationOptions = { ...defaultOptions, ...options };
  
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback(position);
      // 위치 정보 캐싱
      saveLastLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      });
    },
    (error) => {
      console.error('Geolocation watch error:', error);
      // 콜백에 에러 전달 (필요한 경우)
      if (options.onError) {
        options.onError(error);
      }
    },
    geolocationOptions
  );
  
  return watchId;
};

// 위치 감시 중지
export const clearWatch = (watchId) => {
  if (watchId && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};

// 마지막 위치 정보 로컬 스토리지에 저장
export const saveLastLocation = (location) => {
  if (!location) return;
  
  try {
    const locationData = {
      ...location,
      timestamp: location.timestamp || Date.now()
    };
    localStorage.setItem('lastLocation', JSON.stringify(locationData));
  } catch (error) {
    console.error('Error saving location to local storage:', error);
  }
};

// 마지막 위치 정보 가져오기
export const getLastLocation = () => {
  try {
    const savedLocation = localStorage.getItem('lastLocation');
    return savedLocation ? JSON.parse(savedLocation) : null;
  } catch (error) {
    console.error('Error getting location from local storage:', error);
    return null;
  }
};

// 위치 정보 사용 권한 확인
export const checkLocationPermission = async () => {
  // Permission API를 지원하는 브라우저에서만 작동
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state; // 'granted', 'denied', 'prompt' 중 하나
    } catch (error) {
      console.error('Error checking geolocation permission:', error);
      return 'unknown';
    }
  }
  
  // Permission API를 지원하지 않는 경우 'unknown' 반환
  return 'unknown';
};

// 두 지점 간 거리 계산 (Haversine 공식)
export const calculateDistance = (point1, point2) => {
  // 유효한 좌표인지 확인
  if (!point1?.latitude || !point1?.longitude || !point2?.latitude || !point2?.longitude) {
    return Infinity;
  }
  
  const R = 6371e3; // 지구 반경 (미터)
  const φ1 = point1.latitude * Math.PI/180;
  const φ2 = point2.latitude * Math.PI/180;
  const Δφ = (point2.latitude - point1.latitude) * Math.PI/180;
  const Δλ = (point2.longitude - point1.longitude) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // 미터 단위 거리
};

// 거리 형식화 (1km 미만은 m, 이상은 km로 표시)
export const formatDistance = (distance) => {
  if (typeof distance !== 'number') return '알 수 없는 거리';
  
  if (distance < 1000) {
    return `${Math.round(distance)}m`;
  } else {
    return `${(distance / 1000).toFixed(1)}km`;
  }
};

// 경로 좌표들 간 총 거리 계산
export const calculatePathDistance = (coordinates) => {
  if (!coordinates || coordinates.length < 2) return 0;
  
  let totalDistance = 0;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const distance = calculateDistance(coordinates[i], coordinates[i + 1]);
    totalDistance += distance;
  }
  
  return totalDistance;
};

// 위치 정보 이용 가능한지 확인
export const isLocationAvailable = () => {
  return typeof navigator !== 'undefined' && navigator.geolocation;
};

// 새로 추가: 지역 데이터 정리 및 검증 함수
export const getLocationData = (location) => {
  if (!location) {
    return { region: '서울', subRegion: null, detailed: null };
  }
  
  // 정리된 데이터 반환
  return {
    region: location.region || '서울',
    subRegion: location.subRegion || null,
    detailed: location.detailed || null,
    coordinates: location.coordinates || null
  };
};

// 새로 추가: 위치 좌표 정규화 함수
export const normalizeCoordinates = (coordinates) => {
  if (!coordinates) return null;
  
  // 다양한 좌표 형식 처리
  if (typeof coordinates === 'object') {
    if (coordinates.latitude !== undefined && coordinates.longitude !== undefined) {
      return { 
        latitude: parseFloat(coordinates.latitude), 
        longitude: parseFloat(coordinates.longitude) 
      };
    } else if (coordinates.lat !== undefined && coordinates.lng !== undefined) {
      return { 
        latitude: parseFloat(coordinates.lat), 
        longitude: parseFloat(coordinates.lng) 
      };
    }
  }
  
  return null;
};

// 위치 유틸 객체로 묶어서 내보내기 (기존 default export 유지)
const locationUtils = {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  saveLastLocation,
  getLastLocation,
  checkLocationPermission,
  calculateDistance,
  formatDistance,
  calculatePathDistance,
  isLocationAvailable,
  getLocationData,
  normalizeCoordinates
};

export default locationUtils;
