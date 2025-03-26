// src/services/searchService.js
import { db } from '../config/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';

const searchService = {
  // 장소 검색
  searchPlaces: async (searchTerm, options = {}) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return { success: false, error: '검색어를 입력해주세요', data: [], totalResults: 0 };
    }
    
    try {
      const searchTermLower = searchTerm.toLowerCase();
      
      // 이름으로 검색
      const nameStartsWithQuery = query(
        collection(db, 'places'),
        where('nameLower', '>=', searchTermLower),
        where('nameLower', '<=', searchTermLower + '\uf8ff'),
        limit(20)
      );
      
      // 카테고리로 검색
      const categoryQuery = query(
        collection(db, 'places'),
        where('category', '==', searchTermLower),
        limit(20)
      );
      
      // 지역으로 검색
      const regionQuery = query(
        collection(db, 'places'),
        where('region', '==', searchTermLower),
        limit(20)
      );
      
      // 하위 지역으로 검색
      const subRegionQuery = query(
        collection(db, 'places'),
        where('subRegion', '==', searchTermLower),
        limit(20)
      );
      
      // 태그로 검색
      const tagsQuery = query(
        collection(db, 'places'),
        where('interestTags', 'array-contains', searchTermLower),
        limit(20)
      );
      
      // 모든 쿼리 실행
      const [nameResults, categoryResults, regionResults, subRegionResults, tagsResults] = 
        await Promise.all([
          getDocs(nameStartsWithQuery),
          getDocs(categoryQuery),
          getDocs(regionQuery),
          getDocs(subRegionQuery),
          getDocs(tagsQuery)
        ]);
      
      // 결과 합치기
      const results = new Map();
      
      // 결과 처리 함수
      const processResults = (querySnapshot, score) => {
        querySnapshot.forEach(doc => {
          const data = doc.data();
          
          // 이미 추가된 결과인 경우 더 높은 점수로 업데이트
          if (results.has(doc.id)) {
            const existing = results.get(doc.id);
            if (score > existing.searchScore) {
              results.set(doc.id, { ...existing, searchScore: score });
            }
          } else {
            results.set(doc.id, { 
              ...data, 
              id: doc.id,
              searchScore: score // 검색 관련도 점수
            });
          }
        });
      };
      
      // 각 결과에 점수 부여 (이름 > 카테고리 > 태그 > 지역)
      processResults(nameResults, 100);
      processResults(categoryResults, 80);
      processResults(tagsResults, 70);
      processResults(subRegionResults, 60);
      processResults(regionResults, 50);
      
      // 필터 적용
      let filteredResults = Array.from(results.values());

      // 카테고리 필터
      if (options.category) {
        filteredResults = filteredResults.filter(place => 
          place.category === options.category
        );
      }
      
      // 지역 필터
      if (options.region) {
        filteredResults = filteredResults.filter(place => 
          place.region === options.region || place.subRegion === options.region
        );
      }
      
      // MBTI 필터
      if (options.mbtiType) {
        filteredResults = filteredResults.filter(place => {
          const mbtiScore = place.mbtiMatchScore ? place.mbtiMatchScore[options.mbtiType] : 0;
          return mbtiScore && mbtiScore >= 6; // 6점 이상인 경우만
        });
      }
      
      // 평점 필터
      if (options.minRating) {
        filteredResults = filteredResults.filter(place => 
          place.averageRating && place.averageRating.overall >= options.minRating
        );
      }
      
      // 태그 필터
      if (options.tags && options.tags.length > 0) {
        filteredResults = filteredResults.filter(place => 
          options.tags.some(tag => 
            place.interestTags && place.interestTags.includes(tag)
          )
        );
      }
      
      // 정렬
      if (options.sortBy) {
        switch (options.sortBy) {
          case 'relevance':
            filteredResults.sort((a, b) => b.searchScore - a.searchScore);
            break;
          case 'rating':
            filteredResults.sort((a, b) => 
              ((b.averageRating && b.averageRating.overall) || 0) - 
              ((a.averageRating && a.averageRating.overall) || 0)
            );
            break;
          case 'distance':
            // 거리 정보가 있는 경우 거리순 정렬
            if (options.userLocation) {
              filteredResults.forEach(place => {
                if (place.location) {
                  place.distance = calculateDistance(
                    options.userLocation,
                    { lat: place.location.latitude, lng: place.location.longitude }
                  );
                }
              });
              filteredResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
            }
            break;
          default:
            break;
        }
      } else {
        // 기본적으로 검색 점수순 정렬
        filteredResults.sort((a, b) => b.searchScore - a.searchScore);
      }
      
      return { 
        success: true, 
        data: filteredResults, 
        totalResults: filteredResults.length 
      };
      
    } catch (error) {
      console.error("Error searching places:", error);
      return { 
        success: false, 
        error: "검색 중 오류가 발생했습니다", 
        data: [], 
        totalResults: 0 
      };
    }
  },

  // 인기 검색어 가져오기
  getPopularSearches: async () => {
    return [
      "카페",
      "한강",
      "홍대",
      "이태원",
      "강남",
      "북카페"
    ];
  },
  
  // 최근 검색어 가져오기 (사용자 별)
  getRecentSearches: async (userId) => {
    try {
      if (userId) {
        // 로그인한 사용자의 경우 Firestore에서 검색어 가져오기
        const recentSearchesRef = collection(db, 'users', userId, 'recentSearches');
        const q = query(recentSearchesRef, orderBy('timestamp', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } 
      
      // 로그인하지 않은 경우 로컬 스토리지에서 가져오기
      const recentSearches = localStorage.getItem('recentSearches');
      if (recentSearches) {
        return JSON.parse(recentSearches);
      }
      return [];
    } catch (error) {
      console.error("Error getting recent searches:", error);
      return [];
    }
  },
  
  // 최근 검색어 저장하기
  saveRecentSearch: async (userId, searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return null;
    }
    
    try {
      if (!userId) {
        // 로컬 스토리지에 저장 로직은 SearchContext에 구현됨
        return true;
      }
      
      // 로그인한 사용자의 경우 Firestore에 저장
      const recentSearchesRef = collection(db, 'users', userId, 'recentSearches');
      
      // 기존 동일 검색어 확인
      const q = query(recentSearchesRef, where('term', '==', searchTerm));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // 기존 검색어가 있으면 타임스탬프만 업데이트
        const docId = snapshot.docs[0].id;
        await updateDoc(doc(recentSearchesRef, docId), {
          timestamp: serverTimestamp()
        });
      } else {
        // 새 검색어 추가
        await addDoc(recentSearchesRef, {
          term: searchTerm,
          timestamp: serverTimestamp()
        });
        
        // 10개 이상이면 오래된 것 삭제
        const allSearchesQ = query(recentSearchesRef, orderBy('timestamp', 'desc'));
        const allSnapshot = await getDocs(allSearchesQ);
        
        if (allSnapshot.size > 10) {
          const toDelete = allSnapshot.docs.slice(10);
          for (const doc of toDelete) {
            await deleteDoc(doc.ref);
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error saving recent search:", error);
      return false;
    }
  },

  // 검색어 삭제하기
  deleteRecentSearch: async (userId, searchId) => {
    if (!userId) {
      return false;
    }
    
    try {
      // Firestore에서 삭제
      const searchRef = doc(db, 'users', userId, 'recentSearches', searchId);
      await deleteDoc(searchRef);
      return true;
    } catch (error) {
      console.error("Error deleting recent search:", error);
      return false;
    }
  },
  
  // 모든 검색어 삭제하기
  clearAllRecentSearches: async (userId) => {
    if (!userId) {
      return false;
    }
    
    try {
      // 일괄 삭제
      const recentSearchesRef = collection(db, 'users', userId, 'recentSearches');
      const snapshot = await getDocs(recentSearchesRef);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Error clearing recent searches:", error);
      return false;
    }
  }
};

// 두 지점 간의 거리 계산 함수 (km)
function calculateDistance(point1, point2) {
  if (!point1 || !point2 || !point1.lat || !point2.lat) {
    return Infinity;
  }
  
  const toRad = value => (value * Math.PI) / 180;
  
  const R = 6371; // 지구 반경 (km)
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default searchService;
