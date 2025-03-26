import React, { useState } from 'react';
import { Box, Typography, Chip, TextField, Button, Grid } from '@mui/material';

// 미리 정의된 관심사 목록
const predefinedInterests = [
  '여행', '음식', '커피', '예술', '음악', '영화', '독서', '스포츠',
  '사진', '패션', '게임', '테크놀로지', '자연', '쇼핑', '요리', '춤'
];

function InterestSelection({ selectedInterests = [], customInterests = [], onInterestsChange }) {
  const [newInterest, setNewInterest] = useState('');

  // 관심사 토글 핸들러
  const handleInterestToggle = (interest) => {
    const updatedInterests = selectedInterests.includes(interest)
      ? selectedInterests.filter(item => item !== interest)
      : [...selectedInterests, interest];
    
    onInterestsChange(updatedInterests, customInterests);
  };

  // 사용자 정의 관심사 추가 핸들러
  const handleAddCustomInterest = () => {
    if (newInterest.trim() && !customInterests.includes(newInterest.trim())) {
      const updatedCustomInterests = [...customInterests, newInterest.trim()];
      onInterestsChange(selectedInterests, updatedCustomInterests);
      setNewInterest('');
    }
  };

  // 사용자 정의 관심사 삭제 핸들러
  const handleRemoveCustomInterest = (interest) => {
    const updatedCustomInterests = customInterests.filter(item => item !== interest);
    onInterestsChange(selectedInterests, updatedCustomInterests);
  };

  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h5" gutterBottom>
        관심 있는 주제를 선택하세요
      </Typography>
      <Typography variant="body2" gutterBottom color="text.secondary">
        여러 개 선택할 수 있습니다. 목록에 없는 관심사는 아래에서 직접 추가할 수 있습니다.
      </Typography>
      
      <Box sx={{ my: 3 }}>
        {predefinedInterests.map(interest => (
          <Chip
            key={interest}
            label={interest}
            onClick={() => handleInterestToggle(interest)}
            color={selectedInterests.includes(interest) ? "primary" : "default"}
            variant={selectedInterests.includes(interest) ? "filled" : "outlined"}
            sx={{ m: 0.5 }}
          />
        ))}
      </Box>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          관심사 직접 추가
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={9}>
            <TextField
              fullWidth
              size="small"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              placeholder="관심사 입력"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomInterest()}
            />
          </Grid>
          <Grid item xs={3}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleAddCustomInterest}
              disabled={!newInterest.trim()}
            >
              추가
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {customInterests.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            직접 추가한 관심사
          </Typography>
          {customInterests.map(interest => (
            <Chip
              key={interest}
              label={interest}
              onDelete={() => handleRemoveCustomInterest(interest)}
              color="primary"
              sx={{ m: 0.5 }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default InterestSelection;
