// src/services/authService.js
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    GoogleAuthProvider, 
    signInWithPopup,
    sendPasswordResetEmail,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
    updateEmail
  } from 'firebase/auth';
  import { 
    doc, 
    setDoc, 
    getDoc, 
    updateDoc, 
    serverTimestamp 
  } from 'firebase/firestore';
  import { db } from '../config/firebase';
  
  /**
   * 이메일과 비밀번호로 회원가입
   * @param {string} email - 사용자 이메일
   * @param {string} password - 사용자 비밀번호
   * @param {Object} userData - 사용자 추가 정보 (이름, MBTI 등)
   * @returns {Promise<Object>} - 회원가입 결과
   */
  export const registerWithEmail = async (email, password, userData) => {
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 사용자 프로필 업데이트 (표시 이름 설정)
      if (userData.name) {
        await updateProfile(user, {
          displayName: userData.name
        });
      }
      
      // Firestore에 사용자 데이터 저장
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        name: userData.name || '',
        mbti: userData.mbti || '',
        interests: userData.interests || [],
        customInterests: userData.customInterests || [],
        talents: userData.talents || [],
        preferredLocations: userData.preferredLocations || [], // 이 줄 추가
        preferredCategories: userData.preferredCategories || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: userData.name || ''
        }
      };
    } catch (error) {
      console.error('회원가입 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * 이메일과 비밀번호로 로그인
   * @param {string} email - 사용자 이메일
   * @param {string} password - 사용자 비밀번호
   * @returns {Promise<Object>} - 로그인 결과
   */
  export const loginWithEmail = async (email, password) => {
    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 마지막 로그인 시간 업데이트
      await updateDoc(doc(db, 'users', user.uid), {
        lastLoginAt: serverTimestamp()
      });
      
      // 사용자 프로필 정보 가져오기
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          ...userData
        }
      };
    } catch (error) {
      console.error('로그인 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * Google 계정으로 로그인
   * @returns {Promise<Object>} - 로그인 결과
   */
  export const loginWithGoogle = async () => {
    try {
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Firestore에 사용자 데이터 확인 및 생성
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // 새 사용자인 경우 기본 데이터 생성
        await setDoc(userDocRef, {
          email: user.email,
          name: user.displayName || '',
          photoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        // 기존 사용자인 경우 로그인 시간 업데이트
        await updateDoc(userDocRef, {
          lastLoginAt: serverTimestamp()
        });
      }
      
      // 사용자 데이터 가져오기
      const updatedUserDoc = await getDoc(userDocRef);
      const userData = updatedUserDoc.exists() ? updatedUserDoc.data() : {};
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          ...userData
        }
      };
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * 로그아웃
   * @returns {Promise<Object>} - 로그아웃 결과
   */
  export const logout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      return { success: true };
    } catch (error) {
      console.error('로그아웃 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * 비밀번호 재설정 이메일 전송
   * @param {string} email - 사용자 이메일
   * @returns {Promise<Object>} - 결과
   */
  export const resetPassword = async (email) => {
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      console.error('비밀번호 재설정 이메일 전송 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * 현재 로그인된 사용자 정보 가져오기
   * @returns {Promise<Object>} - 사용자 정보
   */
  export const getCurrentUser = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      return { success: false, user: null };
    }
    
    try {
      // Firestore에서 추가 사용자 정보 가져오기
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          ...userData
        }
      };
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error),
        user: null
      };
    }
  };
  
  /**
   * 사용자 프로필 정보 업데이트
   * @param {string} userId - 사용자 ID
   * @param {Object} profileData - 업데이트할 프로필 데이터
   * @returns {Promise<Object>} - 업데이트 결과
   */
  export const updateUserProfile = async (userId, profileData) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      // Firebase Auth의 프로필 업데이트 (이름)
      if (profileData.name) {
        await updateProfile(user, {
          displayName: profileData.name
        });
      }
      
      // Firestore의 사용자 데이터 업데이트
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        ...profileData,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * 사용자 이메일 변경
   * @param {string} newEmail - 새 이메일
   * @param {string} password - 현재 비밀번호 (재인증용)
   * @returns {Promise<Object>} - 이메일 변경 결과
   */
  export const changeEmail = async (newEmail, password) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      // 현재 비밀번호로 재인증
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      // 이메일 업데이트
      await updateEmail(user, newEmail);
      
      // Firestore의 이메일 정보도 업데이트
      await updateDoc(doc(db, 'users', user.uid), {
        email: newEmail,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('이메일 변경 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * 비밀번호 변경
   * @param {string} currentPassword - 현재 비밀번호
   * @param {string} newPassword - 새 비밀번호
   * @returns {Promise<Object>} - 비밀번호 변경 결과
   */
  export const changePassword = async (currentPassword, newPassword) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('로그인이 필요합니다.');
      }
      
      // 현재 비밀번호로 재인증
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // 비밀번호 업데이트
      await updatePassword(user, newPassword);
      
      return { success: true };
    } catch (error) {
      console.error('비밀번호 변경 실패:', error);
      return {
        success: false,
        error: translateFirebaseError(error)
      };
    }
  };
  
  /**
   * Firebase 에러 메시지 번역
   * @param {Error} error - Firebase 에러 객체
   * @returns {string} - 번역된 에러 메시지
   */
  const translateFirebaseError = (error) => {
    const errorCode = error.code || '';
    
    // Firebase 인증 관련 에러 메시지 번역
    const errorMessages = {
      'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
      'auth/invalid-email': '유효하지 않은 이메일 형식입니다.',
      'auth/user-disabled': '계정이 비활성화되었습니다.',
      'auth/user-not-found': '등록되지 않은 이메일입니다.',
      'auth/wrong-password': '비밀번호가 올바르지 않습니다.',
      'auth/weak-password': '비밀번호는 최소 6자 이상이어야 합니다.',
      'auth/invalid-credential': '로그인 정보가 올바르지 않습니다.',
      'auth/operation-not-allowed': '이 로그인 방식은 현재 지원되지 않습니다.',
      'auth/requires-recent-login': '보안을 위해 다시 로그인해주세요.',
      'auth/account-exists-with-different-credential': '동일한 이메일로 다른 로그인 방식의 계정이 존재합니다.',
      'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.'
    };
    
    return errorMessages[errorCode] || error.message || '알 수 없는 오류가 발생했습니다.';
  };
