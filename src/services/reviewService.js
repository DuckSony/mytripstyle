// src/services/reviewService.js
import { db, collection, addDoc, doc, getDoc, getDocs, updateDoc, deleteDoc, 
  query, where, orderBy, serverTimestamp, setDoc } from '../config/firebase';
import { getCachedReviews, cacheReviews, clearReviewCache } from './cacheService';

// 오프라인 상태 확인 유틸리티 함수
const isOffline = () => {
  return typeof navigator !== 'undefined' && !navigator.onLine;
};

// 오프라인 작업 큐에 항목 추가 유틸리티 함수
const addToOfflineQueue = async (operation, data) => {
  try {
    // 기존 오프라인 작업 큐 가져오기
    const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
    
    // 새 작업 추가
    queue.push({
      operation,
      data,
      timestamp: new Date().toISOString(),
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    
    // 저장
    localStorage.setItem('reviewOperationsQueue', JSON.stringify(queue));
    console.log(`오프라인 작업 큐에 ${operation} 추가됨`);
    return true;
  } catch (error) {
    console.error('오프라인 큐 저장 오류:', error);
    return false;
  }
};

// 모든 리뷰 가져오기
export const fetchReviews = async (placeId, options = {}) => {
  try {
    // 입력 유효성 검사
    if (!placeId) {
      console.warn('fetchReviews: 유효하지 않은 장소 ID');
      return { success: false, error: '유효하지 않은 장소 ID', data: [] };
    }
    
    const maxResults = options.limit || 50;
    const useCache = options.useCache !== false;
    
    // 캐시 확인
    const cacheKey = `reviews_${placeId}_${maxResults}`;
    if (useCache) {
      const cachedReviews = getCachedReviews(cacheKey);
      if (cachedReviews) {
        return { success: true, data: cachedReviews, fromCache: true };
      }
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.warn('fetchReviews: 오프라인 상태');
      
      // 로컬 저장소에서 해당 장소의 리뷰 찾기 시도
      try {
        const localReviews = localStorage.getItem(`placeReviews_${placeId}`);
        if (localReviews) {
          const parsedReviews = JSON.parse(localReviews);
          return { 
            success: true, 
            data: parsedReviews, 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 리뷰 파싱 오류:', localError);
      }
      
      return { 
        success: false, 
        error: '오프라인 상태에서 리뷰를 로드할 수 없습니다.', 
        data: [], 
        offline: true 
      };
    }
    
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('placeId', '==', placeId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const reviews = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // 타임스탬프 변환
      const createdAt = data.createdAt?.toDate?.() || data.createdAt;
      
      reviews.push({ 
        id: doc.id, 
        ...data,
        createdAt 
      });
    });
    
    // 결과 캐싱
    if (useCache && reviews.length > 0) {
      cacheReviews(cacheKey, reviews);
      
      // 로컬 저장소에도 저장 (오프라인 지원)
      try {
        localStorage.setItem(`placeReviews_${placeId}`, JSON.stringify(reviews));
      } catch (storageError) {
        console.warn('로컬 저장소 저장 오류:', storageError);
      }
    }
    
    return { success: true, data: reviews };
  } catch (error) {
    console.error('Error fetching reviews:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      try {
        const localReviews = localStorage.getItem(`placeReviews_${placeId}`);
        if (localReviews) {
          const parsedReviews = JSON.parse(localReviews);
          return { 
            success: true, 
            data: parsedReviews, 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 리뷰 파싱 오류:', localError);
      }
      
      return { 
        success: false, 
        error: '네트워크 연결 오류로 리뷰를 로드할 수 없습니다.', 
        data: [], 
        offline: true 
      };
    }
    
    return { success: false, error: error.message, data: [] };
  }
};

// 특정 리뷰 가져오기
export const fetchReview = async (reviewId) => {
  try {
    // 입력 유효성 검사
    if (!reviewId) {
      console.warn('fetchReview: 유효하지 않은 리뷰 ID');
      return { success: false, error: '유효하지 않은 리뷰 ID', data: null };
    }
    
    // 캐시 확인
    const cacheKey = `review_${reviewId}`;
    const cachedReview = getCachedReviews(cacheKey);
    if (cachedReview) {
      return { success: true, data: cachedReview, fromCache: true };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.warn('fetchReview: 오프라인 상태');
      
      // 오프라인 작업 큐에서 해당 리뷰의 최신 변경사항 확인
      try {
        const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
        const relevantOperations = queue.filter(op => 
          (op.operation === 'update' || op.operation === 'add') && 
          op.data.reviewId === reviewId
        );
        
        if (relevantOperations.length > 0) {
          // 최신 작업 찾기
          const latestOp = relevantOperations.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
          )[0];
          
          return { 
            success: true, 
            data: latestOp.data, 
            fromOfflineQueue: true, 
            offline: true 
          };
        }
      } catch (queueError) {
        console.error('오프라인 큐 검색 오류:', queueError);
      }
      
      // 로컬 저장소 확인
      try {
        const localReview = localStorage.getItem(`review_${reviewId}`);
        if (localReview) {
          return { 
            success: true, 
            data: JSON.parse(localReview), 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 리뷰 파싱 오류:', localError);
      }
      
      return { 
        success: false, 
        error: '오프라인 상태에서 리뷰를 로드할 수 없습니다.', 
        data: null, 
        offline: true 
      };
    }
    
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewDoc = await getDoc(reviewRef);
    
    if (reviewDoc.exists()) {
      const data = reviewDoc.data();
      // 타임스탬프 변환
      const createdAt = data.createdAt?.toDate?.() || data.createdAt;
      
      const review = { 
        id: reviewDoc.id, 
        ...data,
        createdAt 
      };
      
      // 결과 캐싱
      cacheReviews(cacheKey, review);
      
      // 로컬 저장소에도 저장 (오프라인 지원)
      try {
        localStorage.setItem(`review_${reviewId}`, JSON.stringify(review));
      } catch (storageError) {
        console.warn('로컬 저장소 저장 오류:', storageError);
      }
      
      return { success: true, data: review };
    } else {
      return { success: false, error: '리뷰를 찾을 수 없습니다.', data: null };
    }
  } catch (error) {
    console.error('Error fetching review:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.name === 'FirebaseError' || error.message?.includes('network')) {
      try {
        const localReview = localStorage.getItem(`review_${reviewId}`);
        if (localReview) {
          return { 
            success: true, 
            data: JSON.parse(localReview), 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 리뷰 파싱 오류:', localError);
      }
    }
    
    return { success: false, error: error.message, data: null };
  }
};

// 사용자의 리뷰 가져오기
export const fetchUserReview = async (placeId, userId) => {
  try {
    // 입력 유효성 검사
    if (!placeId || !userId) {
      console.warn('fetchUserReview: 유효하지 않은 파라미터', { placeId, userId });
      return { success: false, error: '유효하지 않은 장소 ID 또는 사용자 ID', data: null };
    }
    
    // 캐시 확인
    const cacheKey = `user_review_${userId}_${placeId}`;
    const cachedReview = getCachedReviews(cacheKey);
    if (cachedReview) {
      return { success: true, data: cachedReview, fromCache: true };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.warn('fetchUserReview: 오프라인 상태');
      
      // 오프라인 작업 큐에서 해당 사용자/장소 리뷰의 최신 변경사항 확인
      try {
        const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
        const relevantOperations = queue.filter(op => 
          (op.operation === 'update' || op.operation === 'add') && 
          op.data.placeId === placeId &&
          op.data.userId === userId
        );
        
        if (relevantOperations.length > 0) {
          // 최신 작업 찾기
          const latestOp = relevantOperations.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
          )[0];
          
          return { 
            success: true, 
            data: latestOp.data, 
            fromOfflineQueue: true, 
            offline: true 
          };
        }
      } catch (queueError) {
        console.error('오프라인 큐 검색 오류:', queueError);
      }
      
      // 로컬 저장소 확인
      try {
        const localReview = localStorage.getItem(`user_review_${userId}_${placeId}`);
        if (localReview) {
          return { 
            success: true, 
            data: JSON.parse(localReview), 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 리뷰 파싱 오류:', localError);
      }
      
      return { 
        success: true, 
        data: null, 
        offline: true 
      };
    }
    
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('placeId', '==', placeId),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const reviewDoc = querySnapshot.docs[0];
      const data = reviewDoc.data();
      // 타임스탬프 변환
      const createdAt = data.createdAt?.toDate?.() || data.createdAt;
      
      const review = { 
        id: reviewDoc.id, 
        ...data,
        createdAt 
      };
      
      // 결과 캐싱
      cacheReviews(cacheKey, review);
      
      // 로컬 저장소에도 저장 (오프라인 지원)
      try {
        localStorage.setItem(`user_review_${userId}_${placeId}`, JSON.stringify(review));
      } catch (storageError) {
        console.warn('로컬 저장소 저장 오류:', storageError);
      }
      
      return { success: true, data: review };
    } else {
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Error fetching user review:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      try {
        const localReview = localStorage.getItem(`user_review_${userId}_${placeId}`);
        if (localReview) {
          return { 
            success: true, 
            data: JSON.parse(localReview), 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 리뷰 파싱 오류:', localError);
      }
    }
    
    return { success: false, error: error.message, data: null };
  }
};

// 리뷰 추가
export const addReview = async (reviewData) => {
  try {
    // 입력값 디버깅
    console.log('addReview: 원본 입력값', JSON.stringify(reviewData, null, 2));
    
    // 입력 유효성 검사
    if (!reviewData || !reviewData.userId || !reviewData.placeId) {
      console.warn('addReview: 필수 필드 누락', reviewData);
      return { success: false, error: '필수 정보가 누락되었습니다.' };
    }
    
    // 필드 유효성 검사 및 정규화
    const normalizedReviewData = {
      ...reviewData,
      rating: Number(reviewData.rating) || 0,
      content: reviewData.content != null ? String(reviewData.content).trim() : '',
      // 'review' 필드도 지원 (이전 코드와의 호환성)
      review: reviewData.review != null ? String(reviewData.review).trim() : '',
      visitDate: reviewData.visitDate || null,
      tags: Array.isArray(reviewData.tags) ? reviewData.tags : [],
      recommendationRating: Number(reviewData.recommendationRating) || 0,
      createdAt: serverTimestamp(),
      likes: 0
    };
    
    // content와 review 필드 통합 (둘 다 있을 경우 content 우선)
    if (!normalizedReviewData.content && normalizedReviewData.review) {
      normalizedReviewData.content = normalizedReviewData.review;
    }
    
    console.log('addReview: 정규화된 데이터', {
      placeId: normalizedReviewData.placeId,
      userId: normalizedReviewData.userId,
      rating: normalizedReviewData.rating,
      contentLength: normalizedReviewData.content.length,
      reviewLength: normalizedReviewData.review.length
    });
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('addReview: 오프라인 상태에서 리뷰 추가');
      
      // 오프라인 작업 큐에 추가
      const offlineReviewData = {
        ...normalizedReviewData,
        id: `offline_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addToOfflineQueue('add', offlineReviewData);
      
      // 사용자 리뷰 캐시 업데이트
      try {
        localStorage.setItem(
          `user_review_${reviewData.userId}_${reviewData.placeId}`, 
          JSON.stringify(offlineReviewData)
        );
      } catch (localError) {
        console.warn('로컬 저장소 업데이트 오류:', localError);
      }
      
      return {
        success: true,
        data: offlineReviewData,
        offline: true,
        message: '리뷰가 오프라인 상태에서 저장되었습니다. 네트워크 연결 시 자동으로 서버에 반영됩니다.'
      };
    }
    
    // 기존 리뷰 확인
    const existingReview = await fetchUserReview(reviewData.placeId, reviewData.userId);
    
    if (existingReview.success && existingReview.data) {
      console.log('사용자가 이미 리뷰를 작성했습니다. 업데이트합니다.', existingReview.data.id);
      return await updateReview(existingReview.data.id, normalizedReviewData);
    }
    
    // 리뷰 추가
    const reviewsRef = collection(db, 'reviews');
    const docRef = await addDoc(reviewsRef, normalizedReviewData);
    console.log('addReview: Firebase에 저장 완료, 문서 ID:', docRef.id);
    
    // 장소 문서 업데이트 (평균 평점, 리뷰 수 등)
    await updatePlaceReviewStats(reviewData.placeId, normalizedReviewData.rating);
    
    // 관련 캐시 무효화
    clearReviewsCache(reviewData.placeId, reviewData.userId);
    
    // 저장된 리뷰 정보
    const savedReview = { 
      id: docRef.id, 
      ...normalizedReviewData, 
      // serverTimestamp()는 클라이언트에서 직접 읽을 수 없으므로 현재 시간으로 대체
      createdAt: new Date().toISOString() 
    };
    
    // 로컬 저장소에도 저장 (오프라인 지원)
    try {
      localStorage.setItem(
        `user_review_${reviewData.userId}_${reviewData.placeId}`, 
        JSON.stringify(savedReview)
      );
      localStorage.setItem(`review_${docRef.id}`, JSON.stringify(savedReview));
      
      // 기존 큐에서 오프라인 작업 제거
      const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
      const filteredQueue = queue.filter(op => 
        !(op.operation === 'add' && op.data.userId === reviewData.userId && op.data.placeId === reviewData.placeId)
      );
      localStorage.setItem('reviewOperationsQueue', JSON.stringify(filteredQueue));
    } catch (storageError) {
      console.warn('로컬 저장소 저장 오류:', storageError);
    }
    
    return { 
      success: true, 
      data: savedReview 
    };
  } catch (error) {
    console.error('Error adding review:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      console.log('네트워크 오류로 인해 오프라인 모드에서 리뷰 저장');
      
      const offlineReviewData = {
        ...reviewData,
        id: `offline_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addToOfflineQueue('add', offlineReviewData);
      
      // 사용자 리뷰 캐시 업데이트
      try {
        localStorage.setItem(
          `user_review_${reviewData.userId}_${reviewData.placeId}`, 
          JSON.stringify(offlineReviewData)
        );
      } catch (localError) {
        console.warn('로컬 저장소 업데이트 오류:', localError);
      }
      
      return {
        success: true,
        data: offlineReviewData,
        offline: true,
        message: '네트워크 오류로 인해 리뷰가 로컬에 저장되었습니다. 나중에 자동으로 서버에 반영됩니다.'
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 리뷰 업데이트
export const updateReview = async (reviewId, reviewData) => {
  try {
    // 입력값 디버깅
    console.log('updateReview: 원본 입력값', JSON.stringify(reviewData, null, 2));
    
    // 입력 유효성 검사
    if (!reviewId) {
      return { success: false, error: '유효하지 않은 리뷰 ID' };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('updateReview: 오프라인 상태에서 리뷰 수정');
      
      // 기존 리뷰 데이터를 로컬에서 가져오기 시도
      let existingReviewData = null;
      try {
        const localReview = localStorage.getItem(`review_${reviewId}`);
        if (localReview) {
          existingReviewData = JSON.parse(localReview);
        } else {
          // 로컬에 없는 경우 오프라인 큐에서 확인
          const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
          const relevantOperations = queue.filter(op => 
            (op.operation === 'update' || op.operation === 'add') && 
            op.data.id === reviewId
          );
          
          if (relevantOperations.length > 0) {
            // 최신 작업 찾기
            const latestOp = relevantOperations.sort((a, b) => 
              new Date(b.timestamp) - new Date(a.timestamp)
            )[0];
            
            existingReviewData = latestOp.data;
          }
        }
      } catch (localError) {
        console.error('로컬 리뷰 데이터 가져오기 오류:', localError);
      }
      
      // 기존 데이터와 병합
      const mergedData = {
        ...(existingReviewData || {}),
        ...reviewData,
        id: reviewId,
        updatedAt: new Date().toISOString(),
        updatedOffline: true
      };
      
      await addToOfflineQueue('update', { reviewId, ...mergedData });
      
      // 로컬 저장소에 업데이트된 데이터 저장
      try {
        localStorage.setItem(`review_${reviewId}`, JSON.stringify(mergedData));
        
        // 사용자 리뷰 캐시 업데이트
        if (mergedData.userId && mergedData.placeId) {
          localStorage.setItem(
            `user_review_${mergedData.userId}_${mergedData.placeId}`, 
            JSON.stringify(mergedData)
          );
        }
      } catch (localError) {
        console.warn('로컬 저장소 업데이트 오류:', localError);
      }
      
      return {
        success: true,
        data: mergedData,
        offline: true,
        message: '리뷰가 오프라인 상태에서 수정되었습니다. 네트워크 연결 시 자동으로 서버에 반영됩니다.'
      };
    }
    
    const reviewRef = doc(db, 'reviews', reviewId);
    // 리뷰 존재 여부 확인
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      return { success: false, error: '존재하지 않는 리뷰입니다.' };
    }
    
    // 업데이트 허용 필드 (userId 등은 변경 불가)
    const allowedFields = ['rating', 'content', 'review', 'tags', 'visitDate', 'recommendationRating'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (reviewData[field] !== undefined) {
        // 필드별 정규화
        if (field === 'rating' || field === 'recommendationRating') {
          updateData[field] = Number(reviewData[field]) || 0;
        } else if (field === 'content' || field === 'review') {
          updateData[field] = reviewData[field] != null ? String(reviewData[field]).trim() : '';
        } else if (field === 'tags') {
          updateData[field] = Array.isArray(reviewData[field]) ? reviewData[field] : [];
        } else {
          updateData[field] = reviewData[field];
        }
      }
    });
    
    // content와 review 필드 통합 (둘 다 있을 경우 content 우선)
    if (updateData.content !== undefined && updateData.review === undefined) {
      updateData.review = updateData.content;
    } else if (updateData.review !== undefined && updateData.content === undefined) {
      updateData.content = updateData.review;
    }
    
    console.log('updateReview: 업데이트할 필드', Object.keys(updateData));
    
    // 마지막 업데이트 시간 추가
    updateData.updatedAt = serverTimestamp();
    
    await updateDoc(reviewRef, updateData);
    
    // 평점이 변경된 경우 장소 통계 업데이트
    if (reviewData.rating !== undefined) {
      const oldData = reviewDoc.data();
      await updatePlaceReviewStatsOnEdit(
        reviewData.placeId || oldData.placeId, 
        oldData.rating || 0, 
        updateData.rating
      );
    }
    
    // 관련 캐시 무효화
    const oldData = reviewDoc.data();
    clearReviewsCache(oldData.placeId, oldData.userId);
    
    // 업데이트된 리뷰 데이터
    const updatedReview = {
      id: reviewId,
      ...oldData,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    // 로컬 저장소 업데이트 (오프라인 지원)
    try {
      localStorage.setItem(`review_${reviewId}`, JSON.stringify(updatedReview));
      
      // 사용자 리뷰 캐시 업데이트
      if (oldData.userId && oldData.placeId) {
        localStorage.setItem(
          `user_review_${oldData.userId}_${oldData.placeId}`, 
          JSON.stringify(updatedReview)
        );
      }
      
      // 오프라인 작업 큐에서 관련 작업 제거
      const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
      const filteredQueue = queue.filter(op => 
        !(op.operation === 'update' && op.data.reviewId === reviewId)
      );
      localStorage.setItem('reviewOperationsQueue', JSON.stringify(filteredQueue));
    } catch (storageError) {
      console.warn('로컬 저장소 업데이트 오류:', storageError);
    }
    
    return { 
      success: true,
      data: updatedReview
    };
  } catch (error) {
    console.error('Error updating review:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      console.log('네트워크 오류로 인해 오프라인 모드에서 리뷰 업데이트');
      
      // 기존 리뷰 데이터를 로컬에서 가져오기 시도
      let existingReviewData = null;
      try {
        const localReview = localStorage.getItem(`review_${reviewId}`);
        if (localReview) {
          existingReviewData = JSON.parse(localReview);
        }
      } catch (localError) {
        console.error('로컬 리뷰 데이터 가져오기 오류:', localError);
      }
      
      // 오프라인 업데이트 데이터
      const offlineUpdateData = {
        reviewId,
        ...existingReviewData,
        ...reviewData,
        updatedAt: new Date().toISOString(),
        updatedOffline: true
      };
      
      await addToOfflineQueue('update', offlineUpdateData);
      
      // 로컬 저장소에 업데이트된 데이터 저장
      try {
        localStorage.setItem(`review_${reviewId}`, JSON.stringify(offlineUpdateData));
        
        // 사용자 리뷰 캐시 업데이트
        if (offlineUpdateData.userId && offlineUpdateData.placeId) {
          localStorage.setItem(
            `user_review_${offlineUpdateData.userId}_${offlineUpdateData.placeId}`, 
            JSON.stringify(offlineUpdateData)
          );
        }
      } catch (localError) {
        console.warn('로컬 저장소 업데이트 오류:', localError);
      }
      
      return {
        success: true,
        data: offlineUpdateData,
        offline: true,
        message: '네트워크 오류로 인해 리뷰가 로컬에 저장되었습니다. 나중에 자동으로 서버에 반영됩니다.'
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 리뷰 삭제
export const deleteReview = async (reviewId) => {
  try {
    // 입력 유효성 검사
    if (!reviewId) {
      return { success: false, error: '유효하지 않은 리뷰 ID' };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('deleteReview: 오프라인 상태에서 리뷰 삭제');
      
      // 기존 리뷰 데이터를 로컬에서 가져오기 시도
      let reviewData = null;
      try {
        const localReview = localStorage.getItem(`review_${reviewId}`);
        if (localReview) {
          reviewData = JSON.parse(localReview);
        }
      } catch (localError) {
        console.error('로컬 리뷰 데이터 가져오기 오류:', localError);
      }
      
      // 오프라인 작업 큐에 삭제 작업 추가
      if (reviewData) {
        await addToOfflineQueue('delete', { reviewId, placeId: reviewData.placeId, userId: reviewData.userId });
        
        // 로컬 저장소에서 리뷰 제거 (사용자 리뷰 정보도 함께 제거)
        try {
          localStorage.removeItem(`review_${reviewId}`);
          
          if (reviewData.userId && reviewData.placeId) {
            localStorage.removeItem(`user_review_${reviewData.userId}_${reviewData.placeId}`);
          }
        } catch (localError) {
          console.warn('로컬 저장소 삭제 오류:', localError);
        }
      } else {
        await addToOfflineQueue('delete', { reviewId });
      }
      
      return {
        success: true,
        offline: true,
        message: '리뷰가 오프라인 상태에서 삭제되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
      };
    }
    
    const reviewRef = doc(db, 'reviews', reviewId);
    // 리뷰 정보 (캐시 무효화 및 통계 업데이트용)
    const reviewDoc = await getDoc(reviewRef);
    
    if (!reviewDoc.exists()) {
      return { success: false, error: '존재하지 않는 리뷰입니다.' };
    }
    
    const reviewData = reviewDoc.data();
    
    await deleteDoc(reviewRef);
    
    // 장소 통계 업데이트 (리뷰 삭제 반영)
    if (reviewData.placeId) {
      await updatePlaceReviewStatsOnDelete(reviewData.placeId, reviewData.rating || 0);
    }
    
    // 관련 캐시 무효화
    clearReviewsCache(reviewData.placeId, reviewData.userId);
    
    // 로컬 저장소 업데이트 (오프라인 지원)
    try {
      localStorage.removeItem(`review_${reviewId}`);
      
      // 사용자 리뷰 캐시 업데이트
      if (reviewData.userId && reviewData.placeId) {
        localStorage.removeItem(`user_review_${reviewData.userId}_${reviewData.placeId}`);
      }
      
      // 오프라인 작업 큐에서 관련 작업 제거
      const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
      const filteredQueue = queue.filter(op => 
        !(op.data.reviewId === reviewId)
      );
      localStorage.setItem('reviewOperationsQueue', JSON.stringify(filteredQueue));
    } catch (storageError) {
      console.warn('로컬 저장소 삭제 오류:', storageError);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting review:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      console.log('네트워크 오류로 인해 오프라인 모드에서 리뷰 삭제');
      
      await addToOfflineQueue('delete', { reviewId });
      
      try {
        // 로컬 저장소에서도 리뷰 제거 시도
        localStorage.removeItem(`review_${reviewId}`);
      } catch (localError) {
        console.warn('로컬 저장소 삭제 오류:', localError);
      }
      
      return {
        success: true,
        offline: true,
        message: '네트워크 오류로 인해 리뷰가 로컬에서만 삭제되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 리뷰 좋아요/싫어요 토글
export const toggleReviewLike = async (reviewId, userId, isLiked) => {
  try {
    // 입력 유효성 검사
    if (!reviewId || !userId) {
      return { success: false, error: '유효하지 않은 파라미터' };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('toggleReviewLike: 오프라인 상태에서 좋아요 토글');
      
      // 오프라인 작업 큐에 추가
      await addToOfflineQueue('toggleLike', { reviewId, userId, isLiked });
      
      // 로컬 리뷰 데이터 업데이트 시도
      try {
        const localReview = localStorage.getItem(`review_${reviewId}`);
        if (localReview) {
          const reviewData = JSON.parse(localReview);
          const currentLikes = reviewData.likes || 0;
          
          // 좋아요 상태 업데이트
          const updatedReview = {
            ...reviewData,
            likes: isLiked ? currentLikes + 1 : Math.max(0, currentLikes - 1),
            likedByCurrentUser: isLiked
          };
          
          localStorage.setItem(`review_${reviewId}`, JSON.stringify(updatedReview));
        }
      } catch (localError) {
        console.warn('로컬 리뷰 업데이트 오류:', localError);
      }
      
      return {
        success: true,
        offline: true,
        liked: isLiked,
        message: '좋아요 상태가 오프라인에서 변경되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
      };
    }
    
    // 트랜잭션 처리가 이상적이지만, 간단한 구현으로 대체
    const reviewRef = doc(db, 'reviews', reviewId);
    const reviewLikeRef = doc(db, 'reviewLikes', `${reviewId}_${userId}`);
    
    const reviewLikeDoc = await getDoc(reviewLikeRef);
    
    if (isLiked) {
      // 좋아요 추가
      if (!reviewLikeDoc.exists()) {
        await setDoc(reviewLikeRef, {
          reviewId,
          userId,
          createdAt: serverTimestamp()
        });
        
        // 리뷰 좋아요 수 증가
        const reviewDoc = await getDoc(reviewRef);
        if (reviewDoc.exists()) {
          const currentLikes = reviewDoc.data().likes || 0;
          await updateDoc(reviewRef, { likes: currentLikes + 1 });
          
          // 로컬 저장소 업데이트 (오프라인 지원)
          try {
            const localReview = localStorage.getItem(`review_${reviewId}`);
            if (localReview) {
              const reviewData = JSON.parse(localReview);
              const updatedReview = {
                ...reviewData,
                likes: currentLikes + 1,
                likedByCurrentUser: true
              };
              localStorage.setItem(`review_${reviewId}`, JSON.stringify(updatedReview));
            }
          } catch (storageError) {
            console.warn('로컬 저장소 업데이트 오류:', storageError);
          }
        }
      }
    } else {
      // 좋아요 취소
      if (reviewLikeDoc.exists()) {
        await deleteDoc(reviewLikeRef);
        
        // 리뷰 좋아요 수 감소
        const reviewDoc = await getDoc(reviewRef);
        if (reviewDoc.exists()) {
          const currentLikes = reviewDoc.data().likes || 0;
          if (currentLikes > 0) {
            await updateDoc(reviewRef, { likes: currentLikes - 1 });
            
            // 로컬 저장소 업데이트 (오프라인 지원)
            try {
              const localReview = localStorage.getItem(`review_${reviewId}`);
              if (localReview) {
                const reviewData = JSON.parse(localReview);
                const updatedReview = {
                  ...reviewData,
                  likes: Math.max(0, currentLikes - 1),
                  likedByCurrentUser: false
                };
                localStorage.setItem(`review_${reviewId}`, JSON.stringify(updatedReview));
              }
            } catch (storageError) {
              console.warn('로컬 저장소 업데이트 오류:', storageError);
            }
          }
        }
      }
    }
    
    // 캐시 무효화 (좋아요 상태가 변경되었으므로)
    const reviewDoc = await getDoc(reviewRef);
    if (reviewDoc.exists()) {
      const reviewData = reviewDoc.data();
      clearReviewCache(`review_${reviewId}`);
      clearReviewCache(`user_review_${reviewData.userId}_${reviewData.placeId}`);
    }
    
    return { 
      success: true,
      liked: isLiked
    };
  } catch (error) {
    console.error('Error toggling review like:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      console.log('네트워크 오류로 인해 오프라인 모드에서 좋아요 토글');
      
      await addToOfflineQueue('toggleLike', { reviewId, userId, isLiked });
      
      return {
        success: true,
        offline: true,
        liked: isLiked,
        message: '네트워크 오류로 인해 좋아요 상태가 로컬에만 반영되었습니다. 네트워크 연결 시 서버에 반영됩니다.'
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 리뷰 통계 가져오기
export const fetchReviewStats = async (placeId) => {
  try {
    // 입력 유효성 검사
    if (!placeId) {
      return { success: false, error: '유효하지 않은 장소 ID', data: null };
    }
    
    // 캐시 확인
    const cacheKey = `review_stats_${placeId}`;
    const cachedStats = getCachedReviews(cacheKey);
    if (cachedStats) {
      return { success: true, data: cachedStats, fromCache: true };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('fetchReviewStats: 오프라인 상태');
      
      // 로컬 저장소에서 통계 정보 확인
      try {
        const localStats = localStorage.getItem(`review_stats_${placeId}`);
        if (localStats) {
          return { 
            success: true, 
            data: JSON.parse(localStats), 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 통계 파싱 오류:', localError);
      }
      
      // 로컬 장소 리뷰로부터 통계 계산 시도
      try {
        const localReviews = localStorage.getItem(`placeReviews_${placeId}`);
        if (localReviews) {
          const reviews = JSON.parse(localReviews);
          
          // 통계 계산
          const totalCount = reviews.length;
          let averageRating = 0;
          const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          const mbtiDistribution = {};
          
          if (totalCount > 0) {
            // 평균 평점
            const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
            averageRating = totalRating / totalCount;
            
            // 평점 분포
            reviews.forEach(review => {
              const rating = Math.floor(review.rating || 0);
              if (rating >= 1 && rating <= 5) {
                ratingDistribution[rating]++;
              }
            });
            
            // MBTI 분포
            reviews.forEach(review => {
              if (review.userMbti) {
                mbtiDistribution[review.userMbti] = (mbtiDistribution[review.userMbti] || 0) + 1;
              }
            });
          }
          
          const stats = {
            totalCount,
            averageRating,
            ratingDistribution,
            mbtiDistribution
          };
          
          // 로컬 저장소에 통계 캐싱
          try {
            localStorage.setItem(`review_stats_${placeId}`, JSON.stringify(stats));
          } catch (storageError) {
            console.warn('로컬 통계 저장 오류:', storageError);
          }
          
          return { 
            success: true, 
            data: stats,
            calculatedOffline: true,
            offline: true
          };
        }
      } catch (calculateError) {
        console.error('로컬 통계 계산 오류:', calculateError);
      }
      
      return { 
        success: false, 
        error: '오프라인 상태에서 리뷰 통계를 가져올 수 없습니다.', 
        data: null, 
        offline: true 
      };
    }
    
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, where('placeId', '==', placeId));
    
    const querySnapshot = await getDocs(q);
    const reviews = [];
    
    querySnapshot.forEach((doc) => {
      reviews.push({ id: doc.id, ...doc.data() });
    });
    
    // 통계 계산
    const totalCount = reviews.length;
    let averageRating = 0;
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const mbtiDistribution = {};
    
    if (totalCount > 0) {
      // 평균 평점
      const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
      averageRating = totalRating / totalCount;
      
      // 평점 분포
      reviews.forEach(review => {
        const rating = Math.floor(review.rating || 0);
        if (rating >= 1 && rating <= 5) {
          ratingDistribution[rating]++;
        }
      });
      
      // MBTI 분포
      reviews.forEach(review => {
        if (review.userMbti) {
          mbtiDistribution[review.userMbti] = (mbtiDistribution[review.userMbti] || 0) + 1;
        }
      });
    }
    
    const stats = {
      totalCount,
      averageRating,
      ratingDistribution,
      mbtiDistribution
    };
    
    // 결과 캐싱
    cacheReviews(cacheKey, stats);
    
    // 로컬 저장소에도 저장 (오프라인 지원)
    try {
      localStorage.setItem(`review_stats_${placeId}`, JSON.stringify(stats));
    } catch (storageError) {
      console.warn('로컬 통계 저장 오류:', storageError);
    }
    
    return {
      success: true,
      data: stats
    };
  } catch (error) {
    console.error('Error fetching review stats:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      // 로컬 저장소에서 통계 정보 확인
      try {
        const localStats = localStorage.getItem(`review_stats_${placeId}`);
        if (localStats) {
          return { 
            success: true, 
            data: JSON.parse(localStats), 
            fromCache: true, 
            offline: true 
          };
        }
      } catch (localError) {
        console.error('로컬 통계 파싱 오류:', localError);
      }
    }
    
    return { success: false, error: error.message, data: null };
  }
};

// 리뷰 신고
export const reportReview = async (reviewId, reason, userId) => {
  try {
    // 입력 유효성 검사
    if (!reviewId || !reason || !userId) {
      return { success: false, error: '필수 정보가 누락되었습니다.' };
    }
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('reportReview: 오프라인 상태에서 리뷰 신고');
      
      // 오프라인 작업 큐에 신고 작업 추가
      await addToOfflineQueue('report', { reviewId, reason, userId });
      
      return {
        success: true,
        offline: true,
        message: '신고가 오프라인 상태에서 접수되었습니다. 네트워크 연결 시 서버에 전송됩니다.'
      };
    }
    
    // 이미 신고했는지 확인
    const reportsRef = collection(db, 'reviewReports');
    const q = query(
      reportsRef,
      where('reviewId', '==', reviewId),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return { success: false, error: '이미 이 리뷰를 신고하셨습니다.' };
    }
    
    // 신고 데이터 준비
    const reportData = {
      reviewId,
      reason,
      userId,
      createdAt: serverTimestamp(),
      status: 'pending' // 관리자 검토 대기 상태
    };
    
    await addDoc(reportsRef, reportData);
    
    // 신고 누적 수에 따라 리뷰 상태 업데이트
    await updateReviewReportStatus(reviewId);
    
    return { success: true };
  } catch (error) {
    console.error('Error reporting review:', error);
    
    // 네트워크 오류 확인 및 처리 개선
    if (isOffline() || error.code === 'failed-precondition' || error.message?.includes('network')) {
      console.log('네트워크 오류로 인해 오프라인 모드에서 리뷰 신고');
      
      await addToOfflineQueue('report', { reviewId, reason, userId });
      
      return {
        success: true,
        offline: true,
        message: '네트워크 오류로 인해 신고가 로컬에 저장되었습니다. 네트워크 연결 시 서버에 전송됩니다.'
      };
    }
    
    return { success: false, error: error.message };
  }
};

// 장소 평균 평점 및 리뷰 수 업데이트 (신규 리뷰)
const updatePlaceReviewStats = async (placeId, rating) => {
  try {
    if (!placeId) return;
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('updatePlaceReviewStats: 오프라인 상태에서 통계 업데이트 대기');
      
      // 오프라인 작업 큐에 통계 업데이트 작업 추가
      await addToOfflineQueue('updateStats', { placeId, rating, operation: 'add' });
      return;
    }
    
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) {
      console.warn(`장소 문서가 존재하지 않습니다: ${placeId}`);
      return;
    }
    
    const placeData = placeDoc.data();
    const currentRating = placeData.averageRating || 0;
    const reviewCount = placeData.reviewCount || 0;
    
    // 새로운 평균 평점 계산
    const newReviewCount = reviewCount + 1;
    const newAverageRating = (currentRating * reviewCount + rating) / newReviewCount;
    
    await updateDoc(placeRef, {
      averageRating: newAverageRating,
      reviewCount: newReviewCount,
      lastReviewDate: serverTimestamp()
    });
  } catch (error) {
    console.error('장소 리뷰 통계 업데이트 오류:', error);
  }
};

// 장소 평균 평점 업데이트 (리뷰 수정)
const updatePlaceReviewStatsOnEdit = async (placeId, oldRating, newRating) => {
  try {
    if (!placeId) return;
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('updatePlaceReviewStatsOnEdit: 오프라인 상태에서 통계 수정 대기');
      
      // 오프라인 작업 큐에 통계 업데이트 작업 추가
      await addToOfflineQueue('updateStats', { 
        placeId, 
        oldRating, 
        newRating, 
        operation: 'edit' 
      });
      return;
    }
    
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) return;
    
    const placeData = placeDoc.data();
    const currentRating = placeData.averageRating || 0;
    const reviewCount = placeData.reviewCount || 0;
    
    if (reviewCount <= 0) return;
    
    // 평균에서 이전 평점 제거하고 새 평점 추가
    const newAverageRating = (currentRating * reviewCount - oldRating + newRating) / reviewCount;
    
    await updateDoc(placeRef, {
      averageRating: newAverageRating,
      lastUpdatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('장소 리뷰 통계 수정 오류:', error);
  }
};

// 장소 평균 평점 업데이트 (리뷰 삭제)
const updatePlaceReviewStatsOnDelete = async (placeId, rating) => {
  try {
    if (!placeId) return;
    
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('updatePlaceReviewStatsOnDelete: 오프라인 상태에서 통계 삭제 대기');
      
      // 오프라인 작업 큐에 통계 업데이트 작업 추가
      await addToOfflineQueue('updateStats', { 
        placeId, 
        rating, 
        operation: 'delete' 
      });
      return;
    }
    
    const placeRef = doc(db, 'places', placeId);
    const placeDoc = await getDoc(placeRef);
    
    if (!placeDoc.exists()) return;
    
    const placeData = placeDoc.data();
    const currentRating = placeData.averageRating || 0;
    const reviewCount = placeData.reviewCount || 0;
    
    if (reviewCount <= 1) {
      // 마지막 리뷰라면 평점 기록 삭제
      await updateDoc(placeRef, {
        averageRating: 0,
        reviewCount: 0
      });
    } else {
      // 새로운 평균 계산
      const newReviewCount = reviewCount - 1;
      const newAverageRating = (currentRating * reviewCount - rating) / newReviewCount;
      
      await updateDoc(placeRef, {
        averageRating: newAverageRating,
        reviewCount: newReviewCount,
        lastUpdatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('장소 리뷰 통계 삭제 오류:', error);
  }
};

// 신고 누적에 따른 리뷰 상태 업데이트
const updateReviewReportStatus = async (reviewId) => {
  try {
    // 오프라인 상태 확인 추가
    if (isOffline()) {
      console.log('updateReviewReportStatus: 오프라인 상태에서 리뷰 상태 업데이트 불가');
      return;
    }
    
    const reportsRef = collection(db, 'reviewReports');
    const q = query(reportsRef, where('reviewId', '==', reviewId));
    
    const querySnapshot = await getDocs(q);
    const reportCount = querySnapshot.size;
    
    // 신고가 5개 이상이면 리뷰를 자동 숨김 처리
    if (reportCount >= 5) {
      const reviewRef = doc(db, 'reviews', reviewId);
      await updateDoc(reviewRef, {
        hidden: true,
        hiddenReason: '다수의 사용자 신고로 자동 숨김 처리됨',
        hiddenAt: serverTimestamp()
      });

    }
  } catch (error) {
    console.error('리뷰 신고 상태 업데이트 오류:', error);
  }
};

// 관련 캐시 모두 제거
const clearReviewsCache = (placeId, userId) => {
  try {
    if (placeId) {
      clearReviewCache(`reviews_${placeId}`);
      clearReviewCache(`review_stats_${placeId}`);
    }
    
    if (userId && placeId) {
      clearReviewCache(`user_review_${userId}_${placeId}`);
    }
  } catch (error) {
    console.warn('리뷰 캐시 제거 오류:', error);
  }
}; 

// 오프라인 작업 큐 동기화 - 새 함수 추가
export const syncOfflineReviewOperations = async () => {
  try {
    // 온라인 상태가 아니면 동기화 불가
    if (isOffline()) {
      console.log('syncOfflineReviewOperations: 오프라인 상태, 동기화 불가');
      return { success: false, message: '오프라인 상태입니다. 네트워크 연결 시 동기화됩니다.' };
    }
    
    const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
    
    if (queue.length === 0) {
      console.log('동기화할 오프라인 작업이 없습니다.');
      return { success: true, processed: 0 };
    }
    
    console.log(`오프라인 작업 ${queue.length}개 동기화 시작`);
    
    let processed = 0;
    let failed = 0;
    const failedOps = [];
    
    // 작업 유형별로 처리
    for (const op of queue) {
      try {
        switch (op.operation) {
          case 'add':
            // 리뷰 추가
            const addResult = await addReview(op.data);
            if (addResult.success) processed++;
            else {
              failedOps.push({ ...op, error: addResult.error });
              failed++;
            }
            break;
            
          case 'update':
            // 리뷰 업데이트
            const updateResult = await updateReview(op.data.reviewId, op.data);
            if (updateResult.success) processed++;
            else {
              failedOps.push({ ...op, error: updateResult.error });
              failed++;
            }
            break;
            
          case 'delete':
            // 리뷰 삭제
            const deleteResult = await deleteReview(op.data.reviewId);
            if (deleteResult.success) processed++;
            else {
              failedOps.push({ ...op, error: deleteResult.error });
              failed++;
            }
            break;
            
          case 'toggleLike':
            // 좋아요 토글
            const likeResult = await toggleReviewLike(
              op.data.reviewId,
              op.data.userId,
              op.data.isLiked
            );
            if (likeResult.success) processed++;
            else {
              failedOps.push({ ...op, error: likeResult.error });
              failed++;
            }
            break;
            
          case 'report':
            // 리뷰 신고
            const reportResult = await reportReview(
              op.data.reviewId,
              op.data.reason,
              op.data.userId
            );
            if (reportResult.success) processed++;
            else {
              failedOps.push({ ...op, error: reportResult.error });
              failed++;
            }
            break;
            
          case 'updateStats':
            // 통계 업데이트
            if (op.data.operation === 'add') {
              await updatePlaceReviewStats(op.data.placeId, op.data.rating);
            } else if (op.data.operation === 'edit') {
              await updatePlaceReviewStatsOnEdit(
                op.data.placeId, 
                op.data.oldRating, 
                op.data.newRating
              );
            } else if (op.data.operation === 'delete') {
              await updatePlaceReviewStatsOnDelete(op.data.placeId, op.data.rating);
            }
            processed++;
            break;
            
          default:
            console.warn(`알 수 없는 작업 유형: ${op.operation}`);
            failedOps.push({ ...op, error: '알 수 없는 작업 유형' });
            failed++;
        }
      } catch (opError) {
        console.error(`작업 처리 중 오류 (${op.operation}):`, opError);
        failedOps.push({ ...op, error: opError.message });
        failed++;
      }
    }
    
    // 실패한 작업만 큐에 남김
    if (failedOps.length > 0) {
      localStorage.setItem('reviewOperationsQueue', JSON.stringify(failedOps));
    } else {
      localStorage.removeItem('reviewOperationsQueue');
    }
    
    console.log(`오프라인 작업 동기화 완료: ${processed}개 성공, ${failed}개 실패`);
    
    return {
      success: true,
      processed,
      failed,
      failedOps: failedOps.length > 0 ? failedOps : null
    };
  } catch (error) {
    console.error('오프라인 작업 동기화 오류:', error);
    return { 
      success: false, 
      error: error.message,
      message: '오프라인 작업 동기화 중 오류가 발생했습니다.'
    };
  }
};

// 오프라인 작업 큐의 작업 수를 반환하는 함수
export const getPendingOfflineOperationsCount = () => {
  try {
    const queue = JSON.parse(localStorage.getItem('reviewOperationsQueue') || '[]');
    return queue.length;
  } catch (error) {
    console.error('오프라인 작업 큐 확인 오류:', error);
    return 0;
  }
};

// 네트워크 상태 변경 이벤트 리스너 설정 (자동 동기화용)
// 모듈 스코프에서 리스너 등록
if (typeof window !== 'undefined') {
  const handleNetworkChange = async () => {
    if (navigator.onLine) {
      console.log('네트워크 연결 복구. 오프라인 작업 자동 동기화 시도...');
      try {
        const result = await syncOfflineReviewOperations();
        if (result.success) {
          console.log(`자동 동기화 완료: ${result.processed}개 성공, ${result.failed}개 실패`);
          
          // 동기화 성공 이벤트 발생 (이벤트 리스너에서 처리 가능)
          if (result.processed > 0) {
            const syncEvent = new CustomEvent('reviewsync', {
              detail: { 
                success: true, 
                processed: result.processed,
                failed: result.failed
              }
            });
            window.dispatchEvent(syncEvent);
          }
        }
      } catch (error) {
        console.error('자동 동기화 오류:', error);
      }
    } else {
      console.log('네트워크 연결 끊김. 오프라인 모드로 전환.');
    }
  };

  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', () => {
    console.log('네트워크 연결 끊김. 오프라인 모드로 전환.');
  });
}

// 리뷰 서비스 객체에 동기화 함수 추가
const reviewService = {
  fetchReviews,
  fetchReview,
  fetchUserReview,
  addReview,
  updateReview,
  deleteReview,
  toggleReviewLike,
  fetchReviewStats,
  reportReview,
  
  // 오프라인 동기화 관련 함수 추가
  syncOfflineReviewOperations,
  getPendingOfflineOperationsCount,
  isOffline,
  
  // 추가 유틸리티 함수 노출
  clearReviewsCache
};

export default reviewService;
