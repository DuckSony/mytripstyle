// src/services/locationService.js
import { 
  db, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  serverTimestamp
} from '../config/firebase';

// GeoPoint를 별도로 임포트
import { GeoPoint } from 'firebase/firestore';

import locationUtils from '../utils/locationUtils';

/**
 * 위치 관련 서비스 함수들
 */

/**
 * 현재 위치 정보 가져오기
 * @param {Object} options - 위치 가져오기 옵션
 * @returns {Promise} - 결과 객체 {success, data, error}
 */
export const getUserLocation = async (options = {}) => {
  try {
    // 위치 권한 요청 및 위치 정보 가져오기
    const position = await locationUtils.getCurrentPosition(options);
    
    const locationData = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    };
    
    // 위치 정보 저장 (캐싱)
    locationUtils.saveLastLocation(locationData);
    
    return {
      success: true,
      data: locationData
    };
  } catch (error) {
    console.error("Error getting user location:", error);
    
    // 오류 발생 시 마지막 저장된 위치 확인 (폴백)
    const lastLocation = locationUtils.getLastLocation();
    if (lastLocation) {
      console.log("Using last saved location as fallback");
      return {
        success: true,
        data: lastLocation,
        fromCache: true
      };
    }
    
    // 저장된 위치도 없는 경우 오류 반환
    return {
      success: false,
      error: error.message || '위치 정보를 가져올 수 없습니다.'
    };
  }
};

/**
 * 사용자 위치 기반 반경 내 장소 가져오기
 * @param {Object} location - 위치 {latitude, longitude}
 * @param {Number} radius - 반경 (미터)
 * @returns {Promise} - 결과 객체 {success, data, error}
 */
export const getNearbyPlaces = async (location, radius = 5000) => {
  try {
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('유효한 위치 정보가 필요합니다.');
    }
    
    console.log("getNearbyPlaces 호출됨:", { location, radius });
    
    // Firestore에서는 직접적인 지리적 쿼리(반경 검색)를 지원하지 않으므로
    // 1. 먼저 모든 장소를 가져온 다음
    // 2. 클라이언트에서 거리 계산하여 필터링하는 방식으로 구현
    
    const placesRef = collection(db, 'places');
    const placesSnapshot = await getDocs(placesRef);
    
    if (placesSnapshot.empty) {
      console.log("장소 데이터가 없습니다.");
      return {
        success: true,
        data: []
      };
    }
    
    console.log(`${placesSnapshot.size}개의 장소 데이터를 가져왔습니다.`);
    
    // 장소 데이터 추출 및 거리 계산
    const places = [];
    
    placesSnapshot.forEach(doc => {
      try {
        const placeData = doc.data();
        
        // 위치 정보 추출 로직 개선 - 다양한 형태의 위치 데이터 처리
        let placeLocation;
        
        if (placeData.location) {
          if (placeData.location instanceof GeoPoint) {
            // GeoPoint 객체인 경우
            placeLocation = {
              latitude: placeData.location.latitude,
              longitude: placeData.location.longitude
            };
          } else if (typeof placeData.location === 'object') {
            // 일반 객체인 경우 (latitude, longitude 또는 lat, lng 등의 형태)
            if (placeData.location.latitude !== undefined && placeData.location.longitude !== undefined) {
              placeLocation = {
                latitude: placeData.location.latitude,
                longitude: placeData.location.longitude
              };
            } else if (placeData.location.lat !== undefined && placeData.location.lng !== undefined) {
              placeLocation = {
                latitude: placeData.location.lat,
                longitude: placeData.location.lng
              };
            } else if (placeData.location._lat !== undefined && placeData.location._long !== undefined) {
              // Firebase가 직렬화한 GeoPoint 객체의 경우
              placeLocation = {
                latitude: placeData.location._lat,
                longitude: placeData.location._long
              };
            }
          } else if (Array.isArray(placeData.location) && placeData.location.length >= 2) {
            // 배열 형태 [lng, lat]
            placeLocation = {
              latitude: placeData.location[1],
              longitude: placeData.location[0]
            };
          }
        } else if (placeData.coordinates) {
          // coordinates 필드를 사용하는 경우
          if (typeof placeData.coordinates === 'object') {
            if (placeData.coordinates.latitude !== undefined && placeData.coordinates.longitude !== undefined) {
              placeLocation = {
                latitude: placeData.coordinates.latitude,
                longitude: placeData.coordinates.longitude
              };
            } else if (placeData.coordinates.lat !== undefined && placeData.coordinates.lng !== undefined) {
              placeLocation = {
                latitude: placeData.coordinates.lat,
                longitude: placeData.coordinates.lng
              };
            }
          }
        }
        
        // 위치 정보가 없는 경우 건너뛰기
        if (!placeLocation || !placeLocation.latitude || !placeLocation.longitude) {
          console.log(`위치 정보가 없는 장소 건너뛰기: ${placeData.name || doc.id}`);
          return;
        }
        
        // 거리 계산
        const distance = locationUtils.calculateDistance(location, placeLocation);
        
        // 반경 내에 있는 장소만 추가
        if (distance <= radius) {
          places.push({
            id: doc.id,
            ...placeData,
            distance, // 계산된 거리 추가 (미터 단위)
            formattedDistance: locationUtils.formatDistance(distance) // 사람이 읽기 쉬운 형식으로 변환
          });
        }
      } catch (error) {
        console.error(`장소 데이터 처리 중 오류 발생: ${doc.id}`, error);
        // 하나의 장소 처리 실패해도 계속 진행
      }
    });
    
    console.log(`처리된 장소 수: ${places.length}`);
    
    // 거리순으로 정렬
    places.sort((a, b) => a.distance - b.distance);
    
    return {
      success: true,
      data: places
    };
  } catch (error) {
    console.error("Error getting nearby places:", error);
    return {
      success: false,
      error: error.message || '주변 장소를 가져오는데 실패했습니다.'
    };
  }
};

/**
 * 특정 지역 내 장소 가져오기
 * @param {Object} region - 지역 정보 {region, subRegion}
 * @returns {Promise} - 결과 객체 {success, data, error}
 */
export const getPlacesByRegion = async (region) => {
  try {
    if (!region || (!region.region && !region.subRegion)) {
      throw new Error('유효한 지역 정보가 필요합니다.');
    }
    
    console.log("getPlacesByRegion 호출됨:", region);
    
    let placesQuery;
    const placesRef = collection(db, 'places');
    
    // subRegion이 있으면 더 세부적인 지역으로 쿼리
    if (region.subRegion) {
      placesQuery = query(placesRef, where('subRegion', '==', region.subRegion));
    } else {
      placesQuery = query(placesRef, where('region', '==', region.region));
    }
    
    const placesSnapshot = await getDocs(placesQuery);
    
    if (placesSnapshot.empty) {
      console.log("지역 기반 장소 데이터가 없습니다.");
      return {
        success: true,
        data: []
      };
    }
    
    console.log(`${placesSnapshot.size}개의 지역 기반 장소 데이터를 가져왔습니다.`);
    
    // 장소 데이터 추출
    const places = [];
    
    placesSnapshot.forEach(doc => {
      try {
        const placeData = doc.data();
        places.push({
          id: doc.id,
          ...placeData
        });
      } catch (error) {
        console.error(`지역 장소 데이터 처리 중 오류 발생: ${doc.id}`, error);
      }
    });
    
    return {
      success: true,
      data: places
    };
  } catch (error) {
    console.error("Error getting places by region:", error);
    return {
      success: false,
      error: error.message || '지역 장소를 가져오는데 실패했습니다.'
    };
  }
};

/**
 * 사용자 주변 관심 지역 찾기
 * @param {Object} location - 위치 {latitude, longitude}
 * @param {Number} maxDistance - 최대 거리 (미터)
 * @returns {Promise} - 결과 객체 {success, data, error}
 */
export const getNearbyRegions = async (location, maxDistance = 10000) => {
  try {
    if (!location || !location.latitude || !location.longitude) {
      throw new Error('유효한 위치 정보가 필요합니다.');
    }
    
    // 지역 정보 쿼리
    // 실제 구현에서는 지역 정보를 저장한 컬렉션 필요
    const regionsRef = collection(db, 'regions');
    const regionsSnapshot = await getDocs(regionsRef);
    
    if (regionsSnapshot.empty) {
      return {
        success: true,
        data: []
      };
    }
    
    // 지역 데이터 추출 및 거리 계산
    const regions = [];
    
    regionsSnapshot.forEach(doc => {
      const regionData = doc.data();
      
      // 위치 정보가 있는 경우만 처리
      if (regionData.coordinates) {
        let regionLocation;
        
        // 다양한 좌표 형식 처리
        if (typeof regionData.coordinates === 'object') {
          if (regionData.coordinates.latitude !== undefined && regionData.coordinates.longitude !== undefined) {
            regionLocation = {
              latitude: regionData.coordinates.latitude,
              longitude: regionData.coordinates.longitude
            };
          } else if (regionData.coordinates.lat !== undefined && regionData.coordinates.lng !== undefined) {
            regionLocation = {
              latitude: regionData.coordinates.lat,
              longitude: regionData.coordinates.lng
            };
          }
        }
        
        if (!regionLocation) {
          return; // 유효한 위치 정보가 없으면 건너뛰기
        }
        
        // 거리 계산
        const distance = locationUtils.calculateDistance(location, regionLocation);
        
        // 최대 거리 내에 있는 지역만 추가
        if (distance <= maxDistance) {
          regions.push({
            id: doc.id,
            ...regionData,
            distance, // 계산된 거리 추가 (미터 단위)
            formattedDistance: locationUtils.formatDistance(distance)
          });
        }
      }
    });
    
    // 거리순으로 정렬
    regions.sort((a, b) => a.distance - b.distance);
    
    return {
      success: true,
      data: regions
    };
  } catch (error) {
    console.error("Error getting nearby regions:", error);
    return {
      success: false,
      error: error.message || '주변 지역을 가져오는데 실패했습니다.'
    };
  }
};

/**
 * 사용자 위치 기록 로깅
 * @param {String} userId - 사용자 ID
 * @param {Object} location - 위치 정보
 * @param {String} action - 행동 유형 (예: 'visit', 'search')
 * @returns {Promise} - 결과 객체 {success, data, error}
 */
export const logUserLocation = async (userId, location, action = 'track') => {
  if (!userId || !location) {
    return {
      success: false,
      error: '유효한 사용자 ID와 위치 정보가 필요합니다.'
    };
  }
  
  try {
    // 위치 로그 저장
    const locationLog = {
      userId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      accuracy: location.accuracy,
      action,
      timestamp: serverTimestamp()
    };
    
    const locationLogsRef = collection(db, 'locationLogs');
    const docRef = await addDoc(locationLogsRef, locationLog);
    
    return {
      success: true,
      data: {
        id: docRef.id,
        ...locationLog
      }
    };
  } catch (error) {
    console.error("Error logging user location:", error);
    return {
      success: false,
      error: error.message || '위치 기록을 저장하는데 실패했습니다.'
    };
  }
};

/**
 * 사용자 방문 위치 저장
 * @param {String} userId - 사용자 ID
 * @param {String} placeId - 장소 ID
 * @param {Object} visitData - 방문 데이터
 * @returns {Promise} - 결과 객체 {success, data, error}
 */
export const saveVisitLocation = async (userId, placeId, visitData = {}) => {
  try {
    if (!userId || !placeId) {
      throw new Error('사용자 ID와 장소 ID가 필요합니다.');
    }
    
    // 방문 기록 저장
    const visitRef = collection(db, 'visits');
    const visit = {
      userId,
      placeId,
      visitDate: visitData.visitDate || serverTimestamp(),
      ...visitData,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(visitRef, visit);
    
    return {
      success: true,
      data: {
        id: docRef.id,
        ...visit
      }
    };
  } catch (error) {
    console.error("Error saving visit location:", error);
    return {
      success: false,
      error: error.message || '방문 정보를 저장하는데 실패했습니다.'
    };
  }
};

/**
 * 위치 권한 상태 확인
 * @returns {Promise} - 결과 객체 {success, state, error}
 */
export const checkLocationPermissionState = async () => {
  try {
    const permissionState = await locationUtils.checkLocationPermission();
    
    return {
      success: true,
      state: permissionState
    };
  } catch (error) {
    console.error("Error checking location permission:", error);
    return {
      success: false,
      state: 'unknown',
      error: error.message || '위치 권한 상태를 확인하는데 실패했습니다.'
    };
  }
};

/**
 * 위치 정보 지속적 감시 (연속 업데이트)
 * @param {Function} callback - 위치 변경 시 호출할 콜백 함수
 * @param {Object} options - 위치 감시 옵션
 * @returns {Number} - watchId (clearWatch에 사용)
 */
export const watchLocation = (callback, options = {}) => {
  return locationUtils.watchPosition(callback, options);
};

/**
 * 위치 감시 중지
 * @param {Number} watchId - watchLocation에서 반환된 ID
 */
export const clearLocationWatch = (watchId) => {
  locationUtils.clearWatch(watchId);
};

/**
 * 거리 계산 및 포맷팅 유틸리티 함수들
 */
export const calculateDistance = locationUtils.calculateDistance;
export const formatDistance = locationUtils.formatDistance;
export const calculatePathDistance = locationUtils.calculatePathDistance;
export const isLocationAvailable = locationUtils.isLocationAvailable;

// 모든 함수를 객체로 묶어서 export
const locationService = {
  getUserLocation,
  getNearbyPlaces,
  getPlacesByRegion,
  getNearbyRegions,
  saveVisitLocation,
  logUserLocation,
  watchLocation,
  clearLocationWatch,
  checkLocationPermissionState,
  calculateDistance,
  formatDistance,
  calculatePathDistance,
  isLocationAvailable
};

export default locationService;
