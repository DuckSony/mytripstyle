/**
 * collaborativeFiltering.js
 * 
 * 유사 사용자 기반 협업 필터링 알고리즘을 구현하는 유틸리티 모듈
 * 사용자 간 유사도 계산 및 협업 추천 생성 기능을 제공합니다.
 */

import { db } from '../config/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

/**
 * 목표 사용자와 유사한 사용자들을 찾는 함수
 * @param {Object} targetUser - 목표 사용자 정보
 * @param {Object} options - 유사도 계산 옵션
 * @returns {Promise<Array>} - 유사도 점수와 함께 정렬된 유사 사용자 배열
 */
export const findSimilarUsers = async (targetUser, options = {}) => {
  if (!targetUser || !targetUser.mbti) {
    throw new Error('유효한 사용자 정보가 필요합니다 (MBTI 필수)');
  }
  
  try {
    const { 
      mbtiWeight = 0.4, 
      interestsWeight = 0.3,
      talentsWeight = 0.2,
      locationWeight = 0.1,
      threshold = 0.5,
      maxUsers = 20,
      excludeUserId = null
    } = options;
    
    // 1. MBTI 유형이 같은 사용자 풀 가져오기 (기본 필터링)
    const usersRef = collection(db, 'users');
    const mbtiQuery = query(
      usersRef,
      where('mbti', '==', targetUser.mbti),
      limit(100) // 최대 100명 가져와서 추가 필터링
    );
    
    const snapshot = await getDocs(mbtiQuery);
    
    if (snapshot.empty) {
      return { success: true, data: [] };
    }
    
    // 2. 각 사용자와의 유사도 계산
    const similarities = [];
    
    snapshot.forEach(doc => {
      // 자기 자신 제외
      if (excludeUserId && doc.id === excludeUserId) return;
      
      const userData = doc.data();
      
      // 유사도 계산
      const similarity = calculateUserSimilarity(
        targetUser, 
        { id: doc.id, ...userData }, 
        { mbtiWeight, interestsWeight, talentsWeight, locationWeight }
      );
      
      // 임계값 이상인 경우만 포함
      if (similarity >= threshold) {
        similarities.push({
          userId: doc.id,
          similarity: parseFloat(similarity.toFixed(3)),
          mbti: userData.mbti,
          interests: userData.interests || [],
          talents: userData.talents || []
        });
      }
    });
    
    // 3. 유사도 기준 내림차순 정렬 및 결과 반환
    const sortedUsers = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxUsers);
    
    return { 
      success: true, 
      data: sortedUsers
    };
  } catch (error) {
    console.error('유사 사용자 검색 오류:', error);
    return { 
      success: false, 
      error: error.message, 
      data: [] 
    };
  }
};

/**
 * 두 사용자 간의 유사도를 계산하는 함수
 * @param {Object} user1 - 첫 번째 사용자 정보
 * @param {Object} user2 - 두 번째 사용자 정보
 * @param {Object} weights - 각 요소별 가중치
 * @returns {number} - 유사도 점수 (0-1)
 */
export const calculateUserSimilarity = (user1, user2, weights = {}) => {
  const { 
    mbtiWeight = 0.4, 
    interestsWeight = 0.3,
    talentsWeight = 0.2,
    locationWeight = 0.1
  } = weights;
  
  // MBTI 유사도 (같으면 1, 다르면 유사도 계산)
  let mbtiSimilarity = 0;
  if (user1.mbti === user2.mbti) {
    mbtiSimilarity = 1;
  } else if (user1.mbti && user2.mbti) {
    // MBTI 유형 간 유사도 계산 (4개 지표별 비교)
    mbtiSimilarity = calculateMbtiSimilarity(user1.mbti, user2.mbti);
  }
  
  // 관심사 유사도 (Jaccard 계수)
  const interestsSimilarity = calculateSetSimilarity(
    user1.interests || [], 
    user2.interests || []
  );
  
  // 재능 유사도 (Jaccard 계수)
  const talentsSimilarity = calculateSetSimilarity(
    user1.talents || [], 
    user2.talents || []
  );
  
  // 위치 유사도 (선호 지역 기반)
  const locationSimilarity = calculateLocationSimilarity(
    user1.preferredLocations || [], 
    user2.preferredLocations || []
  );
  
  // 가중 평균으로 종합 유사도 계산
  const totalSimilarity = 
    mbtiSimilarity * mbtiWeight +
    interestsSimilarity * interestsWeight +
    talentsSimilarity * talentsWeight +
    locationSimilarity * locationWeight;
    
  return totalSimilarity;
};

/**
 * 두 집합 간의 유사도를 계산하는 함수 (Jaccard 계수)
 * @param {Array} set1 - 첫 번째 집합
 * @param {Array} set2 - 두 번째 집합
 * @returns {number} - 유사도 점수 (0-1)
 */
export const calculateSetSimilarity = (set1, set2) => {
  if (!Array.isArray(set1) || !Array.isArray(set2)) return 0;
  if (set1.length === 0 && set2.length === 0) return 1; // 둘 다 비어있으면 완전 유사
  if (set1.length === 0 || set2.length === 0) return 0; // 한쪽만 비어있으면 불일치
  
  // 두 집합의 교집합 크기
  const intersection = set1.filter(item => 
    set2.some(item2 => 
      item.toLowerCase() === item2.toLowerCase()
    )
  ).length;
  
  // 두 집합의 합집합 크기
  const union = new Set([
    ...set1.map(item => item.toLowerCase()),
    ...set2.map(item => item.toLowerCase())
  ]).size;
  
  // Jaccard 계수 = 교집합 크기 / 합집합 크기
  return intersection / union;
};

/**
 * 두 MBTI 유형 간의 유사도를 계산하는 함수
 * @param {string} mbti1 - 첫 번째 MBTI 유형
 * @param {string} mbti2 - 두 번째 MBTI 유형
 * @returns {number} - 유사도 점수 (0-1)
 */
export const calculateMbtiSimilarity = (mbti1, mbti2) => {
  if (!mbti1 || !mbti2 || mbti1.length !== 4 || mbti2.length !== 4) {
    return 0;
  }
  
  // 같은 유형이면 완전 유사
  if (mbti1 === mbti2) return 1;
  
  // 각 지표별 일치 여부 확인 (E/I, S/N, T/F, J/P)
  let matchingTraits = 0;
  for (let i = 0; i < 4; i++) {
    if (mbti1[i] === mbti2[i]) {
      matchingTraits++;
    }
  }
  
  // 유사도 계산 (일치하는 지표 수 / 전체 지표 수)
  return matchingTraits / 4;
};

/**
 * 두 사용자의 위치 선호도 간 유사도를 계산하는 함수
 * @param {Array} locations1 - 첫 번째 사용자의 선호 지역 목록
 * @param {Array} locations2 - 두 번째 사용자의 선호 지역 목록
 * @returns {number} - 유사도 점수 (0-1)
 */
export const calculateLocationSimilarity = (locations1, locations2) => {
  if (!Array.isArray(locations1) || !Array.isArray(locations2)) return 0;
  if (locations1.length === 0 && locations2.length === 0) return 1; // 둘 다 비어있으면 완전 유사
  if (locations1.length === 0 || locations2.length === 0) return 0; // 한쪽만 비어있으면 불일치
  
  // 지역 이름 또는 코드만 추출
  const regions1 = locations1.map(loc => loc.region || loc.name || '').filter(Boolean);
  const regions2 = locations2.map(loc => loc.region || loc.name || '').filter(Boolean);
  
  // 세부 지역 추가
  const subRegions1 = locations1
    .map(loc => loc.subRegion)
    .filter(Boolean);
  const subRegions2 = locations2
    .map(loc => loc.subRegion)
    .filter(Boolean);
  
  // 모든 지역 정보 통합
  const allRegions1 = [...regions1, ...subRegions1];
  const allRegions2 = [...regions2, ...subRegions2];
  
  // Jaccard 유사도 계산
  return calculateSetSimilarity(allRegions1, allRegions2);
};

/**
 * 유사 사용자 기반 협업 필터링 추천 생성
 * @param {Array} similarUsers - 유사 사용자 배열
 * @param {Array} currentUserPlaces - 현재 사용자의 평가 장소 배열
 * @param {number} limit - 결과 개수 제한
 * @returns {Promise<Array>} - 추천 장소 배열
 */
export const generateCollaborativeRecommendations = async (similarUsers, currentUserPlaces = [], limit = 10) => {
  if (!similarUsers || !Array.isArray(similarUsers) || similarUsers.length === 0) {
    return { success: false, error: '유사 사용자 데이터가 필요합니다', data: [] };
  }
  
  try {
    // 현재 사용자가 이미 방문/평가한 장소 ID 집합
    const visitedPlaceIds = new Set(
      currentUserPlaces.map(p => p.placeId || p.id)
    );
    
    // 유사 사용자 ID 목록
    const userIds = similarUsers.map(user => user.userId);
    
    // 유사 사용자들의 높은 평가 장소 가져오기
    const visitHistoryRef = collection(db, 'visitHistory');
    const highRatingQuery = query(
      visitHistoryRef,
      where('userId', 'in', userIds),
      where('rating', '>=', 4),
      limit(50)
    );
    
    const snapshot = await getDocs(highRatingQuery);
    
    if (snapshot.empty) {
      return { success: true, data: [] };
    }
    
    // 장소별 가중 점수 맵
    const placeScores = new Map();
    
    // 각 유사 사용자의 장소 평가를 가중치와 함께 집계
    snapshot.forEach(doc => {
      const visit = doc.data();
      
      // 현재 사용자가 이미 방문한 장소 제외
      if (visitedPlaceIds.has(visit.placeId)) return;
      
      // 해당 사용자의 유사도 찾기
      const user = similarUsers.find(u => u.userId === visit.userId);
      if (!user) return;
      
      // 유사도와 평점을 결합한 가중 점수 계산
      const weightedScore = visit.rating * user.similarity;
      
      // 장소별 점수 및 평가 횟수 누적
      if (!placeScores.has(visit.placeId)) {
        placeScores.set(visit.placeId, { 
          totalScore: 0, 
          count: 0, 
          users: [],
          placeInfo: visit.placeInfo || null
        });
      }
      
      const placeData = placeScores.get(visit.placeId);
      placeData.totalScore += weightedScore;
      placeData.count++;
      placeData.users.push({
        userId: visit.userId,
        similarity: user.similarity,
        rating: visit.rating
      });
      
      // 장소 정보가 없는 경우 업데이트
      if (!placeData.placeInfo && visit.placeInfo) {
        placeData.placeInfo = visit.placeInfo;
      }
    });
    
    // 평균 점수로 정렬하여 상위 N개 선택
    const recommendations = Array.from(placeScores.entries())
      .map(([placeId, data]) => ({
        placeId,
        averageScore: data.totalScore / data.count,
        evaluationCount: data.count,
        placeInfo: data.placeInfo,
        contributingUsers: data.users
      }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, limit);
    
    // 추천된 장소들의 전체 정보 가져오기
    const enrichedRecommendations = await enrichPlaceData(recommendations);
    
    return { 
      success: true, 
      data: enrichedRecommendations 
    };
  } catch (error) {
    console.error('협업 필터링 추천 오류:', error);
    return { 
      success: false, 
      error: error.message,
      data: [] 
    };
  }
};

/**
 * 장소 ID 목록에 대한 상세 정보 조회
 * @param {Array} recommendations - 장소 ID와 기본 정보를 포함한 추천 배열
 * @returns {Promise<Array>} - 상세 정보가 포함된 추천 배열
 */
const enrichPlaceData = async (recommendations) => {
  if (!recommendations || recommendations.length === 0) return [];
  
  try {
    // 각 장소의 상세 정보 가져오기
    const enrichedResults = await Promise.all(
      recommendations.map(async recommendation => {
        // 이미 장소 정보가 있는 경우 그대로 사용
        if (recommendation.placeInfo && 
            Object.keys(recommendation.placeInfo).length > 5) {
          return {
            ...recommendation,
            ...recommendation.placeInfo,
            id: recommendation.placeId,
            matchScore: recommendation.averageScore * 10,
            collaborativeScore: recommendation.averageScore
          };
        }
        
        // 그렇지 않은 경우 장소 정보 조회
        try {
          const placeDoc = await db.collection('places').doc(recommendation.placeId).get();
          
          if (placeDoc.exists) {
            const placeData = placeDoc.data();
            return {
              ...recommendation,
              ...placeData,
              id: recommendation.placeId,
              matchScore: recommendation.averageScore * 10,
              collaborativeScore: recommendation.averageScore
            };
          } else {
            // 장소 정보를 찾을 수 없는 경우 기본 정보만 반환
            return {
              ...recommendation,
              id: recommendation.placeId,
              name: '장소 정보 없음',
              matchScore: recommendation.averageScore * 10,
              collaborativeScore: recommendation.averageScore
            };
          }
        } catch (error) {
          console.error(`장소 ${recommendation.placeId} 정보 조회 오류:`, error);
          return {
            ...recommendation,
            id: recommendation.placeId,
            error: '정보 조회 오류',
            matchScore: recommendation.averageScore * 10
          };
        }
      })
    );
    
    return enrichedResults;
  } catch (error) {
    console.error('장소 데이터 강화 오류:', error);
    return recommendations;
  }
};

/**
 * 사용자 간 유사도 매트릭스 계산
 * @param {Array} users - 사용자 배열
 * @returns {Object} - 사용자 ID 쌍을 키로 하는 유사도 맵
 */
export const generateSimilarityMatrix = (users) => {
  if (!users || !Array.isArray(users) || users.length < 2) {
    return {};
  }
  
  const matrix = {};
  
  // 모든 사용자 쌍에 대해 유사도 계산
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const user1 = users[i];
      const user2 = users[j];
      
      // 유사도 계산
      const similarity = calculateUserSimilarity(user1, user2);
      
      // 행렬에 저장 (양방향)
      const key1 = `${user1.id}_${user2.id}`;
      const key2 = `${user2.id}_${user1.id}`;
      
      matrix[key1] = similarity;
      matrix[key2] = similarity;
    }
  }
  
  return matrix;
};

/**
 * 현재 사용자와 가장 유사한 사용자의 최근 방문 장소 추천
 * @param {string} userId - 현재 사용자 ID
 * @param {Object} userProfile - 현재 사용자 프로필
 * @param {number} limit - 결과 개수 제한
 * @returns {Promise<Array>} - 추천 장소 배열
 */
export const getRecentVisitsFromSimilarUsers = async (userId, userProfile, limit = 5) => {
  try {
    // 1. 유사 사용자 찾기
    const similarUsersResult = await findSimilarUsers(userProfile, {
      threshold: 0.6,
      maxUsers: 10,
      excludeUserId: userId
    });
    
    if (!similarUsersResult.success || similarUsersResult.data.length === 0) {
      return { success: true, data: [] };
    }
    
    const similarUsers = similarUsersResult.data;
    
    // 2. 현재 사용자가 방문한 장소 목록 가져오기
    const userVisits = await getUserVisitedPlaces(userId);
    
    // 3. 유사 사용자들의 최근 방문 장소 가져오기
    const recentVisits = await getRecentVisitsForUsers(
      similarUsers.map(user => user.userId),
      20
    );
    
    // 4. 이미 방문한 장소 제외 및 유사도 점수 적용
    const userVisitedPlaceIds = new Set(userVisits.map(visit => visit.placeId));
    
    const scoredRecommendations = recentVisits
      .filter(visit => !userVisitedPlaceIds.has(visit.placeId))
      .map(visit => {
        // 해당 사용자의 유사도 찾기
        const similarUser = similarUsers.find(user => user.userId === visit.userId);
        const similarityScore = similarUser ? similarUser.similarity : 0;
        
        // 최종 점수 계산
        const finalScore = similarityScore * (visit.rating / 5);
        
        return {
          ...visit,
          similarityScore,
          finalScore,
          recommendationSource: 'similar_user_visit'
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);
    
    // 5. 중복 제거 (같은 장소 여러 사용자 방문)
    const uniquePlaces = [];
    const seenPlaceIds = new Set();
    
    for (const recommendation of scoredRecommendations) {
      if (!seenPlaceIds.has(recommendation.placeId)) {
        uniquePlaces.push(recommendation);
        seenPlaceIds.add(recommendation.placeId);
        
        if (uniquePlaces.length >= limit) break;
      }
    }
    
    // 6. 장소 상세 정보 보강
    const enrichedRecommendations = await enrichPlaceData(uniquePlaces);
    
    return { 
      success: true, 
      data: enrichedRecommendations 
    };
    
  } catch (error) {
    console.error('유사 사용자 최근 방문 조회 오류:', error);
    return { 
      success: false, 
      error: error.message,
      data: [] 
    };
  }
};

/**
 * 특정 사용자가 방문한 장소 목록 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Array>} - 방문 장소 배열
 */
const getUserVisitedPlaces = async (userId) => {
  try {
    const visitHistoryRef = collection(db, 'visitHistory');
    const visitsQuery = query(
      visitHistoryRef,
      where('userId', '==', userId),
      limit(100)
    );
    
    const snapshot = await getDocs(visitsQuery);
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('사용자 방문 기록 조회 오류:', error);
    return [];
  }
};

/**
 * 특정 사용자들의 최근 방문 장소 조회
 * @param {Array} userIds - 사용자 ID 배열
 * @param {number} limit - 결과 개수 제한
 * @returns {Promise<Array>} - 최근 방문 장소 배열
 */
const getRecentVisitsForUsers = async (userIds, limit = 20) => {
  if (!userIds || userIds.length === 0) return [];
  
  try {
    // Firestore의 in 쿼리는 10개 이하의 값만 지원
    // 따라서 사용자 그룹별로 나누어 쿼리
    const MAX_BATCH_SIZE = 10;
    const userBatches = [];
    
    for (let i = 0; i < userIds.length; i += MAX_BATCH_SIZE) {
      userBatches.push(userIds.slice(i, i + MAX_BATCH_SIZE));
    }
    
    // 각 배치별로 쿼리 실행
    const allVisits = [];
    
    for (const batch of userBatches) {
      const visitHistoryRef = collection(db, 'visitHistory');
      const visitsQuery = query(
        visitHistoryRef,
        where('userId', 'in', batch),
        where('status', '==', 'completed'),
        limit(limit)
      );
      
      const snapshot = await getDocs(visitsQuery);
      
      snapshot.forEach(doc => {
        allVisits.push(doc.data());
      });
    }
    
    // 방문 날짜 기준 내림차순 정렬
    return allVisits.sort((a, b) => {
      const dateA = a.visitDate ? new Date(a.visitDate) : new Date(0);
      const dateB = b.visitDate ? new Date(b.visitDate) : new Date(0);
      return dateB - dateA;
    });
    
  } catch (error) {
    console.error('최근 방문 장소 조회 오류:', error);
    return [];
  }
};

const collaborativeFilteringUtils = {
    findSimilarUsers,
    calculateUserSimilarity,
    calculateSetSimilarity,
    calculateMbtiSimilarity,
    calculateLocationSimilarity,
    generateCollaborativeRecommendations,
    generateSimilarityMatrix,
    getRecentVisitsFromSimilarUsers
  };
  
  export default collaborativeFilteringUtils;
