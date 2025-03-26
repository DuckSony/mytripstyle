import React from 'react';
import { Grid, Card, CardContent, Typography, Box } from '@mui/material';

const mbtiTypes = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
];

function MbtiSelection({ selectedMbti, onMbtiChange }) { // onSelect -> onMbtiChange로 변경
  return (
    <Box sx={{ my: 3 }}>
      <Typography variant="h5" gutterBottom>
        당신의 MBTI 유형을 선택해주세요
      </Typography>
      <Grid container spacing={2}>
        {mbtiTypes.map(mbti => (
          <Grid item xs={3} key={mbti}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                transition: 'transform 0.2s', 
                '&:hover': { transform: 'scale(1.05)' },
                bgcolor: selectedMbti === mbti ? 'primary.light' : 'background.paper',
                color: selectedMbti === mbti ? 'primary.contrastText' : 'text.primary',
                border: selectedMbti === mbti ? 2 : 1,
                borderColor: selectedMbti === mbti ? 'primary.main' : 'divider'
              }}
              onClick={() => onMbtiChange(mbti)} // onSelect -> onMbtiChange로 변경
            >
              <CardContent sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h6">{mbti}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default MbtiSelection;
