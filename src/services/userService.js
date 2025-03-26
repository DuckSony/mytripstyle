// src/services/userService.js
import { getAuth, updateProfile } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

/**
 * 프로필 이미지 업로드 및 사용자 데이터 업데이트
 * @param {File} file - 업로드할 이미지 파일
 * @returns {Promise<Object>} - 업로드 결과
 */
export const uploadProfileImage = async (file) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const userId = user.uid;
    const fileExtension = file.name.split('.').pop();
    const fileName = `profile_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, `users/${userId}/profile/${fileName}`);
    
    // 파일 업로드
    await uploadBytes(storageRef, file);
    
    // 다운로드 URL 가져오기
    const downloadURL = await getDownloadURL(storageRef);
    
    // Firestore 사용자 문서에 이미지 URL 업데이트
    await updateDoc(doc(db, 'users', userId), {
      photoURL: downloadURL,
      updatedAt: serverTimestamp()
    });
    
    // 사용자 인증 프로필 정보도 업데이트
    await updateProfile(user, {
      photoURL: downloadURL
    });
    
    return {
      success: true,
      data: {
        photoURL: downloadURL
      }
    };
  } catch (error) {
    console.error('프로필 이미지 업로드 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * 사용자 닉네임 업데이트
 * @param {string} displayName - 변경할 닉네임
 * @returns {Promise<Object>} - 업데이트 결과
 */
export const updateUserDisplayName = async (displayName) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }
    
    const userId = user.uid;
    
    // Firestore 사용자 문서에 닉네임 업데이트
    await updateDoc(doc(db, 'users', userId), {
      name: displayName,
      updatedAt: serverTimestamp()
    });
    
    // 사용자 인증 프로필 정보도 업데이트
    await updateProfile(user, {
      displayName: displayName
    });
    
    return {
      success: true,
      data: {
        displayName
      }
    };
  } catch (error) {
    console.error('닉네임 업데이트 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
