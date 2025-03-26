import React, { useState } from 'react';
import { Box, Typography, Chip, TextField, Button, Grid } from '@mui/material';

// 미리 정의된 재능 목록
const predefinedTalents = [
  '사진촬영', '글쓰기', '요리', '그림그리기', '운동', 
  '춤', '노래', '악기연주', '공예', '코딩', 
  '디자인', '영상편집', '요가/명상', '언어', '연기'
];

function TalentSelection({ selectedTalents = [], onTalentsChange }) {
  const [newTalent, setNewTalent] = useState('');

  // 재능 토글 핸들러
  const handleTalentToggle = (talent) => {
    const updatedTalents = selectedTalents.includes(talent)
      ? selectedTalents.filter(item => item !== talent)
      : [...selectedTalents, talent];
    
    onTalentsChange(updatedTalents);
  };

  // 사용자 정의 재능 추가 핸들러
  const handleAddCustomTalent = () => {
    if (newTalent.trim() && !selectedTalents.includes(newTalent.trim())) {
      const updatedTalents = [...selectedTalents, newTalent.trim()];
      onTalentsChange(updatedTalents);
      setNewTalent('');
    }
  };

  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h5" gutterBottom>
        당신의 재능이나 잘하는 것을 선택하세요
      </Typography>
      <Typography variant="body2" gutterBottom color="text.secondary">
        여러 개 선택할 수 있습니다.
      </Typography>
      
      <Box sx={{ my: 3 }}>
        {predefinedTalents.map(talent => (
          <Chip
            key={talent}
            label={talent}
            onClick={() => handleTalentToggle(talent)}
            color={selectedTalents.includes(talent) ? "primary" : "default"}
            variant={selectedTalents.includes(talent) ? "filled" : "outlined"}
            sx={{ m: 0.5 }}
          />
        ))}
      </Box>
      
      {/* 재능 직접 추가 섹션 */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          재능 직접 추가
        </Typography>
        <Grid container spacing={1}>
          <Grid item xs={9}>
            <TextField
              fullWidth
              size="small"
              value={newTalent}
              onChange={(e) => setNewTalent(e.target.value)}
              placeholder="재능 입력"
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTalent()}
            />
          </Grid>
          <Grid item xs={3}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleAddCustomTalent}
              disabled={!newTalent.trim()}
            >
              추가
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {/* 직접 추가한 재능 목록 */}
      {selectedTalents.filter(talent => !predefinedTalents.includes(talent)).length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            직접 추가한 재능
          </Typography>
          {selectedTalents
            .filter(talent => !predefinedTalents.includes(talent))
            .map(talent => (
              <Chip
                key={talent}
                label={talent}
                onDelete={() => handleTalentToggle(talent)}
                color="primary"
                sx={{ m: 0.5 }}
              />
            ))}
        </Box>
      )}
    </Box>
  );
}

export default TalentSelection;
