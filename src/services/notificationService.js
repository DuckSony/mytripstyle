// src/services/notificationService.js
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    getDoc, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    serverTimestamp, 
    onSnapshot 
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
  import { getCurrentUser } from './authService';
  
  // 알림 컬렉션 참조
  const notificationsCollection = 'notifications';
  
  /**
   * 사용자의 알림 목록을 가져옵니다.
   * @param {number} limitCount - 가져올 최대 알림 수
   * @returns {Promise<Array>} - 알림 객체 배열
   */
  export const getNotifications = async (limitCount = 50) => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');
  
      const notificationsQuery = query(
        collection(db, notificationsCollection),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
  
      const querySnapshot = await getDocs(notificationsQuery);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      }));
    } catch (error) {
      console.error('알림 가져오기 오류:', error);
      throw error;
    }
  };
  
  /**
   * 특정 알림을 읽음으로 표시합니다.
   * @param {string} notificationId - 알림 ID
   * @returns {Promise<void>}
   */
  export const markNotificationAsRead = async (notificationId) => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');
  
      // 로컬 알림인 경우 처리하지 않음
      if (notificationId.startsWith('local-')) {
        return;
      }
  
      const notificationRef = doc(db, notificationsCollection, notificationId);
      await updateDoc(notificationRef, {
        read: true,
        readAt: serverTimestamp()
      });
    } catch (error) {
      console.error('알림 읽음 표시 오류:', error);
      throw error;
    }
  };

  /**
 * 사용자의 모든 알림을 읽음으로 표시합니다.
 * @returns {Promise<void>}
 */
export const markAllNotificationsAsRead = async () => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');
  
      const unreadNotificationsQuery = query(
        collection(db, notificationsCollection),
        where('userId', '==', user.uid),
        where('read', '==', false)
      );
  
      const querySnapshot = await getDocs(unreadNotificationsQuery);
      
      // 병렬로 모든 알림 업데이트
      const updatePromises = querySnapshot.docs.map(doc => 
        updateDoc(doc.ref, {
          read: true,
          readAt: serverTimestamp()
        })
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('모든 알림 읽음 표시 오류:', error);
      throw error;
    }
  };
  
  /**
   * 알림을 삭제합니다.
   * @param {string} notificationId - 알림 ID
   * @returns {Promise<void>}
   */
  export const deleteNotification = async (notificationId) => {
    try {
      const user = getCurrentUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');
  
      // 로컬 알림인 경우 처리하지 않음
      if (notificationId.startsWith('local-')) {
        return;
      }
  
      const notificationRef = doc(db, notificationsCollection, notificationId);
      
      // 삭제 전 알림 소유자 확인
      const notificationSnap = await getDoc(notificationRef);
      if (!notificationSnap.exists()) {
        throw new Error('존재하지 않는 알림입니다.');
      }
      
      const notificationData = notificationSnap.data();
      if (notificationData.userId !== user.uid) {
        throw new Error('이 알림을 삭제할 권한이 없습니다.');
      }
      
      await deleteDoc(notificationRef);
    } catch (error) {
      console.error('알림 삭제 오류:', error);
      throw error;
    }
  };

  /**
 * 사용자 알림에 실시간으로 구독합니다.
 * @param {string} userId - 사용자 ID
 * @param {Function} onData - 데이터 변경 시 호출될 콜백
 * @param {Function} onError - 오류 발생 시 호출될 콜백
 * @returns {Function} - 구독 해제 함수
 */
export const subscribeToUserNotifications = (userId, onData, onError) => {
    try {
      if (!userId) {
        throw new Error('사용자 ID가 필요합니다.');
      }
  
      const notificationsQuery = query(
        collection(db, notificationsCollection),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
  
      const unsubscribe = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date()
          }));
          onData(notifications);
        },
        (error) => {
          console.error('알림 구독 오류:', error);
          if (onError) onError(error);
        }
      );
  
      return unsubscribe;
    } catch (error) {
      console.error('알림 구독 설정 오류:', error);
      if (onError) onError(error);
      return () => {}; // 빈 함수 반환
    }
  };
  
  /**
   * 새 알림을 생성합니다.
   * @param {object} notificationData - 알림 데이터
   * @returns {Promise<string>} - 생성된 알림 ID
   */
  export const createNotification = async (notificationData) => {
    try {
      const user = getCurrentUser();
      if (!user && !notificationData.userId) {
        throw new Error('사용자 ID가 필요합니다.');
      }
  
      const notification = {
        userId: notificationData.userId || user.uid,
        type: notificationData.type || 'info',
        title: notificationData.title || '알림',
        message: notificationData.message || '',
        read: false,
        timestamp: serverTimestamp(),
        data: notificationData.data || {},
        link: notificationData.link || null,
        imageUrl: notificationData.imageUrl || null,
        expiresAt: notificationData.expiresAt || null
      };
  
      // 이미지가 있으면 업로드
      if (notificationData.image) {
        const imageUrl = await uploadNotificationImage(notificationData.image, user.uid);
        notification.imageUrl = imageUrl;
      }
  
      const docRef = await addDoc(collection(db, notificationsCollection), notification);
      return docRef.id;
    } catch (error) {
      console.error('알림 생성 오류:', error);
      throw error;
    }
  };

  /**
 * 알림에 첨부된 이미지를 업로드합니다.
 * @param {File} imageFile - 이미지 파일
 * @param {string} userId - 사용자 ID
 * @returns {Promise<string>} - 업로드된 이미지 URL
 */
const uploadNotificationImage = async (imageFile, userId) => {
    try {
      const storage = getStorage();
      const timestamp = new Date().getTime();
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `notifications/${userId}/${timestamp}.${fileExt}`;
      
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, imageFile);
      
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('알림 이미지 업로드 오류:', error);
      throw error;
    }
  };
  
  /**
   * 방문 계획 알림을 생성합니다.
   * @param {string} userId - 사용자 ID
   * @param {object} placeData - 장소 데이터
   * @param {Date} visitDate - 방문 예정 날짜
   * @returns {Promise<string>} - 생성된 알림 ID
   */
  export const createVisitReminderNotification = async (userId, placeData, visitDate) => {
    const visitTime = new Date(visitDate).getTime();
    const currentTime = new Date().getTime();
    
    // 현재 시간보다 이전이면 알림 생성하지 않음
    if (visitTime <= currentTime) {
      return null;
    }
  
    try {
      const notification = {
        userId,
        type: 'visit_reminder',
        title: `방문 알림: ${placeData.name}`,
        message: `내일 ${placeData.name} 방문 계획이 있습니다.`,
        read: false,
        timestamp: serverTimestamp(),
        data: {
          placeId: placeData.id,
          placeName: placeData.name,
          visitDate: visitDate.toISOString(),
        },
        link: `/place/${placeData.id}`,
        expiresAt: new Date(visitTime + 24 * 60 * 60 * 1000) // 방문 시간 + 24시간
      };
  
      // 장소 이미지가 있으면 이미지 URL 추가
      if (placeData.imageUrl) {
        notification.imageUrl = placeData.imageUrl;
      }
  
      return await createNotification(notification);
    } catch (error) {
      console.error('방문 알림 생성 오류:', error);
      throw error;
    }
  };
  
  /**
   * 시스템 알림을 생성합니다.
   * @param {string} userId - 사용자 ID
   * @param {string} title - 알림 제목
   * @param {string} message - 알림 메시지
   * @param {object} data - 추가 데이터
   * @returns {Promise<string>} - 생성된 알림 ID
   */
  export const createSystemNotification = async (userId, title, message, data = {}) => {
    try {
      return await createNotification({
        userId,
        type: 'system',
        title,
        message,
        data
      });
    } catch (error) {
      console.error('시스템 알림 생성 오류:', error);
      throw error;
    }
  };
  
  /**
   * 사용자의 읽지 않은 알림 수를 가져옵니다.
   * @returns {Promise<number>} - 읽지 않은 알림 수
   */
  export const getUnreadNotificationCount = async () => {
    try {
      const user = getCurrentUser();
      if (!user) return 0;
  
      const unreadQuery = query(
        collection(db, notificationsCollection),
        where('userId', '==', user.uid),
        where('read', '==', false)
      );
  
      const querySnapshot = await getDocs(unreadQuery);
      return querySnapshot.size;
    } catch (error) {
      console.error('읽지 않은 알림 수 가져오기 오류:', error);
      return 0;
    }
  };
  
  // 모든 서비스 함수를 포함하는 객체 생성
const notificationService = {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    subscribeToUserNotifications,
    createNotification,
    createVisitReminderNotification,
    createSystemNotification,
    getUnreadNotificationCount
  };
  
  // 변수로 할당한 객체를 내보내기
  export default notificationService;
