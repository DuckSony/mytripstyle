import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Stepper, Step, StepLabel, Box, Button, Typography } from '@mui/material';
import MbtiSelection from '../components/profile/MbtiSelection';
import InterestSelection from '../components/profile/InterestSelection';
import TalentSelection from '../components/profile/TalentSelection';
import RegionSelection from '../components/profile/RegionSelection';
import { useUser } from '../contexts/UserContext';

const steps = ['MBTI 유형', '관심사 선택', '재능 선택', '관심 지역 설정'];

const ProfileSetup = () => {
  const { userProfile, updateUserProfile, isProfileComplete } = useUser();
  const [activeStep, setActiveStep] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
    mbti: '',
    interests: [],
    customInterests: [],
    talents: [],
    preferredLocations: []
  });
  const navigate = useNavigate();

  // 기존 프로필 데이터 로드
  useEffect(() => {
    if (userProfile) {
      setProfileData({
        mbti: userProfile.mbti || '',
        interests: userProfile.interests || [],
        customInterests: userProfile.customInterests || [],
        talents: userProfile.talents || [],
        preferredLocations: userProfile.preferredLocations || []
      });
      
      // 프로필이 이미 완성되어 있으면 편집 모드로 설정
      if (isProfileComplete) {
        setIsEditMode(true);
      }
    }
  }, [userProfile, isProfileComplete]);

  const handleNext = async () => {
    // 현재 단계 데이터 저장
    await updateUserProfile(profileData);
    
    if (activeStep === steps.length - 1) {
      // 마지막 단계 완료
      navigate('/mood-selection');
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleMbtiChange = (mbti) => {
    setProfileData((prev) => ({ ...prev, mbti }));
  };

  const handleInterestsChange = (interests, customInterests) => {
    setProfileData((prev) => ({ ...prev, interests, customInterests }));
  };

  const handleTalentsChange = (talents) => {
    setProfileData((prev) => ({ ...prev, talents }));
  };

  const handleRegionsChange = (preferredLocations) => {
    setProfileData((prev) => ({ ...prev, preferredLocations }));
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return <MbtiSelection 
          selectedMbti={profileData.mbti} 
          onMbtiChange={handleMbtiChange}
        />;
      case 1:
        return <InterestSelection 
          selectedInterests={profileData.interests} 
          customInterests={profileData.customInterests}
          onInterestsChange={handleInterestsChange}
        />;
      case 2:
        return <TalentSelection selectedTalents={profileData.talents} onTalentsChange={handleTalentsChange} />;
      case 3:
        return <RegionSelection 
          selectedRegions={profileData.preferredLocations} 
          onRegionsChange={handleRegionsChange} 
        />;
      default:
        return 'Unknown step';
    }
  };

  // 현재 단계가 완료되었는지 확인
  const isStepComplete = () => {
    switch (activeStep) {
      case 0: // MBTI
        return !!profileData.mbti;
      case 1: // 관심사
        return profileData.interests.length > 0;
      case 2: // 재능
        return profileData.talents.length > 0;
      case 3: // 관심 지역
        return profileData.preferredLocations.length > 0;
      default:
        return false;
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom textAlign="center">
          {isEditMode ? '프로필 수정' : '프로필 설정'}
        </Typography>
        
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        <Box sx={{ mt: 4, mb: 2 }}>
          {getStepContent(activeStep)}
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            이전
          </Button>
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepComplete()}
          >
            {activeStep === steps.length - 1 ? '완료' : '다음'}
          </Button>
        </Box>
        
        {isEditMode && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button 
              onClick={() => navigate('/mood-selection')}
              color="secondary"
              variant="text"
            >
              취소하고 감정 선택으로 돌아가기
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default ProfileSetup;
