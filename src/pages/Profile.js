// src/pages/Profile.js
import React, { useState, useEffect } from 'react';
import { 
 Container, 
 Box, 
 Typography, 
 Paper, 
 Tabs, 
 Tab, 
 Button, 
 Divider,
 CircularProgress,
 Alert,
 Chip,
 TextField,
 IconButton
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Close as CloseIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { updateUserDisplayName } from '../services/userService';
import ProfileImageEditor from '../components/profile/ProfileImageEditor';

// 모든 컴포넌트 import
import MbtiSelection from '../components/profile/MbtiSelection';
import InterestSelection from '../components/profile/InterestSelection';
import TalentSelection from '../components/profile/TalentSelection';
import RegionSelection from '../components/profile/RegionSelection';

const Profile = () => {
 const { userProfile, isProfileComplete, updateUserProfile } = useUser();
 const { currentUser, logout } = useAuth();
 const [activeTab, setActiveTab] = useState(0);
 const [editMode, setEditMode] = useState(false);
 const [loading, setLoading] = useState(false);
 const [success, setSuccess] = useState(false);
 const [error, setError] = useState('');
 
 // 프로필 데이터 상태
 const [mbti, setMbti] = useState(userProfile?.mbti || '');
 const [interests, setInterests] = useState(userProfile?.interests || []);
 const [customInterests, setCustomInterests] = useState(userProfile?.customInterests || []);
 const [talents, setTalents] = useState(userProfile?.talents || []);
 const [selectedRegions, setSelectedRegions] = useState(userProfile?.preferredLocations || []);
 
 // 닉네임 수정 상태
 const [editingName, setEditingName] = useState(false);
 const [displayName, setDisplayName] = useState(userProfile?.name || currentUser?.displayName || '');
 const [savingName, setSavingName] = useState(false);

 // 컴포넌트 마운트 시 최초 1회만 실행되는 효과
 useEffect(() => {
   // userProfile이 로드되기 전에 세션 스토리지에서 데이터 복원
   if (currentUser && !userProfile) {
     try {
       const sessionData = sessionStorage.getItem(`userProfile_${currentUser.uid}`);
       const localData = localStorage.getItem(`userProfile_${currentUser.uid}`);
       
       // 세션 스토리지나 로컬 스토리지 데이터가 있으면 사용
       const cachedData = sessionData || localData;
       
       if (cachedData) {
         const parsedData = JSON.parse(cachedData);
         
         // 렌더링 전에 상태 설정
         setMbti(parsedData.mbti || '');
         
         // 배열 데이터 안전하게 설정
         if (Array.isArray(parsedData.interests)) {
           setInterests(parsedData.interests);
         }
         
         if (Array.isArray(parsedData.customInterests)) {
           setCustomInterests(parsedData.customInterests);
         }
         
         if (Array.isArray(parsedData.talents)) {
           setTalents(parsedData.talents);
         }
         
         // 관심 지역 데이터 설정
         if (Array.isArray(parsedData.preferredLocations)) {
           console.log("캐시에서 관심 지역 데이터 복원:", parsedData.preferredLocations);
           setSelectedRegions(parsedData.preferredLocations);
         }
         
         setDisplayName(parsedData.name || currentUser?.displayName || '');
       }
     } catch (error) {
       console.warn("캐시 데이터 파싱 오류:", error);
     }
   }
 }, [currentUser, userProfile]);

 // userProfile이 변경될 때마다 상태 업데이트
 useEffect(() => {
   console.log("Profile useEffect 실행됨", { userProfile });
   if (userProfile) {
     setMbti(userProfile.mbti || '');
     setInterests(Array.isArray(userProfile.interests) ? userProfile.interests : []);
     setCustomInterests(Array.isArray(userProfile.customInterests) ? userProfile.customInterests : []);
     setTalents(Array.isArray(userProfile.talents) ? userProfile.talents : []);
     
     // preferredCategories 또는 preferredLocations 사용
     let locationData = [];
     
     // Firebase에 preferredLocations가 있으면 우선 사용
     if (Array.isArray(userProfile.preferredLocations) && userProfile.preferredLocations.length > 0) {
       locationData = [...userProfile.preferredLocations];
     } 
     // 없으면 preferredCategories를 확인
     else if (Array.isArray(userProfile.preferredCategories) && userProfile.preferredCategories.length > 0) {
       locationData = [...userProfile.preferredCategories];
     }
     
     console.log("관심 지역 데이터 확인:", { 
       preferredLocations: userProfile.preferredLocations,
       preferredCategories: userProfile.preferredCategories,
       selected: locationData
     });
     
     setSelectedRegions(locationData);
     setDisplayName(userProfile.name || currentUser?.displayName || '');
   }
 }, [userProfile, currentUser]);
 
 const handleTabChange = (event, newValue) => {
   setActiveTab(newValue);
 };
 
 const handleEditToggle = () => {
   if (editMode) {
     // 편집 모드 종료 시 원래 데이터로 복원
     if (userProfile) {
       setMbti(userProfile.mbti || '');
       setInterests(Array.isArray(userProfile.interests) ? userProfile.interests : []);
       setCustomInterests(Array.isArray(userProfile.customInterests) ? userProfile.customInterests : []);
       setTalents(Array.isArray(userProfile.talents) ? userProfile.talents : []);
       
       // 관심 지역 데이터 복원
       let locationData = [];
       if (Array.isArray(userProfile.preferredLocations) && userProfile.preferredLocations.length > 0) {
         locationData = [...userProfile.preferredLocations];
       } else if (Array.isArray(userProfile.preferredCategories) && userProfile.preferredCategories.length > 0) {
         locationData = [...userProfile.preferredCategories];
       }
       setSelectedRegions(locationData);
     }
   }
   setEditMode(!editMode);
   setSuccess(false);
   setError('');
 };
 
 const handleSaveProfile = async () => {
   setLoading(true);
   setError('');
   setSuccess(false);
   
   try {
     const profileData = {
       mbti,
       interests,
       customInterests,
       talents,
       preferredLocations: selectedRegions,
       // Firebase에 표시되는 필드명 추가
       preferredCategories: selectedRegions
     };
     
     console.log("저장할 프로필 데이터:", profileData);
     console.log("저장할 관심 지역 데이터:", selectedRegions);
     
     const result = await updateUserProfile(profileData);
     
     if (result.success) {
       setSuccess(true);
       setEditMode(false);
       
       // 로컬 스토리지와 세션 스토리지 업데이트
       if (currentUser) {
         try {
           const cacheKey = `userProfile_${currentUser.uid}`;
           const cachedData = localStorage.getItem(cacheKey);
           
           if (cachedData) {
             const parsedData = JSON.parse(cachedData);
             const updatedData = {
               ...parsedData,
               ...profileData
             };
             
             localStorage.setItem(cacheKey, JSON.stringify(updatedData));
             sessionStorage.setItem(cacheKey, JSON.stringify(updatedData));
             console.log("프로필 캐시 업데이트됨");
           }
         } catch (cacheError) {
           console.warn("로컬 캐시 업데이트 오류:", cacheError);
         }
       }
     } else {
       setError(result.error || '프로필 업데이트에 실패했습니다.');
     }
   } catch (err) {
     setError('프로필 저장 중 오류가 발생했습니다.');
     console.error("프로필 저장 오류:", err);
   } finally {
     setLoading(false);
   }
 };
 
 const handleMbtiChange = (newMbti) => {
   setMbti(newMbti);
 };
 
 const handleInterestsChange = (newInterests, newCustomInterests) => {
   setInterests(newInterests);
   setCustomInterests(newCustomInterests || []);
 };
 
 const handleTalentsChange = (newTalents) => {
   setTalents(newTalents);
 };
 
 const handleRegionsChange = (newRegions) => {
   // 디버깅 로그 추가
   console.log("관심 지역 변경:", newRegions);
   
   // 데이터 검증 후 상태 업데이트
   if (Array.isArray(newRegions)) {
     setSelectedRegions(newRegions);
     
     // 로컬 스토리지에도 즉시 반영 (동기화 유지)
     if (currentUser) {
       try {
         const cacheKey = `userProfile_${currentUser.uid}`;
         const cachedData = localStorage.getItem(cacheKey);
         
         if (cachedData) {
           const parsedData = JSON.parse(cachedData);
           parsedData.preferredLocations = newRegions;
           
           localStorage.setItem(cacheKey, JSON.stringify(parsedData));
           sessionStorage.setItem(cacheKey, JSON.stringify(parsedData));
           
           console.log("관심 지역 캐시 업데이트됨:", newRegions);
         }
       } catch (error) {
         console.warn("로컬 캐시 업데이트 오류:", error);
       }
     }
   } else {
     console.warn("유효하지 않은 지역 데이터:", newRegions);
     setSelectedRegions([]);
   }
 };
 
 // 닉네임 저장 처리
 const handleSaveName = async () => {
   if (!displayName.trim()) {
     setError('닉네임을 입력해주세요.');
     return;
   }
   
   setSavingName(true);
   setError('');
   
   try {
     const result = await updateUserDisplayName(displayName);
     
     if (result.success) {
       // UserContext 업데이트
       await updateUserProfile({ name: displayName });
       setEditingName(false);
       
       // 로컬 캐시 업데이트
       if (currentUser) {
         try {
           const cacheKey = `userProfile_${currentUser.uid}`;
           const cachedData = localStorage.getItem(cacheKey);
           
           if (cachedData) {
             const parsedData = JSON.parse(cachedData);
             parsedData.name = displayName;
             
             localStorage.setItem(cacheKey, JSON.stringify(parsedData));
             sessionStorage.setItem(cacheKey, JSON.stringify(parsedData));
           }
         } catch (cacheError) {
           console.warn("닉네임 캐시 업데이트 오류:", cacheError);
         }
       }
     } else {
       setError(result.error || '닉네임 업데이트에 실패했습니다.');
     }
   } catch (err) {
     setError('닉네임 저장 중 오류가 발생했습니다.');
     console.error("닉네임 저장 오류:", err);
   } finally {
     setSavingName(false);
   }
 };
 
 // 프로필 이미지 업데이트 처리
 const handleProfileImageUpdate = async (photoURL) => {
   try {
     await updateUserProfile({ photoURL });
     
     // 로컬 캐시 업데이트
     if (currentUser) {
       try {
         const cacheKey = `userProfile_${currentUser.uid}`;
         const cachedData = localStorage.getItem(cacheKey);
         
         if (cachedData) {
           const parsedData = JSON.parse(cachedData);
           parsedData.photoURL = photoURL;
           
           localStorage.setItem(cacheKey, JSON.stringify(parsedData));
           sessionStorage.setItem(cacheKey, JSON.stringify(parsedData));
         }
       } catch (cacheError) {
         console.warn("프로필 이미지 캐시 업데이트 오류:", cacheError);
       }
     }
   } catch (error) {
     console.error('프로필 이미지 업데이트 오류:', error);
     setError('프로필 이미지 업데이트에 실패했습니다.');
   }
 };

 return (
   <Container maxWidth="md">
     <Box sx={{ my: 4 }}>
       <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
         {/* 프로필 헤더 */}
         <Box sx={{ 
           display: 'flex', 
           flexDirection: { xs: 'column', sm: 'row' }, 
           alignItems: { xs: 'center', sm: 'flex-start' },
           mb: 3 
         }}>
           <ProfileImageEditor
             currentPhotoURL={userProfile?.photoURL}
             onImageUpdate={handleProfileImageUpdate}
           />
           
           <Box sx={{ 
             flexGrow: 1,
             mt: { xs: 2, sm: 0 },
             ml: { xs: 0, sm: 3 },
             textAlign: { xs: 'center', sm: 'left' },
             width: { xs: '100%', sm: 'auto' }
           }}>
             <Box sx={{ 
               display: 'flex', 
               alignItems: 'center', 
               mb: 1,
               justifyContent: { xs: 'center', sm: 'flex-start' }
             }}>
               {editingName ? (
                 <Box sx={{ 
                   display: 'flex', 
                   alignItems: 'center',
                   width: { xs: '100%', sm: 'auto' }
                 }}>
                   <TextField
                     value={displayName}
                     onChange={(e) => setDisplayName(e.target.value)}
                     placeholder="닉네임을 입력하세요"
                     variant="outlined"
                     size="small"
                     fullWidth
                     disabled={savingName}
                     error={!displayName.trim()}
                     helperText={!displayName.trim() ? "닉네임을 입력해주세요" : ""}
                     sx={{ mr: 1 }}
                   />
                   <IconButton
                     color="primary"
                     onClick={handleSaveName}
                     disabled={savingName || !displayName.trim()}
                     size="small"
                     sx={{ mr: 0.5 }}
                   >
                     {savingName ? <CircularProgress size={20} /> : <SaveIcon />}
                   </IconButton>
                   <IconButton
                     onClick={() => {
                       setEditingName(false);
                       setDisplayName(userProfile?.name || currentUser?.displayName || '');
                     }}
                     size="small"
                     disabled={savingName}
                   >
                     <CloseIcon />
                   </IconButton>
                 </Box>
               ) : (
                 <Box sx={{ 
                   display: 'flex', 
                   alignItems: 'center',
                   justifyContent: { xs: 'center', sm: 'flex-start' },
                   width: '100%'
                 }}>
                   <Typography variant="h5" sx={{ mr: 1 }}>
                     {userProfile?.name || currentUser?.displayName || '사용자'}
                   </Typography>
                   <IconButton
                     size="small"
                     onClick={() => setEditingName(true)}
                     color="primary"
                   >
                     <EditIcon fontSize="small" />
                   </IconButton>
                 </Box>
               )}
             </Box>
             <Typography variant="body2" color="text.secondary">
               {userProfile?.email || currentUser?.email || '이메일 정보 없음'}
             </Typography>
             <Box sx={{ mt: 1 }}>
               {isProfileComplete ? (
                 <Typography variant="body2" color="success.main">
                   프로필 설정 완료
                 </Typography>
               ) : (
                 <Typography variant="body2" color="warning.main">
                   프로필을 완성해주세요
                 </Typography>
               )}
             </Box>
           </Box>
           
           <Box sx={{ 
             display: 'flex', 
             justifyContent: 'center',
             mt: { xs: 2, sm: 0 },
             width: { xs: '100%', sm: 'auto' },
             gap: 1
           }}>
             <Button 
               variant={editMode ? "outlined" : "contained"} 
               color={editMode ? "secondary" : "primary"}
               startIcon={editMode ? null : <EditIcon />}
               onClick={handleEditToggle}
               size="medium"
               fullWidth={window.innerWidth < 600}
               sx={{ maxWidth: { xs: '45%', sm: 'none' } }}
             >
               {editMode ? '취소' : '프로필 편집'}
             </Button>
             
             <Button
               variant="outlined"
               color="error"
               onClick={logout}
               size="medium"
               fullWidth={window.innerWidth < 600}
               sx={{ maxWidth: { xs: '45%', sm: 'none' } }}
             >
               로그아웃
             </Button>
           </Box>
         </Box>
         
         <Divider sx={{ mb: 3 }} />
         
         {success && (
           <Alert severity="success" sx={{ mb: 3 }}>
             프로필이 성공적으로 저장되었습니다.
           </Alert>
         )}
         
         {error && (
           <Alert severity="error" sx={{ mb: 3 }}>
             {error}
           </Alert>
         )}
         
         {/* 탭 내비게이션 */}
         <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
           <Tabs value={activeTab} onChange={handleTabChange}>
             <Tab label="MBTI" id="profile-tab-0" />
             <Tab label="관심사" id="profile-tab-1" />
             <Tab label="재능" id="profile-tab-2" />
             <Tab label="관심 지역" id="profile-tab-3" />
           </Tabs>
         </Box>
         
         {/* 탭 내용 - 모든 탭 구현 */}
         <Box sx={{ mb: 3, minHeight: 300 }}>
           {activeTab === 0 && (
             <Box>
               {editMode ? (
                 <MbtiSelection 
                   selectedMbti={mbti} 
                   onMbtiChange={handleMbtiChange} 
                 />
               ) : (
                 <Box sx={{ p: 2, textAlign: 'center' }}>
                   <Typography variant="h4" gutterBottom color="primary">
                     {mbti || 'MBTI 미설정'}
                   </Typography>
                   <Typography variant="body1">
                     {mbti ? 'MBTI를 기반으로 맞춤 장소를 추천해드립니다.' : 'MBTI를 설정하면 맞춤 장소를 추천받을 수 있습니다.'}
                   </Typography>
                 </Box>
               )}
             </Box>
           )}
           
           {activeTab === 1 && (
             <Box>
               {editMode ? (
                 <InterestSelection 
                   selectedInterests={interests} 
                   customInterests={customInterests}
                   onInterestsChange={handleInterestsChange} 
                 />
               ) : (
                 <Box>
                   <Typography variant="h6" gutterBottom>관심사</Typography>
                   <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                     {Array.isArray(interests) && interests.length > 0 ? (
                       interests.map((interest, index) => (
                         <Chip key={`interest-${index}`} label={interest} color="primary" variant="outlined" />
                       ))
                     ) : (
                       <Typography variant="body2" color="text.secondary">선택된 관심사가 없습니다.</Typography>
                     )}
                   </Box>
                   
                   {Array.isArray(customInterests) && customInterests.length > 0 && (
                     <>
                       <Typography variant="h6" gutterBottom>직접 추가한 관심사</Typography>
                       <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                         {customInterests.map((interest, index) => (
                           <Chip key={`custom-interest-${index}`} label={interest} color="secondary" variant="outlined" />
                         ))}
                       </Box>
                     </>
                   )}
                 </Box>
               )}
             </Box>
           )}
           
           {activeTab === 2 && (
             <Box>
               {editMode ? (
                 <TalentSelection 
                   selectedTalents={talents} 
                   onTalentsChange={handleTalentsChange} 
                 />
               ) : (
                 <Box>
                   <Typography variant="h6" gutterBottom>재능</Typography>
                   <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                     {Array.isArray(talents) && talents.length > 0 ? (
                       talents.map((talent, index) => (
                         <Chip key={`talent-${index}`} label={talent} color="primary" variant="outlined" />
                       ))
                     ) : (
                       <Typography variant="body2" color="text.secondary">선택된 재능이 없습니다.</Typography>
                     )}
                   </Box>
                 </Box>
               )}
             </Box>
           )}
           
           {activeTab === 3 && (
             <Box>
               {editMode ? (
                 <RegionSelection 
                   selectedRegions={selectedRegions} 
                   onRegionsChange={handleRegionsChange} 
                 />
               ) : (
                 <Box>
                   <Typography variant="h6" gutterBottom>관심 지역</Typography>
                   {console.log("렌더링 시점 관심 지역 데이터:", selectedRegions)}
                   {Array.isArray(selectedRegions) && selectedRegions.length > 0 ? (
                     <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                       {selectedRegions.map((region, index) => (
                         <Chip 
                           key={`region-${index}`} 
                           label={region.subRegion ? `${region.region} - ${region.subRegion}` : region.region} 
                           color="primary" 
                           variant="outlined" 
                           sx={{ mb: 1 }}
                         />
                       ))}
                     </Box>
                   ) : (
                     <Typography variant="body2" color="text.secondary">선택된 관심 지역이 없습니다.</Typography>
                   )}
                 </Box>
               )}
             </Box>
           )}
         </Box>
         
         {/* 저장 버튼 (편집 모드일 때만 표시) */}
         {editMode && (
           <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
             <Button
               variant="contained"
               color="primary"
               onClick={handleSaveProfile}
               disabled={loading}
               size="large"
               sx={{ minWidth: 120 }}
             >
               {loading ? <CircularProgress size={24} /> : '저장하기'}
             </Button>
           </Box>
         )}
       </Paper>
     </Box>
   </Container>
 );
};

export default Profile;
