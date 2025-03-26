import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Box, Typography, Grid, Paper, Slider, Button 
} from '@mui/material';
import { 
  SentimentVerySatisfied, SentimentVeryDissatisfied, 
  NightsStay, Favorite, AcUnit 
} from '@mui/icons-material';
//import { useUser } from '../contexts/UserContext';
const useUser = () => ({ updateMood: async () => ({ success: true }) });

const moods = [
  { name: '기쁨', icon: <SentimentVerySatisfied fontSize="large" />, color: '#FFD700' },
  { name: '스트레스', icon: <SentimentVeryDissatisfied fontSize="large" />, color: '#FF6347' },
  { name: '피곤함', icon: <NightsStay fontSize="large" />, color: '#6A5ACD' },
  { name: '설렘', icon: <Favorite fontSize="large" />, color: '#FF69B4' },
  { name: '평온함', icon: <AcUnit fontSize="large" />, color: '#20B2AA' },
];

const MoodSelection = () => {
  const { updateMood } = useUser();
  const [selectedMood, setSelectedMood] = useState('');
  const [intensity, setIntensity] = useState(3);
  const navigate = useNavigate();

  const handleMoodSelect = (mood) => {
    setSelectedMood(mood);
  };

  const handleIntensityChange = (event, newValue) => {
    setIntensity(newValue);
  };

  const handleSubmit = async () => {
    if (selectedMood) {
      await updateMood(selectedMood, intensity);
    }
    navigate('/recommendations');
  };

  const handleSkip = () => {
    navigate('/recommendations');
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          현재 감정 상태
        </Typography>
        <Typography variant="body1" gutterBottom>
          지금 느끼는 감정을 선택해주세요. 이에 맞는 장소를 추천해 드립니다.
        </Typography>
        
        <Grid container spacing={2} sx={{ mt: 3 }}>
          {moods.map((mood) => (
            <Grid item xs={4} key={mood.name}>
              <Paper 
                elevation={selectedMood === mood.name ? 6 : 1}
                sx={{ 
                  p: 2, 
                  textAlign: 'center',
                  cursor: 'pointer',
                  borderRadius: 2,
                  border: selectedMood === mood.name ? `2px solid ${mood.color}` : 'none',
                  bgcolor: selectedMood === mood.name ? `${mood.color}22` : 'white',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => handleMoodSelect(mood.name)}
              >
                <Box sx={{ color: mood.color }}>{mood.icon}</Box>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {mood.name}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        
        {selectedMood && (
          <Box sx={{ mt: 4 }}>
            <Typography id="mood-intensity-slider" gutterBottom>
              감정 강도
            </Typography>
            <Slider
              value={intensity}
              onChange={handleIntensityChange}
              aria-labelledby="mood-intensity-slider"
              valueLabelDisplay="auto"
              step={1}
              marks
              min={1}
              max={5}
              sx={{ 
                color: moods.find(m => m.name === selectedMood)?.color || 'primary',
                width: '80%',
                mx: 'auto'
              }}
            />
          </Box>
        )}
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={handleSkip} variant="text">
            건너뛰기
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={!selectedMood}
          >
            추천 보기
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default MoodSelection;
