// src/services/visitService.js
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy,
  limit,
  getNetworkStatus
} from '../config/firebase';
import { getCachedVisits, cacheVisits, clearVisitCache } from './cacheService';

/**
 * 방문 계획 추가
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} placeId - 장소 ID
 * @param {Object} place - 장소 정보 객체
 * @param {Date|string} visitDate - 방문 예정일
 * @param {string} note - 메모 (선택사항)
 * @returns {Promise<string>} - 생성된 방문 계획 ID
 */
export const planVisit = async (userId, placeId, place, visitDate, note = '') => {
  try {
    console.log(`방문 계획 추가 시작 - 사용자: ${userId}, 장소: ${placeId}`);
    
    // 입력값 유효성 검증
    if (!userId) {
      console.error("[방문 서비스] 유효하지 않은 사용자 ID:", userId);
      throw new Error("유효하지 않은 사용자 ID입니다");
    }
    
    if (!placeId) {
      console.error("[방문 서비스] 유효하지 않은 장소 ID:", placeId);
      throw new Error("유효하지 않은 장소 ID입니다");
    }
    
    // 네트워크 상태 확인
    const networkStatus = getNetworkStatus();
    const isOffline = !networkStatus.online;
    
    if (isOffline) {
      console.warn("[방문 서비스] 오프라인 상태에서 방문 계획 추가 시도");
      // 오프라인 작업 큐에 추가하는 로직 구현 가능
      throw new Error("오프라인 상태에서는 방문 계획을 추가할 수 없습니다");
    }
    
    // 방문 계획 컬렉션 참조
    const plannedVisitsRef = collection(db, 'users', userId, 'plannedVisits');
    
    // 날짜 형식 안전하게 변환
    let dateToSave;
    try {
      if (visitDate instanceof Date) {
        dateToSave = visitDate;
      } else if (typeof visitDate === 'string' && visitDate.trim() !== '') {
        dateToSave = new Date(visitDate);
        if (isNaN(dateToSave.getTime())) {
          console.error("[방문 서비스] 잘못된 날짜 문자열:", visitDate);
          dateToSave = new Date(); // 기본값으로 현재 날짜 사용
        }
      } else {
        console.warn("[방문 서비스] 날짜가 제공되지 않음, 현재 날짜 사용");
        dateToSave = new Date();
      }
    } catch (dateError) {
      console.error("[방문 서비스] 날짜 변환 오류:", dateError);
      dateToSave = new Date(); // 오류 발생시 현재 날짜 사용
    }
    
    // place 객체 유효성 검증 및 필수 필드 확인
    const sanitizedPlace = {
      id: placeId,
      name: place?.name || '알 수 없는 장소',
      photos: Array.isArray(place?.photos) ? place.photos : 
              (place?.photo ? [place.photo] : []),
      category: place?.category || '',
      subCategory: place?.subCategory || ''
    };
    
    // 방문 계획 문서 구성
    const visitDoc = {
      userId,
      placeId,
      place: sanitizedPlace,
      visitDate: dateToSave,
      note: note || '',
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log("[방문 서비스] 저장할 방문 계획 데이터:", JSON.stringify(visitDoc, null, 2));
    
    // Firebase에 문서 추가
    const docRef = await addDoc(plannedVisitsRef, visitDoc);
    console.log(`[방문 서비스] 방문 계획 추가 성공: ${docRef.id}`);
    
    // 성공 이벤트 발생
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('visit-plan-added', { 
        detail: { id: docRef.id, placeId, visitDate: dateToSave }
      }));
    }
    
    // 캐시 무효화
    clearVisitCache(`visits_${userId}`);
    
    return docRef.id;
  } catch (error) {
    console.error('[방문 서비스] 방문 계획 추가 오류:', error);
    throw new Error(`방문 계획 추가 중 오류가 발생했습니다: ${error.message}`);
  }
};

/**
 * 사용자의 방문 계획 목록 조회
 * 
 * @param {string} userId - 사용자 ID
 * @param {Object} options - 조회 옵션
 * @returns {Promise<Array>} - 방문 계획 목록
 */
export const getUserPlannedVisits = async (userId, options = {}) => {
  try {
    // 사용자 ID 검증
    if (!userId) {
      console.warn('[방문 서비스] getUserPlannedVisits - 사용자 ID 없음');
      return [];
    }
    
    console.log(`[방문 서비스] ${userId} 사용자의 방문 계획 목록 조회 시작`);
    
    const useCache = options.useCache !== false;
    
    // 캐시 확인
    const cacheKey = `planned_visits_${userId}`;
    if (useCache) {
      const cachedVisits = getCachedVisits(cacheKey);
      if (cachedVisits) {
        console.log(`[방문 서비스] 캐시된 방문 계획 사용: ${cachedVisits.length}개`);
        return cachedVisits;
      }
    }
    
    // 방문 계획 컬렉션 참조
    const plannedVisitsRef = collection(db, 'users', userId, 'plannedVisits');
    
    // 미완료 방문 계획 쿼리 (날짜 오름차순)
    const q = query(
      plannedVisitsRef,
      where('completed', '==', false),
      orderBy('visitDate', 'asc')
    );
    
    // 쿼리 실행
    const querySnapshot = await getDocs(q);
    
    // 방문 계획 없는 경우 빈 배열 반환
    if (querySnapshot.empty) {
      console.log(`[방문 서비스] ${userId} 사용자의 방문 계획 없음`);
      return [];
    }
    
    // 방문 계획 목록 구성
    const plannedVisits = [];
    
    // 각 문서에 대해 처리
    querySnapshot.forEach((doc) => {
      try {
        const data = doc.data();
        
        // 날짜 필드 변환 (타임스탬프 -> Date 객체)
        const formattedData = {
          id: doc.id,
          ...data,
          // 안전한 날짜 변환
          visitDate: data.visitDate?.toDate?.() || data.visitDate || null,
          createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null
        };
        
        plannedVisits.push(formattedData);
      } catch (docError) {
        console.error(`[방문 서비스] 문서 변환 오류 (ID: ${doc.id}):`, docError);
        // 오류가 발생해도 다른 문서는 계속 처리
      }
    });
    
    console.log(`[방문 서비스] ${plannedVisits.length}개 방문 계획 로드 완료`);
    
    // 결과 캐싱
    if (useCache && plannedVisits.length > 0) {
      cacheVisits(cacheKey, plannedVisits);
    }
    
    return plannedVisits;
  } catch (error) {
    console.error('[방문 서비스] 방문 계획 목록 조회 오류:', error);
    // 오류 발생 시 빈 배열 반환 (애플리케이션 계속 작동)
    return [];
  }
};

/**
 * 방문 계획 업데이트
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} visitId - 방문 계획 ID
 * @param {Object} updates - 업데이트할 데이터
 * @returns {Promise<boolean>} - 성공 여부
 */
export const updatePlannedVisit = async (userId, visitId, updates) => {
  try {
    console.log(`[방문 서비스] 방문 계획 업데이트 시작 - ID: ${visitId}`);
    
    // 입력값 검증
    if (!userId || !visitId) {
      throw new Error('사용자 ID와 방문 계획 ID가 필요합니다');
    }
    
    if (!updates || (typeof updates !== 'object')) {
      throw new Error('유효한 업데이트 데이터가 필요합니다');
    }
    
    // 방문 계획 문서 참조
    const visitRef = doc(db, 'users', userId, 'plannedVisits', visitId);
    
    // 방문 계획 문서 가져오기
    const visitDoc = await getDoc(visitRef);
    
    // 방문 계획이 존재하는지 확인
    if (!visitDoc.exists()) {
      throw new Error('방문 계획을 찾을 수 없습니다');
    }
    
    // 사용자 ID 확인
    const visitData = visitDoc.data();
    if (visitData.userId !== userId) {
      throw new Error('다른 사용자의 방문 계획은 수정할 수 없습니다');
    }
    
    // 이미 완료된 방문인지 확인
    if (visitData.completed) {
      throw new Error('이미 완료된 방문은 수정할 수 없습니다');
    }
    
    // 업데이트할 데이터 준비
    const updateData = {
      updatedAt: serverTimestamp()
    };
    
    // 방문 날짜 처리
    if (updates.visitDate !== undefined) {
      try {
        const dateToSave = updates.visitDate instanceof Date ? 
          updates.visitDate : new Date(updates.visitDate);
          
        if (!isNaN(dateToSave.getTime())) {
          updateData.visitDate = dateToSave;
        } else {
          console.warn('[방문 서비스] 잘못된 날짜 형식 무시:', updates.visitDate);
        }
      } catch (dateError) {
        console.error('[방문 서비스] 날짜 변환 오류:', dateError);
        // 잘못된 날짜는 업데이트하지 않음
      }
    }
    
    // 메모 처리
    if (updates.note !== undefined) {
      updateData.note = updates.note;
    }
    
    console.log('[방문 서비스] 업데이트할 데이터:', updateData);
    
    // 방문 계획 업데이트
    await updateDoc(visitRef, updateData);
    console.log(`[방문 서비스] 방문 계획 업데이트 성공 - ID: ${visitId}`);
    
    // 캐시 무효화
    clearVisitCache(`planned_visits_${userId}`);
    
    return true;
  } catch (error) {
    console.error('[방문 서비스] 방문 계획 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 방문 계획 삭제
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} visitId - 방문 계획 ID
 * @returns {Promise<boolean>} - 성공 여부
 */
export const deletePlannedVisit = async (userId, visitId) => {
  try {
    console.log(`[방문 서비스] 방문 계획 삭제 시작 - ID: ${visitId}`);
    
    // 입력값 검증
    if (!userId || !visitId) {
      throw new Error('사용자 ID와 방문 계획 ID가 필요합니다');
    }
    
    // 방문 계획 문서 참조
    const visitRef = doc(db, 'users', userId, 'plannedVisits', visitId);
    
    // 방문 계획 문서 가져오기
    const visitDoc = await getDoc(visitRef);
    
    // 방문 계획이 존재하는지 확인
    if (!visitDoc.exists()) {
      throw new Error('방문 계획을 찾을 수 없습니다');
    }
    
    // 사용자 ID 확인
    const visitData = visitDoc.data();
    if (visitData.userId !== userId) {
      throw new Error('다른 사용자의 방문 계획은 삭제할 수 없습니다');
    }
    
    // 이미 완료된 방문인지 확인
    if (visitData.completed) {
      throw new Error('이미 완료된 방문은 삭제할 수 없습니다');
    }
    
    // 방문 계획 삭제
    await deleteDoc(visitRef);
    console.log(`[방문 서비스] 방문 계획 삭제 성공 - ID: ${visitId}`);
    
    // 캐시 무효화
    clearVisitCache(`planned_visits_${userId}`);
    
    return true;
  } catch (error) {
    console.error('[방문 서비스] 방문 계획 삭제 오류:', error);
    throw error;
  }
};

/**
 * 방문 계획 완료 처리
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} visitId - 방문 계획 ID
 * @returns {Promise<string>} - 생성된 방문 기록 ID
 */
export const completePlannedVisit = async (userId, visitId) => {
  try {
    console.log(`[방문 서비스] 방문 계획 완료 처리 시작 - ID: ${visitId}`);
    
    // 입력값 검증
    if (!userId || !visitId) {
      throw new Error('사용자 ID와 방문 계획 ID가 필요합니다');
    }
    
    // 방문 계획 문서 참조
    const visitRef = doc(db, 'users', userId, 'plannedVisits', visitId);
    
    // 방문 계획 문서 가져오기
    const visitDoc = await getDoc(visitRef);
    
    // 방문 계획이 존재하는지 확인
    if (!visitDoc.exists()) {
      throw new Error('방문 계획을 찾을 수 없습니다');
    }
    
    // 사용자 ID 확인
    const visitData = visitDoc.data();
    if (visitData.userId !== userId) {
      throw new Error('다른 사용자의 방문 계획은 완료 처리할 수 없습니다');
    }
    
    // 이미 완료된 방문인지 확인
    if (visitData.completed) {
      throw new Error('이미 완료된 방문입니다');
    }
    
    // 트랜잭션으로 처리하는 것이 안전함 - 향후 개선 가능
    
    // 방문 기록 컬렉션 참조
    const historyRef = collection(db, 'users', userId, 'visitHistory');
    
    // 방문 기록 문서 생성
    const historyDoc = {
      userId,
      placeId: visitData.placeId,
      place: visitData.place || {
        id: visitData.placeId,
        name: '알 수 없는 장소'
      },
      visitDate: visitData.visitDate,
      plannedVisitId: visitId,
      note: visitData.note || '',
      rating: 0,
      review: '',
      completed: true,
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // 방문 기록 추가
    const historyDocRef = await addDoc(historyRef, historyDoc);
    console.log(`[방문 서비스] 방문 기록 추가 성공 - ID: ${historyDocRef.id}`);
    
    // 방문 계획 완료 처리
    await updateDoc(visitRef, {
      completed: true,
      completedAt: serverTimestamp(),
      historyId: historyDocRef.id, // 방문 기록 ID 저장
      updatedAt: serverTimestamp()
    });
    
    console.log(`[방문 서비스] 방문 계획 완료 처리 성공 - ID: ${visitId}`);
    
    // 캐시 무효화
    clearVisitCache(`planned_visits_${userId}`);
    clearVisitCache(`visit_history_${userId}`);
    
    return historyDocRef.id;
  } catch (error) {
    console.error('[방문 서비스] 방문 계획 완료 처리 오류:', error);
    throw error;
  }
};

/**
 * 사용자의 방문 기록 목록 조회
 * 
 * @param {string} userId - 사용자 ID
 * @param {Object} options - 조회 옵션 (limit, 등)
 * @returns {Promise<Object>} - 방문 기록 목록, 마지막 문서, 더 있는지 여부
 */
export const getUserVisitHistory = async (userId, options = {}) => {
  try {
    // 사용자 ID 검증
    if (!userId) {
      console.warn('[방문 서비스] getUserVisitHistory - 사용자 ID 없음');
      return { history: [], lastDoc: null, hasMore: false };
    }
    
    console.log(`[방문 서비스] ${userId} 사용자의 방문 기록 목록 조회 시작`);
    
    const { limit: maxResults = 50, useCache = true } = options;
    
    // 캐시 키 생성
    const cacheKey = `visit_history_${userId}_${maxResults}`;
    
    // 캐시 확인
    if (useCache) {
      const cachedHistory = getCachedVisits(cacheKey);
      if (cachedHistory) {
        console.log(`[방문 서비스] 캐시된 방문 기록 사용: ${cachedHistory.history.length}개`);
        return cachedHistory;
      }
    }
    
    // 방문 기록 컬렉션 참조
    const historyRef = collection(db, 'users', userId, 'visitHistory');
    
    // 방문 기록 쿼리 (최근 순)
    const q = query(
      historyRef,
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );
    
    // 쿼리 실행
    const querySnapshot = await getDocs(q);
    
    // 방문 기록 없는 경우 빈 배열 반환
    if (querySnapshot.empty) {
      console.log(`[방문 서비스] ${userId} 사용자의 방문 기록 없음`);
      return { history: [], lastDoc: null, hasMore: false };
    }
    
    // 방문 기록 목록 구성
    const visitHistory = [];
    
    // 각 문서에 대해 처리
    querySnapshot.forEach((doc) => {
      try {
        const data = doc.data();
        
        // 날짜 필드 변환 (타임스탬프 -> Date 객체)
        const formattedData = {
          id: doc.id,
          ...data,
          // 안전한 날짜 변환
          visitDate: data.visitDate?.toDate?.() || data.visitDate || null,
          completedAt: data.completedAt?.toDate?.() || data.completedAt || null,
          createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null
        };
        
        visitHistory.push(formattedData);
      } catch (docError) {
        console.error(`[방문 서비스] 문서 변환 오류 (ID: ${doc.id}):`, docError);
        // 오류가 발생해도 다른 문서는 계속 처리
      }
    });
    
    console.log(`[방문 서비스] ${visitHistory.length}개 방문 기록 로드 완료`);
    
    // 마지막 문서 저장 (페이지네이션용)
    const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
    
    const result = {
      history: visitHistory,
      lastDoc,
      hasMore: visitHistory.length === maxResults
    };
    
    // 결과 캐싱
    if (useCache) {
      cacheVisits(cacheKey, result);
    }
    
    return result;
  } catch (error) {
    console.error('[방문 서비스] 방문 기록 목록 조회 오류:', error);
    // 오류 발생 시 빈 배열 반환 (애플리케이션 계속 작동)
    return { history: [], lastDoc: null, hasMore: false };
  }
};

/**
 * 방문 리뷰 추가
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} visitId - 방문 ID
 * @param {number} rating - 평점 (0-5)
 * @param {string} review - 리뷰 텍스트
 * @returns {Promise<boolean>} - 성공 여부
 */
export const addVisitReview = async (userId, visitId, rating, review = '') => {
  try {
    console.log(`[방문 서비스] 방문 리뷰 추가 시작 - 방문 ID: ${visitId}, 유저 ID: ${userId}`);
    console.log(`[방문 서비스] 원본 리뷰 데이터 - 평점: ${rating}, 리뷰: "${review}", 타입: ${typeof review}`);
    
    // 입력값 검증
    if (!userId || !visitId) {
      console.error("[방문 서비스] userId 또는 visitId가 없음:", { userId, visitId });
      throw new Error('사용자 ID와 방문 ID가 필요합니다');
    }
    
    // 평점 정규화
    let numericRating = 0;
    if (rating !== undefined && rating !== null) {
      numericRating = Number(rating);
      if (isNaN(numericRating)) {
        console.warn("[방문 서비스] 잘못된 평점 형식:", rating);
        numericRating = 0;
      }
      
      // 범위 제한
      numericRating = Math.max(0, Math.min(5, numericRating));
    }
    
    // 리뷰 텍스트 정규화 (undefined, null, 빈 문자열 등 처리)
    let reviewText = '';
    
    if (review !== undefined && review !== null) {
      // 명시적으로 문자열로 변환
      reviewText = String(review);
    }
    
    console.log(`[방문 서비스] 정규화된 리뷰 데이터 - 평점: ${numericRating}, 리뷰 텍스트: "${reviewText}", 길이: ${reviewText.length}`);
    
    // 방문 기록 문서 참조
    const visitRef = doc(db, 'users', userId, 'visitHistory', visitId);
    
    // 방문 기록 문서 가져오기
    const visitDoc = await getDoc(visitRef);
    
    // 방문 기록이 존재하는지 확인
    if (!visitDoc.exists()) {
      console.error(`[방문 서비스] 방문 기록 없음 - 방문 ID: ${visitId}`);
      throw new Error('방문 기록을 찾을 수 없습니다');
    }
    
    // 사용자 ID 확인
    const visitData = visitDoc.data();
    if (visitData.userId !== userId) {
      console.error(`[방문 서비스] 사용자 ID 불일치 - 문서: ${visitData.userId}, 요청: ${userId}`);
      throw new Error('다른 사용자의 방문 기록에는 리뷰를 작성할 수 없습니다');
    }
    
    // 리뷰 데이터 준비
    const reviewData = {
      rating: numericRating,
      review: reviewText,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    console.log(`[방문 서비스] 저장할 리뷰 데이터:`, JSON.stringify(reviewData));
    
    // 리뷰 추가
    await updateDoc(visitRef, reviewData);
    console.log(`[방문 서비스] 리뷰 추가 성공 - 방문 ID: ${visitId}`);
    
    // 캐시 무효화
    clearVisitCache(`visit_history_${userId}`);
    
    // 장소의 전체 평점 업데이트
    if (visitData.placeId) {
      await updatePlaceRating(visitData.placeId, numericRating);
    }
    
    // 통합 리뷰 컬렉션에도 저장
    if (numericRating > 0) {
      try {
        await saveUserReview(userId, visitData.placeId, {
          rating: numericRating,
          content: reviewText,
          visitDate: visitData.visitDate,
          visitId: visitId
        });
        console.log(`[방문 서비스] 통합 리뷰 저장 완료 - 장소: ${visitData.placeId}`);
      } catch (reviewError) {
        console.error('[방문 서비스] 통합 리뷰 저장 오류:', reviewError);
        // 통합 리뷰 저장 실패는 전체 프로세스에 영향을 주지 않음
      }
    }
    
    return true;
  } catch (error) {
    console.error('[방문 서비스] 리뷰 추가 오류:', error);
    throw error;
  }
};

/**
 * 직접 방문 추가 (방문 계획 없이)
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} placeId - 장소 ID
 * @param {Object} place - 장소 정보
 * @param {Date|string} visitDate - 방문 날짜
 * @param {string} note - 메모
 * @returns {Promise<string>} - 생성된 방문 기록 ID
 */
export const addDirectVisit = async (userId, placeId, place, visitDate = new Date(), note = '') => {
  try {
    console.log(`[방문 서비스] 직접 방문 추가 시작 - 사용자: ${userId}, 장소: ${placeId}`);
    
    // 입력값 검증
    if (!userId || !placeId) {
      throw new Error('사용자 ID와 장소 ID가 필요합니다');
    }
    
    // 방문 기록 컬렉션 참조
    const historyRef = collection(db, 'users', userId, 'visitHistory');
    
    // 날짜 형식 안전하게 변환
    let dateToSave;
    try {
      if (visitDate instanceof Date) {
        dateToSave = visitDate;
      } else if (typeof visitDate === 'string' && visitDate.trim() !== '') {
        dateToSave = new Date(visitDate);
        if (isNaN(dateToSave.getTime())) {
          console.error("[방문 서비스] 잘못된 날짜 문자열:", visitDate);
          dateToSave = new Date(); // 기본값으로 현재 날짜 사용
        }
      } else {
        console.warn("[방문 서비스] 날짜가 제공되지 않음, 현재 날짜 사용");
        dateToSave = new Date();
      }
    } catch (dateError) {
      console.error("[방문 서비스] 날짜 변환 오류:", dateError);
      dateToSave = new Date(); // 오류 발생시 현재 날짜 사용
    }
    
    // place 객체 유효성 검증 및 필수 필드 확인
    const sanitizedPlace = {
      id: placeId,
      name: place?.name || '알 수 없는 장소',
      photos: Array.isArray(place?.photos) ? place.photos : 
              (place?.photo ? [place.photo] : []),
      category: place?.category || '',
      subCategory: place?.subCategory || ''
    };
    
    // 방문 기록 추가
    const visitDoc = {
      userId,
      placeId,
      place: sanitizedPlace,
      visitDate: dateToSave,
      isDirectVisit: true,
      note: note || '',
      rating: 0,
      review: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Firebase에 문서 추가
    const docRef = await addDoc(historyRef, visitDoc);
    console.log(`[방문 서비스] 직접 방문 추가 성공 - ID: ${docRef.id}`);
    
    // 캐시 무효화
    clearVisitCache(`visit_history_${userId}`);
    
    return docRef.id;
  } catch (error) {
    console.error('[방문 서비스] 직접 방문 추가 오류:', error);
    throw new Error(`방문 추가 중 오류가 발생했습니다: ${error.message}`);
  }
};

/**
 * 장소 특정 일자 방문 여부 확인
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} placeId - 장소 ID
 * @param {Date|string} date - 확인할 날짜
 * @returns {Promise<boolean>} - 방문 여부
 */
export const checkVisitedOnDate = async (userId, placeId, date) => {
  try {
    if (!userId || !placeId || !date) {
      return false;
    }
    
    // 날짜 변환 (시간 부분은 제외)
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    // 다음 날짜 계산
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // 방문 기록 컬렉션 참조
    const historyRef = collection(db, 'users', userId, 'visitHistory');
    
    // 특정 날짜에 특정 장소 방문 여부 쿼리
    const q = query(
      historyRef,
      where('placeId', '==', placeId),
      where('visitDate', '>=', targetDate),
      where('visitDate', '<', nextDate)
    );
    
    // 쿼리 실행
    const querySnapshot = await getDocs(q);
    
    // 방문 기록이 있으면 true 반환
    return !querySnapshot.empty;
  } catch (error) {
    console.error('[방문 서비스] 방문 여부 확인 오류:', error);
    return false;
  }
};

/**
 * 장소 평점 업데이트
 * 
 * @param {string} placeId - 장소 ID
 * @param {number} rating - 새 평점
 * @returns {Promise<void>}
 */
const updatePlaceRating = async (placeId, rating) => {
  try {
    if (!placeId) return;
    
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) {
      console.warn(`[방문 서비스] 장소가 존재하지 않음: ${placeId}`);
      return;
    }
    
    const placeData = placeDoc.data();
    const currentRating = placeData.averageRating || 0;
    const reviewCount = placeData.reviewCount || 0;
    
    // 새 평균 평점 계산
    const newReviewCount = reviewCount + 1;
    const newRating = (currentRating * reviewCount + rating) / newReviewCount;
    
    await updateDoc(placeRef, {
      averageRating: newRating,
      reviewCount: newReviewCount,
      lastReviewDate: serverTimestamp()
    });
    
    console.log(`[방문 서비스] 장소 평점 업데이트 완료: ${placeId}, 새 평점: ${newRating.toFixed(2)}`);
  } catch (error) {
    console.error('[방문 서비스] 장소 평점 업데이트 오류:', error);
  }
};

/**
 * 사용자 리뷰 데이터 저장 (통합 리뷰 시스템용)
 * 
 * @param {string} userId - 사용자 ID
 * @param {string} placeId - 장소 ID
 * @param {Object} reviewData - 리뷰 데이터
 * @returns {Promise<void>}
 */
const saveUserReview = async (userId, placeId, reviewData) => {
  try {
    // 리뷰 컬렉션 참조
    const reviewsRef = collection(db, 'reviews');
    
    // 기존 리뷰 확인 쿼리
    const q = query(
      reviewsRef,
      where('userId', '==', userId),
      where('placeId', '==', placeId)
    );
    
    const querySnapshot = await getDocs(q);
    
    // 리뷰 내용 로깅
    console.log(`[방문 서비스] 통합 리뷰 저장 - 내용: "${reviewData.content}", 타입: ${typeof reviewData.content}`);
    
    // 리뷰 데이터 정규화
    const normalizedReviewData = {
      userId,
      placeId,
      rating: Number(reviewData.rating) || 0,
      content: reviewData.content != null ? String(reviewData.content).trim() : '',
      visitDate: reviewData.visitDate || null,
      visitId: reviewData.visitId,
      updatedAt: serverTimestamp()
    };
    
    console.log(`[방문 서비스] 정규화된 통합 리뷰 데이터:`, JSON.stringify(normalizedReviewData));
    
    if (!querySnapshot.empty) {
      // 기존 리뷰 업데이트
      const reviewDoc = querySnapshot.docs[0];
      await updateDoc(doc(reviewsRef, reviewDoc.id), normalizedReviewData);
      console.log(`[방문 서비스] 기존 리뷰 업데이트 완료: ${reviewDoc.id}`);
    } else {
      // 새 리뷰 추가
      normalizedReviewData.createdAt = serverTimestamp();
      const newReviewRef = await addDoc(reviewsRef, normalizedReviewData);
      console.log(`[방문 서비스] 새 리뷰 추가 완료: ${newReviewRef.id}`);
    }
  } catch (error) {
    console.error('[방문 서비스] 사용자 리뷰 저장 오류:', error);
    throw error; // 이 부분을 수정해 에러를 상위로 전파하여 디버깅을 용이하게 함
  }
};

// 기본 내보내기
const visitService = {
  planVisit,
  getUserPlannedVisits,
  updatePlannedVisit,
  deletePlannedVisit,
  completePlannedVisit,
  getUserVisitHistory,
  addVisitReview,
  addDirectVisit,
  checkVisitedOnDate
};

export default visitService;
